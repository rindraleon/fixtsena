export const CHUNK_RELOAD_FLAG = 'tsena:chunk-reload';
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading chunk [\w-]+ failed/i,
  /loading css chunk/i,
  /unable to preload css/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function recentlyReloaded(storage: Storage, now: number): boolean {
  const raw = storage.getItem(CHUNK_RELOAD_FLAG);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && now - at < RELOAD_WINDOW_MS;
}

export interface ChunkRecoveryOptions {
  readonly reload?: () => void;
  readonly storage?: Storage;
  readonly now?: () => number;
}

export function recoverFromChunkError(options: ChunkRecoveryOptions = {}): boolean {
  const storage = options.storage ?? window.sessionStorage;
  const now = (options.now ?? Date.now)();
  if (recentlyReloaded(storage, now)) return false;
  storage.setItem(CHUNK_RELOAD_FLAG, String(now));
  (options.reload ?? (() => window.location.reload()))();
  return true;
}

export function installChunkRecovery(options: ChunkRecoveryOptions = {}): () => void {
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    recoverFromChunkError(options);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (!isChunkLoadError(event.reason)) return;
    if (recoverFromChunkError(options)) event.preventDefault();
  };
  const onError = (event: ErrorEvent) => {
    if (!isChunkLoadError(event.error ?? event.message)) return;
    if (recoverFromChunkError(options)) event.preventDefault();
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('error', onError);
  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('error', onError);
  };
}
