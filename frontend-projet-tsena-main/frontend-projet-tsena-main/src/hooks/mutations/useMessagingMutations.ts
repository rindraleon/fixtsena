import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '../../api/messaging.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { SendMessageDto, StartConversationDto } from '../../types/api';

function useInvalidateMessaging() {
  const queryClient = useQueryClient();
  return (conversationId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
    if (conversationId) void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.messages(conversationId) });
  };
}

export function useStartConversation() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: (dto: StartConversationDto) => messagingApi.start(dto),
    onSuccess: ({ conversation }) => {
      invalidate(conversation.id);
      toast.success(TOAST_MESSAGES.messaging.sent, { id: 'message-sent' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'message-error' }),
  });
}

export function useSendMessage() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: ({ conversationId, dto }: { conversationId: string; dto: SendMessageDto }) =>
      messagingApi.send(conversationId, dto),
    onSuccess: (_result, { conversationId }) => invalidate(conversationId),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'message-error' }),
  });
}

export function useUploadMessageAttachment() {
  return useMutation({
    mutationFn: ({ conversationId, file }: { conversationId: string; file: File }) =>
      messagingApi.uploadAttachment(conversationId, file),
    onSuccess: () => toast.success('Pièce jointe ajoutée', { id: 'message-attachment-added', description: 'Elle sera envoyée avec votre prochain message.' }),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'message-attachment-error' }),
  });
}

export function useArchiveConversation() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: ({ conversationId, value }: { conversationId: string; value: boolean }) =>
      messagingApi.archive(conversationId, value),
    onSuccess: (_c, { conversationId, value }) => {
      invalidate(conversationId);
      toast.success(value ? TOAST_MESSAGES.messaging.archived : TOAST_MESSAGES.messaging.unarchived, { id: 'conversation-archive' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'conversation-error' }),
  });
}

export function useBlockConversation() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: ({ conversationId, value }: { conversationId: string; value: boolean }) =>
      messagingApi.block(conversationId, value),
    onSuccess: (_c, { conversationId, value }) => {
      invalidate(conversationId);
      toast.success(value ? TOAST_MESSAGES.messaging.blocked : TOAST_MESSAGES.messaging.unblocked, { id: 'conversation-block' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'conversation-error' }),
  });
}

export function useReportMessage() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: ({ messageId, reason }: { messageId: string; reason: string; conversationId?: string }) =>
      messagingApi.reportMessage(messageId, reason),
    onSuccess: (_m, { conversationId }) => {
      invalidate(conversationId);
      toast.success(TOAST_MESSAGES.messaging.reported, { id: 'message-reported' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'message-report-error' }),
  });
}

export function useAdminHideMessage() {
  const invalidate = useInvalidateMessaging();
  return useMutation({
    mutationFn: ({ messageId, value }: { messageId: string; value: boolean; conversationId?: string }) =>
      messagingApi.adminHideMessage(messageId, value),
    onSuccess: (_m, { conversationId, value }) => {
      invalidate(conversationId);
      toast.success(value ? 'Message masqué' : 'Message rétabli', { id: 'message-hidden' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'message-hide-error' }),
  });
}
