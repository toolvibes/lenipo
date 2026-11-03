import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Io, run } from '@toolvibes/cli';
import type { Agent, CreatedToken } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let origin = '';
let secret = '';
let agent: Agent;
let repo = '';

async function tl(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    env: { LENIPO_URL: origin, TOKEN_CLAUDE: secret, PATH: process.env.PATH ?? '' },
    configFile: join(repo, '..', 'lenipo-config.json'),
    openUrl: () => undefined,
    columns: 200,
  };
  const code = await run(args, io);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.org', ...args], {
    cwd: repo,
  });

beforeAll(async () => {
  test = await startTestApp();
  origin = test.baseUrl.replace(/\/api\/v1$/, '');
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Login', 'Suche', 'Export']) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary,
      labels: ['agent'],
    });
  }
  const board = (
    await admin.request<{ id: string }>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body;
  const sprint = (await admin.request<{ id: string }>('POST', `/boards/${board.id}/sprints`, {}))
    .body;
  await admin.request('POST', '/sprints/move-issues', {
    issueKeys: ['WEB-1', 'WEB-2', 'WEB-3'],
    sprintId: sprint.id,
  });
  const today = new Date().toISOString().slice(0, 10);
  await admin.request('POST', `/sprints/${sprint.id}/start`, { startDate: today, endDate: today });
  agent = (
    await admin.request<Agent>('POST', '/agents', { displayName: 'Claude', vendor: 'Claude Code' })
  ).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  secret = (
    await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
      name: 'Runner',
      scopes: ['issues:read', 'issues:write'],
      expiresInDays: 30,
    })
  ).body.secret;

  // A code repository with the agent's setup and two slots running a stand-in for the agent.
  repo = join(await mkdtemp(join(tmpdir(), 'tl-runner-')), 'repo');
  await mkdir(join(repo, '.lenipo'), { recursive: true });
  git('init', '--quiet', '-b', 'main');
  await writeFile(
    join(repo, '.lenipo', 'agent.json'),
    JSON.stringify({ project: 'WEB', board: board.id, label: 'agent', questionLabel: 'q' }),
  );
  await writeFile(join(repo, '.lenipo', 'agent-prompt.md'), '# Sprint-Agent\n');
  const script =
    "require('fs').writeFileSync('ran.json', JSON.stringify({ prompt: process.argv[1], token: !!process.env.LENIPO_TOKEN, agent: process.env.LENIPO_AGENT }))";
  await writeFile(
    join(repo, '.lenipo', 'runner.json'),
    JSON.stringify({
      base: 'main',
      agents: [
        {
          name: 'claude',
          adapter: 'command',
          tokenEnv: 'TOKEN_CLAUDE',
          slots: 2,
          command: [process.execPath, '-e', script, '{prompt}'],
        },
      ],
    }),
  );
  git('add', '.');
  git('commit', '--quiet', '-m', 'Agent eingerichtet');
}, 60_000);

afterAll(async () => {
  await test?.close();
  if (repo) await rm(join(repo, '..'), { recursive: true, force: true });
});

describe('lenipo agent run (TL-99)', () => {
  it('starts one run per issue in its own worktree, up to the slots', async () => {
    const dry = await tl(['agent', 'run', '--once', '--dry-run', '--dir', repo]);
    expect(dry.code).toBe(0);
    expect(dry.out.split('\n')).toEqual([
      `claude: WEB-1 in Platz 1 (Start): ${process.execPath} …`,
      `claude: WEB-2 in Platz 2 (Start): ${process.execPath} …`,
    ]);

    const result = await tl(['agent', 'run', '--once', '--dir', repo]);
    expect(result.code).toBe(0);
    const ran = async (slot: number) =>
      JSON.parse(
        await readFile(join(repo, '.lenipo', 'worktrees', `claude-${slot}`, 'ran.json'), 'utf8'),
      ) as { prompt: string; token: boolean; agent: string };
    const first = await ran(1);
    const second = await ran(2);
    expect(first).toMatchObject({ token: true, agent: 'claude' });
    expect(first.prompt).toContain('# Sprint-Agent');
    expect(first.prompt).toContain('Dein Vorgang: WEB-1.');
    expect(second.prompt).toContain('Dein Vorgang: WEB-2.');
    // The worktree is checked out from main and logs stay out of the repository.
    expect(
      existsSync(join(repo, '.lenipo', 'worktrees', 'claude-1', '.lenipo', 'runner.json')),
    ).toBe(true);
    expect(await readdir(join(repo, '.lenipo', 'runs', 'claude'))).toHaveLength(2);
    expect(await readFile(join(repo, '.lenipo', '.gitignore'), 'utf8')).toBe('worktrees/\nruns/\n');
    // Only the new .gitignore shows up; worktrees and logs are ignored.
    expect(git('status', '--porcelain').toString()).toBe('?? .lenipo/.gitignore\n');
  });

  it('starts nothing while the agent is paused', async () => {
    await admin.request('PUT', `/agents/${agent.id}/pause`, { reason: 'Wartung' });
    const result = await tl(['agent', 'run', '--once', '--dir', repo]);
    expect(result.code).toBe(0);
    expect(result.err).toContain('claude: angehalten: Wartung');
    expect(await readdir(join(repo, '.lenipo', 'runs', 'claude'))).toHaveLength(2);
    await admin.request('DELETE', `/agents/${agent.id}/pause`);
  });

  it('explains a missing setup', async () => {
    await rm(join(repo, '.lenipo', 'runner.json'));
    const result = await tl(['agent', 'run', '--once', '--dir', repo]);
    expect(result.code).toBe(2);
    expect(result.err).toContain('Keine .lenipo/runner.json gefunden');
  });
});
