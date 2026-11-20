import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, AccountStatus, UserRole } from '../../database/entities';
import { paginationMeta, envInt } from '../../common';
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from './dto/user.dto';

export { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  roles: UserRole[];
  status: AccountStatus;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  reputationScore: number;
  reviewCount: number;
  sellerRequestedAt?: Date | null;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    roles: user.roles,
    status: user.status,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ?? undefined,
    reputationScore: Number(user.reputationScore ?? 0),
    reviewCount: Number(user.reviewCount ?? 0),
    sellerRequestedAt: user.sellerRequestedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const rounds = envInt(process.env.BCRYPT_ROUNDS, 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = this.usersRepository.create({
      email,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone?.trim(),
      roles: dto.roles && dto.roles.length > 0 ? dto.roles : [UserRole.CLIENT],
      status: dto.status || AccountStatus.ACTIVE,
      emailVerified: true,
      failedLoginAttempts: 0,
    });

    const saved = await this.usersRepository.save(user);
    this.logger.log(`Utilisateur créé : ${saved.email}`);
    return toSafeUser(saved);
  }

  async findAll(filters: FilterUsersDto): Promise<{ data: SafeUser[]; meta: ReturnType<typeof paginationMeta> }> {
    const { page, limit, search, role, status, sellerRequested } = filters;
    const skip = (page - 1) * limit;

    const qb = this.usersRepository.createQueryBuilder('user');

    if (search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (role) {
      qb.andWhere("(',' || user.roles || ',') LIKE :role", { role: `%,${role},%` });
    }
    if (status) {
      qb.andWhere('user.status = :status', { status });
    }
    if (sellerRequested === true) {
      qb.andWhere('user.sellerRequestedAt IS NOT NULL');
      qb.andWhere("(',' || user.roles || ',') NOT LIKE :sellerRole", { sellerRole: `%,${UserRole.SELLER},%` });
    }

    const [users, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map(toSafeUser),
      meta: paginationMeta(page, limit, total),
    };
  }

  async requestSellerAccount(userId: string): Promise<SafeUser> {
    const user = await this.findEntityById(userId);
    if (user.roles.includes(UserRole.SELLER)) {
      throw new ConflictException('Vous êtes déjà vendeur.');
    }
    if (user.sellerRequestedAt) {
      throw new ConflictException('Votre demande est déjà en cours de traitement.');
    }
    user.sellerRequestedAt = new Date();
    const saved = await this.usersRepository.save(user);
    this.logger.log(`Demande vendeur enregistrée : ${saved.email}`);
    return toSafeUser(saved);
  }

  async findById(id: string): Promise<SafeUser> {
    return toSafeUser(await this.findEntityById(id));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string): Promise<SafeUser> {
    const user = await this.findEntityById(id);

    if (dto.roles && !this.isValidRoles(dto.roles)) {
      throw new BadRequestException('Rôles invalides');
    }

    if (actorId && actorId === id) {
      if (dto.roles && !dto.roles.includes(UserRole.ADMIN)) {
        throw new ForbiddenException('Vous ne pouvez pas retirer votre propre rôle administrateur');
      }
      if (dto.status && dto.status !== AccountStatus.ACTIVE) {
        throw new ForbiddenException('Vous ne pouvez pas suspendre votre propre compte');
      }
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone.trim();
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.roles !== undefined) user.roles = dto.roles;
    if (dto.status !== undefined) user.status = dto.status;

    const updated = await this.usersRepository.save(user);
    this.logger.log(`Utilisateur modifié : ${updated.email}`);
    return toSafeUser(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    if (actorId && actorId === id) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte');
    }
    const user = await this.findEntityById(id);
    await this.usersRepository.softRemove(user);
    this.logger.log(`Utilisateur supprimé (soft) : ${user.email}`);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isValid = currentPassword
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;
    if (!isValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    const rounds = envInt(process.env.BCRYPT_ROUNDS, 12);
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.usersRepository.save(user);

    this.logger.log(`Mot de passe modifié : userId=${userId}`);
  }

  private async findEntityById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private isValidRoles(roles: UserRole[]): boolean {
    const validRoles = Object.values(UserRole);
    return roles.every((r) => validRoles.includes(r));
  }
}
