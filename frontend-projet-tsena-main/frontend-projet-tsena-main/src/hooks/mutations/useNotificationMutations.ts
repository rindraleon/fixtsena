import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications.api';
import { settingsApi } from '../../api/settings.api';
import { commissionsApi } from '../../api/commissions.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { CommissionTier, SaveDeliveryZoneDto, UpsertCommissionRateDto } from '../../types/api';

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
    onError: (error) => toast.error('Impossible de marquer la notification comme lue', { id: 'notification-read-error', description: getApiErrorMessage(error) }),
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.notifications.allRead, { id: 'notifications-read' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'notifications-error' }),
  });
}

function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.commissions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
  };
}

export function useUpdateSettings() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => settingsApi.adminUpdate(values),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.updated, { id: 'settings-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'settings-error' }),
  });
}

export function useResetSetting() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (key: string) => settingsApi.adminReset(key),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.reset, { id: 'settings-reset' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'settings-error' }),
  });
}

export function useUpsertCommissionRate() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (dto: UpsertCommissionRateDto) => commissionsApi.upsertRate(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.rateSaved, { id: 'rate-saved' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'rate-error' }),
  });
}

export function useRemoveCommissionRate() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: ({ categoryId, tier }: { categoryId: string; tier: CommissionTier }) => commissionsApi.removeRate(categoryId, tier),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.rateRemoved, { id: 'rate-removed' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'rate-error' }),
  });
}

export function useSeedCommissionGrid() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: () => commissionsApi.seedGrid(),
    onSuccess: () => {
      invalidate();
      toast.success('Grille par défaut du cahier des charges appliquée', { id: 'rate-seeded' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'rate-error' }),
  });
}

export function useSaveDeliveryZone() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: SaveDeliveryZoneDto }) =>
      id ? commissionsApi.updateZone(id, dto) : commissionsApi.createZone(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.zoneSaved, { id: 'zone-saved' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'zone-error' }),
  });
}

export function useRemoveDeliveryZone() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (id: string) => commissionsApi.removeZone(id),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.settings.zoneRemoved, { id: 'zone-removed' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'zone-error' }),
  });
}
