import type { ApiOrder, OrderStatus } from '../types/api';

export interface DailyPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

const COUNTED_STATUSES: ReadonlySet<OrderStatus> = new Set(['confirmed', 'processing', 'shipped', 'delivered']);

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dailySeries(orders: readonly ApiOrder[], days = 14, now = new Date()): DailyPoint[] {
  const points = new Map<string, DailyPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = isoDay(day);
    points.set(key, { date: key, label: day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), revenue: 0, orders: 0 });
  }
  for (const order of orders) {
    const key = isoDay(new Date(order.createdAt));
    const point = points.get(key);
    if (!point || !COUNTED_STATUSES.has(order.status)) continue;
    point.revenue += Number(order.totalAmount);
    point.orders += 1;
  }
  return [...points.values()];
}

export function statusBreakdown(orders: readonly ApiOrder[], labels: Record<OrderStatus, string>): { status: OrderStatus; label: string; count: number }[] {
  const counts = new Map<OrderStatus, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, label: labels[status], count })).sort((a, b) => b.count - a.count);
}
