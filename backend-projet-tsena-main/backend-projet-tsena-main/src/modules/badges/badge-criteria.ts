export type BadgeAudience = 'seller' | 'buyer' | 'any';

export interface BadgeCriteria {
  mode?: 'auto' | 'manual';
  audience?: BadgeAudience;
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

export const CRITERIA_NUMERIC_KEYS: (keyof BadgeCriteria)[] = [
  'minAccountAgeDays', 'maxAccountAgeDays', 'minCompletedSales', 'maxCompletedSales', 'minAverageRating',
  'minReviewsReceived', 'maxIncidentRatePercent', 'minOnTimeDeliveryRatePercent', 'minRepliedReviews',
  'minCompletedPurchases', 'minReviewsGiven', 'maxDisputesOpened',
];

export function validateCriteria(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return 'Les critères doivent être un objet JSON';
  const c = input as Record<string, unknown>;
  if (c.mode !== undefined && c.mode !== 'auto' && c.mode !== 'manual') return "Le mode doit être 'auto' ou 'manual'";
  if (c.audience !== undefined && !['seller', 'buyer', 'any'].includes(String(c.audience))) return "Le public doit être 'seller', 'buyer' ou 'any'";
  for (const key of ['autoRevoke', 'identityVerified']) {
    if (c[key] !== undefined && typeof c[key] !== 'boolean') return `Le critère ${key} doit être un booléen`;
  }
  for (const key of CRITERIA_NUMERIC_KEYS) {
    const value = c[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return `Le critère ${key} doit être un nombre positif`;
    }
  }
  return null;
}

export function meetsCriteria(criteria: BadgeCriteria, stats: BadgeUserStats): boolean {
  if (criteria.mode === 'manual') return false;
  const audience = criteria.audience ?? 'any';
  if (audience === 'seller' && !stats.isSeller) return false;
  if (audience === 'buyer' && !stats.isBuyer) return false;

  const ge = (value: number | null, min?: number) => min === undefined || (value !== null && value >= min);
  const le = (value: number | null, max?: number) => max === undefined || (value !== null && value <= max);

  if (!ge(stats.accountAgeDays, criteria.minAccountAgeDays)) return false;
  if (!le(stats.accountAgeDays, criteria.maxAccountAgeDays)) return false;
  if (!ge(stats.completedSales, criteria.minCompletedSales)) return false;
  if (!le(stats.completedSales, criteria.maxCompletedSales)) return false;
  if (!ge(stats.averageRating, criteria.minAverageRating)) return false;
  if (!ge(stats.reviewsReceived, criteria.minReviewsReceived)) return false;
  if (!ge(stats.repliedReviews, criteria.minRepliedReviews)) return false;
  if (criteria.maxIncidentRatePercent !== undefined) {
    const base = stats.totalSales;
    const rate = base > 0 ? ((stats.disputesOnSales + stats.cancelledSales) / base) * 100 : 0;
    if (rate > criteria.maxIncidentRatePercent) return false;
  }
  if (!ge(stats.onTimeDeliveryRate, criteria.minOnTimeDeliveryRatePercent)) return false;
  if (criteria.identityVerified && !stats.identityVerified) return false;
  if (!ge(stats.completedPurchases, criteria.minCompletedPurchases)) return false;
  if (!ge(stats.reviewsGiven, criteria.minReviewsGiven)) return false;
  if (!le(stats.disputesOpened, criteria.maxDisputesOpened)) return false;
  return true;
}

export const DEFAULT_BADGES: Array<{ name: string; description: string; iconUrl: string | null; criteria: BadgeCriteria }> = [
  { name: 'Nouveau vendeur', description: 'Boutique récente : moins de 90 jours et moins de 10 ventes terminées.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: true, maxAccountAgeDays: 90, maxCompletedSales: 9 } },
  { name: 'Vendeur vérifié', description: 'Identité de la boutique vérifiée par l’administration.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: true, identityVerified: true } },
  { name: 'Vendeur de confiance', description: 'Au moins 20 ventes terminées, note moyenne ≥ 4,5 et moins de 5 % d’incidents.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: true, minCompletedSales: 20, minAverageRating: 4.5, minReviewsReceived: 5, maxIncidentRatePercent: 5 } },
  { name: 'Livraison rapide', description: 'Au moins 90 % des livraisons dans les délais sur 10 ventes minimum.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: true, minCompletedSales: 10, minOnTimeDeliveryRatePercent: 90 } },
  { name: 'Vendeur réactif', description: 'Répond aux avis de ses clients (au moins 5 réponses).', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: false, minRepliedReviews: 5 } },
  { name: 'Excellent service', description: 'Note moyenne ≥ 4,8 sur au moins 15 avis.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'auto', autoRevoke: true, minAverageRating: 4.8, minReviewsReceived: 15 } },
  { name: 'Acheteur fiable', description: 'Au moins 5 achats terminés sans litige ouvert.', iconUrl: null,
    criteria: { audience: 'buyer', mode: 'auto', autoRevoke: false, minCompletedPurchases: 5, maxDisputesOpened: 0 } },
  { name: 'Membre actif', description: 'Membre depuis plus de 6 mois ayant déposé au moins 5 avis.', iconUrl: null,
    criteria: { audience: 'any', mode: 'auto', autoRevoke: false, minAccountAgeDays: 180, minReviewsGiven: 5 } },
  { name: 'Réputation excellente', description: 'Distinction décernée manuellement par l’administration.', iconUrl: null,
    criteria: { audience: 'seller', mode: 'manual' } },
];
