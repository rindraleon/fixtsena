import { del, get, patch, post } from './client';
import type { AddCartItemDto, CartCount, CartData, UpdateCartItemDto } from '../types/api';

export const cartApi = {
  get: () => get<CartData>('/cart'),

  count: () => get<CartCount>('/cart/count'),

  addItem: (dto: AddCartItemDto) => post<CartData>('/cart/items', dto),

  updateItem: (itemId: string, dto: UpdateCartItemDto) => patch<CartData>(`/cart/items/${itemId}`, dto),

  removeItem: (itemId: string) => del<CartData>(`/cart/items/${itemId}`),

  clear: () => del<CartData>('/cart'),
};
