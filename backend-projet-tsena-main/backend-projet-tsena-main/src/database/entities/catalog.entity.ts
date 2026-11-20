import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { ProductStatus } from './role.enum';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  iconUrl: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId: string;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @Column({ type: 'int', default: 0 })
  productCount: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ unique: true, nullable: true })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 12, scale: 2 })
  @Index()
  price: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  compareAtPrice: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  costPrice: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  sku: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', default: 5 })
  lowStockThreshold: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  weight: number;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'uuid' })
  @Index()
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  @Index()
  status: ProductStatus;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column({ default: false })
  @Index()
  isFeatured: boolean;

  @Column({ nullable: true })
  publishedAt: Date;

  @Column({ type: 'uuid' })
  @Index()
  createdById: string;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: ['insert', 'update'] })
  images: ProductImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

@Entity('product_images')
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  alt: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'uuid' })
  @Index()
  productId: string;

  @ManyToOne(() => Product, (product) => product.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
