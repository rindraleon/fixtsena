import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SellerSubscription, Shop } from '../../database/entities/marketplace.entity';
import { ShopStatus, SubscriptionPeriod, SubscriptionPlan, SubscriptionStatus, UserRole } from '../../database/entities/role.enum';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShopsService } from './shops.service';
import { SHOP_REQUIRED_MESSAGE } from './shop-access';

import { computeSubscriptionWindow, describeSubscriptionChange, resolveSubscriptionChange, type SubscriptionChangeKind } from './subscription-rules';

export const PLAN_LABELS: Record<SubscriptionPlan, string> = { [SubscriptionPlan.GOLD]: 'Gold', [SubscriptionPlan.PREMIUM]: 'Premium' };
const PAYMENT_METHODS = ['mvola', 'orange_money', 'airtel_money'];

export interface SubscriptionPlanOffer {
  plan: SubscriptionPlan;
  label: string;
  monthlyPrice: number;
  yearlyPrice: number;
  slots: number;
  slotsUsed: number;
  slotsLeft: number;
  benefits: string[];
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SellerSubscription) private readonly repository: Repository<SellerSubscription>,
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly shops: ShopsService,
  ) {}

  async plans(): Promise<SubscriptionPlanOffer[]> {
    const used = await this.repository
      .createQueryBuilder('s')
      .select('s.plan', 'plan')
      .addSelect('COUNT(*)', 'count')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .groupBy('s.plan')
      .getRawMany<{ plan: SubscriptionPlan; count: string }>();
    const usedMap = new Map(used.map((u) => [u.plan, Number(u.count)]));
    const discounts = this.settings.get('promotions.levelDiscounts') as Record<string, number>;
    const build = (plan: SubscriptionPlan, benefits: string[]): SubscriptionPlanOffer => {
      const slots = Number(this.settings.get(`subscriptions.${plan}.slots` as 'subscriptions.gold.slots'));
      const slotsUsed = usedMap.get(plan) ?? 0;
      return {
        plan,
        label: PLAN_LABELS[plan],
        monthlyPrice: Number(this.settings.get(`subscriptions.${plan}.monthlyPrice` as 'subscriptions.gold.monthlyPrice')),
        yearlyPrice: Number(this.settings.get(`subscriptions.${plan}.yearlyPrice` as 'subscriptions.gold.yearlyPrice')),
        slots,
        slotsUsed,
        slotsLeft: Math.max(0, slots - slotsUsed),
        benefits,
      };
    };
    return [
      build(SubscriptionPlan.GOLD, ['Badge Gold sur la boutique et les produits', 'Commission « gros vendeur » (grille réduite)', `${discounts.gold ?? 0} % de remise sur les promotions`, 'Mise en avant dans la liste des boutiques']),
      build(SubscriptionPlan.PREMIUM, ['Badge Premium sur la boutique et les produits', 'Commission « gros vendeur » (grille réduite)', `${discounts.premium ?? 0} % de remise sur les promotions`, 'Priorité dans « À la une » et support dédié']),
    ];
  }

  async mine(sellerId: string) {
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId } });
    if (shop) await this.shops.refreshLevel(shop);
    const history = await this.repository.find({ where: { sellerId }, order: { createdAt: 'DESC' }, take: 20 });
    const current = history.find((s) => s.status === SubscriptionStatus.ACTIVE) ?? null;
    const pending = history.find((s) => s.status === SubscriptionStatus.PENDING_PAYMENT) ?? null;
    const scheduled = history.find((s) => s.status === SubscriptionStatus.SCHEDULED) ?? null;
    return { shop: shop ? { id: shop.id, level: shop.level, status: shop.status, founder: !!shop.founderGrantedAt } : null, current, pending, scheduled, history };
  }

  async subscribe(sellerId: string, plan: SubscriptionPlan, period: SubscriptionPeriod): Promise<SellerSubscription & { change: SubscriptionChangeKind; changeMessage: string }> {
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId } });

    if (!shop) throw new ForbiddenException(SHOP_REQUIRED_MESSAGE);
    if (shop.status !== ShopStatus.ACTIVE) throw new ForbiddenException('Votre boutique doit être active pour souscrire un abonnement');
    if (shop.founderGrantedAt) throw new ConflictException('Une boutique Fondateur bénéficie déjà de tous les avantages');
    await this.shops.refreshLevel(shop);

    const active = await this.repository.findOne({ where: { shopId: shop.id, status: SubscriptionStatus.ACTIVE } });
    const scheduled = await this.repository.findOne({ where: { shopId: shop.id, status: SubscriptionStatus.SCHEDULED } });
    if (scheduled) {
      throw new ConflictException(`Un abonnement ${PLAN_LABELS[scheduled.plan]} est déjà programmé à partir du ${scheduled.startsAt?.toLocaleDateString('fr-FR')} : attendez son activation avant toute nouvelle souscription`);
    }
    const kind = resolveSubscriptionChange(active?.plan ?? null, plan);
    const pending = await this.repository.findOne({ where: { shopId: shop.id, status: SubscriptionStatus.PENDING_PAYMENT } });
    if (pending) {
      pending.status = SubscriptionStatus.CANCELLED;
      await this.repository.save(pending);
    }
    const offers = await this.plans();
    const offer = offers.find((o) => o.plan === plan)!;
    if (offer.slotsLeft <= 0) throw new ConflictException(`Toutes les places ${offer.label} sont actuellement attribuées (${offer.slots}). Réessayez plus tard.`);
    const amount = period === SubscriptionPeriod.YEARLY ? offer.yearlyPrice : offer.monthlyPrice;
    const created = await this.repository.save(this.repository.create({ sellerId, shopId: shop.id, plan, period, amount, status: SubscriptionStatus.PENDING_PAYMENT }));
    return Object.assign(created, { change: kind, changeMessage: describeSubscriptionChange(kind, plan, active?.endsAt ?? null) });
  }

  async previewChange(
    sellerId: string,
    plan: SubscriptionPlan,
  ): Promise<{
    change: SubscriptionChangeKind;
    message: string;
    activeEndsAt: Date | null;
    blockedBy: { plan: SubscriptionPlan; startsAt: Date | null } | null;
  }> {
    const shop = await this.shopRepository.findOne({ where: { ownerId: sellerId } });
    const active = shop ? await this.repository.findOne({ where: { shopId: shop.id, status: SubscriptionStatus.ACTIVE } }) : null;
    const scheduled = shop ? await this.repository.findOne({ where: { shopId: shop.id, status: SubscriptionStatus.SCHEDULED } }) : null;
    const kind = resolveSubscriptionChange(active?.plan ?? null, plan);
    return {
      change: kind,
      message: describeSubscriptionChange(kind, plan, active?.endsAt ?? null),
      activeEndsAt: active?.endsAt ?? null,
      blockedBy: scheduled ? { plan: scheduled.plan, startsAt: scheduled.startsAt ?? null } : null,
    };
  }

  async pay(sellerId: string, subscriptionId: string, method: string): Promise<SellerSubscription> {
    if (!PAYMENT_METHODS.includes(method)) throw new BadRequestException(`Moyen de paiement invalide (${PAYMENT_METHODS.join(', ')})`);
    const subscription = await this.repository.findOne({ where: { id: subscriptionId, sellerId } });
    if (!subscription) throw new NotFoundException('Abonnement non trouvé');
    if (subscription.status === SubscriptionStatus.ACTIVE) throw new ConflictException('Cet abonnement est déjà payé et actif');
    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) throw new ConflictException('Cet abonnement ne peut plus être payé');

    const shop = await this.shopRepository.findOne({ where: { id: subscription.shopId } });
    if (!shop || shop.status !== ShopStatus.ACTIVE) throw new ForbiddenException('Votre boutique doit être active pour activer un abonnement');

    const now = new Date();
    await this.shops.refreshLevel(shop);
    const previous = await this.repository.find({ where: { shopId: shop.id, status: SubscriptionStatus.ACTIVE } });
    const active = previous.find((sub) => !sub.endsAt || new Date(sub.endsAt).getTime() > now.getTime()) ?? null;
    const kind = resolveSubscriptionChange(active?.plan ?? null, subscription.plan);
    const window = computeSubscriptionWindow(kind, subscription.period, now, active?.endsAt ?? null);

    if (!window.scheduled) {
      for (const sub of previous) {
        sub.status = SubscriptionStatus.REPLACED;
        sub.endsAt = now;
        await this.repository.save(sub);
      }
    }

    subscription.status = window.scheduled ? SubscriptionStatus.SCHEDULED : SubscriptionStatus.ACTIVE;
    subscription.paymentMethod = method;
    subscription.paymentReference = `SUB-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    subscription.paidAt = now;
    subscription.startsAt = window.startsAt;
    subscription.endsAt = window.endsAt;
    subscription.expiryAlertSent = false;
    const saved = await this.repository.save(subscription);
    await this.shops.refreshLevel(shop);

    const label = PLAN_LABELS[saved.plan];
    if (window.scheduled) {
      const isRenewal = kind === 'renewal';
      await this.notifications.notify({
        userId: sellerId,
        type: 'subscription.scheduled',
        title: isRenewal ? `Renouvellement ${label} enregistré` : `Passage à ${label} programmé`,
        body: isRenewal
          ? `Votre abonnement ${label} est prolongé : la nouvelle période court du ${window.startsAt.toLocaleDateString('fr-FR')} au ${window.endsAt.toLocaleDateString('fr-FR')}. Référence : ${saved.paymentReference}.`
          : `Votre abonnement ${label} démarrera le ${window.startsAt.toLocaleDateString('fr-FR')}, à l'expiration de votre abonnement Premium, et courra jusqu'au ${window.endsAt.toLocaleDateString('fr-FR')}. Référence : ${saved.paymentReference}.`,
        link: '/dashboard/vendeur/abonnement',
        email: { status: 'Programmé', orderNumber: saved.paymentReference, nextAction: 'Aucune action requise', actionLabel: 'Voir mon abonnement' },
      });
    } else {
      await this.notifications.notify({
        userId: sellerId,
        type: 'subscription.activated',
        title: `Abonnement ${label} activé`,
        body: `Votre abonnement ${label} est actif jusqu'au ${window.endsAt.toLocaleDateString('fr-FR')}. Référence : ${saved.paymentReference}.`,
        link: '/dashboard/vendeur/abonnement',
        email: { status: 'Actif', orderNumber: saved.paymentReference, nextAction: 'Profitez de vos avantages dès maintenant', actionLabel: 'Voir mon abonnement' },
      });
    }
    return saved;
  }

  async cancelPending(sellerId: string, subscriptionId: string): Promise<SellerSubscription> {
    const subscription = await this.repository.findOne({ where: { id: subscriptionId, sellerId } });
    if (!subscription) throw new NotFoundException('Abonnement non trouvé');
    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) throw new ConflictException('Seul un abonnement en attente de paiement peut être annulé');
    subscription.status = SubscriptionStatus.CANCELLED;
    return this.repository.save(subscription);
  }

  async adminList(options: { status?: SubscriptionStatus; plan?: SubscriptionPlan; page?: number; limit?: number }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    if (options.plan) where.plan = options.plan;
    const [items, total] = await this.repository.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    const shopIds = [...new Set(items.map((i) => i.shopId))];
    const shops = shopIds.length ? await this.shopRepository.find({ where: { id: In(shopIds) }, select: ['id', 'name', 'slug', 'level'] }) : [];
    const shopMap = new Map(shops.map((s) => [s.id, s]));
    return { items: items.map((i) => ({ ...i, shop: shopMap.get(i.shopId) ?? null })), total, page, limit };
  }

  isBigSellerLevel(level: string): boolean {
    return (this.settings.get('commissions.bigSellerLevels') as readonly string[]).includes(level);
  }

  canAccess(user: { roles: UserRole[] }): boolean {
    return user.roles.includes(UserRole.SELLER) || user.roles.includes(UserRole.ADMIN);
  }
}
