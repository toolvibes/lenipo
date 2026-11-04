import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import {
  AdminToken,
  Announcement,
  FeatureFlags,
  InstanceNotice,
  LegalLinks,
  MaintenanceMode,
  MODULES,
  ProviderLimits,
  ProviderUsage,
  RateLimitSettings,
  TokenLimits,
} from '@toolvibes/shared';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { personalAccessTokens, users } from '../db/schema/index.js';
import { OperationsService } from './operations.service.js';
import { ProviderService, planLimit } from './provider.service.js';

/** What every page shows: modules, maintenance and the banner (TL-40, E-121). */
@Public()
@Controller('instance')
export class InstanceController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Endpoint({
    tag: 'Instance',
    summary: 'Modules, maintenance mode and the current announcement',
    response: InstanceNotice,
  })
  @Get('notice')
  notice(): Promise<InstanceNotice> {
    return this.operations.notice();
  }
}

/** Switches for administrators (TL-40, E-121). */
@RequireGlobal('admin')
@Controller('admin')
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProviderService) private readonly provider: ProviderService,
  ) {}

  private record(principal: Principal, action: string, details: unknown) {
    return this.audit.record({
      action,
      actorId: principal.userId,
      via: principal.via,
      details: details as Record<string, unknown>,
    });
  }

  @Endpoint({ tag: 'Operations', summary: 'Modules that are on', response: FeatureFlags })
  @Get('feature-flags')
  async featureFlags(): Promise<FeatureFlags> {
    return (await this.operations.snapshot()).modules;
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Switch modules on or off',
    description:
      'A module that is off disappears from the web app, MCP and the API; its data stays.',
    response: FeatureFlags,
  })
  @Put('feature-flags')
  async setFeatureFlags(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(FeatureFlags) body: FeatureFlags,
  ): Promise<FeatureFlags> {
    // A module the provider's plan leaves out stays off (TL-103).
    for (const name of MODULES) {
      if (body[name] && !(await this.operations.snapshot()).modules[name]) {
        await this.provider.requireModule(name);
      }
    }
    await this.record(principal, 'system.modules_changed', body);
    return this.operations.setModules(body);
  }

  @Endpoint({ tag: 'Operations', summary: 'Request limits', response: RateLimitSettings })
  @Get('rate-limits')
  async rateLimits(): Promise<RateLimitSettings> {
    return (await this.operations.snapshot()).rateLimits;
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Change the request limits',
    response: RateLimitSettings,
  })
  @Put('rate-limits')
  async setRateLimits(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(RateLimitSettings) body: RateLimitSettings,
  ): Promise<RateLimitSettings> {
    const ceilings = (await this.provider.limits())?.requestsPerMinute;
    for (const key of ['people', 'tokens', 'anonymous'] as const) {
      if (ceilings && body[key] > ceilings[key]) {
        throw planLimit(`The plan allows at most ${ceilings[key]} requests per minute here`);
      }
    }
    await this.record(principal, 'system.rate_limits_changed', body);
    return this.operations.setRateLimits(body);
  }

  @Endpoint({ tag: 'Operations', summary: 'Maintenance mode', response: MaintenanceMode })
  @Get('maintenance-mode')
  async maintenance(): Promise<MaintenanceMode> {
    return (await this.operations.snapshot()).maintenance;
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Switch maintenance mode',
    description:
      'While on, only administrators can sign in and use Lenipo; others see the message.',
    response: MaintenanceMode,
  })
  @Put('maintenance-mode')
  async setMaintenance(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(MaintenanceMode) body: MaintenanceMode,
  ): Promise<MaintenanceMode> {
    await this.record(principal, 'system.maintenance_changed', { enabled: body.enabled });
    return this.operations.setMaintenance(body);
  }

  @Endpoint({ tag: 'Operations', summary: 'Announcement banner', response: Announcement })
  @Get('announcement')
  async announcement(): Promise<Announcement> {
    const { version: _, ...announcement } = (await this.operations.snapshot()).announcement;
    return announcement;
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Set the announcement banner',
    description: 'Empty text removes it.',
    response: Announcement,
  })
  @Put('announcement')
  async setAnnouncement(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(Announcement) body: Announcement,
  ): Promise<Announcement> {
    await this.record(principal, 'system.announcement_changed', { level: body.level });
    return this.operations.setAnnouncement(body);
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Links to imprint and privacy policy',
    description:
      'The links in force, shown on the sign-in page, in the service portal and in the help menu; without own ones the defaults IMPRINT_URL and PRIVACY_URL apply.',
    response: LegalLinks,
  })
  @Get('legal-links')
  legal(): Promise<LegalLinks> {
    return this.operations.legal();
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Set the links to imprint and privacy policy',
    description: 'null removes an own link; the default from the environment applies again.',
    response: LegalLinks,
  })
  @Put('legal-links')
  async setLegal(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(LegalLinks) body: LegalLinks,
  ): Promise<LegalLinks> {
    await this.record(principal, 'system.legal_links_changed', body);
    return this.operations.setLegal(body);
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'All active API tokens with their limits',
    response: z.array(AdminToken),
  })
  @Get('tokens')
  async tokens(): Promise<AdminToken[]> {
    const rows = await this.database.db
      .select({ token: personalAccessTokens, owner: users })
      .from(personalAccessTokens)
      .innerJoin(users, eq(users.id, personalAccessTokens.userId))
      .where(isNull(personalAccessTokens.revokedAt))
      .orderBy(asc(users.displayName), asc(personalAccessTokens.name));
    const today = new Date().toISOString().slice(0, 10);
    return rows
      .filter(({ token }) => token.expiresAt > new Date())
      .map(({ token, owner }) => ({
        id: token.id,
        name: token.name,
        prefix: token.prefix,
        owner: { id: owner.id, displayName: owner.displayName, email: owner.email },
        scopes: token.scopes,
        expiresAt: token.expiresAt.toISOString(),
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        limits: { perMinute: token.rateLimitPerMinute, perDay: token.dailyQuota },
        usedToday: token.quotaDay === today ? token.quotaUsed : 0,
      }));
  }

  @Endpoint({ tag: 'Operations', summary: 'Set the limits of one token', response: TokenLimits })
  @Put('tokens/:id/limits')
  async setTokenLimits(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(TokenLimits) body: TokenLimits,
  ): Promise<TokenLimits> {
    const ceiling = (await this.provider.limits())?.requestsPerMinute?.tokens;
    if (ceiling !== undefined && body.perMinute !== null && body.perMinute > ceiling) {
      throw planLimit(`The plan allows at most ${ceiling} requests per minute for a token`);
    }
    const [row] = await this.database.db
      .update(personalAccessTokens)
      .set({ rateLimitPerMinute: body.perMinute, dailyQuota: body.perDay, quotaUsed: sql`0` })
      .where(eq(personalAccessTokens.id, id))
      .returning({ id: personalAccessTokens.id });
    if (!row) throw new NotFoundException('Token not found');
    this.operations.invalidate();
    await this.audit.record({
      action: 'token.limits_changed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'token',
      targetId: id,
      details: body,
    });
    return body;
  }
}

