import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Shop, ShopFollow, SellerSubscription } from '../../database/entities/marketplace.entity';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Order, Dispute, AuditLog } from '../../database/entities/transaction.entity';
import { OrderStatus, ProductStatus, ShopLevel, ShopStatus, SubscriptionStatus, UserRole, AccountStatus } from '../../database/entities/role.enum';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LevelThreshold } from '../settings/settings.defaults';
import { AdminIdentityDto, AdminShopLevelDto, AdminShopStatusDto, CreateShopDto, FilterShopsDto, UpdateShopDto } from './dto/shop.dto';
import { SHOP_ARCHIVED_MESSAGE, SHOP_REQUIRED_MESSAGE, isShopOperable } from './shop-access';

const ADMIN_STATUS_TRANSITIONS: Record<ShopStatus, ShopStatus[]> = {
  [ShopStatus.DRAFT]: [ShopStatus.ACTIVE, ShopStatus.ARCHIVED],
  [ShopStatus.PENDING_VERIFICATION]: [ShopStatus.ACTIVE, ShopStatus.DRAFT, ShopStatus.ARCHIVED],
  [ShopStatus.ACTIVE]: [ShopStatus.SUSPENDED, ShopStatus.DISABLED, ShopStatus.ARCHIVED],
  [ShopStatus.SUSPENDED]: [ShopStatus.ACTIVE, ShopStatus.DISABLED, ShopStatus.ARCHIVED],
  [ShopStatus.DISABLED]: [ShopStatus.ACTIVE, ShopStatus.ARCHIVED],
  [ShopStatus.ARCHIVED]: [],
};

export interface SellerPerformance {
  monthsActive: number;
  completedOrders: number;
  cancelledOrders: number;
  disputes: number;
  incidentRate: number;
  onTimeRate: number | null;
  rating: number;
  reviewCount: number;
}

export interface LevelEligibility {
  level: 'verified' | 'gold' | 'premium';
  eligible: boolean;
  threshold: LevelThreshold;
  checks: Array<{ key: string; label: string; required: string; current: string; met: boolean }>;
}

type ShopView = Omit<Shop, 'owner'> & {
  levelLabel: string;
  statusLabel: string;
  productsCount: number;
  averageRating: number;
  reviewsCount: number;
  isFollowing?: boolean;
  owner?: Partial<User>;
};

