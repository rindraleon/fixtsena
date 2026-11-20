import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { StorageDriver, StoredFile, UPLOADS_PUBLIC_PREFIX } from './storage.types';

/**
 * Pilote de stockage sur le disque du serveur.
 * - Dossier : STORAGE_LOCAL_DIR (défaut `./storage/uploads`, créé au démarrage).
 * - Les fichiers sont servis en statique par l'application sous `/uploads/<clé>`
 *   (voir main.ts) avec des en-têtes de cache longs.
 * - URL stockée en base : `${APP_PUBLIC_URL}/uploads/<clé>` si APP_PUBLIC_URL est définie,
 *   sinon `/uploads/<clé>` (le frontend la résout par rapport à l'origine de l'API).
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly logger = new Logger(LocalStorageDriver.name);
  readonly rootDir: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.rootDir = resolve(this.configService.get<string>('STORAGE_LOCAL_DIR') || join(process.cwd(), 'storage', 'uploads'));
    this.publicUrl = (this.configService.get<string>('APP_PUBLIC_URL') || '').replace(/\/+$/, '');
    void fs.mkdir(this.rootDir, { recursive: true }).catch((error: Error) => {
      this.logger.error(`Impossible de créer le dossier de stockage ${this.rootDir}: ${error.message}`);
    });
  }

  /** Chemin absolu sûr (refuse toute tentative de sortie du dossier racine). */
  private safePath(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const target = resolve(this.rootDir, normalized);
    if (target !== this.rootDir && !target.startsWith(this.rootDir + sep)) {
      throw new ServiceUnavailableException('Clé de fichier invalide');
    }
    return target;
  }

  async upload(key: string, data: Buffer, _size: number, _contentType: string): Promise<StoredFile> {
    const target = this.safePath(key);
    try {
      await fs.mkdir(resolve(target, '..'), { recursive: true });
      await fs.writeFile(target, data);
    } catch (error) {
      this.logger.error(`Écriture impossible (${key})`, error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException(
        'Le service de stockage des fichiers est temporairement indisponible. Réessayez dans quelques instants.',
      );
    }
    return { key, url: `${this.publicUrl}${UPLOADS_PUBLIC_PREFIX}/${key}` };
  }

  async remove(key: string): Promise<void> {
    const target = this.safePath(key);
    try {
      await fs.unlink(target);
    } catch (error) {
      // Un fichier déjà absent n'est pas une erreur métier.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Suppression impossible (${key}): ${(error as Error).message}`);
      }
    }
  }

  keyFromUrl(url: string): string | null {
    const index = url.indexOf(`${UPLOADS_PUBLIC_PREFIX}/`);
    if (index === -1) return null;
    const key = url.slice(index + UPLOADS_PUBLIC_PREFIX.length + 1).split(/[?#]/)[0];
    return key ? decodeURIComponent(key) : null;
  }
}
