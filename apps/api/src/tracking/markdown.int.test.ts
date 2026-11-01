import type { Comment, Issue, ProjectDetails } from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let miraId: string;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  miraId = await create('mira@example.org', 'Mira Kaya');
  await create('olaf@example.org', 'Olaf Alt');
  const sec = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'SEC',
    name: 'Sicherheit',
    template: 'basic',
  });
  // Only Mira may see SEC: the "users" group loses its role there.
  const [usersGroup] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, sec.body.id),
        eq(projectRoleMembers.groupId, usersGroup?.id ?? ''),
      ),
    );
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: sec.body.id, role: 'users', userId: miraId });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

const MARKDOWN = [
  '## Befund',
  '',
  'Bitte @mira@example.org und @olaf@example.org prüfen, siehe **Log**:',
  '',
  '- Schritt 1',
  '- Schritt 2',
].join('\n');

describe('Markdown', () => {
  it('turns Markdown into the document and back', async () => {
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'SEC',
      issueType: 'task',
      summary: 'Audit',
      description: { markdown: MARKDOWN },
    });
    expect(created.status).toBe(201);
    const stored = JSON.stringify(created.body.description);
    expect(stored).toContain(`"type":"mention","attrs":{"id":"${miraId}","label":"Mira Kaya"`);
    // Olaf cannot see SEC, so he stays text and learns nothing.
    expect(stored).toContain('@olaf@example.org prüfen');
    const markdown = await admin.request<Issue>('GET', '/issues/SEC-1?format=markdown');
    expect(markdown.body.description).toBe(
      [
        '## Befund',
        '',
        `Bitte @[Mira Kaya](user:${miraId}) und @olaf@example.org prüfen, siehe **Log**:`,
        '',
        '- Schritt 1',
        '- Schritt 2',
      ].join('\n'),
    );
  });

  it('accepts Markdown for updates and comments and answers in the asked format', async () => {
    const updated = await admin.request<Issue>('PATCH', '/issues/SEC-1?format=markdown', {
      description: { markdown: 'Neu: *kursiv*' },
    });
    expect(updated.body.description).toBe('Neu: *kursiv*');
    const comment = await admin.request<Comment>('POST', '/issues/SEC-1/comments', {
      body: { markdown: 'Erledigt, `fix` ist drin.' },
    });
    expect(JSON.stringify(comment.body.body)).toContain('"type":"code"');
    const list = await admin.request<Comment[]>('GET', '/issues/SEC-1/comments?format=markdown');
    expect(list.body.map((entry) => entry.body)).toEqual(['Erledigt, `fix` ist drin.']);
    expect((await admin.request('GET', '/issues/SEC-1?format=html')).status).toBe(400);
    expect(
      (await admin.request('POST', '/issues/SEC-1/comments', { body: { markdown: 42 } })).status,
    ).toBe(400);
    expect(
      (await admin.request('POST', '/issues/SEC-1/comments', { body: { markdown: '   ' } })).status,
    ).toBe(400);
  });
});
