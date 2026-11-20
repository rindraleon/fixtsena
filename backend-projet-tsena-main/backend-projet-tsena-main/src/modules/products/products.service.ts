import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Product, ProductImage, Category } from '../../database/entities/catalog.entity';
import { User } from '../../database/entities/user.entity';
import { Shop, ShopFollow } from '../../database/entities/marketplace.entity';
import { ShopLevel, ShopStatus } from '../../database/entities/role.enum';
import { PromotionsService, ActivePromotionSummary } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { SHOP_LEVEL_LABELS } from '../shops/shop-labels';
import { ShopsService } from '../shops/shops.service';
import { CreateProductDto, UpdateProductDto, FilterProductDto } from './dto/product.dto';
import { ProductStatus, UserRole } from '../../database/entities/role.enum';
import { StorageService } from '../upload/storage/storage.service';

export interface ProductSellerSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  reviewCount: number;
  memberSince: Date;
}

export interface ProductShopSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  level: ShopLevel;
  levelLabel: string;
  status: ShopStatus;
}

export type ProductView = Product & {
  seller: ProductSellerSummary | null;
  shop: ProductShopSummary | null;
  promotions: ActivePromotionSummary[];
  isSponsored: boolean;
};

const PUBLICLY_VISIBLE_STATUSES: ProductStatus[] = [
  ProductStatus.ACTIVE,
  ProductStatus.PUBLISHED,
  ProductStatus.SOLD_OUT,
];

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly shopsService: ShopsService,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly promotions?: PromotionsService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  async create(dto: CreateProductDto, sellerId: string, userRoles: UserRole[] = []): Promise<Product> {

    await this.requireSellerShop(sellerId, userRoles);

    if (!dto.slug && dto.name) {
      dto.slug = await this.uniqueSlug(dto.name);
    }

    if (dto.sku) {
      const existing = await this.productRepository.findOne({
        where: { sku: dto.sku },
      });
      if (existing) {
        throw new ConflictException('Un produit avec ce SKU existe déjà');
      }
    }

    if (dto.slug) {
      const existingSlug = await this.productRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        dto.slug = await this.uniqueSlug(dto.slug);
      }
    }

    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException('La catégorie spécifiée n\'existe pas');
    }

    const { images, ...productData } = dto;

    if ((dto.status === ProductStatus.ACTIVE || dto.status === ProductStatus.PUBLISHED) && this.moderationRequired()) {
      dto.status = ProductStatus.PENDING_REVIEW;
    }

    const product = this.productRepository.create({
      ...productData,
      sellerId,
      createdById: sellerId,
      status: dto.status || ProductStatus.DRAFT,
      stockQuantity: dto.stockQuantity ?? 0,
      lowStockThreshold: dto.lowStockThreshold ?? 5,
      isFeatured: dto.isFeatured ?? false,
      tags: dto.tags || [],
    });

    const savedProduct = await this.productRepository.save(product);

    if (images && images.length > 0) {
      const productImages = images.map((img, index) =>
        this.productImageRepository.create({
          ...img,
          productId: savedProduct.id,
          sortOrder: img.sortOrder ?? index,
          isPrimary: img.isPrimary ?? (index === 0),
        }),
      );
      await this.productImageRepository.save(productImages);
    }

    if (PUBLICLY_VISIBLE_STATUSES.includes(savedProduct.status)) {
      await this.notifyFollowersOfNewProduct(savedProduct);
    }

    return this.findById(savedProduct.id);
  }

  async findAll(filters: FilterProductDto, currentUser?: { id: string; roles: UserRole[] }) {
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      status,
      sellerId,
      isFeatured,
      inStock,
      tags,
      city,
      sortBy = 'createdAt',
      order = 'DESC',
      page = 1,
      limit = 20,
    } = filters;

    const qb = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images');

    if (search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.shortDescription ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    const isAdmin = !!currentUser && currentUser.roles.includes(UserRole.ADMIN);
    const isOwnCatalog = !!currentUser && !!sellerId && sellerId === currentUser.id;
    if (isAdmin || isOwnCatalog) {
      if (status) {
        qb.andWhere('product.status = :status', { status });
      }
    } else {
      qb.andWhere('product.status = :status', { status: ProductStatus.ACTIVE });
    }

    if (sellerId) {
      qb.andWhere('product.sellerId = :sellerId', { sellerId });
    }

    if (isFeatured !== undefined) {
      qb.andWhere('product.isFeatured = :isFeatured', { isFeatured });
    }

    if (inStock === true) {
      qb.andWhere('product.stockQuantity > 0');
    }

    if (city && city.trim()) {
      qb.andWhere(
        (sub) => `EXISTS ${sub.subQuery().select('1').from(Shop, 'loc_shop').where('loc_shop.ownerId = product.sellerId').andWhere('LOWER(loc_shop.city) = LOWER(:city)').getQuery()}`,
        { city: city.trim() },
      );
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      tagArray.forEach((tag, index) => {
        qb.andWhere(`product.tags LIKE :tag${index}`, { [tag + index]: `%${tag}%` });
      });
    }

    const validSortFields = ['name', 'price', 'createdAt', 'updatedAt', 'stockQuantity', 'salesCount', 'averageRating'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sponsoredIds = this.promotions && sortField === 'createdAt' ? await this.promotions.activeProductIds().catch(() => [] as string[]) : [];
    if (sponsoredIds.length > 0) {
      qb.addSelect(`CASE WHEN product.id IN (:...sponsoredIds) THEN 0 ELSE 1 END`, 'sponsored_rank')
        .setParameter('sponsoredIds', sponsoredIds)
        .orderBy('sponsored_rank', 'ASC')
        .addOrderBy(`product.${sortField}`, order === 'ASC' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy(`product.${sortField}`, order === 'ASC' ? 'ASC' : 'DESC');
    }

    const total = await qb.getCount();
    const products = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const items = await this.attachSellers(products);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async locations(): Promise<Array<{ city: string; count: number }>> {
    const rows = await this.productRepository.manager
      .getRepository(Shop)
      .createQueryBuilder('shop')
      .innerJoin(Product, 'p', 'p.sellerId = shop.ownerId AND p.status = :status AND p.deletedAt IS NULL', { status: ProductStatus.ACTIVE })
      .select('shop.city', 'city')
      .addSelect('COUNT(p.id)', 'count')
      .where('shop.city IS NOT NULL')
      .groupBy('shop.city')
      .orderBy('COUNT(p.id)', 'DESC')
      .addOrderBy('shop.city', 'ASC')
      .getRawMany<{ city: string; count: string }>();
    return rows.map((row) => ({ city: row.city, count: Number(row.count) }));
  }

  async findById(id: string): Promise<ProductView> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    const [view] = await this.attachSellers([product]);
    return view;
  }

  async findPublic(
    idOrSlug: string,
    viewer?: { id: string; roles: UserRole[] },
  ): Promise<ProductView> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const product = isUUID ? await this.findById(idOrSlug) : await this.findBySlug(idOrSlug);

    const isPublished = PUBLICLY_VISIBLE_STATUSES.includes(product.status);
    const isOwner = !!viewer && viewer.id === product.sellerId;
    const isAdmin = !!viewer && viewer.roles.includes(UserRole.ADMIN);
    if (!isPublished && !isOwner && !isAdmin) {
      throw new NotFoundException('Produit non trouvé');
    }
    return product;
  }

  private async attachSellers(products: Product[]): Promise<ProductView[]> {
    if (products.length === 0) return [];
    const sellerIds = [...new Set(products.map((p) => p.sellerId))];
    const sellers = await this.userRepository.find({
      where: { id: In(sellerIds) },
      select: ['id', 'firstName', 'lastName', 'avatarUrl', 'reputationScore', 'reviewCount', 'createdAt'],
      withDeleted: true,
    });
    const byId = new Map(
      sellers.map((u) => [
        u.id,
        {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName ?? null,
          avatarUrl: u.avatarUrl ?? null,
          reputationScore: Number(u.reputationScore ?? 0),
          reviewCount: Number(u.reviewCount ?? 0),
          memberSince: u.createdAt,
        },
      ]),
    );
    const shops = await this.productRepository.manager
      .getRepository(Shop)
      .find({ where: { ownerId: In(sellerIds) } })
      .catch(() => [] as Shop[]);
    const shopByOwner = new Map<string, ProductShopSummary>(
      shops.map((shop) => [
        shop.ownerId,
        {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          logoUrl: shop.logoUrl ?? null,
          city: shop.city ?? null,
          level: shop.level,
          levelLabel: SHOP_LEVEL_LABELS[shop.level] ?? shop.level,
          status: shop.status,
        },
      ]),
    );
    const promotionsByProduct = this.promotions
      ? await this.promotions.activeByProductIds(products.map((p) => p.id)).catch(() => new Map<string, ActivePromotionSummary[]>())
      : new Map<string, ActivePromotionSummary[]>();

    return products.map((product) => {
      const promotions = promotionsByProduct.get(product.id) ?? [];
      return {
        ...product,
        seller: byId.get(product.sellerId) ?? null,
        shop: shopByOwner.get(product.sellerId) ?? null,
        promotions,
        isSponsored: promotions.length > 0,
      };
    });
  }

  async notifyFollowersOfNewProduct(product: Product): Promise<void> {
    if (!this.notifications) return;
    try {
      const manager = this.productRepository.manager;
      const shop = await manager.getRepository(Shop).findOne({ where: { ownerId: product.sellerId } });
      if (!shop || shop.status !== ShopStatus.ACTIVE) return;
      const follows = await manager.getRepository(ShopFollow).find({ where: { shopId: shop.id }, select: ['userId'] });
      if (follows.length === 0) return;
      await this.notifications.notifyMany(
        follows.map((f) => f.userId),
        (userId) => ({
          userId,
          type: 'follow.new_product',
          title: `Nouveauté chez ${shop.name}`,
          body: `« ${product.name} » vient d'être mis en vente à ${Number(product.price).toLocaleString('fr-FR')} Ar.`,
          link: `/produits/${product.slug}`,
          metadata: { shopId: shop.id, productId: product.id },
          email: { status: 'Nouveau produit', nextAction: 'Découvrir le produit', actionLabel: 'Voir le produit' },
        }),
      );
    } catch (error) {
      void error;
    }
  }

  async findBySlug(slug: string): Promise<ProductView> {
    const product = await this.productRepository.findOne({
      where: { slug },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    const [view] = await this.attachSellers([product]);
    return view;
  }

  private moderationRequired(): boolean {
    try {
      return (this.settings?.get('products.moderationRequired') as unknown) === true;
    } catch {
      return false;
    }
  }

  async update(id: string, dto: UpdateProductDto, userId: string, userRoles: UserRole[]): Promise<Product> {
    const product = await this.findById(id);

    if (product.sellerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de modifier ce produit');
    }

    await this.requireSellerShop(product.sellerId, userRoles);

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.productRepository.findOne({
        where: { sku: dto.sku },
      });
      if (existing) {
        throw new ConflictException('Un produit avec ce SKU existe déjà');
      }
    }

    if (dto.name && !dto.slug && dto.name !== product.name) {
      dto.slug = await this.uniqueSlug(dto.name, product.id);
    }

    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('La catégorie spécifiée n\'existe pas');
      }
    }

    if (!userRoles.includes(UserRole.ADMIN)) {
      if (dto.status !== undefined && dto.status !== product.status) {
        const locked = [ProductStatus.SUSPENDED, ProductStatus.REJECTED];
        if (locked.includes(product.status) && dto.status !== ProductStatus.ARCHIVED && dto.status !== ProductStatus.DRAFT) {
          throw new ForbiddenException(
            product.status === ProductStatus.SUSPENDED
              ? 'Ce produit a été suspendu par l’administration : contactez le support pour le remettre en ligne'
              : 'Ce produit a été refusé : corrigez la fiche (brouillon) puis soumettez-la à nouveau',
          );
        }
        const sellerAllowed = [ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.PUBLISHED, ProductStatus.UNAVAILABLE, ProductStatus.ARCHIVED, ProductStatus.PENDING_REVIEW];
        if (!sellerAllowed.includes(dto.status)) {
          throw new ForbiddenException('Statut non autorisé pour un vendeur');
        }
        if (dto.status === ProductStatus.ACTIVE || dto.status === ProductStatus.PUBLISHED) {
          if (this.moderationRequired()) dto.status = ProductStatus.PENDING_REVIEW;
          if (product.stockQuantity <= 0 && (dto.stockQuantity ?? 0) <= 0) {
            throw new BadRequestException('Impossible de publier un produit sans stock : renseignez une quantité disponible');
          }
        }
      }
    }

    const wasVisible = PUBLICLY_VISIBLE_STATUSES.includes(product.status);
    Object.assign(product, dto);
    const updated = await this.productRepository.save(product);
    if (!wasVisible && PUBLICLY_VISIBLE_STATUSES.includes(updated.status)) {
      await this.notifyFollowersOfNewProduct(updated);
    }
    return this.findById(updated.id);
  }

  async remove(id: string, userId: string, userRoles: UserRole[]): Promise<void> {
    const product = await this.findById(id);

    if (product.sellerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de supprimer ce produit');
    }
    await this.requireSellerShop(product.sellerId, userRoles);

    product.status = ProductStatus.ARCHIVED;
    await this.productRepository.save(product);
    await this.productRepository.softRemove(product);
  }

  async assertCanManage(productId: string, userId: string, userRoles: UserRole[]): Promise<Product> {
    const product = await this.findById(productId);
    if (product.sellerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de modifier ce produit');
    }
    await this.requireSellerShop(product.sellerId, userRoles);
    return product;
  }

  private async requireSellerShop(sellerId: string, userRoles: UserRole[] = []): Promise<void> {
    if (userRoles.includes(UserRole.ADMIN)) return;
    await this.shopsService.requireShop(sellerId);
  }

  async addImage(
    productId: string,
    imageUrl: string,
    alt: string | undefined,
    isPrimary: boolean | undefined,
    userId: string,
    userRoles: UserRole[],
  ): Promise<ProductImage> {
    const product = await this.findById(productId);

    if (product.sellerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de modifier ce produit');
    }

    const count = await this.productImageRepository.count({ where: { productId } });
    if (count >= ProductsService.MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException(
        `Un produit accepte au maximum ${ProductsService.MAX_IMAGES_PER_PRODUCT} images (1 couverture + ${ProductsService.MAX_IMAGES_PER_PRODUCT - 1} images de présentation)`,
      );
    }

    if (isPrimary) {
      await this.productImageRepository.update(
        { productId },
        { isPrimary: false },
      );
    }

    const image = this.productImageRepository.create({
      url: imageUrl,
      alt: alt || product.name,
      productId,
      sortOrder: isPrimary ? -1 : count,
      isPrimary: isPrimary ?? (count === 0),
    });

    const saved = await this.productImageRepository.save(image);
    if (isPrimary) await this.normalizeImageOrder(productId);
    return saved;
  }

  static readonly MAX_IMAGES_PER_PRODUCT = 10;

  async setPrimaryImage(productId: string, imageId: string, userId: string, userRoles: UserRole[]): Promise<ProductImage[]> {
    await this.assertCanManage(productId, userId, userRoles);
    const image = await this.productImageRepository.findOne({ where: { id: imageId, productId } });
    if (!image) {
      throw new NotFoundException('Image non trouvée pour ce produit');
    }
    await this.productImageRepository.update({ productId }, { isPrimary: false });
    await this.productImageRepository.update({ id: imageId }, { isPrimary: true, sortOrder: -1 });
    return this.normalizeImageOrder(productId);
  }

  async reorderImages(productId: string, imageIds: string[], userId: string, userRoles: UserRole[]): Promise<ProductImage[]> {
    await this.assertCanManage(productId, userId, userRoles);
    const images = await this.productImageRepository.find({ where: { productId } });
    const known = new Set(images.map((img) => img.id));
    const unknown = imageIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException('Certaines images ne font pas partie de ce produit');
    }
    const rank = new Map(imageIds.map((id, index) => [id, index]));
    const ordered = [...images].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.sortOrder - b.sortOrder;
    });
    for (const [index, img] of ordered.entries()) {
      if (img.sortOrder !== index) await this.productImageRepository.update({ id: img.id }, { sortOrder: index });
    }
    return this.listImages(productId);
  }

  async listImages(productId: string): Promise<ProductImage[]> {
    return this.productImageRepository.find({ where: { productId }, order: { isPrimary: 'DESC', sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  private async normalizeImageOrder(productId: string): Promise<ProductImage[]> {
    const images = await this.listImages(productId);
    if (images.length === 0) return images;
    if (!images.some((img) => img.isPrimary)) {
      images[0].isPrimary = true;
    }
    let primarySeen = false;
    for (const [index, img] of images.entries()) {
      const shouldBePrimary = img.isPrimary && !primarySeen;
      if (img.isPrimary) primarySeen = true;
      if (img.isPrimary !== shouldBePrimary || img.sortOrder !== index) {
        img.isPrimary = shouldBePrimary;
        img.sortOrder = index;
        await this.productImageRepository.update({ id: img.id }, { isPrimary: shouldBePrimary, sortOrder: index });
      }
    }
    return images;
  }

  async removeImage(imageId: string, userId: string, userRoles: UserRole[]): Promise<void> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
      relations: ['product'],
    });

    if (!image) {
      throw new NotFoundException('Image non trouvée');
    }

    if (image.product.sellerId !== userId && !userRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Vous n\'avez pas la permission de supprimer cette image');
    }

    const { productId, url, isPrimary } = image;
    await this.productImageRepository.remove(image);
    await this.storage?.removeByUrl(url);
    if (isPrimary) await this.normalizeImageOrder(productId);
  }

  async getSellerStats(sellerId: string) {
    const totalProducts = await this.productRepository.count({ where: { sellerId } });
    const activeProducts = await this.productRepository.count({
      where: { sellerId, status: ProductStatus.ACTIVE },
    });
    const draftProducts = await this.productRepository.count({
      where: { sellerId, status: ProductStatus.DRAFT },
    });
    const outOfStock = await this.productRepository.count({
      where: { sellerId, stockQuantity: 0 },
    });
    const lowStock = await this.productRepository
      .createQueryBuilder('product')
      .where('product.sellerId = :sellerId', { sellerId })
      .andWhere('product.stockQuantity > 0')
      .andWhere('product.stockQuantity <= product."lowStockThreshold"')
      .getCount();

    return {
      totalProducts,
      activeProducts,
      draftProducts,
      outOfStock,
      lowStock,
    };
  }

  async getFeatured(limit: number = 10): Promise<ProductView[]> {
    const products = await this.productRepository.find({
      where: {
        isFeatured: true,
        status: ProductStatus.ACTIVE,
      },
      relations: ['category', 'images'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachSellers(products);
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return base || 'produit';
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = this.generateSlug(name);
    const taken = await this.productRepository.find({
      where: { slug: Like(`${base}%`) },
      select: ['id', 'slug'],
      withDeleted: true,
    });
    const used = new Set(taken.filter((p) => p.id !== excludeId).map((p) => p.slug));
    if (!used.has(base)) return base;
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${base}-${i}`;
      if (!used.has(candidate)) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
