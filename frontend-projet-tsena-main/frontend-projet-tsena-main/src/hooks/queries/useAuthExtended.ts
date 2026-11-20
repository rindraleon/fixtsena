import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services';

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => authService.resendVerification(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authService.resetPassword(token, newPassword),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useCheckResetToken(token: string) {
  return useQuery({
    queryKey: ['auth', 'reset-token', token],
    queryFn: () => Promise.resolve({ valid: !!token }),
    enabled: !!token,
    retry: false,
  });
}
