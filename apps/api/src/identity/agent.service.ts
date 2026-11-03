import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type Agent,
  AgentBudget,
  type CreateAgentRequest,
  type UpdateAgentRequest,
} from '@toolvibes/shared';
import { and, eq, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  agentProfiles,
  issueClaims,
  notificationSettings,
  users,
  webhooks,
} from '../db/schema/index.js';
import { UserService } from './user.service.js';

const owners = alias(users, 'owners');
const pausers = alias(users, 'pausers');

/**
 * Accounts of AI agents (TL-92, E-144): users of the kind "agent" with a profile. They have no
 * password and never sign in; tokens come from their responsible person or an administrator.
 */
@Injectable()
export class AgentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(UserService) private readonly users: UserService,
  ) {}

  async list(): Promise<Agent[]> {
    return this.select();
  }

  async get(id: string): Promise<Agent> {
    const [agent] = await this.select(eq(users.id, id));
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(request: CreateAgentRequest, ownerId: string): Promise<string> {
    return this.database.atomic(async () => {
      const db = this.database.db;
      await this.requirePerson(request.ownerId ?? ownerId);
      const id = await this.users.create(
        {
          // Never delivered: agents are told about changes through the API and MCP.
          email: `agent-${crypto.randomUUID()}@agents.invalid`,
          displayName: request.displayName,
          passwordHash: null,
          groupNames: request.groups,
          kind: 'agent',
        },
        db,
      );
      await db.insert(agentProfiles).values({
        userId: id,
        vendor: request.vendor,
        model: request.model,
        taskFilter: request.taskFilter,
        ownerId: request.ownerId ?? ownerId,
      });
      await db.insert(notificationSettings).values({ userId: id, emailEnabled: false });
      return id;
    });
  }

  async update(id: string, request: UpdateAgentRequest): Promise<void> {
    await this.get(id);
    await this.database.atomic(async () => {
      const db = this.database.db;
      if (request.ownerId) await this.requirePerson(request.ownerId);
      if (request.displayName !== undefined) {
        await db
          .update(users)
          .set({ displayName: request.displayName, updatedAt: new Date() })
          .where(eq(users.id, id));
      }
      const profile = {
        ...(request.vendor !== undefined ? { vendor: request.vendor } : {}),
        ...(request.model !== undefined ? { model: request.model } : {}),
        ...(request.taskFilter !== undefined ? { taskFilter: request.taskFilter } : {}),
        ...(request.ownerId !== undefined ? { ownerId: request.ownerId } : {}),
        ...(request.budget !== undefined ? { budget: request.budget } : {}),
      };
      if (Object.keys(profile).length > 0) {
        await db.update(agentProfiles).set(profile).where(eq(agentProfiles.userId, id));
      }
    });
  }

  /** Not-Aus (TL-98, E-150): the agent only reads and its claims end. */
  async pause(id: string, byId: string, reason: string): Promise<void> {
    await this.get(id);
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db
        .update(agentProfiles)
        .set({ pausedAt: new Date(), pausedById: byId, pauseReason: reason })
        .where(eq(agentProfiles.userId, id));
      await db.delete(issueClaims).where(eq(issueClaims.userId, id));
    });
  }

  async resume(id: string): Promise<void> {
    await this.get(id);
    await this.database.db
      .update(agentProfiles)
      .set({ pausedAt: null, pausedById: null, pauseReason: '' })
      .where(eq(agentProfiles.userId, id));
  }

  /** Whether the user answers for the agent. */
  async isOwner(agentId: string, userId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ ownerId: agentProfiles.ownerId })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, agentId));
    if (!row) throw new NotFoundException('Agent not found');
    return row.ownerId === userId;
  }

  /** Agents answer to people, not to other agents. */
  private async requirePerson(userId: string): Promise<void> {
    const [row] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.kind, 'person'), eq(users.status, 'active')));
    if (!row) throw new NotFoundException('Responsible person not found');
  }

  private async select(where?: SQL): Promise<Agent[]> {
    const rows = await this.database.db
      .select({
        id: users.id,
        displayName: users.displayName,
        status: users.status,
        vendor: agentProfiles.vendor,
        model: agentProfiles.model,
        taskFilter: agentProfiles.taskFilter,
        createdAt: agentProfiles.createdAt,
        ownerId: owners.id,
        ownerName: owners.displayName,
        webhookUrl: webhooks.url,
        pausedAt: agentProfiles.pausedAt,
        pausedById: agentProfiles.pausedById,
        pauserName: pausers.displayName,
        pauseReason: agentProfiles.pauseReason,
        budget: agentProfiles.budget,
      })
      .from(agentProfiles)
      .innerJoin(users, eq(users.id, agentProfiles.userId))
      .leftJoin(owners, eq(owners.id, agentProfiles.ownerId))
      .leftJoin(pausers, eq(pausers.id, agentProfiles.pausedById))
      .leftJoin(webhooks, eq(webhooks.userId, users.id))
      .where(where)
      .orderBy(users.displayName);
    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      vendor: row.vendor,
      model: row.model,
      taskFilter: row.taskFilter,
      webhookUrl: row.webhookUrl,
      paused: row.pausedAt
        ? {
            at: row.pausedAt.toISOString(),
            by:
              row.pausedById && row.pauserName !== null
                ? { id: row.pausedById, displayName: row.pauserName }
                : null,
            reason: row.pauseReason,
          }
        : null,
      budget: AgentBudget.parse(row.budget),
      createdAt: row.createdAt.toISOString(),
      owner: row.ownerId ? { id: row.ownerId, displayName: row.ownerName ?? '' } : null,
    }));
  }
}
