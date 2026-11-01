import type { Attachment, ImportJob, Issue, Page, RichText } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';
import { ImportService } from './import.service.js';

let test: TestApp;
let admin: TestClient;
let adminId = '';
let homeId = '';
let childId = '';
let fileId = '';

async function download(path: string): Promise<Buffer> {
  const response = await fetch(`${test.baseUrl}${path}`, {
    headers: { cookie: admin.cookie ?? '' },
  });
  expect(response.status).toBe(200);
  return Buffer.from(await response.arrayBuffer());
}

async function upload(path: string, name: string, content: Buffer, type: string) {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), name);
  const response = await fetch(`${test.baseUrl}${path}`, {
    method: 'POST',
    headers: { cookie: admin.cookie ?? '' },
    body: form,
  });
  return response.json();
}

async function importArchive(zip: Buffer, targetKey: string): Promise<ImportJob[]> {
  const dry = (await upload(
    `/admin/imports/archive?targetKey=${targetKey}`,
    'archiv.zip',
    zip,
    'application/zip',
  )) as ImportJob;
  await test.app.get(ImportService).runPending();
  const checked = (await admin.request<ImportJob>('GET', `/admin/imports/${dry.id}`)).body;
  const real = (await admin.request<ImportJob>('POST', `/admin/imports/${dry.id}/run`)).body;
  await test.app.get(ImportService).runPending();
  return [checked, (await admin.request<ImportJob>('GET', `/admin/imports/${real.id}`)).body];
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
  adminId = (await admin.request<{ id: string }>('GET', '/me')).body.id;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('project archives (TL-39)', () => {
  it('exports a project and imports it under a new key', async () => {
    await admin.request('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    });
    const mention: RichText = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Für ' },
            { type: 'mention', attrs: { id: adminId, label: 'Lena Vogt' } },
          ],
        },
      ],
    };
    const story = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'story',
        summary: 'Anmeldung',
        description: mention,
        assigneeId: adminId,
      })
    ).body;
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Formular',
      parentKey: story.key,
    });
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Gelöscht',
    });
    await admin.request('DELETE', '/issues/WEB-3');
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'bug',
      summary: 'Fehler',
    });
    await admin.request('POST', '/issues/WEB-1/links', { type: 'blocks', issueKey: 'WEB-4' });
    await admin.request('POST', '/issues/WEB-1/comments', { body: docFromText('Passt') });
    await upload('/issues/WEB-1/attachments', 'notiz.txt', Buffer.from('Inhalt'), 'text/plain');

    const zip = await download('/admin/archives/projects/web');
    const [dry, real] = await importArchive(zip, 'NEU');
    expect(dry?.state).toBe('done');
    expect(dry?.report?.counts).toMatchObject({ Vorgänge: 3, Kommentare: 1, Anhänge: 1 });
    expect(dry?.report?.mappings).toContain('Projekt WEB → NEU');
    expect(real?.state).toBe('done');

    const copy = (await admin.request<Issue>('GET', '/issues/NEU-1')).body;
    expect(copy).toMatchObject({ summary: 'Anmeldung', assignee: { id: adminId } });
    expect(JSON.stringify(copy.description)).toContain(adminId);
    const subtask = (await admin.request<Issue>('GET', '/issues/NEU-2')).body;
    expect(subtask.parent?.key).toBe('NEU-1');
    expect((await admin.request('GET', '/issues/NEU-3')).status).toBe(404);
    expect((await admin.request<Issue>('GET', '/issues/NEU-4')).body.summary).toBe('Fehler');
    expect(JSON.stringify(copy)).toContain('NEU-4');
    const comments = await admin.request<{ comments: unknown[] } | unknown[]>(
      'GET',
      '/issues/NEU-1/comments',
    );
    expect(JSON.stringify(comments.body)).toContain('Passt');
    const files = (await admin.request<Attachment[]>('GET', '/issues/NEU-1/attachments')).body;
    const origin = test.baseUrl.replace(/\/api\/v1$/, '');
    const content = await fetch(`${origin}${files[0]?.url}`, {
      headers: { cookie: admin.cookie ?? '' },
    });
    expect(await content.text()).toBe('Inhalt');
    // New issues continue after the imported numbers.
    const next = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'NEU',
      issueType: 'task',
      summary: 'Danach',
    });
    expect(next.body.key).toBe('NEU-5');
  });

  it('refuses a key that is taken', async () => {
    const zip = await download('/admin/archives/projects/WEB');
    const [dry] = await importArchive(zip, 'NEU');
    expect(dry?.report?.skipped.join(' ')).toContain('NEU gibt es schon');
  });
});

describe('space archives (TL-39)', () => {
  it('exports a space and imports pages, versions, comments and files', async () => {
    await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
    homeId = (await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Start' })).body.id;
    childId = (
      await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Kind', parentId: homeId })
    ).body.id;
    const file = (await upload(
      `/pages/${childId}/attachments`,
      'bild.txt',
      Buffer.from('Bilddaten'),
      'text/plain',
    )) as { id: string };
    fileId = file.id;
    for (const text of ['Erste', 'Zweite']) {
      await admin.request('POST', `/pages/${childId}/publish`, {
        title: 'Kind',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text,
                  marks: [{ type: 'link', attrs: { href: `/spaces/DOCS/pages/${homeId}` } }],
                },
              ],
            },
          ],
        },
      });
    }
    await admin.request('POST', `/pages/${childId}/comments`, { body: docFromText('Gut') });

    const zip = await download('/admin/archives/spaces/DOCS');
    const [dry, real] = await importArchive(zip, 'KOPIE');
    expect(dry?.report?.counts).toMatchObject({ Seiten: 2, Versionen: 2, Anhänge: 1 });
    expect(real?.state).toBe('done');

    const tree = (
      await admin.request<Array<{ id: string; title: string; parentId: string | null }>>(
        'GET',
        '/spaces/KOPIE/pages',
      )
    ).body;
    const start = tree.find((page) => page.title === 'Start');
    const child = tree.find((page) => page.title === 'Kind');
    expect(child?.parentId).toBe(start?.id);
    expect(child?.id).not.toBe(childId);
    const page = (await admin.request<Page & { content: RichText }>('GET', `/pages/${child?.id}`))
      .body;
    expect(page.version).toBe(2);
    expect(JSON.stringify(page)).toContain(`/spaces/KOPIE/pages/${start?.id}`);
    const attachments = (
      await admin.request<Attachment[]>('GET', `/pages/${child?.id}/attachments`)
    ).body;
    expect(attachments.map((entry) => entry.fileName)).toEqual(['bild.txt']);
    expect(attachments[0]?.id).not.toBe(fileId);
    const comments = await admin.request('GET', `/pages/${child?.id}/comments`);
    expect(JSON.stringify(comments.body)).toContain('Gut');
  });
});
