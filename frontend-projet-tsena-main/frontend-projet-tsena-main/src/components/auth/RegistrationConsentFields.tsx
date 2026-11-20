import { Calendar } from 'lucide-react';
import { FormField } from '../form';
import { GENDER_LABELS, type Gender } from '../../types/api';

export interface RegistrationConsent {
  birthDate: string;
  gender: '' | Gender;
  marketingOptIn: boolean;
  acceptTerms: boolean;
}

export const EMPTY_CONSENT: RegistrationConsent = { birthDate: '', gender: '', marketingOptIn: false, acceptTerms: false };

export const TERMS_REQUIRED_MESSAGE = "Vous devez accepter les conditions générales d'utilisation pour créer un compte";
export const BIRTH_DATE_INVALID_MESSAGE = 'La date de naissance doit être une date passée valide';

export function validateConsent(consent: RegistrationConsent): { birthDate?: string; acceptTerms?: string } {
  const errors: { birthDate?: string; acceptTerms?: string } = {};
  if (!consent.acceptTerms) errors.acceptTerms = TERMS_REQUIRED_MESSAGE;
  if (consent.birthDate) {
    const date = new Date(`${consent.birthDate}T00:00:00`);
    const min = new Date();
    min.setFullYear(min.getFullYear() - 120);
    if (Number.isNaN(date.getTime()) || date > new Date() || date < min) errors.birthDate = BIRTH_DATE_INVALID_MESSAGE;
  }
  return errors;
}

export function toRegisterConsentPayload(consent: RegistrationConsent) {
  return {
    acceptTerms: consent.acceptTerms,
    birthDate: consent.birthDate || undefined,
    gender: consent.gender || undefined,
    marketingOptIn: consent.marketingOptIn || undefined,
  };
}

interface Props {
  readonly value: RegistrationConsent;
  readonly onChange: (next: RegistrationConsent) => void;
  readonly errors?: { birthDate?: string; acceptTerms?: string };
  readonly disabled?: boolean;
}

export default function RegistrationConsentFields({ value, onChange, errors, disabled }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const set = <K extends keyof RegistrationConsent>(key: K, next: RegistrationConsent[K]) => onChange({ ...value, [key]: next });

  return (
    <fieldset className="space-y-4" disabled={disabled} data-testid="registration-consent">
      <legend className="sr-only">Informations complémentaires et consentements</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Date de naissance"
          type="date"
          icon={Calendar}
          value={value.birthDate}
          max={today}
          onChange={(e) => set('birthDate', e.target.value)}
          autoComplete="bday"
          error={errors?.birthDate}
          hint="Recommandée : sert uniquement au calcul de votre âge."
          data-testid="register-birth-date"
        />
        <FormField as="select" label="Sexe" value={value.gender} onChange={(e) => set('gender', e.target.value as RegistrationConsent['gender'])} hint="Facultatif, jamais utilisé pour limiter un achat." data-testid="register-gender">
          <option value="">Ne pas renseigner</option>
          {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
            <option key={g} value={g}>{GENDER_LABELS[g]}</option>
          ))}
        </FormField>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary" checked={value.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} data-testid="register-marketing-opt-in" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">Recevoir les offres et actualités Tsena par e-mail</span>
            <span className="block text-xs text-muted">Facultatif et révocable à tout moment depuis votre profil.</span>
          </span>
        </label>

        <label className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${errors?.acceptTerms ? 'border-danger bg-danger/5' : 'border-border hover:bg-surface-hover'}`}>
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-primary"
            checked={value.acceptTerms}
            onChange={(e) => set('acceptTerms', e.target.checked)}
            aria-invalid={errors?.acceptTerms ? true : undefined}
            aria-describedby={errors?.acceptTerms ? 'register-terms-error' : undefined}
            data-testid="register-accept-terms"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">
              J'accepte les <a href="/a-propos#cgu" target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">conditions générales d'utilisation</a> <span className="text-danger" aria-hidden="true">*</span>
            </span>
            <span className="block text-xs text-muted">Obligatoire pour créer un compte.</span>
          </span>
        </label>
        {errors?.acceptTerms && (
          <p id="register-terms-error" role="alert" className="text-xs text-danger font-medium">{errors.acceptTerms}</p>
        )}
      </div>

      <p className="text-[11px] text-muted leading-relaxed">
        Vos données servent à la personnalisation de votre expérience et à des statistiques anonymisées. Les communications
        commerciales ne sont envoyées qu'avec votre consentement explicite, modifiable depuis votre profil.
      </p>
    </fieldset>
  );
}
