import type {
  Attachment,
  Blog,
  ImportJob,
  Page,
  PageComment,
  PageTreeEntry,
  PageVersionSummary,
} from '@tasklore/shared';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { ImportService } from './import.service.js';

let test: TestApp;
let admin: TestClient;
let dryRun: ImportJob;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const ref = (name: string, cls: string, id: string, idName = 'id') =>
  `<property name="${name}" class="${cls}" package="x"><id name="${idName}">${id}</id></property>`;
const prop = (name: string, value: string) =>
  `<property name="${name}"><![CDATA[${value}]]></property>`;
const content = (cls: string, id: string, title: string, extra: string) =>
  `<object class="${cls}" package="x"><id name="id">${id}</id>${prop('title', title)}${prop('contentStatus', 'current')}${ref('space', 'Space', '55')}${ref('creator', 'ConfluenceUserImpl', 'u1', 'key')}${prop('creationDate', '2025-03-01 10:00:00.000')}${prop('lastModificationDate', '2025-03-02 10:00:00.000')}${extra}</object>`;
const body = (id: string, cls: string, owner: string, xhtml: string) =>
  `<object class="BodyContent" package="x"><id name="id">${id}</id>${prop('body', xhtml)}${ref('content', cls, owner)}${prop('bodyType', '2')}</object>`;

const ENTITIES = `<?xml version="1.0" encoding="UTF-8"?>
<hibernate-generic datetime="2025-03-05 10:00:00">
<object class="ConfluenceUserImpl" package="x"><id name="key">u1</id>${prop('name', 'Lena Vogt')}${prop('lowerName', 'lena')}${prop('email', 'lena@example.org')}</object>
<object class="ConfluenceUserImpl" package="x"><id name="key">u2</id>${prop('name', 'Old Boss')}${prop('lowerName', 'boss')}${prop('email', 'boss@corp.example')}</object>
<object class="Space" package="x"><id name="id">55</id>${prop('name', 'Team-Doku')}${prop('key', 'TD')}${ref('homePage', 'Page', '100')}</object>
${content('Page', '100', 'Start', `${prop('version', '1')}`)}
${content('Page', '101', 'Betrieb', `${prop('version', '2')}${ref('parent', 'Page', '100')}${ref('lastModifier', 'ConfluenceUserImpl', 'u2', 'key')}`)}
${content('Page', '102', 'Betrieb', `${prop('version', '1')}${ref('originalVersion', 'Page', '101')}`)}
${content('BlogPost', '103', 'Neu im März', `${prop('version', '1')}`)}
<object class="Comment" package="x"><id name="id">200</id>${prop('contentStatus', 'current')}${ref('containerContent', 'Page', '101')}${ref('creator', 'ConfluenceUserImpl', 'u2', 'key')}${prop('creationDate', '2025-03-03 10:00:00.000')}</object>
<object class="Attachment" package="x"><id name="id">300</id>${prop('title', 'plan.png')}${prop('contentType', 'image/png')}${prop('version', '1')}${prop('contentStatus', 'current')}${ref('containerContent', 'Page', '101')}${ref('creator', 'ConfluenceUserImpl', 'u1', 'key')}</object>
<object class="Label" package="x"><id name="id">7</id>${prop('name', 'howto')}${prop('namespace', 'global')}</object>
<object class="Labelling" package="x"><id name="id">8</id>${ref('label', 'Label', '7')}${ref('content', 'Page', '101')}</object>
${body('900', 'Page', '100', '<p>Willkommen</p><ac:structured-macro ac:name="children" />')}
${body('901', 'Page', '101', '<h2>Ziel</h2><p>Siehe <ac:link><ri:page ri:content-title="Start" /></ac:link></p><ac:image><ri:attachment ri:filename="plan.png" /></ac:image><ac:structured-macro ac:name="warning"><ac:rich-text-body><p>Achtung</p></ac:rich-text-body></ac:structured-macro><ac:structured-macro ac:name="gliffy" />')}
${body('902', 'Page', '102', '<p>Alte Fassung</p>')}
${body('903', 'BlogPost', '103', '<p>Es gibt Neues.</p>')}
${body('904', 'Comment', '200', '<p>Gut so</p>')}
</hibernate-generic>`;

