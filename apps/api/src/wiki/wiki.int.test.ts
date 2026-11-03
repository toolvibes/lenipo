import type {
  Attachment,
  Favourite,
  LabelCount,
  LabelledPage,
  Page,
  PageComment,
  PageDiff,
  PageTreeEntry,
  PageVersion,
  PageVersionSummary,
  RecentItem,
  Space,
  SpaceMember,
  SpaceSummary,
  TrashedPage,
} from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, projectRoleMembers, projects, spaces as spacesTable } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let miraId: string;
let olafId: string;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

const doc = (text: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ziel' }] },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ],
});

async function tree(client: TestClient): Promise<string[]> {
  const response = await client.request<PageTreeEntry[]>('GET', '/spaces/DOCS/pages');
  return response.body.map((entry) => entry.title);
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
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  miraId = await create('mira@example.org', 'Mira Kaya');
  olafId = await create('olaf@example.org', 'Olaf Alt');
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('spaces', () => {
  it('needs create-spaces to create one; the creator administers it', async () => {
    expect(
      (await mira.request('POST', '/spaces', { key: 'MIRA', name: 'Miras Bereich' })).status,
    ).toBe(403);
    const created = await admin.request<Space>('POST', '/spaces', {
      key: 'DOCS',
      name: 'Dokumentation',
      description: 'Wie wir arbeiten',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ key: 'DOCS', homePageId: null });
    expect(created.body.permissions).toEqual(['administer', 'approve', 'comment', 'edit', 'view']);
    expect((await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doppelt' })).status).toBe(
      409,
    );
  });

  it('lets all signed-in users edit by default', async () => {
    const space = await olaf.request<Space>('GET', '/spaces/docs');
    expect(space.body.permissions).toEqual(['comment', 'edit', 'view']);
    const list = await olaf.request<SpaceSummary[]>('GET', '/spaces');
    expect(list.body.map((entry) => entry.key)).toEqual(['DOCS']);
  });

  it('manages role assignments; the last administrator stays', async () => {
    const members = await admin.request<SpaceMember[]>('GET', '/spaces/DOCS/members');
    const everyone = members.body.find((member) => member.group?.name === 'users');
    const lena = members.body.find((member) => member.role === 'administrators');
    expect(everyone?.role).toBe('editors');
    // From now on: Mira edits, Olaf only reads.
    await admin.request('DELETE', `/spaces/DOCS/members/${everyone?.id}`);
    await admin.request('POST', '/spaces/DOCS/members', { role: 'editors', userId: miraId });
    const after = await admin.request<SpaceMember[]>('POST', '/spaces/DOCS/members', {
      role: 'viewers',
      userId: olafId,
    });
    expect(after.status).toBe(201);
    expect(after.body.map((member) => member.role).sort()).toEqual([
      'administrators',
      'editors',
      'viewers',
    ]);
    expect(
      (await admin.request('POST', '/spaces/DOCS/members', { role: 'viewers', userId: olafId }))
        .status,
    ).toBe(409);
    expect((await admin.request('DELETE', `/spaces/DOCS/members/${lena?.id}`)).status).toBe(409);
    expect((await mira.request('GET', '/spaces/DOCS/members')).status).toBe(403);
    expect((await olaf.request<Space>('GET', '/spaces/DOCS')).body.permissions).toEqual(['view']);
  });
});

describe('pages', () => {
  let home: Page;
  let child: Page;

  it('creates drafts that only editors see; the first page becomes home', async () => {
    const created = await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Start' });
    expect(created.status).toBe(201);
    home = created.body;
    expect(home).toMatchObject({ title: 'Start', version: 0, content: null, canEdit: true });
    expect((await mira.request<Space>('GET', '/spaces/DOCS')).body.homePageId).toBe(home.id);

    expect(await tree(mira)).toEqual(['Start']);
    expect(await tree(olaf)).toEqual([]);
    expect((await olaf.request('GET', `/pages/${home.id}`)).status).toBe(404);
    expect((await olaf.request('POST', '/spaces/DOCS/pages', { title: 'Nein' })).status).toBe(403);
  });

  it('publishes versions that readers see', async () => {
    expect(
      (
        await mira.request('POST', `/pages/${home.id}/publish`, {
          title: 'Start',
          content: { type: 'doc', content: [{ type: 'script' }] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await olaf.request('POST', `/pages/${home.id}/publish`, {
          title: 'Start',
          content: doc('x'),
        })
      ).status,
    ).toBe(404);

    const first = await mira.request<Page>('POST', `/pages/${home.id}/publish`, {
      title: 'Willkommen',
      content: doc('Erste Fassung'),
      comment: 'Angelegt',
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ title: 'Willkommen', version: 1 });
    await mira.request('POST', `/pages/${home.id}/publish`, {
      title: 'Willkommen',
      content: doc('Zweite Fassung'),
    });

    const seen = await olaf.request<Page>('GET', `/pages/${home.id}`);
    expect(seen.body).toMatchObject({
      version: 2,
      canEdit: false,
      publishedBy: { displayName: 'Mira Kaya' },
    });
    expect(JSON.stringify(seen.body.content)).toContain('Zweite Fassung');
    const markdown = await olaf.request<Page>('GET', `/pages/${home.id}?format=markdown`);
    expect(markdown.body.content).toBe('## Ziel\n\nZweite Fassung');
    expect(
      (
        await olaf.request('POST', `/pages/${home.id}/publish`, {
          title: 'x',
          content: doc('x'),
        })
      ).status,
    ).toBe(403);

    const versions = await olaf.request<PageVersionSummary[]>('GET', `/pages/${home.id}/versions`);
    expect(versions.body.map((entry) => [entry.number, entry.comment])).toEqual([
      [2, ''],
      [1, 'Angelegt'],
    ]);
    const old = await olaf.request<PageVersion>('GET', `/pages/${home.id}/versions/1`);
    expect(JSON.stringify(old.body.content)).toContain('Erste Fassung');
    expect((await olaf.request('GET', `/pages/${home.id}/versions/9`)).status).toBe(404);
  });

  it('nests pages, shows breadcrumbs and hides drafts below published pages', async () => {
    child = (
      await mira.request<Page>('POST', '/spaces/DOCS/pages', {
        title: 'Einrichtung',
        parentId: home.id,
      })
    ).body;
    const grandchild = (
      await mira.request<Page>('POST', '/spaces/DOCS/pages', {
        title: 'Datenbank',
        parentId: child.id,
      })
    ).body;
    expect(grandchild.ancestors.map((entry) => entry.title)).toEqual(['Willkommen', 'Einrichtung']);
    await mira.request('POST', `/pages/${grandchild.id}/publish`, {
      title: 'Datenbank',
      content: doc('Postgres'),
    });
    expect(await tree(mira)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
    // The published grandchild stays hidden while its parent is a draft.
    expect(await tree(olaf)).toEqual(['Willkommen']);
    await mira.request('POST', `/pages/${child.id}/publish`, {
      title: 'Einrichtung',
      content: doc('Schritte'),
    });
    expect(await tree(olaf)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
  });

  it('moves and renames pages, never below themselves', async () => {
    expect(
      (await mira.request('POST', `/pages/${home.id}/move`, { parentId: child.id })).status,
    ).toBe(400);
    const moved = await mira.request<Page>('POST', `/pages/${child.id}/move`, {
      parentId: null,
      beforeId: home.id,
    });
    expect(moved.body.ancestors).toEqual([]);
    expect(await tree(mira)).toEqual(['Einrichtung', 'Datenbank', 'Willkommen']);
    await mira.request('POST', `/pages/${child.id}/move`, { parentId: null });
    expect(await tree(mira)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
    const renamed = await mira.request<Page>('PATCH', `/pages/${child.id}`, { title: 'Setup' });
    expect(renamed.body.title).toBe('Setup');
  });

  it('moves pages with their subtree to the trash and back', async () => {
    expect((await mira.request('DELETE', `/pages/${child.id}`)).status).toBe(204);
    expect(await tree(mira)).toEqual(['Willkommen']);
    expect((await olaf.request('GET', `/pages/${child.id}`)).status).toBe(404);
    expect((await olaf.request('GET', '/spaces/DOCS/trash')).status).toBe(403);
    const trash = await mira.request<TrashedPage[]>('GET', '/spaces/DOCS/trash');
    expect(trash.body.map((entry) => [entry.title, entry.deletedBy?.displayName])).toEqual([
      ['Setup', 'Mira Kaya'],
    ]);
    const restored = await mira.request<Page>('POST', `/pages/${child.id}/restore`);
    expect(restored.status).toBe(200);
    expect(await tree(mira)).toEqual(['Willkommen', 'Setup', 'Datenbank']);
    expect((await mira.request<TrashedPage[]>('GET', '/spaces/DOCS/trash')).body).toEqual([]);
  });

  it('forgets the home page when it goes to the trash', async () => {
    await mira.request('DELETE', `/pages/${home.id}`);
    expect((await mira.request<Space>('GET', '/spaces/DOCS')).body.homePageId).toBeNull();
    await mira.request('POST', `/pages/${home.id}/restore`);
    const set = await admin.request<Space>('PATCH', '/spaces/DOCS', { homePageId: home.id });
    expect(set.body.homePageId).toBe(home.id);
    expect((await mira.request('PATCH', '/spaces/DOCS', { name: 'Neu' })).status).toBe(403);
  });
});

describe('project link (E-60)', () => {
  it('needs administer on both sides to link a space with a project', async () => {
    await admin.request('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'basic',
    });
    await admin.request('POST', '/spaces/DOCS/members', { role: 'administrators', userId: miraId });
    // Mira administers the space but only works in the project.
    expect((await mira.request('PATCH', '/spaces/DOCS', { projectKey: 'WEB' })).status).toBe(403);
    expect((await admin.request('PATCH', '/spaces/DOCS', { projectKey: 'NOPE' })).status).toBe(404);
    const linked = await admin.request<Space>('PATCH', '/spaces/DOCS', { projectKey: 'web' });
    expect(linked.body.project).toEqual({ key: 'WEB', name: 'Web-Relaunch' });
    expect((await mira.request('PATCH', '/spaces/DOCS', { projectKey: null })).status).toBe(403);
    const spaces = await olaf.request<SpaceSummary[]>('GET', '/projects/WEB/spaces');
    expect(spaces.body.map((space) => space.key)).toEqual(['DOCS']);
  });

  it('links a project right when creating a space (TL-83)', async () => {
    const refused = await mira.request('POST', '/spaces', {
      key: 'WEBDOC',
      name: 'Web-Doku',
      projectKey: 'WEB',
    });
    expect(refused.status).toBe(403);
    const created = await admin.request<Space>('POST', '/spaces', {
      key: 'WEBDOC',
      name: 'Web-Doku',
      projectKey: 'WEB',
    });
    expect(created.status).toBe(201);
    expect(created.body.project).toEqual({ key: 'WEB', name: 'Web-Relaunch' });
    const general = await admin.request<Space>('POST', '/spaces', {
      key: 'ALLG',
      name: 'Allgemein',
    });
    expect(general.body.project).toBeNull();
    // Both spaces go again, so later tests see the same spaces as before.
    for (const key of ['WEBDOC', 'ALLG']) {
      await test.database.db.delete(spacesTable).where(eq(spacesTable.key, key));
    }
  });

  it('shows the link only to those who may see the other side', async () => {
    const [web] = await test.database.db.select().from(projects).where(eq(projects.key, 'WEB'));
    const [everyone] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
    await test.database.db
      .delete(projectRoleMembers)
      .where(
        and(
          eq(projectRoleMembers.projectId, web?.id ?? ''),
          eq(projectRoleMembers.groupId, everyone?.id ?? ''),
        ),
      );
    expect((await olaf.request<Space>('GET', '/spaces/DOCS')).body.project).toBeNull();
    expect((await olaf.request('GET', '/projects/WEB/spaces')).status).toBe(404);
    expect((await admin.request<Space>('GET', '/spaces/DOCS')).body.project?.key).toBe('WEB');
  });
});

describe('favourites and recently viewed (E-60)', () => {
  it('stars spaces and pages the caller can see', async () => {
    const space = await olaf.request<Space>('GET', '/spaces/DOCS');
    const home = space.body.homePageId as string;
    const draft = await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Geheim' });
    expect((await olaf.request('PUT', '/me/favourites/space/docs')).status).toBe(204);
    expect((await olaf.request('PUT', `/me/favourites/page/${home}`)).status).toBe(204);
    expect((await olaf.request('PUT', `/me/favourites/page/${draft.body.id}`)).status).toBe(404);
    expect((await olaf.request('PUT', '/me/favourites/page/kein-uuid')).status).toBe(404);

    const favourites = await olaf.request<Favourite[]>('GET', '/me/favourites');
    expect(favourites.body).toEqual([
      expect.objectContaining({ kind: 'space', ref: 'DOCS', name: 'Dokumentation' }),
      expect.objectContaining({ kind: 'page', ref: home, spaceKey: 'DOCS' }),
    ]);
    expect((await olaf.request<Space>('GET', '/spaces/DOCS')).body.favourite).toBe(true);
    expect((await olaf.request<Page>('GET', `/pages/${home}`)).body.favourite).toBe(true);
    expect((await mira.request<Page>('GET', `/pages/${home}`)).body.favourite).toBe(false);

    // Mira may star her draft; it disappears from her list once it is in the trash.
    await mira.request('PUT', `/me/favourites/page/${draft.body.id}`);
    const before = await mira.request<Favourite[]>('GET', '/me/favourites');
    expect(before.body.map((favourite) => favourite.name)).toEqual(['Geheim']);
    await mira.request('DELETE', `/pages/${draft.body.id}`);
    expect((await mira.request<Favourite[]>('GET', '/me/favourites')).body).toEqual([]);
  });

  it('remembers opened spaces and pages, newest first', async () => {
    const home = (await olaf.request<Space>('GET', '/spaces/DOCS')).body.homePageId as string;
    expect((await olaf.request('POST', '/me/recent', { kind: 'space', ref: 'DOCS' })).status).toBe(
      204,
    );
    await olaf.request('POST', '/me/recent', { kind: 'page', ref: home });
    const recent = await olaf.request<RecentItem[]>('GET', '/me/recent');
    expect(recent.body.map((item) => [item.kind, item.ref, item.spaceKey])).toEqual([
      ['page', home, 'DOCS'],
      ['space', 'DOCS', undefined],
    ]);
  });
});

describe('page attachments and images (E-61)', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  let page: Page;
  let draft: Page;
  let image: Attachment;

  async function upload(client: TestClient, pageId: string, name: string, content: Buffer) {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'image/png' }), name);
    const response = await fetch(`${test.baseUrl}/pages/${pageId}/attachments`, {
      method: 'POST',
      headers: client.cookie ? { cookie: client.cookie } : {},
      body: form,
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as Attachment };
  }

  const fetchContent = (client: TestClient, attachment: Attachment) =>
    fetch(`${test.baseUrl}/page-attachments/${attachment.id}/content`, {
      headers: client.cookie ? { cookie: client.cookie } : {},
    });

  const withImage = (attachmentId: string) => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Überblick' }] },
      {
        type: 'image',
        attrs: { attachmentId, alt: 'Diagramm', width: 50, align: 'left', caption: 'Bild 1' },
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'erledigt' }] }],
          },
        ],
      },
    ],
  });

  it('lets editors attach files that everyone who sees the page can load', async () => {
    page = (await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Architektur' })).body;
    draft = (await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Skizze' })).body;
    const uploaded = await upload(mira, page.id, 'diagramm.png', PNG);
    expect(uploaded.status).toBe(201);
    image = uploaded.body;
    expect(image).toMatchObject({ fileName: 'diagramm.png', image: true, canDelete: true });
    await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Architektur',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    expect((await upload(olaf, page.id, 'nein.png', PNG)).status).toBe(403);
    const listed = await olaf.request<Attachment[]>('GET', `/pages/${page.id}/attachments`);
    expect(listed.body.map((entry) => [entry.fileName, entry.canDelete])).toEqual([
      ['diagramm.png', false],
    ]);
    const content = await fetchContent(olaf, image);
    expect(content.status).toBe(200);
    expect(content.headers.get('content-type')).toBe('image/png');
    expect(content.headers.get('content-security-policy')).toContain('sandbox');

    // Files of a draft stay hidden like the draft itself.
    const hidden = (await upload(mira, draft.id, 'skizze.png', PNG)).body;
    expect((await fetchContent(olaf, hidden)).status).toBe(404);
    expect((await fetchContent(mira, hidden)).status).toBe(200);
  });

  it('publishes only images that are attachments of the page', async () => {
    const other = (await mira.request<Attachment[]>('GET', `/pages/${draft.id}/attachments`)).body;
    const foreign = await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Architektur',
      content: withImage(other[0]?.id ?? ''),
    });
    expect(foreign.status).toBe(400);
    const published = await mira.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Architektur',
      content: withImage(image.id),
    });
    expect(published.status).toBe(200);
    const markdown = await olaf.request<Page>('GET', `/pages/${page.id}?format=markdown`);
    expect(markdown.body.content).toBe(
      `Überblick\n\n![Diagramm](attachment:${image.id} "Bild 1")\n\n- [x] erledigt`,
    );
  });

  it('lets the uploader or the space administration delete', async () => {
    expect((await olaf.request('DELETE', `/pages/${page.id}/attachments/${image.id}`)).status).toBe(
      403,
    );
    const second = (await upload(mira, page.id, 'zwei.png', PNG)).body;
    expect(
      (await admin.request('DELETE', `/pages/${page.id}/attachments/${second.id}`)).status,
    ).toBe(204);
    expect((await mira.request('DELETE', `/pages/${page.id}/attachments/${image.id}`)).status).toBe(
      204,
    );
    expect((await fetchContent(mira, image)).status).toBe(404);
    expect((await mira.request<Attachment[]>('GET', `/pages/${page.id}/attachments`)).body).toEqual(
      [],
    );
  });
});

