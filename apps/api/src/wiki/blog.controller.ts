import { randomBytes } from 'node:crypto';
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  Blog,
  BlogQuery,
  FeedToken,
  Page,
  SetPageStatusRequest,
  Space,
  WikiSettings,
} from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { systemSettings, users } from '../db/schema/index.js';
import { PageService } from './page.service.js';
import { SpaceService } from './space.service.js';

const PageId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const WIKI = 'wiki';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Blog, page status, personal spaces and feeds (TL-29, E-110). */
@Controller()
export class BlogController {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
  ) {}

  @Endpoint({ tag: 'Pages', summary: 'Set the status and owner of a page', response: Page })
  @Put('pages/:id/status')
  setStatus(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(SetPageStatusRequest) body: SetPageStatusRequest,
  ): Promise<Page> {
    return this.pages.setStatus(principal, id, body);
  }

  @Endpoint({ tag: 'Spaces', summary: 'The blog of a space, newest first', response: Blog })
  @Get('spaces/:key/blog')
  blog(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidQuery(BlogQuery) query: BlogQuery,
  ): Promise<Blog> {
    return this.pages.blog(principal, key.toUpperCase(), query);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'The caller’s personal space, created on first use (private)',
    response: Space,
  })
  @Post('me/space')
  @HttpCode(200)
  personal(@CurrentPrincipal() principal: Principal): Promise<Space> {
    return this.spaces.personal(principal);
  }

  @Endpoint({ tag: 'Me', summary: 'The secret for reading feeds', response: FeedToken })
  @Get('me/feed-token')
  async feedToken(@CurrentPrincipal() principal: Principal): Promise<FeedToken> {
    const [user] = await this.database.db
      .select({ token: users.feedToken })
      .from(users)
      .where(eq(users.id, principal.userId));
    if (user?.token) return { token: user.token };
    return this.rotate(principal);
  }

  @Endpoint({ tag: 'Me', summary: 'Replace the feed secret', response: FeedToken })
  @Post('me/feed-token')
  @HttpCode(200)
  async rotate(@CurrentPrincipal() principal: Principal): Promise<FeedToken> {
    const token = randomBytes(24).toString('base64url');
    await this.database.db
      .update(users)
      .set({ feedToken: token })
      .where(eq(users.id, principal.userId));
    return { token };
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Atom feed of a space’s blog, read with a personal feed token',
    binary: true,
  })
  @Public()
  @Get('feeds/spaces/:key/blog.atom')
  @Header('Content-Type', 'application/atom+xml; charset=utf-8')
  async feed(
    @Param('key') key: string,
    @Query('token') token: string | undefined,
  ): Promise<string> {
    if (!token) throw new NotFoundException();
    const [user] = await this.database.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.feedToken, token));
    if (user?.status !== 'active') throw new NotFoundException();
    // The feed shows what its owner may see.
    const principal: Principal = { userId: user.id, via: 'session', sessionId: 'feed' };
    const blog = await this.pages.blog(principal, key.toUpperCase(), { limit: 30 });
    const base = (this.config.PUBLIC_URL ?? '').replace(/\/$/, '');
    const space = key.toUpperCase();
    const updated = blog.posts[0]?.publishedAt ?? new Date().toISOString();
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<feed xmlns="http://www.w3.org/2005/Atom">',
      `<title>${escapeXml(space)} – Blog</title>`,
      `<id>urn:tasklore:blog:${escapeXml(space)}</id>`,
      `<link href="${escapeXml(`${base}/spaces/${space}/blog`)}"/>`,
      `<updated>${updated}</updated>`,
      ...blog.posts.map((post) =>
        [
          '<entry>',
          `<title>${escapeXml(post.title)}</title>`,
          `<id>urn:tasklore:page:${post.id}</id>`,
          `<link href="${escapeXml(`${base}/spaces/${space}/pages/${post.id}`)}"/>`,
          `<updated>${post.publishedAt}</updated>`,
          post.author ? `<author><name>${escapeXml(post.author.displayName)}</name></author>` : '',
          `<summary>${escapeXml(post.excerpt)}</summary>`,
          '</entry>',
        ].join(''),
      ),
      '</feed>',
    ].join('\n');
  }

  @Endpoint({ tag: 'Admin', summary: 'Wiki settings', response: WikiSettings })
  @Get('admin/wiki-settings')
  async settings(@CurrentPrincipal() principal: Principal): Promise<WikiSettings> {
    if (!(await this.access.hasGlobal(principal.userId, 'admin'))) throw new ForbiddenException();
    return wikiSettings(this.database);
  }

  @Endpoint({ tag: 'Admin', summary: 'Change the wiki settings', response: WikiSettings })
  @Put('admin/wiki-settings')
  async setSettings(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(WikiSettings) body: WikiSettings,
  ): Promise<WikiSettings> {
    if (!(await this.access.hasGlobal(principal.userId, 'admin'))) throw new ForbiddenException();
    await this.database.db
      .insert(systemSettings)
      .values({ key: WIKI, value: body })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: body, updatedAt: new Date() },
      });
    return body;
  }
}

export async function wikiSettings(database: DatabaseHandle): Promise<WikiSettings> {
  const [row] = await database.db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, WIKI));
  return { outdatedAfterDays: null, ...((row?.value as Partial<WikiSettings>) ?? {}) };
}
