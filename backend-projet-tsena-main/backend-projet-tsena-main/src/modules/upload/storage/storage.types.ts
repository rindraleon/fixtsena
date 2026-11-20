export const UPLOADS_PUBLIC_PREFIX = '/uploads';

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageDriver {
  readonly name: 'local' | 's3';
  upload(key: string, data: Buffer, size: number, contentType: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  keyFromUrl(url: string): string | null;
}
