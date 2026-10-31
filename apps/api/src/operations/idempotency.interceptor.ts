import { createHash } from 'node:crypto';
import {
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  StreamableFile,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { catchError, concatMap, from, type Observable, of, switchMap } from 'rxjs';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { idempotencyKeys } from '../db/schema/index.js';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const KEY = /^[\x21-\x7e]{1,255}$/;

/**
 * `Idempotency-Key` for writes (D-API-07, TL-41, E-122): the first answer is kept for 24 hours,
 * a repeat with the same request gets it again with `Idempotent-Replayed: true`, a repeat with
 * a different request 422, one while the first still runs 409. Failed requests are not kept,
 * so they can be retried.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const key = request.get('idempotency-key');
    const principal = request.principal;
    if (!key || !WRITES.has(request.method) || !principal) return next.handle();
    if (!KEY.test(key)) {
      throw new BadRequestException('Idempotency-Key: 1 to 255 visible ASCII characters');
    }
    const caller = `${principal.userId}:${'tokenId' in principal ? principal.tokenId : principal.via}`;
    const fingerprint = createHash('sha256')
      .update(`${request.method} ${request.originalUrl}\n${JSON.stringify(request.body ?? null)}`)
      .digest('hex');
    const db = this.database.db;
    const forget = () =>
      db
        .delete(idempotencyKeys)
        .where(and(eq(idempotencyKeys.caller, caller), eq(idempotencyKeys.key, key)));

    return from(
      (async () => {
        await db
          .delete(idempotencyKeys)
          .where(lt(idempotencyKeys.createdAt, sql`now() - interval '24 hours'`));
        const [claimed] = await db
          .insert(idempotencyKeys)
          .values({ caller, key, fingerprint })
          .onConflictDoNothing()
          .returning({ key: idempotencyKeys.key });
        if (claimed) return null;
        const [stored] = await db
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.caller, caller), eq(idempotencyKeys.key, key)));
        return stored ?? null;
      })(),
    ).pipe(
      switchMap((stored) => {
        if (stored) {
          if (stored.fingerprint !== fingerprint) {
            throw new UnprocessableEntityException(
              'This Idempotency-Key was used for a different request',
            );
          }
          if (stored.state !== 'done') {
            throw new ConflictException('A request with this Idempotency-Key is still running');
          }
          response.status(stored.status ?? 200);
          response.setHeader('Idempotent-Replayed', 'true');
          return of(stored.body ?? undefined);
        }
        return next.handle().pipe(
          concatMap(async (body) => {
            // Files and streams are not kept; a repeat runs again.
            if (body instanceof StreamableFile) {
              await forget();
              return body;
            }
            // Nest sets the status after the interceptors; until then it is the route's own.
            const status =
              response.statusCode !== 200
                ? response.statusCode
                : ((Reflect.getMetadata(HTTP_CODE_METADATA, context.getHandler()) as
                    | number
                    | undefined) ?? (request.method === 'POST' ? 201 : 200));
            await db
              .update(idempotencyKeys)
              .set({ state: 'done', status, body: body ?? null })
              .where(and(eq(idempotencyKeys.caller, caller), eq(idempotencyKeys.key, key)));
            return body;
          }),
          catchError(async (error: unknown) => {
            await forget();
            throw error;
          }),
        );
      }),
    );
  }
}
