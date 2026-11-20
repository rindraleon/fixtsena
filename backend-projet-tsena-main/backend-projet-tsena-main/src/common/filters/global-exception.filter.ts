import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { errorResponse, ValidationError } from '../utils/api-response.util';

interface NormalizedError {
  status: number;
  message: string;
  errors?: ValidationError[];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errors } = this.normalize(exception);

    const logLine = `[${request.method}] ${request.url} — ${status}: ${message}`;
    if (status >= 500) {
      this.logger.error(logLine, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logLine);
    }

    response.status(status).json(errorResponse(message, errors));
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as string | Record<string, unknown>;
      return {
        status,
        message: this.extractMessage(body, status),
        errors: this.extractErrors(body),
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverError = (exception as QueryFailedError & { driverError?: { code?: string } })
        .driverError;
      if (driverError?.code === '42P01') {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Base de données non initialisée : le schéma est absent. Contactez l’administrateur de la plateforme.',
        };
      }
      if (driverError?.code === '23505') {
        return { status: HttpStatus.CONFLICT, message: 'Cette ressource existe déjà.' };
      }
      if (driverError?.code === '23503') {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Opération impossible : la ressource est référencée par d’autres données.',
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erreur interne du serveur',
    };
  }

  private extractMessage(body: string | Record<string, unknown>, status: number): string {
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string') return body.message;
      if (Array.isArray(body.message)) return body.message.join(', ');
    }
    return status >= 500 ? 'Erreur interne du serveur' : 'Requête invalide';
  }

  private extractErrors(body: string | Record<string, unknown>): ValidationError[] | undefined {
    if (!body || typeof body !== 'object' || !Array.isArray(body.errors)) return undefined;
    const errors = body.errors.filter(
      (e): e is ValidationError =>
        !!e && typeof e === 'object' && typeof (e as ValidationError).field === 'string',
    );
    return errors.length > 0 ? errors : undefined;
  }
}
