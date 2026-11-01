import { createHmac } from 'node:crypto';
import type {
  Comment,
  CreatedGitConnection,
  DevelopmentSummary,
  GitConnection,
  IssueDevelopment,
  Transition,
  Version,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationEngine } from '../automation/automation.engine.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let connection: CreatedGitConnection;
let doneSlug = '';
let doneName = '';

async function drain(): Promise<void> {
  const processor = test.app.get(EventProcessor);
  await test.app.get(AutomationEngine).drain(() => processor.drain());
}

/** Sends a GitHub webhook; a wrong secret makes the signature invalid. */
async function deliver(event: string, payload: unknown, secret = connection.secret) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return fetch(connection.webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${signature}`,
    },
    body,
  });
}

const repository = { full_name: 'acme/web', html_url: 'https://github.com/acme/web' };
const push = {
  ref: 'refs/heads/feature/WEB-1-login',
  created: true,
  repository,
  commits: [
    {
      id: 'c0ffee1',
      message: 'WEB-1 Login gebaut #comment Login steht #time 1h 30m Umsetzung #DONE',
      url: 'https://github.com/acme/web/commit/c0ffee1',
      author: { name: 'Lena Vogt', email: 'Lena@example.org' },
      timestamp: '2026-10-31T10:00:00Z',
    },
  ],
};

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Login',
  });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Suche',
  });
  const transitions = (await admin.request<Transition[]>('GET', '/issues/WEB-1/transitions')).body;
  const done = transitions.find((entry) => entry.setsResolution) ?? transitions[0];
  doneName = done?.to.name ?? '';
  doneSlug = doneName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  push.commits[0] = {
    ...(push.commits[0] as (typeof push.commits)[number]),
    message: `WEB-1 Login gebaut #comment Login steht #time 1h 30m Umsetzung #${doneSlug}`,
  };
  connection = (
    await admin.request<CreatedGitConnection>('POST', '/admin/git-connections', {
      name: 'GitHub acme',
      provider: 'github',
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('Git integration (TL-36, TL-89)', () => {
  it('rejects deliveries with a wrong signature and notes why', async () => {
    expect((await deliver('push', push, 'falsch')).status).toBe(401);
    const [listed] = (await admin.request<GitConnection[]>('GET', '/admin/git-connections')).body;
    expect(listed?.lastError).toContain('Signatur');
  });

  it('links branches and commits and runs smart commits as their author, once', async () => {
    expect((await deliver('push', push)).status).toBe(202);
    expect((await deliver('push', push)).status).toBe(202); // redelivery
    const development = (await admin.request<IssueDevelopment>('GET', '/issues/WEB-1/development'))
      .body;
    expect(development.branches.map((branch) => branch.name)).toEqual(['feature/WEB-1-login']);
    expect(development.commits.count).toBe(1);
    expect(development.commits.latest[0]?.smart).toEqual([
      'Kommentar hinzugefügt',
      'Zeit erfasst: 1h 30m',
      `Status → ${doneName}`,
    ]);
    const comments = (await admin.request<Comment[]>('GET', '/issues/WEB-1/comments')).body;
    expect(
      comments.filter((comment) => JSON.stringify(comment.body).includes('Login steht')),
    ).toHaveLength(1);
    const issue = (await admin.request<{ status: { name: string } }>('GET', '/issues/WEB-1')).body;
    expect(issue.status.name).toBe(doneName);
  });

  it('turns a merged pull request into an automation trigger', async () => {
    await admin.request('POST', '/automation/rules', {
      name: 'PR gemergt',
      projectKey: 'WEB',
      trigger: { type: 'git', event: 'pull_request_merged' },
      components: [{ type: 'comment', body: 'Gemergt: {{git.title}}' }],
    });
    const pull = (state: string, merged: boolean) => ({
      action: merged ? 'closed' : 'opened',
      repository,
      pull_request: {
        number: 12,
        title: 'WEB-2: Suche',
        html_url: 'https://github.com/acme/web/pull/12',
        state,
        merged,
        head: { ref: 'web-2-suche' },
        user: { login: 'lena' },
      },
    });
    await deliver('pull_request', pull('open', false));
    await deliver('pull_request_review', {
      ...pull('open', false),
      action: 'submitted',
      review: { state: 'approved' },
    });
    await deliver('pull_request', pull('closed', true));
    await drain();
    const development = (await admin.request<IssueDevelopment>('GET', '/issues/WEB-2/development'))
      .body;
    expect(development.pullRequests).toEqual([
      expect.objectContaining({ number: '12', state: 'merged', review: 'approved' }),
    ]);
    const comments = (await admin.request<Comment[]>('GET', '/issues/WEB-2/comments')).body;
    expect(JSON.stringify(comments.map((comment) => comment.body))).toContain(
      'Gemergt: WEB-2: Suche',
    );
  });

  it('shows failing builds of a branch or commit in the release', async () => {
    await deliver('workflow_run', {
      repository,
      workflow_run: {
        id: 99,
        name: 'CI',
        status: 'completed',
        conclusion: 'failure',
        head_branch: 'main',
        head_sha: 'c0ffee1',
        html_url: 'https://github.com/acme/web/actions/runs/99',
      },
    });
    const version = (
      await admin.request<Version>('POST', '/projects/WEB/versions', { name: '1.0' })
    ).body;
    await admin.request('PATCH', '/issues/WEB-1', { fixVersions: ['1.0'] });
    await admin.request('PATCH', '/issues/WEB-2', { fixVersions: ['1.0'] });
    const summary = (
      await admin.request<DevelopmentSummary[]>(
        'GET',
        `/projects/WEB/releases/${version.id}/development`,
      )
    ).body;
    expect(summary).toEqual(
      expect.arrayContaining([
        { issueKey: 'WEB-1', openPullRequests: 0, mergedPullRequests: 0, failingBuilds: 1 },
        { issueKey: 'WEB-2', openPullRequests: 0, mergedPullRequests: 1, failingBuilds: 0 },
      ]),
    );
  });
});
