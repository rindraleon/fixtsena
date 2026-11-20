import { BadRequestException, ValidationError as ClassValidatorError } from '@nestjs/common';
import { ValidationError } from '../utils/api-response.util';

const SENSITIVE_FIELDS = /password|secret|token|otp|code/i;

function safeValue(field: string, value: unknown): unknown {
  if (SENSITIVE_FIELDS.test(field)) return undefined;
  if (typeof value === 'string' && value.length > 200) return `${value.slice(0, 200)}…`;
  if (value !== null && typeof value === 'object') return undefined;
  return value;
}

export function flattenValidationErrors(
  errors: ClassValidatorError[],
  parentPath = '',
): ValidationError[] {
  const result: ValidationError[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      const [message] = Object.values(error.constraints);
      result.push({ field, message, value: safeValue(field, error.value) });
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, field));
    }
  }

  return result;
}

export function validationExceptionFactory(errors: ClassValidatorError[]) {
  const details = flattenValidationErrors(errors);
  return new BadRequestException({
    message: 'Données invalides. Veuillez vérifier les champs du formulaire.',
    errors: details,
  });
}
