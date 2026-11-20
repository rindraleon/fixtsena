import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Badge, UserBadge, Order, Review, Dispute, Delivery } from '../../database/entities/transaction.entity';
import { Shop } from '../../database/entities/marketplace.entity';
import { OrderStatus, UserRole } from '../../database/entities/role.enum';
import { BadgeCriteria, BadgeUserStats, DEFAULT_BADGES, meetsCriteria, validateCriteria } from './badge-criteria';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../database/entities/user.entity';
import { CreateBadgeDto, UpdateBadgeDto, AwardBadgeDto } from './dto/badge.dto';

@Injectable()
export class BadgesService implements OnModuleInit {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectRepository(Badge)
    private readonly badgeRepository: Repository<Badge>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepository: Repository<UserBadge>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async createBadge(dto: CreateBadgeDto) {
    const criteriaError = validateCriteria(dto.criteria);
    if (criteriaError) throw new BadRequestException(criteriaError);
    const badge = this.badgeRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });

    const savedBadge = await this.badgeRepository.save(badge);
    this.logger.log(`Badge créé: ${savedBadge.name} (${savedBadge.id})`);
    return savedBadge;
  }

  async updateBadge(badgeId: string, dto: UpdateBadgeDto) {
    const criteriaError = validateCriteria(dto.criteria);
    if (criteriaError) throw new BadRequestException(criteriaError);
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId } });
    if (!badge) {
      throw new NotFoundException('Badge non trouvé');
    }

    Object.assign(badge, dto);
    await this.badgeRepository.save(badge);

    this.logger.log(`Badge mis à jour: ${badgeId}`);
    return badge;
  }

  async removeBadge(badgeId: string) {
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId } });
    if (!badge) {
      throw new NotFoundException('Badge non trouvé');
    }

    await this.userBadgeRepository.update({ badgeId }, { isActive: false });

    await this.badgeRepository.remove(badge);
    this.logger.log(`Badge supprimé: ${badgeId}`);
    return { success: true };
  }

  async awardBadge(userId: string, badgeId: string, dto?: AwardBadgeDto, options: { source?: 'auto' | 'manual'; awardedBy?: string | null } = {}) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const badge = await this.badgeRepository.findOne({ where: { id: badgeId } });
    if (!badge) {
      throw new NotFoundException('Badge non trouvé');
    }

    const existing = await this.userBadgeRepository.findOne({
      where: { userId, badgeId },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Ce badge est déjà attribué à cet utilisateur');
      }
      existing.isActive = true;
      existing.awardedAt = new Date();
      existing.source = options.source ?? 'manual';
      existing.awardedBy = options.awardedBy ?? null;
      await this.userBadgeRepository.save(existing);
      await this.notifyAward(userId, badge);
      this.logger.log(`Badge réattribué: ${badgeId} → ${userId}`);
      return existing;
    }

    const userBadge = this.userBadgeRepository.create({
      userId,
      badgeId,
      awardedAt: new Date(),
      isActive: dto?.isActive ?? true,
      source: options.source ?? 'manual',
      awardedBy: options.awardedBy ?? null,
    });

    const saved = await this.userBadgeRepository.save(userBadge);
    this.logger.log(`Badge attribué: ${badge.name} → ${user.email}`);
    if (saved.isActive) await this.notifyAward(userId, badge);
    return saved;
  }

  private async notifyAward(userId: string, badge: Badge): Promise<void> {
    await this.notifications
      ?.notify({
        userId,
        type: 'shop.level',
        title: `Nouveau badge : ${badge.name}`,
        body: badge.description || 'Félicitations, un nouveau badge est affiché sur votre profil.',
        link: '/dashboard/vendeur/profil',
        email: { status: 'Badge obtenu', nextAction: 'Voir mon profil', actionLabel: 'Mon profil' },
      })
      .catch(() => undefined);
  }

  async onModuleInit(): Promise<void> {
    try {
      const created = await this.ensureDefaults();
      if (created > 0) this.logger.log(`${created} badge(s) par défaut créé(s)`);
    } catch (error) {
      this.logger.warn(`Badges par défaut non initialisés : ${(error as Error).message}`);
    }
  }

  async ensureDefaults(): Promise<number> {
    let created = 0;
    for (const def of DEFAULT_BADGES) {
      const exists = await this.badgeRepository.findOne({ where: { name: def.name } });
      if (exists) continue;
      await this.badgeRepository.save(
        this.badgeRepository.create({ name: def.name, description: def.description, iconUrl: def.iconUrl ?? undefined, criteria: def.criteria, isActive: true }),
      );
      created += 1;
    }
    return created;
  }

  async collectStats(userId: string): Promise<BadgeUserStats | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;
    const roles = (user.roles ?? []) as UserRole[];
    const orders = this.dataSource.getRepository(Order);
    const reviews = this.dataSource.getRepository(Review);
    const disputes = this.dataSource.getRepository(Dispute);

    const [totalSales, completedSales, cancelledSales, completedPurchases, reviewsGiven, disputesOpened] = await Promise.all([
      orders.count({ where: { sellerId: userId } }),
      orders.count({ where: { sellerId: userId, status: OrderStatus.DELIVERED } }),
      orders.count({ where: { sellerId: userId, status: OrderStatus.CANCELLED } }),
      orders.count({ where: { buyerId: userId, status: OrderStatus.DELIVERED } }),
      reviews.count({ where: { reviewerId: userId } }),
      disputes.count({ where: { reporterId: userId } }),
    ]);

    const ratingRow = await reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(r.sellerReply)', 'replied')
      .where('r.reviewedId = :userId AND r.isVisible = true', { userId })
      .getRawOne<{ avg: string | null; count: string; replied: string }>();

    const disputesOnSales =
      totalSales > 0
        ? await disputes.createQueryBuilder('d').innerJoin(Order, 'o', 'o.id = d.orderId').where('o.sellerId = :userId', { userId }).getCount()
        : 0;

    let onTimeDeliveryRate: number | null = null;
    if (completedSales > 0) {
      const onTimeDays = Math.max(1, Math.floor(Number(this.settings?.get('levels.onTimeDeliveryDays') ?? 5) || 5));
      const row = await this.dataSource
        .getRepository(Delivery)
        .createQueryBuilder('dl')
        .innerJoin(Order, 'o', 'o.id = dl.orderId')
        .select('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN dl."shippedAt" IS NOT NULL AND dl."deliveredAt" - dl."shippedAt" <= INTERVAL '${onTimeDays} days' THEN 1 ELSE 0 END)`,
          'onTime',
        )
        .where('o.sellerId = :userId AND dl."deliveredAt" IS NOT NULL', { userId })
        .getRawOne<{ total: string; onTime: string | null }>();
      const total = Number(row?.total ?? 0);
      onTimeDeliveryRate = total > 0 ? Math.round((Number(row?.onTime ?? 0) / total) * 100) : null;
    }

    const shop = roles.includes(UserRole.SELLER)
      ? await this.dataSource.getRepository(Shop).findOne({ where: { ownerId: userId }, select: ['id', 'identityVerified'] })
      : null;

    return {
      isSeller: roles.includes(UserRole.SELLER),
      isBuyer: roles.some((r) => r === UserRole.BUYER || r === UserRole.CLIENT) || completedPurchases > 0,
      accountAgeDays: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000),
      completedSales,
      totalSales,
      cancelledSales,
      disputesOnSales,
      averageRating: ratingRow?.avg !== null && ratingRow?.avg !== undefined ? Math.round(Number(ratingRow.avg) * 100) / 100 : null,
      reviewsReceived: Number(ratingRow?.count ?? 0),
      repliedReviews: Number(ratingRow?.replied ?? 0),
      onTimeDeliveryRate,
      identityVerified: !!shop?.identityVerified,
      completedPurchases,
      reviewsGiven,
      disputesOpened,
    };
  }

  async evaluateUser(userId: string): Promise<{ awarded: string[]; revoked: string[] }> {
    const result = { awarded: [] as string[], revoked: [] as string[] };
    if (this.settings && (this.settings.get('badges.autoAward') as unknown) === false) return result;
    const stats = await this.collectStats(userId);
    if (!stats) return result;
    const badges = await this.badgeRepository.find({ where: { isActive: true } });
    const existing = await this.userBadgeRepository.find({ where: { userId } });
    const byBadge = new Map(existing.map((ub) => [ub.badgeId, ub]));

    for (const badge of badges) {
      const criteria = (badge.criteria ?? {}) as BadgeCriteria;
      if (criteria.mode === 'manual') continue;
      const has = byBadge.get(badge.id);
      const ok = meetsCriteria(criteria, stats);
      if (ok && !(has && has.isActive)) {
        await this.awardBadge(userId, badge.id, undefined, { source: 'auto', awardedBy: null }).catch(() => undefined);
        result.awarded.push(badge.name);
      } else if (!ok && has?.isActive && has.source === 'auto' && criteria.autoRevoke) {
        has.isActive = false;
        await this.userBadgeRepository.save(has);
        result.revoked.push(badge.name);
      }
    }
    if (result.awarded.length || result.revoked.length) {
      this.logger.log(`Badges ${userId} : +${result.awarded.join(', ') || '∅'} / −${result.revoked.join(', ') || '∅'}`);
    }
    return result;
  }

  async evaluateAll(limit = 500): Promise<number> {
    const users = await this.userRepository.find({ select: ['id'], take: limit, order: { updatedAt: 'DESC' } });
    let touched = 0;
    for (const u of users) {
      const r = await this.evaluateUser(u.id).catch(() => null);
      if (r && (r.awarded.length || r.revoked.length)) touched += 1;
    }
    return touched;
  }

  async removeBadgeFromUser(userId: string, badgeId: string) {
    const userBadge = await this.userBadgeRepository.findOne({
      where: { userId, badgeId },
    });

    if (!userBadge) {
      throw new NotFoundException('Ce badge n\'est pas attribué à cet utilisateur');
    }

    userBadge.isActive = false;
    await this.userBadgeRepository.save(userBadge);

    this.logger.log(`Badge retiré: ${badgeId} de ${userId}`);
    return { success: true };
  }

  async getUserBadges(userId: string) {
    const userBadges = await this.userBadgeRepository.find({
      where: { userId, isActive: true },
      order: { awardedAt: 'DESC' },
    });

    if (userBadges.length === 0) return [];

    const badgeIds = [...new Set(userBadges.map((ub) => ub.badgeId))];
    const badges = await this.badgeRepository.find({ where: { id: In(badgeIds) } });
    const badgeById = new Map(badges.map((badge) => [badge.id, badge]));

    return userBadges.map((ub) => ({ ...ub, badge: badgeById.get(ub.badgeId) ?? null }));
  }

  async findAll(includeInactive: boolean = false) {
    const where = includeInactive ? {} : { isActive: true };
    return await this.badgeRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(badgeId: string) {
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId } });
    if (!badge) {
      throw new NotFoundException('Badge non trouvé');
    }
    return badge;
  }

  async getStats() {
    const totalBadges = await this.badgeRepository.count();
    const activeBadges = await this.badgeRepository.count({ where: { isActive: true } });
    const totalAwards = await this.userBadgeRepository.count({ where: { isActive: true } });

    const topBadge = await this.userBadgeRepository
      .createQueryBuilder('ub')
      .select('ub.badgeId', 'badgeId')
      .addSelect('COUNT(*)', 'count')
      .where('ub.isActive = true')
      .groupBy('ub.badgeId')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      totalBadges,
      activeBadges,
      totalAwards,
      topBadgeId: topBadge?.badgeId || null,
      topBadgeCount: topBadge?.count ? parseInt(topBadge.count, 10) : 0,
    };
  }
}
