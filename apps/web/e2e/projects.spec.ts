import { expect, type Page, test } from '@playwright/test';

/** Screenshots for a manual look, only when E2E_SHOTS names a folder. */
async function shot(page: Page, name: string) {
  if (process.env.E2E_SHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png` });
  }
}

test.describe('working inside a project', () => {
  test('create issue offers the project the page is about', async ({ page }) => {
    await page.request.post('/api/v1/projects', {
      data: { key: 'APP', name: 'App', template: 'kanban' },
    });
    // Another project visited last must not win over the one the page shows.
    await page.goto('/projects/APP');
    await page.waitForLoadState('networkidle');
    await page.goto('/projects/WEB/reports');
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('c');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('select').first()).toHaveValue('WEB');
    await shot(page, '1-vorgang-erstellen');
  });

  test('new Scrum and Kanban projects come with a board; others offer to create one', async ({
    page,
  }) => {
    const boards = await page.request.get('/api/v1/boards?project=APP');
    expect(((await boards.json()) as Array<{ type: string }>).map((board) => board.type)).toEqual([
      'kanban',
    ]);
    await page.request.post('/api/v1/projects', {
      data: { key: 'BAS', name: 'Basis', template: 'basic' },
    });
    await page.goto('/projects/BAS');
    await page.waitForLoadState('networkidle');
    const create = page.getByRole('link', { name: 'Board anlegen' });
    await expect(create).toBeVisible();
    await create.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox').first()).toHaveValue('Basis');
    await expect(dialog.locator('select').first()).toHaveValue('BAS');
    await shot(page, '2-board-anlegen');
  });

  test('moves the issues of the old start into a new start status on publish', async ({ page }) => {
    const workflow = (await (await page.request.get('/api/v1/projects/WEB/workflow')).json()) as {
      versionId: string;
      initialStatusId: string;
      mode: string;
      statuses: Array<{ id: string; name: string; category: string }>;
    };
    // A draft with "Eingang" in front as the new start, as the editor would save it.
    const draft = await page.request.put('/api/v1/projects/WEB/workflow/draft', {
      data: {
        baseVersionId: workflow.versionId,
        statuses: [
          { id: null, name: 'Eingang', category: 'todo' },
          ...workflow.statuses.map(({ id, name, category }) => ({ id, name, category })),
        ],
        initial: 0,
        mode: workflow.mode,
        transitions: [],
        migrate: {},
      },
    });
    expect(draft.ok()).toBe(true);
    await page.goto('/projects/WEB/settings');
    await page.waitForLoadState('networkidle');
    const section = page.getByRole('region', { name: 'Vorgänge verschieben' });
    await expect(section).toBeVisible();
    await section.getByRole('button', { name: /in den neuen Start „Eingang“/ }).click();
    await shot(page, '3-vorgaenge-verschieben');
    await page.getByRole('button', { name: 'Veröffentlichen' }).click();
    await expect
      .poll(async () => {
        const issue = (await (await page.request.get('/api/v1/issues/WEB-1')).json()) as {
          status: { name: string };
        };
        return issue.status.name;
      })
      .toBe('Eingang');
  });

  test('archives a project with the question about its wiki, restores and deletes it', async ({
    page,
  }) => {
    await page.request.post('/api/v1/projects', {
      data: { key: 'ARC', name: 'Altprojekt', template: 'basic' },
    });
    await page.request.post('/api/v1/spaces', { data: { key: 'ARC', name: 'Alt-Wiki' } });
    await page.request.patch('/api/v1/spaces/ARC', { data: { projectKey: 'ARC' } });
    await page.goto('/projects/ARC/settings');
    await page.getByRole('button', { name: 'Archivieren und löschen' }).click();
    await page.getByRole('button', { name: 'Archivieren', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const wiki = dialog.getByRole('checkbox', {
      name: /Wiki-Bereich „Alt-Wiki“ \(ARC\) ebenfalls archivieren/,
    });
    await expect(wiki).not.toBeChecked();
    await wiki.check();
    await shot(page, '4-archivieren');
    await dialog.getByRole('button', { name: 'Archivieren' }).click();
    await expect(page).toHaveURL(/\/projects\?tab=inactive/);
    await expect(page.getByText('Altprojekt')).toBeVisible();
    await shot(page, '5-archiviert');
    expect((await page.request.get('/api/v1/spaces/ARC')).status()).toBe(404);

    await page.getByRole('button', { name: 'Wiederherstellen' }).click();
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Wiederherstellen' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect((await page.request.get('/api/v1/projects/ARC')).ok()).toBe(true);
    expect((await page.request.get('/api/v1/spaces/ARC')).ok()).toBe(true);

    await page.goto('/projects/ARC/settings');
    await page.getByRole('button', { name: 'Archivieren und löschen' }).click();
    await page.getByRole('button', { name: 'In den Papierkorb' }).click();
    await shot(page, '6-loeschen');
    await page.getByRole('dialog').getByRole('button', { name: 'In den Papierkorb' }).click();
    await expect(page.getByText(/im Papierkorb, endgültig gelöscht am/)).toBeVisible();
    // The wiki stays: the box was not ticked.
    expect((await page.request.get('/api/v1/spaces/ARC')).ok()).toBe(true);
  });
});
