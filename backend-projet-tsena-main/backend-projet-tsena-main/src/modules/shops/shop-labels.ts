import { ShopLevel, ShopStatus } from '../../database/entities/role.enum';

export const SHOP_LEVEL_LABELS: Record<ShopLevel, string> = {
  [ShopLevel.NEW]: 'Nouveau',
  [ShopLevel.VERIFIED]: 'Vérifié',
  [ShopLevel.GOLD]: 'Gold',
  [ShopLevel.PREMIUM]: 'Premium',
  [ShopLevel.FOUNDER]: 'Fondateur',
};

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  [ShopStatus.DRAFT]: 'Brouillon',
  [ShopStatus.PENDING_VERIFICATION]: 'En attente de vérification',
  [ShopStatus.ACTIVE]: 'Active',
  [ShopStatus.SUSPENDED]: 'Suspendue',
  [ShopStatus.DISABLED]: 'Désactivée',
  [ShopStatus.ARCHIVED]: 'Archivée',
};
