import { del, post } from './client';
import type { UploadResult, UploadedProductImage } from '../types/api';

const UPLOAD_TIMEOUT_MS = 60_000;

function fileForm(field: string, file: File, extra?: Record<string, string>): FormData {
  const form = new FormData();
  form.append(field, file);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
  }
  return form;
}

export const uploadApi = {
  productImage: (productId: string, file: File, options: { isPrimary?: boolean; alt?: string } = {}) =>
    post<UploadedProductImage>(
      `/upload/product/${productId}/image`,
      fileForm('file', file, {
        ...(options.isPrimary !== undefined ? { isPrimary: String(options.isPrimary) } : {}),
        ...(options.alt ? { alt: options.alt } : {}),
      }),
      { timeout: UPLOAD_TIMEOUT_MS },
    ),

  productImages: (productId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return post<UploadedProductImage[]>(`/upload/product/${productId}/images`, form, {
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  categoryImage: (categoryId: string, file: File) =>
    post<UploadResult>(`/upload/category/${categoryId}/image`, fileForm('file', file), {
      timeout: UPLOAD_TIMEOUT_MS,
    }),

  avatar: (file: File) =>
    post<UploadResult>('/upload/avatar', fileForm('file', file), { timeout: UPLOAD_TIMEOUT_MS }),

  disputeEvidence: (disputeId: string, file: File) =>
    post<UploadResult>(`/upload/dispute/${disputeId}/evidence`, fileForm('file', file), { timeout: UPLOAD_TIMEOUT_MS }),

  remove: (key: string) => del<null>(`/upload/${key}`),
};
