import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../api/products.api';
import { uploadApi } from '../../api/upload.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { ApiProduct, CreateProductDto, UpdateProductDto } from '../../types/api';

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return (product?: Pick<ApiProduct, 'id' | 'slug'>) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.sellerStats() });
    void queryClient.invalidateQueries({ queryKey: ['products', 'featured'] });
    if (product) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.id) });
      if (product.slug) void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.slug) });
    }
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (dto: CreateProductDto) => productsApi.create(dto),
    onSuccess: (product) => {
      invalidate(product);
      toast.success(TOAST_MESSAGES.products.created, { id: 'product-created' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.createError, { id: 'product-create-error', description: getApiErrorMessage(error) }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) => productsApi.update(id, dto),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(product.id), product);
      invalidate(product);
      toast.success(TOAST_MESSAGES.products.updated, { id: 'product-updated' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.updateError, { id: 'product-update-error', description: getApiErrorMessage(error) }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.products.detail(id) });
      invalidate();
      toast.success(TOAST_MESSAGES.products.deleted, { id: 'product-deleted' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.deleteError, { id: 'product-delete-error', description: getApiErrorMessage(error) }),
  });
}

export function useUploadProductImage() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, file, isPrimary }: { productId: string; file: File; isPrimary?: boolean }) =>
      uploadApi.productImage(productId, file, { isPrimary }),
    onSuccess: (_image, { productId, isPrimary }) => {
      invalidate({ id: productId, slug: '' });
      toast.success(isPrimary ? 'Image de couverture enregistrée' : TOAST_MESSAGES.products.imageAdded, { id: 'product-image-added' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.imageError, { id: 'product-image-error', description: getApiErrorMessage(error) }),
  });
}

export function useAddProductImageUrl() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, url, isPrimary }: { productId: string; url: string; isPrimary?: boolean }) =>
      productsApi.addImage(productId, { url, isPrimary }),
    onSuccess: (_image, { productId }) => {
      invalidate({ id: productId, slug: '' });
      toast.success(TOAST_MESSAGES.products.imageAdded, { id: 'product-image-added' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.imageError, { id: 'product-image-error', description: getApiErrorMessage(error) }),
  });
}

export function useUploadProductImages() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: File[] }) => uploadApi.productImages(productId, files),
    onSuccess: (images, { productId, files }) => {
      invalidate({ id: productId, slug: '' });
      const count = Array.isArray(images) ? images.length : files.length;
      toast.success(count > 1 ? `${count} images ajoutées avec succès` : TOAST_MESSAGES.products.imageAdded, { id: 'product-image-added' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.imageError, { id: 'product-image-error', description: getApiErrorMessage(error) }),
  });
}

export function useSetPrimaryProductImage() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) => productsApi.setPrimaryImage(productId, imageId),
    onSuccess: (_images, { productId }) => {
      invalidate({ id: productId, slug: '' });
      toast.success(TOAST_MESSAGES.products.coverUpdated, { id: 'product-cover-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'product-cover-error' }),
  });
}

export function useReorderProductImages() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, imageIds }: { productId: string; imageIds: string[] }) => productsApi.reorderImages(productId, imageIds),
    onSuccess: (_images, { productId }) => {
      invalidate({ id: productId, slug: '' });
      toast.success(TOAST_MESSAGES.products.imagesReordered, { id: 'product-images-reordered' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.products.imageOrderError, { id: 'product-images-reorder-error', description: getApiErrorMessage(error) }),
  });
}

export function useDeleteProductImage() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      productsApi.removeImage(productId, imageId),
    onSuccess: (_data, { productId }) => {
      invalidate({ id: productId, slug: '' });
      toast.success(TOAST_MESSAGES.products.imageDeleted, { id: 'product-image-deleted' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'product-image-delete-error' }),
  });
}
