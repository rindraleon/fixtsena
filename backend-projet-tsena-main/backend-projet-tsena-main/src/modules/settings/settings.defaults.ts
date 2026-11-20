export interface LevelThreshold {
  minMonths: number;
  minOrders: number;
  maxOrders: number | null;
  minRating: number;
  maxIncidentRate: number;
  minOnTimeRate: number | null;
  identityRequired: boolean;
}

export interface PromotionOffer {
  type: 'boost' | 'highlight' | 'featured';
  durationDays: number;
  price: number;
}

export const SETTINGS_DEFAULTS = {
  'account.majorityAge': 18,
  'account.birthDateRequiredForPurchase': false,

  'subscriptions.gold.monthlyPrice': 10_000,
  'subscriptions.gold.yearlyPrice': 100_000,
  'subscriptions.gold.slots': 100,
  'subscriptions.premium.monthlyPrice': 30_000,
  'subscriptions.premium.yearlyPrice': 300_000,
  'subscriptions.premium.slots': 50,
  'subscriptions.expiryAlertDays': 7,

  'levels.thresholds': {
    verified: { minMonths: 3, minOrders: 30, maxOrders: 199, minRating: 4, maxIncidentRate: 10, minOnTimeRate: null, identityRequired: true },
    gold: { minMonths: 3, minOrders: 30, maxOrders: 199, minRating: 4, maxIncidentRate: 10, minOnTimeRate: 90, identityRequired: true },
    premium: { minMonths: 6, minOrders: 200, maxOrders: null, minRating: 4.5, maxIncidentRate: 5, minOnTimeRate: 95, identityRequired: true },
  } as Record<'verified' | 'gold' | 'premium', LevelThreshold>,
  'levels.onTimeDeliveryDays': 5,

  'commissions.defaultRates': { new: 8, verified: 7, big_seller: 6 },
  'commissions.bigSellerLevels': ['gold', 'premium', 'founder'],
  'commissions.refundPolicy': 'partial',

  'delivery.logisticsMarginPercent': 20,
  'delivery.logisticsFixedCost': 1_000,

  'promotions.offers': [
    { type: 'boost', durationDays: 3, price: 1_000 },
    { type: 'boost', durationDays: 7, price: 2_000 },
    { type: 'highlight', durationDays: 7, price: 4_000 },
    { type: 'highlight', durationDays: 15, price: 6_000 },
    { type: 'featured', durationDays: 7, price: 5_000 },
    { type: 'featured', durationDays: 30, price: 6_000 },
  ] as PromotionOffer[],
  'promotions.levelDiscounts': { gold: 10, premium: 20, founder: 20 },
  'promotions.maxActivePerSeller': 10,

  'notifications.emailRetryCount': 3,
  'notifications.helpEmail': 'support@tsena.mg',

  'follows.notifyNewProducts': true,
  'follows.notifyPromotions': true,

  'messaging.attachmentsAllowed': true,
  'messaging.maxAttachmentSizeMb': 5,
  'messaging.maxMessageLength': 2_000,

  'reviews.disputeDelayDays': 7,
  'reviews.editWindowHours': 48,
  'reviews.minCommentLength': 0,

  'privacy.dataRetentionMonths': 36,

  'disputes.openingWindowDays': 7,

  'escrow.autoReleaseDays': 7,

  'badges.autoAward': true,

  'products.moderationRequired': false,

  'maintenance.intervalMinutes': 60,
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;
export type SettingsMap = { [K in SettingKey]: (typeof SETTINGS_DEFAULTS)[K] };

export const SETTINGS_GROUPS: Array<{ id: string; label: string; keys: SettingKey[] }> = [
  { id: 'account', label: 'Comptes clients', keys: ['account.majorityAge', 'account.birthDateRequiredForPurchase'] },
  {
    id: 'subscriptions',
    label: 'Abonnements vendeur',
    keys: [
      'subscriptions.gold.monthlyPrice', 'subscriptions.gold.yearlyPrice', 'subscriptions.gold.slots',
      'subscriptions.premium.monthlyPrice', 'subscriptions.premium.yearlyPrice', 'subscriptions.premium.slots',
      'subscriptions.expiryAlertDays',
    ],
  },
  { id: 'levels', label: 'Niveaux vendeur', keys: ['levels.thresholds', 'levels.onTimeDeliveryDays'] },
  { id: 'commissions', label: 'Commissions', keys: ['commissions.defaultRates', 'commissions.bigSellerLevels', 'commissions.refundPolicy'] },
  { id: 'delivery', label: 'Livraison', keys: ['delivery.logisticsMarginPercent', 'delivery.logisticsFixedCost'] },
  { id: 'promotions', label: 'Promotions', keys: ['promotions.offers', 'promotions.levelDiscounts', 'promotions.maxActivePerSeller'] },
  { id: 'notifications', label: 'Notifications', keys: ['notifications.emailRetryCount', 'notifications.helpEmail'] },
  { id: 'follows', label: 'Abonnements clients aux boutiques', keys: ['follows.notifyNewProducts', 'follows.notifyPromotions'] },
  { id: 'messaging', label: 'Messagerie', keys: ['messaging.attachmentsAllowed', 'messaging.maxAttachmentSizeMb', 'messaging.maxMessageLength'] },
  { id: 'reviews', label: 'Avis', keys: ['reviews.disputeDelayDays', 'reviews.editWindowHours', 'reviews.minCommentLength'] },
  { id: 'privacy', label: 'Données personnelles', keys: ['privacy.dataRetentionMonths'] },
  { id: 'disputes', label: 'Litiges', keys: ['disputes.openingWindowDays'] },
  { id: 'escrow', label: 'Séquestre', keys: ['escrow.autoReleaseDays'] },
  { id: 'badges', label: 'Badges', keys: ['badges.autoAward'] },
  { id: 'products', label: 'Catalogue', keys: ['products.moderationRequired'] },
  { id: 'maintenance', label: 'Tâches planifiées', keys: ['maintenance.intervalMinutes'] },
];
