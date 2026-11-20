import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '../lib/env';
import { tokenStorage } from '../lib/token-storage';
import { normalizeApiError } from '../lib/api-error';
import type { ApiResponse, AuthResponse, AuthTokens } from '../types/api';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    skipAuthRefresh?: boolean;
    _retried?: boolean;
  }
}

export type SessionEvent = 'sessionExpired';
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

export function onSessionExpired(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionListeners) listener();
}

export const REQUEST_TIMEOUT_MS = 20_000;

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((path) => url.includes(path));
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('NO_REFRESH_TOKEN'));
  }

  refreshPromise = apiClient
    .post<ApiResponse<AuthResponse>>(
      '/auth/refresh',
      { refreshToken },
      { skipAuth: true, skipAuthRefresh: true },
    )
    .then((response) => {
      const tokens: AuthTokens | undefined = response.data?.data?.tokens;
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error('INVALID_REFRESH_RESPONSE');
      }
      tokenStorage.setTokens(tokens);
      return tokens.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function handleSessionExpired(): void {
  const hadSession = tokenStorage.hasSession();
  tokenStorage.clear();
  if (hadSession) notifySessionExpired();
}

async function decodeBlobErrorBody(error: AxiosError): Promise<void> {
  const data = error.response?.data;
  if (!error.response || typeof Blob === 'undefined' || !(data instanceof Blob)) return;
  try {
    const text = await data.text();
    error.response.data = text ? JSON.parse(text) : undefined;
  } catch {
    error.response.data = undefined;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as (InternalAxiosRequestConfig & AxiosRequestConfig) | undefined;
    const status = error.response?.status;
    await decodeBlobErrorBody(error);

    const canTryRefresh =
      status === 401 &&
      !!originalConfig &&
      !originalConfig._retried &&
      !originalConfig.skipAuthRefresh &&
      !isAuthEndpoint(originalConfig.url) &&
      !!tokenStorage.getRefreshToken();

    if (canTryRefresh && originalConfig) {
      originalConfig._retried = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalConfig.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient.request(originalConfig);
      } catch {
        handleSessionExpired();
        return Promise.reject(normalizeApiError(error));
      }
    }

    if (status === 401 && originalConfig && !isAuthEndpoint(originalConfig.url) && !originalConfig.skipAuth) {
      handleSessionExpired();
    }

    return Promise.reject(normalizeApiError(error));
  },
);

export interface EnvelopeResult<T> {
  data: T;
  message: string;
  meta?: ApiResponse<T>['meta'];
}

export async function request<T>(config: AxiosRequestConfig): Promise<EnvelopeResult<T>> {
  const response = await apiClient.request<ApiResponse<T>>(config);
  const body = response.data;
  if (body && typeof body === 'object' && 'success' in body) {
    return { data: body.data, message: body.message, meta: body.meta };
  }
  return { data: body as unknown as T, message: '' };
}

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await request<T>({ ...config, method: 'GET', url })).data;
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await request<T>({ ...config, method: 'POST', url, data })).data;
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await request<T>({ ...config, method: 'PUT', url, data })).data;
}

export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await request<T>({ ...config, method: 'PATCH', url, data })).data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await request<T>({ ...config, method: 'DELETE', url })).data;
}

export async function getPaginated<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ items: T[]; meta: NonNullable<ApiResponse['meta']> }> {
  const { data, meta } = await request<T[]>({ method: 'GET', url, params: cleanParams(params) });
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    meta: meta ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 },
  };
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
  contentType: string;
  headers: Record<string, string>;
}

function parseContentDispositionFilename(header: string | undefined): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(header);
  return simple?.[1]?.trim() || null;
}

export async function downloadFile(
  url: string,
  params?: Record<string, unknown>,
  fallbackName = 'export.csv',
): Promise<DownloadedFile> {
  const response = await apiClient.request<Blob>({ method: 'GET', url, params: cleanParams(params), responseType: 'blob' });
  const headers: Record<string, string> = {};
  const rawHeaders = (response.headers ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value !== undefined && value !== null) headers[key.toLowerCase()] = String(value);
  }
  const contentType = headers['content-type'] ?? 'application/octet-stream';
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data as BlobPart], { type: contentType });
  return { blob, filename: parseContentDispositionFilename(headers['content-disposition']) ?? fallbackName, contentType, headers };
}

export function cleanParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    result[key] = value;
  }
  return result;
}
