import { markdownToDoc } from '@toolvibes/editor';
import type {
  EmbedHosts,
  LabelledPage,
  Page,
  PagePropertiesReport,
  WikiTask,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId = '';

async function publish(title: string, markdown: string, labels: string[] = []): Promise<Page> {
  const page = (await admin.request<Page>('POST', '/spaces/DOC/pages', { title })).body;
  await admin.request('POST', `/pages/${page.id}/publish`, {
    title,
    content: markdownToDoc(markdown),
  });
  if (labels.length > 0) await admin.request('PUT', `/pages/${page.id}/labels`, { labels });
  return page;
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
  miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku' });
  await publish(
    'ADR 1: Datenbank',
    [
      ':::properties',
      '| Eigenschaft | Wert |',
      '| --- | --- |',
      '| Status | Entschieden |',
      '| Datum | 2026-10-01 |',
      ':::',
      '',
      `- [ ] @[Mira Kaya](user:${miraId}) prüft das bis 30.11.2026`,
      '- [x] Erledigte Aufgabe',
    ].join('\n'),
    ['adr'],
  );
  await publish(
    'ADR 2: Suche',
    ':::properties\n| a | b |\n| --- | --- |\n| Status | Offen |\n:::',
    ['adr'],
  );
  await publish('Notizen', '- [ ] Ohne Person 2026-11-02');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('wiki macros with data (TL-26)', () => {
  it('lists recently published pages', async () => {
    const recent = (
      await admin.request<LabelledPage[]>('GET', '/wiki/recent-pages?space=DOC&limit=2')
    ).body;
    expect(recent.map((page) => page.title)).toEqual(['Notizen', 'ADR 2: Suche']);
  });

  it('gathers page properties of labelled pages into one table', async () => {
    const report = (
      await admin.request<PagePropertiesReport>('GET', '/wiki/page-properties?label=adr')
    ).body;
    expect(report.keys).toEqual(['Status', 'Datum']);
    expect(report.rows.map((row) => [row.page.title, row.values.Status])).toEqual([
      ['ADR 1: Datenbank', 'Entschieden'],
      ['ADR 2: Suche', 'Offen'],
    ]);
  });

  it('reports open tasks with people and due dates', async () => {
    const all = (await admin.request<WikiTask[]>('GET', '/wiki/tasks?space=DOC')).body;
    expect(all.map((task) => [task.due, task.assignees.map((user) => user.displayName)])).toEqual([
      ['2026-11-02', []],
      ['2026-11-30', ['Mira Kaya']],
    ]);
    const mine = (await mira.request<WikiTask[]>('GET', '/wiki/tasks?assignee=me')).body;
    expect(mine.map((task) => task.page.title)).toEqual(['ADR 1: Datenbank']);
  });

  it('keeps an allow-list of embeddable hosts for administrators', async () => {
    expect((await mira.request<EmbedHosts>('GET', '/wiki/embed-hosts')).body.hosts).toContain(
      'www.youtube.com',
    );
    expect(
      (await mira.request('PUT', '/admin/embed-hosts', { hosts: ['evil.example'] })).status,
    ).toBe(403);
    const saved = await admin.request<EmbedHosts>('PUT', '/admin/embed-hosts', {
      hosts: ['https://grafana.example.org/d/abc', 'www.youtube.com'],
    });
    expect(saved.body.hosts).toEqual(['grafana.example.org', 'www.youtube.com']);
  });
});
