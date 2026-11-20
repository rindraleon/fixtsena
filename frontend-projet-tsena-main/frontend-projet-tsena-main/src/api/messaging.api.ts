import { get, getPaginated, post } from './client';
import type {
  ApiConversation,
  ApiMessage,
  ConversationFilters,
  ConversationMessages,
  Paginated,
  SendMessageDto,
  StartConversationDto,
} from '../types/api';

export const messagingApi = {
  list: (filters: ConversationFilters = {}): Promise<Paginated<ApiConversation>> =>
    getPaginated<ApiConversation>('/conversations', filters as Record<string, unknown>),

  unreadCount: () => get<{ count: number }>('/conversations/unread-count'),

  start: (dto: StartConversationDto) =>
    post<{ conversation: ApiConversation; message: ApiMessage }>('/conversations', dto),

  messages: (conversationId: string, params: { page?: number; limit?: number } = {}) =>
    get<ConversationMessages>(`/conversations/${conversationId}/messages`, { params }),

  send: (conversationId: string, dto: SendMessageDto) =>
    post<{ conversation: ApiConversation; message: ApiMessage }>(`/conversations/${conversationId}/messages`, dto),

  uploadAttachment: (conversationId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return post<{ url: string; name: string; size: number; mimeType: string }>(
      `/conversations/${conversationId}/attachments`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  archive: (conversationId: string, value: boolean) =>
    post<ApiConversation>(`/conversations/${conversationId}/archive`, { value }),

  block: (conversationId: string, value: boolean) =>
    post<ApiConversation>(`/conversations/${conversationId}/block`, { value }),

  reportMessage: (messageId: string, reason: string) => post<ApiMessage>(`/messages/${messageId}/report`, { reason }),

  adminList: (filters: ConversationFilters = {}): Promise<Paginated<ApiConversation>> =>
    getPaginated<ApiConversation>('/admin/conversations', filters as Record<string, unknown>),

  adminHideMessage: (messageId: string, value: boolean) => post<ApiMessage>(`/admin/messages/${messageId}/hide`, { value }),
};
