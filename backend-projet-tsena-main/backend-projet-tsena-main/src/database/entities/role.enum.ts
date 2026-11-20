export enum UserRole {
  VISITOR = 'visitor',
  CLIENT = 'client',
  BUYER = 'buyer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DISABLED = 'disabled',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum ProductStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  PUBLISHED = 'published',
  UNAVAILABLE = 'unavailable',
  SOLD_OUT = 'sold_out',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  IN_DISPUTE = 'in_dispute',
}

export enum PaymentStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ESCROW = 'escrow',
  BLOCKED = 'blocked',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum DeliveryStatus {
  TO_PREPARE = 'to_prepare',
  PREPARING = 'preparing',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RECEPTION_CONFIRMED = 'reception_confirmed',
  DELIVERY_FAILED = 'delivery_failed',
  RETURNED = 'returned',
  IN_DISPUTE = 'in_dispute',
}

export enum DisputeStatus {
  REPORTED = 'reported',
  OPEN = 'open',
  AWAITING_EVIDENCE = 'awaiting_evidence',
  UNDER_REVIEW = 'under_review',
  RESOLVED_BUYER = 'resolved_buyer',
  RESOLVED_SELLER = 'resolved_seller',
  PARTIAL_RESOLUTION = 'partial_resolution',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum Gender {
  FEMALE = 'female',
  MALE = 'male',
  UNSPECIFIED = 'unspecified',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum ShopLevel {
  NEW = 'new',
  VERIFIED = 'verified',
  GOLD = 'gold',
  PREMIUM = 'premium',
  FOUNDER = 'founder',
}

export enum ShopStatus {
  DRAFT = 'draft',
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DISABLED = 'disabled',
  ARCHIVED = 'archived',
}

export enum CommissionTier {
  NEW = 'new',
  VERIFIED = 'verified',
  BIG_SELLER = 'big_seller',
}

export enum SubscriptionPlan {
  GOLD = 'gold',
  PREMIUM = 'premium',
}

export enum SubscriptionPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  PENDING_PAYMENT = 'pending_payment',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  REPLACED = 'replaced',
}

export enum PromotionType {
  BOOST = 'boost',
  HIGHLIGHT = 'highlight',
  FEATURED = 'featured',
}

export enum PromotionStatus {
  PENDING_PAYMENT = 'pending_payment',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  STOPPED = 'stopped',
  CANCELLED = 'cancelled',
}

export enum ConversationStatus {
  OPEN = 'open',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

export enum EmailDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum DisputeReasonCode {
  PRODUCT_NOT_RECEIVED = 'product_not_received',
  PRODUCT_DAMAGED = 'product_damaged',
  NOT_AS_DESCRIBED = 'not_as_described',
  PRODUCT_INCOMPLETE = 'product_incomplete',
  WRONG_QUANTITY = 'wrong_quantity',
  LATE_DELIVERY = 'late_delivery',
  TRACKING_INCONSISTENT = 'tracking_inconsistent',
  PAYMENT_DISPUTED = 'payment_disputed',
  RECEPTION_REFUSED = 'reception_refused',
  FRAUD_SUSPECTED = 'fraud_suspected',
  OTHER = 'other',
}
