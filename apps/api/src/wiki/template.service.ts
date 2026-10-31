import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { imageAttachmentIds, isValidDoc } from '@tasklore/editor';
import type {
  PageTemplate,
  PageTemplateSummary,
  RichText,
  SavePageTemplateRequest,
} from '@tasklore/shared';
import { asc, eq, isNull, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { pageTemplates, spaces, users } from '../db/schema/index.js';
import { BLUEPRINT_KEYS, blueprint, isBlueprintKey } from './blueprints.js';
import { SpaceService } from './space.service.js';
import { inputsOf } from './template-variables.js';

const BLUEPRINT = 'blueprint:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type TemplateRow = typeof pageTemplates.$inferSelect;

/** Templates may not carry images: those belong to one page (E-61). */
function checkContent(content: RichText) {
  if (!isValidDoc(content)) throw new BadRequestException('The content is not a valid document');
  if (imageAttachmentIds(content).length > 0) {
    throw new BadRequestException('Templates cannot contain images yet');
  }
}

/**
 * Page templates (W-TPL-01, -03, E-72): shipped blueprints, global templates managed by the
 * system administration and space templates managed by the space administration. Everyone who
 * may create pages in a space can use its templates and the global ones.
 */
@Injectable()
export class TemplateService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
  ) {}

  private async locale(userId: string): Promise<string> {
    const [user] = await this.database.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, userId));
    return user?.locale ?? 'de';
  }

  private summary(row: TemplateRow, spaceKey: string | null): PageTemplateSummary {
    return {
      ref: row.id,
      kind: row.spaceId ? 'space' : 'global',
      id: row.id,
      name: row.name,
      description: row.description,
      title: row.title,
      spaceKey,
      updatedAt: row.updatedAt.toISOString(),
      inputs: inputsOf(row.title, row.content),
    };
  }

  private blueprints(locale: string): PageTemplateSummary[] {
    return BLUEPRINT_KEYS.map((key) => {
      const entry = blueprint(key, locale);
      return {
        ref: `${BLUEPRINT}${key}`,
        kind: 'blueprint' as const,
        id: null,
        name: entry.name,
        description: entry.description,
        title: entry.title,
        spaceKey: null,
        updatedAt: null,
        inputs: inputsOf(entry.title, entry.content()),
      };
    });
  }

  /** What a space offers when creating a page: blueprints, its own templates, global ones. */
  async forSpace(principal: Principal, spaceKey: string): Promise<PageTemplateSummary[]> {
    const { space } = await this.spaces.find(principal, spaceKey, 'view');
    const rows = await this.database.db
      .select()
      .from(pageTemplates)
      .where(or(eq(pageTemplates.spaceId, space.id), isNull(pageTemplates.spaceId)))
      .orderBy(asc(pageTemplates.name));
    return [
      ...this.blueprints(await this.locale(principal.userId)),
      ...rows.filter((row) => row.spaceId).map((row) => this.summary(row, space.key)),
      ...rows.filter((row) => !row.spaceId).map((row) => this.summary(row, null)),
    ];
  }

  async global(principal: Principal): Promise<PageTemplateSummary[]> {
    const rows = await this.database.db
      .select()
      .from(pageTemplates)
      .where(isNull(pageTemplates.spaceId))
      .orderBy(asc(pageTemplates.name));
    return [
      ...this.blueprints(await this.locale(principal.userId)),
      ...rows.map((row) => this.summary(row, null)),
    ];
  }

  /** A template with its content; space templates only for people who see the space. */
  async get(principal: Principal, ref: string): Promise<PageTemplate> {
    if (ref.startsWith(BLUEPRINT)) {
      const key = ref.slice(BLUEPRINT.length);
      if (!isBlueprintKey(key)) throw new NotFoundException('Template not found');
      const locale = await this.locale(principal.userId);
      const summary = this.blueprints(locale).find((entry) => entry.ref === ref);
      if (!summary) throw new NotFoundException('Template not found');
      return { ...summary, content: blueprint(key, locale).content(), canEdit: false };
    }
    const { row, spaceKey } = await this.row(principal, ref);
    return {
      ...this.summary(row, spaceKey),
      content: row.content as RichText,
      canEdit: await this.canManage(principal, row.spaceId),
    };
  }

  /** Title and content a new page in `spaceId` starts from. */
  async resolve(
    principal: Principal,
    spaceId: string,
    ref: string,
  ): Promise<{ title: string; content: RichText; blueprint: string | null; index: string | null }> {
    const template = await this.get(principal, ref);
    if (template.kind === 'space') {
      const [row] = await this.database.db
        .select({ spaceId: pageTemplates.spaceId })
        .from(pageTemplates)
        .where(eq(pageTemplates.id, ref));
      if (row?.spaceId !== spaceId)
        throw new BadRequestException('The template belongs to another space');
    }
    const key = ref.startsWith(BLUEPRINT) ? ref.slice(BLUEPRINT.length) : null;
    return {
      title: template.title,
      content: template.content,
      blueprint: key,
      index:
        key && isBlueprintKey(key)
          ? blueprint(key, await this.locale(principal.userId)).index
          : null,
    };
  }

  async create(
    principal: Principal,
    spaceKey: string | null,
    request: SavePageTemplateRequest,
  ): Promise<PageTemplate> {
    checkContent(request.content);
    let spaceId: string | null = null;
    if (spaceKey) {
      const { space } = await this.spaces.find(principal, spaceKey, 'administer');
      spaceId = space.id;
    } else if (!(await this.access.hasGlobal(principal.userId, 'admin'))) {
      throw new ForbiddenException('Global templates need the global permission "admin"');
    }
    const id = uuidv7();
    await this.database.db.insert(pageTemplates).values({
      id,
      spaceId,
      ...request,
      createdById: principal.userId,
      updatedById: principal.userId,
    });
    await this.audit.record({
      action: 'template.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'page_template',
      targetId: id,
      details: { name: request.name, space: spaceKey },
    });
    return this.get(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    request: SavePageTemplateRequest,
  ): Promise<PageTemplate> {
    checkContent(request.content);
    const { row } = await this.row(principal, id);
    if (!(await this.canManage(principal, row.spaceId))) {
      throw new ForbiddenException('Only the administration of the template may change it');
    }
    await this.database.db
      .update(pageTemplates)
      .set({ ...request, updatedById: principal.userId, updatedAt: new Date() })
      .where(eq(pageTemplates.id, id));
    return this.get(principal, id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const { row } = await this.row(principal, id);
    if (!(await this.canManage(principal, row.spaceId))) {
      throw new ForbiddenException('Only the administration of the template may delete it');
    }
    await this.database.db.delete(pageTemplates).where(eq(pageTemplates.id, id));
    await this.audit.record({
      action: 'template.deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'page_template',
      targetId: id,
      details: { name: row.name },
    });
  }

  /** The template, if the caller may see it: global ones everyone, space ones its viewers. */
  private async row(principal: Principal, id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Template not found');
    const [found] = await this.database.db
      .select({ template: pageTemplates, spaceKey: spaces.key })
      .from(pageTemplates)
      .leftJoin(spaces, eq(spaces.id, pageTemplates.spaceId))
      .where(eq(pageTemplates.id, id));
    if (!found) throw new NotFoundException('Template not found');
    if (found.spaceKey) {
      try {
        await this.spaces.find(principal, found.spaceKey, 'view');
      } catch {
        throw new NotFoundException('Template not found');
      }
    }
    return { row: found.template, spaceKey: found.spaceKey };
  }

  private async canManage(principal: Principal, spaceId: string | null): Promise<boolean> {
    if (!spaceId) return this.access.hasGlobal(principal.userId, 'admin');
    const [space] = await this.database.db
      .select({ key: spaces.key })
      .from(spaces)
      .where(eq(spaces.id, spaceId));
    if (!space) return false;
    const { permissions } = await this.spaces.find(principal, space.key, 'view');
    return permissions.has('administer');
  }
}