/** The frame a provider such as Lenipo Cloud sets (TL-103, E-154), with the SETUP_TOKEN. */
@Public()
@Controller('provider')
export class ProviderController {
  constructor(@Inject(ProviderService) private readonly provider: ProviderService) {}

  private authorize(request: Request) {
    const [scheme, token] = (request.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || !this.provider.acceptsToken(token)) {
      throw new ForbiddenException('Needs the SETUP_TOKEN of the instance');
    }
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'Set the limits of the plan',
    description:
      'For providers, with `Authorization: Bearer <SETUP_TOKEN>`: seats (active people who are not external guests), agents, storage, modules and service desks. Takes effect at once; modules the plan leaves out are switched off. Without limits nothing is limited.',
    response: ProviderUsage,
  })
  @Put('limits')
  async setLimits(
    @ValidBody(ProviderLimits) body: ProviderLimits,
    @Req() request: Request,
  ): Promise<ProviderUsage> {
    this.authorize(request);
    await this.provider.setLimits(body);
    return this.provider.usage();
  }

  @Endpoint({ tag: 'Operations', summary: 'Remove the limits of the plan' })
  @Delete('limits')
  @HttpCode(204)
  async removeLimits(@Req() request: Request): Promise<void> {
    this.authorize(request);
    await this.provider.setLimits(null);
  }

  @Endpoint({
    tag: 'Operations',
    summary: 'What the instance uses',
    description: 'Seats taken, agents, storage, service desks and modules, for billing.',
    response: ProviderUsage,
  })
  @Get('usage')
  async usage(@Req() request: Request): Promise<ProviderUsage> {
    this.authorize(request);
    return this.provider.usage();
  }
}

/** The plan and its use, for administrators (TL-103). */
@RequireGlobal('admin')
@Controller('admin')
export class PlanController {
  constructor(@Inject(ProviderService) private readonly provider: ProviderService) {}

  @Endpoint({
    tag: 'Operations',
    summary: 'The plan of the instance and what it uses',
    description: '`limits` is null without a provider: then nothing is limited.',
    response: ProviderUsage,
  })
  @Get('plan')
  plan(): Promise<ProviderUsage> {
    return this.provider.usage();
  }
}
