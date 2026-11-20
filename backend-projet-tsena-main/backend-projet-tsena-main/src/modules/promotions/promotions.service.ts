import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Promotion, Shop } from '../../database/entities/marketplace.entity';
import { Product } from '../../database/entities/catalog.entity';
import { SHOP_REQUIRED_MESSAGE } from '../shops/shop-access';
import { AuditLog } from '../../database/entities/transaction.entity';
import { ProductStatus, PromotionStatus, PromotionType, ShopLevel, ShopStatus } from '../../database/entities/role.enum';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PromotionOffer } from '../settings/settings.defaults';

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  [PromotionType.BOOST]: 'Boost',
  [PromotionType.HIGHLIGHT]: 'Mise en avant',
  [PromotionType.FEATURED]: 'À la une',
};
const PAYMENT_METHODS = ['mvola', 'orange_money', 'airtel_money'];
const SELLABLE_STATUSES = [ProductStatus.ACTIVE, ProductStatus.PUBLISHED];

export interface ActivePromotionSummary {
  id: string;
  type: PromotionType;
  typeLabel: string;
  endsAt: Date | null;
  sponsored: true;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion) private readonly repository: Repository<Promotion>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  offers(level?: ShopLevel | null): Array<PromotionOffer & { typeLabel: string; discountPercent: number; finalPrice: number }> {
    const discounts = this.settings.get('promotions.levelDiscounts') as Record<string, number>;
    const discount = level ? Number(discounts[level] ?? 0) : 0;
    return (this.settings.get('promotions.offers') as PromotionOffer[]).map((offer) => ({
      ...offer,
      typeLabel: PROMOTION_TYPE_LABELS[offer.type as PromotionType],
      discountPercent: discount,
      finalPrice: Math.round(offer.price * (1 - discount / 100)),
    }));
  }

  async offersForSeller(sellerId: string) {
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId }, select: ['id', 'level', 'status'] });
    return { shopLevel: shop?.level ?? null, offers: this.offers(shop?.level ?? null) };
  }

  async create(sellerId: string, productId: string, type: PromotionType, durationDays: number): Promise<Promotion> {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produit non trouvé');
    if (product.sellerId !== sellerId) throw new ForbiddenException('Ce produit ne vous appartient pas');
    if (!SELLABLE_STATUSES.includes(product.status) || product.stockQuantity <= 0) {
      throw new BadRequestException('Seul un produit publié et disponible en stock peut être promu');
    }
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId } });

    if (!shop) throw new ForbiddenException(SHOP_REQUIRED_MESSAGE);
    if (shop.status !== ShopStatus.ACTIVE) throw new ForbiddenException('Votre boutique doit être active pour acheter une promotion');

    const offer = this.offers(shop?.level ?? null).find((o) => o.type === type && o.durationDays === durationDays);
    if (!offer) throw new BadRequestException('Offre de promotion inconnue (type / durée)');

    await this.expireStale();
    const existing = await this.repository.findOne({ where: { productId, type, status: In([PromotionStatus.ACTIVE, PromotionStatus.PENDING_PAYMENT]) } });
    if (existing) throw new ConflictException(`Une promotion « ${PROMOTION_TYPE_LABELS[type]} » est déjà ${existing.status === PromotionStatus.ACTIVE ? 'active' : 'en attente de paiement'} pour ce produit`);
    const activeCount = await this.repository.count({ where: { sellerId, status: PromotionStatus.ACTIVE } });
    const maxActive = Number(this.settings.get('promotions.maxActivePerSeller')) || 10;
    if (activeCount >= maxActive) throw new ConflictException(`Vous avez atteint le maximum de ${maxActive} promotions actives`);

    return this.repository.save(this.repository.create({
      productId,
      sellerId,
      type,
      durationDays,
      listPrice: offer.price,
      amount: offer.finalPrice,
      status: PromotionStatus.PENDING_PAYMENT,
    }));
  }

  async pay(sellerId: string, promotionId: string, method: string): Promise<Promotion> {
    if (!PAYMENT_METHODS.includes(method)) throw new BadRequestException(`Moyen de paiement invalide (${PAYMENT_METHODS.join(', ')})`);
    const promotion = await this.repository.findOne({ where: { id: promotionId, sellerId } });
    if (!promotion) throw new NotFoundException('Promotion non trouvée');
    if (promotion.status === PromotionStatus.ACTIVE) throw new ConflictException('Cette promotion est déjà active');
    if (promotion.status !== PromotionStatus.PENDING_PAYMENT) throw new ConflictException('Cette promotion ne peut plus être payée');
    const product = await this.productRepository.findOne({ where: { id: promotion.productId } });
    if (!product || !SELLABLE_STATUSES.includes(product.status) || product.stockQuantity <= 0) {
      throw new BadRequestException('Le produit n\'est plus publié ou disponible : promotion impossible');
    }
    const now = new Date();
    const ends = new Date(now.getTime() + promotion.durationDays * 86400000);
    promotion.status = PromotionStatus.ACTIVE;
    promotion.paymentMethod = method;
    promotion.paymentReference = `PROMO-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    promotion.paidAt = now;
    promotion.startsAt = now;
    promotion.endsAt = ends;
    const saved = await this.repository.save(promotion);
    if (promotion.type === PromotionType.FEATURED && !product.isFeatured) {
      await this.productRepository.update({ id: product.id }, { isFeatured: true });
    }
    await this.notifications.notify({
      userId: sellerId,
      type: 'promotion.activated',
      title: `Promotion « ${PROMOTION_TYPE_LABELS[saved.type]} » activée`,
      body: `Le produit « ${product.name} » est promu jusqu'au ${ends.toLocaleDateString('fr-FR')}. Référence de paiement : ${saved.paymentReference}.`,
      link: '/dashboard/vendeur/promotions',
      email: { status: 'Active', orderNumber: saved.paymentReference },
    });
    return saved;
  }

  async cancelPending(sellerId: string, promotionId: string): Promise<Promotion> {
    const promotion = await this.repository.findOne({ where: { id: promotionId, sellerId } });
    if (!promotion) throw new NotFoundException('Promotion non trouvée');
    if (promotion.status !== PromotionStatus.PENDING_PAYMENT) throw new ConflictException('Seule une promotion en attente de paiement peut être annulée');
    promotion.status = PromotionStatus.CANCELLED;
    return this.repository.save(promotion);
  }

  async mine(sellerId: string) {
    await this.expireStale();
    const items = await this.repository.find({ where: { sellerId }, order: { createdAt: 'DESC' }, take: 100 });
    return this.attachProducts(items);
  }

  async adminList(options: { status?: PromotionStatus; type?: PromotionType; page?: number; limit?: number }) {
    await this.expireStale();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    if (options.type) where.type = options.type;
    const [items, total] = await this.repository.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    return { items: await this.attachProducts(items), total, page, limit };
  }

  async adminStop(adminId: string, promotionId: string, reason?: string): Promise<Promotion> {
    const promotion = await this.repository.findOne({ where: { id: promotionId } });
    if (!promotion) throw new NotFoundException('Promotion non trouvée');
    if (promotion.status !== PromotionStatus.ACTIVE) throw new ConflictException('Seule une promotion active peut être arrêtée');
    promotion.status = PromotionStatus.STOPPED;
    promotion.stoppedBy = adminId;
    promotion.stopReason = reason?.trim() || null;
    promotion.endsAt = new Date();
    const saved = await this.repository.save(promotion);
    await this.auditLogRepository.save(this.auditLogRepository.create({ userId: adminId, action: 'promotion_stopped', entity: 'promotion', entityId: promotion.id, changes: { reason: reason ?? null } }));
    await this.syncFeaturedFlag(promotion.productId);
    await this.notifications.notify({
      userId: promotion.sellerId,
      type: 'promotion.stopped',
      title: `Promotion « ${PROMOTION_TYPE_LABELS[promotion.type]} » arrêtée`,
      body: reason ? `Motif : ${reason}` : 'La promotion a été arrêtée par l\'administration.',
      link: '/dashboard/vendeur/promotions',
    });
    return saved;
  }

  async adminStats() {
    await this.expireStale();
    const rows = await this.repository.createQueryBuilder('p').select('p.status', 'status').addSelect('COUNT(*)', 'count').addSelect('COALESCE(SUM(CASE WHEN p.paidAt IS NOT NULL THEN p.amount ELSE 0 END),0)', 'revenue').groupBy('p.status').getRawMany<{ status: PromotionStatus; count: string; revenue: string }>();
    const byStatus = Object.fromEntries(Object.values(PromotionStatus).map((s) => [s, 0])) as Record<PromotionStatus, number>;
    let revenue = 0;
    rows.forEach((r) => { byStatus[r.status] = Number(r.count); revenue += Number(r.revenue); });
    return { byStatus, revenue, active: byStatus[PromotionStatus.ACTIVE] };
  }

  async activeByProductIds(productIds: string[]): Promise<Map<string, ActivePromotionSummary[]>> {
    if (productIds.length === 0) return new Map();
    await this.expireStale();
    const rows = await this.repository.find({ where: { productId: In(productIds), status: PromotionStatus.ACTIVE }, order: { endsAt: 'ASC' } });
    const map = new Map<string, ActivePromotionSummary[]>();
    for (const row of rows) {
      const list = map.get(row.productId) ?? [];
      list.push({ id: row.id, type: row.type, typeLabel: PROMOTION_TYPE_LABELS[row.type], endsAt: row.endsAt, sponsored: true });
      map.set(row.productId, list);
    }
    return map;
  }

  async activeProductIds(type?: PromotionType): Promise<string[]> {
    await this.expireStale();
    const rows = await this.repository.find({ where: type ? { status: PromotionStatus.ACTIVE, type } : { status: PromotionStatus.ACTIVE }, order: { startsAt: 'DESC' }, select: ['productId'] });
    return [...new Set(rows.map((r) => r.productId))];
  }

  async expireStale(): Promise<void> {
    const stale = await this.repository.createQueryBuilder('p').where('p.status = :status', { status: PromotionStatus.ACTIVE }).andWhere('p.endsAt <= :now', { now: new Date() }).getMany();
    for (const promotion of stale) {
      promotion.status = PromotionStatus.EXPIRED;
      await this.repository.save(promotion);
      await this.syncFeaturedFlag(promotion.productId);
    }
  }

  private async syncFeaturedFlag(productId: string): Promise<void> {
    const stillFeatured = await this.repository.count({ where: { productId, type: PromotionType.FEATURED, status: PromotionStatus.ACTIVE } });
    if (stillFeatured === 0) {
      const product = await this.productRepository.findOne({ where: { id: productId }, select: ['id', 'isFeatured'] });
      if (product?.isFeatured) await this.productRepository.update({ id: productId }, { isFeatured: false });
    }
  }

  private async attachProducts(items: Promotion[]) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = ids.length ? await this.productRepository.find({ where: { id: In(ids) }, relations: ['images'], select: ['id', 'name', 'slug', 'price', 'status', 'stockQuantity', 'sellerId'] }) : [];
    const map = new Map(products.map((p) => [p.id, p]));
    return items.map((item) => ({ ...item, typeLabel: PROMOTION_TYPE_LABELS[item.type], product: map.get(item.productId) ?? null }));
  }
}
