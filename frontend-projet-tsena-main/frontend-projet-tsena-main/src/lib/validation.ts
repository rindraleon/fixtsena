export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
export const PHONE_RULE = /^[+\d][\d\s().-]{5,}$/;
export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const VALIDATION_MESSAGES = {
  required: 'Ce champ est obligatoire.',
  email: 'Adresse e-mail invalide.',
  password: 'Au moins 8 caractères, avec une majuscule, une minuscule et un chiffre.',
  passwordMismatch: 'Les mots de passe ne correspondent pas.',
  phone: 'Numéro de téléphone invalide.',
  minLength: (n: number) => `Au moins ${n} caractères.`,
  maxLength: (n: number) => `${n} caractères maximum.`,
} as const;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return VALIDATION_MESSAGES.required;
  if (!EMAIL_RULE.test(value.trim())) return VALIDATION_MESSAGES.email;
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return VALIDATION_MESSAGES.required;
  if (!PASSWORD_RULE.test(value)) return VALIDATION_MESSAGES.password;
  return undefined;
}

export function validateName(value: string, min = 2, max = 50): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return VALIDATION_MESSAGES.required;
  if (trimmed.length < min) return VALIDATION_MESSAGES.minLength(min);
  if (trimmed.length > max) return VALIDATION_MESSAGES.maxLength(max);
  return undefined;
}

export function validatePhone(value: string, required = false): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required ? VALIDATION_MESSAGES.required : undefined;
  if (!PHONE_RULE.test(trimmed)) return VALIDATION_MESSAGES.phone;
  return undefined;
}

export function compactErrors<T extends Record<string, string | undefined>>(errors: T): Partial<Record<keyof T, string>> {
  const result: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(errors) as (keyof T)[]) {
    if (errors[key]) result[key] = errors[key];
  }
  return result;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
