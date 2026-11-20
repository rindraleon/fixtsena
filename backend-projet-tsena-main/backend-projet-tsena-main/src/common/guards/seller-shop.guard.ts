import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ShopsService } from '../../modules/shops/shops.service';
import { SHOP_REQUIRED_MESSAGE } from '../../modules/shops/shop-access';
import type { Shop } from '../../database/entities/marketplace.entity';
import { UserRole } from '../../database/entities/role.enum';

type AuthenticatedRequest = Request & {
  user?: { id: string; roles?: UserRole[] };

  shop?: Shop;
};

export function isSellerWithoutShopScope(user?: { roles?: UserRole[] } | null): boolean {
  const roles = user?.roles ?? [];
  return roles.includes(UserRole.SELLER) && !roles.includes(UserRole.ADMIN);
}

@Injectable()
export class SellerShopGuard implements CanActivate {
  constructor(private readonly shopsService: ShopsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !isSellerWithoutShopScope(user)) return true;

    request.shop = await this.shopsService.requireShop(user.id, SHOP_REQUIRED_MESSAGE);
    return true;
  }
}
