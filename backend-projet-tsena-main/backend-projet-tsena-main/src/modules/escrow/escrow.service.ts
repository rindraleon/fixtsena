import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Repository } from 'typeorm';
import { Escrow, Payment, Order } from '../../database/entities/transaction.entity';
import { PaymentStatus, OrderStatus, UserRole } from '../../database/entities/role.enum';
import { appendOrderHistory } from '../orders/order-history';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async findByOrderId(orderId: string, userId?: string, userRoles: UserRole[] = []) {
    const escrow = await this.escrowRepository.findOne({
      where: { orderId },
    });

    if (!escrow) {
      throw new NotFoundException('Aucun séquestre trouvé pour cette commande');
    }

    if (userId) await this.assertCanAccess(escrow, userId, userRoles);
    return escrow;
  }

  private async assertCanAccess(escrow: Escrow, userId: string, userRoles: UserRole[]): Promise<void> {
    if (userRoles.includes(UserRole.ADMIN)) return;
    const order = await this.orderRepository.findOne({ where: { id: escrow.orderId } });
    if (!order || (order.buyerId !== userId && order.sellerId !== userId)) {
      throw new ForbiddenException("Vous n'avez pas accès à ce séquestre");
    }
  }

  async findByPaymentId(paymentId: string) {
    return await this.escrowRepository.findOne({
      where: { paymentId },
    });
  }

  async findById(id: string, userId?: string, userRoles: UserRole[] = []) {
    const escrow = await this.escrowRepository.findOne({
      where: { id },
    });

    if (!escrow) {
      throw new NotFoundException('Séquestre non trouvé');
    }

    if (userId) await this.assertCanAccess(escrow, userId, userRoles);
    return escrow;
  }

  async releaseFunds(escrowId: string, userId: string, userRoles: UserRole[]) {
    const escrow = await this.findById(escrowId);

    if (escrow.releasedAt) {
      throw new BadRequestException('Les fonds ont déjà été libérés');
    }

    if (escrow.isBlocked) {
      throw new BadRequestException('Les fonds sont bloqués (litige en cours)');
    }

    const order = await this.orderRepository.findOne({
      where: { id: escrow.orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande associée non trouvée');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Les fonds ne peuvent être libérés qu\'après livraison confirmée');
    }

    if (!userRoles.includes(UserRole.ADMIN) && order.buyerId !== userId) {
      throw new BadRequestException('Seul l\'acheteur ou un admin peut libérer les fonds');
    }

    escrow.releasedAt = new Date();
    escrow.releasedTo = userRoles.includes(UserRole.ADMIN) ? order.sellerId : order.sellerId;
    await this.escrowRepository.save(escrow);

    const payment = await this.paymentRepository.findOne({
      where: { id: escrow.paymentId },
    });

    if (payment) {
      payment.status = PaymentStatus.RELEASED;
      await this.paymentRepository.save(payment);
    }

    this.logger.log(
      `Escrow ${escrow.id}: ${escrow.amount} Ar libérés vers vendeur ${order.sellerId}`
    );

    await this.notifications?.notify({
      userId: order.sellerId,
      type: 'order.funds_released',
      title: `Fonds libérés — commande ${order.orderNumber}`,
      body: `${Number(escrow.amount).toLocaleString('fr-FR')} Ar ont été libérés du séquestre${order.sellerNetAmount !== null ? ` (net vendeur : ${Number(order.sellerNetAmount).toLocaleString('fr-FR')} Ar après commission)` : ''}.`,
      link: '/dashboard/vendeur/revenus',
      email: { orderNumber: order.orderNumber, status: 'Fonds libérés', nextAction: 'Aucune action requise', actionLabel: 'Voir mes revenus' },
    });

    return escrow;
  }

  async blockFunds(escrowId: string, reason: string, userId: string, userRoles: UserRole[]) {
    const escrow = await this.findById(escrowId);

    if (escrow.isBlocked) {
      throw new BadRequestException('Les fonds sont déjà bloqués');
    }

    if (escrow.releasedAt) {
      throw new BadRequestException('Les fonds ont déjà été libérés, impossible de les bloquer');
    }

    if (!userRoles.includes(UserRole.ADMIN)) {
      throw new BadRequestException('Seul un admin peut bloquer les fonds');
    }

    escrow.isBlocked = true;
    escrow.reason = reason;
    await this.escrowRepository.save(escrow);

    const payment = await this.paymentRepository.findOne({
      where: { id: escrow.paymentId },
    });

    if (payment) {
      payment.status = PaymentStatus.BLOCKED;
      await this.paymentRepository.save(payment);
    }

    this.logger.log(`Escrow ${escrow.id}: fonds bloqués - ${reason}`);

    return escrow;
  }

  async unblockFunds(escrowId: string, userId: string, userRoles: UserRole[]) {
    if (!userRoles.includes(UserRole.ADMIN)) {
      throw new BadRequestException('Seul un admin peut débloquer les fonds');
    }

    const escrow = await this.findById(escrowId);

    if (!escrow.isBlocked) {
      throw new BadRequestException('Les fonds ne sont pas bloqués');
    }

    escrow.isBlocked = false;
    escrow.reason = undefined;
    await this.escrowRepository.save(escrow);

    const payment = await this.paymentRepository.findOne({
      where: { id: escrow.paymentId },
    });

    if (payment) {
      payment.status = PaymentStatus.SUCCESS;
      await this.paymentRepository.save(payment);
    }

    this.logger.log(`Escrow ${escrow.id}: fonds débloqués`);

    return escrow;
  }

  async refundBuyer(escrowId: string, userId: string, userRoles: UserRole[]) {
    if (!userRoles.includes(UserRole.ADMIN)) {
      throw new BadRequestException('Seul un admin peut initier un remboursement');
    }

    const escrow = await this.findById(escrowId);

    if (escrow.releasedAt) {
      throw new BadRequestException('Les fonds ont déjà été libérés au vendeur');
    }

    const order = await this.orderRepository.findOne({ where: { id: escrow.orderId } });
    if (!order) {
      throw new NotFoundException('Commande associée non trouvée');
    }
    escrow.releasedAt = new Date();
    escrow.releasedTo = order.buyerId;
    escrow.isBlocked = false;
    await this.escrowRepository.save(escrow);

    const payment = await this.paymentRepository.findOne({
      where: { id: escrow.paymentId },
    });

    if (payment) {
      payment.status = PaymentStatus.REFUNDED;
      await this.paymentRepository.save(payment);
    }

    if (order && order.status !== OrderStatus.REFUNDED) {
      const previous = order.status;
      order.status = OrderStatus.REFUNDED;
      await this.orderRepository.save(order);
      await appendOrderHistory(this.orderRepository.manager, {
        orderId: order.id,
        fromStatus: previous,
        toStatus: OrderStatus.REFUNDED,
        actorRole: 'admin',
        comment: 'Remboursement du séquestre',
        metadata: { escrowId: escrow.id, amount: Number(escrow.amount) },
      }).catch(() => undefined);
    }

    this.logger.log(`Escrow ${escrow.id}: remboursement de ${escrow.amount} Ar`);

    await this.notifications?.notify({
      userId: order.buyerId,
      type: 'order.refunded',
      title: `Remboursement — commande ${order.orderNumber}`,
      body: `${Number(escrow.amount).toLocaleString('fr-FR')} Ar vous sont remboursés.`,
      link: '/dashboard/client/mes-commandes',
      email: { orderNumber: order.orderNumber, status: 'Remboursée', nextAction: 'Le montant est recrédité sur votre moyen de paiement', actionLabel: 'Voir ma commande' },
    });
    await this.notifications?.notify({
      userId: order.sellerId,
      type: 'order.refunded',
      title: `Commande ${order.orderNumber} remboursée`,
      body: `Le séquestre de ${Number(escrow.amount).toLocaleString('fr-FR')} Ar a été restitué à l'acheteur.`,
      link: '/dashboard/vendeur/commandes',
      email: { orderNumber: order.orderNumber, status: 'Remboursée' },
    });

    return escrow;
  }

  async getStats() {
    const totalEscrows = await this.escrowRepository.count();
    const totalHeld = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.releasedAt IS NULL')
      .andWhere('escrow.isBlocked = false')
      .getRawOne();

    const blockedAmount = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.isBlocked = true')
      .getRawOne();

    const releasedAmount = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('SUM(escrow.amount)', 'total')
      .where('escrow.releasedAt IS NOT NULL')
      .getRawOne();

    return {
      totalEscrows,
      totalHeld: totalHeld?.total ? parseFloat(totalHeld.total) : 0,
      blockedAmount: blockedAmount?.total ? parseFloat(blockedAmount.total) : 0,
      releasedAmount: releasedAmount?.total ? parseFloat(releasedAmount.total) : 0,
    };
  }
}
