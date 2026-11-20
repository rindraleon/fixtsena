import { useMutation, useQueryClient } from '@tanstack/react-query';
import { disputesApi } from '../../api/disputes.api';
import { uploadApi } from '../../api/upload.api';
import { queryKeys } from '../../lib/query-keys';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { CreateDisputeDto, ResolveDisputeDto, UpdateDisputeStatusDto } from '../../types/api';

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDisputeDto) => disputesApi.create(dto),
    onSuccess: (dispute) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.byOrder(dispute.orderId) });
      toast.success('Signalement envoyé', { id: 'dispute-created', description: 'Un administrateur va examiner votre litige.' });
    },
    onError: (error) => toast.error("Impossible d'envoyer le signalement", { id: 'dispute-error', description: getApiErrorMessage(error) }),
  });
}

export function useAddDisputeEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ disputeId, file, description }: { disputeId: string; file: File; description?: string }) => {
      const uploaded = await uploadApi.disputeEvidence(disputeId, file);
      return disputesApi.addEvidence(disputeId, { url: uploaded.url, description });
    },
    onSuccess: (evidence) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.evidence(evidence.disputeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.detail(evidence.disputeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.list() });
      toast.success('Pièce justificative ajoutée', { id: 'evidence-added' });
    },
    onError: (error) => toast.error("Impossible d'ajouter la pièce justificative", { id: 'evidence-error', description: getApiErrorMessage(error) }),
  });
}

export function useResolveDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ResolveDisputeDto }) => disputesApi.resolve(id, dto),
    onSuccess: (dispute) => {
      queryClient.setQueryData(queryKeys.disputes.detail(dispute.id), dispute);
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      toast.success('Litige résolu', { id: 'dispute-resolved', description: 'La décision a été appliquée et les parties en sont informées.' });
    },
    onError: (error) => toast.error('Impossible de résoudre le litige', { id: 'dispute-error', description: getApiErrorMessage(error) }),
  });
}

const STATUS_TOASTS: Record<UpdateDisputeStatusDto['status'], string> = {
  open: 'Dossier ouvert',
  under_review: "Dossier mis en cours d'analyse",
  awaiting_evidence: 'Demande d’informations envoyée aux parties',
  closed: 'Litige clôturé',
  cancelled: 'Signalement retiré',
};

export function useUpdateDisputeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDisputeStatusDto }) => disputesApi.updateStatus(id, dto),
    onSuccess: (dispute, variables) => {
      queryClient.setQueryData(queryKeys.disputes.detail(dispute.id), dispute);
      void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.all });
      toast.success(STATUS_TOASTS[variables.dto.status], { id: 'dispute-status' });
    },
    onError: (error) => toast.error('Impossible de mettre à jour le litige', { id: 'dispute-error', description: getApiErrorMessage(error) }),
  });
}
