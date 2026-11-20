export function envInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  if (trimmed === '') return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export function envBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '') return fallback;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function envStr(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  return raw;
}
