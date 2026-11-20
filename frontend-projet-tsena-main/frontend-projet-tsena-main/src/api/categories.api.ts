import { del, get, getPaginated, post, put } from './client';
import type {
  ApiCategory,
  CategoryFilters,
  CategoryTreeNode,
  CreateCategoryDto,
  Paginated,
  UpdateCategoryDto,
} from '../types/api';

export const categoriesApi = {
  list: (filters: CategoryFilters = {}): Promise<Paginated<ApiCategory>> =>
    getPaginated<ApiCategory>('/categories', { limit: 50, ...filters } as Record<string, unknown>),

  tree: () => get<CategoryTreeNode[]>('/categories/tree'),

  getByIdOrSlug: (idOrSlug: string) => get<ApiCategory>(`/categories/${encodeURIComponent(idOrSlug)}`),

  create: (dto: CreateCategoryDto) => post<ApiCategory>('/categories', dto),

  update: (id: string, dto: UpdateCategoryDto) => put<ApiCategory>(`/categories/${id}`, dto),

  remove: (id: string) => del<null>(`/categories/${id}`),
};
