const ACCESS_TOKEN_KEY = 'tsena.accessToken';
const REFRESH_TOKEN_KEY = 'tsena.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function safeGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
  }
}

function safeRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
  }
}

export const tokenStorage = {
  getAccessToken: (): string | null => safeGet(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => safeGet(REFRESH_TOKEN_KEY),

  setTokens({ accessToken, refreshToken }: StoredTokens): void {
    safeSet(ACCESS_TOKEN_KEY, accessToken);
    safeSet(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear(): void {
    safeRemove(ACCESS_TOKEN_KEY);
    safeRemove(REFRESH_TOKEN_KEY);
  },

  hasSession: (): boolean => !!safeGet(ACCESS_TOKEN_KEY) || !!safeGet(REFRESH_TOKEN_KEY),
};
