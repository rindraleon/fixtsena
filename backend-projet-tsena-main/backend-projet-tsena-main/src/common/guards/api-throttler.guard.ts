import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return (first?.trim() || req.ip || req.socket?.remoteAddress || 'unknown') as string;
  }

  protected async throwThrottlingException(_context: ExecutionContext): Promise<void> {
    throw new ThrottlerException(
      'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.',
    );
  }
}
