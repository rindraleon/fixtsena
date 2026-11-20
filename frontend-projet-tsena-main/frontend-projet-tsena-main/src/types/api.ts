export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export const EMPTY_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export type UserRole = 'visitor' | 'client' | 'buyer' | 'seller' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'disabled' | 'pending_verification';

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  roles: UserRole[];
  status: AccountStatus;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  reputationScore: number;
  reviewCount?: number;
  sellerRequestedAt?: string | null;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
  birthDate?: string | null;
  age?: number | null;
  isAdult?: boolean | null;
  gender?: Gender;
  marketingOptIn?: boolean;
  marketingOptInAt?: string | null;
  notifyFollowedShopProducts?: boolean;
  notifyFollowedShopPromotions?: boolean;
  notifyMessagesByEmail?: boolean;
}

export type Gender = 'female' | 'male' | 'unspecified' | 'prefer_not_to_say';

export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Féminin',
  male: 'Masculin',
  unspecified: 'Non précisé',
  prefer_not_to_say: 'Préfère ne pas répondre',
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResponse {
  user: ApiUser;
  tokens: AuthTokens;
  emailVerificationRequired?: boolean;
  accountType?: RegistrationAccountType;
  sellerRequestPending?: boolean;
}

export type RegistrationAccountType = 'client' | 'seller' | 'admin';

export interface RegisterOptions {
  accountTypes: RegistrationAccountType[];
  adminRegistrationOpen: boolean;
  adminRegistrationReason: string | null;
  sellerApprovalRequired: boolean;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  accountType?: RegistrationAccountType;
  requestSellerAccount?: boolean;
  acceptTerms: boolean;
  birthDate?: string;
  gender?: Gender;
  marketingOptIn?: boolean;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  birthDate?: string;
  gender?: Gender;
  marketingOptIn?: boolean;
  notifyFollowedShopProducts?: boolean;
  notifyFollowedShopPromotions?: boolean;
  notifyMessagesByEmail?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  parentId?: string | null;
  parent?: ApiCategory | null;
  children?: ApiCategory[];
  productCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  productCount: number;
  children: CategoryTreeNode[];
}

export interface CategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string;
  isActive?: boolean;
  includeInactive?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export type ProductStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'published'
  | 'unavailable'
  | 'sold_out'
  | 'suspended'
  | 'archived'
  | 'rejected'
  | 'rejected';

export interface ApiProductImage {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
  isPrimary: boolean;
  productId?: string;
}

export interface ProductSellerSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  reviewCount: number;
  memberSince: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  costPrice?: string | number | null;
  sku?: string;
  stockQuantity: number;
  lowStockThreshold: number;
  weight?: string | number | null;
  sellerId: string;
  seller: ProductSellerSummary | null;
  categoryId: string;
  category?: ApiCategory;
  status: ProductStatus;
  averageRating: string | number;
  reviewCount: number;
  salesCount: number;
  tags: string[];
  isFeatured: boolean;
  images?: ApiProductImage[];
  shop?: ProductShopSummary | null;
  promotions?: ActivePromotionSummary[];
  isSponsored?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductShopSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city?: string | null;
  level: ShopLevel;
  levelLabel: string;
  status: ShopStatus;
}

export interface ActivePromotionSummary {
  id: string;
  type: PromotionType;
  typeLabel: string;
  endsAt: string;
  sponsored: true;
}

export type ProductSortBy = 'name' | 'price' | 'createdAt' | 'updatedAt' | 'stockQuantity' | 'salesCount' | 'averageRating';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: ProductStatus;
  sellerId?: string;
  isFeatured?: boolean;
  inStock?: boolean;
  tags?: string;
  city?: string;
  sortBy?: ProductSortBy;
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface ProductLocation {
  city: string;
  count: number;
}

export interface ProductImageInput {
  url: string;
  alt?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface CreateProductDto {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  categoryId: string;
  sku?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
  weight?: number;
  images?: ProductImageInput[];
  tags?: string[];
  isFeatured?: boolean;
  status?: ProductStatus;
}

export type UpdateProductDto = Partial<CreateProductDto>;

export interface SellerProductStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStock: number;
  lowStock: number;
}

export interface CartItemProduct {
  id: string;
  name: string;
  slug: string;
  images: ApiProductImage[];
  stockQuantity: number;
  status: ProductStatus;
  price?: string | number;
  sellerId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string | number;
  product: CartItemProduct | null;
  subtotal: number;
}

