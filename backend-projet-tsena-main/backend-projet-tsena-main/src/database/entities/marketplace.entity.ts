import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  ShopLevel,
  ShopStatus,
  CommissionTier,
  SubscriptionPlan,
  SubscriptionPeriod,
  SubscriptionStatus,
  PromotionType,
  PromotionStatus,
  ConversationStatus,
  NotificationChannel,
  EmailDeliveryStatus,
} from './role.enum';
import { User } from './user.entity';
import { Product, Category } from './catalog.entity';

const decimalTransformer = {
  to: (value?: number | null) => value ?? null,
  from: (value: string | null) => (value === null || value === undefined ? null : Number(value)),
};

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'simple-array', nullable: true })
  mainCategoryIds: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  deliveryConditions: string | null;

  @Column({ type: 'enum', enum: ShopStatus, default: ShopStatus.DRAFT })
  @Index()
  status: ShopStatus;

  @Column({ type: 'text', nullable: true })
  statusReason: string | null;

  @Column({ type: 'enum', enum: ShopLevel, default: ShopLevel.NEW })
  @Index()
  level: ShopLevel;

  @Column({ type: 'timestamp', nullable: true })
  founderGrantedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  founderGrantedBy: string | null;

  @Column({ default: false })
  identityVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  identityVerifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  followersCount: number;

  @Column({ type: 'simple-array', nullable: true })
  featuredProductIds: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

@Entity('shop_follows')
@Unique(['userId', 'shopId'])
export class ShopFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid' })
  @Index()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('seller_subscriptions')
export class SellerSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'uuid' })
  @Index()
  shopId: string;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Column({ type: 'enum', enum: SubscriptionPeriod, default: SubscriptionPeriod.MONTHLY })
  period: SubscriptionPeriod;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING_PAYMENT })
  @Index()
  status: SubscriptionStatus;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ default: false })
  expiryAlertSent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('commission_rates')
export class CommissionRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryId: string | null;

  @ManyToOne(() => Category, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({ type: 'enum', enum: CommissionTier })
  @Index()
  tier: CommissionTier;

  @Column('decimal', { precision: 5, scale: 2, transformer: decimalTransformer })
  ratePercent: number;

  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  validTo: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('delivery_zones')
export class DeliveryZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer })
  price: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'enum', enum: PromotionType })
  @Index()
  type: PromotionType;

  @Column({ type: 'int' })
  durationDays: number;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer })
  listPrice: number;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'enum', enum: PromotionStatus, default: PromotionStatus.PENDING_PAYMENT })
  @Index()
  status: PromotionStatus;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  stoppedBy: string | null;

  @Column({ type: 'text', nullable: true })
  stopReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  buyerId: string;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  shopId: string | null;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  disputeId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  subject: string | null;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
  @Index()
  status: ConversationStatus;

  @Column({ type: 'uuid', nullable: true })
  blockedBy: string | null;

  @Column({ type: 'simple-array', nullable: true })
  archivedBy: string[] | null;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'int', default: 0 })
  buyerUnreadCount: number;

  @Column({ type: 'int', default: 0 })
  sellerUnreadCount: number;

  @Column({ type: 'int', default: 0 })
  reportsCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface MessageAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'uuid' })
  @Index()
  senderId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: MessageAttachment[] | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ type: 'text', nullable: true })
  reportReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reportedAt: Date | null;

  @Column({ default: false })
  isHidden: boolean;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ length: 64 })
  @Index()
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  readAt: Date | null;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  @Column()
  to: string;

  @Column({ length: 64 })
  @Index()
  type: string;

  @Column()
  subject: string;

  @Column({ type: 'enum', enum: EmailDeliveryStatus, default: EmailDeliveryStatus.QUEUED })
  @Index()
  status: EmailDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
