import { useMutation, useQueryClient } from '@tanstack/react-query';
import { badgesApi } from '../../api/badges.api';
import { queryKeys } from '../../lib/query-keys';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { BadgeDto } from '../../types/api';

function useInvalidateBadges() {
  const queryClient = useQueryClient();
  return (userId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.badges.all });
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.badges.forUser(userId) });
  };
}

export function useSaveBadge() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: BadgeDto }) => (id ? badgesApi.update(id, dto) : badgesApi.create(dto)),
    onSuccess: (_badge, variables) => {
      invalidate();
      toast.success(variables.id ? 'Badge mis à jour' : 'Badge créé', { id: 'badge-saved' });
    },
    onError: (error) => toast.error("Impossible d'enregistrer le badge", { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}

export function useRemoveBadge() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: (id: string) => badgesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Badge supprimé', { id: 'badge-removed' });
    },
    onError: (error) => toast.error('Impossible de supprimer le badge', { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}

export function useAwardBadge() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: ({ userId, badgeId }: { userId: string; badgeId: string }) => badgesApi.award(userId, badgeId),
    onSuccess: (_result, variables) => {
      invalidate(variables.userId);
      toast.success('Badge attribué', { id: 'badge-awarded', description: "L'utilisateur en est informé." });
    },
    onError: (error) => toast.error("Impossible d'attribuer le badge", { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}

export function useRevokeBadge() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: ({ userId, badgeId }: { userId: string; badgeId: string }) => badgesApi.revoke(userId, badgeId),
    onSuccess: (_result, variables) => {
      invalidate(variables.userId);
      toast.success('Badge retiré', { id: 'badge-revoked' });
    },
    onError: (error) => toast.error('Impossible de retirer le badge', { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}

export function useEvaluateBadges() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: (userId: string) => badgesApi.evaluate(userId),
    onSuccess: (result, userId) => {
      invalidate(userId);
      const summary = [
        result.awarded.length ? `+ ${result.awarded.join(', ')}` : null,
        result.revoked.length ? `− ${result.revoked.join(', ')}` : null,
      ].filter(Boolean).join(' · ');
      toast.success('Badges réévalués', { id: 'badge-evaluated', description: summary || 'Aucun changement : les critères actuels sont respectés.' });
    },
    onError: (error) => toast.error("Impossible d'évaluer les badges", { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}

export function useSeedDefaultBadges() {
  const invalidate = useInvalidateBadges();
  return useMutation({
    mutationFn: () => badgesApi.seedDefaults(),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.created > 0 ? `${result.created} badge(s) par défaut créé(s)` : 'Les badges par défaut existent déjà', { id: 'badge-seed' });
    },
    onError: (error) => toast.error('Impossible de créer les badges par défaut', { id: 'badge-error', description: getApiErrorMessage(error) }),
  });
}
