import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Repository } from 'typeorm';
import { Payment, Escrow, Order } from '../../database/entities/transaction.entity';
import { InitiatePaymentDto, PaymentCallbackDto, FilterPaymentDto } from './dto/payment.dto';
import { PaymentStatus, OrderStatus, UserRole } from '../../database/entities/role.enum';
import { appendOrderHistory } from '../orders/order-history';

export const CASH_ON_DELIVERY = 'cash_on_delivery';

const SETTLED_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.ESCROW,
  PaymentStatus.RELEASED,
];
const IN_PROGRESS_STATUSES: PaymentStatus[] = [
  PaymentStatus.INITIATED,
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
];

export interface PaymentViewer {
  id: string;
  roles: UserRole[];
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private async notifyPayment(
    payment: Payment,
    type: 'order.payment_initiated' | 'order.payment_success' | 'order.payment_failed' | 'order.escrow_held',
    title: string,
    body: string,
    statusLabel: string,
    nextAction: string,
  ): Promise<void> {
    if (!this.notifications) return;
    const order = await this.orderRepository.findOne({ where: { id: payment.orderId } });
    if (!order) return;
    await this.notifications.notify({
      userId: order.buyerId,
      type,
      title,
      body,
      link: '/dashboard/client/mes-commandes',
      email: { orderNumber: order.orderNumber, status: statusLabel, nextAction, actionLabel: 'Voir ma commande' },
    });
    if (type === 'order.payment_success' || type === 'order.escrow_held') {
      await this.notifications.notify({
        userId: order.sellerId,
        type: 'order.confirmed',
        title: `Paiement reçu — commande ${order.orderNumber}`,
        body: `Le paiement de la commande ${order.orderNumber} est confirmé${payment.method === CASH_ON_DELIVERY ? ' (paiement à la livraison)' : ' et sécurisé en séquestre'}. Vous pouvez préparer le colis.`,
        link: '/dashboard/vendeur/commandes',
        email: { orderNumber: order.orderNumber, status: 'Payée', nextAction: 'Confirmer puis préparer la commande', actionLabel: 'Voir la commande' },
      });
    }
  }

