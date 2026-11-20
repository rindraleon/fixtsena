import type { ApiCategory, ApiOrder, ApiProduct, ApiUser, AuthResponse, CartData } from '../types/api';

export const NOW = '2026-09-01T10:00:00.000Z';

export const clientUser: ApiUser = {
  id: 'u-client-1',
  email: 'client@tsena.mg',
  firstName: 'Hery',
  lastName: 'Rakoto',
  phone: '0340000000',
  roles: ['client'],
  status: 'active',
  emailVerified: true,
  reputationScore: 0,
  sellerRequestedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const sellerUser: ApiUser = { ...clientUser, id: 'u-seller-1', email: 'vendeur@tsena.mg', firstName: 'Noro', lastName: 'Rabe', roles: ['seller'] };
export const adminUser: ApiUser = { ...clientUser, id: 'u-admin-1', email: 'admin@tsena.mg', firstName: 'Admin', lastName: 'TSENA', roles: ['admin'] };

export function authResponse(user: ApiUser, suffix = '1'): AuthResponse {
  return {
    user,
    tokens: { accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}`, tokenType: 'Bearer', expiresIn: 900 },
  };
}

export const category: ApiCategory = {
  id: 'cat-1',
  name: 'Artisanat',
  slug: 'artisanat',
  parentId: null,
  sortOrder: 0,
  isActive: true,
  productCount: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

export function product(overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    id: 'p-1',
    name: 'Panier en raphia',
    slug: 'panier-en-raphia',
    description: 'Panier tressé à la main.',
    shortDescription: 'Tressé main',
    sku: undefined,
    price: '25000',
    compareAtPrice: null,
    stockQuantity: 12,
    lowStockThreshold: 3,
    status: 'active',
    isFeatured: false,
    tags: [],
    categoryId: category.id,
    category,
    sellerId: sellerUser.id,
    seller: { id: sellerUser.id, firstName: 'Noro', lastName: 'Rabe', avatarUrl: null, reputationScore: 4.5, reviewCount: 12, memberSince: NOW },
    images: [],
    averageRating: 0,
    reviewCount: 0,
    salesCount: 3,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function cart(items: { productId: string; quantity: number; product?: ApiProduct }[] = []): CartData {
  const lines = items.map((item, index) => {
    const p = item.product ?? product({ id: item.productId });
    return {
      id: `ci-${index + 1}`,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: p.price,
      product: { id: p.id, name: p.name, slug: p.slug, images: p.images ?? [], stockQuantity: p.stockQuantity, status: p.status, price: p.price, sellerId: p.sellerId },
      subtotal: Number(p.price) * item.quantity,
    };
  });
  const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0);
  return {
    cart: { id: 'cart-1', userId: clientUser.id },
    items: lines,
    summary: { itemCount: lines.length, totalQuantity: lines.reduce((s, l) => s + l.quantity, 0), totalAmount },
  };
}

export function order(overrides: Partial<ApiOrder> = {}): ApiOrder {
  return {
    id: 'o-1',
    orderNumber: 'TSN-2026-0001',
    buyerId: clientUser.id,
    sellerId: sellerUser.id,
    status: 'pending',
    subtotalAmount: '25000',
    shippingAmount: '0',
    totalAmount: '25000',
    notes: null,
    lines: [{ id: 'ol-1', orderId: 'o-1', productId: 'p-1', productName: 'Panier en raphia', productSlug: 'panier-en-raphia', productImage: null, quantity: 1, unitPrice: '25000', totalPrice: '25000' }],
    buyer: { id: clientUser.id, firstName: 'Hery', lastName: 'Rakoto', email: clientUser.email, phone: null, avatarUrl: null },
    seller: { id: sellerUser.id, firstName: 'Noro', lastName: 'Rabe', email: sellerUser.email, phone: null, avatarUrl: null },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
