import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Attachment, ChangeGroup, CreatedToken, TrackingMeta } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FILE_STORE } from '../core/tokens.js';
import { SetupService } from '../identity/setup.service.js';
import { FileNotFoundError, type FileStore } from '../storage/file-store.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

interface Setup {
  test: TestApp;
  admin: TestClient;
  member: TestClient;
  outsider: TestClient;
}

async function setUp(env: Record<string, string> = {}): Promise<Setup> {
  const test = await startTestApp(env);
  const admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'jonas@example.org',
    displayName: 'Jonas Schulz',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/admin/groups', { name: 'externe', description: '' });
  const outsiderUser = await admin.request<{ id: string }>('POST', '/admin/users', {
    email: 'gast@example.org',
    displayName: 'Gast',
    password: 'ein-langes-passwort',
    groups: ['externe'],
  });
  await admin.request('DELETE', `/admin/groups/users/members/${outsiderUser.body.id}`);
  const signIn = async (email: string) => {
    const client = new TestClient(test.baseUrl);
    await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
    return client;
  };
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Mit Anhängen',
  });
  return {
    test,
    admin,
    member: await signIn('jonas@example.org'),
    outsider: await signIn('gast@example.org'),
  };
}

async function upload(
  setup: Setup,
  client: TestClient,
  name: string,
  type: string,
  content: Buffer | string,
  headers: Record<string, string> = {},
) {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), name);
  const response = await fetch(`${setup.test.baseUrl}/issues/WEB-1/attachments`, {
    method: 'POST',
    headers: { ...(client.cookie ? { cookie: client.cookie } : {}), ...headers },
    body: form,
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as Attachment };
}

async function download(setup: Setup, client: TestClient, attachment: Attachment, query = '') {
  // The url is root-relative (/api/v1/…); baseUrl already ends in /api/v1.
  const origin = setup.test.baseUrl.replace(/\/api\/v1$/, '');
  return fetch(`${origin}${attachment.url}${query}`, {
    headers: client.cookie ? { cookie: client.cookie } : {},
  });
}

