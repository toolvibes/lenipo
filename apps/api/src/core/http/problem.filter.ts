import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Problem } from '@tasklore/shared';
import type { Response } from 'express';
import { ZodError } from 'zod';
import type { Logger } from '../logger.js';

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function titleFor(status: number): string {
  return STATUS_TITLES[status] ?? 'Error';
}

function fieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

export function toProblem(exception: unknown): Problem {
  if (exception instanceof ZodError) {
    return {
      type: 'urn:tasklore:problem:validation',
      title: 'Validation failed',
      status: HttpStatus.BAD_REQUEST,
      errors: fieldErrors(exception),
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : undefined;
    const type =
      typeof body === 'object' && body !== null && 'type' in body
        ? String((body as { type: unknown }).type)
        : 'about:blank';
    const queryErrors =
      typeof body === 'object' && body !== null && 'queryErrors' in body
        ? (body as Pick<Problem, 'queryErrors'>).queryErrors
        : undefined;
    return {
      type,
      title: titleFor(status),
      status,
      detail: message,
      ...(queryErrors ? { queryErrors } : {}),
    };
  }
  return { type: 'about:blank', title: titleFor(500), status: 500 };
}

/** Renders every error as application/problem+json (RFC 9457). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = toProblem(exception);
    if (problem.status >= 500) {
      this.logger.error({ err: exception }, 'Unhandled error');
    }
    response.status(problem.status).type('application/problem+json').json(problem);
  }
}
