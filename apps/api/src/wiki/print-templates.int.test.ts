import type { PrintTemplate } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;

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

describe('print templates (TL-53)', () => {
  it('keeps one default, lets spaces choose and refuses CSS that loads things', async () => {
    const logo = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;
    const firma = await admin.request<PrintTemplate>('POST', '/admin/print-templates', {
      name: 'Firma',
      logo,
      subtitle: 'Bereich {{space}}',
      isDefault: true,
    });
    expect(firma.status).toBe(201);
    expect(firma.body).toMatchObject({
      titlePage: true,
      footer: '{{date}} · {{page}} / {{pages}}',
    });
    const schlicht = await admin.request<PrintTemplate>('POST', '/admin/print-templates', {
      name: 'Schlicht',
      titlePage: false,
      css: 'h1 { color: #333; }',
    });
    expect(
      (
        await admin.request('POST', '/admin/print-templates', {
          name: 'Böse',
          css: '@import "https://example.org/x.css";',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.request('POST', '/admin/print-templates', {
          name: 'Svg',
          logo: 'data:image/svg+xml;base64,AA==',
        })
      ).status,
    ).toBe(400);

    const byDefault = await admin.request<{ template: PrintTemplate }>(
      'GET',
      '/spaces/DOC/print-template',
    );
    expect(byDefault.body.template.name).toBe('Firma');
    const chosen = await admin.request<{ template: PrintTemplate }>(
      'PUT',
      '/spaces/DOC/print-template',
      {
        templateId: schlicht.body.id,
      },
    );
    expect(chosen.body.template.name).toBe('Schlicht');

    await admin.request('PUT', `/admin/print-templates/${schlicht.body.id}`, {
      name: 'Schlicht',
      titlePage: false,
      isDefault: true,
    });
    const list = (
      await admin.request<Array<{ name: string; isDefault: boolean }>>('GET', '/print-templates')
    ).body;
    expect(list.filter((entry) => entry.isDefault).map((entry) => entry.name)).toEqual([
      'Schlicht',
    ]);

    expect(
      (await admin.request('DELETE', `/admin/print-templates/${schlicht.body.id}`)).status,
    ).toBe(204);
    const fallback = await admin.request<{ template: PrintTemplate | null }>(
      'GET',
      '/spaces/DOC/print-template',
    );
    expect(fallback.body.template).toBeNull();
  });
});
