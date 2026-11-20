import { ConfigService } from '@nestjs/config';
import { envBool } from '../../common/utils/env.util';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

const PLACEHOLDER_PASSWORDS = new Set(
  ['CHANGE_ME', 'CHANGEME', 'CHANGE_ME_WITH_A_STRONG_PASSWORD', 'Admin1234!@tsena', 'Admin1234!', 'Admin@1234', 'Tsena@2026', 'password', 'Password123', 'admin', 'admin123'].map((v) =>
    v.toLowerCase(),
  ),
);

export interface AdminBootstrapConfig {
  readonly enabled: boolean;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly bio: string | null;
  readonly resetPassword: boolean;
}

export type AdminBootstrapReadResult =
  | { readonly status: 'disabled'; readonly reason: string }
  | { readonly status: 'invalid'; readonly errors: string[] }
  | { readonly status: 'ok'; readonly config: AdminBootstrapConfig };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function unquote(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function validateAdminPassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    errors.push(`ADMIN_PASSWORD doit contenir au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.push('ADMIN_PASSWORD doit contenir une minuscule, une majuscule et un chiffre');
  }
  if (PLACEHOLDER_PASSWORDS.has(password.toLowerCase()) || /change[_-]?me/i.test(password)) {
    errors.push("ADMIN_PASSWORD utilise une valeur d'exemple : choisissez un mot de passe unique");
  }
  return errors;
}

export function readAdminBootstrapConfig(config: ConfigService): AdminBootstrapReadResult {
  const enabled = envBool(config.get<string>('ADMIN_BOOTSTRAP'), true);
  if (!enabled) {
    return { status: 'disabled', reason: 'ADMIN_BOOTSTRAP=false' };
  }

  const email = unquote(config.get<string>('ADMIN_EMAIL')).toLowerCase();
  const password = unquote(config.get<string>('ADMIN_PASSWORD'));
  if (!email && !password) {
    return { status: 'disabled', reason: 'ADMIN_EMAIL / ADMIN_PASSWORD non définis' };
  }

  const errors: string[] = [];
  if (!email) errors.push('ADMIN_EMAIL est requis lorsque ADMIN_PASSWORD est défini');
  else if (!EMAIL_PATTERN.test(email)) errors.push(`ADMIN_EMAIL « ${email} » n'est pas une adresse valide`);
  if (!password) errors.push('ADMIN_PASSWORD est requis lorsque ADMIN_EMAIL est défini');
  else errors.push(...validateAdminPassword(password));

  if (errors.length > 0) {
    return { status: 'invalid', errors };
  }

  const phone = unquote(config.get<string>('ADMIN_PHONE'));
  const bio = unquote(config.get<string>('ADMIN_BIO'));

  return {
    status: 'ok',
    config: {
      enabled: true,
      email,
      password,
      firstName: unquote(config.get<string>('ADMIN_FIRST_NAME')) || 'Admin',
      lastName: unquote(config.get<string>('ADMIN_LAST_NAME')) || 'Principal',
      phone: phone || null,
      bio: bio || null,
      resetPassword: envBool(config.get<string>('ADMIN_RESET_PASSWORD'), false),
    },
  };
}
