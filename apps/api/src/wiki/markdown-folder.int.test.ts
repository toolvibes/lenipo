import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page, PageTreeEntry } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from '../core/http/principal.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { exportFolder, type FolderServices, importFolder } from './markdown-folder.js';
import { PageService } from './page.service.js';
import { SpaceService } from './space.service.js';

let test: TestApp;
let admin: TestClient;
let principal: Principal;
let services: FolderServices;
let folder: string;

const options = { spaceKey: 'tl', spaceName: 'Tasklore', skip: ['README.md'] };

async function tree(): Promise<PageTreeEntry[]> {
  return (await admin.request<PageTreeEntry[]>('GET', '/spaces/TL/pages')).body;
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
  const me = (await admin.request<{ id: string }>('GET', '/me')).body;
  principal = { userId: me.id, via: 'session', sessionId: 'test' };
  services = { spaces: test.app.get(SpaceService), pages: test.app.get(PageService) };
  folder = await mkdtemp(join(tmpdir(), 'tasklore-docs-'));
  await writeFile(join(folder, 'README.md'), '# Bitte im Wiki ändern\n');
  await writeFile(
    join(folder, '01-vision.md'),
    '# Vision & Scope\n\nSiehe [Entscheidungen](02-entscheidungen.md#e-1) und [extern](https://example.org).\n',
  );
  await writeFile(
    join(folder, '02-entscheidungen.md'),
    '# Entscheidungen\n\n| ID | Thema |\n| --- | --- |\n| E-1 | **Stack** |\n\nZurück zur [Vision](01-vision.md), [fehlt](09-fehlt.md).\n',
  );
}, 60_000);

afterAll(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
  await test?.close();
});

describe('Markdown folder as a snapshot of a space', () => {
  it('import files as published pages below a new home page, with links between them', async () => {
    const result = await importFolder(services, principal, folder, options);
    expect(result.created).toEqual(['01-vision.md', '02-entscheidungen.md']);
    expect(result.unresolved).toEqual(['02-entscheidungen.md → 09-fehlt.md']);

    const entries = await tree();
    const [home, vision, decisions] = entries;
    expect(entries.map((entry) => [entry.title, entry.parentId === home?.id])).toEqual([
      ['Tasklore', false],
      ['Vision & Scope', true],
      ['Entscheidungen', true],
    ]);
    const page = (await admin.request<Page>('GET', `/pages/${vision?.id}?format=markdown`)).body;
    expect(page.version).toBe(1);
    expect(page.content).toContain(`(/spaces/TL/pages/${decisions?.id}#e-1)`);
    expect(page.content).toContain('(https://example.org)');
  });

  it('mark imported files with page and version', async () => {
    expect(await readFile(join(folder, '01-vision.md'), 'utf8')).toMatch(
      /^<!-- tasklore page=[0-9a-f-]{36} version=1 .*-->\n# Vision & Scope\n/,
    );
  });

  it('export pages as files with markers and relative links, keeping unmarked files', async () => {
    const result = await exportFolder(services, principal, folder, options);
    // The import wrote the files in the form the export produces, so nothing changes.
    expect(result.written).toEqual([]);
    expect((await readdir(folder)).sort()).toEqual([
      '01-vision.md',
      '02-entscheidungen.md',
      'README.md',
    ]);
    const vision = await readFile(join(folder, '01-vision.md'), 'utf8');
    expect(vision).toMatch(/^<!-- tasklore page=[0-9a-f-]{36} version=1 /);
    expect(vision).toContain(
      '# Vision & Scope\n\nSiehe [Entscheidungen](02-entscheidungen.md#e-1)',
    );
    expect(await readFile(join(folder, 'README.md'), 'utf8')).toBe('# Bitte im Wiki ändern\n');
    // A second export changes nothing, a second import neither.
    expect((await exportFolder(services, principal, folder, options)).written).toEqual([]);
    const again = await importFolder(services, principal, folder, options);
    expect(again.unchanged).toEqual(['01-vision.md', '02-entscheidungen.md']);
    expect(again.created).toEqual([]);
  });

  it('bring an edited file back as a new version', async () => {
    const path = join(folder, '02-entscheidungen.md');
    await writeFile(path, (await readFile(path, 'utf8')).replace('**Stack**', '**Stack** (3:0)'));
    const result = await importFolder(services, principal, folder, options);
    expect(result.updated).toEqual(['02-entscheidungen.md']);
    await exportFolder(services, principal, folder, options);
    expect(await readFile(path, 'utf8')).toMatch(/version=2 [\s\S]*\*\*Stack\*\* \(3:0\)/);
  });

  it('refuse files of pages changed in the wiki since the export, before any write', async () => {
    const decisions = (await tree()).find((entry) => entry.title === 'Entscheidungen');
    await admin.request('POST', `/pages/${decisions?.id}/publish`, {
      title: 'Entscheidungen',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Neu im Wiki' }] }],
      },
    });
    await writeFile(join(folder, '03-neu.md'), '# Neu\n\nText\n');
    await expect(importFolder(services, principal, folder, options)).rejects.toThrow(
      'the page has changed in the wiki since version 2 (now 3); export first',
    );
    expect((await tree()).map((entry) => entry.title)).not.toContain('Neu');
  });

  it('remove files of pages that are gone and skip drafts', async () => {
    await rm(join(folder, '03-neu.md'));
    const vision = (await tree()).find((entry) => entry.title === 'Vision & Scope');
    await admin.request('DELETE', `/pages/${vision?.id}`);
    const home = (await tree())[0];
    await admin.request('POST', '/spaces/TL/pages', { title: 'Nur Entwurf', parentId: home?.id });
    const result = await exportFolder(services, principal, folder, options);
    expect(result.removed).toEqual(['01-vision.md']);
    expect(result.drafts).toEqual(['Nur Entwurf']);
    expect(await readFile(join(folder, '02-entscheidungen.md'), 'utf8')).toContain('Neu im Wiki');
  });
});
