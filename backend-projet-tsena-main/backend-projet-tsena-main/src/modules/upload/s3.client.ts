import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { envInt, envBool } from '../../common/utils/env.util';

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const candidate = error as { code?: string; name?: string; message?: string } | null;
  return candidate?.code || candidate?.message || candidate?.name || String(error);
}

@Injectable()
export class S3ClientService {
  private readonly logger = new Logger(S3ClientService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    const region = configService.get<string>('AWS_REGION') || configService.get<string>('MINIO_REGION') || 'us-east-1';
    const s3Endpoint = configService.get<string>('AWS_ENDPOINT_URL_S3')?.trim();
    this.bucket =
      configService.get<string>('S3_BUCKET')?.trim() ||
      (s3Endpoint ? 'assets' : configService.get<string>('MINIO_BUCKET')?.trim()) ||
      'assets';
    const minioEndpoint = configService.get<string>('MINIO_ENDPOINT');
    const minioProtocol = envBool(configService.get<string>('MINIO_USE_SSL'), false) ? 'https' : 'http';
    const endpoint =
      s3Endpoint ||
      (minioEndpoint
        ? `${minioProtocol}://${minioEndpoint}:${envInt(configService.get<string>('MINIO_PORT'), 9000)}`
        : `https://s3.${region}.amazonaws.com`);
    this.publicBaseUrl = (
      configService.get<string>('S3_PUBLIC_URL') ||
      configService.get<string>('MINIO_PUBLIC_URL') ||
      endpoint
    );
    while (this.publicBaseUrl.endsWith('/')) {
      this.publicBaseUrl = this.publicBaseUrl.slice(0, -1);
    }

    const accessKeyId =
      configService.get<string>('AWS_ACCESS_KEY_ID') ||
      configService.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey =
      configService.get<string>('AWS_SECRET_ACCESS_KEY') ||
      configService.get<string>('MINIO_SECRET_KEY');
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new Error('AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY doivent être configurées ensemble.');
    }

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
  }

  get bucketName(): string {
    return this.bucket;
  }

  async upload(objectName: string, data: Buffer, size: number, contentType: string): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectName,
          Body: data,
          ContentLength: size,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi de ${objectName} vers le stockage`,
        error instanceof Error ? error.stack : describeError(error),
      );
      throw new ServiceUnavailableException(
        'Le service de stockage des fichiers est temporairement indisponible. Réessayez dans quelques instants.',
      );
    }
    return this.getObjectUrl(objectName);
  }

  getObjectUrl(objectName: string): string {
    const encodedKey = encodeURIComponent(objectName).replace(/%2F/gi, '/');
    return `${this.publicBaseUrl}/${encodeURIComponent(this.bucket)}/${encodedKey}`;
  }

  async remove(objectName: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectName }));
    } catch (error) {
      this.logger.error(
        `Échec de la suppression de ${objectName}`,
        error instanceof Error ? error.stack : describeError(error),
      );
      throw new ServiceUnavailableException(
        'Le service de stockage des fichiers est temporairement indisponible. Réessayez dans quelques instants.',
      );
    }
  }
}
