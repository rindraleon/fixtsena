import { Injectable } from '@nestjs/common';
import { S3ClientService } from '../s3.client';
import { StorageDriver, StoredFile } from './storage.types';

/** Pilote de stockage objet S3-compatible. */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;

  constructor(private readonly storageClient: S3ClientService) {}

  async upload(key: string, data: Buffer, size: number, contentType: string): Promise<StoredFile> {
    const url = await this.storageClient.upload(key, data, size, contentType);
    return { key, url };
  }

  remove(key: string): Promise<void> {
    return this.storageClient.remove(key);
  }

  keyFromUrl(url: string): string | null {
    const marker = `/${this.storageClient.bucketName}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const key = url.slice(index + marker.length).split(/[?#]/)[0];
    return key ? decodeURIComponent(key) : null;
  }
}
