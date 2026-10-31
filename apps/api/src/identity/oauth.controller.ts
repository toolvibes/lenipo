import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  SetMetadata,
} from '@nestjs/common';
import {
  OAuthApp,
  OAuthAppCreated,
  OAuthAuthorizeQuery,
  OAuthClientInfo,
  OAuthConsentRequest,
  OAuthConsentResult,
  OAuthGrant,
  OAuthSettings,
  SaveOAuthAppRequest,
} from '@tasklore/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { OAUTH_SCOPES, OAuthError, OAuthService } from './oauth.service.js';

/** OAuth endpoints are called by other programs without cookies; cross-site posts are fine. */
export const ALLOW_CROSS_SITE = 'tasklore:allow-cross-site';
export const AllowCrossSite = () => SetMetadata(ALLOW_CROSS_SITE, true);

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Where the instance is reached, for metadata and redirects. */
export function issuerOf(config: AppConfig, request: Request): string {
  return (config.PUBLIC_URL ?? `${request.protocol}://${request.get('host')}`).replace(/\/+$/, '');
}

/** The authorization server for MCP clients (TL-69, E-115); its protocol endpoints use OAuth's own error format. */
@Controller()
export class OAuthController {
  constructor(
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- discovery (outside /api/v1)

  /** RFC 9728: which authorization server protects /mcp. */
  @Public()
  @Get(['.well-known/oauth-protected-resource', '.well-known/oauth-protected-resource/mcp'])
  resource(@Req() request: Request) {
    const issuer = issuerOf(this.config, request);
    return {
      resource: `${issuer}/mcp`,
      authorization_servers: [issuer],
      scopes_supported: OAUTH_SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'Tasklore',
    };
  }

  /** RFC 8414 metadata. */
  @Public()
  @Get('.well-known/oauth-authorization-server')
  server(@Req() request: Request) {
    const issuer = issuerOf(this.config, request);
    return {
      issuer,
      // A page of the web app: sign-in and consent happen there.
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/v1/oauth/token`,
      registration_endpoint: `${issuer}/api/v1/oauth/register`,
      revocation_endpoint: `${issuer}/api/v1/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: OAUTH_SCOPES,
      authorization_response_iss_parameter_supported: true,
    };
  }

  // ---------------------------------------------------------------- protocol

  private async answer(response: Response, work: () => Promise<unknown>, status = 200) {
    response.set('Cache-Control', 'no-store');
    try {
      response.status(status).json(await work());
    } catch (error) {
      if (!(error instanceof OAuthError)) throw error;
      response
        .status(error.status)
        .json({ error: error.error, error_description: error.description });
    }
  }

  /** RFC 7591 dynamic registration of public clients. */
  @Public()
  @AllowCrossSite()
  @Post('oauth/register')
  async register(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.answer(response, () => this.oauth.register(request.body ?? {}), 201);
  }

  @Public()
  @AllowCrossSite()
  @Post('oauth/token')
  async token(@Req() request: Request, @Res() response: Response): Promise<void> {
    // client_secret_basic: "Basic base64(id:secret)", both parts form-encoded (RFC 6749 2.3.1).
    const basic = /^Basic\s+(.+)$/i.exec(request.get('authorization') ?? '')?.[1];
    let credentials: { id?: string; secret?: string } = {};
    if (basic) {
      const [id = '', secret = ''] = Buffer.from(basic, 'base64').toString('utf8').split(':');
      credentials = { id: decodeURIComponent(id), secret: decodeURIComponent(secret) };
    }
    await this.answer(response, () => this.oauth.token(request.body ?? {}, credentials));
  }

  @Public()
  @AllowCrossSite()
  @Post('oauth/revoke')
  async revoke(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.answer(response, async () => {
      await this.oauth.revoke(String(request.body?.token ?? ''));
      return {};
    });
  }

  // ---------------------------------------------------------------- consent (web app)

  @Endpoint({
    tag: 'OAuth',
    summary: 'Describe a client asking for access',
    description: 'For the consent page; unknown clients and unregistered redirect URIs answer 404.',
    response: OAuthClientInfo,
  })
  @Get('oauth/client')
  client(@ValidQuery(OAuthAuthorizeQuery) query: OAuthAuthorizeQuery): Promise<OAuthClientInfo> {
    return this.oauth.describe(query.client_id, query.redirect_uri, query.scope);
  }

  @Endpoint({
    tag: 'OAuth',
    summary: 'Allow or deny a client',
    description:
      'Signed in with a browser session only. Returns where the browser goes next: the client’s redirect URI with a single-use code, or with error=access_denied.',
    response: OAuthConsentResult,
  })
  @Post('oauth/consent')
  @HttpCode(200)
  async consent(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(OAuthConsentRequest) body: OAuthConsentRequest,
    @Req() request: Request,
  ): Promise<OAuthConsentResult> {
    if (principal.via !== 'session') {
      throw new ForbiddenException('Only people in a browser can allow access');
    }
    return {
      redirect: await this.oauth.consent(principal.userId, body, issuerOf(this.config, request)),
    };
  }

  // ---------------------------------------------------------------- management

  @Endpoint({ tag: 'OAuth', summary: 'List your connected apps', response: z.array(OAuthGrant) })
  @Get('me/oauth-grants')
  mine(@CurrentPrincipal() principal: Principal): Promise<OAuthGrant[]> {
    return this.oauth.grants(principal.userId);
  }

  @Endpoint({ tag: 'OAuth', summary: 'Disconnect one of your apps' })
  @Delete('me/oauth-grants/:id')
  @HttpCode(204)
  endMine(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.oauth.endGrant(id, principal.userId);
  }

  @Endpoint({
    tag: 'OAuth',
    summary: 'List all connected apps (admin)',
    response: z.array(OAuthGrant),
  })
  @RequireGlobal('admin')
  @Get('admin/oauth-grants')
  all(): Promise<OAuthGrant[]> {
    return this.oauth.grants();
  }

  @Endpoint({ tag: 'OAuth', summary: 'Disconnect any app (admin)' })
  @RequireGlobal('admin')
  @Delete('admin/oauth-grants/:id')
  @HttpCode(204)
  endAny(@Param('id', Uuid) id: string): Promise<void> {
    return this.oauth.endGrant(id);
  }

  @Endpoint({
    tag: 'OAuth',
    summary: 'Apps registered by administrators',
    response: z.array(OAuthApp),
  })
  @RequireGlobal('admin')
  @Get('admin/oauth-apps')
  apps(): Promise<OAuthApp[]> {
    return this.oauth.apps();
  }

  @Endpoint({
    tag: 'OAuth',
    summary: 'Register an app for a third party',
    description:
      'Confidential apps get a client secret, shown only in this answer; public apps use PKCE alone. Both use the authorization code flow with PKCE.',
    response: OAuthAppCreated,
  })
  @RequireGlobal('admin')
  @Post('admin/oauth-apps')
  @HttpCode(201)
  async createApp(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(SaveOAuthAppRequest) body: SaveOAuthAppRequest,
  ): Promise<OAuthAppCreated> {
    const created = await this.oauth.createApp(principal.userId, body);
    await this.audit.record({
      action: 'oauth.app_created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'oauth-app',
      targetId: created.app.id,
      details: { name: body.name },
    });
    return created;
  }

  @Endpoint({ tag: 'OAuth', summary: 'Change a registered app', response: OAuthApp })
  @RequireGlobal('admin')
  @Put('admin/oauth-apps/:id')
  updateApp(
    @Param('id', Uuid) id: string,
    @ValidBody(SaveOAuthAppRequest) body: SaveOAuthAppRequest,
  ): Promise<OAuthApp> {
    return this.oauth.updateApp(id, body);
  }

  @Endpoint({
    tag: 'OAuth',
    summary: 'Issue a new client secret',
    description: 'The old secret stops working at once.',
    response: OAuthAppCreated,
  })
  @RequireGlobal('admin')
  @Post('admin/oauth-apps/:id/secret')
  @HttpCode(200)
  async rotateSecret(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<OAuthAppCreated> {
    const rotated = await this.oauth.rotateSecret(id);
    await this.audit.record({
      action: 'oauth.app_secret_rotated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'oauth-app',
      targetId: id,
    });
    return rotated;
  }

  @Endpoint({ tag: 'OAuth', summary: 'Delete a registered app and its connections' })
  @RequireGlobal('admin')
  @Delete('admin/oauth-apps/:id')
  @HttpCode(204)
  async deleteApp(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<void> {
    await this.oauth.deleteApp(id);
    await this.audit.record({
      action: 'oauth.app_deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'oauth-app',
      targetId: id,
    });
  }

  @Endpoint({ tag: 'OAuth', summary: 'OAuth settings (admin)', response: OAuthSettings })
  @RequireGlobal('admin')
  @Get('admin/oauth-settings')
  settings(): Promise<OAuthSettings> {
    return this.oauth.settings();
  }

  @Endpoint({ tag: 'OAuth', summary: 'Change the OAuth settings (admin)', response: OAuthSettings })
  @RequireGlobal('admin')
  @Put('admin/oauth-settings')
  setSettings(@ValidBody(OAuthSettings) body: OAuthSettings): Promise<OAuthSettings> {
    return this.oauth.setSettings(body);
  }
}
