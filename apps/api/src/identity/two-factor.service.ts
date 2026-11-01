import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PRODUCT_NAME, type TwoFactorSetup, type TwoFactorStatus } from '@toolvibes/shared';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, recoveryCodes, users } from '../db/schema/index.js';
import { setupCode, sha256 } from './secrets.js';
import { SecuritySettingsService } from './security-settings.service.js';
import { newTotpSecret, otpauthUri, verifyTotp } from './totp.js';

const RECOVERY_CODES = 10;
const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Two-factor sign-in with TOTP and recovery codes (TL-18, P-USR-02, E-100). It applies to the
 * password sign-in; OIDC leaves it to the identity provider and access tokens are unaffected.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SecuritySettingsService) private readonly settings: SecuritySettingsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Whether a group of the person demands two-factor sign-in. */
  async required(userId: string): Promise<boolean> {
    const { twoFactorGroupIds } = await this.settings.get();
    if (twoFactorGroupIds.length === 0) return false;
    const [row] = await this.database.db
      .select({ n: count() })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.userId, userId), inArray(groupMembers.groupId, twoFactorGroupIds)),
      );
    return (row?.n ?? 0) > 0;
  }

  async status(userId: string, stage = 'full'): Promise<TwoFactorStatus> {
    const [user] = await this.database.db
      .select({ enabledAt: users.totpEnabledAt })
      .from(users)
      .where(eq(users.id, userId));
    const [left] = await this.database.db
      .select({ n: count() })
      .from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
    return {
      enabled: !!user?.enabledAt,
      required: await this.required(userId),
      pending: stage === 'second-factor' ? 'verify' : stage === 'setup-2fa' ? 'setup' : null,
      recoveryCodesLeft: left?.n ?? 0,
    };
  }

  /** A new secret to scan; it takes effect only once a first code confirms it. */
  async setup(userId: string): Promise<TwoFactorSetup> {
    const [user] = await this.database.db
      .select({ email: users.email, enabledAt: users.totpEnabledAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException();
    if (user.enabledAt) throw new ConflictException('Two-factor sign-in is already on');
    const secret = newTotpSecret();
    await this.database.db
      .update(users)
      .set({ totpPendingSecret: secret })
      .where(eq(users.id, userId));
    return { secret, uri: otpauthUri(secret, user.email, PRODUCT_NAME) };
  }

  /** Confirms the new secret with a code and returns fresh recovery codes, shown once. */
  async enable(userId: string, code: string): Promise<string[]> {
    const [user] = await this.database.db
      .select({ pending: users.totpPendingSecret })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.pending) throw new BadRequestException('Set up two-factor sign-in first');
    const step = verifyTotp(user.pending, code, null);
    if (step === null) throw new BadRequestException('The code does not match');
    await this.database.db
      .update(users)
      .set({
        totpSecret: user.pending,
        totpPendingSecret: null,
        totpEnabledAt: new Date(),
        totpLastStep: step,
      })
      .where(eq(users.id, userId));
    await this.audit.record({ action: 'auth.2fa_enabled', actorId: userId, via: 'session' });
    return this.newRecoveryCodes(userId);
  }

  /** Turns it off with a valid code; not while a group demands it. */
  async disable(userId: string, code: string): Promise<void> {
    if (await this.required(userId)) {
      throw new ConflictException('A group you belong to requires two-factor sign-in');
    }
    if (!(await this.verify(userId, code)))
      throw new BadRequestException('The code does not match');
    await this.reset(userId);
    await this.audit.record({ action: 'auth.2fa_disabled', actorId: userId, via: 'session' });
  }

  /** Replaces all recovery codes; needs a valid code. */
  async regenerate(userId: string, code: string): Promise<string[]> {
    if (!(await this.verify(userId, code)))
      throw new BadRequestException('The code does not match');
    return this.newRecoveryCodes(userId);
  }

  /** Checks an app code (once per time step) or an unused recovery code. */
  async verify(userId: string, code: string): Promise<boolean> {
    const db = this.database.db;
    const [user] = await db
      .select({ secret: users.totpSecret, lastStep: users.totpLastStep })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.secret) return false;
    const step = verifyTotp(user.secret, code, user.lastStep);
    if (step !== null) {
      await db.update(users).set({ totpLastStep: step }).where(eq(users.id, userId));
      return true;
    }
    const used = await db
      .update(recoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(recoveryCodes.userId, userId),
          eq(recoveryCodes.codeHash, sha256(normalize(code))),
          isNull(recoveryCodes.usedAt),
        ),
      )
      .returning({ id: recoveryCodes.id });
    if (used.length > 0) {
      await this.audit.record({
        action: 'auth.recovery_code_used',
        actorId: userId,
        via: 'session',
      });
      return true;
    }
    return false;
  }

  /** Removes two-factor sign-in, e.g. by an administrator after a lost phone. */
  async reset(userId: string): Promise<void> {
    await this.database.db
      .update(users)
      .set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null })
      .where(eq(users.id, userId));
    await this.database.db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  }

  private async newRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODES }, () => setupCode().slice(0, 9));
    await this.database.db.transaction(async (tx) => {
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
      await tx
        .insert(recoveryCodes)
        .values(codes.map((code) => ({ id: uuidv7(), userId, codeHash: sha256(normalize(code)) })));
    });
    return codes;
  }
}
