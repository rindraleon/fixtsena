import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../../api/categories.api';
import { uploadApi } from '../../api/upload.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { CreateCategoryDto, UpdateCategoryDto } from '../../types/api';

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => categoriesApi.create(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.categories.created, { id: 'category-created' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.categories.createError, { id: 'category-create-error', description: getApiErrorMessage(error) }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => categoriesApi.update(id, dto),
    onSuccess: (category) => {
      queryClient.setQueryData(queryKeys.categories.detail(category.id), category);
      invalidate();
      toast.success(TOAST_MESSAGES.categories.updated, { id: 'category-updated' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.categories.updateError, { id: 'category-update-error', description: getApiErrorMessage(error) }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.categories.detail(id) });
      invalidate();
      toast.success(TOAST_MESSAGES.categories.deleted, { id: 'category-deleted' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.categories.deleteError, { id: 'category-delete-error', description: getApiErrorMessage(error) }),
  });
}

export function useUploadCategoryImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, file }: { categoryId: string; file: File }) => {
      const uploaded = await uploadApi.categoryImage(categoryId, file);
      return categoriesApi.update(categoryId, { imageUrl: uploaded.url });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success('Image de la catégorie enregistrée', { id: 'category-image-saved' });
    },
    onError: (error) => toast.error("Impossible de téléverser l'image", { id: 'category-image-error', description: getApiErrorMessage(error) }),
  });
}
