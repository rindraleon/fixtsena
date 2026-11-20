import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Order, Payment, Dispute, OrderLine } from '../../database/entities/transaction.entity';
import { DisputeStatus, OrderStatus, PaymentStatus, UserRole } from '../../database/entities/role.enum';
import { csvFilename, toCsv, type CsvColumn, type ReportPeriod, type ReportType } from './reports.util';

const SETTLED_PAYMENT_STATUSES = [PaymentStatus.SUCCESS, PaymentStatus.ESCROW, PaymentStatus.RELEASED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.BLOCKED];
const DECIDED_DISPUTE_STATUSES = [DisputeStatus.RESOLVED_BUYER, DisputeStatus.RESOLVED_SELLER, DisputeStatus.PARTIAL_RESOLUTION, DisputeStatus.CLOSED];

export interface PeriodReport {
  period: { from: string; to: string; days: number };
  orders: { count: number; byStatus: Record<string, number>; grossAmount: number; averageBasket: number; delivered: number; cancelled: number; refunded: number };
  revenue: { gross: number; commission: number; sellerNet: number; shipping: number };
  payments: { count: number; settled: number; amount: number; byMethod: Array<{ method: string; count: number; amount: number }> };
  refunds: { count: number; amount: number };
  disputes: { opened: number; decided: number; byReason: Array<{ reasonCode: string; count: number }> };
  users: { newUsers: number; newSellers: number };
  topSellers: Array<{ sellerId: string; name: string; email: string | null; orders: number; amount: number; commission: number }>;
  topCategories: Array<{ categoryId: string; name: string; quantity: number; amount: number }>;
}

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Dispute) private readonly disputeRepository: Repository<Dispute>,
  ) {}

  async periodReport(period: ReportPeriod): Promise<PeriodReport> {
    const { from, to } = period;
    const manager = this.orderRepository.manager;

    const statusRows = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'amount')
      .where('o.createdAt >= :from AND o.createdAt < :to', { from, to })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string; amount: string }>();
    const byStatus: Record<string, number> = {};
    let orderCount = 0;
    let grossAmount = 0;
    for (const row of statusRows) {
      byStatus[row.status] = num(row.count);
      orderCount += num(row.count);
      if (row.status !== OrderStatus.CANCELLED) grossAmount += num(row.amount);
    }

    const revenueRow = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'gross')
      .addSelect('COALESCE(SUM(o.commissionAmount), 0)', 'commission')
      .addSelect('COALESCE(SUM(o.sellerNetAmount), 0)', 'sellerNet')
      .addSelect('COALESCE(SUM(o.shippingAmount), 0)', 'shipping')
      .where('o.createdAt >= :from AND o.createdAt < :to', { from, to })
      .andWhere('o.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne<{ gross: string; commission: string; sellerNet: string; shipping: string }>();

    const paymentRows = await this.paymentRepository
      .createQueryBuilder('p')
      .select("COALESCE(p.method, 'inconnu')", 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .where('p.createdAt >= :from AND p.createdAt < :to', { from, to })
      .andWhere('p.status IN (:...settled)', { settled: SETTLED_PAYMENT_STATUSES })
      .groupBy('p.method')
      .orderBy('amount', 'DESC')
      .getRawMany<{ method: string; count: string; amount: string }>();
    const paymentsTotal = await this.paymentRepository.count({ where: { createdAt: Between(from, to) } });
    const byMethod = paymentRows.map((r) => ({ method: r.method, count: num(r.count), amount: num(r.amount) }));

    const refundRow = await this.orderRepository
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.refundedAmount), 0)', 'amount')
      .where('o.refundedAmount > 0')
      .andWhere('o.updatedAt >= :from AND o.updatedAt < :to', { from, to })
      .getRawOne<{ count: string; amount: string }>();

    const opened = await this.disputeRepository.count({ where: { createdAt: Between(from, to) } });
    const decided = await this.disputeRepository.count({ where: { resolvedAt: Between(from, to), status: In(DECIDED_DISPUTE_STATUSES) } });
    const reasonRows = await this.disputeRepository
      .createQueryBuilder('d')
      .select("COALESCE(CAST(d.reasonCode AS text), 'other')", 'reasonCode')
      .addSelect('COUNT(*)', 'count')
      .where('d.createdAt >= :from AND d.createdAt < :to', { from, to })
      .groupBy('d.reasonCode')
      .orderBy('count', 'DESC')
      .getRawMany<{ reasonCode: string; count: string }>();

    const newUsers = await this.userRepository.count({ where: { createdAt: Between(from, to) } });
    const newSellers = await this.userRepository
      .createQueryBuilder('u')
      .where('u.createdAt >= :from AND u.createdAt < :to', { from, to })
      .andWhere(':role = ANY(string_to_array(u.roles, \',\'))', { role: UserRole.SELLER })
      .getCount()
      .catch(() => 0);

    const topSellersRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'amount')
      .addSelect("COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.commissionAmount ELSE 0 END), 0)", 'commission')
      .where('o.createdAt >= :from AND o.createdAt < :to', { from, to })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('o.sellerId')
      .orderBy('amount', 'DESC')
      .limit(10)
      .getRawMany<{ sellerId: string; orders: string; amount: string; commission: string }>();
    const sellerIds = topSellersRaw.map((r) => r.sellerId);
    const sellers = sellerIds.length ? await this.userRepository.find({ where: { id: In(sellerIds) }, select: ['id', 'firstName', 'lastName', 'email'], withDeleted: true }) : [];
    const sellerById = new Map(sellers.map((u) => [u.id, u]));
    const topSellers = topSellersRaw.map((r) => {
      const u = sellerById.get(r.sellerId);
      return { sellerId: r.sellerId, name: u ? `${u.firstName} ${u.lastName ?? ''}`.trim() : 'Vendeur', email: u?.email ?? null, orders: num(r.orders), amount: num(r.amount), commission: num(r.commission) };
    });

    const topCategoriesRaw = await manager
      .getRepository(OrderLine)
      .createQueryBuilder('line')
      .innerJoin(Order, 'o', 'o.id = line.orderId')
      .innerJoin(Product, 'p', 'p.id = line.productId')
      .select('p.categoryId', 'categoryId')
      .addSelect('COALESCE(SUM(line.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(line.totalPrice), 0)', 'amount')
      .where('o.createdAt >= :from AND o.createdAt < :to', { from, to })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('p.categoryId')
      .orderBy('amount', 'DESC')
      .limit(10)
      .getRawMany<{ categoryId: string; quantity: string; amount: string }>();
    const categoryIds = topCategoriesRaw.map((r) => r.categoryId).filter(Boolean);
    const categories = categoryIds.length
      ? await manager.query<Array<{ id: string; name: string }>>(`SELECT id, name FROM categories WHERE id = ANY($1)`, [categoryIds]).catch(() => [] as Array<{ id: string; name: string }>)
      : [];
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const topCategories = topCategoriesRaw.map((r) => ({ categoryId: r.categoryId, name: categoryById.get(r.categoryId) ?? 'Catégorie', quantity: num(r.quantity), amount: num(r.amount) }));

    return {
      period: { from: period.fromLabel, to: period.toLabel, days: period.days },
      orders: {
        count: orderCount,
        byStatus,
        grossAmount,
        averageBasket: orderCount - (byStatus[OrderStatus.CANCELLED] ?? 0) > 0 ? Math.round(grossAmount / (orderCount - (byStatus[OrderStatus.CANCELLED] ?? 0))) : 0,
        delivered: byStatus[OrderStatus.DELIVERED] ?? 0,
        cancelled: byStatus[OrderStatus.CANCELLED] ?? 0,
        refunded: byStatus[OrderStatus.REFUNDED] ?? 0,
      },
      revenue: { gross: num(revenueRow?.gross), commission: num(revenueRow?.commission), sellerNet: num(revenueRow?.sellerNet), shipping: num(revenueRow?.shipping) },
      payments: { count: paymentsTotal, settled: byMethod.reduce((acc, m) => acc + m.count, 0), amount: byMethod.reduce((acc, m) => acc + m.amount, 0), byMethod },
      refunds: { count: num(refundRow?.count), amount: num(refundRow?.amount) },
      disputes: { opened, decided, byReason: reasonRows.map((r) => ({ reasonCode: r.reasonCode, count: num(r.count) })) },
      users: { newUsers, newSellers },
      topSellers,
      topCategories,
    };
  }

  async exportCsv(type: ReportType, period: ReportPeriod): Promise<{ filename: string; content: string; rows: number }> {
    const { from, to } = period;
    const filename = csvFilename(type, period);
    const userLabel = (u?: Pick<User, 'firstName' | 'lastName' | 'email'> | null) => (u ? `${u.firstName} ${u.lastName ?? ''}`.trim() : '');

    if (type === 'orders' || type === 'commissions') {
      const orders = await this.orderRepository
        .createQueryBuilder('o')
        .where('o.createdAt >= :from AND o.createdAt < :to', { from, to })
        .orderBy('o.createdAt', 'ASC')
        .limit(20_000)
        .getMany();
      const userIds = Array.from(new Set(orders.flatMap((o) => [o.buyerId, o.sellerId])));
      const users = userIds.length ? await this.userRepository.find({ where: { id: In(userIds) }, select: ['id', 'firstName', 'lastName', 'email'], withDeleted: true }) : [];
      const userById = new Map(users.map((u) => [u.id, u]));
      const columns: CsvColumn<Order>[] =
        type === 'orders'
          ? [
              { header: 'Numéro', value: (o) => o.orderNumber },
              { header: 'Date', value: (o) => o.createdAt },
              { header: 'Statut', value: (o) => o.status },
              { header: 'Acheteur', value: (o) => userLabel(userById.get(o.buyerId)) },
              { header: 'E-mail acheteur', value: (o) => userById.get(o.buyerId)?.email ?? '' },
              { header: 'Vendeur', value: (o) => userLabel(userById.get(o.sellerId)) },
              { header: 'E-mail vendeur', value: (o) => userById.get(o.sellerId)?.email ?? '' },
              { header: 'Sous-total (Ar)', value: (o) => num(o.subtotalAmount) },
              { header: 'Livraison (Ar)', value: (o) => num(o.shippingAmount) },
              { header: 'Total (Ar)', value: (o) => num(o.totalAmount) },
              { header: 'Zone de livraison', value: (o) => o.deliveryZoneName ?? '' },
              { header: 'Remboursé (Ar)', value: (o) => (o.refundedAmount == null ? '' : num(o.refundedAmount)) },
              { header: 'Ville de livraison', value: (o) => o.shippingAddress?.city ?? '' },
            ]
          : [
              { header: 'Numéro', value: (o) => o.orderNumber },
              { header: 'Date', value: (o) => o.createdAt },
              { header: 'Statut', value: (o) => o.status },
              { header: 'Vendeur', value: (o) => userLabel(userById.get(o.sellerId)) },
              { header: 'E-mail vendeur', value: (o) => userById.get(o.sellerId)?.email ?? '' },
              { header: 'Palier', value: (o) => o.commissionTier ?? '' },
              { header: 'Taux (%)', value: (o) => (o.commissionRate == null ? '' : num(o.commissionRate)) },
              { header: 'Sous-total (Ar)', value: (o) => num(o.subtotalAmount) },
              { header: 'Commission (Ar)', value: (o) => (o.commissionAmount == null ? '' : num(o.commissionAmount)) },
              { header: 'Net vendeur (Ar)', value: (o) => (o.sellerNetAmount == null ? '' : num(o.sellerNetAmount)) },
              { header: 'Remboursé (Ar)', value: (o) => (o.refundedAmount == null ? '' : num(o.refundedAmount)) },
              { header: 'Commission acquise', value: (o) => o.status === OrderStatus.DELIVERED },
            ];
      return { filename, content: toCsv(orders, columns), rows: orders.length };
    }

    if (type === 'payments') {
      const payments = await this.paymentRepository
        .createQueryBuilder('p')
        .where('p.createdAt >= :from AND p.createdAt < :to', { from, to })
        .orderBy('p.createdAt', 'ASC')
        .limit(20_000)
        .getMany();
      const orderIds = Array.from(new Set(payments.map((p) => p.orderId)));
      const orders = orderIds.length ? await this.orderRepository.find({ where: { id: In(orderIds) }, select: ['id', 'orderNumber', 'buyerId', 'sellerId'], withDeleted: true }) : [];
      const orderById = new Map(orders.map((o) => [o.id, o]));
      const columns: CsvColumn<Payment>[] = [
        { header: 'Référence', value: (p) => p.transactionId },
        { header: 'Date', value: (p) => p.createdAt },
        { header: 'Commande', value: (p) => orderById.get(p.orderId)?.orderNumber ?? '' },
        { header: 'Moyen', value: (p) => p.method ?? '' },
        { header: 'Montant (Ar)', value: (p) => num(p.amount) },
        { header: 'Statut', value: (p) => p.status },
        { header: 'Payé le', value: (p) => p.paidAt ?? '' },
      ];
      return { filename, content: toCsv(payments, columns), rows: payments.length };
    }

    const disputes = await this.disputeRepository
      .createQueryBuilder('d')
      .where('d.createdAt >= :from AND d.createdAt < :to', { from, to })
      .orderBy('d.createdAt', 'ASC')
      .limit(20_000)
      .getMany();
    const orderIds = Array.from(new Set(disputes.map((d) => d.orderId)));
    const orders = orderIds.length ? await this.orderRepository.find({ where: { id: In(orderIds) }, select: ['id', 'orderNumber', 'refundedAmount', 'totalAmount'], withDeleted: true }) : [];
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const columns: CsvColumn<Dispute>[] = [
      { header: 'Identifiant', value: (d) => d.id },
      { header: 'Date', value: (d) => d.createdAt },
      { header: 'Commande', value: (d) => orderById.get(d.orderId)?.orderNumber ?? '' },
      { header: 'Motif', value: (d) => d.reasonCode ?? 'other' },
      { header: 'Description', value: (d) => d.reason },
      { header: 'Statut', value: (d) => d.status },
      { header: 'Décidé le', value: (d) => d.resolvedAt ?? '' },
      { header: 'Décision', value: (d) => d.adminDecision ?? '' },
      { header: 'Montant commande (Ar)', value: (d) => num(orderById.get(d.orderId)?.totalAmount) },
      { header: 'Remboursé (Ar)', value: (d) => { const o = orderById.get(d.orderId); return o?.refundedAmount == null ? '' : num(o.refundedAmount); } },
    ];
    return { filename, content: toCsv(disputes, columns), rows: disputes.length };
  }
}
