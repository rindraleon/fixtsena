const STRIPPED_KEYS: ReadonlySet<string> = new Set([
  'deletedAt',
  'passwordHash',
  'refreshTokenHash',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  'failedLoginAttempts',
  'lockedUntil',
]);

const MAX_DEPTH = 12;

function isOpaque(value: object): boolean {
  return (
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    value instanceof Map ||
    value instanceof Set ||
    ArrayBuffer.isView(value) ||
    typeof (value as { pipe?: unknown }).pipe === 'function'
  );
}

export function sanitizePayload<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (isOpaque(value)) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (STRIPPED_KEYS.has(key)) continue;
    result[key] = sanitizePayload(entry, depth + 1);
  }
  return result as T;
}