export interface CartData {
  cart: { id: string; userId: string } | null;
  items: CartItem[];
  summary: {
    itemCount: number;
    totalQuantity: number;
    totalAmount: number;
  };
}

export interface CartCount {
  count: number;
}

export interface AddCartItemDto {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'in_dispute';

export interface OrderLine {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  productImage: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
}

export interface OrderPartySummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export type DeliveryStatus =
  | 'to_prepare'
  | 'preparing'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'reception_confirmed'
  | 'delivery_failed'
  | 'returned'
  | 'in_dispute';

export interface ApiDelivery {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  trackingNumber: string | null;
  carrier: string | null;
  method: string | null;
  note: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  receptionConfirmedAt: string | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorRole: 'buyer' | 'seller' | 'admin' | 'system' | string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

export interface ApiOrder {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  buyer: OrderPartySummary | null;
  seller: OrderPartySummary | null;
  addressId?: string | null;
  shippingAddress?: ShippingAddressSnapshot | null;
  delivery?: ApiDelivery | null;
  history?: OrderHistoryEntry[];
  subtotalAmount: string | number;
  shippingAmount: string | number;
  totalAmount: string | number;
  status: OrderStatus;
  notes?: string | null;
  lines: OrderLine[];
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  commissionRate?: string | number | null;
  commissionAmount?: string | number | null;
  sellerNetAmount?: string | number | null;
  commissionTier?: CommissionTier | null;
  refundedAmount?: string | number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutQuote {
  deliveryZone: { id: string; name: string; price: number; description: string | null } | null;
  orders: Array<{
    sellerId: string;
    sellerName: string;
    itemsCount: number;
    subtotalAmount: number;
    shippingAmount: number;
    totalAmount: number;
  }>;
  ordersCount: number;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  sellerId?: string;
  buyerId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateOrderDto {
  addressId?: string;
  notes?: string;
  deliveryZoneId?: string;
  acceptPriceChanges?: boolean;
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  comment?: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDeliveryAt?: string;
  deliveryMethod?: string;
}

export type DeliveryEventStatus = 'in_transit' | 'delivered' | 'delivery_failed' | 'returned';

export interface UpdateDeliveryDto {
  status?: DeliveryEventStatus;
  carrier?: string;
  trackingNumber?: string;
  estimatedDeliveryAt?: string;
  deliveryMethod?: string;
  comment?: string;
}

export interface ApiAddress {
  id: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  street: string;
  complement: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  instructions: string | null;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressDto {
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  complement?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  instructions?: string;
  isDefault?: boolean;
}

export interface SellerOrderStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}

export interface BuyerOrderStats {
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  totalSpent: number;
}

export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'escrow'
  | 'blocked'
  | 'released'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod = 'mvola' | 'airtel_money' | 'orange_money' | 'cash_on_delivery' | 'card';

export interface ApiPayment {
  id: string;
  transactionId: string;
  orderId: string;
  amount: string | number;
  status: PaymentStatus;
  method: PaymentMethod | string;
  providerResponse?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface InitiatePaymentDto {
  orderId: string;
  method: PaymentMethod;
}

export interface InitiatePaymentResult {
  payment: ApiPayment;
  paymentUrl?: string | null;
}

export interface ApiReview {
  id: string;
  orderId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt?: string;
  reviewer: ReviewUserSummary | null;
  reviewed: ReviewUserSummary | null;
  orderNumber: string | null;
  productRating?: number | null;
  deliveryRating?: number | null;
  productId?: string | null;
  product?: { id: string; name: string; slug: string } | null;
  sellerReply?: string | null;
  sellerRepliedAt?: string | null;
  reportedBy?: string | null;
  reportReason?: string | null;
  reportedAt?: string | null;
  moderatedBy?: string | null;
  moderationReason?: string | null;
}

export interface ReviewUserSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface ReviewFilters {
  reviewerId?: string;
  reviewedId?: string;
  productId?: string;
  reported?: boolean;
  includeHidden?: boolean;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
}

export interface CreateReviewDto {
  orderId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
  productRating?: number;
  deliveryRating?: number;
  productId?: string;
}

export type UpdateReviewDto = Partial<Pick<CreateReviewDto, 'rating' | 'comment'>>;

export interface ReviewAverage {
  reviewedId: string;
  averageRating: number;
  reviewCount: number;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: AccountStatus;
  sellerRequested?: boolean;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  roles?: UserRole[];
  status?: AccountStatus;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  roles?: UserRole[];
  status?: AccountStatus;
}

export interface DashboardStats {
  users: { total: number; active: number; activeLast30Days?: number; sellers: number; activeSellersLast30Days?: number };
  products: { total: number; active: number };
  orders: { total: number; pending: number; delivered?: number; last7Days: number; inProgress?: number; deliverySuccessRate?: number | null };
  revenue: { total: number; last7Days: number; commission?: number };
  payments?: { total: number; successful: number; successRate: number | null };
  escrow: { heldAmount: number };
  disputes: { open: number; resolved?: number; averageResolutionHours?: number | null };
  refunds?: { count: number; amount: number };
  satisfaction?: { averageRating: number | null; reviews: number };
  top?: {
    sellers: Array<{ id: string; name: string; orders: number; revenue: number }>;
    products: Array<{ id: string; name: string; quantity: number; revenue: number }>;
    categories: Array<{ id: string; name: string; orders: number; revenue: number }>;
  };
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

export type UploadedProductImage = ApiProductImage & { key?: string };

export interface ApiEscrow {
  id: string;
  paymentId: string;
  orderId: string;
  amount: string | number;
  isBlocked: boolean;
  reason?: string | null;
  releasedAt?: string | null;
  releasedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowStats {
  totalEscrows: number;
  totalHeld: number;
  blockedAmount: number;
  releasedAmount: number;
}

export interface PaymentStats {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  totalRevenue: number;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  orderId?: string;
  page?: number;
  limit?: number;
}

export type DisputeStatus =
  | 'reported'
  | 'open'
  | 'awaiting_evidence'
  | 'under_review'
  | 'resolved_buyer'
  | 'resolved_seller'
  | 'partial_resolution'
  | 'closed'
  | 'cancelled';

export type DisputeDecision = 'resolved_buyer' | 'resolved_seller' | 'partial_resolution';

export interface DisputeUserSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
}

export type DisputeReasonCode =
  | 'product_not_received'
  | 'product_damaged'
  | 'not_as_described'
  | 'product_incomplete'
  | 'wrong_quantity'
  | 'late_delivery'
  | 'tracking_inconsistent'
  | 'payment_disputed'
  | 'reception_refused'
  | 'fraud_suspected'
  | 'other';

export const DISPUTE_REASON_LABELS: Record<DisputeReasonCode, string> = {
  product_not_received: 'Produit non reçu',
  product_damaged: 'Produit endommagé',
  not_as_described: 'Produit non conforme à la description',
  product_incomplete: 'Produit incomplet',
  wrong_quantity: 'Quantité incorrecte',
  late_delivery: 'Retard de livraison important',
  tracking_inconsistent: 'Informations de suivi incohérentes',
  payment_disputed: 'Paiement contesté',
  reception_refused: 'Refus injustifié de confirmation de réception',
  fraud_suspected: 'Comportement frauduleux ou abusif',
  other: 'Autre',
};

export type DisputeStatusAction = 'open' | 'under_review' | 'awaiting_evidence' | 'closed' | 'cancelled';

export interface UpdateDisputeStatusDto {
  status: DisputeStatusAction;
  note?: string;
}

export interface ApiDispute {
  id: string;
  orderId: string;
  reporterId: string;
  reason: string;
  reasonCode?: DisputeReasonCode;
  status: DisputeStatus;
  adminDecision?: string | null;
  adminNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  orderNumber: string | null;
  buyerId: string | null;
  sellerId: string | null;
  orderTotal: number | null;
  reporter: DisputeUserSummary | null;
  buyer: DisputeUserSummary | null;
  seller: DisputeUserSummary | null;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  url: string;
  description?: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface CreateDisputeDto {
  orderId: string;
  reason: string;
  reasonCode?: DisputeReasonCode;
}

export interface AddEvidenceDto {
  url: string;
  description?: string;
}

export interface ResolveDisputeDto {
  decision: DisputeDecision;
  adminDecision: string;
  refundPercentage?: number;
}

export interface DisputeFilters {
  status?: DisputeStatus;
  orderId?: string;
  reporterId?: string;
  page?: number;
  limit?: number;
}

export interface DisputeStats {
  totalDisputes: number;
  openDisputes: number;
  resolvedDisputes: number;
  closedDisputes: number;
  resolutionRate: number;
}

export interface ApiBadge {
  id: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  criteria?: BadgeCriteria | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  awardedAt: string;
  isActive: boolean;
  source?: 'auto' | 'manual';
  awardedBy?: string | null;
  badge: ApiBadge | null;
}

export interface BadgeCriteria {
  mode?: 'auto' | 'manual';
  audience?: 'seller' | 'buyer' | 'any';
  autoRevoke?: boolean;
  minAccountAgeDays?: number;
  maxAccountAgeDays?: number;
  minCompletedSales?: number;
  maxCompletedSales?: number;
  minAverageRating?: number;
  minReviewsReceived?: number;
  maxIncidentRatePercent?: number;
  minOnTimeDeliveryRatePercent?: number;
  identityVerified?: boolean;
  minRepliedReviews?: number;
  minCompletedPurchases?: number;
  minReviewsGiven?: number;
  maxDisputesOpened?: number;
}

export interface BadgeDto {
  name: string;
  description?: string;
  iconUrl?: string;
  criteria?: BadgeCriteria;
  isActive?: boolean;
}

export interface BadgeStats {
  totalBadges: number;
  activeBadges: number;
  totalAwards: number;
  topBadge?: { badgeId: string; count: number; name?: string } | null;
}

export interface BadgeUserStats {
  isSeller: boolean;
  isBuyer: boolean;
  accountAgeDays: number;
  completedSales: number;
  totalSales: number;
  cancelledSales: number;
  disputesOnSales: number;
  averageRating: number | null;
  reviewsReceived: number;
  repliedReviews: number;
  onTimeDeliveryRate: number | null;
  identityVerified: boolean;
  completedPurchases: number;
  reviewsGiven: number;
  disputesOpened: number;
}

export interface BadgeEvaluation {
  awarded: string[];
  revoked: string[];
  stats: BadgeUserStats | null;
}

export type ShopLevel = 'new' | 'verified' | 'gold' | 'premium' | 'founder';
export type ShopStatus = 'draft' | 'pending_verification' | 'active' | 'suspended' | 'disabled' | 'archived';

export const SHOP_LEVEL_LABELS: Record<ShopLevel, string> = {
  new: 'Nouveau',
  verified: 'Vérifié',
  gold: 'Gold',
  premium: 'Premium',
  founder: 'Fondateur',
};

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  draft: 'Brouillon',
  pending_verification: 'En attente de vérification',
  active: 'Active',
  suspended: 'Suspendue',
  disabled: 'Désactivée',
  archived: 'Archivée',
};

export interface ApiShop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  mainCategoryIds: string[] | null;
  location: string | null;
  city?: string | null;
  deliveryConditions: string | null;
  status: ShopStatus;
  statusLabel: string;
  statusReason: string | null;
  level: ShopLevel;
  levelLabel: string;
  identityVerified: boolean;
  identityVerifiedAt: string | null;
  submittedAt: string | null;
  activatedAt: string | null;
  followersCount: number;
  featuredProductIds: string[] | null;
  productsCount: number;
  averageRating: number;
  reviewsCount: number;
  isFollowing?: boolean | null;
  owner?: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
    createdAt?: string;
  } | null;
  badges?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopFilters {
  search?: string;
  level?: ShopLevel;
  status?: ShopStatus;
  categoryId?: string;
  sortBy?: 'followers' | 'rating' | 'recent' | 'name';
  page?: number;
  limit?: number;
}

export interface UpsertShopDto {
  name?: string;
  description?: string;
  location?: string;
  city?: string;
  deliveryConditions?: string;
  mainCategoryIds?: string[];
  featuredProductIds?: string[];
}

export interface ShopFollowResult {
  following: boolean;
  followersCount: number;
}

export interface LevelThreshold {
  minMonths: number;
  minOrders: number;
  maxOrders: number | null;
  minRating: number;
  maxIncidentRate: number;
  minOnTimeRate: number | null;
  identityRequired: boolean;
}

export interface EligibilityCheck {
  key: string;
  label: string;
  required: string;
  current: string;
  met: boolean;
}

export interface ShopEligibility {
  shop: { id: string; level: ShopLevel; levelLabel: string; identityVerified: boolean; status: ShopStatus };
  performance: {
    monthsActive: number;
    completedOrders: number;
    cancelledOrders: number;
    disputes: number;
    incidentRate: number;
    onTimeRate: number;
    rating: number;
    reviewCount: number;
  };
  levels: Array<{ level: ShopLevel; levelLabel?: string; eligible: boolean; threshold: LevelThreshold; checks: EligibilityCheck[] }>;
}

export interface AdminShopStats {
  total: number;
  byStatus: Record<ShopStatus, number>;
  byLevel: Record<ShopLevel, number>;
}

export type SubscriptionPlan = 'gold' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'yearly';
export type SubscriptionStatus = 'pending_payment' | 'scheduled' | 'active' | 'expired' | 'cancelled' | 'replaced';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending_payment: 'En attente de paiement',
  scheduled: 'Programmé',
  active: 'Actif',
  expired: 'Expiré',
  cancelled: 'Annulé',
  replaced: 'Remplacé',
};

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

export interface ApiSubscription {
  id: string;
  sellerId: string;
  shopId: string;
  plan: SubscriptionPlan;
  period: SubscriptionPeriod;
  status: SubscriptionStatus;
  amount: number;
  startsAt: string | null;
  endsAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  expiryAlertSentAt?: string | null;
  seller?: { id: string; firstName: string; lastName: string | null; email?: string } | null;
  shop?: { id: string; name: string; slug: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MySubscription {
  shop: { id: string; level: ShopLevel; status: ShopStatus; founder: boolean } | null;
  current: ApiSubscription | null;
  pending: ApiSubscription | null;
  scheduled?: ApiSubscription | null;
  history: ApiSubscription[];
}

export interface SubscribeDto {
  plan: SubscriptionPlan;
  period?: SubscriptionPeriod;
}

export type SubscriptionChangeKind = 'new' | 'renewal' | 'upgrade' | 'downgrade';

export const SUBSCRIPTION_CHANGE_LABELS: Record<SubscriptionChangeKind, string> = {
  new: 'Nouvelle souscription',
  renewal: 'Renouvellement anticipé',
  upgrade: 'Montée en gamme immédiate',
  downgrade: 'Rétrogradation programmée',
};

export interface SubscribeResult extends ApiSubscription {
  change: SubscriptionChangeKind;
  changeMessage: string;
}

export interface SubscriptionChangePreview {
  change: SubscriptionChangeKind;
  message: string;
  activeEndsAt: string | null;
  blockedBy: { plan: SubscriptionPlan; startsAt: string | null } | null;
}

export type CommissionTier = 'new' | 'verified' | 'big_seller';

export const COMMISSION_TIER_LABELS: Record<CommissionTier, string> = {
  new: 'Nouveau',
  verified: 'Vérifié',
  big_seller: 'Gros vendeur',
};

export interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveDeliveryZoneDto {
  name: string;
  description?: string;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CommissionQuote {
  tier: CommissionTier;
  tierLabel: string;
  ratePercent: number;
  source: 'category' | 'default';
  categoryId: string | null;
  shopLevel: ShopLevel | null;
  price?: number;
  commissionAmount?: number;
  sellerNetAmount?: number;
}

export interface CommissionGridRow {
  categoryId: string;
  categoryName: string;
  rates: Record<CommissionTier, number | null>;
}

export interface CommissionGrid {
  tiers: Array<{ tier: CommissionTier; label: string }>;
  defaults: Record<CommissionTier, number | null>;
  rows: CommissionGridRow[];
  refundPolicy?: CommissionRefundPolicy | string;
}

export type CommissionRefundPolicy = 'full' | 'partial' | 'none';

export const COMMISSION_REFUND_POLICY_LABELS: Record<CommissionRefundPolicy, string> = {
  full: 'Annulée dès qu’un remboursement est accordé',
  partial: 'Recalculée au prorata du montant conservé par le vendeur',
  none: 'Maintenue sur le montant initial',
};

export interface UpsertCommissionRateDto {
  categoryId: string | null;
  tier: CommissionTier;
  ratePercent: number;
  validFrom?: string;
  validTo?: string;
}

export type PromotionType = 'boost' | 'highlight' | 'featured';
export type PromotionStatus = 'pending_payment' | 'active' | 'expired' | 'stopped' | 'cancelled';

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  boost: 'Boost',
  highlight: 'Mise en avant',
  featured: 'À la une',
};

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  pending_payment: 'En attente de paiement',
  active: 'Active',
  expired: 'Expirée',
  stopped: 'Arrêtée',
  cancelled: 'Annulée',
};

export interface PromotionOffer {
  type: PromotionType;
  typeLabel: string;
  durationDays: number;
  price: number;
  discountPercent: number;
  finalPrice: number;
}

export interface PromotionOffers {
  shopLevel: ShopLevel | null;
  offers: PromotionOffer[];
}

export interface ApiPromotion {
  id: string;
  productId: string;
  sellerId: string;
  type: PromotionType;
  typeLabel: string;
  status: PromotionStatus;
  durationDays: number;
  listPrice: number;
  amount: number;
  startsAt: string | null;
  endsAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  stoppedBy?: string | null;
  stopReason?: string | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    price?: string | number;
    status?: ProductStatus;
    stockQuantity?: number;
    sellerId?: string;
    images?: ApiProductImage[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionDto {
  productId: string;
  type: PromotionType;
  durationDays: number;
}

export interface PromotionStats {
  byStatus: Record<PromotionStatus, number>;
  revenue: number;
  active: number;
}

export type ConversationStatus = 'open' | 'archived' | 'blocked';

export interface MessageAttachment {
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface ConversationParty {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface ApiConversation {
  id: string;
  buyerId: string;
  sellerId: string;
  shopId: string | null;
  productId: string | null;
  orderId: string | null;
  disputeId: string | null;
  subject: string | null;
  status: ConversationStatus;
  blockedBy: string | null;
  archivedBy: string[] | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  buyerUnreadCount: number;
  sellerUnreadCount: number;
  reportsCount: number;
  buyer: ConversationParty | null;
  seller: ConversationParty | null;
  shop: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  product: { id: string; name: string; slug: string } | null;
  order: { id: string; orderNumber: string } | null;
  unreadCount: number;
  isArchived: boolean;
  isBlockedByMe: boolean;
  myRole: 'buyer' | 'seller' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachments: MessageAttachment[] | null;
  readAt: string | null;
  reportedBy: string | null;
  reportReason: string | null;
  hiddenByAdmin: boolean;
  createdAt: string;
}

export interface ConversationMessages {
  conversation: ApiConversation;
  items: ApiMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationFilters {
  role?: 'buyer' | 'seller';
  archived?: boolean;
  reported?: boolean;
  page?: number;
  limit?: number;
}

export interface StartConversationDto {
  sellerId?: string;
  shopId?: string;
  productId?: string;
  orderId?: string;
  disputeId?: string;
  subject?: string;
  message: string;
  attachments?: MessageAttachment[];
}

export interface SendMessageDto {
  message: string;
  attachments?: MessageAttachment[];
}

export interface ApiNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;

  isMessage: boolean;

  conversationId: string | null;
  senderName: string | null;
  senderAvatarUrl: string | null;
}

export interface NotificationFilters {
  unread?: boolean;
  page?: number;
  limit?: number;
}

export interface ApiEmailLog {
  id: string;
  userId: string | null;
  to: string;
  type: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface PublicSettings {
  majorityAge: number;
  helpEmail: string;
  subscriptions: Record<SubscriptionPlan, { monthlyPrice: number; yearlyPrice: number }>;
  promotions: { offers: Array<{ type: PromotionType; durationDays: number; price: number }>; levelDiscounts: Record<string, number> };
  delivery?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SettingsGroup {
  id: string;
  label: string;
  keys: string[];
}

export interface AdminSettings {
  values: Record<string, unknown>;
  defaults: Record<string, unknown>;
  groups: SettingsGroup[];
  overridden: string[];
}

export type AdminReportType = 'orders' | 'payments' | 'disputes' | 'commissions';

export const ADMIN_REPORT_TYPE_LABELS: Record<AdminReportType, string> = {
  orders: 'Commandes',
  payments: 'Paiements',
  disputes: 'Litiges',
  commissions: 'Commissions',
};

export interface AdminReportParams {
  from?: string;
  to?: string;
}

export interface AdminPeriodReport {
  period: { from: string; to: string; days: number };
  orders: {
    count: number;
    byStatus: Partial<Record<OrderStatus, number>>;
    grossAmount: number;
    averageBasket: number;
    delivered: number;
    cancelled: number;
    refunded: number;
  };
  revenue: { gross: number; commission: number; sellerNet: number; shipping: number };
  payments: {
    count: number;
    settled: number;
    amount: number;
    byMethod: Array<{ method: string; count: number; amount: number }>;
  };
  refunds: { count: number; amount: number };
  disputes: { opened: number; decided: number; byReason: Array<{ reasonCode: string; count: number }> };
  users: { newUsers: number; newSellers: number };
  topSellers: Array<{ sellerId: string; name: string; email: string | null; orders: number; amount: number; commission: number }>;
  topCategories: Array<{ categoryId: string; name: string; quantity: number; amount: number }>;
}
