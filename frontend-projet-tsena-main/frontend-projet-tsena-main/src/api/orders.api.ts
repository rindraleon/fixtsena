import { get, getPaginated, patch, post } from './client';
import type {
  ApiOrder,
  BuyerOrderStats,
  CheckoutQuote,
  CreateOrderDto,
  OrderFilters,
  Paginated,
  SellerOrderStats,
  UpdateOrderStatusDto,
  UpdateDeliveryDto,
} from '../types/api';

export const ordersApi = {
  create: (dto: CreateOrderDto = {}) => post<ApiOrder[]>('/orders', dto),

  list: (filters: OrderFilters = {}): Promise<Paginated<ApiOrder>> =>
    getPaginated<ApiOrder>('/orders', filters as Record<string, unknown>),

  getById: (id: string) => get<ApiOrder>(`/orders/${id}`),

  getByNumber: (orderNumber: string) => get<ApiOrder>(`/orders/number/${encodeURIComponent(orderNumber)}`),

  updateStatus: (id: string, dto: UpdateOrderStatusDto) => patch<ApiOrder>(`/orders/${id}/status`, dto),

  updateDelivery: (id: string, dto: UpdateDeliveryDto) => patch<ApiOrder>(`/orders/${id}/delivery`, dto),

  sellerStats: () => get<SellerOrderStats>('/orders/seller/stats'),

  buyerStats: () => get<BuyerOrderStats>('/orders/buyer/stats'),

  checkoutQuote: (deliveryZoneId?: string) =>
    get<CheckoutQuote>('/orders/checkout/quote', { params: deliveryZoneId ? { deliveryZoneId } : undefined }),
};
