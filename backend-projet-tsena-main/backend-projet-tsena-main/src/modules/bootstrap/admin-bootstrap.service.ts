import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Profile, User } from '../../database/entities';
import { AccountStatus, UserRole } from '../../database/entities/role.enum';
import { envInt } from '../../common/utils/env.util';
import { AdminBootstrapConfig, readAdminBootstrapConfig } from './admin-bootstrap.config';

export type AdminBootstrapOutcome = 'disabled' | 'invalid' | 'created' | 'unchanged' | 'reset' | 'error';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile) private readonly profilesRepository: Repository<Profile>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureAdminAccount();
  }

  async ensureAdminAccount(): Promise<AdminBootstrapOutcome> {
    const read = readAdminBootstrapConfig(this.configService);

    if (read.status === 'disabled') {
      this.logger.debug(`Bootstrap administrateur ignoré (${read.reason}).`);
      return 'disabled';
    }
    if (read.status === 'invalid') {
      this.logger.error(
        `Compte administrateur NON créé — configuration invalide :\n  - ${read.errors.join('\n  - ')}\n` +
          '  Corrigez les variables ADMIN_* puis redéployez.',
      );
      return 'invalid';
    }

    try {
      return await this.apply(read.config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bootstrap administrateur en échec : ${message}`);
      return 'error';
    }
  }

  private async apply(config: AdminBootstrapConfig): Promise<AdminBootstrapOutcome> {
    const existing = await this.findByEmail(config.email);

    if (!existing) {
      return this.create(config);
    }

    if (!config.resetPassword) {
      const isAdmin = (existing.roles ?? []).includes(UserRole.ADMIN);
      const locked = existing.lockedUntil ? existing.lockedUntil.getTime() > Date.now() : false;
      const inactive = existing.status !== AccountStatus.ACTIVE;
      if (!isAdmin || locked || inactive) {
        this.logger.warn(
          `Le compte ${config.email} existe mais ` +
            [!isAdmin && "n'a pas le rôle admin", locked && 'est verrouillé', inactive && `a le statut « ${existing.status} »`]
              .filter(Boolean)
              .join(', ') +
            ' : définissez ADMIN_RESET_PASSWORD=true (puis redéployez) pour reprendre la main.',
        );
      } else {
        this.logger.log(`Compte administrateur ${config.email} déjà présent — aucune modification.`);
      }
      return 'unchanged';
    }

    return this.reset(existing, config);
  }

  private async create(config: AdminBootstrapConfig): Promise<AdminBootstrapOutcome> {
    const now = new Date();
    const passwordHash = await this.hash(config.password);

    try {
      const user = await this.usersRepository.save(
        this.usersRepository.create({
          email: config.email,
          passwordHash,
          firstName: config.firstName,
          lastName: config.lastName,
          phone: config.phone ?? undefined,
          roles: [UserRole.ADMIN],
          status: AccountStatus.ACTIVE,
          emailVerified: true,
          emailVerifiedAt: now,
          termsAcceptedAt: now,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: undefined,
        }),
      );
      await this.upsertProfile(user.id, config.bio);
      this.logger.log(`Compte administrateur créé : ${config.email} (rôle admin, e-mail vérifié).`);
      return 'created';
    } catch (error) {
      if ((error as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
        this.logger.log(`Compte administrateur ${config.email} créé par une autre instance.`);
        return 'unchanged';
      }
      throw error;
    }
  }

  private async reset(existing: User, config: AdminBootstrapConfig): Promise<AdminBootstrapOutcome> {
    const now = new Date();
    const roles = Array.from(new Set([...(existing.roles ?? []), UserRole.ADMIN]));

    await this.usersRepository.save({
      ...existing,
      passwordHash: await this.hash(config.password),
      passwordChangedAt: now,
      roles,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: existing.emailVerifiedAt ?? now,
      failedLoginAttempts: 0,
      lockedUntil: null as unknown as undefined,
      refreshTokenHash: null as unknown as undefined,
    });
    await this.upsertProfile(existing.id, config.bio);

    this.logger.warn(
      `ADMIN_RESET_PASSWORD=true : mot de passe de ${config.email} réappliqué depuis l'environnement, compte déverrouillé ` +
        'et sessions invalidées. Remettez ADMIN_RESET_PASSWORD=false dès que possible.',
    );
    return 'reset';
  }

  private async upsertProfile(userId: string, bio: string | null): Promise<void> {
    const profile = await this.profilesRepository.findOne({ where: { userId } });
    if (profile) {
      if (bio && profile.bio !== bio) {
        await this.profilesRepository.save({ ...profile, bio });
      }
      return;
    }
    await this.profilesRepository.save(this.profilesRepository.create({ userId, bio: bio ?? undefined }));
  }

  private findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();
  }

  private hash(password: string): Promise<string> {
    return bcrypt.hash(password, envInt(this.configService.get<string>('BCRYPT_ROUNDS'), 12));
  }
}
