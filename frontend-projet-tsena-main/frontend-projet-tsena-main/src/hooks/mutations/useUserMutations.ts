import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, usersApi } from '../../api/users.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import { saveBlob } from '../../lib/download';
import type { AdminReportParams, AdminReportType, CreateUserDto, UpdateUserDto } from '../../types/api';

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.users.created, { id: 'user-created' });
    },
    onError: (error) => toast.error("Impossible de créer l'utilisateur", { id: 'user-create-error', description: getApiErrorMessage(error) }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.users.detail(user.id), user);
      invalidate();
      toast.success(TOAST_MESSAGES.users.updated, { id: 'user-updated' });
    },
    onError: (error) => toast.error("Impossible de mettre à jour l'utilisateur", { id: 'user-update-error', description: getApiErrorMessage(error) }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(id) });
      invalidate();
      toast.success(TOAST_MESSAGES.users.deleted, { id: 'user-deleted' });
    },
    onError: (error) => toast.error(TOAST_MESSAGES.users.deleteError, { id: 'user-delete-error', description: getApiErrorMessage(error) }),
  });
}

export function useSuspendUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminApi.suspendUser(id, reason),
    onSuccess: (_user, { id }) => {
      invalidate(id);
      toast.success('Compte suspendu', { id: 'user-suspended' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'user-suspend-error' }),
  });
}

export function useActivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => adminApi.activateUser(id),
    onSuccess: (_user, id) => {
      invalidate(id);
      toast.success('Compte activé', { id: 'user-activated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'user-activate-error' }),
  });
}

export function useApproveSeller() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveSeller(id),
    onSuccess: (_user, id) => {
      invalidate(id);
      toast.success('Vendeur approuvé', { id: 'seller-approved' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'seller-approve-error' }),
  });
}

export function useApproveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveProduct(id),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Produit approuvé', { id: 'product-approved' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'product-approve-error' }),
  });
}

export function useSuspendProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.suspendProduct(id, reason),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Produit suspendu', { id: 'product-suspended', description: 'Le vendeur a été informé du motif ; la fiche n’est plus visible dans le catalogue.' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'product-suspend-error' }),
  });
}

export function useRejectProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectProduct(id, reason),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(product.id), product);
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Produit rejeté', { id: 'product-rejected' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'product-reject-error' }),
  });
}

export function useExportAdminReport() {
  return useMutation({
    mutationFn: async ({ type, params }: { type: AdminReportType; params: AdminReportParams }) => {
      const file = await adminApi.exportReport(type, params);
      saveBlob(file.blob, file.filename);
      const rows = Number(file.headers['x-report-rows']);
      return { filename: file.filename, rows: Number.isFinite(rows) ? rows : null };
    },
    onSuccess: ({ filename, rows }) => {
      toast.success(TOAST_MESSAGES.admin.reportExported(filename, rows), { id: 'report-export' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'report-export' }),
  });
}
