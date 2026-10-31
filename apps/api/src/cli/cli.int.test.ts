import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { type Io, run } from '@tasklore/cli';
import type { CreatedToken, OAuthConsentResult } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let origin = '';
let token = '';
let dir = '';

/** Runs `tl` with the given environment and collects what it prints. */
async function tl(
  args: string[],
  env: Record<string, string> = {},
  openUrl?: (url: string) => void,
) {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    env: Object.keys(env).length ? env : { TASKLORE_URL: origin, TASKLORE_TOKEN: token },
    configFile: join(dir, 'config', 'tasklore.json'),
    openUrl: openUrl ?? (() => undefined),
    columns: 200,
  };
  const code = await run(args, io);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

beforeAll(async () => {
  test = await startTestApp();
  origin = test.baseUrl.replace(/\/api\/v1$/, '');
  dir = await mkdtemp(join(tmpdir(), 'tl-cli-'));
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku' });
  token = (
    await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'CLI',
      scopes: ['issues:read', 'issues:write', 'wiki:read', 'wiki:write'],
      expiresInDays: 30,
    })
  ).body.secret;
}, 60_000);

afterAll(async () => {
  await test?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('tl, the command line (TL-37)', () => {
  it('works with issues', async () => {
    const created = await tl([
      'issue',
      'create',
      '--project',
      'web',
      '--summary',
      'Login bauen',
      '--assignee',
      'me',
    ]);
    expect(created).toMatchObject({ code: 0 });
    expect(created.out).toContain('WEB-1 angelegt');
    const listed = await tl(['issue', 'list', '--mine']);
    expect(listed.out).toMatch(/WEB-1\s+Story\s+\S+.*Lena Vogt\s+Login bauen/);
    expect(
      JSON.parse((await tl(['issue', 'list', '-q', 'project = WEB', '-o', 'json'])).out).total,
    ).toBe(1);
    expect((await tl(['issue', 'comment', 'WEB-1', 'Ich', 'fange', 'an'])).code).toBe(0);
    const moved = await tl(['issue', 'move', 'WEB-1', 'in arbeit']);
    expect(moved.out).toBe('WEB-1 → In Arbeit');
    expect((await tl(['issue', 'move', 'WEB-1', 'nirgendwo'])).err).toContain('Kein Übergang');
    await tl(['issue', 'edit', 'WEB-1', '--labels', 'auth,web']);
    const view = await tl(['issue', 'view', 'WEB-1', '--comments']);
    expect(view.out).toContain('# WEB-1 Login bauen');
    expect(view.out).toContain('Stichwörter: auth, web');
    expect(view.out).toContain('Ich fange an');
    expect((await tl(['issue', 'assign', 'WEB-1', 'none'])).out).toBe('WEB-1 freigegeben.');
    expect((await tl(['issue', 'view', 'WEB-99'])).code).toBe(1);
  });

  it('pushes, gets and syncs wiki pages as Markdown', async () => {
    // The first page of a new space becomes its home page; files sync below it.
    await writeFile(join(dir, 'start.md'), '# Doku\n\n::children\n');
    expect((await tl(['page', 'push', join(dir, 'start.md'), '--space', 'DOC'])).code).toBe(0);
    const file = join(dir, 'betrieb.md');
    await writeFile(file, '# Betrieb\n\nAlles **läuft**.\n');
    const pushed = await tl(['page', 'push', file, '--space', 'DOC']);
    expect(pushed.out).toContain('„Betrieb“ veröffentlicht, Version 1');
    const marked = await readFile(file, 'utf8');
    const id = /page=([0-9a-f-]{36})/.exec(marked)?.[1] ?? '';
    await writeFile(file, marked.replace('Alles', 'Fast alles'));
    expect((await tl(['page', 'push', file])).out).toContain('Version 2');
    // An old file does not overwrite a newer version.
    await writeFile(join(dir, 'alt.md'), marked);
    expect((await tl(['page', 'push', join(dir, 'alt.md')])).err).toContain('geändert');
    expect((await tl(['page', 'get', id])).out).toContain('Fast alles **läuft**.');

    const folder = join(dir, 'docs');
    expect((await tl(['page', 'pull', 'DOC', folder])).code).toBe(0);
    const files = await readFile(join(folder, '01-betrieb.md'), 'utf8');
    expect(files).toContain('Fast alles');
    await writeFile(join(folder, '02-neu.md'), '# Neu\n\nAus dem Ordner.\n');
    expect((await tl(['page', 'push-dir', folder, '--space', 'DOC'])).out).toBe(
      '1 angelegt, 0 aktualisiert, 1 unverändert.',
    );
  });

  it('signs in through the browser and refreshes its token', async () => {
    const env = { XDG_CONFIG_HOME: join(dir, 'xdg') };
    let opened = '';
    const login = tl(['login', origin, '--profile', 'test'], env, (url) => {
      opened = url;
    });
    // Play the browser: allow access, then follow the redirect to the CLI.
    while (!opened) await new Promise((resolve) => setTimeout(resolve, 20));
    const params = new URL(opened).searchParams;
    const consent = await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
      clientId: params.get('client_id'),
      redirectUri: params.get('redirect_uri'),
      scopes: ['issues:read', 'issues:write', 'wiki:read', 'wiki:write'],
      approve: true,
      codeChallenge: params.get('code_challenge'),
      codeChallengeMethod: 'S256',
      state: params.get('state'),
    });
    await fetch(consent.body.redirect);
    expect((await login).out).toContain('Angemeldet als Lena Vogt');
    const configFile = join(dir, 'config', 'tasklore.json');
    const config = JSON.parse(await readFile(configFile, 'utf8'));
    expect(config.profiles.test.auth.type).toBe('oauth');
    // An expired access token is refreshed on the next command.
    config.profiles.test.auth.expiresAt = 0;
    await writeFile(configFile, JSON.stringify(config));
    expect((await tl(['whoami'], env)).out).toContain('Lena Vogt');
    expect(
      JSON.parse(await readFile(configFile, 'utf8')).profiles.test.auth.expiresAt,
    ).toBeGreaterThan(Date.now());
    expect((await tl(['profile', 'list'], env)).out).toMatch(/\* test\s+http/);
    expect((await tl(['logout'], env)).out).toContain('Abgemeldet');
    expect((await tl(['whoami'], env)).code).toBe(2);
  });

  it('bridges stdio to the instance’s MCP server', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const lines: string[] = [];
    stdout.on('data', (chunk: Buffer) =>
      lines.push(...chunk.toString().split('\n').filter(Boolean)),
    );
    const problems: string[] = [];
    const bridged = run(['mcp'], {
      out: () => undefined,
      err: (text) => problems.push(text),
      env: { TASKLORE_URL: origin, TASKLORE_TOKEN: token },
      configFile: join(dir, 'unused.json'),
      openUrl: () => undefined,
      stdin,
      stdout,
    });
    const send = (message: unknown) => stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    for (let waited = 0; !lines.some((line) => line.includes('"id":2')); waited += 20) {
      if (waited > 3000)
        throw new Error(`No answer: ${problems.join('; ')} | ${lines.join(' | ')}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(lines.find((line) => line.includes('"id":2'))).toContain('search_issues');
    stdin.end();
    expect(await bridged).toBe(0);
  });

  it('prints completion scripts and explains missing commands', async () => {
    expect((await tl(['completion', 'bash'])).out).toContain('complete -F _tl tl tasklore');
    expect((await tl(['admin', 'backup'])).err).toContain('TL-39');
    expect((await tl(['unbekannt'])).code).toBe(2);
  });
});
