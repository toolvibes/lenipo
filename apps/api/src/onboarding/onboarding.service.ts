import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { OnboardingRequest, OnboardingResult, RichText } from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, isUniqueViolation } from '../db/client.js';
import { pages, pageVersions, spaces, users } from '../db/schema/index.js';
import { UserService } from '../identity/user.service.js';
import {
  BUILT_IN_STATUSES,
  BUILT_IN_WORKFLOWS,
  builtInId,
  PROJECT_TEMPLATES,
} from '../tracking/builtins.js';
import { ProjectService } from '../tracking/project.service.js';
import { rankBetween } from '../tracking/rank.js';
import { plainText } from '../tracking/rich-text.js';
import { SpaceService } from '../wiki/space.service.js';
import { autoWatch } from '../wiki/watches.js';

const START_PAGE = {
  de: (name: string) => ({
    title: `Willkommen bei ${name}`,
    lead: `Hier entsteht die Dokumentation von ${name}: Entscheidungen, Anleitungen und alles, was das Team wissen sollte.`,
  }),
  en: (name: string) => ({
    title: `Welcome to ${name}`,
    lead: `This is where the documentation of ${name} grows: decisions, how-tos and everything the team should know.`,
  }),
};

/** The statuses of a template's built-in workflow, for the board's first columns. */
function templateStatuses(template: 'scrum' | 'kanban') {
  const workflow = BUILT_IN_WORKFLOWS.find(
    (entry) => entry.key === PROJECT_TEMPLATES[template].workflow,
  );
  const names = new Map(
    BUILT_IN_STATUSES.map((status) => [builtInId('status', status.key), status.name]),
  );
  return (workflow?.definition.statusIds ?? []).map((id) => ({ id, name: names.get(id) ?? id }));
}

/**
 * The welcome steps after the first sign-in (E-71): profile, then per method a project with
 * board and Lore space, or only a space; all in one transaction, then the user counts as
 * onboarded. Without `start` it saves the profile (or nothing) and finishes, which is "skip".
 */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
  ) {}

  async finish(principal: Principal, request: OnboardingRequest): Promise<OnboardingResult> {
    if (principal.via !== 'session') {
      throw new ForbiddenException('The welcome steps are for people signed in to the web app');
    }
    const userId = principal.userId;
    const start = request.start;
    const [canProjects, canSpaces] = await Promise.all([
      this.access.hasGlobal(userId, 'create-projects'),
      this.access.hasGlobal(userId, 'create-spaces'),
    ]);
    if (start && start.method !== 'lore' && !canProjects) {
      throw new ForbiddenException('Requires the global permission "create-projects"');
    }
    if (start?.method === 'lore' && !canSpaces) {
      throw new ForbiddenException('Requires the global permission "create-spaces"');
    }
    const [user] = await this.database.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, userId));
    const locale = request.profile?.locale ?? (user?.locale === 'en' ? 'en' : 'de');

    const created = {
      projectId: null as string | null,
      boardId: null as string | null,
      spaceId: null as string | null,
    };
    try {
      await this.database.db.transaction(async (tx) => {
        await this.users.updateProfile(userId, request.profile ?? {}, tx);
        if (start) {
          if (start.method !== 'lore') {
            created.projectId = uuidv7();
            await this.projects.insertProject(tx, userId, created.projectId, {
              key: start.key,
              name: start.name,
              description: '',
              template: start.method,
            });
            created.boardId = uuidv7();
            await this.boards.insertBoard(tx, {
              id: created.boardId,
              name: start.name,
              type: start.method,
              projectId: created.projectId,
              query: `project = ${start.key}`,
              statuses: templateStatuses(start.method),
            });
          }
          if (canSpaces) {
            created.spaceId = uuidv7();
            await this.spaces.insertSpace(
              tx,
              userId,
              created.spaceId,
              { key: start.key, name: start.name, description: '' },
              created.projectId,
            );
            // A published start page, so the space is not empty.
            const text = START_PAGE[locale](start.name);
            const content: RichText = {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: text.lead }] }],
            };
            const pageId = uuidv7();
            await tx.insert(pages).values({
              id: pageId,
              spaceId: created.spaceId,
              rank: rankBetween(null, null),
              title: text.title,
              version: 1,
              publishedAt: new Date(),
              createdById: userId,
            });
            await tx.insert(pageVersions).values({
              id: uuidv7(),
              pageId,
              number: 1,
              title: text.title,
              content,
              text: plainText(content),
              authorId: userId,
            });
            await tx
              .update(spaces)
              .set({ homePageId: pageId })
              .where(eq(spaces.id, created.spaceId));
            await autoWatch(tx, userId, pageId);
          }
        }
        await tx.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`The key "${start?.key}" is already taken`);
      }
      throw error;
    }

    const via = principal.via;
    if (created.projectId) {
      await this.audit.record({
        action: 'project.created',
        actorId: userId,
        via,
        targetType: 'project',
        targetId: created.projectId,
        details: { key: start?.key, template: start?.method, onboarding: true },
      });
    }
    if (created.spaceId) {
      await this.audit.record({
        action: 'space.created',
        actorId: userId,
        via,
        targetType: 'space',
        targetId: created.spaceId,
        details: { key: start?.key, onboarding: true },
      });
    }
    return { boardId: created.boardId, spaceKey: created.spaceId ? (start?.key ?? null) : null };
  }
}