async function upload(query: string): Promise<ImportJob> {
  const form = new FormData();
  const zip = zipSync({
    'entities.xml': strToU8(ENTITIES),
    'exportDescriptor.properties': strToU8('spaceKey=TD\n'),
    'attachments/101/300/1': PNG,
  });
  form.append(
    'file',
    new Blob([zip], { type: 'application/zip' }),
    'Confluence-space-export-TD.xml.zip',
  );
  const response = await fetch(`${test.baseUrl}/admin/imports/confluence?${query}`, {
    method: 'POST',
    headers: { cookie: admin.cookie ?? '' },
    body: form,
  });
  const answer = (await response.json()) as ImportJob;
  if (!answer.id) throw new Error(`Upload: ${response.status} ${JSON.stringify(answer)}`);
  return answer;
}

async function finish(job: ImportJob): Promise<ImportJob> {
  await test.app.get(ImportService).runPending();
  return (await admin.request<ImportJob>('GET', `/admin/imports/${job.id}`)).body;
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
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('import from a Confluence space export (TL-35)', () => {
  it('reports in a dry run, including macros without a counterpart', async () => {
    dryRun = await finish(await upload('dryRun=true'));
    expect(dryRun.state, dryRun.log.join('\n')).toBe('done');
    expect(dryRun.report?.counts).toMatchObject({
      Seiten: 2,
      Blogbeiträge: 1,
      Kommentare: 1,
      Anhänge: 1,
    });
    expect(dryRun.report?.skipped.join()).toContain('Makro „gliffy“');
    expect((await admin.request('GET', '/spaces/TD')).status).toBe(404);
  });

  it('imports pages with versions, links, images, labels, comments and blog posts', async () => {
    const started = (await admin.request<ImportJob>('POST', `/admin/imports/${dryRun.id}/run`))
      .body;
    const job = await finish(started);
    expect(job.state, job.log.join('\n')).toBe('done');
    const space = (await admin.request<{ homePageId: string }>('GET', '/spaces/TD')).body;
    const tree = (await admin.request<PageTreeEntry[]>('GET', '/spaces/TD/pages')).body;
    const betrieb = tree.find((entry) => entry.title === 'Betrieb');
    expect(betrieb?.parentId).toBe(space.homePageId);
    const page = (await admin.request<Page>('GET', `/pages/${betrieb?.id}?format=markdown`)).body;
    expect(page).toMatchObject({ version: 2, labels: ['howto'] });
    const markdown = String(page.content);
    expect(markdown).toContain(`[Start](/spaces/TD/pages/${space.homePageId})`);
    expect(markdown).toMatch(/!\[\]\(attachment:[0-9a-f-]{36}\)/);
    expect(markdown).toContain('> [!WARNING]');
    const versions = (
      await admin.request<PageVersionSummary[]>('GET', `/pages/${betrieb?.id}/versions`)
    ).body;
    expect(versions.map((version) => [version.number, version.author?.displayName])).toEqual(
      expect.arrayContaining([
        [2, 'Old Boss'],
        [1, 'Lena Vogt'],
      ]),
    );
    const comments = (await admin.request<PageComment[]>('GET', `/pages/${betrieb?.id}/comments`))
      .body;
    expect(comments.map((comment) => comment.author?.displayName)).toEqual(['Old Boss']);
    const files = (await admin.request<Attachment[]>('GET', `/pages/${betrieb?.id}/attachments`))
      .body;
    expect(files.map((file) => file.fileName)).toEqual(['plan.png']);
    const blog = (await admin.request<Blog>('GET', '/spaces/TD/blog')).body;
    expect(blog.posts.map((post) => post.title)).toEqual(['Neu im März']);
  });
});
