import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order, OrderLine, Cart, CartItem, Payment, Escrow, Delivery, OrderStatusHistory, ShippingAddressSnapshot } from '../../database/entities/transaction.entity';
import { appendOrderHistory } from './order-history';
import { Product } from '../../database/entities/catalog.entity';
import { Address, User } from '../../database/entities/user.entity';
import { CartService } from '../cart/cart.service';
import { CommissionsService } from '../commissions/commissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadgesService } from '../badges/badges.service';
import { DeliveryZone } from '../../database/entities/marketplace.entity';
import { ShopsService } from '../shops/shops.service';
import { CreateOrderDto, UpdateOrderStatusDto, FilterOrderDto, UpdateDeliveryDto, DeliveryEventStatus } from './dto/order.dto';
import { UserRole, OrderStatus, PaymentStatus, DeliveryStatus } from '../../database/entities/role.enum';

export type OrderLineView = OrderLine & {
  productName: string;
  productSlug: string | null;
  productImage: string | null;
};

export interface OrderPartySummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export type OrderView = Order & {
  lines: OrderLineView[];
  buyer: OrderPartySummary | null;
  seller: OrderPartySummary | null;
  delivery: Delivery | null;
  history?: OrderStatusHistory[];
};

const DELIVERY_STATUS_FOR_ORDER: Partial<Record<OrderStatus, DeliveryStatus>> = {
  [OrderStatus.CONFIRMED]: DeliveryStatus.TO_PREPARE,
  [OrderStatus.PROCESSING]: DeliveryStatus.PREPARING,
  [OrderStatus.SHIPPED]: DeliveryStatus.SHIPPED,
  [OrderStatus.DELIVERED]: DeliveryStatus.RECEPTION_CONFIRMED,
  [OrderStatus.IN_DISPUTE]: DeliveryStatus.IN_DISPUTE,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderLine)
    private readonly orderLineRepository: Repository<OrderLine>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,

    private readonly shopsService: ShopsService,
    @Optional() private readonly commissions?: CommissionsService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly badges?: BadgesService,
  ) {}

  async createOrdersFromCart(userId: string, dto: CreateOrderDto) {
    const groupedBySeller = await this.cartService.prepareForCheckout(userId);

    let shippingAddress: ShippingAddressSnapshot | null = null;
    if (dto.addressId) {
      const address = await this.addressRepository.findOne({
        where: { id: dto.addressId, userId },
      });
      if (!address) {
        throw new BadRequestException('Adresse de livraison non trouvée');
      }
      shippingAddress = {
        recipientName: address.recipientName ?? null,
        phone: address.phone ?? null,
        street: address.street,
        complement: address.complement ?? null,
        city: address.city,
        state: address.state || null,
        postalCode: address.postalCode || null,
        country: address.country || null,
        instructions: address.instructions ?? null,
      };
    }

    const priceChanges: { productId: string; name: string; previousPrice: number; currentPrice: number }[] = [];
    for (const items of groupedBySeller.values()) {
      for (const item of items) {
        const current = Number(item.product?.price ?? item.unitPrice);
        if (Math.abs(current - Number(item.unitPrice)) > 0.001) {
          priceChanges.push({ productId: item.productId, name: item.product?.name ?? 'Article', previousPrice: Number(item.unitPrice), currentPrice: current });
          item.unitPrice = current;
          await this.cartItemRepository.update({ id: item.id }, { unitPrice: current });
        }
      }
    }
    if (priceChanges.length > 0) {
      if (!dto.acceptPriceChanges) {
        const details = priceChanges
          .map((c) => `${c.name} : ${c.previousPrice.toLocaleString('fr-FR')} Ar → ${c.currentPrice.toLocaleString('fr-FR')} Ar`)
          .join(' ; ');
        throw new ConflictException({
          message: `Le prix de ${priceChanges.length > 1 ? 'certains articles a' : 'un article a'} changé depuis son ajout au panier (${details}). Vérifiez le récapitulatif puis confirmez la commande.`,
          code: 'PRICE_CHANGED',
          errors: priceChanges.map((c) => ({ field: `product:${c.productId}`, message: `${c.name} : nouveau prix ${c.currentPrice.toLocaleString('fr-FR')} Ar`, value: c.currentPrice })),
        });
      }
    }

    let deliveryZone: DeliveryZone | null = null;
    if (dto.deliveryZoneId) {
      deliveryZone = await this.dataSource.getRepository(DeliveryZone).findOne({ where: { id: dto.deliveryZoneId } });
      if (!deliveryZone || !deliveryZone.isActive) {
        throw new BadRequestException('Zone de livraison invalide ou inactive');
      }
    }

    const createdOrders: Order[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const [sellerId, items] of groupedBySeller) {
        const subtotalAmount = items.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.quantity,
          0,
        );
        const shippingAmount = deliveryZone ? Number(deliveryZone.price) : 0;
        const totalAmount = subtotalAmount + shippingAmount;

        let commissionAmount = 0;
        let commissionTier: string | null = null;
        if (this.commissions) {
          for (const item of items) {
            const quote = await this.commissions.quote(sellerId, item.product?.categoryId ?? null);
            commissionTier = quote.tier;
            commissionAmount += this.commissions.compute(Number(item.unitPrice) * item.quantity, quote.ratePercent).commissionAmount;
          }
        }
        const commissionRate = subtotalAmount > 0 ? Math.round((commissionAmount / subtotalAmount) * 10000) / 100 : 0;

        const orderNumber = await this.generateOrderNumber();

        const order = manager.create(Order, {
          orderNumber,
          buyerId: userId,
          sellerId,
          addressId: dto.addressId,
          subtotalAmount: Math.round(subtotalAmount * 100) / 100,
          shippingAmount,
          totalAmount: Math.round(totalAmount * 100) / 100,
          status: OrderStatus.PENDING,
          notes: dto.notes,
          shippingAddress,
          deliveryZoneId: deliveryZone?.id ?? null,
          deliveryZoneName: deliveryZone?.name ?? null,
          commissionRate,
          commissionAmount: Math.round(commissionAmount),
          sellerNetAmount: Math.round(subtotalAmount - commissionAmount),
          commissionTier,
        } as any);

        const savedOrder = await manager.save(Order, order);

        for (const item of items) {
          const orderLine = manager.create(OrderLine, {
            orderId: savedOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: Math.round(Number(item.unitPrice) * item.quantity * 100) / 100,
          });
          await manager.save(OrderLine, orderLine);

          const result = await manager
            .createQueryBuilder()
            .update(Product)
            .set({ stockQuantity: () => `"stockQuantity" - ${Number(item.quantity)}` })
            .where('id = :id AND "stockQuantity" >= :qty', { id: item.productId, qty: item.quantity })
            .execute();
          if (!result.affected) {
            throw new ConflictException(
              `Stock insuffisant pour « ${item.product?.name ?? 'un article'} » : un autre acheteur vient de le commander. Veuillez ajuster votre panier.`,
            );
          }
        }

        await appendOrderHistory(manager, {
          orderId: savedOrder.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          actorId: userId,
          actorRole: 'buyer',
          comment: 'Commande créée',
        });

        createdOrders.push(savedOrder);
      }

      const cart = await this.cartRepository.findOne({ where: { userId } });
      if (cart) {
        await manager.delete(CartItem, { cartId: cart.id });
      }
    });

    this.logger.log(`${createdOrders.length} commande(s) créée(s) par l'utilisateur ${userId}`);

    for (const order of createdOrders) {
      await this.notifications?.notify({
        userId: order.buyerId,
        type: 'order.created',
        title: `Commande ${order.orderNumber} enregistrée`,
        body: `Votre commande de ${Number(order.totalAmount).toLocaleString('fr-FR')} Ar est enregistrée. Prochaine étape : le paiement.`,
        link: '/dashboard/client/mes-commandes',
        email: { orderNumber: order.orderNumber, status: 'En attente de paiement', nextAction: 'Payer la commande pour la transmettre au vendeur', actionLabel: 'Voir ma commande' },
      });
      await this.notifications?.notify({
        userId: order.sellerId,
        type: 'order.created',
        title: `Nouvelle commande ${order.orderNumber}`,
        body: `Un client vient de passer une commande de ${Number(order.subtotalAmount).toLocaleString('fr-FR')} Ar. Elle vous sera transmise dès confirmation du paiement.`,
        link: '/dashboard/vendeur/commandes',
        email: { orderNumber: order.orderNumber, status: 'En attente de paiement' },
      });
    }

    return Promise.all(
      createdOrders.map(o => this.findById(o.id)),
    );
  }

  async checkoutQuote(userId: string, deliveryZoneId?: string) {
    const groupedBySeller = await this.cartService.prepareForCheckout(userId, { allowEmpty: true });
    let zone: DeliveryZone | null = null;
    if (deliveryZoneId) {
      zone = await this.dataSource.getRepository(DeliveryZone).findOne({ where: { id: deliveryZoneId } });
      if (!zone || !zone.isActive) throw new BadRequestException('Zone de livraison invalide ou inactive');
    }
    const shippingPerOrder = zone ? Number(zone.price) : 0;
    const sellerIds = [...groupedBySeller.keys()];
    const sellers = sellerIds.length ? await this.userRepository.find({ where: { id: In(sellerIds) } }) : [];
    const sellerById = new Map(sellers.map((u) => [u.id, u]));
    const orders = sellerIds.map((sellerId) => {
      const items = groupedBySeller.get(sellerId)!;
      const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
      const seller = sellerById.get(sellerId);
      return {
        sellerId,
        sellerName: seller ? `${seller.firstName} ${seller.lastName ?? ''}`.trim() : 'Vendeur',
        itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotalAmount: Math.round(subtotal),
        shippingAmount: shippingPerOrder,
        totalAmount: Math.round(subtotal + shippingPerOrder),
      };
    });
    return {
      deliveryZone: zone ? { id: zone.id, name: zone.name, price: Number(zone.price), description: zone.description ?? null } : null,
      orders,
      ordersCount: orders.length,
      subtotalAmount: orders.reduce((s, o) => s + o.subtotalAmount, 0),
      shippingAmount: orders.reduce((s, o) => s + o.shippingAmount, 0),
      totalAmount: orders.reduce((s, o) => s + o.totalAmount, 0),
    };
  }

  forViewer<T extends Order>(order: T, userId: string, roles: UserRole[]): T {
    const canSeeCommission = roles.includes(UserRole.ADMIN) || order.sellerId === userId;
    if (canSeeCommission) return order;
    const { commissionRate: _r, commissionAmount: _a, sellerNetAmount: _n, commissionTier: _t, ...rest } = order as Order;
    return rest as T;
  }

  async findAll(filters: FilterOrderDto, userId: string, userRoles: UserRole[]) {
    const { status, sellerId, buyerId, search, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.orderRepository.createQueryBuilder('order');

    if (!userRoles.includes(UserRole.ADMIN)) {
      const isSeller = userRoles.includes(UserRole.SELLER);
      if (buyerId === userId) {
        qb.andWhere('order.buyerId = :userId', { userId });
      } else if (sellerId === userId || (isSeller && !buyerId)) {
        qb.andWhere('order.sellerId = :userId', { userId });
      } else {
        qb.andWhere('order.buyerId = :userId', { userId });
      }
    }

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }
    if (sellerId) {
      qb.andWhere('order.sellerId = :sellerId', { sellerId });
    }
    if (buyerId) {
      qb.andWhere('order.buyerId = :buyerId', { buyerId });
    }
    if (search) {
      qb.andWhere('order.orderNumber ILIKE :search', { search: `%${search}%` });
    }
    if (startDate) {
      qb.andWhere('order.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('order.createdAt <= :endDate', { endDate });
    }

    qb.orderBy('order.createdAt', 'DESC');

    const total = await qb.getCount();
    const orders = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = await this.toViews(orders);

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

  async findById(id: string): Promise<OrderView> {
    const order = await this.orderRepository.findOne({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    const [view] = await this.toViews([order]);
    const history = await this.dataSource
      .getRepository(OrderStatusHistory)
      .find({ where: { orderId: id }, order: { createdAt: 'ASC' } })
      .catch(() => [] as OrderStatusHistory[]);
    return { ...view, history };
  }

  private async toViews(orders: Order[]): Promise<OrderView[]> {
    if (orders.length === 0) return [];
    const ids = orders.map((o) => o.id);
    const [linesByOrder, partyById, deliveries] = await Promise.all([
      this.loadLines(ids),
      this.loadParties(orders.flatMap((o) => [o.buyerId, o.sellerId])),
      this.dataSource.getRepository(Delivery).find({ where: { orderId: In(ids) } }).catch(() => [] as Delivery[]),
    ]);
    const deliveryByOrder = new Map(deliveries.map((d) => [d.orderId, d]));
    return orders.map((order) => ({
      ...order,
      lines: linesByOrder.get(order.id) ?? [],
      buyer: partyById.get(order.buyerId) ?? null,
      seller: partyById.get(order.sellerId) ?? null,
      delivery: deliveryByOrder.get(order.id) ?? null,
    }));
  }

  private async loadParties(userIds: string[]): Promise<Map<string, OrderPartySummary>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const users = await this.userRepository.find({
      where: { id: In(ids) },
      select: ['id', 'firstName', 'lastName', 'email', 'phone', 'avatarUrl'],
      withDeleted: true,
    });
    return new Map(
      users.map((u) => [
        u.id,
        { id: u.id, firstName: u.firstName, lastName: u.lastName ?? null, email: u.email, phone: u.phone ?? null, avatarUrl: u.avatarUrl ?? null },
      ]),
    );
  }

  private async loadLines(orderIds: string[]): Promise<Map<string, OrderLineView[]>> {
    const result = new Map<string, OrderLineView[]>();
    if (orderIds.length === 0) return result;

    const lines = await this.orderLineRepository.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'ASC' },
    });
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = productIds.length
      ? await this.productRepository.find({ where: { id: In(productIds) }, relations: ['images'], withDeleted: true })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const line of lines) {
      const product = productById.get(line.productId);
      const primaryImage = product?.images?.find((img) => img.isPrimary) ?? product?.images?.[0];
      const view: OrderLineView = {
        ...line,
        productName: product?.name ?? 'Produit supprimé',
        productSlug: product?.slug ?? null,
        productImage: primaryImage?.url ?? null,
      };
      const bucket = result.get(line.orderId) ?? [];
      bucket.push(view);
      result.set(line.orderId, bucket);
    }
    return result;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    return this.findById(order.id);
  }

  assertCanView(order: { buyerId: string; sellerId: string }, userId: string, userRoles: UserRole[]) {
    if (userRoles.includes(UserRole.ADMIN)) return;
    if (order.buyerId === userId || order.sellerId === userId) return;
    throw new ForbiddenException('Vous n\'avez pas la permission de consulter cette commande');
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string,
    userRoles: UserRole[],
  ) {
    const order = await this.findById(id);
    const isAdmin = userRoles.includes(UserRole.ADMIN);
    const isSellerOfOrder = !isAdmin && userRoles.includes(UserRole.SELLER) && order.sellerId === userId;
    const isBuyerOfOrder = !isAdmin && order.buyerId === userId;

    if (isSellerOfOrder) {
      await this.shopsService.requireShop(userId);

      const allowedStatuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
      ];
      if (!allowedStatuses.includes(dto.status)) {
        throw new ForbiddenException('Statut non autorisé pour un vendeur');
      }
      if (dto.status === OrderStatus.CONFIRMED && !(await this.isOrderPayable(order.id))) {
        throw new BadRequestException(
          'Le paiement de cette commande n\'a pas encore été confirmé : elle ne peut pas être acceptée',
        );
      }
    } else if (isBuyerOfOrder) {
      if (dto.status === OrderStatus.CANCELLED) {
        if (order.status !== OrderStatus.PENDING) {
          throw new BadRequestException('La commande ne peut être annulée qu\'en attente');
        }
      } else if (dto.status === OrderStatus.DELIVERED) {
        if (order.status !== OrderStatus.SHIPPED) {
          throw new BadRequestException(
            'Vous ne pouvez confirmer la réception qu\'une fois la commande expédiée',
          );
        }
      } else {
        throw new ForbiddenException('Vous n\'avez pas la permission de modifier cette commande');
      }
    } else if (!isAdmin) {
      throw new ForbiddenException('Vous n\'avez pas la permission de modifier cette commande');
    }

    this.validateStatusTransition(order.status, dto.status);

    if (dto.status === OrderStatus.SHIPPED && isSellerOfOrder && !dto.carrier?.trim() && !dto.deliveryMethod?.trim()) {
      throw new BadRequestException('Indiquez le mode de livraison ou le transporteur pour déclarer l’expédition');
    }

    const previousStatus = order.status;
    const actorRole = isAdmin ? 'admin' : isSellerOfOrder ? 'seller' : 'buyer';
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, { id: order.id }, { status: dto.status });
      order.status = dto.status;
      await this.syncDelivery(manager, order, dto);
      await appendOrderHistory(manager, {
        orderId: order.id,
        fromStatus: previousStatus,
        toStatus: dto.status,
        actorId: userId,
        actorRole,
        comment: dto.comment ?? null,
        metadata: dto.status === OrderStatus.SHIPPED
          ? { carrier: dto.carrier ?? null, trackingNumber: dto.trackingNumber ?? null, estimatedDeliveryAt: dto.estimatedDeliveryAt ?? null, deliveryMethod: dto.deliveryMethod ?? null }
          : null,
      });
    });

    if (dto.status === OrderStatus.CANCELLED) {
      await this.restoreStock(order.id);
      await this.refundEscrow(order, 'annulation');
    } else if (dto.status === OrderStatus.DELIVERED) {
      await this.settleOnDelivery(order);
    } else if (dto.status === OrderStatus.REFUNDED) {
      await this.refundEscrow(order, 'remboursement');
    }

    this.logger.log(`Commande ${order.orderNumber} : ${previousStatus} → ${dto.status}`);
    const tracking = [dto.carrier, dto.trackingNumber ? `n° ${dto.trackingNumber}` : null].filter(Boolean).join(' — ');
    await this.notifyStatusChange(order, dto.status, dto.status === OrderStatus.SHIPPED ? (tracking || dto.comment) : dto.comment);

    return this.findById(id);
  }

  async autoConfirmReception(orderId: string, reason: string): Promise<boolean> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.SHIPPED) return false;
    const dto: UpdateOrderStatusDto = { status: OrderStatus.DELIVERED, comment: reason };
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, { id: order.id }, { status: OrderStatus.DELIVERED });
      order.status = OrderStatus.DELIVERED;
      await this.syncDelivery(manager, order, dto);
      await appendOrderHistory(manager, { orderId: order.id, fromStatus: OrderStatus.SHIPPED, toStatus: OrderStatus.DELIVERED, actorRole: 'system', comment: reason });
    });
    await this.settleOnDelivery(order);
    await this.notifyStatusChange(order, OrderStatus.DELIVERED, reason);
    this.logger.log(`Commande ${order.orderNumber} : réception validée automatiquement (${reason})`);
    return true;
  }

  private async syncDelivery(manager: import('typeorm').EntityManager, order: Order, dto: UpdateOrderStatusDto): Promise<void> {
    const target = DELIVERY_STATUS_FOR_ORDER[dto.status];
    const repo = manager.getRepository(Delivery);
    let delivery = await repo.findOne({ where: { orderId: order.id } });
    if (!target && !delivery) return;
    if (!delivery) delivery = repo.create({ orderId: order.id, status: DeliveryStatus.TO_PREPARE });
    if (target) delivery.status = target;
    if (dto.carrier?.trim()) delivery.carrier = dto.carrier.trim();
    if (dto.trackingNumber?.trim()) delivery.trackingNumber = dto.trackingNumber.trim();
    if (dto.deliveryMethod?.trim()) delivery.method = dto.deliveryMethod.trim();
    if (dto.estimatedDeliveryAt) delivery.estimatedDeliveryAt = new Date(dto.estimatedDeliveryAt);
    if (dto.status === OrderStatus.SHIPPED && !delivery.shippedAt) delivery.shippedAt = new Date();
    if (dto.status === OrderStatus.DELIVERED) {
      const now = new Date();
      delivery.deliveredAt = delivery.deliveredAt ?? now;
      delivery.receptionConfirmedAt = now;
    }
    if (dto.comment?.trim()) delivery.note = dto.comment.trim();
    await repo.save(delivery);
  }

  async updateDelivery(id: string, dto: UpdateDeliveryDto, userId: string, userRoles: UserRole[]): Promise<OrderView> {
    const order = await this.findById(id);
    const isAdmin = userRoles.includes(UserRole.ADMIN);
    if (!isAdmin && order.sellerId !== userId) {
      throw new ForbiddenException('Seul le vendeur de la commande peut mettre à jour la livraison');
    }
    if (!isAdmin) await this.shopsService.requireShop(userId);
    if (![OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED].includes(order.status)) {
      throw new BadRequestException('Le suivi de livraison ne peut être modifié que pour une commande confirmée, en préparation ou expédiée');
    }
    if (dto.status && order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('Déclarez d’abord l’expédition de la commande avant de renseigner un événement d’acheminement');
    }
    const hasChange = dto.status || dto.carrier || dto.trackingNumber || dto.estimatedDeliveryAt || dto.deliveryMethod || dto.comment;
    if (!hasChange) throw new BadRequestException('Aucune information de livraison fournie');

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Delivery);
      let delivery = await repo.findOne({ where: { orderId: order.id } });
      if (!delivery) delivery = repo.create({ orderId: order.id, status: DELIVERY_STATUS_FOR_ORDER[order.status] ?? DeliveryStatus.TO_PREPARE });
      const previous = delivery.status;
      if (dto.carrier?.trim()) delivery.carrier = dto.carrier.trim();
      if (dto.trackingNumber?.trim()) delivery.trackingNumber = dto.trackingNumber.trim();
      if (dto.deliveryMethod?.trim()) delivery.method = dto.deliveryMethod.trim();
      if (dto.estimatedDeliveryAt) delivery.estimatedDeliveryAt = new Date(dto.estimatedDeliveryAt);
      if (dto.comment?.trim()) delivery.note = dto.comment.trim();
      if (dto.status) {
        const map: Record<DeliveryEventStatus, DeliveryStatus> = {
          [DeliveryEventStatus.IN_TRANSIT]: DeliveryStatus.IN_TRANSIT,
          [DeliveryEventStatus.DELIVERED]: DeliveryStatus.DELIVERED,
          [DeliveryEventStatus.DELIVERY_FAILED]: DeliveryStatus.DELIVERY_FAILED,
          [DeliveryEventStatus.RETURNED]: DeliveryStatus.RETURNED,
        };
        delivery.status = map[dto.status];
        if (dto.status === DeliveryEventStatus.DELIVERED && !delivery.deliveredAt) delivery.deliveredAt = new Date();
      }
      await repo.save(delivery);
      await appendOrderHistory(manager, {
        orderId: order.id,
        fromStatus: `delivery:${previous}`,
        toStatus: `delivery:${delivery.status}`,
        actorId: userId,
        actorRole: isAdmin ? 'admin' : 'seller',
        comment: dto.comment ?? null,
        metadata: { scope: 'delivery', carrier: delivery.carrier ?? null, trackingNumber: delivery.trackingNumber ?? null, estimatedDeliveryAt: delivery.estimatedDeliveryAt ?? null, method: delivery.method ?? null },
      });
    });

    if (dto.status === DeliveryEventStatus.DELIVERED) {
      await this.notifications?.notify({
        userId: order.buyerId,
        type: 'order.shipped',
        title: 'Colis déclaré livré',
        body: `Le vendeur indique que la commande ${order.orderNumber} vous a été remise. Confirmez la réception pour finaliser la transaction.`,
        link: '/dashboard/client/mes-commandes',
        email: { orderNumber: order.orderNumber, status: 'Livrée (à confirmer)', nextAction: 'Confirmer la réception', actionLabel: 'Voir ma commande' },
      });
    } else if (dto.status === DeliveryEventStatus.DELIVERY_FAILED || dto.status === DeliveryEventStatus.RETURNED) {
      await this.notifications?.notify({
        userId: order.buyerId,
        type: 'order.shipped',
        title: dto.status === DeliveryEventStatus.RETURNED ? 'Colis retourné au vendeur' : 'Échec de livraison',
        body: `Mise à jour de la livraison de la commande ${order.orderNumber}.${dto.comment ? ` ${dto.comment}` : ''} Contactez le vendeur ou signalez un problème si nécessaire.`,
        link: '/dashboard/client/mes-commandes',
        email: { orderNumber: order.orderNumber, status: dto.status === DeliveryEventStatus.RETURNED ? 'Retournée' : 'Échec de livraison', nextAction: 'Contacter le vendeur', actionLabel: 'Voir ma commande' },
      });
    } else if (dto.trackingNumber || dto.carrier) {
      await this.notifications?.notify({
        userId: order.buyerId,
        type: 'order.shipped',
        title: 'Informations de suivi mises à jour',
        body: `Suivi de la commande ${order.orderNumber} : ${[dto.carrier, dto.trackingNumber ? `n° ${dto.trackingNumber}` : null].filter(Boolean).join(' — ')}.`,
        link: '/dashboard/client/mes-commandes',
        email: { orderNumber: order.orderNumber, status: 'Expédiée', nextAction: 'Suivre le colis', actionLabel: 'Voir ma commande' },
      });
    }
    return this.findById(id);
  }

  private async notifyStatusChange(order: Order, status: OrderStatus, comment?: string): Promise<void> {
    if (!this.notifications) return;
    const amount = `${Number(order.totalAmount).toLocaleString('fr-FR')} Ar`;
    const buyerLink = '/dashboard/client/mes-commandes';
    const sellerLink = '/dashboard/vendeur/commandes';
    const byStatus: Partial<Record<OrderStatus, { type: Parameters<NotificationsService['notify']>[0]['type']; buyer?: [string, string, string, string]; seller?: [string, string, string, string] }>> = {
      [OrderStatus.CONFIRMED]: {
        type: 'order.confirmed',
        buyer: ['Commande confirmée', `Le vendeur a accepté votre commande ${order.orderNumber} (${amount}).`, 'Confirmée', 'Le vendeur prépare votre colis'],
        seller: ['Commande confirmée', `Vous avez confirmé la commande ${order.orderNumber}.`, 'Confirmée', 'Préparer le colis'],
      },
      [OrderStatus.PROCESSING]: {
        type: 'order.processing',
        buyer: ['Commande en préparation', `Votre commande ${order.orderNumber} est en cours de préparation.`, 'En préparation', 'Expédition prochaine'],
      },
      [OrderStatus.SHIPPED]: {
        type: 'order.shipped',
        buyer: ['Commande expédiée', `Votre commande ${order.orderNumber} a été expédiée.${comment ? ` Suivi : ${comment}` : ''}`, 'Expédiée', 'Confirmez la réception dès que vous recevez le colis'],
      },
      [OrderStatus.DELIVERED]: {
        type: 'order.delivered',
        buyer: ['Réception confirmée', `Merci ! La réception de la commande ${order.orderNumber} est confirmée.`, 'Livrée', 'Laissez un avis sur le vendeur et le produit'],
        seller: ['Commande livrée — fonds libérés', `La commande ${order.orderNumber} est livrée. Le montant net vous est reversé (${order.sellerNetAmount !== null ? Number(order.sellerNetAmount).toLocaleString('fr-FR') + ' Ar' : amount}).`, 'Livrée', 'Aucune action requise'],
      },
      [OrderStatus.CANCELLED]: {
        type: 'order.cancelled',
        buyer: ['Commande annulée', `La commande ${order.orderNumber} a été annulée.${comment ? ` Motif : ${comment}` : ''} Si elle était payée, le remboursement est en cours.`, 'Annulée', 'Vous pouvez repasser commande à tout moment'],
        seller: ['Commande annulée', `La commande ${order.orderNumber} a été annulée.${comment ? ` Motif : ${comment}` : ''}`, 'Annulée', 'Aucune action requise'],
      },
      [OrderStatus.REFUNDED]: {
        type: 'order.refunded',
        buyer: ['Remboursement effectué', `La commande ${order.orderNumber} a été remboursée.`, 'Remboursée', 'Le montant est recrédité sur votre moyen de paiement'],
        seller: ['Commande remboursée', `La commande ${order.orderNumber} a été remboursée au client.`, 'Remboursée', 'Aucune action requise'],
      },
      [OrderStatus.IN_DISPUTE]: {
        type: 'dispute.created',
        seller: ['Litige ouvert', `Un litige a été ouvert sur la commande ${order.orderNumber}.`, 'En litige', 'Apportez vos éléments de preuve'],
      },
    };
    const entry = byStatus[status];
    if (!entry) return;
    if (entry.buyer) {
      const [title, body, statusLabel, nextAction] = entry.buyer;
      await this.notifications.notify({ userId: order.buyerId, type: entry.type, title, body, link: buyerLink, email: { orderNumber: order.orderNumber, status: statusLabel, nextAction, actionLabel: 'Voir ma commande' } });
    }
    if (entry.seller) {
      const [title, body, statusLabel, nextAction] = entry.seller;
      await this.notifications.notify({ userId: order.sellerId, type: entry.type, title, body, link: sellerLink, email: { orderNumber: order.orderNumber, status: statusLabel, nextAction, actionLabel: 'Voir la commande' } });
    }
  }

  private async isOrderPayable(orderId: string): Promise<boolean> {
    const payments = await this.paymentRepository.find({ where: { orderId } });
    return payments.some(
      (p) =>
        [PaymentStatus.SUCCESS, PaymentStatus.ESCROW, PaymentStatus.RELEASED].includes(p.status) ||
        (p.method === 'cash_on_delivery' && p.status !== PaymentStatus.CANCELLED && p.status !== PaymentStatus.FAILED),
    );
  }

  private async restoreStock(orderId: string): Promise<void> {
    const lines = await this.orderLineRepository.find({ where: { orderId } });
    for (const line of lines) {
      await this.productRepository.increment({ id: line.productId }, 'stockQuantity', line.quantity);
    }
  }

  private async settleOnDelivery(order: Order): Promise<void> {
    const lines = await this.orderLineRepository.find({ where: { orderId: order.id } });
    for (const line of lines) {
      await this.productRepository.increment({ id: line.productId }, 'salesCount', line.quantity);
    }

    const escrow = await this.escrowRepository.findOne({ where: { orderId: order.id } });
    if (escrow && !escrow.releasedAt && !escrow.isBlocked) {
      escrow.releasedAt = new Date();
      escrow.releasedTo = order.sellerId;
      await this.escrowRepository.save(escrow);
      await this.paymentRepository.update({ id: escrow.paymentId }, { status: PaymentStatus.RELEASED });
      this.logger.log(`Escrow ${escrow.id}: ${escrow.amount} Ar libérés au vendeur ${order.sellerId}`);
    }

    await this.paymentRepository.update(
      { orderId: order.id, method: 'cash_on_delivery', status: PaymentStatus.PENDING },
      { status: PaymentStatus.SUCCESS, paidAt: new Date() },
    );

    void Promise.all([this.badges?.evaluateUser(order.sellerId), this.badges?.evaluateUser(order.buyerId)]).catch(() => undefined);
  }

  private async refundEscrow(order: Order, reason: string): Promise<void> {
    const escrow = await this.escrowRepository.findOne({ where: { orderId: order.id } });
    if (!escrow || escrow.releasedAt) return;
    escrow.releasedAt = new Date();
    escrow.releasedTo = order.buyerId;
    escrow.isBlocked = false;
    escrow.reason = escrow.reason ?? `Remboursement acheteur (${reason})`;
    await this.escrowRepository.save(escrow);
    await this.paymentRepository.update({ id: escrow.paymentId }, { status: PaymentStatus.REFUNDED });
    this.logger.log(`Escrow ${escrow.id}: ${escrow.amount} Ar remboursés à l'acheteur ${order.buyerId}`);
  }

  async getSellerStats(sellerId: string) {
    const totalOrders = await this.orderRepository.count({ where: { sellerId } });
    const pendingOrders = await this.orderRepository.count({
      where: { sellerId, status: OrderStatus.PENDING },
    });
    const processingOrders = await this.orderRepository.count({
      where: { sellerId, status: OrderStatus.PROCESSING },
    });
    const shippedOrders = await this.orderRepository.count({
      where: { sellerId, status: OrderStatus.SHIPPED },
    });
    const deliveredOrders = await this.orderRepository.count({
      where: { sellerId, status: OrderStatus.DELIVERED },
    });
    const cancelledOrders = await this.orderRepository.count({
      where: { sellerId, status: OrderStatus.CANCELLED },
    });

    const revenueResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.sellerId = :sellerId', { sellerId })
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne();

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: revenueResult?.total ? parseFloat(revenueResult.total) : 0,
    };
  }

  async getBuyerStats(buyerId: string) {
    const totalOrders = await this.orderRepository.count({ where: { buyerId } });
    const activeOrders = await this.orderRepository.count({
      where: { buyerId, status: OrderStatus.CONFIRMED },
    });
    const deliveredOrders = await this.orderRepository.count({
      where: { buyerId, status: OrderStatus.DELIVERED },
    });

    const totalSpentResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.buyerId = :buyerId', { buyerId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.DELIVERED, OrderStatus.SHIPPED, OrderStatus.CONFIRMED],
      })
      .getRawOne();

    return {
      totalOrders,
      activeOrders,
      deliveredOrders,
      totalSpent: totalSpentResult?.total ? parseFloat(totalSpentResult.total) : 0,
    };
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `TS-${dateStr}-${random}`;

    const existing = await this.orderRepository.findOne({ where: { orderNumber } });
    if (existing) {
      return this.generateOrderNumber();
    }

    return orderNumber;
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.IN_DISPUTE],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED, OrderStatus.IN_DISPUTE],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.IN_DISPUTE]: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.DELIVERED, OrderStatus.CONFIRMED],
    };

    if (!transitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Transition de statut invalide: ${currentStatus} → ${newStatus}`
      );
    }
  }
}