describe('attachments on local storage', () => {
  let setup: Setup;
  let image: Attachment;
  let text: Attachment;

  beforeAll(async () => {
    setup = await setUp({ ATTACHMENT_MAX_MB: '0.01' });
  }, 60_000);

  afterAll(async () => {
    await setup?.test.close();
  });

  it('reports the size limit', async () => {
    const meta = await setup.member.request<TrackingMeta>('GET', '/tracking/meta');
    expect(meta.body.attachmentMaxBytes).toBe(Math.floor(0.01 * 1024 * 1024));
  });

  it('accepts files from everyone who may comment', async () => {
    const png = await upload(setup, setup.member, 'Screenshot 1.png', 'image/png', PNG);
    expect(png.status).toBe(201);
    image = png.body;
    expect(image).toMatchObject({
      fileName: 'Screenshot 1.png',
      contentType: 'image/png',
      size: PNG.length,
      image: true,
      author: { displayName: 'Jonas Schulz' },
      canDelete: true,
    });

    const notes = await upload(
      setup,
      setup.admin,
      '../../etc/notizen.html',
      'text/html',
      '<script>x</script>',
    );
    expect(notes.status).toBe(201);
    text = notes.body;
    expect(text).toMatchObject({
      fileName: 'notizen.html',
      contentType: 'text/html',
      image: false,
    });

    // An SVG that claims to be a PNG is no image.
    const fake = await upload(
      setup,
      setup.admin,
      'logo.png',
      'image/png',
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    expect(fake.body.image).toBe(false);

    const list = await setup.member.request<Attachment[]>('GET', '/issues/WEB-1/attachments');
    expect(list.body.map((entry) => [entry.fileName, entry.canDelete])).toEqual([
      ['Screenshot 1.png', true],
      ['notizen.html', false],
      ['logo.png', false],
    ]);
    const history = await setup.admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    expect(history.body.flatMap((group) => group.items)).toContainEqual({
      field: 'attachment',
      from: null,
      to: 'Screenshot 1.png',
    });
  });

  it('shows only verified images inline, with protective headers', async () => {
    const inline = await download(setup, setup.member, image);
    expect(inline.status).toBe(200);
    expect(inline.headers.get('content-type')).toBe('image/png');
    expect(inline.headers.get('content-disposition')).toMatch(
      /^inline; filename="Screenshot 1.png"/,
    );
    expect(inline.headers.get('x-content-type-options')).toBe('nosniff');
    expect(inline.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await inline.arrayBuffer()).equals(PNG)).toBe(true);

    const forced = await download(setup, setup.member, image, '?download=1');
    expect(forced.headers.get('content-disposition')).toMatch(/^attachment;/);

    const html = await download(setup, setup.member, text);
    expect(html.headers.get('content-type')).toBe('application/octet-stream');
    expect(html.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(await html.text()).toBe('<script>x</script>');
  });

  it('refuses too large, empty and malformed uploads', async () => {
    const before = await readdir(join(setup.test.config.STORAGE_LOCAL_DIR, 'attachments'));
    const large = await upload(
      setup,
      setup.member,
      'gross.bin',
      'application/octet-stream',
      Buffer.alloc(20_000, 1),
    );
    expect(large.status).toBe(413);
    const empty = await upload(setup, setup.member, 'leer.txt', 'text/plain', '');
    expect(empty.status).toBe(400);
    const json = await setup.member.request('POST', '/issues/WEB-1/attachments', { file: 'x' });
    expect(json.status).toBe(400);
    expect(await readdir(join(setup.test.config.STORAGE_LOCAL_DIR, 'attachments'))).toEqual(before);
  });

  it('hides attachments of issues one cannot see and needs a write scope for tokens', async () => {
    expect((await setup.outsider.request('GET', '/issues/WEB-1/attachments')).status).toBe(404);
    expect((await download(setup, setup.outsider, image)).status).toBe(404);
    expect((await upload(setup, setup.outsider, 'a.txt', 'text/plain', 'a')).status).toBe(404);

    const token = await setup.member.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Lesen',
      scopes: ['issues:read'],
      expiresInDays: 1,
    });
    const reader = new TestClient(setup.test.baseUrl);
    const denied = await upload(setup, reader, 'a.txt', 'text/plain', 'a', {
      authorization: `Bearer ${token.body.secret}`,
    });
    expect(denied.status).toBe(403);
  });

  it('lets uploaders and project administrators delete, removing the stored file', async () => {
    expect(
      (await setup.member.request('DELETE', `/issues/WEB-1/attachments/${text.id}`)).status,
    ).toBe(403);
    expect(
      (await setup.admin.request('DELETE', `/issues/WEB-1/attachments/${image.id}`)).status,
    ).toBe(204);
    expect((await download(setup, setup.member, image)).status).toBe(404);
    const stored = await readdir(join(setup.test.config.STORAGE_LOCAL_DIR, 'attachments'));
    expect(stored).not.toContain(image.id);
    expect(stored).toContain(text.id);
    const history = await setup.admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    expect(history.body[0]?.items).toEqual([
      { field: 'attachment', from: 'Screenshot 1.png', to: null },
    ]);
  });
});

/** Runs against a real S3-compatible server (RustFS in docker-compose and CI) when configured. */
describe.runIf(process.env.TEST_S3_ENDPOINT)('attachments on S3 storage', () => {
  let setup: Setup;

  beforeAll(async () => {
    setup = await setUp({
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? '',
      S3_BUCKET: `tasklore-test-${Date.now()}`,
      S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID ?? 'tasklore',
      S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY ?? 'tasklore-dev-secret',
    });
  }, 60_000);

  afterAll(async () => {
    await setup?.test.close();
  });

  it('stores, serves and deletes files in the bucket', async () => {
    const created = await upload(setup, setup.member, 'Bild.png', 'image/png', PNG);
    expect(created.status).toBe(201);
    const served = await download(setup, setup.member, created.body);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(PNG)).toBe(true);

    const removed = await setup.member.request(
      'DELETE',
      `/issues/WEB-1/attachments/${created.body.id}`,
    );
    expect(removed.status).toBe(204);
    expect((await download(setup, setup.member, created.body)).status).toBe(404);
    const store = setup.test.app.get<FileStore>(FILE_STORE);
    await expect(store.get(`attachments/${created.body.id}`)).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
  });
});
