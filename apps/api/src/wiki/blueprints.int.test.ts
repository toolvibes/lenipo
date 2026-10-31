import type { Page, PageTemplateSummary } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('blueprints, variables and index pages (TL-27)', () => {
  it('offers all eight blueprints with their input variables', async () => {
    const templates = (
      await admin.request<PageTemplateSummary[]>('GET', '/spaces/DOC/templates')
    ).body.filter((entry) => entry.kind === 'blueprint');
    expect(templates.map((entry) => entry.ref)).toEqual([
      'blueprint:meeting',
      'blueprint:decision',
      'blueprint:requirements',
      'blueprint:retro',
      'blueprint:project-plan',
      'blueprint:how-to',
      'blueprint:post-mortem',
      'blueprint:release-notes',
    ]);
    expect(templates.find((entry) => entry.ref === 'blueprint:post-mortem')?.inputs).toEqual([
      'Vorfall',
    ]);
  });

  it('fills variables, labels the page and files it under the blueprint’s index', async () => {
    const created = await admin.request<Page>('POST', '/spaces/DOC/pages', {
      title: '{{date}} Fehleranalyse: {{input:Vorfall}}',
      template: 'blueprint:post-mortem',
      variables: { Vorfall: 'API ausgefallen' },
    });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe(`${today} Fehleranalyse: API ausgefallen`);
    expect(created.body.labels).toEqual(['post-mortem']);
    const index = created.body.ancestors.at(-1);
    expect(index?.title).toBe('Fehleranalysen');
    const indexPage = (await admin.request<Page>('GET', `/pages/${index?.id}`)).body;
    expect(indexPage.version).toBe(1);
    expect(JSON.stringify(indexPage.content)).toContain('"propertiesReport"');
    // A second page of the blueprint goes under the same index.
    const second = (
      await admin.request<Page>('POST', '/spaces/DOC/pages', {
        title: 'Zweiter Vorfall',
        template: 'blueprint:post-mortem',
        variables: { Vorfall: 'Login' },
      })
    ).body;
    expect(second.ancestors.at(-1)?.id).toBe(index?.id);
  });

  it('drops placeholders when publishing', async () => {
    const page = (await admin.request<Page>('POST', '/spaces/DOC/pages', { title: 'Mit Hinweis' }))
      .body;
    const published = await admin.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Mit Hinweis',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Ziel: ' },
              { type: 'placeholder', attrs: { text: 'Hier das Ziel eintragen' } },
            ],
          },
        ],
      },
    });
    expect(published.status).toBe(200);
    expect(JSON.stringify(published.body.content)).not.toContain('placeholder');
  });
});
