import {
  Injectable,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductsService } from '../products/products.service';
import { Repository, In } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Product, Category } from '../../database/entities/catalog.entity';
import {
  Order,
  Payment,
  Escrow,
  Dispute,
  AuditLog,
  Review,
  OrderLine,
} from '../../database/entities/transaction.entity';
import { FilterAuditLogDto } from './dto/admin.dto';
import {
  AccountStatus,
  UserRole,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  DisputeStatus,
} from '../../database/entities/role.enum';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly productsService?: ProductsService,
  ) {}

  async getDashboardStats() {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { status: AccountStatus.ACTIVE },
    });
    const sellers = await this.userRepository
      .createQueryBuilder('user')
      .where("(',' || user.roles || ',') LIKE :role", { role: `%,${UserRole.SELLER},%` })
      .getCount();

    const totalProducts = await this.productRepository.count();
    const activeProducts = await this.productRepository.count({
      where: { status: ProductStatus.ACTIVE },
    });

    const totalOrders = await this.orderRepository.count();
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });
    const deliveredOrders = await this.orderRepository.count({
      where: { status: OrderStatus.DELIVERED },
    });

    const revenueResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne();

    const totalPayments = await this.paymentRepository.count();
    const successPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.SUCCESS },
    });

    const heldAmount = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.releasedAt IS NULL')
      .andWhere('escrow.isBlocked = false')
      .getRawOne();

    const openDisputes = await this.disputeRepository.count({
      where: {
        status: In([
          DisputeStatus.REPORTED,
          DisputeStatus.OPEN,
          DisputeStatus.AWAITING_EVIDENCE,
          DisputeStatus.UNDER_REVIEW,
        ]),
      },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();

    const recentRevenue = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.DELIVERED, OrderStatus.SHIPPED],
      })
      .getRawOne();

    const manager = this.orderRepository.manager;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyActiveUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('user.lastLoginAt >= :since', { since: thirtyDaysAgo })
      .getCount()
      .catch(() => activeUsers);
    const activeSellersRow = await this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(DISTINCT order.sellerId)', 'count')
      .where('order.createdAt >= :since', { since: thirtyDaysAgo })
      .andWhere('order.status NOT IN (:...excluded)', { excluded: [OrderStatus.CANCELLED] })
      .getRawOne<{ count: string }>();

    const settledPayments = await this.paymentRepository.count({
      where: { status: In([PaymentStatus.SUCCESS, PaymentStatus.ESCROW, PaymentStatus.RELEASED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.BLOCKED]) },
    });
    const failedPayments = await this.paymentRepository.count({ where: { status: In([PaymentStatus.FAILED, PaymentStatus.CANCELLED]) } });
    const paymentAttempts = settledPayments + failedPayments;

    const deliveriesInProgress = await this.orderRepository.count({ where: { status: In([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED]) } });
    const closedOrders = await this.orderRepository.count({ where: { status: In([OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED]) } });

    const disputeDelayRow = await this.disputeRepository
      .createQueryBuilder('d')
      .select('AVG(EXTRACT(EPOCH FROM (d."resolvedAt" - d."createdAt")))', 'seconds')
      .addSelect('COUNT(*)', 'count')
      .where('d."resolvedAt" IS NOT NULL')
      .getRawOne<{ seconds: string | null; count: string }>();
    const refundedOrders = await this.orderRepository.count({ where: { status: OrderStatus.REFUNDED } });
    const refundedAmountRow = await this.escrowRepository
      .createQueryBuilder('escrow')
      .innerJoin(Order, 'o', 'o.id = escrow.orderId')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.releasedTo = o.buyerId')
      .getRawOne<{ total: string | null }>()
      .catch(() => ({ total: null }));

    const ratingRow = await manager
      .getRepository(Review)
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.isVisible = true')
      .getRawOne<{ avg: string | null; count: string }>()
      .catch(() => ({ avg: null, count: '0' }));

    const commissionRow = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.commissionAmount)', 'total')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne<{ total: string | null }>();

    const topSellersRaw = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('SUM(order.totalAmount)', 'amount')
      .where('order.createdAt >= :since', { since: thirtyDaysAgo })
      .andWhere('order.status NOT IN (:...excluded)', { excluded: [OrderStatus.CANCELLED] })
      .groupBy('order.sellerId')
      .orderBy('amount', 'DESC')
      .limit(5)
      .getRawMany<{ sellerId: string; orders: string; amount: string }>();
    const sellerIds = topSellersRaw.map((r) => r.sellerId);
    const sellerUsers = sellerIds.length ? await this.userRepository.find({ where: { id: In(sellerIds) }, select: ['id', 'firstName', 'lastName', 'email'] }) : [];
    const sellerById = new Map(sellerUsers.map((u) => [u.id, u]));
    const topSellers = topSellersRaw.map((r) => {
      const u = sellerById.get(r.sellerId);
      return { sellerId: r.sellerId, name: u ? `${u.firstName} ${u.lastName ?? ''}`.trim() : 'Vendeur', email: u?.email ?? null, orders: Number(r.orders), amount: Number(r.amount ?? 0) };
    });

    const topProductsRaw = await manager
      .getRepository(OrderLine)
      .createQueryBuilder('line')
      .innerJoin(Order, 'o', 'o.id = line.orderId')
      .select('line.productId', 'productId')
      .addSelect('SUM(line.quantity)', 'quantity')
      .addSelect('SUM(line.totalPrice)', 'amount')
      .where('o.createdAt >= :since', { since: thirtyDaysAgo })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: [OrderStatus.CANCELLED] })
      .groupBy('line.productId')
      .orderBy('quantity', 'DESC')
      .limit(5)
      .getRawMany<{ productId: string; quantity: string; amount: string }>();
    const productIds = topProductsRaw.map((r) => r.productId);
    const products = productIds.length ? await this.productRepository.find({ where: { id: In(productIds) }, select: ['id', 'name', 'categoryId'], withDeleted: true }) : [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const topProducts = topProductsRaw.map((r) => ({ productId: r.productId, name: productById.get(r.productId)?.name ?? 'Produit', quantity: Number(r.quantity), amount: Number(r.amount ?? 0) }));

    const topCategoriesRaw = await manager
      .getRepository(OrderLine)
      .createQueryBuilder('line')
      .innerJoin(Order, 'o', 'o.id = line.orderId')
      .innerJoin(Product, 'p', 'p.id = line.productId')
      .select('p.categoryId', 'categoryId')
      .addSelect('SUM(line.quantity)', 'quantity')
      .addSelect('SUM(line.totalPrice)', 'amount')
      .where('o.createdAt >= :since', { since: thirtyDaysAgo })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: [OrderStatus.CANCELLED] })
      .andWhere('p.categoryId IS NOT NULL')
      .groupBy('p.categoryId')
      .orderBy('amount', 'DESC')
      .limit(5)
      .getRawMany<{ categoryId: string; quantity: string; amount: string }>();
    const categoryIds = topCategoriesRaw.map((r) => r.categoryId);
    const categories = categoryIds.length ? await manager.getRepository(Category).find({ where: { id: In(categoryIds) }, select: ['id', 'name'] }) : [];
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const topCategories = topCategoriesRaw.map((r) => ({ categoryId: r.categoryId, name: categoryById.get(r.categoryId)?.name ?? 'Catégorie', quantity: Number(r.quantity), amount: Number(r.amount ?? 0) }));

    const avgDisputeSeconds = disputeDelayRow?.seconds ? Number(disputeDelayRow.seconds) : null;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        activeLast30Days: recentlyActiveUsers,
        sellers,
        activeSellersLast30Days: Number(activeSellersRow?.count ?? 0),
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        last7Days: recentOrders,
        inProgress: deliveriesInProgress,
        deliverySuccessRate: closedOrders > 0 ? Math.round((deliveredOrders / closedOrders) * 1000) / 10 : null,
      },
      revenue: {
        total: revenueResult?.total ? parseFloat(revenueResult.total) : 0,
        last7Days: recentRevenue?.total ? parseFloat(recentRevenue.total) : 0,
        commission: commissionRow?.total ? parseFloat(commissionRow.total) : 0,
      },
      payments: {
        total: totalPayments,
        successful: successPayments,
        successRate: paymentAttempts > 0 ? Math.round((settledPayments / paymentAttempts) * 1000) / 10 : null,
      },
      escrow: {
        heldAmount: heldAmount?.total ? parseFloat(heldAmount.total) : 0,
      },
      disputes: {
        open: openDisputes,
        resolved: Number(disputeDelayRow?.count ?? 0),
        averageResolutionHours: avgDisputeSeconds !== null ? Math.round((avgDisputeSeconds / 3600) * 10) / 10 : null,
      },
      refunds: {
        count: refundedOrders,
        amount: refundedAmountRow?.total ? parseFloat(refundedAmountRow.total) : 0,
      },
      satisfaction: {
        averageRating: ratingRow?.avg ? Math.round(Number(ratingRow.avg) * 100) / 100 : null,
        reviews: Number(ratingRow?.count ?? 0),
      },
      top: {
        sellers: topSellers,
        products: topProducts,
        categories: topCategories,
      },
    };
  }

  async suspendUser(userId: string, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const previousStatus = user.status;
    user.status = AccountStatus.SUSPENDED;
    user.refreshTokenHash = undefined;
    await this.userRepository.save(user);

    await this.createAuditLog(adminId, 'suspend_user', 'user', userId, { previousStatus });

    this.logger.log(`Utilisateur ${userId} suspendu par admin ${adminId}`);
    await this.notifications?.notify({
      userId,
      type: 'account.security',
      title: 'Votre compte a été suspendu',
      body: 'Votre compte Tsena est temporairement suspendu. Contactez le support pour en connaître les raisons et les démarches de réactivation.',
      email: { status: 'Compte suspendu', nextAction: 'Contacter le support', actionLabel: 'Nous contacter' },
      link: '/contact',
    });
    return user;
  }

  async activateUser(userId: string, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    user.status = AccountStatus.ACTIVE;
    await this.userRepository.save(user);

    await this.createAuditLog(adminId, 'activate_user', 'user', userId, {});

    this.logger.log(`Utilisateur ${userId} activé par admin ${adminId}`);
    await this.notifications?.notify({
      userId,
      type: 'account.security',
      title: 'Votre compte est de nouveau actif',
      body: 'Vous pouvez à nouveau utiliser l\'ensemble des services Tsena.',
      email: { status: 'Compte actif', nextAction: 'Se connecter', actionLabel: 'Accéder à Tsena' },
      link: '/connexion',
    });
    return user;
  }

  async approveSeller(userId: string, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.roles.includes(UserRole.SELLER)) {
      user.roles = [...new Set([...user.roles, UserRole.SELLER])];
      await this.userRepository.save(user);
    }

    user.status = AccountStatus.ACTIVE;
    await this.userRepository.save(user);

    await this.createAuditLog(adminId, 'approve_seller', 'user', userId, { roles: user.roles });

    this.logger.log(`Vendeur ${userId} approuvé par admin ${adminId}`);
    await this.notifications?.notify({
      userId,
      type: 'shop.status',
      title: 'Votre compte vendeur est approuvé',
      body: 'Bienvenue parmi les vendeurs Tsena ! Créez votre boutique et publiez vos premiers produits.',
      link: '/dashboard/vendeur/boutique',
      email: { status: 'Vendeur approuvé', nextAction: 'Créer votre boutique', actionLabel: 'Ouvrir mon espace vendeur' },
    });
    return user;
  }

  async getAuditLogs(filters: FilterAuditLogDto) {
    const { userId, action, entity, entityId, startDate, endDate, page = 1, limit = 50 } = filters;

    const qb = this.auditLogRepository.createQueryBuilder('audit');

    if (userId) {
      qb.andWhere('audit.userId = :userId', { userId });
    }
    if (action) {
      qb.andWhere('audit.action = :action', { action });
    }
    if (entity) {
      qb.andWhere('audit.entity = :entity', { entity });
    }
    if (entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId });
    }
    if (startDate) {
      qb.andWhere('audit.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    qb.orderBy('audit.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

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

  async createAuditLog(
    userId: string,
    action: string,
    entity: string,
    entityId: string | null,
    changes: object,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const log = this.auditLogRepository.create({
      userId,
      action,
      entity,
      entityId: entityId ?? undefined,
      changes,
      ipAddress,
      userAgent,
    });

    return await this.auditLogRepository.save(log);
  }

  async approveProduct(productId: string, adminId: string) {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    product.status = 'active' as any;
    product.publishedAt = new Date();
    await this.productRepository.save(product);

    await this.createAuditLog(adminId, 'approve_product', 'product', productId, {
      status: 'active',
    });

    this.logger.log(`Produit ${productId} approuvé par admin ${adminId}`);

    await this.notifications?.notify({
      userId: product.sellerId,
      type: 'shop.status',
      title: `Produit « ${product.name} » publié`,
      body: 'Votre produit a été validé par l\'équipe Tsena : il est désormais visible par les acheteurs.',
      link: '/dashboard/vendeur/produits',
      email: { status: 'Publié', nextAction: 'Aucune action requise', actionLabel: 'Voir mes produits' },
    });
    await this.productsService?.notifyFollowersOfNewProduct(product);
    return product;
  }

  async suspendProduct(productId: string, reason: string, adminId: string) {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }
    const previousStatus = product.status;
    product.status = ProductStatus.SUSPENDED;
    await this.productRepository.save(product);
    await this.createAuditLog(adminId, 'suspend_product', 'product', productId, { previousStatus, status: 'suspended', reason });
    await this.notifications?.notify({
      userId: product.sellerId,
      type: 'shop.status',
      title: `Produit suspendu : ${product.name}`,
      body: `Votre annonce a été suspendue par l’administration. Motif : ${reason}. Contactez le support pour la remettre en ligne.`,
      link: '/dashboard/vendeur/produits',
      email: { status: 'Suspendu', nextAction: 'Contacter le support', actionLabel: 'Voir mes produits' },
    });
    return product;
  }

  async rejectProduct(productId: string, reason: string, adminId: string) {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    product.status = 'rejected' as any;
    await this.productRepository.save(product);

    await this.createAuditLog(adminId, 'reject_product', 'product', productId, {
      status: 'rejected',
      reason,
    });

    this.logger.log(`Produit ${productId} rejeté par admin ${adminId}`);

    await this.notifications?.notify({
      userId: product.sellerId,
      type: 'shop.status',
      title: `Produit « ${product.name} » refusé`,
      body: `Motif : ${reason}. Vous pouvez corriger la fiche puis la soumettre à nouveau.`,
      link: '/dashboard/vendeur/produits',
      email: { status: 'Refusé', nextAction: 'Corriger la fiche produit', actionLabel: 'Voir mes produits' },
    });
    return product;
  }
}
