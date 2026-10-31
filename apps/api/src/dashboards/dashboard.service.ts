import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AddGadgetRequest,
  type ArrangeGadgetsRequest,
  type CopyDashboardRequest,
  type CreateDashboardRequest,
  columnCount,
  type Dashboard,
  type DashboardLayout,
  type DashboardScope,
  type DashboardSummary,
  type FilterShare,
  type FilterShareInput,
  type Gadget,
  GadgetConfig,
  type UpdateDashboardRequest,
  type UpdateGadgetRequest,
} from '@tasklore/shared';
import { and, asc, eq, exists, inArray, ne, or, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  dashboardGadgets,
  dashboardHomes,
  dashboardShares,
  dashboards,
  favourites,
  groupMembers,
  groups,
  projects,
  users,
} from '../db/schema/index.js';
import { FilterService, presentShare } from '../search/filter.service.js';
import { requireIssueScope, SearchService } from '../search/search.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { PageService } from '../wiki/page.service.js';

type DashboardRow = typeof dashboards.$inferSelect;
type GadgetRow = typeof dashboardGadgets.$inferSelect;

const MAX_GADGETS = 30;

/**
 * Dashboards with gadgets in columns (TL-20, E-101). Owner and administrators edit; shares
 * grant viewing. Gadgets only store what to show; their data loads with the viewer's rights.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(FilterService) private readonly filters: FilterService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(BoardService) private readonly boards: BoardService,
  ) {}

  /** Dashboards the user owns or that are shared with them, directly or through a group or project. */
  async visibleCondition(userId: string): Promise<SQL> {
    const db = this.database.db;
    const myGroups = db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    const myProjects = db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(userId));
    const shared = exists(
      db
        .select({ one: sql`1` })
        .from(dashboardShares)
        .where(
          and(
            eq(dashboardShares.dashboardId, dashboards.id),
            or(
              eq(dashboardShares.type, 'authenticated'),
              eq(dashboardShares.userId, userId),
              inArray(dashboardShares.groupId, myGroups),
              inArray(dashboardShares.projectId, myProjects),
            ),
          ),
        ),
    );
    return or(eq(dashboards.ownerId, userId), shared) as SQL;
  }

  private async present(userId: string, rows: DashboardRow[]): Promise<DashboardSummary[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const ids = rows.map((row) => row.id);
    const [owners, shares, starred, [home], admin] = await Promise.all([
      db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, [...new Set(rows.map((row) => row.ownerId))])),
      db
        .select({
          dashboardId: dashboardShares.dashboardId,
          type: dashboardShares.type,
          userId: users.id,
          userName: users.displayName,
          groupId: groups.id,
          groupName: groups.name,
          projectId: projects.id,
          projectKey: projects.key,
          projectName: projects.name,
        })
        .from(dashboardShares)
        .leftJoin(users, eq(users.id, dashboardShares.userId))
        .leftJoin(groups, eq(groups.id, dashboardShares.groupId))
        .leftJoin(projects, eq(projects.id, dashboardShares.projectId))
        .where(inArray(dashboardShares.dashboardId, ids)),
      db
        .select({ id: favourites.targetId })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.kind, 'dashboard'),
            inArray(favourites.targetId, ids),
          ),
        ),
      db
        .select({ id: dashboardHomes.dashboardId })
        .from(dashboardHomes)
        .where(eq(dashboardHomes.userId, userId)),
      this.access.hasGlobal(userId, 'admin'),
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const favourite = new Set(starred.map((entry) => entry.id));
    const sharesById = new Map<string, FilterShare[]>();
    for (const share of shares) {
      const presented = presentShare(share);
      if (presented) {
        sharesById.set(share.dashboardId, [
          ...(sharesById.get(share.dashboardId) ?? []),
          presented,
        ]);
      }
    }
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      layout: row.layout as DashboardLayout,
      owner: ownerById.get(row.ownerId) ?? { id: row.ownerId, displayName: '' },
      shares: sharesById.get(row.id) ?? [],
      favourite: favourite.has(row.id),
      home: home?.id === row.id,
      editable: row.ownerId === userId || admin,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async list(principal: Principal, scope: DashboardScope): Promise<DashboardSummary[]> {
    requireIssueScope(principal);
    const { userId } = principal;
    const db = this.database.db;
    const scoped: Record<DashboardScope, SQL | undefined> = {
      visible: undefined,
      mine: eq(dashboards.ownerId, userId),
      shared: ne(dashboards.ownerId, userId),
      favourites: exists(
        db
          .select({ one: sql`1` })
          .from(favourites)
          .where(
            and(
              eq(favourites.kind, 'dashboard'),
              eq(favourites.targetId, dashboards.id),
              eq(favourites.userId, userId),
            ),
          ),
      ),
      home: exists(
        db
          .select({ one: sql`1` })
          .from(dashboardHomes)
          .where(
            and(eq(dashboardHomes.dashboardId, dashboards.id), eq(dashboardHomes.userId, userId)),
          ),
      ),
    };
    const rows = await db
      .select()
      .from(dashboards)
      .where(and(await this.visibleCondition(userId), scoped[scope]))
      .orderBy(asc(sql`lower(${dashboards.name})`), asc(dashboards.id));
    return this.present(userId, rows);
  }

  /** Loads a dashboard the user can see; others look like they do not exist. */
  private async load(principal: Principal, id: string): Promise<DashboardRow> {
    const [row] = await this.database.db
      .select()
      .from(dashboards)
      .where(and(eq(dashboards.id, id), await this.visibleCondition(principal.userId)));
    if (!row) throw new NotFoundException('Dashboard not found');
    return row;
  }

  private async loadEditable(principal: Principal, id: string): Promise<DashboardRow> {
    requireIssueScope(principal, true);
    const row = await this.load(principal, id);
    if (
      row.ownerId !== principal.userId &&
      !(await this.access.hasGlobal(principal.userId, 'admin'))
    ) {
      throw new ForbiddenException('Only the owner can change this dashboard');
    }
    return row;
  }

  private gadgetOf(row: GadgetRow): Gadget | null {
    const config = GadgetConfig.safeParse(row.config);
    return config.success ? { id: row.id, title: row.title, config: config.data } : null;
  }

  async get(principal: Principal, id: string): Promise<Dashboard> {
    requireIssueScope(principal);
    const row = await this.load(principal, id);
    const [summary] = await this.present(principal.userId, [row]);
    const gadgets = await this.database.db
      .select()
      .from(dashboardGadgets)
      .where(eq(dashboardGadgets.dashboardId, id))
      .orderBy(asc(dashboardGadgets.column), asc(dashboardGadgets.position));
    const count = columnCount(row.layout as DashboardLayout);
    const columns: Gadget[][] = Array.from({ length: count }, () => []);
    for (const gadget of gadgets) {
      const presented = this.gadgetOf(gadget);
      if (presented) columns[Math.min(gadget.column, count - 1)]?.push(presented);
    }
    return { ...(summary as DashboardSummary), columns };
  }

  private async replaceShares(
    db: Executor,
    dashboardId: string,
    shares: FilterShareInput[],
  ): Promise<void> {
    await db.delete(dashboardShares).where(eq(dashboardShares.dashboardId, dashboardId));
    if (shares.length === 0) return;
    await db.insert(dashboardShares).values(
      shares.map((share) => ({
        id: uuidv7(),
        dashboardId,
        type: share.type,
        userId: share.type === 'user' ? share.userId : null,
        groupId: share.type === 'group' ? share.groupId : null,
        projectId: share.type === 'project' ? share.projectId : null,
      })),
    );
  }

  async create(principal: Principal, request: CreateDashboardRequest): Promise<Dashboard> {
    requireIssueScope(principal, true);
    const shares = await this.filters.validateShares(principal, request.shares);
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(dashboards).values({
        id,
        ownerId: principal.userId,
        name: request.name,
        description: request.description,
        layout: request.layout,
      });
      await this.replaceShares(tx, id, shares);
      await tx
        .insert(favourites)
        .values({ userId: principal.userId, kind: 'dashboard', targetId: id });
    });
    return this.get(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    request: UpdateDashboardRequest,
  ): Promise<Dashboard> {
    const row = await this.loadEditable(principal, id);
    const shares = request.shares
      ? await this.filters.validateShares(principal, request.shares)
      : undefined;
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(dashboards)
        .set({
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...(request.layout !== undefined ? { layout: request.layout } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dashboards.id, id));
      if (shares) await this.replaceShares(tx, id, shares);
      // Fewer columns: gadgets of dropped columns go to the end of the last one.
      if (request.layout && request.layout !== row.layout) {
        const last = columnCount(request.layout) - 1;
        const gadgets = await tx
          .select()
          .from(dashboardGadgets)
          .where(eq(dashboardGadgets.dashboardId, id))
          .orderBy(asc(dashboardGadgets.column), asc(dashboardGadgets.position));
        let position = gadgets.filter((gadget) => gadget.column === last).length;
        for (const gadget of gadgets.filter((entry) => entry.column > last)) {
          await tx
            .update(dashboardGadgets)
            .set({ column: last, position: position++ })
            .where(eq(dashboardGadgets.id, gadget.id));
        }
      }
    });
    return this.get(principal, id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    await this.loadEditable(principal, id);
    await this.database.db.transaction(async (tx) => {
      await tx.delete(dashboards).where(eq(dashboards.id, id));
      // The generic favourites table has no foreign key (E-46).
      await tx
        .delete(favourites)
        .where(and(eq(favourites.kind, 'dashboard'), eq(favourites.targetId, id)));
    });
  }

  /** Anyone who can view a dashboard may copy it as their own, without its shares. */
  async copy(principal: Principal, id: string, request: CopyDashboardRequest): Promise<Dashboard> {
    requireIssueScope(principal, true);
    const source = await this.load(principal, id);
    const copyId = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(dashboards).values({
        id: copyId,
        ownerId: principal.userId,
        name: request.name,
        description: source.description,
        layout: source.layout,
      });
      const gadgets = await tx
        .select()
        .from(dashboardGadgets)
        .where(eq(dashboardGadgets.dashboardId, id));
      if (gadgets.length > 0) {
        await tx
          .insert(dashboardGadgets)
          .values(gadgets.map((gadget) => ({ ...gadget, id: uuidv7(), dashboardId: copyId })));
      }
      await tx
        .insert(favourites)
        .values({ userId: principal.userId, kind: 'dashboard', targetId: copyId });
    });
    return this.get(principal, copyId);
  }

  /** The person's start page; one at most. */
  async setHome(principal: Principal, id: string, home: boolean): Promise<void> {
    requireIssueScope(principal);
    await this.load(principal, id);
    const db = this.database.db;
    if (home) {
      await db
        .insert(dashboardHomes)
        .values({ userId: principal.userId, dashboardId: id })
        .onConflictDoUpdate({ target: dashboardHomes.userId, set: { dashboardId: id } });
    } else {
      await db
        .delete(dashboardHomes)
        .where(
          and(eq(dashboardHomes.userId, principal.userId), eq(dashboardHomes.dashboardId, id)),
        );
    }
  }

  /** Checks what a gadget points at as its editor would see it; queries must compile. */
  private async validateConfig(principal: Principal, config: GadgetConfig): Promise<void> {
    if ('query' in config) await this.search.compile(principal, config.query);
    if (config.type === 'wiki-page') await this.pages.authorize(principal, config.pageId, 'view');
    if (config.type === 'sprint-burndown') await this.boards.get(principal, config.boardId);
    if (config.type === 'report') {
      if ('query' in config.report) await this.search.compile(principal, config.report.query);
      if ('boardId' in config.report) await this.boards.get(principal, config.report.boardId);
    }
  }

  async addGadget(principal: Principal, id: string, request: AddGadgetRequest): Promise<Dashboard> {
    const row = await this.loadEditable(principal, id);
    await this.validateConfig(principal, request.config);
    const column = Math.min(request.column, columnCount(row.layout as DashboardLayout) - 1);
    const db = this.database.db;
    const existing = await db
      .select({ column: dashboardGadgets.column })
      .from(dashboardGadgets)
      .where(eq(dashboardGadgets.dashboardId, id));
    if (existing.length >= MAX_GADGETS) {
      throw new BadRequestException(`A dashboard holds at most ${MAX_GADGETS} gadgets`);
    }
    // New gadgets go on top, where one looks first.
    await db.transaction(async (tx) => {
      await tx
        .update(dashboardGadgets)
        .set({ position: sql`${dashboardGadgets.position} + 1` })
        .where(and(eq(dashboardGadgets.dashboardId, id), eq(dashboardGadgets.column, column)));
      await tx.insert(dashboardGadgets).values({
        id: uuidv7(),
        dashboardId: id,
        column,
        position: 0,
        title: request.title,
        config: request.config,
      });
      await tx.update(dashboards).set({ updatedAt: new Date() }).where(eq(dashboards.id, id));
    });
    return this.get(principal, id);
  }

  private async gadget(dashboardId: string, gadgetId: string): Promise<GadgetRow> {
    const [row] = await this.database.db
      .select()
      .from(dashboardGadgets)
      .where(and(eq(dashboardGadgets.id, gadgetId), eq(dashboardGadgets.dashboardId, dashboardId)));
    if (!row) throw new NotFoundException('Gadget not found');
    return row;
  }

  async updateGadget(
    principal: Principal,
    id: string,
    gadgetId: string,
    request: UpdateGadgetRequest,
  ): Promise<Dashboard> {
    await this.loadEditable(principal, id);
    const current = await this.gadget(id, gadgetId);
    if (request.config) {
      if (request.config.type !== (current.config as GadgetConfig).type) {
        throw new BadRequestException('A gadget keeps its type');
      }
      await this.validateConfig(principal, request.config);
    }
    await this.database.db
      .update(dashboardGadgets)
      .set({
        ...(request.title !== undefined ? { title: request.title } : {}),
        ...(request.config ? { config: request.config } : {}),
      })
      .where(eq(dashboardGadgets.id, gadgetId));
    return this.get(principal, id);
  }

  async removeGadget(principal: Principal, id: string, gadgetId: string): Promise<void> {
    await this.loadEditable(principal, id);
    await this.gadget(id, gadgetId);
    await this.database.db.delete(dashboardGadgets).where(eq(dashboardGadgets.id, gadgetId));
  }

  /** Stores a new order; every gadget of the dashboard must appear exactly once. */
  async arrange(
    principal: Principal,
    id: string,
    request: ArrangeGadgetsRequest,
  ): Promise<Dashboard> {
    const row = await this.loadEditable(principal, id);
    if (request.columns.length !== columnCount(row.layout as DashboardLayout)) {
      throw new BadRequestException('The arrangement must have one list per column');
    }
    const ids = request.columns.flat();
    const existing = await this.database.db
      .select({ id: dashboardGadgets.id })
      .from(dashboardGadgets)
      .where(eq(dashboardGadgets.dashboardId, id));
    const known = new Set(existing.map((gadget) => gadget.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((g) => known.has(g))
    ) {
      throw new BadRequestException('The arrangement must list every gadget exactly once');
    }
    await this.database.db.transaction(async (tx) => {
      for (const [column, gadgetIds] of request.columns.entries()) {
        for (const [position, gadgetId] of gadgetIds.entries()) {
          await tx
            .update(dashboardGadgets)
            .set({ column, position })
            .where(eq(dashboardGadgets.id, gadgetId));
        }
      }
    });
    return this.get(principal, id);
  }
}
