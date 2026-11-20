import { BadRequestException } from '@nestjs/common';

export const REPORT_TYPES = ['orders', 'payments', 'disputes', 'commissions'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  orders: 'commandes',
  payments: 'paiements',
  disputes: 'litiges',
  commissions: 'commissions',
};

export interface ReportPeriod {
  from: Date;
  to: Date;
  fromLabel: string;
  toLabel: string;
  days: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_PERIOD_DAYS = 366;
export const DEFAULT_PERIOD_DAYS = 30;

function parseDay(value: string, field: string): Date {
  if (!ISO_DAY.test(value)) throw new BadRequestException(`Le paramètre « ${field} » doit être une date au format AAAA-MM-JJ`);
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new BadRequestException(`Le paramètre « ${field} » n'est pas une date valide`);
  }
  return date;
}

export function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseReportPeriod(from?: string, to?: string, now: Date = new Date()): ReportPeriod {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = to ? parseDay(to, 'to') : today;
  const start = from ? parseDay(from, 'from') : new Date(end.getFullYear(), end.getMonth(), end.getDate() - (DEFAULT_PERIOD_DAYS - 1));
  if (start.getTime() > end.getTime()) throw new BadRequestException('La date de début doit précéder la date de fin');
  if (end.getTime() > today.getTime()) throw new BadRequestException('La date de fin ne peut pas être postérieure à aujourd’hui');
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_PERIOD_DAYS) throw new BadRequestException(`La période ne peut pas dépasser ${MAX_PERIOD_DAYS} jours`);
  const exclusiveEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  return { from: start, to: exclusiveEnd, fromLabel: formatDay(start), toLabel: formatDay(end), days };
}

export function parseReportType(value: unknown): ReportType {
  if (!REPORT_TYPES.includes(value as ReportType)) {
    throw new BadRequestException(`Type de rapport invalide : ${REPORT_TYPES.join(', ')}`);
  }
  return value as ReportType;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'Indian/Antananarivo';

export function formatDateTime(date: Date, timeZone: string = REPORT_TIMEZONE): string {
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = formatDateTime(value);
  else if (typeof value === 'number') text = Number.isFinite(value) ? String(value).replace('.', ',') : '';
  else if (typeof value === 'boolean') text = value ? 'oui' : 'non';
  else text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function csvFilename(type: ReportType, period: ReportPeriod): string {
  return `tsena-${REPORT_LABELS[type]}-${period.fromLabel}_${period.toLabel}.csv`;
}
