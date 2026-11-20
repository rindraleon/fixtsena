import { get, patch, post } from './client';
import type {
  ApiUser,
  AuthResponse,
  AuthTokens,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  RegisterOptions,
  UpdateProfileDto,
} from '../types/api';

export const authApi = {
  register: (dto: RegisterDto) =>
    post<AuthResponse>('/auth/register', dto, { skipAuth: true, skipAuthRefresh: true }),

  registerOptions: () =>
    get<RegisterOptions>('/auth/register/options', { skipAuth: true, skipAuthRefresh: true }),

  login: (dto: LoginDto) =>
    post<AuthResponse>('/auth/login', dto, { skipAuth: true, skipAuthRefresh: true }),

  refresh: (refreshToken: string) =>
    post<AuthResponse>('/auth/refresh', { refreshToken }, { skipAuth: true, skipAuthRefresh: true }),

  logout: () => post<null>('/auth/logout', undefined, { skipAuthRefresh: true }),

  me: () => get<ApiUser>('/auth/me'),

  updateProfile: (dto: UpdateProfileDto) => patch<ApiUser>('/auth/me', dto),

  verifyEmail: (token: string) =>
    post<ApiUser | null>('/auth/verify-email', { token }, { skipAuth: true, skipAuthRefresh: true }),

  resendVerification: () => post<null>('/auth/email-verification/resend'),

  forgotPassword: (email: string) =>
    post<null>('/auth/forgot-password', { email }, { skipAuth: true, skipAuthRefresh: true }),

  resetPassword: (token: string, newPassword: string) =>
    post<null>('/auth/reset-password', { token, newPassword }, { skipAuth: true, skipAuthRefresh: true }),

  changePassword: (dto: ChangePasswordDto) =>
    post<{ tokens: AuthTokens | null } | null>('/auth/change-password', dto),
};
