import axios, { type AxiosError } from 'axios';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'canceled'
  | 'validation'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server'
  | 'business'
  | 'unknown';

export interface FieldError {
  field: string;
  message: string;
}

interface BackendErrorBody {
  success?: boolean;
  message?: string | string[];
  errors?: Array<{ field?: string; message?: string }>;
  statusCode?: number;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly fieldErrors: FieldError[];
  readonly serverMessage?: string;
  readonly cause?: unknown;

  constructor(params: {
    message: string;
    kind: ApiErrorKind;
    status?: number;
    fieldErrors?: FieldError[];
    serverMessage?: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors ?? [];
    this.serverMessage = params.serverMessage;
    this.cause = params.cause;
  }
}

export const ERROR_MESSAGES = {
  network: 'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
  timeout: 'Le serveur met trop de temps à répondre. Veuillez réessayer.',
  canceled: 'La requête a été annulée.',
  400: 'Données invalides. Veuillez vérifier les champs du formulaire.',
  401: 'Session expirée. Veuillez vous reconnecter.',
  credentials: 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.',
  403: "Accès refusé : vous n'avez pas les droits nécessaires pour cette action.",
  404: 'Ressource introuvable.',
  409: 'Conflit : cette ressource existe déjà ou a été modifiée entre-temps.',
  422: 'Données invalides. Veuillez vérifier les informations saisies.',
  429: 'Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.',
  500: 'Erreur interne du serveur. Veuillez réessayer plus tard.',
  502: 'Serveur indisponible. Veuillez réessayer dans quelques instants.',
  503: 'Serveur indisponible. Veuillez réessayer dans quelques instants.',
  504: 'Le serveur ne répond pas. Veuillez réessayer plus tard.',
  unknown: 'Une erreur inattendue est survenue. Veuillez réessayer.',
} as const;

const TECHNICAL_PATTERNS = [
  /request failed with status code/i,
  /^ERR_/i,
  /AxiosError/i,
  /network error/i,
  /timeout of \d+ms exceeded/i,
  /^Internal server error$/i,
  /^Bad Request$/i,
  /^Unauthorized$/i,
  /^Forbidden$/i,
  /^Not Found$/i,
  /^Service Unavailable$/i,
  /^Conflict$/i,
  /^Too Many Requests$/i,
];

function isTechnical(message: string): boolean {
  return TECHNICAL_PATTERNS.some((re) => re.test(message));
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'business';
}

function defaultMessageForStatus(status: number): string {
  const known = ERROR_MESSAGES[status as keyof typeof ERROR_MESSAGES];
  if (typeof known === 'string') return known;
  if (status >= 500) return ERROR_MESSAGES[500];
  return ERROR_MESSAGES.unknown;
}

function extractServerMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { message } = body as BackendErrorBody;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message) && message.length > 0) return message.join(', ');
  return undefined;
}

function extractFieldErrors(body: unknown): FieldError[] {
  if (!body || typeof body !== 'object') return [];
  const { errors } = body as BackendErrorBody;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((e): e is { field: string; message: string } =>
      !!e && typeof e.field === 'string' && typeof e.message === 'string',
    )
    .map((e) => ({ field: e.field, message: e.message }));
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError({ message: ERROR_MESSAGES.canceled, kind: 'canceled', cause: error });
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<unknown>;

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError({ message: ERROR_MESSAGES.timeout, kind: 'timeout', cause: error });
    }

    if (!axiosError.response) {
      return new ApiError({ message: ERROR_MESSAGES.network, kind: 'network', cause: error });
    }

    const status = axiosError.response.status;
    const body = axiosError.response.data;
    const serverMessage = extractServerMessage(body);
    const fieldErrors = extractFieldErrors(body);
    const kind = fieldErrors.length > 0 ? 'validation' : kindFromStatus(status);

    const unauthenticatedCall = !!axiosError.config?.skipAuth;
    const useServerMessage =
      !!serverMessage &&
      !isTechnical(serverMessage) &&
      (status < 500 || status === 503) &&
      (status !== 401 || unauthenticatedCall);
    const fallbackMessage = status === 401 && unauthenticatedCall ? ERROR_MESSAGES.credentials : defaultMessageForStatus(status);

    return new ApiError({
      message: useServerMessage ? serverMessage : fallbackMessage,
      kind,
      status,
      fieldErrors,
      serverMessage,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      message: ERROR_MESSAGES.unknown,
      kind: 'unknown',
      cause: error,
    });
  }

  return new ApiError({ message: ERROR_MESSAGES.unknown, kind: 'unknown', cause: error });
}

export function getApiErrorMessage(error: unknown, fallback?: string): string {
  const normalized = normalizeApiError(error);
  if (normalized.kind === 'unknown' && fallback) return fallback;
  return normalized.message;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  const normalized = normalizeApiError(error);
  const result: Record<string, string> = {};
  for (const fe of normalized.fieldErrors) {
    if (!result[fe.field]) result[fe.field] = fe.message;
  }
  return result;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAuthError(error: unknown): boolean {
  return normalizeApiError(error).kind === 'auth';
}

export function isForbiddenError(error: unknown): boolean {
  return normalizeApiError(error).kind === 'forbidden';
}

export function isNotFoundError(error: unknown): boolean {
  return normalizeApiError(error).kind === 'not_found';
}

export function isNetworkError(error: unknown): boolean {
  const { kind } = normalizeApiError(error);
  return kind === 'network' || kind === 'timeout';
}

export function isTransportError(error: unknown): boolean {
  return axios.isAxiosError(error);
}

export function isPriceChangeError(error: unknown): boolean {
  const normalized = normalizeApiError(error);
  return normalized.status === 409 && normalized.fieldErrors.some((fe) => fe.field.startsWith('product:'));
}
