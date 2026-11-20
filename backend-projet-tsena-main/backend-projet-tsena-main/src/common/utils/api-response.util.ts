export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: ValidationError[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export function successResponse<T>(
  data: T,
  message = 'Opération réussie',
  meta?: PaginationMeta,
): ApiResponse<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(
  message: string,
  errors?: ValidationError[],
): ApiResponse {
  return { success: false, message, errors };
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
