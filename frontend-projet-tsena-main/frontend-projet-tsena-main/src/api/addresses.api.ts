import { del, get, patch, post, put } from './client';
import type { AddressDto, ApiAddress } from '../types/api';

export const addressesApi = {
  list: () => get<ApiAddress[]>('/addresses'),

  create: (dto: AddressDto) => post<ApiAddress>('/addresses', dto),

  update: (id: string, dto: Partial<AddressDto>) => put<ApiAddress>(`/addresses/${id}`, dto),

  setDefault: (id: string) => patch<ApiAddress>(`/addresses/${id}/default`),

  remove: (id: string) => del<null>(`/addresses/${id}`),
};
