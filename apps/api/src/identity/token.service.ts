import { Inject, Injectable } from '@nestjs/common';
import type { CreatedToken, CreateTokenRequest, TokenInfo, TokenScope } from '@toolvibes/shared';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { personalAccessTokens, users } from '../db/schema/index.js';
import { hasPrefix, randomSecret, sha256, TOKEN_PREFIX } from './secrets.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthenticatedToken {
  tokenId: string;
  userId: string;
  /** The owner's address, which Basic credentials name besides the token (TL-48). */
  email: string;
  scopes: TokenScope[];
}

function toInfo(row: typeof personalAccessTokens.$inferSelect): TokenInfo {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes as TokenScope[],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

/** Personal access tokens (`lp_pat_…`) for the API, CLI and MCP clients. */
@Injectable()
export class TokenService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async create(userId: string, request: CreateTokenRequest): Promise<CreatedToken> {
    const secret = `${TOKEN_PREFIX}${randomSecret()}`;
    const [row] = await this.database.db
      .insert(personalAccessTokens)
      .values({
        id: uuidv7(),
        userId,
        name: request.name,
        prefix: secret.slice(0, TOKEN_PREFIX.length + 4),
        tokenHash: sha256(secret),
        scopes: [...new Set(request.scopes)],
        expiresAt: new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000),
      })
      .returning();
    if (!row) throw new Error('Token insert returned no row');
    return { ...toInfo(row), secret };
  }

  async authenticate(secret: string): Promise<AuthenticatedToken | null> {
    if (!hasPrefix(secret, TOKEN_PREFIX)) return null;
    const now = new Date();
    const [row] = await this.database.db
      .select({
        tokenId: personalAccessTokens.id,
        userId: personalAccessTokens.userId,
        email: users.email,
        scopes: personalAccessTokens.scopes,
        lastUsedAt: personalAccessTokens.lastUsedAt,
      })
      .from(personalAccessTokens)
      .innerJoin(users, eq(users.id, personalAccessTokens.userId))
      .where(
        and(
          eq(personalAccessTokens.tokenHash, sha256(secret)),
          isNull(personalAccessTokens.revokedAt),
          gt(personalAccessTokens.expiresAt, now),
          eq(users.status, 'active'),
        ),
      );
    if (!row) return null;
    if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.database.db
        .update(personalAccessTokens)
        .set({ lastUsedAt: now })
        .where(eq(personalAccessTokens.id, row.tokenId));
    }
    return {
      tokenId: row.tokenId,
      userId: row.userId,
      email: row.email,
      scopes: row.scopes as TokenScope[],
    };
  }

  async list(userId: string): Promise<TokenInfo[]> {
    const rows = await this.database.db
      .select()
      .from(personalAccessTokens)
      .where(and(eq(personalAccessTokens.userId, userId), isNull(personalAccessTokens.revokedAt)))
      .orderBy(desc(personalAccessTokens.createdAt));
    return rows.map(toInfo);
  }

  async revoke(userId: string, tokenId: string): Promise<boolean> {
    const result = await this.database.db
      .update(personalAccessTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(personalAccessTokens.id, tokenId),
          eq(personalAccessTokens.userId, userId),
          isNull(personalAccessTokens.revokedAt),
        ),
      )
      .returning({ id: personalAccessTokens.id });
    return result.length > 0;
  }
}
