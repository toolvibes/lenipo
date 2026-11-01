import { markdownToDoc } from '@toolvibes/editor';
import type { Attachment, Page, Space } from '@toolvibes/shared';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let parent: Page;
let child: Page;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function download(client: TestClient, method: string, path: string, body?: unknown) {
  const response = await fetch(`${test.baseUrl}${path}`, {
    method,
    headers: {
      ...(client.cookie ? { cookie: client.cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    type: response.headers.get('content-type') ?? '',
    disposition: response.headers.get('content-disposition') ?? '',
    data: new Uint8Array(await response.arrayBuffer()),
  };
}

const text = (data: Uint8Array) => new TextDecoder().decode(data);

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'mira@example.org',
    displayName: 'Mira Kaya',
    password: 'ein-langes-passwort',
  });
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Login bauen',
  });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: '=HYPERLINK("böse")',
  });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku' });

  parent = (await admin.request<Page>('POST', '/spaces/DOC/pages', { title: 'Betrieb' })).body;
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'plan.png');
  const image = (await (
    await fetch(`${test.baseUrl}/pages/${parent.id}/attachments`, {
      method: 'POST',
      headers: { cookie: admin.cookie ?? '' },
      body: form,
    })
  ).json()) as Attachment;
  await admin.request('POST', `/pages/${parent.id}/publish`, {
    title: 'Betrieb',
    content: markdownToDoc(
      [
        '## Ziel',
        '',
        'Läuft **stabil**.',
        '',
        `![Plan](attachment:${image.id} "Übersicht")`,
        '',
        '::issues{query="project = WEB ORDER BY key" limit=10}',
      ].join('\n'),
    ),
  });
  child = (
    await admin.request<Page>('POST', '/spaces/DOC/pages', { title: 'Backup', parentId: parent.id })
  ).body;
  await admin.request('POST', `/pages/${child.id}/publish`, {
    title: 'Backup',
    content: markdownToDoc(`Siehe [Betrieb](/spaces/DOC/pages/${parent.id}#ziel).`),
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('page and space exports (W-EXP-01..03)', () => {
  it('writes one self-contained HTML file, with child pages on request', async () => {
    const single = await download(admin, 'GET', `/pages/${parent.id}/export/html`);
    expect(single.status).toBe(200);
    expect(single.disposition).toContain('betrieb.html');
    const html = text(single.data);
    expect(html).toContain('<h1>Betrieb</h1>');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('<td>Login bauen</td>');
    expect(html).not.toContain('Backup');

    const withChildren = text(
      (await download(admin, 'GET', `/pages/${parent.id}/export/html?children=true`)).data,
    );
    expect(withChildren).toContain('<h1>Backup</h1>');
    // Links between exported pages stay inside the file.
    expect(withChildren).toContain(`href="#page-${parent.id}"`);
  });

  it('zips Markdown with the attachments and relative links', async () => {
    const zip = await download(admin, 'GET', `/pages/${parent.id}/export/markdown?children=true`);
    expect(zip.type).toBe('application/zip');
    const files = unzipSync(zip.data);
    expect(Object.keys(files).sort()).toEqual([
      'attachments/plan.png',
      'betrieb.md',
      'betrieb/01-backup.md',
    ]);
    expect(strFromU8(files['betrieb.md'] as Uint8Array)).toContain(
      '![Plan](attachments/plan.png "Übersicht")',
    );
    expect(strFromU8(files['betrieb/01-backup.md'] as Uint8Array)).toContain(
      '[Betrieb](../betrieb.md#ziel)',
    );
    expect(Buffer.from(files['attachments/plan.png'] as Uint8Array).equals(PNG)).toBe(true);
  });

  it('builds a Word document', async () => {
    const docx = await download(
      admin,
      'GET',
      `/pages/${parent.id}/export/docx?children=true&locale=en`,
    );
    expect(docx.status).toBe(200);
    const files = unzipSync(docx.data);
    const body = strFromU8(files['word/document.xml'] as Uint8Array);
    expect(body).toContain('Betrieb');
    expect(body).toContain('Login bauen');
    expect(body).toContain('Contents');
    expect(Object.keys(files).some((name) => name.startsWith('word/media/'))).toBe(true);
  });

  it('exports a whole space as HTML files', async () => {
    const zip = await download(admin, 'GET', '/spaces/DOC/export/html');
    const files = unzipSync(zip.data);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['index.html', 'attachments/plan.png']),
    );
    const index = strFromU8(files['index.html'] as Uint8Array);
    expect(index).toContain('Betrieb');
  });

  it('keeps drafts and pages of other spaces to those who may read them', async () => {
    const draft = (await admin.request<Page>('POST', '/spaces/DOC/pages', { title: 'Entwurf' }))
      .body;
    expect((await download(admin, 'GET', `/pages/${draft.id}/export/html`)).status).toBe(400);
    // The personal space of the admin is private.
    const secret = (await admin.request<Space>('POST', '/me/space')).body;
    expect((await download(mira, 'GET', `/pages/${secret.homePageId}/export/docx`)).status).toBe(
      404,
    );
    expect((await download(admin, 'GET', `/pages/${parent.id}/export/pdf`)).status).toBe(404);
  });
});

describe('search result exports (T-QRY-09)', () => {
  const request = (format: string) => ({
    query: 'project = WEB ORDER BY key',
    format,
    columns: ['status', 'created'],
    headings: ['Schlüssel', 'Zusammenfassung', 'Status', 'Erstellt'],
  });

  it('writes CSV for spreadsheets, safe against formulas', async () => {
    const csv = text((await download(admin, 'POST', '/search/export', request('csv'))).data);
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('"Schlüssel";"Zusammenfassung";"Status";"Erstellt"');
    expect(lines[1]).toMatch(/^"WEB-1";"Login bauen";"[^"]+";"\d{4}-\d{2}-\d{2}T/);
    expect(lines[2]).toContain(`"'=HYPERLINK(""böse"")"`);
  });

  it('writes an Excel workbook and JSON', async () => {
    const xlsx = unzipSync((await download(admin, 'POST', '/search/export', request('xlsx'))).data);
    const sheet = strFromU8(xlsx['xl/worksheets/sheet1.xml'] as Uint8Array);
    expect(sheet).toContain('Login bauen');
    expect(sheet).toMatch(/<c r="D2" s="3"><v>\d+\.\d+<\/v><\/c>/);
    const json = JSON.parse(
      text((await download(admin, 'POST', '/search/export', request('json'))).data),
    );
    expect(json.issues.map((issue: { key: string }) => issue.key)).toEqual(['WEB-1', 'WEB-2']);
    expect(json.issues[0]).not.toHaveProperty('canEdit');
  });
});
