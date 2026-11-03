import type {
  Agent,
  Claim,
  ClaimResult,
  CreatedToken,
  Issue,
  Me,
  Problem,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issueClaims } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { normalizePath, pathsOverlap } from './claim.service.js';

let test: TestApp;
let admin: TestClient;
let claude: TestClient;
let codex: TestClient;
let codexAgent: Agent;
let claudeAgent: Agent;

async function newAgent(name: string, vendor: string): Promise<[Agent, TestClient]> {
  const agent = (await admin.request<Agent>('POST', '/agents', { displayName: name, vendor })).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  const token = await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
    name: 'Lauf',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  return [agent, new TestClient(test.baseUrl, { authorization: `Bearer ${token.body.secret}` })];
}

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const lena = (await admin.request<Me>('GET', '/me')).body.id;
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Login', 'Suche', 'Export', 'Datenbank', 'Hilfe']) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary,
      ...(summary === 'Datenbank' ? { assigneeId: lena } : {}),
    });
  }
  // The database work blocks the export.
  await admin.request('POST', '/issues/WEB-4/links', { type: 'blocks', issueKey: 'WEB-3' });
  [claudeAgent, claude] = await newAgent('Claude', 'Claude Code');
  [codexAgent, codex] = await newAgent('Codex', 'Codex CLI');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('claims (TL-94)', () => {
  it('compares work paths by folder', () => {
    expect(normalizePath('./apps/web/**')).toBe('apps/web');
    expect(pathsOverlap('apps/web/', 'apps/web/src/main.tsx')).toBe(true);
    expect(pathsOverlap('apps/web', 'apps/webhooks')).toBe(false);
    expect(pathsOverlap('packages/shared/src/a.ts', 'packages/shared/src/b.ts')).toBe(false);
  });

  it('makes the claimer the assignee and keeps others out', async () => {
    const claimed = await claude.request<Claim>('POST', '/issues/WEB-1/claim', {
      branch: 'agent/WEB-1-login',
      paths: ['apps/web/**'],
    });
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({
      issue: { key: 'WEB-1' },
      user: { displayName: 'Claude' },
      paths: ['apps/web'],
      forced: false,
    });
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.assignee?.id).toBe(claudeAgent.id);
    expect((await codex.request('POST', '/issues/WEB-1/claim', {})).status).toBe(409);
    expect((await codex.request('POST', '/issues/WEB-4/claim', {})).status).toBe(409);
  });

  it('reports overlapping work areas before the start', async () => {
    const refused = await codex.request<Problem>('POST', '/issues/WEB-2/claim', {
      paths: ['apps/web/src/search.ts'],
    });
    expect(refused.status).toBe(409);
    expect(refused.body.claimConflicts).toEqual([
      {
        issueKey: 'WEB-1',
        user: { id: claudeAgent.id, displayName: 'Claude' },
        branch: 'agent/WEB-1-login',
        paths: ['apps/web'],
      },
    ]);
    expect((await codex.request('GET', '/issues/WEB-2')).status).toBe(200);
    const sameBranch = await codex.request<Problem>('POST', '/issues/WEB-2/claim', {
      branch: 'agent/WEB-1-login',
    });
    expect(sameBranch.body.claimConflicts?.[0]?.issueKey).toBe('WEB-1');
    const forced = await codex.request<Claim>('POST', '/issues/WEB-2/claim', {
      paths: ['apps/web/src/search.ts'],
      force: true,
    });
    expect(forced.body).toMatchObject({ issue: { key: 'WEB-2' }, forced: true });
  });

  it('claims the next fitting issue in rank order', async () => {
    const next = async () =>
      (await codex.request<ClaimResult>('POST', '/projects/WEB/claim-next', {})).body.claim?.issue
        .key;
    // Its own open claim comes first.
    expect(await next()).toBe('WEB-2');
    expect((await codex.request('DELETE', '/issues/WEB-2/claim')).status).toBe(204);
    // Only what its task filter allows; WEB-3 waits for WEB-4.
    await admin.request('PATCH', `/agents/${codexAgent.id}`, {
      taskFilter: 'summary ~ "Export" OR summary ~ "Hilfe"',
    });
    expect(await next()).toBe('WEB-5');
    // Claude goes on with its own claim; for others the blocked export does not fit.
    const resumed = await claude.request<ClaimResult>('POST', '/projects/WEB/claim-next', {});
    expect(resumed.body.claim?.issue.key).toBe('WEB-1');
    const nothing = await admin.request<ClaimResult>('POST', '/projects/WEB/claim-next', {
      filter: 'summary ~ "Export"',
    });
    expect(nothing.body.claim).toBeNull();
    expect(
      (await admin.request<Claim[]>('GET', '/projects/WEB/claims')).body.map(
        (claim) => claim.issue.key,
      ),
    ).toEqual(['WEB-1', 'WEB-5']);
  });

  it('lives as long as heartbeats come', async () => {
    const soon = new Date(Date.now() + 60_000);
    await test.database.db
      .update(issueClaims)
      .set({ expiresAt: soon })
      .where(eq(issueClaims.userId, claudeAgent.id));
    await claude.request('PUT', '/me/presence', { state: 'active', issueKey: 'WEB-1' });
    const extended = (await claude.request<ClaimResult>('GET', '/issues/WEB-1/claim')).body.claim;
    expect(new Date(extended?.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 25 * 60_000);

    await test.database.db
      .update(issueClaims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(issueClaims.userId, claudeAgent.id));
    expect((await admin.request<ClaimResult>('GET', '/issues/WEB-1/claim')).body.claim).toBeNull();
    // The assignee stays, so the issue is still Claude's.
    expect((await codex.request('POST', '/issues/WEB-1/claim', {})).status).toBe(409);
  });

  it('is released by its holder or a project administrator', async () => {
    expect((await claude.request('DELETE', '/issues/WEB-5/claim')).status).toBe(403);
    expect((await admin.request('DELETE', '/issues/WEB-5/claim')).status).toBe(204);
    expect((await admin.request<Claim[]>('GET', '/projects/WEB/claims')).body).toEqual([]);
  });
});
