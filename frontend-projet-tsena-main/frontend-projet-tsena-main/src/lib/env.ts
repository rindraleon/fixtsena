export const DEFAULT_API_URL = 'http://localhost:3000/api';
export const API_GLOBAL_PREFIX = '/api';

export function normalizeApiUrl(raw: string | undefined | null, fallback = DEFAULT_API_URL): string {
  const value = ((raw ?? '').trim() || fallback).replace(/\/+$/, '');
  if (value.startsWith('/')) return value || API_GLOBAL_PREFIX;
  try {
    const url = new URL(value);
    if (url.pathname === '' || url.pathname === '/') return `${url.origin}${API_GLOBAL_PREFIX}`;
    return value;
  } catch {
    return value;
  }
}

function readApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const normalized = normalizeApiUrl(raw);
  if (import.meta.env.DEV && raw && normalized !== raw.trim().replace(/\/+$/, '')) {
    console.warn(`[env] VITE_API_URL=« ${raw} » sans préfixe d'API : « ${normalized} » sera utilisé.`);
  }
  return normalized;
}

function readSiteUrl(): string {
  const raw = import.meta.env.VITE_SITE_URL as string | undefined;
  const value = (raw && raw.trim()) || (typeof window !== 'undefined' ? window.location.origin : '');
  return value.replace(/\/+$/, '');
}

function readRouterMode(): 'browser' | 'hash' {
  const raw = (import.meta.env.VITE_ROUTER_MODE as string | undefined)?.trim().toLowerCase();
  return raw === 'hash' ? 'hash' : 'browser';
}

export const env = {
  apiUrl: readApiUrl(),
  siteUrl: readSiteUrl(),
  routerMode: readRouterMode(),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
