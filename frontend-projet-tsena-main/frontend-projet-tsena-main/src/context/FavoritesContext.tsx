import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { primaryImageUrl, toNumber } from '../lib/format';
import type { ApiProduct } from '../types/api';

export interface FavoriteSnapshot {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  imageUrl?: string;
  categoryName?: string;
  addedAt: string;
}

interface FavoritesContextValue {
  favorites: FavoriteSnapshot[];
  count: number;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: ApiProduct) => boolean;
  removeFavorite: (productId: string) => void;
  clearFavorites: () => void;
}

const STORAGE_PREFIX = 'tsena.favorites';

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}.${userId ?? 'guest'}`;
}

function load(userId: string | null): FavoriteSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as FavoriteSnapshot[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string | null, favorites: FavoriteSnapshot[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(favorites));
  } catch {
  }
}

export function toFavoriteSnapshot(product: ApiProduct): FavoriteSnapshot {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: toNumber(product.price),
    compareAtPrice: product.compareAtPrice ? toNumber(product.compareAtPrice) : undefined,
    imageUrl: primaryImageUrl(product),
    categoryName: product.category?.name,
    addedAt: new Date().toISOString(),
  };
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { readonly children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<FavoriteSnapshot[]>(() => load(userId));

  useEffect(() => {
    setFavorites(load(userId));
  }, [userId]);

  const update = useCallback(
    (updater: (current: FavoriteSnapshot[]) => FavoriteSnapshot[]) => {
      setFavorites((current) => {
        const next = updater(current);
        persist(userId, next);
        return next;
      });
    },
    [userId],
  );

  const isFavorite = useCallback((productId: string) => favorites.some((f) => f.id === productId), [favorites]);

  const toggleFavorite = useCallback(
    (product: ApiProduct) => {
      const exists = favorites.some((f) => f.id === product.id);
      update((current) =>
        exists ? current.filter((f) => f.id !== product.id) : [toFavoriteSnapshot(product), ...current],
      );
      return !exists;
    },
    [favorites, update],
  );

  const removeFavorite = useCallback(
    (productId: string) => update((current) => current.filter((f) => f.id !== productId)),
    [update],
  );

  const clearFavorites = useCallback(() => update(() => []), [update]);

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, count: favorites.length, isFavorite, toggleFavorite, removeFavorite, clearFavorites }),
    [favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites doit être utilisé dans un FavoritesProvider');
  return ctx;
}
