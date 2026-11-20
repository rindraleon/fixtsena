import type { ApiUser } from './api';

export type AppRole = 'client' | 'seller' | 'admin';

export interface AuthUser extends ApiUser {
  role: AppRole;
  fullName: string;
  initials: string;
}

export function resolveAppRole(roles: readonly string[] | undefined): AppRole {
  if (!roles) return 'client';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('seller')) return 'seller';
  return 'client';
}
