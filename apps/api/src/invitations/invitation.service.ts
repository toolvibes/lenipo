import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  Invitation,
  InvitationPreview,
  ProjectRole,
  RegistrationSettings,
} from '@toolvibes/shared';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { invitations, projects, systemSettings, users } from '../db/schema/index.js';
import { USERS_GROUP } from '../identity/group.service.js';
import { PasswordService } from '../identity/password.service.js';
import { randomSecret, sha256 } from '../identity/secrets.js';
import { SetupService } from '../identity/setup.service.js';
import { UserService } from '../identity/user.service.js';
import { invitationEmail } from '../notifications/email.js';
import { Mailer } from '../notifications/mailer.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { ProjectMemberService } from '../tracking/project-member.service.js';

const DAYS = 7;
const REGISTRATION_KEY = 'registration';

type Row = typeof invitations.$inferSelect;

/**
 * Invitations by e-mail, also straight into a project with a role, and self-registration for
 * listed domains (P-USR-15, TL-67, E-119). A link works once and for seven days.
 */
@Injectable()
export class InvitationService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectMemberService) private readonly members: ProjectMemberService,
    @Inject(Mailer) private readonly mailer: Mailer,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SetupService) private readonly setup: SetupService,
  ) {}

  private async administers(principal: Principal, projectId: string): Promise<boolean> {
    return this.projectAccess
      .require(principal, projectId, 'administer')
      .then(() => true)
      .catch(() => false);
  }

  private async instanceName(): Promise<string> {
    const [row] = await this.database.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'instance'));
    return (row?.value as { name?: string } | undefined)?.name ?? 'Lenipo';
  }

  private async present(rows: Row[]): Promise<Invitation[]> {
    const db = this.database.db;
    const projectRows = await db
      .select({ id: projects.id, key: projects.key, name: projects.name })
      .from(projects);
    const people = await db.select({ id: users.id, displayName: users.displayName }).from(users);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      project: projectRows.find((project) => project.id === row.projectId) ?? null,
      role: (row.role as ProjectRole | null) ?? null,
      invitedBy: people.find((person) => person.id === row.invitedById) ?? null,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
  }

  private link(token: string): string {
    const base = (this.config.PUBLIC_URL ?? '').replace(/\/+$/, '');
    return `${base}/invite?token=${encodeURIComponent(token)}`;
  }

  /** Admins invite anybody; project admins only into their project (with a role). */
  async invite(principal: Principal, request: CreateInvitationRequest): Promise<Invitation> {
    const isAdmin = await this.access.isAdmin(principal);
    let project: { id: string; key: string; name: string } | null = null;
    if (request.projectKey) {
      const found = await this.projects.findBrowsable(principal, request.projectKey);
      // Only the project's administrators (or admins) may add people to it.
      const allowed = isAdmin || (await this.administers(principal, found.id));
      if (!allowed)
        throw new ForbiddenException('Only project administrators can invite into the project');
      project = found;
    } else if (!isAdmin) {
      throw new ForbiddenException('Only administrators can invite without a project');
    }
    const email = request.email.toLowerCase();
    const existing = await this.users.findForLogin(email);
    if (existing && project) {
      // People who already have an account join the project right away.
      await this.members.add(principal, project.key, {
        userId: existing.id,
        role: request.role,
        shareSpace: request.shareSpace,
      });
    } else if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    const token = randomSecret();
    const id = uuidv7();
    const [row] = await this.database.db
      .insert(invitations)
      .values({
        id,
        kind: 'invite',
        email,
        tokenHash: sha256(token),
        projectId: project?.id ?? null,
        role: project ? request.role : null,
        external: request.external,
        shareSpace: request.shareSpace,
        invitedById: principal.userId,
        expiresAt: new Date(Date.now() + DAYS * 86_400_000),
        acceptedAt: existing ? new Date() : null,
      })
      .returning();
    const inviter = await this.database.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, principal.userId));
    await this.mailer.send(
      invitationEmail({
        to: email,
        instanceName: await this.instanceName(),
        inviter: inviter[0]?.displayName ?? null,
        project: project?.name ?? null,
        link: existing
          ? `${(this.config.PUBLIC_URL ?? '').replace(/\/+$/, '')}/projects/${project?.key}`
          : this.link(token),
        days: DAYS,
        joined: !!existing,
      }),
    );
    await this.audit.record({
      action: 'invitation.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'invitation',
      targetId: id,
      details: {
        email,
        project: project?.key ?? null,
        role: project ? request.role : null,
        ...(request.external ? { external: true } : {}),
      },
    });
    const [presented] = await this.present([row as Row]);
    return presented as Invitation;
  }

  async list(principal: Principal, projectKey?: string): Promise<Invitation[]> {
    const db = this.database.db;
    if (projectKey) {
      const project = await this.projects.findBrowsable(principal, projectKey);
      const allowed =
        (await this.access.isAdmin(principal)) || (await this.administers(principal, project.id));
      if (!allowed) throw new ForbiddenException();
      const rows = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.projectId, project.id), eq(invitations.kind, 'invite')))
        .orderBy(desc(invitations.createdAt));
      return this.present(rows);
    }
    if (!(await this.access.isAdmin(principal))) throw new ForbiddenException();
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.kind, 'invite'))
      .orderBy(desc(invitations.createdAt))
      .limit(200);
    return this.present(rows);
  }

  async revoke(principal: Principal, id: string): Promise<void> {
    const [row] = await this.database.db.select().from(invitations).where(eq(invitations.id, id));
    if (!row) throw new NotFoundException('Invitation not found');
    const isAdmin = await this.access.isAdmin(principal);
    const projectAdmin = row.projectId ? await this.administers(principal, row.projectId) : false;
    if (!isAdmin && !projectAdmin) throw new NotFoundException('Invitation not found');
    await this.database.db
      .update(invitations)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)));
  }

  private async open(token: string): Promise<Row> {
    const [row] = await this.database.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, sha256(token)));
    if (!row) throw new NotFoundException('This link is not valid');
    if (row.acceptedAt) throw new GoneException('This link was already used');
    if (row.revokedAt) throw new GoneException('This invitation was withdrawn');
    if (row.expiresAt.getTime() < Date.now()) throw new GoneException('This link has expired');
    return row;
  }

  async preview(token: string): Promise<InvitationPreview> {
    const row = await this.open(token);
    const [preview] = await this.present([row]);
    return {
      email: row.email,
      instanceName: await this.instanceName(),
      project: preview?.project ?? null,
      invitedBy: preview?.invitedBy?.displayName ?? null,
      registration: row.kind === 'register',
      setup: row.kind === 'setup',
    };
  }

  /** Creates the account, puts it into the project, and returns it for signing in. */
  async accept(request: AcceptInvitationRequest): Promise<string> {
    const row = await this.open(request.token);
    if (await this.users.findForLogin(row.email)) {
      throw new ConflictException('A user with this email already exists; sign in instead');
    }
    const passwordHash = await this.passwords.hash(request.password);
    const userId = await this.database.atomic(async () => {
      const db = this.database.db;
      const id = await this.users.create(
        {
          email: row.email,
          displayName: request.displayName,
          passwordHash,
          // External collaborators only get the project they were invited to (TL-66).
          groupNames: row.external ? [] : [USERS_GROUP],
          external: row.external,
        } as never,
        db,
      );
      const [claimed] = await db
        .update(invitations)
        .set({ acceptedAt: sql`now()` })
        .where(and(eq(invitations.id, row.id), isNull(invitations.acceptedAt)))
        .returning({ id: invitations.id });
      if (!claimed) throw new GoneException('This link was already used');
      // The first administrator, invited by the provider of the instance (TL-102).
      if (row.kind === 'setup') await this.setup.completeByInvitation(id, db);
      return id;
    });
    if (row.projectId && row.role && row.invitedById) {
      const [project] = await this.database.db
        .select()
        .from(projects)
        .where(eq(projects.id, row.projectId));
      if (project) {
        await this.members.add(
          { userId: row.invitedById, via: 'session', sessionId: 'invitation' },
          project.key,
          {
            userId,
            role: row.role as ProjectRole,
            shareSpace: row.shareSpace,
          },
        );
      }
    }
    await this.audit.record({
      action:
        row.kind === 'register'
          ? 'user.registered'
          : row.kind === 'setup'
            ? 'setup.completed'
            : 'invitation.accepted',
      actorId: userId,
      via: 'session',
      targetType: 'user',
      targetId: userId,
      details: { email: row.email },
    });
    return userId;
  }

  async projectKeyOf(token: string): Promise<string | null> {
    const [row] = await this.database.db
      .select({ key: projects.key })
      .from(invitations)
      .innerJoin(projects, eq(projects.id, invitations.projectId))
      .where(eq(invitations.tokenHash, sha256(token)));
    return row?.key ?? null;
  }

  // ---------------------------------------------------------------- self-registration

  async registration(): Promise<RegistrationSettings> {
    const [row] = await this.database.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, REGISTRATION_KEY));
    return {
      enabled: false,
      domains: [],
      ...(row?.value as Partial<RegistrationSettings> | undefined),
    };
  }

  async setRegistration(settings: RegistrationSettings): Promise<RegistrationSettings> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: REGISTRATION_KEY, value: settings })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: settings, updatedAt: new Date() },
      });
    return settings;
  }

  /**
   * Sends a confirmation link to an address of a listed domain. Answers the same whether or
   * not an account exists, so nobody learns who has one.
   */
  async register(emailInput: string): Promise<void> {
    const settings = await this.registration();
    const email = emailInput.toLowerCase();
    const domain = email.split('@')[1] ?? '';
    if (!settings.enabled || !settings.domains.includes(domain)) {
      throw new BadRequestException('Self-registration is not open for this address');
    }
    if (await this.users.findForLogin(email)) return;
    const [recent] = await this.database.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.kind, 'register'),
          gt(invitations.createdAt, sql`now() - interval '5 minutes'`),
        ),
      );
    if (recent) return;
    const token = randomSecret();
    await this.database.db.insert(invitations).values({
      id: uuidv7(),
      kind: 'register',
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + DAYS * 86_400_000),
    });
    await this.mailer.send(
      invitationEmail({
        to: email,
        instanceName: await this.instanceName(),
        inviter: null,
        project: null,
        link: this.link(token),
        days: DAYS,
        joined: false,
      }),
    );
  }
}