describe('version diff and restore (E-62)', () => {
  let page: Page;
  const text = (...paragraphs: string[]) => ({
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    })),
  });

  it('compares two versions block by block', async () => {
    page = (await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Ablauf' })).body;
    await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Ablauf',
      content: text('Der Sprint dauert zwei Wochen.', 'Planung am Montag.'),
    });
    await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Ablauf (neu)',
      content: text('Der Sprint dauert drei Wochen.', 'Review am Freitag.'),
      comment: 'Kürzer geplant',
    });
    const diff = await olaf.request<PageDiff>('GET', `/pages/${page.id}/diff?from=1&to=2`);
    expect(diff.status).toBe(200);
    expect(diff.body.to).toMatchObject({ number: 2, comment: 'Kürzer geplant' });
    expect(diff.body.blocks.map((block) => block.op)).toEqual(['changed', 'removed', 'added']);
    const first = diff.body.blocks[0];
    expect(first?.op === 'changed' && first.words).toEqual([
      { op: 'same', text: 'Der Sprint dauert ' },
      { op: 'removed', text: 'zwei ' },
      { op: 'added', text: 'drei ' },
      { op: 'same', text: 'Wochen.' },
    ]);
    expect((await olaf.request('GET', `/pages/${page.id}/diff?from=1&to=9`)).status).toBe(404);
  });

  it('restores an older version as a new one', async () => {
    expect((await olaf.request('POST', `/pages/${page.id}/versions/1/restore`, {})).status).toBe(
      403,
    );
    expect((await mira.request('POST', `/pages/${page.id}/versions/2/restore`, {})).status).toBe(
      409,
    );
    const restored = await mira.request<Page>('POST', `/pages/${page.id}/versions/1/restore`, {
      comment: 'Zwei Wochen bleiben',
    });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ version: 3, title: 'Ablauf' });
    expect(restored.body.content).toEqual(
      text('Der Sprint dauert zwei Wochen.', 'Planung am Montag.'),
    );
    const versions = await olaf.request<PageVersionSummary[]>('GET', `/pages/${page.id}/versions`);
    expect(versions.body.map((version) => [version.number, version.restoredFrom])).toEqual([
      [3, 1],
      [2, null],
      [1, null],
    ]);
    expect(versions.body[0]?.comment).toBe('Zwei Wochen bleiben');
  });
});

