import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { AccountStatus } from '../../../database/entities/role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    roles: string[];
    iat?: number;
  }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    if (user.status === AccountStatus.SUSPENDED || user.status === AccountStatus.DISABLED) {
      throw new UnauthorizedException('Votre compte est suspendu. Contactez le support.');
    }

    if (user.passwordChangedAt && payload.iat && user.passwordChangedAt.getTime() / 1000 > payload.iat + 1) {
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      status: user.status,
    };
  }
}
