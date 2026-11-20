import { Injectable, Logger } from '@nestjs/common';
import { S3ClientService } from '../s3.client';
import { StoredFile } from './storage.types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly storageClient: S3ClientService) {}

  get bucket(): string {
    return this.storageClient.bucketName;
  }

  buildKey(folder: string, entityId: string, originalName: string): string {
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '');
    const safeEntity = entityId.replace(/[^a-z0-9_-]/gi, '');
    const ext = this.extensionOf(originalName);
    return `${safeFolder}/${safeEntity}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  }

  async upload(key: string, data: Buffer, size: number, contentType: string): Promise<StoredFile> {
    const url = await this.storageClient.upload(key, data, size, contentType);
    return { key, url };
  }

  remove(key: string): Promise<void> {
    return this.storageClient.remove(key);
  }

  async removeByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const key = this.keyFromUrl(url);
    if (!key) return;
    try {
      await this.storageClient.remove(key);
    } catch (error) {
      this.logger.warn(`Fichier non supprimé (${key}): ${(error as Error).message}`);
    }
  }

  urlFor(key: string): string {
    return this.storageClient.getObjectUrl(key);
  }

  keyFromUrl(url: string): string | null {
    const marker = `/${this.storageClient.bucketName}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const key = url.slice(index + marker.length).split(/[?#]/)[0];
    return key ? decodeURIComponent(key) : null;
  }

  private extensionOf(filename: string): string {
    const dot = filename.lastIndexOf('.');
    const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
    return /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : '.jpg';
  }
}
