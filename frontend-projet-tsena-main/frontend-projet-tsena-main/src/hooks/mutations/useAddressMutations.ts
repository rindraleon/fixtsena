import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addressesApi } from '../../api/addresses.api';
import { queryKeys } from '../../lib/query-keys';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { AddressDto } from '../../types/api';

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddressDto) => addressesApi.create(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success('Adresse enregistrée', { id: 'address-saved' });
    },
    onError: (error) => toast.error("Impossible d'enregistrer l'adresse", { id: 'address-error', description: getApiErrorMessage(error) }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<AddressDto> }) => addressesApi.update(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success('Adresse mise à jour', { id: 'address-saved' });
    },
    onError: (error) => toast.error("Impossible de modifier l'adresse", { id: 'address-error', description: getApiErrorMessage(error) }),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.setDefault(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success('Adresse par défaut mise à jour', { id: 'address-default' });
    },
    onError: (error) => toast.error("Impossible de définir l'adresse par défaut", { id: 'address-error', description: getApiErrorMessage(error) }),
  });
}

export function useRemoveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all });
      toast.success('Adresse supprimée', { id: 'address-removed' });
    },
    onError: (error) => toast.error("Impossible de supprimer l'adresse", { id: 'address-error', description: getApiErrorMessage(error) }),
  });
}
