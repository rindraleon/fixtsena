import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { successResponse } from '../utils/api-response.util';
import { sanitizePayload } from '../utils/sanitize-payload.util';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const request = context.switchToHttp().getRequest();

        if (data && typeof data === 'object' && 'success' in data) {
          const envelope = data as { data?: unknown };
          return 'data' in envelope ? { ...envelope, data: sanitizePayload(envelope.data) } : data;
        }

        const message = this.getDefaultMessage(request.method);

        return successResponse(sanitizePayload(data), message);
      }),
    );
  }

  private getDefaultMessage(method: string): string {
    const messages: Record<string, string> = {
      GET: 'Ressource récupérée avec succès',
      POST: 'Ressource créée avec succès',
      PATCH: 'Ressource modifiée avec succès',
      PUT: 'Ressource mise à jour avec succès',
      DELETE: 'Ressource supprimée avec succès',
    };
    return messages[method] || 'Opération réussie';
  }
}
