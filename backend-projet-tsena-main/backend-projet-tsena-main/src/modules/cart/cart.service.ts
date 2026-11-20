import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cart, CartItem } from '../../database/entities/transaction.entity';
import { Product } from '../../database/entities/catalog.entity';
import { ProductStatus } from '../../database/entities/role.enum';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

export const ORDERABLE_PRODUCT_STATUSES: readonly ProductStatus[] = [ProductStatus.ACTIVE, ProductStatus.PUBLISHED];

export function productUnavailableReason(product: Pick<Product, 'status' | 'name'>): string | null {
  if (ORDERABLE_PRODUCT_STATUSES.includes(product.status)) return null;
  switch (product.status) {
    case ProductStatus.SOLD_OUT:
      return `« ${product.name} » est épuisé`;
    case ProductStatus.UNAVAILABLE:
      return `« ${product.name} » est momentanément indisponible`;
    case ProductStatus.SUSPENDED:
    case ProductStatus.REJECTED:
      return `« ${product.name} » n'est plus proposé à la vente`;
    default:
      return `« ${product.name} » n'est pas (ou plus) publié`;
  }
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { userId },
    });

    if (!cart) {
      cart = this.cartRepository.create({ userId });
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const items = await this.cartItemRepository.find({
      where: { cartId: cart.id },
      order: { createdAt: 'DESC' },
    });

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = productIds.length
      ? await this.productRepository.find({ where: { id: In(productIds) }, relations: ['images'] })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));

    const enrichedItems = items.map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        product: product
          ? {
              id: product.id,
              name: product.name,
              slug: product.slug,
              images: product.images?.filter((img) => img.isPrimary) || [],
              stockQuantity: product.stockQuantity,
              status: product.status,
              price: product.price,
              sellerId: product.sellerId,
              categoryId: product.categoryId ?? null,
            }
          : null,
        subtotal: Number(item.unitPrice) * item.quantity,
      };
    });

    const totalAmount = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      cart,
      items: enrichedItems,
      summary: {
        itemCount: enrichedItems.length,
        totalQuantity: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: Math.round(totalAmount * 100) / 100,
      },
    };
  }

  async addItem(userId: string, dto: AddToCartDto) {
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    const unavailable = productUnavailableReason(product);
    if (unavailable) {
      throw new BadRequestException(`${unavailable} : impossible de l'ajouter au panier`);
    }

    if (product.stockQuantity < dto.quantity) {
      throw new BadRequestException(
        `Stock insuffisant. Disponible: ${product.stockQuantity}, demandé: ${dto.quantity}`
      );
    }

    const cart = await this.getOrCreateCart(userId);

    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId: dto.productId },
    });

    if (cartItem) {
      const newQuantity = cartItem.quantity + dto.quantity;
      if (newQuantity > product.stockQuantity) {
        throw new BadRequestException(
          `Stock insuffisant. Maximum disponible: ${product.stockQuantity}`
        );
      }
      cartItem.quantity = newQuantity;
    } else {
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: product.price,
      });
    }

    await this.cartItemRepository.save(cartItem);
    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException('Article non trouvé dans le panier');
    }

    const product = await this.productRepository.findOne({
      where: { id: cartItem.productId },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    if (dto.quantity > product.stockQuantity) {
      throw new BadRequestException(
        `Stock insuffisant. Maximum disponible: ${product.stockQuantity}`
      );
    }

    cartItem.quantity = dto.quantity;
    await this.cartItemRepository.save(cartItem);

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException('Article non trouvé dans le panier');
    }

    await this.cartItemRepository.remove(cartItem);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepository.delete({ cartId: cart.id });
    return this.getCart(userId);
  }

  async getCartItemCount(userId: string): Promise<number> {
    const cart = await this.cartRepository.findOne({ where: { userId } });
    if (!cart) return 0;

    const result = await this.cartItemRepository
      .createQueryBuilder('item')
      .select('SUM(item.quantity)', 'total')
      .where('item.cartId = :cartId', { cartId: cart.id })
      .getRawOne();

    return result?.total ? parseInt(result.total, 10) : 0;
  }

  async prepareForCheckout(userId: string, options: { allowEmpty?: boolean } = {}) {
    const { items } = await this.getCart(userId);

    if (items.length === 0) {
      if (options.allowEmpty) return new Map<string, typeof items>();
      throw new BadRequestException('Le panier est vide');
    }

    for (const item of items) {
      if (!item.product) {
        throw new BadRequestException(`Produit ${item.productId} introuvable`);
      }
      const unavailable = productUnavailableReason(item.product);
      if (unavailable) {
        throw new BadRequestException(`${unavailable} : retirez-le du panier pour poursuivre la commande`);
      }
      if (item.product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour "${item.product.name}". Disponible: ${item.product.stockQuantity}`
        );
      }
    }

    const groupedBySeller = new Map<string, typeof items>();
    for (const item of items) {
      const sellerId = item.product!.sellerId;

      if (!groupedBySeller.has(sellerId)) {
        groupedBySeller.set(sellerId, []);
      }
      groupedBySeller.get(sellerId)!.push(item);
    }

    return groupedBySeller;
  }
}
