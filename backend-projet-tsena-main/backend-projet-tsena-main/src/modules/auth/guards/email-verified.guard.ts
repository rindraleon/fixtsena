import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Authentification requise');
    }

    const freshUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!freshUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    if (freshUser.roles?.includes('admin' as any)) {
      return true;
    }

    if (!freshUser.emailVerified) {
      throw new ForbiddenException(
        'Votre adresse e-mail doit être vérifiée pour accéder à cette fonctionnalité. Consultez votre boîte de réception.'
      );
    }

    if (freshUser.status !== 'active') {
      throw new ForbiddenException('Votre compte n\'est pas actif. Contactez le support.');
    }

    return true;
  }
}