describe('page and inline comments (E-63)', () => {
  let page: Page;
  let thread: PageComment;
  let inline: PageComment;
  const publish = (...paragraphs: string[]) =>
    mira.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Regeln',
      content: {
        type: 'doc',
        content: paragraphs.map((text) => ({
          type: 'paragraph',
          content: [{ type: 'text', text }],
        })),
      },
    });
  const comments = async (client: TestClient = mira) =>
    (await client.request<PageComment[]>('GET', `/pages/${page.id}/comments`)).body;

  it('lets commenters write threads of one level', async () => {
    page = (await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Regeln' })).body;
    await publish('Der Sprint dauert zwei Wochen.', 'Planung ist am Montag.');
    expect(
      (await olaf.request('POST', `/pages/${page.id}/comments`, { body: { markdown: 'Hm' } }))
        .status,
    ).toBe(403);
    await admin.request('POST', '/spaces/DOCS/members', { role: 'commenters', userId: olafId });
    expect((await olaf.request<Page>('GET', `/pages/${page.id}`)).body.canComment).toBe(true);

    const created = await olaf.request<PageComment>('POST', `/pages/${page.id}/comments`, {
      body: { markdown: 'Frage an @mira@example.org: gilt das auch im Dezember?' },
    });
    expect(created.status).toBe(201);
    thread = created.body;
    expect(JSON.stringify(thread.body)).toContain(miraId);
    const reply = await mira.request<PageComment>('POST', `/pages/${page.id}/comments`, {
      body: { markdown: 'Ja.' },
      parentId: thread.id,
    });
    expect(reply.body).toMatchObject({ parentId: thread.id, anchor: null });
    expect(
      (
        await olaf.request('POST', `/pages/${page.id}/comments`, {
          body: { markdown: 'Tiefer geht es nicht' },
          parentId: reply.body.id,
        })
      ).status,
    ).toBe(400);
    const people = await olaf.request<Array<{ displayName: string }>>(
      'GET',
      '/spaces/DOCS/users?query=mi',
    );
    expect(people.body.map((person) => person.displayName)).toContain('Mira Kaya');
  });

  it('anchors inline threads on the published text and resolves them', async () => {
    const missing = await olaf.request('POST', `/pages/${page.id}/comments`, {
      body: { markdown: 'Wo?' },
      anchor: { exact: 'drei Wochen', prefix: '', suffix: '', block: 0 },
    });
    expect(missing.status).toBe(400);
    const created = await olaf.request<PageComment>('POST', `/pages/${page.id}/comments`, {
      body: { markdown: 'Zu lang?' },
      anchor: { exact: 'zwei Wochen', prefix: 'Der Sprint dauert ', suffix: '.', block: 0 },
    });
    expect(created.status).toBe(201);
    inline = created.body;
    expect(inline.anchor).toEqual({
      exact: 'zwei Wochen',
      prefix: 'Der Sprint dauert ',
      suffix: '.',
      block: 0,
    });
    const resolved = await olaf.request<PageComment>(
      'PUT',
      `/pages/${page.id}/comments/${inline.id}/resolved`,
    );
    expect(resolved.body.resolved?.by?.id).toBeDefined();
    expect(
      (await olaf.request('PUT', `/pages/${page.id}/comments/${thread.id}/resolved`)).status,
    ).toBe(400);
    const reopened = await mira.request<PageComment>(
      'DELETE',
      `/pages/${page.id}/comments/${inline.id}/resolved`,
    );
    expect(reopened.body.resolved).toBeNull();
  });

  it('follows the quote into new versions, detaches and comes back', async () => {
    await publish('Neu oben.', 'Der Sprint dauert zwei Wochen und endet am Freitag.');
    let found = (await comments()).find((comment) => comment.id === inline.id);
    expect(found).toMatchObject({
      detached: false,
      anchor: { exact: 'zwei Wochen', suffix: ' und endet am Freitag.', block: 1 },
    });
    await publish('Der Sprint dauert drei Wochen.');
    found = (await comments()).find((comment) => comment.id === inline.id);
    expect(found?.detached).toBe(true);
    await mira.request('POST', `/pages/${page.id}/versions/1/restore`, {});
    found = (await comments()).find((comment) => comment.id === inline.id);
    expect(found).toMatchObject({ detached: false, anchor: { block: 0 } });
  });

  it('lets authors edit and delete; deleted threads stay while answered', async () => {
    expect(
      (
        await mira.request('PATCH', `/pages/${page.id}/comments/${thread.id}`, {
          body: { markdown: 'Fremd' },
        })
      ).status,
    ).toBe(403);
    const edited = await olaf.request<PageComment>(
      'PATCH',
      `/pages/${page.id}/comments/${thread.id}`,
      { body: { markdown: 'Gilt das auch im Dezember?' } },
    );
    expect(edited.status).toBe(200);
    expect((await olaf.request('DELETE', `/pages/${page.id}/comments/${thread.id}`)).status).toBe(
      204,
    );
    let list = await comments(olaf);
    const root = list.find((comment) => comment.id === thread.id);
    expect(root).toMatchObject({ deleted: true, body: null, canDelete: false });
    const reply = list.find((comment) => comment.parentId === thread.id);
    expect(reply?.canDelete).toBe(false);
    expect((await admin.request('DELETE', `/pages/${page.id}/comments/${reply?.id}`)).status).toBe(
      204,
    );
    list = await comments(olaf);
    expect(list.map((comment) => comment.id)).toEqual([inline.id]);
  });
});

