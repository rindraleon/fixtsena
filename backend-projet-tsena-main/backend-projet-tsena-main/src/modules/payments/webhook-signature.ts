import { createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export function computeWebhookSignature(secret: string, timestamp: string, transactionId: string, status: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${transactionId}.${status}`).digest('hex');
}

export function verifyWebhookSignature(options: {
  secret: string;
  signature: string | undefined;
  timestamp: string | undefined;
  transactionId: string;
  status: string;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { secret, signature, timestamp, transactionId, status } = options;
  if (!signature || !timestamp) return { ok: false, reason: 'Signature ou horodatage manquant' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Horodatage invalide' };
  const now = options.now ?? Date.now();
  if (Math.abs(now - ts) > WEBHOOK_TOLERANCE_MS) return { ok: false, reason: 'Notification expirée (horodatage hors tolérance)' };
  const expected = computeWebhookSignature(secret, timestamp, transactionId, status);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'Signature invalide' };
  return { ok: true };
}
