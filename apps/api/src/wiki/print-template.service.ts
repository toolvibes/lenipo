import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrintTemplate, PrintTemplateInput, PrintTemplateSummary } from '@toolvibes/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { printTemplates, spaces } from '../db/schema/index.js';
import { SpaceService } from './space.service.js';

type Row = typeof printTemplates.$inferSelect;

function present(row: Row): PrintTemplate {
  return {
    id: row.id,
    name: row.name,
    titlePage: row.titlePage,
    logo: row.logo,
    subtitle: row.subtitle,
    header: row.header,
    footer: row.footer,
    css: row.css,
    isDefault: row.isDefault,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Print templates for PDFs of wiki pages (TL-53, E-142). The browser still prints; the template
 * adds a title page, the running header and footer and some CSS. Admins manage them, space
 * administrators pick one for their space.
 */
@Injectable()
export class PrintTemplateService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SpaceService) private readonly spaceService: SpaceService,
  ) {}

  async list(): Promise<PrintTemplateSummary[]> {
    const rows = await this.database.db
      .select({
        id: printTemplates.id,
        name: printTemplates.name,
        isDefault: printTemplates.isDefault,
      })
      .from(printTemplates)
      .orderBy(asc(printTemplates.name));
    return rows;
  }

  async get(id: string): Promise<PrintTemplate> {
    const [row] = await this.database.db
      .select()
      .from(printTemplates)
      .where(eq(printTemplates.id, id));
    if (!row) throw new NotFoundException('Print template not found');
    return present(row);
  }

  /** The template a page of the space prints with: the space's, else the instance default. */
  async forSpace(
    principal: Principal,
    key: string,
  ): Promise<{ template: PrintTemplate | null; own: boolean }> {
    const { space } = await this.spaceService.find(principal, key);
    const [row] = space.printTemplateId
      ? await this.database.db
          .select()
          .from(printTemplates)
          .where(eq(printTemplates.id, space.printTemplateId))
      : await this.database.db
          .select()
          .from(printTemplates)
          .where(eq(printTemplates.isDefault, true));
    return { template: row ? present(row) : null, own: !!space.printTemplateId };
  }

  private async save(id: string, input: PrintTemplateInput): Promise<PrintTemplate> {
    return this.database.atomic(async () => {
      // One default at most.
      if (input.isDefault) {
        await this.database.db
          .update(printTemplates)
          .set({ isDefault: false })
          .where(eq(printTemplates.isDefault, true));
      }
      const [row] = await this.database.db
        .insert(printTemplates)
        .values({ id, ...input })
        .onConflictDoUpdate({ target: printTemplates.id, set: { ...input, updatedAt: sql`now()` } })
        .returning();
      return present(row as Row);
    });
  }

  create(input: PrintTemplateInput): Promise<PrintTemplate> {
    return this.save(uuidv7(), input);
  }

  async update(id: string, input: PrintTemplateInput): Promise<PrintTemplate> {
    await this.get(id);
    return this.save(id, input);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.database.atomic(async () => {
      await this.database.db
        .update(spaces)
        .set({ printTemplateId: null })
        .where(eq(spaces.printTemplateId, id));
      await this.database.db.delete(printTemplates).where(eq(printTemplates.id, id));
    });
  }

  async setForSpace(principal: Principal, key: string, templateId: string | null) {
    const { space } = await this.spaceService.find(principal, key, 'administer');
    if (templateId) await this.get(templateId);
    await this.database.db
      .update(spaces)
      .set({ printTemplateId: templateId })
      .where(eq(spaces.id, space.id));
    return this.forSpace(principal, key);
  }
}
