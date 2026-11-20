import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { StoredFile } from './storage/storage.types';

type UploadKind = 'image' | 'evidence';

const IMAGE_SIGNATURES: Array<{ mime: string; test: (buffer: Buffer) => boolean }> = [
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/gif', test: (b) => b.length > 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')) },
  { mime: 'image/webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];
const PDF_SIGNATURE = (b: Buffer) => b.length > 5 && b.subarray(0, 5).toString('ascii') === '%PDF-';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  readonly ALLOWED_EVIDENCE_TYPES = [...this.ALLOWED_IMAGE_TYPES, 'application/pdf'];
  readonly MAX_SIZE = 5 * 1024 * 1024;

  constructor(private readonly storage: StorageService) {}

  uploadProductImage(file: Express.Multer.File, productId: string): Promise<StoredFile> {
    return this.store(file, 'products', productId, 'image');
  }

  uploadCategoryImage(file: Express.Multer.File, categoryId: string): Promise<StoredFile> {
    return this.store(file, 'categories', categoryId, 'image');
  }

  uploadAvatar(file: Express.Multer.File, userId: string): Promise<StoredFile> {
    return this.store(file, 'avatars', userId, 'image');
  }

  uploadShopImage(file: Express.Multer.File, shopId: string, kind: 'logo' | 'cover'): Promise<StoredFile> {
    return this.store(file, `shops/${kind}`, shopId, 'image');
  }

  uploadDisputeEvidence(file: Express.Multer.File, disputeId: string): Promise<StoredFile> {
    return this.store(file, 'disputes', disputeId, 'evidence');
  }

  uploadMessageAttachment(file: Express.Multer.File, conversationId: string): Promise<StoredFile> {
    return this.store(file, 'messages', conversationId, 'evidence');
  }

  async uploadMultiple(files: Express.Multer.File[], folder: string, entityId: string): Promise<StoredFile[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    files.forEach((file) => this.validateFile(file, 'image'));
    const results: StoredFile[] = [];
    for (const file of files) {
      const optimized = await this.optimizeImage(file);
      results.push(await this.storage.upload(this.storage.buildKey(folder, entityId, optimized.originalname), optimized.buffer, optimized.size, optimized.mimetype));
    }
    return results;
  }

  removeFile(key: string): Promise<void> {
    return this.storage.remove(key);
  }

  removeByUrl(url: string | null | undefined): Promise<void> {
    return this.storage.removeByUrl(url);
  }

  private async store(file: Express.Multer.File, folder: string, entityId: string, kind: UploadKind): Promise<StoredFile> {
    this.validateFile(file, kind);
    const optimized = await this.optimizeImage(file);
    const key = this.storage.buildKey(folder, entityId, optimized.originalname);
    const stored = await this.storage.upload(key, optimized.buffer, optimized.size, optimized.mimetype);
    this.logger.log(`Fichier stocké: ${key} (${file.size} → ${optimized.size} octets)`);
    return stored;
  }

  private async optimizeImage(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file.mimetype.startsWith('image/') || file.mimetype === 'image/gif') return file;
    if (process.env.UPLOAD_OPTIMIZE_IMAGES === 'false') return file;
    try {
      const moduleName = 'sharp';
      const sharpModule = (await import(moduleName).catch(() => null)) as { default?: unknown } | null;
      const sharp = (sharpModule?.default ?? sharpModule) as ((input: Buffer) => any) | null;
      if (typeof sharp !== 'function') return file;
      const maxSide = Number(process.env.UPLOAD_MAX_IMAGE_SIDE) || 1600;
      const buffer: Buffer = await sharp(file.buffer)
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      if (!buffer || buffer.length === 0 || buffer.length >= file.size * 1.05) return file;
      const originalname = file.originalname.replace(/\.[a-z0-9]+$/i, '') + '.webp';
      return { ...file, buffer, size: buffer.length, mimetype: 'image/webp', originalname };
    } catch (error) {
      this.logger.warn(`Optimisation d'image ignorée : ${(error as Error).message}`);
      return file;
    }
  }

  validateFile(file: Express.Multer.File | undefined, kind: UploadKind = 'image'): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const allowed = kind === 'image' ? this.ALLOWED_IMAGE_TYPES : this.ALLOWED_EVIDENCE_TYPES;
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé: ${file.mimetype}. Types autorisés: ${kind === 'image' ? 'JPEG, PNG, WebP, GIF' : 'JPEG, PNG, WebP, GIF, PDF'}`,
      );
    }
    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(`Fichier trop volumineux: ${(file.size / 1024 / 1024).toFixed(2)} Mo. Maximum: 5 Mo`);
    }
    const detected = IMAGE_SIGNATURES.find((signature) => signature.test(file.buffer))?.mime ?? (PDF_SIGNATURE(file.buffer) ? 'application/pdf' : null);
    if (!detected || !allowed.includes(detected)) {
      throw new BadRequestException('Le contenu du fichier ne correspond pas à une image valide (JPEG, PNG, WebP ou GIF).');
    }
  }
}
