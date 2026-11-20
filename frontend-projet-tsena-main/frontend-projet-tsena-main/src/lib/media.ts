import { env } from './env';

function apiOrigin(): string {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(env.apiUrl, base).origin;
  } catch {
    return '';
  }
}

const API_ORIGIN = apiOrigin();
const API_IS_RELATIVE = env.apiUrl.startsWith('/');

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed === '') return undefined;
  if (/^(https?:)?\/\//i.test(trimmed) || /^(data|blob):/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return API_IS_RELATIVE ? trimmed : `${API_ORIGIN}${trimmed}`;
  return trimmed;
}
