import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, Product } from '../../database/entities/catalog.entity';
import { ProductStatus } from '../../database/entities/role.enum';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  iconUrl?: string | null;
  productCount: number;
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (!dto.slug && dto.name) {
      dto.slug = this.generateSlug(dto.name);
    }

    if (dto.slug) {
      const existing = await this.categoryRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException('Une catégorie avec ce slug existe déjà');
      }
    }

    if (dto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('La catégorie parente spécifiée n\'existe pas');
      }
    }

    const category = this.categoryRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    parentId?: string;
    isActive?: boolean;
    includeInactive?: boolean;
  }) {
    const { page = 1, limit = 50, search, parentId, isActive, includeInactive = false } = params;

    const qb = this.categoryRepository.createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('category.children', 'children');

    if (search) {
      qb.andWhere('(category.name ILIKE :search OR category.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        qb.andWhere('category.parentId IS NULL');
      } else {
        qb.andWhere('category.parentId = :parentId', { parentId });
      }
    }

    if (isActive !== undefined) {
      qb.andWhere('category.isActive = :isActive', { isActive });
    } else if (!includeInactive) {
      qb.andWhere('category.isActive = :isActive', { isActive: true });
    }

    qb.orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC');

    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const counts = await this.countActiveProductsByCategory(rows.map((c) => c.id));
    const items = rows.map((category) => ({ ...category, productCount: counts.get(category.id) ?? 0 }));

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

  async findById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['parent', 'children', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findById(id);

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.categoryRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException('Une catégorie avec ce slug existe déjà');
      }
    }

    if (dto.name && !dto.slug) {
      dto.slug = this.generateSlug(dto.name);
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Une catégorie ne peut pas être son propre parent');
      }
      const parent = await this.categoryRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('La catégorie parente spécifiée n\'existe pas');
      }
    }

    Object.assign(category, dto);
    return await this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);

    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childrenCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une catégorie qui contient des sous-catégories'
      );
    }

    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une catégorie qui contient des produits'
      );
    }

    await this.categoryRepository.softRemove(category);
  }

  private async countActiveProductsByCategory(categoryIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (categoryIds.length === 0) return counts;
    const rows: { categoryId: string; count: string }[] = await this.categoryRepository.manager
      .createQueryBuilder(Product, 'product')
      .select('product.categoryId', 'categoryId')
      .addSelect('COUNT(product.id)', 'count')
      .where('product.categoryId IN (:...categoryIds)', { categoryIds })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.deletedAt IS NULL')
      .groupBy('product.categoryId')
      .getRawMany();
    rows.forEach((row) => counts.set(row.categoryId, Number(row.count)));
    return counts;
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const counts = await this.countActiveProductsByCategory(categories.map((c) => c.id));

    const nodes = new Map<string, CategoryTreeNode>();
    categories.forEach((cat) => {
      nodes.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        iconUrl: cat.iconUrl,
        productCount: counts.get(cat.id) ?? 0,
        children: [],
      });
    });

    const roots: CategoryTreeNode[] = [];
    categories.forEach((cat) => {
      const node = nodes.get(cat.id)!;
      const parent = cat.parentId ? nodes.get(cat.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });

    return roots;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
