import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, Order, Escrow } from '../../../database/entities/transaction.entity';
import { MVolaProvider } from './mvola.provider';
import { AirtelMoneyProvider } from './airtel.provider';
import { PaymentStatus, OrderStatus } from '../../../database/entities/role.enum';

export type PaymentMethod = 'mvola' | 'airtel_money' | 'cash' | 'card';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly mvolaProvider: MVolaProvider,
    private readonly airtelProvider: AirtelMoneyProvider,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
  ) {}

  async initiatePayment(
    orderId: string,
    buyerId: string,
    method: PaymentMethod,
    phone?: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, buyerId },
    });

    if (!order) {
      throw new BadRequestException('Commande non trouvée');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('La commande n\'est pas en attente de paiement');
    }

    const transactionId = this.generateTransactionId(method);

    const payment = this.paymentRepository.create({
      transactionId,
      orderId: order.id,
      amount: order.totalAmount,
      status: PaymentStatus.INITIATED,
      method,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    let providerResult;

    switch (method) {
      case 'mvola':
        if (!phone) throw new BadRequestException('Le numéro MVola est obligatoire');
        providerResult = await this.mvolaProvider.initiatePayment({
          amount: Number(order.totalAmount),
          phone,
          description: `Commande ${order.orderNumber}`,
          reference: transactionId,
        });
        break;

      case 'airtel_money':
        if (!phone) throw new BadRequestException('Le numéro Airtel est obligatoire');
        providerResult = await this.airtelProvider.initiatePayment({
          amount: Number(order.totalAmount),
          phone,
          description: `Commande ${order.orderNumber}`,
          reference: transactionId,
        });
        break;

      case 'cash':
        savedPayment.status = PaymentStatus.PENDING;
        await this.paymentRepository.save(savedPayment);
        return {
          payment: savedPayment,
          instructions: 'Présentez-vous au point de retrait avec votre numéro de commande',
        };

      case 'card':
        return {
          payment: savedPayment,
          paymentUrl: `/api/payments/card/${savedPayment.id}/redirect`,
        };

      default:
        throw new BadRequestException(`Méthode de paiement non supportée : ${method}`);
    }

    savedPayment.status = PaymentStatus.PENDING;
    savedPayment.providerResponse = providerResult.providerResponse;
    await this.paymentRepository.save(savedPayment);

    this.logger.log(`Paiement initié: ${transactionId} via ${method}`);

    return {
      payment: savedPayment,
      paymentUrl: providerResult.paymentUrl,
    };
  }

  async handleProviderCallback(
    transactionId: string,
    status: 'success' | 'failed' | 'pending',
    providerResponse?: string,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { transactionId },
    });

    if (!payment) {
      throw new BadRequestException('Paiement non trouvé');
    }

    const statusMap = {
      success: PaymentStatus.SUCCESS,
      failed: PaymentStatus.FAILED,
      pending: PaymentStatus.PENDING,
    };

    payment.status = statusMap[status];
    payment.providerResponse = providerResponse || payment.providerResponse;

    if (status === 'success') {
      payment.paidAt = new Date();
    }

    await this.paymentRepository.save(payment);

    if (status === 'success') {
      const existingEscrow = await this.escrowRepository.findOne({
        where: { paymentId: payment.id },
      });

      if (!existingEscrow) {
        const escrow = this.escrowRepository.create({
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount,
          isBlocked: false,
        });
        await this.escrowRepository.save(escrow);
        this.logger.log(`Escrow créé automatiquement pour paiement ${transactionId}`);
      }
    }

    return payment;
  }

  async simulatePaymentSuccess(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Paiement non trouvé');
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.paidAt = new Date();
    payment.providerResponse = JSON.stringify({ simulated: true, timestamp: new Date() });
    await this.paymentRepository.save(payment);

    const existingEscrow = await this.escrowRepository.findOne({
      where: { paymentId: payment.id },
    });

    if (!existingEscrow) {
      const escrow = this.escrowRepository.create({
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        isBlocked: false,
      });
      await this.escrowRepository.save(escrow);
    }

    return payment;
  }

  private generateTransactionId(method: string): string {
    const prefix = method.substring(0, 3).toUpperCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${prefix}-${timestamp}-${random}`;
  }
}