  async initiatePayment(buyerId: string, dto: InitiatePaymentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId, buyerId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La commande n\'est pas en attente de paiement');
    }

    const existingPayments = await this.paymentRepository.find({
      where: { orderId: dto.orderId },
      order: { createdAt: 'DESC' },
    });

    if (existingPayments.some((p) => SETTLED_STATUSES.includes(p.status))) {
      throw new ConflictException('Cette commande a déjà été payée');
    }

    const inProgress = existingPayments.find((p) => IN_PROGRESS_STATUSES.includes(p.status));
    if (inProgress && inProgress.method === dto.method) {
      return { payment: inProgress, paymentUrl: null };
    }

    if (inProgress) {
      inProgress.status = PaymentStatus.CANCELLED;
      await this.paymentRepository.save(inProgress);
    }

    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const isCashOnDelivery = dto.method === CASH_ON_DELIVERY;

    const payment = this.paymentRepository.create({
      transactionId,
      orderId: dto.orderId,
      amount: order.totalAmount,
      status: isCashOnDelivery ? PaymentStatus.PENDING : PaymentStatus.INITIATED,
      method: dto.method,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    this.logger.log(`Paiement initié: ${transactionId} (${dto.method}) pour commande ${order.orderNumber}`);

    if (isCashOnDelivery) {
      await this.notifyPayment(
        savedPayment,
        'order.payment_initiated',
        `Paiement à la livraison — commande ${order.orderNumber}`,
        `Vous réglerez ${Number(savedPayment.amount).toLocaleString('fr-FR')} Ar à la réception. Le vendeur va confirmer votre commande.`,
        'Paiement à la livraison',
        'Attendre la confirmation du vendeur',
      );
    } else {
      await this.notifyPayment(
        savedPayment,
        'order.payment_initiated',
        `Paiement initié — commande ${order.orderNumber}`,
        `Un paiement ${dto.method.replace('_', ' ')} de ${Number(savedPayment.amount).toLocaleString('fr-FR')} Ar a été initié (réf. ${transactionId}).`,
        'Paiement en cours',
        'Valider le paiement sur votre téléphone',
      );
    }

    return {
      payment: savedPayment,
      paymentUrl: null,
    };
  }

  async handlePaymentCallback(dto: PaymentCallbackDto) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: dto.transactionId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    const providerStatuses = [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.PENDING];
    if (!providerStatuses.includes(dto.status)) {
      throw new BadRequestException('Statut de paiement non accepté depuis le provider');
    }

    if (payment.status !== PaymentStatus.INITIATED && payment.status !== PaymentStatus.PENDING) {
      if (payment.status === dto.status || (payment.status === PaymentStatus.ESCROW && dto.status === PaymentStatus.SUCCESS)) {
        return payment;
      }
      throw new BadRequestException('Ce paiement ne peut pas être mis à jour');
    }

    payment.status = dto.status;
    payment.providerResponse = dto.providerResponse;

    if (dto.status === PaymentStatus.SUCCESS) {
      payment.paidAt = new Date();
    }

    await this.paymentRepository.save(payment);

    if (dto.status === PaymentStatus.SUCCESS) {
      await this.createEscrowFromPayment(payment);
      this.logger.log(`Paiement réussi: ${dto.transactionId}, escrow créé`);
    } else if (dto.status === PaymentStatus.FAILED || dto.status === PaymentStatus.CANCELLED) {
      await this.notifyPayment(
        payment,
        'order.payment_failed',
        'Paiement non abouti',
        `Le paiement ${payment.transactionId} n'a pas abouti. Vous pouvez relancer le paiement depuis votre commande.`,
        'Paiement échoué',
        'Relancer le paiement',
      );
    }

    return payment;
  }

  async simulatePaymentSuccess(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.paidAt = new Date();
    payment.providerResponse = JSON.stringify({ simulated: true, timestamp: new Date() });
    await this.paymentRepository.save(payment);

    await this.createEscrowFromPayment(payment);

    this.logger.log(`Paiement simulé réussi: ${payment.transactionId}`);
    return payment;
  }

  private async createEscrowFromPayment(payment: Payment): Promise<Escrow | null> {
    if (payment.method === CASH_ON_DELIVERY) {
      await this.confirmOrderAfterPayment(payment);
      await this.notifyPayment(
        payment,
        'order.payment_success',
        'Paiement enregistré',
        `Le paiement de ${Number(payment.amount).toLocaleString('fr-FR')} Ar est enregistré.`,
        'Payée',
        'Le vendeur prépare votre commande',
      );
      return null;
    }

    const existingEscrow = await this.escrowRepository.findOne({
      where: { paymentId: payment.id },
    });

    if (existingEscrow) {
      return existingEscrow;
    }

    const escrow = this.escrowRepository.create({
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      isBlocked: false,
    });

    const savedEscrow = await this.escrowRepository.save(escrow);
    await this.confirmOrderAfterPayment(payment);
    await this.notifyPayment(
      payment,
      'order.escrow_held',
      'Paiement confirmé et sécurisé',
      `Votre paiement de ${Number(payment.amount).toLocaleString('fr-FR')} Ar est confirmé et conservé en séquestre jusqu'à la confirmation de réception.`,
      'Payée — fonds en séquestre',
      'Le vendeur prépare votre commande',
    );

    return savedEscrow;
  }

  private async confirmOrderAfterPayment(payment: Payment): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: payment.orderId } });
    if (order && order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.CONFIRMED;
      await this.orderRepository.save(order);
      await appendOrderHistory(this.orderRepository.manager, {
        orderId: order.id,
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CONFIRMED,
        actorRole: 'system',
        comment: `Paiement confirmé (${payment.method}, réf. ${payment.transactionId})`,
        metadata: { paymentId: payment.id, transactionId: payment.transactionId },
      }).catch(() => undefined);
      this.logger.log(`Commande ${order.orderNumber} confirmée (paiement ${payment.transactionId})`);
    }
  }

  async findById(id: string, viewer?: PaymentViewer) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    if (viewer) await this.assertCanViewOrder(payment.orderId, viewer);
    return payment;
  }

  async findByTransactionId(transactionId: string, viewer?: PaymentViewer) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    if (viewer) await this.assertCanViewOrder(payment.orderId, viewer);
    return payment;
  }

  async findByOrderId(orderId: string, viewer?: PaymentViewer) {
    if (viewer) await this.assertCanViewOrder(orderId, viewer);
    return await this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  private async assertCanViewOrder(orderId: string, viewer: PaymentViewer) {
    if (viewer.roles.includes(UserRole.ADMIN)) return;
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (order.buyerId !== viewer.id && order.sellerId !== viewer.id) {
      throw new ForbiddenException('Vous n\'avez pas la permission de consulter ce paiement');
    }
  }

  async findAll(filters: FilterPaymentDto) {
    const { status, orderId, page = 1, limit = 20 } = filters;

    const qb = this.paymentRepository.createQueryBuilder('payment');

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }
    if (orderId) {
      qb.andWhere('payment.orderId = :orderId', { orderId });
    }

    qb.orderBy('payment.createdAt', 'DESC');

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

  async confirmPayment(paymentId: string) {
    const payment = await this.findById(paymentId);

    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.INITIATED) {
      throw new BadRequestException('Ce paiement ne peut pas être confirmé');
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.paidAt = new Date();
    payment.providerResponse = JSON.stringify({ confirmedByAdmin: true, timestamp: new Date() });
    await this.paymentRepository.save(payment);

    await this.createEscrowFromPayment(payment);

    this.logger.log(`Paiement confirmé manuellement: ${payment.transactionId}`);
    return payment;
  }

  async getStats() {
    const totalPayments = await this.paymentRepository.count();
    const successfulPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.SUCCESS },
    });
    const failedPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.FAILED },
    });
    const pendingPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.PENDING },
    });

    const totalRevenueResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
      .getRawOne();

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      pendingPayments,
      totalRevenue: totalRevenueResult?.total ? parseFloat(totalRevenueResult.total) : 0,
    };
  }
}