describe('labels and watching (E-65)', () => {
  let page: Page;

  it('lets editors label pages; labels are lower case and outside the versions', async () => {
    page = (await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Onboarding-Plan' }))
      .body;
    const labelled = await mira.request<Page>('PUT', `/pages/${page.id}/labels`, {
      labels: ['Prozess', 'prozess', ' Team '],
    });
    expect(labelled.body).toMatchObject({ labels: ['prozess', 'team'], version: 0 });
    expect((await olaf.request('PUT', `/pages/${page.id}/labels`, { labels: ['x'] })).status).toBe(
      404,
    );
    expect(
      (await mira.request('PUT', `/pages/${page.id}/labels`, { labels: ['zwei worte'] })).status,
    ).toBe(400);

    // A draft carries its labels only for editors.
    const forOlaf = await olaf.request<LabelledPage[]>('GET', '/labels/prozess/pages');
    expect(forOlaf.body).toEqual([]);
    await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Onboarding-Plan',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    const found = await olaf.request<LabelledPage[]>('GET', '/labels/Prozess/pages?space=DOCS');
    expect(found.body.map((entry) => [entry.title, entry.space.key])).toEqual([
      ['Onboarding-Plan', 'DOCS'],
    ]);
    expect((await olaf.request('PUT', `/pages/${page.id}/labels`, { labels: ['x'] })).status).toBe(
      403,
    );
    const counts = await olaf.request<LabelCount[]>('GET', '/spaces/DOCS/labels');
    expect(counts.body).toEqual([
      { label: 'prozess', pages: 1 },
      { label: 'team', pages: 1 },
    ]);
  });

  it('watches pages, subtrees and spaces; creating a page watches it', async () => {
    expect((await mira.request<Page>('GET', `/pages/${page.id}`)).body.watch).toEqual({
      page: true,
      subtree: false,
      inherited: null,
    });
    const child = (
      await mira.request<Page>('POST', '/spaces/DOCS/pages', {
        title: 'Woche 1',
        parentId: page.id,
      })
    ).body;
    await olaf.request('PUT', `/pages/${page.id}/watch`, { scope: 'subtree' });
    expect((await olaf.request<Page>('GET', `/pages/${page.id}`)).body.watch).toEqual({
      page: false,
      subtree: true,
      inherited: null,
    });
    expect((await mira.request<Page>('GET', `/pages/${child.id}`)).body.watch.inherited).toBeNull();
    await mira.request('PUT', '/spaces/DOCS/watch');
    expect((await mira.request<Space>('GET', '/spaces/DOCS')).body.watching).toBe(true);
    expect((await mira.request<Page>('GET', `/pages/${child.id}`)).body.watch).toEqual({
      page: true,
      subtree: false,
      inherited: 'space',
    });
    await olaf.request('DELETE', `/pages/${page.id}/watch?scope=subtree`);
    expect((await olaf.request<Page>('GET', `/pages/${page.id}`)).body.watch.subtree).toBe(false);
    await mira.request('DELETE', '/spaces/DOCS/watch');
  });
});
