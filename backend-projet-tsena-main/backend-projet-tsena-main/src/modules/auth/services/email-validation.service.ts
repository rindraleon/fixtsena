import { Injectable, Logger } from '@nestjs/common';
import {
  DISPOSABLE_EMAIL_DOMAINS,
  DISPOSABLE_DOMAIN_PATTERNS,
} from '../../../common/lists/disposable-email-domains';

export interface EmailValidationResult {
  valid: boolean;
  normalized: string;
  domain: string;
  errors: EmailValidationError[];
}

export enum EmailValidationError {
  EMPTY = 'empty',
  INVALID_FORMAT = 'invalid_format',
  DOMAIN_MISSING = 'domain_missing',
  DOMAIN_INVALID = 'domain_invalid',
  DISPOSABLE_DOMAIN = 'disposable_domain',
  DOMAIN_TOO_SHORT = 'domain_too_short',
  LOCAL_PART_TOO_LONG = 'local_part_too_long',
  DOMAIN_TOO_LONG = 'domain_too_long',
}

@Injectable()
export class EmailValidationService {
  private readonly logger = new Logger(EmailValidationService.name);

  private readonly EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  validate(email: string): EmailValidationResult {
    const errors: EmailValidationError[] = [];

    if (!email || typeof email !== 'string') {
      return {
        valid: false,
        normalized: '',
        domain: '',
        errors: [EmailValidationError.EMPTY],
      };
    }

    const normalized = email.trim().toLowerCase();

    if (!this.EMAIL_REGEX.test(normalized)) {
      errors.push(EmailValidationError.INVALID_FORMAT);
      return { valid: false, normalized, domain: '', errors };
    }

    const [localPart, ...domainParts] = normalized.split('@');
    const domain = domainParts.join('@');

    if (localPart.length > 64) {
      errors.push(EmailValidationError.LOCAL_PART_TOO_LONG);
    }
    if (domain.length > 255) {
      errors.push(EmailValidationError.DOMAIN_TOO_LONG);
    }

    if (!domain || domain.length < 3) {
      errors.push(EmailValidationError.DOMAIN_MISSING);
    } else if (!this.isValidDomainFormat(domain)) {
      errors.push(EmailValidationError.DOMAIN_INVALID);
    }

    if (this.isDisposableDomain(domain)) {
      errors.push(EmailValidationError.DISPOSABLE_DOMAIN);
    }

    return {
      valid: errors.length === 0,
      normalized,
      domain,
      errors,
    };
  }

  normalize(email: string): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  extractDomain(email: string): string {
    if (!email) return '';
    const normalized = this.normalize(email);
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex === -1) return '';
    return normalized.substring(atIndex + 1);
  }

  isDisposableDomain(domain: string): boolean {
    if (!domain) return false;
    const normalizedDomain = domain.trim().toLowerCase();

    if (DISPOSABLE_EMAIL_DOMAINS.has(normalizedDomain)) {
      return true;
    }

    for (const pattern of DISPOSABLE_DOMAIN_PATTERNS) {
      if (pattern.test(normalizedDomain)) {
        return true;
      }
    }

    const parts = normalizedDomain.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(-2).join('.');
      if (DISPOSABLE_EMAIL_DOMAINS.has(parentDomain)) {
        return true;
      }
    }

    return false;
  }

  private isValidDomainFormat(domain: string): boolean {
    if (!domain.includes('.')) return false;

    const domainRegex = /^[a-z0-9]+([-.][a-z0-9]+)*\.[a-z]{2,}$/;
    return domainRegex.test(domain);
  }
}
