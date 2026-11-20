import { ShopStatus } from '../../database/entities/role.enum';
import type { Shop } from '../../database/entities/marketplace.entity';

export const SHOP_REQUIRED_MESSAGE =
  "Vous devez créer votre boutique avant d'accéder aux fonctionnalités de vente.";

export const SHOP_ARCHIVED_MESSAGE =
  "Votre boutique a été archivée : contactez le support Tsena pour la réactiver avant de poursuivre vos ventes.";

export function isShopOperable(shop: Pick<Shop, 'status'> | null | undefined): boolean {
  return !!shop && shop.status !== ShopStatus.ARCHIVED;
}
