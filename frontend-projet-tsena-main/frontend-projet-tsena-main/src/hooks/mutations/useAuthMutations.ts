import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { tokenStorage } from '../../lib/token-storage';
import { usersApi } from '../../api/users.api';
import { uploadApi } from '../../api/upload.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import { useAuth } from '../../context/AuthContext';
import type { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from '../../types/api';

export function useLogin() {
  const { login } = useAuth();
  return useMutation({
    mutationFn: (dto: LoginDto) => login(dto),
    onSuccess: () => toast.success(TOAST_MESSAGES.auth.loginSuccess, { id: 'login-success' }),
    onError: (error) =>
      toast.error(TOAST_MESSAGES.auth.loginError, { id: 'login-error', description: getApiErrorMessage(error) }),
  });
}

export function useRegister() {
  const { register } = useAuth();
  return useMutation({
    mutationFn: (dto: RegisterDto) => register(dto),
    onSuccess: () => toast.success(TOAST_MESSAGES.auth.registerSuccess, { id: 'register-success' }),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'register-error' }),
  });
}

export function useUpdateProfile() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProfileDto) => authApi.updateProfile(dto),
    onSuccess: (user) => {
      updateUser(user);
      queryClient.setQueryData(queryKeys.auth.me(), user);
      toast.success(TOAST_MESSAGES.auth.profileUpdated, { id: 'profile-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'profile-update-error' }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (dto: ChangePasswordDto) => authApi.changePassword(dto),
    onSuccess: (data) => {
      if (data?.tokens) tokenStorage.setTokens(data.tokens);
      toast.success('Mot de passe modifié avec succès', { id: 'password-changed' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'password-change-error' }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () =>
      toast.success('Demande envoyée', { id: 'forgot-password-sent', description: 'Si un compte existe pour cet e-mail, un lien de réinitialisation vient de vous être envoyé.' }),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'forgot-password-error' }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
    onSuccess: () => toast.success('Mot de passe réinitialisé avec succès', { id: 'password-reset' }),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'password-reset-error' }),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: () => toast.success('Adresse e-mail vérifiée', { id: 'email-verified' }),
    onError: (error) => toast.error('Vérification impossible', { id: 'email-verify-error', description: getApiErrorMessage(error, 'Lien de vérification invalide.') }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => authApi.resendVerification(),
    onSuccess: () => toast.success('E-mail de vérification renvoyé', { id: 'verification-resent' }),
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'verification-resend-error' }),
  });
}

export function useRequestSellerAccount() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.requestSellerAccount(),
    onSuccess: (user) => {
      updateUser(user);
      queryClient.setQueryData(queryKeys.auth.me(), user);
      toast.success('Demande envoyée', { id: 'seller-request', description: 'Un administrateur examinera votre demande prochainement.' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'seller-request-error' }),
  });
}

export function useUploadAvatar() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadApi.avatar(file);
      return authApi.updateProfile({ avatarUrl: uploaded.url });
    },
    onSuccess: (user) => {
      updateUser(user);
      queryClient.setQueryData(queryKeys.auth.me(), user);
      toast.success('Photo de profil mise à jour', { id: 'avatar-updated' });
    },
    onError: (error) => toast.error("Impossible de mettre à jour la photo de profil", { id: 'avatar-error', description: getApiErrorMessage(error) }),
  });
}
