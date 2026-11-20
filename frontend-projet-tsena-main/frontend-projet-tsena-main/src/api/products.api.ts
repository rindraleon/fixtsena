import { cleanParams, del, get, getPaginated, patch, post, put } from './client';
import type {
  ApiProduct,
  ApiProductImage,
  CreateProductDto,
  Paginated,
  ProductFilters,
  ProductImageInput,
  ProductLocation,
  SellerProductStats,
  UpdateProductDto,
} from '../types/api';

export const productsApi = {
  list: (filters: ProductFilters = {}): Promise<Paginated<ApiProduct>> =>
    getPaginated<ApiProduct>('/products', filters as Record<string, unknown>),

  featured: (limit = 8) =>
    get<ApiProduct[]>('/products/featured', { params: cleanParams({ limit }) }),

  sellerStats: () => get<SellerProductStats>('/products/seller/stats'),

  locations: () => get<ProductLocation[]>('/products/locations'),

  getByIdOrSlug: (idOrSlug: string) => get<ApiProduct>(`/products/${encodeURIComponent(idOrSlug)}`),

  create: (dto: CreateProductDto) => post<ApiProduct>('/products', dto),

  update: (id: string, dto: UpdateProductDto) => put<ApiProduct>(`/products/${id}`, dto),

  remove: (id: string) => del<null>(`/products/${id}`),

  addImage: (productId: string, image: ProductImageInput) =>
    post<ApiProductImage>(`/products/${productId}/images`, image),

  removeImage: (productId: string, imageId: string) =>
    del<null>(`/products/${productId}/images/${imageId}`),

  setPrimaryImage: (productId: string, imageId: string) =>
    patch<ApiProductImage[]>(`/products/${productId}/images/${imageId}/primary`, {}),

  reorderImages: (productId: string, imageIds: string[]) =>
    patch<ApiProductImage[]>(`/products/${productId}/images/reorder`, { imageIds }),
};