import { SHOP_LEVEL_LABELS, SHOP_STATUS_LABELS } from './shop-labels';
export { SHOP_LEVEL_LABELS, SHOP_STATUS_LABELS };

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    @InjectRepository(ShopFollow) private readonly followRepository: Repository<ShopFollow>,
    @InjectRepository(SellerSubscription) private readonly subscriptionRepository: Repository<SellerSubscription>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Dispute) private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async findPublic(filter: FilterShopsDto, viewer?: { id: string; roles: UserRole[] }) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filter.limit) || 12));
    const isAdmin = viewer?.roles?.includes(UserRole.ADMIN) ?? false;

    const qb = this.shopRepository.createQueryBuilder('shop');
    if (isAdmin && filter.status) qb.andWhere('shop.status = :status', { status: filter.status });
    else if (!isAdmin) qb.andWhere('shop.status = :status', { status: ShopStatus.ACTIVE });
    if (filter.level) qb.andWhere('shop.level = :level', { level: filter.level });
    if (filter.search) qb.andWhere('(shop.name ILIKE :search OR shop.description ILIKE :search OR shop.location ILIKE :search OR shop.city ILIKE :search)', { search: `%${filter.search}%` });
    if (filter.categoryId) qb.andWhere("(',' || shop.mainCategoryIds || ',') LIKE :cat", { cat: `%,${filter.categoryId},%` });

    switch (filter.sortBy) {
      case 'followers': qb.orderBy('shop.followersCount', 'DESC'); break;
      case 'name': qb.orderBy('shop.name', 'ASC'); break;
      case 'rating':
      case 'recent':
      default: qb.orderBy('shop.createdAt', 'DESC');
    }
    qb.skip((page - 1) * limit).take(limit);
    const [shops, total] = await qb.getManyAndCount();
    const items = await this.decorate(shops, viewer?.id);
    if (filter.sortBy === 'rating') items.sort((a, b) => b.averageRating - a.averageRating || b.reviewsCount - a.reviewsCount);
    return { items, total, page, limit };
  }

  async findByIdOrSlug(idOrSlug: string, viewer?: { id: string; roles: UserRole[] }): Promise<ShopView> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const shop = await this.shopRepository.findOne({ where: isUuid ? { id: idOrSlug } : { slug: idOrSlug } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    const isOwner = viewer?.id === shop.ownerId;
    const isAdmin = viewer?.roles?.includes(UserRole.ADMIN) ?? false;
    if (shop.status !== ShopStatus.ACTIVE && !isOwner && !isAdmin) {
      throw new NotFoundException('Boutique non trouvée');
    }
    await this.refreshLevel(shop);
    const [view] = await this.decorate([shop], viewer?.id, true);
    return view;
  }

  async findMine(ownerId: string): Promise<ShopView | null> {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    if (!shop) return null;
    await this.refreshLevel(shop);
    const [view] = await this.decorate([shop], ownerId, true);
    return view;
  }

  async findBySellerId(sellerId: string): Promise<Shop | null> {
    return this.shopRepository.findOne({ where: { ownerId: sellerId } });
  }

  async hasShop(ownerId: string): Promise<boolean> {
    const shop = await this.shopRepository.findOne({ where: { ownerId }, select: ['id', 'status'] });
    return isShopOperable(shop);
  }

  async requireShop(ownerId: string, message?: string): Promise<Shop> {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    if (!shop) {
      throw new ForbiddenException(message ?? SHOP_REQUIRED_MESSAGE);
    }
    if (shop.status === ShopStatus.ARCHIVED) {
      throw new ForbiddenException(SHOP_ARCHIVED_MESSAGE);
    }
    return shop;
  }

  private async decorate(shops: Shop[], viewerId?: string, withOwner = false): Promise<ShopView[]> {
    if (shops.length === 0) return [];
    const ownerIds = shops.map((s) => s.ownerId);
    const owners = await this.userRepository.find({ where: { id: In(ownerIds) }, select: ['id', 'firstName', 'lastName', 'avatarUrl', 'reputationScore', 'reviewCount', 'createdAt', 'status'] });
    const ownerMap = new Map(owners.map((o) => [o.id, o]));
    const counts = await this.productRepository
      .createQueryBuilder('p')
      .select('p.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'count')
      .where('p.sellerId IN (:...ids)', { ids: ownerIds })
      .andWhere('p.status IN (:...statuses)', { statuses: [ProductStatus.ACTIVE, ProductStatus.PUBLISHED] })
      .andWhere('p.deletedAt IS NULL')
      .groupBy('p.sellerId')
      .getRawMany<{ sellerId: string; count: string }>();
    const countMap = new Map(counts.map((c) => [c.sellerId, Number(c.count)]));
    const followed = viewerId
      ? new Set((await this.followRepository.find({ where: { userId: viewerId, shopId: In(shops.map((s) => s.id)) } })).map((f) => f.shopId))
      : new Set<string>();

    return shops.map((shop) => {
      const owner = ownerMap.get(shop.ownerId);
      const { owner: _ignored, ...plain } = shop;
      return {
        ...plain,
        levelLabel: SHOP_LEVEL_LABELS[shop.level],
        statusLabel: SHOP_STATUS_LABELS[shop.status],
        productsCount: countMap.get(shop.ownerId) ?? 0,
        averageRating: Number(owner?.reputationScore ?? 0),
        reviewsCount: owner?.reviewCount ?? 0,
        isFollowing: viewerId ? followed.has(shop.id) : undefined,
        owner: withOwner && owner ? { id: owner.id, firstName: owner.firstName, lastName: owner.lastName, avatarUrl: owner.avatarUrl, createdAt: owner.createdAt } : undefined,
      };
    });
  }

  async create(ownerId: string, dto: CreateShopDto): Promise<ShopView> {
    const existing = await this.shopRepository.findOne({ where: { ownerId }, withDeleted: true });
    if (existing) throw new ConflictException('Vous avez déjà une boutique');
    const shop = this.shopRepository.create({
      ownerId,
      name: dto.name.trim(),
      slug: await this.uniqueSlug(dto.name),
      description: dto.description?.trim() || null,
      mainCategoryIds: dto.mainCategoryIds?.length ? dto.mainCategoryIds : null,
      location: dto.location?.trim() || null,
      city: normalizeCity(dto.city),
      deliveryConditions: dto.deliveryConditions?.trim() || null,
      featuredProductIds: dto.featuredProductIds?.length ? dto.featuredProductIds : null,
      status: ShopStatus.DRAFT,
      level: ShopLevel.NEW,
    });
    const saved = await this.shopRepository.save(shop);
    const [view] = await this.decorate([saved], ownerId, true);
    return view;
  }

  async updateMine(ownerId: string, dto: UpdateShopDto): Promise<ShopView> {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    if (!shop) throw new NotFoundException("Vous n'avez pas encore de boutique");
    if (shop.status === ShopStatus.ARCHIVED) throw new ForbiddenException('Une boutique archivée ne peut plus être modifiée');
    if (dto.name !== undefined && dto.name.trim() !== shop.name) {
      shop.name = dto.name.trim();
      shop.slug = await this.uniqueSlug(shop.name, shop.id);
    }
    if (dto.description !== undefined) shop.description = dto.description.trim() || null;
    if (dto.mainCategoryIds !== undefined) shop.mainCategoryIds = dto.mainCategoryIds.length ? dto.mainCategoryIds : null;
    if (dto.location !== undefined) shop.location = dto.location.trim() || null;
    if (dto.city !== undefined) shop.city = normalizeCity(dto.city);
    if (dto.deliveryConditions !== undefined) shop.deliveryConditions = dto.deliveryConditions.trim() || null;
    if (dto.featuredProductIds !== undefined) {
      if (dto.featuredProductIds.length > 0) {
        const owned = await this.productRepository.count({ where: { id: In(dto.featuredProductIds), sellerId: ownerId } });
        if (owned !== dto.featuredProductIds.length) throw new BadRequestException('Les produits mis en avant doivent appartenir à votre boutique');
      }
      shop.featuredProductIds = dto.featuredProductIds.length ? dto.featuredProductIds : null;
    }
    const saved = await this.shopRepository.save(shop);
    const [view] = await this.decorate([saved], ownerId, true);
    return view;
  }

  async setImage(ownerId: string, kind: 'logo' | 'cover', url: string): Promise<Shop> {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    if (!shop) throw new NotFoundException("Vous n'avez pas encore de boutique");
    if (kind === 'logo') shop.logoUrl = url;
    else shop.coverUrl = url;
    return this.shopRepository.save(shop);
  }

  async submitMine(ownerId: string): Promise<ShopView> {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    if (!shop) throw new NotFoundException("Vous n'avez pas encore de boutique");
    if (shop.status !== ShopStatus.DRAFT) throw new ConflictException(`La boutique est déjà « ${SHOP_STATUS_LABELS[shop.status]} »`);
    if (!shop.description || shop.description.length < 20) throw new BadRequestException('Ajoutez une description d\'au moins 20 caractères avant de soumettre votre boutique');
    if (!shop.logoUrl) throw new BadRequestException('Ajoutez un logo avant de soumettre votre boutique');
    shop.status = ShopStatus.PENDING_VERIFICATION;
    shop.submittedAt = new Date();
    const saved = await this.shopRepository.save(shop);
    const [view] = await this.decorate([saved], ownerId, true);
    return view;
  }

  async follow(userId: string, shopId: string): Promise<{ following: true; followersCount: number }> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    if (shop.status !== ShopStatus.ACTIVE) throw new ForbiddenException('Impossible de suivre une boutique qui n\'est pas active');
    if (shop.ownerId === userId) throw new BadRequestException('Vous ne pouvez pas suivre votre propre boutique');
    const existing = await this.followRepository.findOne({ where: { userId, shopId } });
    if (existing) return { following: true, followersCount: shop.followersCount };
    await this.followRepository.save(this.followRepository.create({ userId, shopId }));
    await this.shopRepository.increment({ id: shopId }, 'followersCount', 1);
    return { following: true, followersCount: shop.followersCount + 1 };
  }

  async unfollow(userId: string, shopId: string): Promise<{ following: false; followersCount: number }> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    const existing = await this.followRepository.findOne({ where: { userId, shopId } });
    if (!existing) return { following: false, followersCount: shop.followersCount };
    await this.followRepository.remove(existing);
    const next = Math.max(0, shop.followersCount - 1);
    await this.shopRepository.update({ id: shopId }, { followersCount: next });
    return { following: false, followersCount: next };
  }

  async followedShops(userId: string, page = 1, limit = 20) {
    const [follows, total] = await this.followRepository.findAndCount({ where: { userId }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    if (follows.length === 0) return { items: [], total, page, limit };
    const shops = await this.shopRepository.find({ where: { id: In(follows.map((f) => f.shopId)) } });
    const views = await this.decorate(shops, userId);
    const order = new Map(follows.map((f, i) => [f.shopId, i]));
    views.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { items: views.map((v) => ({ ...v, followedAt: follows.find((f) => f.shopId === v.id)?.createdAt })), total, page, limit };
  }

  async followerIds(shopId: string): Promise<string[]> {
    const follows = await this.followRepository.find({ where: { shopId }, select: ['userId'] });
    return follows.map((f) => f.userId);
  }

  async performance(sellerId: string, shop?: Shop | null): Promise<SellerPerformance> {
    const owner = await this.userRepository.findOne({ where: { id: sellerId }, select: ['id', 'reputationScore', 'reviewCount', 'createdAt'] });
    const since = shop?.createdAt ?? owner?.createdAt ?? new Date();
    const monthsActive = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.sellerId = :sellerId', { sellerId })
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; count: string }>();
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count)]));
    const completedOrders = byStatus.get(OrderStatus.DELIVERED) ?? 0;
    const cancelledOrders = byStatus.get(OrderStatus.CANCELLED) ?? 0;
    const refunded = byStatus.get(OrderStatus.REFUNDED) ?? 0;
    const totalOrders = [...byStatus.values()].reduce((a, b) => a + b, 0);
    const disputes = await this.disputeRepository
      .createQueryBuilder('d')
      .innerJoin(Order, 'o', 'o.id = d.orderId')
      .where('o.sellerId = :sellerId', { sellerId })
      .getCount();
    const incidentRate = totalOrders > 0 ? Math.round(((cancelledOrders + refunded + disputes) / totalOrders) * 1000) / 10 : 0;

    const onTimeDays = Number(this.settings.get('levels.onTimeDeliveryDays')) || 5;
    const delivered = await this.orderRepository.find({ where: { sellerId, status: OrderStatus.DELIVERED }, select: ['id', 'createdAt', 'updatedAt'] });
    const onTimeRate = delivered.length > 0
      ? Math.round((delivered.filter((o) => (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000 <= onTimeDays).length / delivered.length) * 1000) / 10
      : null;

    return {
      monthsActive,
      completedOrders,
      cancelledOrders,
      disputes,
      incidentRate,
      onTimeRate,
      rating: Number(owner?.reputationScore ?? 0),
      reviewCount: owner?.reviewCount ?? 0,
    };
  }

  eligibility(perf: SellerPerformance, shop: Shop | null): LevelEligibility[] {
    const thresholds = this.settings.get('levels.thresholds');
    const levels: Array<'verified' | 'gold' | 'premium'> = ['verified', 'gold', 'premium'];
    return levels.map((level) => {
      const t = thresholds[level];
      const checks = [
        { key: 'shop', label: 'Boutique créée', required: 'Oui', current: shop ? 'Oui' : 'Non', met: !!shop },
        { key: 'months', label: 'Ancienneté', required: `≥ ${t.minMonths} mois`, current: `${perf.monthsActive} mois`, met: perf.monthsActive >= t.minMonths },
        { key: 'orders', label: 'Commandes terminées', required: t.maxOrders ? `${t.minOrders} à ${t.maxOrders}` : `≥ ${t.minOrders}`, current: String(perf.completedOrders), met: perf.completedOrders >= t.minOrders },
        { key: 'rating', label: 'Note moyenne', required: `≥ ${t.minRating}/5`, current: `${perf.rating.toFixed(1)}/5`, met: perf.rating >= t.minRating },
        { key: 'incidents', label: 'Annulations + litiges', required: `< ${t.maxIncidentRate} %`, current: `${perf.incidentRate} %`, met: perf.incidentRate < t.maxIncidentRate },
      ];
      if (t.minOnTimeRate !== null) {
        checks.push({ key: 'onTime', label: 'Livraisons dans les délais', required: `> ${t.minOnTimeRate} %`, current: perf.onTimeRate === null ? '—' : `${perf.onTimeRate} %`, met: (perf.onTimeRate ?? 0) > t.minOnTimeRate });
      }
      if (t.identityRequired) {
        checks.push({ key: 'identity', label: 'Identité vérifiée', required: 'Oui', current: shop?.identityVerified ? 'Oui' : 'Non', met: !!shop?.identityVerified });
      }
      return { level, eligible: checks.every((c) => c.met), threshold: t, checks };
    });
  }

  async refreshLevel(shop: Shop): Promise<ShopLevel> {
    const now = new Date();
    const actives = await this.subscriptionRepository.find({ where: { shopId: shop.id, status: SubscriptionStatus.ACTIVE } });
    let activePlan: 'gold' | 'premium' | null = null;
    for (const sub of actives) {
      if (sub.endsAt && new Date(sub.endsAt) <= now) {
        sub.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepository.save(sub);
        await this.notifications.notify({
          userId: shop.ownerId,
          type: 'subscription.expired',
          title: `Votre abonnement ${sub.plan === 'premium' ? 'Premium' : 'Gold'} a expiré`,
          body: 'Les avantages liés à votre niveau ne sont plus actifs. Renouvelez votre abonnement pour les retrouver ; vos commandes en cours ne sont pas affectées.',
          link: '/dashboard/vendeur/abonnement',
          email: { status: 'Expiré', nextAction: 'Renouveler mon abonnement', actionLabel: 'Renouveler' },
        });
        continue;
      }
      if (sub.plan === 'premium') activePlan = 'premium';
      else if (!activePlan) activePlan = 'gold';
      const alertDays = Number(this.settings.get('subscriptions.expiryAlertDays')) || 7;
      if (sub.endsAt && !sub.expiryAlertSent && (new Date(sub.endsAt).getTime() - now.getTime()) / 86400000 <= alertDays) {
        sub.expiryAlertSent = true;
        await this.subscriptionRepository.save(sub);
        await this.notifications.notify({
          userId: shop.ownerId,
          type: 'subscription.expiring',
          title: `Votre abonnement ${sub.plan === 'premium' ? 'Premium' : 'Gold'} expire bientôt`,
          body: `Il expire le ${new Date(sub.endsAt).toLocaleDateString('fr-FR')}. Renouvelez-le pour conserver vos avantages.`,
          link: '/dashboard/vendeur/abonnement',
          email: { status: 'Expire bientôt', nextAction: 'Renouveler mon abonnement', actionLabel: 'Renouveler' },
        });
      }
    }
    const stillActive = actives.filter((sub) => sub.status === SubscriptionStatus.ACTIVE);
    const scheduled = await this.subscriptionRepository.find({ where: { shopId: shop.id, status: SubscriptionStatus.SCHEDULED }, order: { startsAt: 'ASC' } });
    for (const sub of scheduled) {
      const due = !sub.startsAt || new Date(sub.startsAt).getTime() <= now.getTime();
      if (!due && stillActive.length > 0) continue;
      if (sub.endsAt && new Date(sub.endsAt).getTime() <= now.getTime()) {
        sub.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepository.save(sub);
        continue;
      }
      sub.status = SubscriptionStatus.ACTIVE;
      if (!sub.startsAt || new Date(sub.startsAt).getTime() > now.getTime()) sub.startsAt = now;
      await this.subscriptionRepository.save(sub);
      stillActive.push(sub);
      if (sub.plan === 'premium') activePlan = 'premium';
      else if (!activePlan) activePlan = 'gold';
      await this.notifications.notify({
        userId: shop.ownerId,
        type: 'subscription.activated',
        title: `Abonnement ${sub.plan === 'premium' ? 'Premium' : 'Gold'} activé`,
        body: `Votre abonnement programmé est désormais actif jusqu'au ${sub.endsAt ? new Date(sub.endsAt).toLocaleDateString('fr-FR') : '—'}.`,
        link: '/dashboard/vendeur/abonnement',
        email: { status: 'Actif', nextAction: 'Profitez de vos avantages', actionLabel: 'Voir mon abonnement' },
      });
      break;
    }

    let level: ShopLevel;
    if (shop.founderGrantedAt) level = ShopLevel.FOUNDER;
    else if (activePlan === 'premium') level = ShopLevel.PREMIUM;
    else if (activePlan === 'gold') level = ShopLevel.GOLD;
    else {
      const perf = await this.performance(shop.ownerId, shop);
      const verified = this.eligibility(perf, shop).find((e) => e.level === 'verified');
      level = verified?.eligible ? ShopLevel.VERIFIED : ShopLevel.NEW;
    }
    if (level !== shop.level) {
      const previous = shop.level;
      shop.level = level;
      await this.shopRepository.update({ id: shop.id }, { level });
      await this.notifications.notify({
        userId: shop.ownerId,
        type: 'shop.level',
        title: `Niveau de boutique : ${SHOP_LEVEL_LABELS[level]}`,
        body: `Votre boutique passe du niveau ${SHOP_LEVEL_LABELS[previous]} au niveau ${SHOP_LEVEL_LABELS[level]}.`,
        link: '/dashboard/vendeur/boutique',
      });
    }
    return level;
  }

  async eligibilityReport(ownerId: string) {
    const shop = await this.shopRepository.findOne({ where: { ownerId } });
    const perf = await this.performance(ownerId, shop);
    if (shop) await this.refreshLevel(shop);
    return { shop: shop ? { id: shop.id, level: shop.level, levelLabel: SHOP_LEVEL_LABELS[shop.level], identityVerified: shop.identityVerified, status: shop.status } : null, performance: perf, levels: this.eligibility(perf, shop) };
  }

  async adminSetStatus(adminId: string, shopId: string, dto: AdminShopStatusDto): Promise<ShopView> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    if (shop.status === dto.status) throw new ConflictException(`La boutique est déjà « ${SHOP_STATUS_LABELS[dto.status]} »`);
    if (!ADMIN_STATUS_TRANSITIONS[shop.status].includes(dto.status)) {
      throw new BadRequestException(`Transition impossible : ${SHOP_STATUS_LABELS[shop.status]} → ${SHOP_STATUS_LABELS[dto.status]}`);
    }
    if (dto.status === ShopStatus.ACTIVE) {
      const owner = await this.userRepository.findOne({ where: { id: shop.ownerId } });
      if (owner?.status === AccountStatus.SUSPENDED) throw new BadRequestException('Le compte du vendeur est suspendu : réactivez-le d\'abord');
    }
    const previous = shop.status;
    shop.status = dto.status;
    shop.statusReason = dto.reason?.trim() || null;
    if (dto.status === ShopStatus.ACTIVE && !shop.activatedAt) shop.activatedAt = new Date();
    const saved = await this.shopRepository.save(shop);
    await this.audit(adminId, 'shop_status', shop.id, { from: previous, to: dto.status, reason: dto.reason ?? null });
    await this.notifications.notify({
      userId: shop.ownerId,
      type: 'shop.status',
      title: `Boutique « ${shop.name} » : ${SHOP_STATUS_LABELS[dto.status]}`,
      body: dto.reason ? `Motif : ${dto.reason}` : `Le statut de votre boutique est désormais « ${SHOP_STATUS_LABELS[dto.status]} ».`,
      link: '/dashboard/vendeur/boutique',
      email: { status: SHOP_STATUS_LABELS[dto.status] },
    });
    const [view] = await this.decorate([saved], undefined, true);
    return view;
  }

  async adminSetIdentity(adminId: string, shopId: string, dto: AdminIdentityDto): Promise<ShopView> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    shop.identityVerified = dto.verified;
    shop.identityVerifiedAt = dto.verified ? new Date() : null;
    const saved = await this.shopRepository.save(shop);
    await this.audit(adminId, dto.verified ? 'shop_identity_verified' : 'shop_identity_revoked', shop.id, { reason: dto.reason ?? null });
    await this.refreshLevel(saved);
    const [view] = await this.decorate([saved], undefined, true);
    return view;
  }

  async adminSetLevel(adminId: string, shopId: string, dto: AdminShopLevelDto): Promise<ShopView> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    if (dto.level === ShopLevel.FOUNDER) {
      if (shop.founderGrantedAt) throw new ConflictException('Cette boutique est déjà Fondateur');
      shop.founderGrantedAt = new Date();
      shop.founderGrantedBy = adminId;
    } else {
      if (!shop.founderGrantedAt) throw new BadRequestException('Seul le niveau Fondateur est attribué manuellement ; les autres niveaux découlent des abonnements et de l\'éligibilité');
      shop.founderGrantedAt = null;
      shop.founderGrantedBy = null;
    }
    const saved = await this.shopRepository.save(shop);
    await this.audit(adminId, dto.level === ShopLevel.FOUNDER ? 'shop_founder_granted' : 'shop_founder_revoked', shop.id, { reason: dto.reason ?? null });
    await this.refreshLevel(saved);
    const [view] = await this.decorate([saved], undefined, true);
    return view;
  }

  async adminStats() {
    const rows = await this.shopRepository.createQueryBuilder('s').select('s.status', 'status').addSelect('COUNT(*)', 'count').groupBy('s.status').getRawMany<{ status: ShopStatus; count: string }>();
    const byStatus = Object.fromEntries(Object.values(ShopStatus).map((s) => [s, 0])) as Record<ShopStatus, number>;
    rows.forEach((r) => { byStatus[r.status] = Number(r.count); });
    const levels = await this.shopRepository.createQueryBuilder('s').select('s.level', 'level').addSelect('COUNT(*)', 'count').groupBy('s.level').getRawMany<{ level: ShopLevel; count: string }>();
    const byLevel = Object.fromEntries(Object.values(ShopLevel).map((l) => [l, 0])) as Record<ShopLevel, number>;
    levels.forEach((r) => { byLevel[r.level] = Number(r.count); });
    return { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, byLevel };
  }

  private async audit(userId: string, action: string, entityId: string, changes: object): Promise<void> {
    try {
      await this.auditLogRepository.save(this.auditLogRepository.create({ userId, action, entity: 'shop', entityId, changes }));
    } catch (error) {
      this.logger.warn(`Audit non enregistré (${action}): ${(error as Error).message}`);
    }
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'boutique';
    const taken = await this.shopRepository.find({ where: { slug: Like(`${base}%`) }, select: ['id', 'slug'], withDeleted: true });
    const used = new Set(taken.filter((s) => s.id !== excludeId).map((s) => s.slug));
    if (!used.has(base)) return base;
    for (let i = 2; i < 1000; i += 1) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
    return `${base}-${Date.now()}`;
  }
}

export function normalizeCity(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.charAt(0).toLocaleUpperCase('fr-FR') + cleaned.slice(1);
}
