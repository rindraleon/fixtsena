import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Repository, In } from 'typeorm';
import { Dispute, DisputeEvidence, Order, Escrow, Payment, Delivery, AuditLog } from '../../database/entities/transaction.entity';
import { User } from '../../database/entities/user.entity';
import { CreateDisputeDto, AddEvidenceDto, ResolveDisputeDto, FilterDisputeDto, UpdateDisputeStatusDto, DisputeStatusAction } from './dto/dispute.dto';
import { SettingsService } from '../settings/settings.service';
import { adjustCommissionAfterRefund, refundAmountForPercentage } from '../commissions/commission-adjustment';
import { DisputeStatus, OrderStatus, PaymentStatus, UserRole, DisputeReasonCode } from '../../database/entities/role.enum';
import { appendOrderHistory } from '../orders/order-history';

export interface DisputeUserSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
}

export type DisputeView = Dispute & {
  orderNumber: string | null;
  buyerId: string | null;
  sellerId: string | null;
  orderTotal: number | null;
  reporter: DisputeUserSummary | null;
  buyer: DisputeUserSummary | null;
  seller: DisputeUserSummary | null;
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepository: Repository<DisputeEvidence>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  async createDispute(userId: string, dto: CreateDisputeDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new BadRequestException('Vous n\'êtes pas impliqué dans cette commande');
    }

    const existingDispute = await this.disputeRepository.findOne({
      where: { orderId: dto.orderId },
    });

    if (existingDispute) {
      throw new ConflictException('Un litige existe déjà pour cette commande');
    }

    const allowedStatuses = [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.IN_DISPUTE];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException('Cette commande ne peut pas être mise en litige');
    }

    if (order.status === OrderStatus.DELIVERED) {
      const windowDays = Number(this.settings?.get('disputes.openingWindowDays') ?? 7);
      const delivery = await this.orderRepository.manager.getRepository(Delivery).findOne({ where: { orderId: order.id } }).catch(() => null);
      const reference = delivery?.receptionConfirmedAt ?? delivery?.deliveredAt ?? order.updatedAt;
      if (windowDays > 0 && reference && Date.now() - new Date(reference).getTime() > windowDays * 24 * 3600 * 1000) {
        throw new BadRequestException(
          `Le délai de signalement (${windowDays} jour(s) après la réception) est dépassé. Contactez le support pour toute réclamation.`,
        );
      }
    }

    const dispute = this.disputeRepository.create({
      orderId: dto.orderId,
      reporterId: userId,
      reason: dto.reason,
      reasonCode: dto.reasonCode ?? DisputeReasonCode.OTHER,
      status: DisputeStatus.REPORTED,
    });

    const savedDispute = await this.disputeRepository.save(dispute);

    const previousOrderStatus = order.status;
    order.status = OrderStatus.IN_DISPUTE;
    await this.orderRepository.save(order);
    await appendOrderHistory(this.orderRepository.manager, {
      orderId: order.id,
      fromStatus: previousOrderStatus,
      toStatus: OrderStatus.IN_DISPUTE,
      actorId: userId,
      actorRole: order.buyerId === userId ? 'buyer' : 'seller',
      comment: `Litige ouvert : ${dto.reason}`,
      metadata: { disputeId: savedDispute.id, reasonCode: savedDispute.reasonCode },
    }).catch(() => undefined);

    const escrow = await this.escrowRepository.findOne({
      where: { orderId: dto.orderId },
    });

    if (escrow && !escrow.isBlocked && !escrow.releasedAt) {
      escrow.isBlocked = true;
      escrow.reason = `Litige ouvert: ${dto.reason.substring(0, 100)}`;
      await this.escrowRepository.save(escrow);

      const payment = await this.paymentRepository.findOne({
        where: { id: escrow.paymentId },
      });
      if (payment) {
        payment.status = PaymentStatus.BLOCKED;
        await this.paymentRepository.save(payment);
      }
    }

    this.logger.log(`Litige créé: ${savedDispute.id} pour commande ${order.orderNumber}`);

    const otherPartyId = order.buyerId === userId ? order.sellerId : order.buyerId;
    const otherLink = order.buyerId === userId ? '/dashboard/vendeur/litiges' : '/dashboard/client/mes-litiges';
    const reporterLink = order.buyerId === userId ? '/dashboard/client/mes-litiges' : '/dashboard/vendeur/litiges';
    await this.notifications?.notify({
      userId: otherPartyId,
      type: 'dispute.created',
      title: `Litige ouvert — commande ${order.orderNumber}`,
      body: `Un litige a été ouvert sur la commande ${order.orderNumber}. Motif : ${dto.reason.substring(0, 160)}`,
      link: otherLink,
      email: { orderNumber: order.orderNumber, status: 'En litige', nextAction: 'Apportez vos éléments de preuve', actionLabel: 'Voir le litige' },
    });
    await this.notifications?.notify({
      userId,
      type: 'dispute.created',
      title: `Votre litige est enregistré — commande ${order.orderNumber}`,
      body: 'Notre équipe examine votre signalement. Vous pouvez ajouter des preuves (photos, échanges) à tout moment.',
      link: reporterLink,
      email: { orderNumber: order.orderNumber, status: 'En litige', nextAction: 'Ajouter des preuves si nécessaire', actionLabel: 'Voir le litige' },
    });

    return savedDispute;
  }

  async addEvidence(disputeId: string, userId: string, dto: AddEvidenceDto) {
    const dispute = await this.findById(disputeId);

    await this.assertCanAccess(dispute, userId, []);

    const allowedStatuses = [
      DisputeStatus.REPORTED,
      DisputeStatus.OPEN,
      DisputeStatus.AWAITING_EVIDENCE,
    ];
    if (!allowedStatuses.includes(dispute.status)) {
      throw new BadRequestException('Le litige ne peut plus accepter de preuves');
    }

    const evidence = this.evidenceRepository.create({
      disputeId: dispute.id,
      url: dto.url,
      description: dto.description,
      uploadedBy: userId,
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    if (dispute.status === DisputeStatus.REPORTED) {
      dispute.status = DisputeStatus.OPEN;
      await this.disputeRepository.save(dispute);
    }

    this.logger.log(`Preuve ajoutée au litige ${disputeId}: ${savedEvidence.id}`);

    return savedEvidence;
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto, adminId: string) {
    const dispute = await this.findById(disputeId);

    if (dispute.status === DisputeStatus.CLOSED || dispute.status === DisputeStatus.CANCELLED) {
      throw new BadRequestException('Ce litige est déjà fermé');
    }

    if (
      dispute.status === DisputeStatus.RESOLVED_BUYER ||
      dispute.status === DisputeStatus.RESOLVED_SELLER ||
      dispute.status === DisputeStatus.PARTIAL_RESOLUTION
    ) {
      throw new BadRequestException('Une décision a déjà été rendue sur ce litige : elle est immuable (UC-LIT-02)');
    }
    if (!dto.adminDecision?.trim()) {
      throw new BadRequestException('Le motif de la décision est obligatoire');
    }
    if (dto.decision === 'partial_resolution' && (dto.refundPercentage === undefined || dto.refundPercentage === null || dto.refundPercentage <= 0 || dto.refundPercentage >= 100)) {
      throw new BadRequestException('Indiquez un pourcentage de remboursement strictement compris entre 0 et 100 pour une résolution partielle');
    }

    const previousStatus = dispute.status;
    dispute.status = dto.decision as DisputeStatus;
    dispute.adminDecision = dto.adminDecision;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    await this.disputeRepository.save(dispute);
    await this.audit(adminId, 'dispute_resolved', dispute.id, { from: previousStatus, decision: dto.decision, refundPercentage: dto.refundPercentage ?? null, reason: dto.adminDecision });

    const escrow = await this.escrowRepository.findOne({ where: { orderId: dispute.orderId } });
    const order = await this.orderRepository.findOne({ where: { id: dispute.orderId } });

    if (order) {
      const now = new Date();
      const paidBase = escrow ? Number(escrow.amount) : Number(order.totalAmount);
      let refundAmount = 0;
      let targetStatus: OrderStatus;
      let comment: string;

      if (dto.decision === 'resolved_buyer') {
        refundAmount = Math.round(paidBase);
        targetStatus = escrow ? OrderStatus.REFUNDED : OrderStatus.CANCELLED;
        comment = escrow
          ? `Décision du litige : remboursement intégral — ${dto.adminDecision}`
          : `Décision du litige (sans séquestre) : commande annulée — ${dto.adminDecision}`;
      } else if (dto.decision === 'partial_resolution') {
        refundAmount = refundAmountForPercentage(paidBase, dto.refundPercentage);
        targetStatus = OrderStatus.DELIVERED;
        comment = `Décision du litige : résolution partielle (${dto.refundPercentage} % remboursés, soit ${refundAmount.toLocaleString('fr-FR')} Ar) — ${dto.adminDecision}`;
      } else {
        targetStatus = OrderStatus.DELIVERED;
        comment = escrow
          ? `Décision du litige : fonds libérés au vendeur — ${dto.adminDecision}`
          : `Décision du litige (sans séquestre) : transaction maintenue — ${dto.adminDecision}`;
      }

      if (escrow) {
        escrow.releasedAt = now;
        escrow.releasedTo = dto.decision === 'resolved_buyer' ? order.buyerId : order.sellerId;
        escrow.isBlocked = false;
        if (refundAmount > 0) {
          escrow.reason = `${dto.decision === 'resolved_buyer' ? 'Remboursement intégral' : 'Remboursement partiel'} : ${refundAmount.toLocaleString('fr-FR')} Ar restitués à l'acheteur (litige ${dispute.id})`;
        }
        await this.escrowRepository.save(escrow);

        const payment = await this.paymentRepository.findOne({ where: { id: escrow.paymentId } });
        if (payment) {
          payment.status =
            dto.decision === 'resolved_buyer' ? PaymentStatus.REFUNDED
            : dto.decision === 'partial_resolution' ? PaymentStatus.PARTIALLY_REFUNDED
            : PaymentStatus.RELEASED;
          await this.paymentRepository.save(payment);
        }
      }

      const adjustment = adjustCommissionAfterRefund({
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount,
        commissionAmount: order.commissionAmount,
        refundAmount,
        policy: this.settings?.get('commissions.refundPolicy') as string | undefined,
      });
      if (refundAmount > 0) {
        order.refundedAmount = adjustment.refundedAmount;
        order.commissionAmount = adjustment.commissionAmount;
        order.sellerNetAmount = adjustment.sellerNetAmount;
      }

      const fromStatus = order.status;
      order.status = targetStatus;
      await this.orderRepository.save(order);
      await appendOrderHistory(this.orderRepository.manager, {
        orderId: order.id, fromStatus, toStatus: targetStatus,
        actorId: adminId, actorRole: 'admin',
        comment: adjustment.changed
          ? `${comment} · Commission recalculée (${adjustment.policy}) : ${adjustment.previousCommissionAmount.toLocaleString('fr-FR')} → ${adjustment.commissionAmount.toLocaleString('fr-FR')} Ar`
          : comment,
        metadata: {
          disputeId: dispute.id,
          decision: dto.decision,
          refundedAmount: adjustment.refundedAmount,
          commissionPolicy: adjustment.policy,
          commissionAmount: adjustment.commissionAmount,
          sellerNetAmount: adjustment.sellerNetAmount,
        },
      }).catch(() => undefined);
    }

    this.logger.log(`Litige ${disputeId} résolu: ${dto.decision} par admin ${adminId}`);

    const resolvedOrder = await this.orderRepository.findOne({ where: { id: dispute.orderId } });
    if (resolvedOrder) {
      const decisionLabel: Record<string, string> = {
        resolved_buyer: 'Décision en faveur de l\'acheteur (remboursement)',
        resolved_seller: 'Décision en faveur du vendeur (fonds libérés)',
        partial_resolution: `Résolution partielle${dto.refundPercentage ? ` (${dto.refundPercentage} % remboursés)` : ''}`,
        closed: 'Litige clos',
        cancelled: 'Litige annulé',
      };
      const label = decisionLabel[dto.decision] ?? 'Litige traité';
      for (const [targetId, link] of [
        [resolvedOrder.buyerId, '/dashboard/client/mes-litiges'],
        [resolvedOrder.sellerId, '/dashboard/vendeur/litiges'],
      ] as const) {
        await this.notifications?.notify({
          userId: targetId,
          type: 'dispute.decided',
          title: `Litige tranché — commande ${resolvedOrder.orderNumber}`,
          body: `${label}.${dto.adminDecision ? ` Motivation : ${dto.adminDecision.substring(0, 200)}` : ''}`,
          link,
          email: { orderNumber: resolvedOrder.orderNumber, status: label, nextAction: 'Consulter la décision', actionLabel: 'Voir le litige' },
        });
      }
    }

    return dispute;
  }

  async updateStatus(disputeId: string, dto: UpdateDisputeStatusDto, userId: string, userRoles: UserRole[]) {
    const dispute = await this.findById(disputeId);
    const isAdmin = userRoles.includes(UserRole.ADMIN);
    const order = await this.orderRepository.findOne({ where: { id: dispute.orderId } });
    if (!order) throw new NotFoundException('Commande du litige introuvable');

    if (dispute.status === DisputeStatus.CLOSED || dispute.status === DisputeStatus.CANCELLED) {
      throw new BadRequestException('Ce litige est clos : il ne peut plus être modifié');
    }

    const decided = [DisputeStatus.RESOLVED_BUYER, DisputeStatus.RESOLVED_SELLER, DisputeStatus.PARTIAL_RESOLUTION].includes(dispute.status);
    const inProgress = [DisputeStatus.REPORTED, DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.AWAITING_EVIDENCE].includes(dispute.status);

    if (!isAdmin) {
      if (dispute.reporterId !== userId || dto.status !== DisputeStatusAction.CANCELLED) {
        throw new ForbiddenException('Seul l’administrateur peut faire évoluer un dossier de litige');
      }
      if (![DisputeStatus.REPORTED, DisputeStatus.OPEN].includes(dispute.status)) {
        throw new BadRequestException('Le signalement ne peut plus être retiré : il est en cours de traitement');
      }
    } else {
      if (dto.status === DisputeStatusAction.CLOSED && !decided) {
        throw new BadRequestException('Rendez une décision avant de clôturer le litige');
      }
      if (dto.status !== DisputeStatusAction.CLOSED && !inProgress) {
        throw new BadRequestException('Ce litige est déjà tranché : il ne reste qu’à le clôturer');
      }
      if (dto.status === DisputeStatusAction.AWAITING_EVIDENCE && !dto.note?.trim()) {
        throw new BadRequestException('Précisez les informations attendues des parties');
      }
    }

    const previousStatus = dispute.status;
    dispute.status = dto.status as unknown as DisputeStatus;
    if (dto.note?.trim()) dispute.adminNote = dto.note.trim();
    if (dto.status === DisputeStatusAction.CLOSED || dto.status === DisputeStatusAction.CANCELLED) {
      dispute.closedAt = new Date();
      dispute.closedBy = userId;
    }
    await this.disputeRepository.save(dispute);
    await this.audit(userId, isAdmin ? 'dispute_status_changed' : 'dispute_withdrawn', dispute.id, { from: previousStatus, to: dispute.status, note: dto.note ?? null });

    if (dto.status === DisputeStatusAction.CANCELLED && order.status === OrderStatus.IN_DISPUTE) {
      const delivery = await this.orderRepository.manager.getRepository(Delivery).findOne({ where: { orderId: order.id } }).catch(() => null);
      const restored = delivery?.receptionConfirmedAt ? OrderStatus.DELIVERED : OrderStatus.SHIPPED;
      order.status = restored;
      await this.orderRepository.save(order);
      await appendOrderHistory(this.orderRepository.manager, {
        orderId: order.id, fromStatus: OrderStatus.IN_DISPUTE, toStatus: restored,
        actorId: userId, actorRole: isAdmin ? 'admin' : 'buyer', comment: 'Litige annulé : la commande reprend son cours', metadata: { disputeId: dispute.id },
      }).catch(() => undefined);
      const escrow = await this.escrowRepository.findOne({ where: { orderId: order.id } });
      if (escrow?.isBlocked) {
        escrow.isBlocked = false;
        await this.escrowRepository.save(escrow);
        const payment = await this.paymentRepository.findOne({ where: { id: escrow.paymentId } });
        if (payment && payment.status === PaymentStatus.BLOCKED) {
          payment.status = PaymentStatus.ESCROW;
          await this.paymentRepository.save(payment);
        }
      }
    }

    const labels: Record<string, [string, string, string]> = {
      [DisputeStatusAction.OPEN]: ['Litige pris en charge', 'Votre dossier a été ouvert par l’équipe Tsena.', 'Suivre le dossier'],
      [DisputeStatusAction.UNDER_REVIEW]: ['Litige en cours d’analyse', 'L’administrateur analyse les éléments du dossier.', 'Suivre le dossier'],
      [DisputeStatusAction.AWAITING_EVIDENCE]: ['Informations complémentaires demandées', dto.note ? `Demande de l’administrateur : ${dto.note.substring(0, 300)}` : 'L’administrateur attend des éléments complémentaires.', 'Ajouter des preuves'],
      [DisputeStatusAction.CLOSED]: ['Litige clôturé', 'Le dossier est clôturé et la décision est définitive.', 'Consulter le dossier'],
      [DisputeStatusAction.CANCELLED]: ['Litige annulé', 'Le signalement a été retiré : la commande reprend son cours normal.', 'Voir la commande'],
    };
    const [title, body, nextAction] = labels[dto.status];
    for (const [targetId, link] of [
      [order.buyerId, '/dashboard/client/mes-litiges'],
      [order.sellerId, '/dashboard/vendeur/litiges'],
    ] as const) {
      await this.notifications?.notify({
        userId: targetId,
        type: dto.status === DisputeStatusAction.CLOSED || dto.status === DisputeStatusAction.CANCELLED ? 'dispute.decided' : 'dispute.created',
        title: `${title} — commande ${order.orderNumber}`,
        body,
        link,
        email: { orderNumber: order.orderNumber, status: title, nextAction, actionLabel: 'Voir le litige' },
      });
    }

    return this.findById(disputeId);
  }

  private async audit(userId: string, action: string, entityId: string, changes: Record<string, unknown>): Promise<void> {
    try {
      const repo = this.orderRepository.manager.getRepository(AuditLog);
      await repo.save(repo.create({ userId, action, entity: 'dispute', entityId, changes }));
    } catch (error) {
      this.logger.warn(`Journalisation litige impossible : ${(error as Error).message}`);
    }
  }

  async findById(id: string) {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
    });

    if (!dispute) {
      throw new NotFoundException('Litige non trouvé');
    }

    return dispute;
  }

  async findByIdForUser(id: string, userId: string, userRoles: UserRole[]): Promise<DisputeView> {
    const dispute = await this.findById(id);
    await this.assertCanAccess(dispute, userId, userRoles);
    const [view] = await this.enrich([dispute]);
    return view;
  }

  async getEvidence(disputeId: string, userId: string, userRoles: UserRole[]) {
    const dispute = await this.findById(disputeId);
    await this.assertCanAccess(dispute, userId, userRoles);
    return await this.evidenceRepository.find({
      where: { disputeId },
      order: { createdAt: 'ASC' },
    });
  }

  private async assertCanAccess(dispute: Dispute, userId: string, userRoles: UserRole[]): Promise<void> {
    if (userRoles.includes(UserRole.ADMIN) || dispute.reporterId === userId) return;
    const order = await this.orderRepository.findOne({ where: { id: dispute.orderId } });
    if (!order || (order.buyerId !== userId && order.sellerId !== userId)) {
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");
    }
  }

  private async enrich(disputes: Dispute[]): Promise<DisputeView[]> {
    if (disputes.length === 0) return [];
    const orders = await this.orderRepository.find({ where: { id: In([...new Set(disputes.map((d) => d.orderId))]) } });
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const userIds = [...new Set([...disputes.map((d) => d.reporterId), ...orders.flatMap((o) => [o.buyerId, o.sellerId])])];
    const users = userIds.length
      ? await this.userRepository.find({ where: { id: In(userIds) }, select: ['id', 'firstName', 'lastName', 'avatarUrl'], withDeleted: true })
      : [];
    const userById = new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName ?? null, avatarUrl: u.avatarUrl ?? null }]));
    return disputes.map((dispute) => {
      const order = orderById.get(dispute.orderId);
      return {
        ...dispute,
        orderNumber: order?.orderNumber ?? null,
        buyerId: order?.buyerId ?? null,
        sellerId: order?.sellerId ?? null,
        orderTotal: order ? Number(order.totalAmount) : null,
        reporter: userById.get(dispute.reporterId) ?? null,
        buyer: order ? userById.get(order.buyerId) ?? null : null,
        seller: order ? userById.get(order.sellerId) ?? null : null,
      };
    });
  }

  async findAll(filters: FilterDisputeDto, userId: string, userRoles: UserRole[]) {
    const { status, orderId, reporterId, page = 1, limit = 20 } = filters;

    const qb = this.disputeRepository
      .createQueryBuilder('dispute')
      .leftJoin(Order, 'order', 'order.id = dispute.orderId');

    if (!userRoles.includes(UserRole.ADMIN)) {
      qb.andWhere('(dispute.reporterId = :userId OR order.buyerId = :userId OR order.sellerId = :userId)', { userId });
    }

    if (status) {
      qb.andWhere('dispute.status = :status', { status });
    }
    if (orderId) {
      qb.andWhere('dispute.orderId = :orderId', { orderId });
    }
    if (reporterId) {
      qb.andWhere('dispute.reporterId = :reporterId', { reporterId });
    }

    qb.orderBy('dispute.createdAt', 'DESC');

    const total = await qb.getCount();
    const disputes = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const items = await this.enrich(disputes);

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

  async getStats() {
    const totalDisputes = await this.disputeRepository.count();
    const openDisputes = await this.disputeRepository.count({
      where: { status: DisputeStatus.OPEN },
    });
    const resolvedDisputes = await this.disputeRepository.count({
      where: [
        { status: DisputeStatus.RESOLVED_BUYER },
        { status: DisputeStatus.RESOLVED_SELLER },
        { status: DisputeStatus.PARTIAL_RESOLUTION },
      ],
    });
    const closedDisputes = await this.disputeRepository.count({
      where: { status: DisputeStatus.CLOSED },
    });

    const resolutionRate = totalDisputes > 0
      ? Math.round((resolvedDisputes / totalDisputes) * 100)
      : 0;

    return {
      totalDisputes,
      openDisputes,
      resolvedDisputes,
      closedDisputes,
      resolutionRate,
    };
  }
}
