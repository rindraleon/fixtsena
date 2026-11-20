export const MAX_PERIOD_DAYS = 366;

export function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export interface PeriodPreset {
  id: string;
  label: string;
  range: (today: Date) => { from: string; to: string };
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  { id: '7d', label: '7 derniers jours', range: (t) => ({ from: toDayString(shiftDays(t, -6)), to: toDayString(t) }) },
  { id: '30d', label: '30 derniers jours', range: (t) => ({ from: toDayString(shiftDays(t, -29)), to: toDayString(t) }) },
  { id: 'month', label: 'Mois en cours', range: (t) => ({ from: toDayString(new Date(t.getFullYear(), t.getMonth(), 1)), to: toDayString(t) }) },
  {
    id: 'prev-month',
    label: 'Mois précédent',
    range: (t) => ({ from: toDayString(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: toDayString(new Date(t.getFullYear(), t.getMonth(), 0)) }),
  },
  { id: 'year', label: 'Année en cours', range: (t) => ({ from: toDayString(new Date(t.getFullYear(), 0, 1)), to: toDayString(t) }) },
];

export function validatePeriod(from: string, to: string, today: Date = new Date()): string | null {
  if (!from || !to) return 'Indiquez une date de début et une date de fin.';
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates invalides.';
  if (start > end) return 'La date de début doit précéder la date de fin.';
  if (to > toDayString(today)) return 'La date de fin ne peut pas dépasser aujourd’hui.';
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_PERIOD_DAYS) return `La période ne peut pas dépasser ${MAX_PERIOD_DAYS} jours.`;
  return null;
}
