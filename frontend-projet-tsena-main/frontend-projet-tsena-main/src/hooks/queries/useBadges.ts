import { useQuery } from '@tanstack/react-query';
import { badgesApi } from '../../api/badges.api';
import { queryKeys } from '../../lib/query-keys';

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.badges.forUser(userId ?? ''),
    queryFn: () => badgesApi.forUser(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBadges(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.badges.list(includeInactive),
    queryFn: () => badgesApi.list(includeInactive),
    staleTime: 60 * 1000,
  });
}

export function useBadgeStats() {
  return useQuery({ queryKey: queryKeys.badges.stats(), queryFn: () => badgesApi.stats(), staleTime: 60 * 1000 });
}

export function useBadgeUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.badges.userStats(userId ?? ''),
    queryFn: () => badgesApi.userStats(userId as string),
    enabled: !!userId,
  });
}
