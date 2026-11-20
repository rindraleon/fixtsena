import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import {
  OrderStatus,
  PaymentStatus,
  DeliveryStatus,
  DisputeStatus,
  DisputeReasonCode,
} from './role.enum';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'uuid' })
  @Index()
  cartId: string;

  @Column({ type: 'uuid' })
  @Index()
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}

export interface ShippingAddressSnapshot {
  recipientName: string | null;
  phone: string | null;
  street: string;
  complement: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  instructions: string | null;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  orderNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  buyerId: string;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'uuid', nullable: true })
  addressId: string;

  @Column({ type: 'jsonb', nullable: true })
  shippingAddress: ShippingAddressSnapshot | null;

  @Column('decimal', { precision: 12, scale: 2 })
  subtotalAmount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  shippingAmount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'uuid', nullable: true })
  deliveryZoneId: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryZoneName: string | null;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  commissionRate: number | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  commissionAmount: number | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  sellerNetAmount: number | null;

  @Column({ type: 'varchar', nullable: true })
  commissionTier: string | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  refundedAmount: number | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  @Index()
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column({ type: 'varchar', nullable: true })
  fromStatus: string | null;

  @Column({ type: 'varchar' })
  toStatus: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorRole: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('order_lines')
export class OrderLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column({ type: 'uuid' })
  @Index()
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalPrice: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  transactionId: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  @Index()
  status: PaymentStatus;

  @Column({ nullable: true })
  method: string;

  @Column({ type: 'text', nullable: true })
  providerResponse?: string;

  @Column({ nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  paymentId: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ nullable: true })
  reason?: string;

  @Column({ nullable: true })
  releasedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  releasedTo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  orderId: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.TO_PREPARE,
  })
  @Index()
  status: DeliveryStatus;

  @Column({ nullable: true })
  trackingNumber: string;

  @Column({ nullable: true })
  carrier: string;

  @Column({ nullable: true })
  shippedAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  receptionConfirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  method: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column({ type: 'uuid' })
  @Index()
  reporterId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: DisputeReasonCode, default: DisputeReasonCode.OTHER })
  reasonCode: DisputeReasonCode;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.REPORTED,
  })
  @Index()
  status: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  adminDecision: string;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  closedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('dispute_evidence')
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  disputeId: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  @Column({ type: 'uuid' })
  @Index()
  reviewerId: string;

  @Column({ type: 'uuid' })
  @Index()
  reviewedId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'int', nullable: true })
  productRating: number | null;

  @Column({ type: 'int', nullable: true })
  deliveryRating: number | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  productId: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  sellerReply: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sellerRepliedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ type: 'text', nullable: true })
  reportReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reportedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  moderatedBy: string | null;

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ default: true })
  isVisible: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  iconUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  criteria: object;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('user_badges')
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid' })
  @Index()
  badgeId: string;

  @Column({ nullable: true })
  awardedAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', default: 'manual' })
  source: 'auto' | 'manual';

  @Column({ type: 'uuid', nullable: true })
  awardedBy: string | null;
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: object;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
