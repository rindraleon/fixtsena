import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Review, Order, OrderLine, Dispute } from '../../database/entities/transaction.entity';
import { Product } from '../../database/entities/catalog.entity';
import { User } from '../../database/entities/user.entity';
import { CreateReviewDto, UpdateReviewDto, FilterReviewDto, SellerReplyDto, ReportReviewDto, ModerateReviewDto } from './dto/review.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { BadgesService } from '../badges/badges.service';
import { AdminService } from '../admin/admin.service';
import { OrderStatus, UserRole, DisputeStatus } from '../../database/entities/role.enum';

export interface ReviewUserSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
}

export type ReviewView = Review & {
  reviewer: ReviewUserSummary | null;
  reviewed: ReviewUserSummary | null;
  orderNumber: string | null;
  product: { id: string; name: string; slug: string } | null;
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderLine)
    private readonly orderLineRepository: Repository<OrderLine>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly adminService?: AdminService,
    @Optional() private readonly badges?: BadgesService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (order.buyerId !== userId) {
      throw new ForbiddenException('Seul l\'acheteur peut laisser un avis');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Vous ne pouvez laisser un avis qu\'après livraison');
    }

    const existingReview = await this.reviewRepository.findOne({
      where: { orderId: dto.orderId, reviewerId: userId },
    });

    if (existingReview) {
      throw new ConflictException('Vous avez déjà laissé un avis pour cette commande');
    }

    if (order.sellerId !== dto.reviewedId) {
      throw new BadRequestException('L\'utilisateur évalué n\'est pas le vendeur de cette commande');
    }

    const disputeDelayDays = Number(this.settings?.get('reviews.disputeDelayDays') ?? 7);
    const dispute = await this.reviewRepository.manager.getRepository(Dispute).findOne({ where: { orderId: order.id } });
    if (dispute) {
      const open = ![DisputeStatus.CLOSED, DisputeStatus.CANCELLED, DisputeStatus.RESOLVED_BUYER, DisputeStatus.RESOLVED_SELLER, DisputeStatus.PARTIAL_RESOLUTION].includes(dispute.status);
      if (open) {
        throw new BadRequestException('Un litige est en cours sur cette commande : l\'avis sera possible une fois le litige clos');
      }
      const resolvedAt = dispute.resolvedAt ? new Date(dispute.resolvedAt).getTime() : 0;
      if (resolvedAt && Date.now() - resolvedAt < disputeDelayDays * 24 * 3600 * 1000) {
        throw new BadRequestException(`Après un litige, l'avis est possible ${disputeDelayDays} jour(s) après la décision`);
      }
    }

    const minCommentLength = Number(this.settings?.get('reviews.minCommentLength') ?? 0);
    if (minCommentLength > 0 && (dto.comment ?? '').trim().length < minCommentLength) {
      throw new BadRequestException(`Le commentaire doit contenir au moins ${minCommentLength} caractères`);
    }

    const lines = await this.orderLineRepository.find({ where: { orderId: order.id } });
    let productId: string | null = null;
    if (dto.productId) {
      if (!lines.some((l) => l.productId === dto.productId)) {
        throw new BadRequestException('Ce produit ne fait pas partie de la commande');
      }
      productId = dto.productId;
    } else if (lines.length === 1) {
      productId = lines[0].productId;
    }

    const review = this.reviewRepository.create({
      orderId: dto.orderId,
      reviewerId: userId,
      reviewedId: dto.reviewedId,
      rating: dto.rating,
      productRating: dto.productRating ?? null,
      deliveryRating: dto.deliveryRating ?? null,
      productId,
      comment: dto.comment,
      isVisible: true,
    });

    const savedReview = await this.reviewRepository.save(review);

    await this.refreshReputation(dto.reviewedId);
    if (productId) await this.refreshProductRating(productId);

    this.logger.log(`Avis créé: ${savedReview.id} par ${userId} pour vendeur ${dto.reviewedId}`);

    await this.notifications?.notify({
      userId: dto.reviewedId,
      type: 'review.received',
      title: `Nouvel avis ${dto.rating}/5 — commande ${order.orderNumber}`,
      body: dto.comment ? `« ${dto.comment.substring(0, 180)} »` : 'Un client vient de noter votre vente. Vous pouvez y répondre publiquement.',
      link: '/dashboard/vendeur/avis',
      email: { orderNumber: order.orderNumber, status: 'Avis reçu', nextAction: 'Répondre publiquement à l\'avis', actionLabel: 'Voir mes avis' },
    });

    void Promise.all([this.badges?.evaluateUser(savedReview.reviewedId), this.badges?.evaluateUser(userId)]).catch(() => undefined);

    return savedReview;
  }

  async reply(reviewId: string, userId: string, dto: SellerReplyDto) {
    const review = await this.findById(reviewId);
    if (review.reviewedId !== userId) {
      throw new ForbiddenException('Seul le vendeur évalué peut répondre à cet avis');
    }
    if (review.sellerReply) {
      throw new ConflictException('Vous avez déjà répondu à cet avis');
    }
    review.sellerReply = dto.reply.trim();
    review.sellerRepliedAt = new Date();
    await this.reviewRepository.save(review);
    await this.notifications?.notify({
      userId: review.reviewerId,
      type: 'review.replied',
      title: 'Le vendeur a répondu à votre avis',
      body: `« ${review.sellerReply.substring(0, 180)} »`,
      link: '/dashboard/client/mes-avis',
    });
    return review;
  }

  async report(reviewId: string, userId: string, dto: ReportReviewDto) {
    const review = await this.findById(reviewId);
    if (review.reviewerId === userId) {
      throw new BadRequestException('Vous ne pouvez pas signaler votre propre avis');
    }
    if (review.reportedAt) {
      throw new ConflictException('Cet avis a déjà été signalé et sera examiné par la modération');
    }
    review.reportedBy = userId;
    review.reportReason = dto.reason.trim();
    review.reportedAt = new Date();
    await this.reviewRepository.save(review);
    this.logger.log(`Avis ${reviewId} signalé par ${userId}`);
    return review;
  }

  async moderate(reviewId: string, adminId: string, dto: ModerateReviewDto) {
    const review = await this.findById(reviewId);
    const before = { isVisible: review.isVisible, moderationReason: review.moderationReason };
    review.isVisible = dto.isVisible;
    review.moderatedBy = adminId;
    review.moderationReason = dto.reason?.trim() || null;
    if (dto.isVisible) {
      review.reportedAt = null;
      review.reportReason = null;
      review.reportedBy = null;
    }
    await this.reviewRepository.save(review);
    await this.refreshReputation(review.reviewedId);
    if (review.productId) await this.refreshProductRating(review.productId);
    try {
      await this.adminService?.createAuditLog(adminId, dto.isVisible ? 'REVIEW_RESTORE' : 'REVIEW_HIDE', 'Review', review.id, {
        before,
        after: { isVisible: review.isVisible, moderationReason: review.moderationReason },
      });
    } catch (error) {
      this.logger.warn(`Audit modération avis ${reviewId} impossible: ${error instanceof Error ? error.message : error}`);
    }
    return review;
  }

  private async refreshProductRating(productId: string): Promise<void> {
    try {
      const result = await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(COALESCE(review.productRating, review.rating))', 'average')
        .addSelect('COUNT(review.id)', 'count')
        .where('review.productId = :productId', { productId })
        .andWhere('review.isVisible = true')
        .getRawOne<{ average: string | null; count: string }>();
      const reviewCount = Number(result?.count ?? 0);
      const averageRating = reviewCount > 0 ? Math.round(Number(result?.average) * 100) / 100 : 0;
      await this.productRepository.update({ id: productId }, { averageRating, reviewCount });
    } catch (error) {
      this.logger.error(`Impossible de recalculer la note du produit ${productId}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private async enrich(reviews: Review[]): Promise<ReviewView[]> {
    if (reviews.length === 0) return [];
    const userIds = [...new Set(reviews.flatMap((r) => [r.reviewerId, r.reviewedId]))];
    const orderIds = [...new Set(reviews.map((r) => r.orderId))];
    const productIds = [...new Set(reviews.map((r) => r.productId).filter((id): id is string => !!id))];
    const [users, orders, products] = await Promise.all([
      this.userRepository.find({ where: { id: In(userIds) }, select: ['id', 'firstName', 'lastName', 'avatarUrl'], withDeleted: true }),
      this.orderRepository.find({ where: { id: In(orderIds) }, select: ['id', 'orderNumber'] }),
      productIds.length ? this.productRepository.find({ where: { id: In(productIds) }, select: ['id', 'name', 'slug'], withDeleted: true }) : Promise.resolve([] as Product[]),
    ]);
    const userById = new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName ?? null, avatarUrl: u.avatarUrl ?? null }]));
    const orderById = new Map(orders.map((o) => [o.id, o.orderNumber]));
    const productById = new Map(products.map((p) => [p.id, { id: p.id, name: p.name, slug: p.slug }]));
    return reviews.map((review) => ({
      ...review,
      reviewer: userById.get(review.reviewerId) ?? null,
      reviewed: userById.get(review.reviewedId) ?? null,
      orderNumber: orderById.get(review.orderId) ?? null,
      product: review.productId ? productById.get(review.productId) ?? null : null,
    }));
  }

  async updateReview(reviewId: string, dto: UpdateReviewDto, userId: string, userRoles: UserRole[]) {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Avis non trouvé');
    }

    if (review.reviewerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de modifier cet avis');
    }

    if (review.reviewerId === userId && !userRoles.includes(UserRole.ADMIN)) {
      const editWindowHours = Number(this.settings?.get('reviews.editWindowHours') ?? 48);
      const createdAt = new Date(review.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > editWindowHours) {
        throw new BadRequestException(`Vous ne pouvez modifier votre avis que pendant ${editWindowHours}h`);
      }
      delete (dto as Partial<UpdateReviewDto>).isVisible;
    }

    Object.assign(review, dto);
    await this.reviewRepository.save(review);
    await this.refreshReputation(review.reviewedId);
    if (review.productId) await this.refreshProductRating(review.productId);

    this.logger.log(`Avis ${reviewId} mis à jour`);

    return review;
  }

  async removeReview(reviewId: string, userId: string, userRoles: UserRole[]) {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Avis non trouvé');
    }

    if (review.reviewerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de supprimer cet avis');
    }

    review.isVisible = false;
    await this.reviewRepository.save(review);
    await this.refreshReputation(review.reviewedId);
    if (review.productId) await this.refreshProductRating(review.productId);

    this.logger.log(`Avis ${reviewId} masqué`);

    return { success: true };
  }

  private async refreshReputation(reviewedId: string): Promise<void> {
    try {
      const result = await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'average')
        .addSelect('COUNT(review.id)', 'count')
        .where('review.reviewedId = :reviewedId', { reviewedId })
        .andWhere('review.isVisible = true')
        .getRawOne<{ average: string | null; count: string }>();
      const reviewCount = Number(result?.count ?? 0);
      const reputationScore = reviewCount > 0 ? Math.round(Number(result?.average) * 100) / 100 : 0;
      await this.userRepository.update({ id: reviewedId }, { reputationScore, reviewCount });
    } catch (error) {
      this.logger.error(`Impossible de recalculer la réputation de ${reviewedId}`, error instanceof Error ? error.stack : undefined);
    }
  }

  async findById(id: string) {
    const review = await this.reviewRepository.findOne({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Avis non trouvé');
    }

    return review;
  }

  async findAll(filters: FilterReviewDto, viewerRoles: UserRole[] = []) {
    const { reviewerId, reviewedId, productId, reported, includeHidden, minRating, maxRating, page = 1, limit = 20 } = filters;
    const isAdmin = viewerRoles.includes(UserRole.ADMIN);

    const qb = this.reviewRepository.createQueryBuilder('review');
    if (isAdmin && (includeHidden || reported)) {
      qb.where('1 = 1');
    } else {
      qb.where('review.isVisible = :isVisible', { isVisible: true });
    }
    if (isAdmin && reported) {
      qb.andWhere('review.reportedAt IS NOT NULL');
    }

    if (reviewerId) {
      qb.andWhere('review.reviewerId = :reviewerId', { reviewerId });
    }
    if (reviewedId) {
      qb.andWhere('review.reviewedId = :reviewedId', { reviewedId });
    }
    if (productId) {
      qb.andWhere('review.productId = :productId', { productId });
    }
    if (minRating !== undefined) {
      qb.andWhere('review.rating >= :minRating', { minRating });
    }
    if (maxRating !== undefined) {
      qb.andWhere('review.rating <= :maxRating', { maxRating });
    }

    qb.orderBy('review.createdAt', 'DESC');

    const total = await qb.getCount();
    const reviews = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const items = await this.enrich(reviews);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getAverageRating(reviewedId: string) {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.reviewedId = :reviewedId', { reviewedId })
      .andWhere('review.isVisible = :isVisible', { isVisible: true })
      .getRawOne();

    return {
      reviewedId,
      averageRating: result?.average ? parseFloat(result.average) : 0,
      reviewCount: result?.count ? parseInt(result.count, 10) : 0,
    };
  }

  async getStats() {
    const totalReviews = await this.reviewRepository.count({ where: { isVisible: true } });

    const avgResult = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.isVisible = :isVisible', { isVisible: true })
      .getRawOne();

    const distribution = await this.reviewRepository
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.isVisible = :isVisible', { isVisible: true })
      .groupBy('review.rating')
      .orderBy('review.rating', 'DESC')
      .getRawMany();

    const reportedCount = await this.reviewRepository
      .createQueryBuilder('review')
      .where('review.reportedAt IS NOT NULL')
      .andWhere('review.isVisible = true')
      .getCount();
    const hiddenCount = await this.reviewRepository.count({ where: { isVisible: false } });

    return {
      totalReviews,
      averageRating: avgResult?.average ? parseFloat(avgResult.average) : 0,
      distribution,
      reportedCount,
      hiddenCount,
    };
  }
}
