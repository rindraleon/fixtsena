import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { messagingApi } from '../../api/messaging.api';
import { queryKeys } from '../../lib/query-keys';
import type { ConversationFilters } from '../../types/api';

export function useConversations(filters: ConversationFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.messaging.list(filters),
    queryFn: () => messagingApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messaging.messages(conversationId ?? ''),
    queryFn: () => messagingApi.messages(conversationId as string, { limit: 100 }),
    enabled: !!conversationId,
    staleTime: 5 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useMessagingUnreadCount(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.messaging.unreadCount(),
    queryFn: () => messagingApi.unreadCount(),
    enabled: options.enabled ?? true,
    staleTime: 15 * 1000,
    refetchInterval: 45 * 1000,
  });
}

export function useAdminConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.messaging.adminList(filters),
    queryFn: () => messagingApi.adminList(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}
