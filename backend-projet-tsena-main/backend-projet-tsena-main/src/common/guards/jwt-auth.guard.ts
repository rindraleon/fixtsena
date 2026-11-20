import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.isPublic(context);

    try {
      const result = super.canActivate(context) as
        | boolean
        | Promise<boolean>
        | Observable<boolean>;
      const activated =
        result instanceof Observable ? await lastValueFrom(result) : await result;
      return isPublic ? true : activated;
    } catch (error) {
      if (isPublic) {
        context.switchToHttp().getRequest().user = null;
        return true;
      }
      throw error;
    }
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (this.isPublic(context)) {
      return (user || null) as TUser;
    }

    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException(
        'Authentification requise. Veuillez vous connecter.',
      );
    }

    return user;
  }
}
