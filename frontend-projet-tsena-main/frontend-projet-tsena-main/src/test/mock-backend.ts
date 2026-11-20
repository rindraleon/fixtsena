import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../api/client';

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockRequest {
  readonly method: MockMethod;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly params: Record<string, string>;
  readonly body: unknown;
  readonly headers: Record<string, string>;
  readonly authorization: string | null;
}

export type MockOutcome =
  | { status?: number; data: unknown; message?: string; meta?: unknown }
  | { raw: string | Blob; status?: number; headers?: Record<string, string> }
  | { error: { status: number; message?: string; errors?: { field: string; message: string }[] } }
  | { network: true }
  | { timeout: true };

type Handler = (req: MockRequest) => MockOutcome | Promise<MockOutcome>;

interface Route {
  method: MockMethod;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];
export const requestLog: MockRequest[] = [];
let defaultLatencyMs = 0;

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:(\w+)/g, (_m, key: string) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/:(\w+)/g, (_m, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
  return { pattern: new RegExp(`^${source}$`), keys };
}

export function mockRoute(method: MockMethod, path: string, handler: Handler | MockOutcome): void {
  const { pattern, keys } = compile(path);
  routes.unshift({ method, pattern, keys, handler: typeof handler === 'function' ? handler : () => handler });
}

export function setMockLatency(ms: number): void {
  defaultLatencyMs = ms;
}

export function resetMockBackend(): void {
  routes.length = 0;
  requestLog.length = 0;
  defaultLatencyMs = 0;
}

export function envelope<T>(data: T, message = 'OK', meta?: unknown): MockOutcome {
  return meta === undefined ? { data, message } : { data, message, meta };
}

export function paginated<T>(items: T[], page = 1, limit = 20, total = items.length): MockOutcome {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { data: items, message: 'OK', meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
}

export function httpError(status: number, message?: string, errors?: { field: string; message: string }[]): MockOutcome {
  return { error: { status, message, errors } };
}

export const networkFailure: MockOutcome = { network: true };
export const timeoutFailure: MockOutcome = { timeout: true };

function toRequest(config: InternalAxiosRequestConfig): MockRequest {
  const base = (config.baseURL ?? '').replace(/\/+$/, '');
  const raw = config.url ?? '';
  const absolute = raw.startsWith('http') ? raw : `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
  const url = new URL(absolute, 'http://localhost');
  let path = url.pathname;
  const basePath = base ? new URL(base, 'http://localhost').pathname.replace(/\/+$/, '') : '';
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length) || '/';
  const query = new URLSearchParams(url.search);
  if (config.params && typeof config.params === 'object') {
    for (const [key, value] of Object.entries(config.params as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
  }
  let body: unknown = config.data;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {  }
  }
  const headers: Record<string, string> = {};
  const h = AxiosHeaders.from(config.headers);
  for (const [key, value] of Object.entries(h.toJSON())) if (value != null) headers[key.toLowerCase()] = String(value);
  return { method: (config.method ?? 'get').toUpperCase() as MockMethod, path, query, params: {}, body, headers, authorization: headers.authorization ?? null };
}

const adapter: AxiosAdapter = async (config) => {
  const req = toRequest(config);
  requestLog.push(req);
  const route = routes.find((r) => r.method === req.method && r.pattern.test(req.path));
  const makeResponse = (status: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse => ({
    data,
    status,
    statusText: String(status),
    headers,
    config,
    request: {},
  });
  const wantsBlob = config.responseType === 'blob';
  const asBody = (payload: unknown): unknown =>
    wantsBlob && typeof Blob !== 'undefined' ? new Blob([JSON.stringify(payload)], { type: 'application/json' }) : payload;

  if (defaultLatencyMs > 0) await new Promise((resolve) => setTimeout(resolve, defaultLatencyMs));

  if (!route) {
    const data = { success: false, message: `Route simulée introuvable : ${req.method} ${req.path}`, statusCode: 404 };
    throw new AxiosError(data.message, 'ERR_BAD_REQUEST', config, {}, makeResponse(404, asBody(data)));
  }

  const match = route.pattern.exec(req.path);
  const params: Record<string, string> = {};
  route.keys.forEach((key, index) => { params[key] = decodeURIComponent(match?.[index + 1] ?? ''); });
  const outcome = await route.handler({ ...req, params });

  if ('network' in outcome) {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
  }
  if ('timeout' in outcome) {
    throw new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED', config, {});
  }
  if ('error' in outcome) {
    const { status, message, errors } = outcome.error;
    const data = { success: false, message: message ?? `Erreur ${status}`, statusCode: status, ...(errors ? { errors } : {}) };
    throw new AxiosError(data.message, status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, {}, makeResponse(status, asBody(data)));
  }
  if ('raw' in outcome) {
    const headers = Object.fromEntries(Object.entries(outcome.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const contentType = headers['content-type'] ?? 'application/octet-stream';
    const body = wantsBlob && typeof Blob !== 'undefined' && typeof outcome.raw === 'string' ? new Blob([outcome.raw], { type: contentType }) : outcome.raw;
    return makeResponse(outcome.status ?? 200, body, { 'content-type': contentType, ...headers });
  }
  const status = outcome.status ?? 200;
  const payload = { success: true, message: outcome.message ?? 'OK', data: outcome.data, ...(outcome.meta !== undefined ? { meta: outcome.meta } : {}) };
  return makeResponse(status, payload);
};

export function installMockBackend(): void {
  apiClient.defaults.adapter = adapter;
}

export function callsTo(method: MockMethod, path: string): MockRequest[] {
  return requestLog.filter((r) => r.method === method && r.path === path);
}
