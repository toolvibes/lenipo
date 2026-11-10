import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 860 } });

const menu = (page: Page) => page.getByRole('complementary', { name: 'Bereichsmenü' });

async function shot(page: Page, name: string) {
  if (process.env.E2E_SHOTS)
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png` });
}

/** Serious and critical WCAG 2.1 AA findings. */
async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => violation.id);
}

async function spaceOf(page: Page, key: string) {
  const response = await page.request.get(`/api/v1/spaces/${key}`);
  return response.ok() ? ((await response.json()) as { project: { key: string } | null }) : null;
}

test.describe('projects and their wiki', () => {
  test('a new project from the project switcher gets its wiki in the same step', async ({
    page,
  }) => {
    await page.goto('/projects/WEB');
    await page.getByRole('button', { name: /Projekt wechseln/ }).click();
    await page.getByRole('button', { name: 'Neues Projekt' }).click();
    const dialog = page.getByRole('dialog', { name: 'Projekt erstellen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Wikitest');
    const wiki = dialog.getByRole('checkbox', { name: /Wiki-Bereich dazu anlegen/ });
    await expect(wiki).toBeChecked();
    expect(await violations(page)).toEqual([]);
    await shot(page, 'projekt-1-neu-mit-wiki');
    await dialog.getByRole('button', { name: 'Projekt erstellen' }).click();

    await expect(page).toHaveURL(/\/projects\/WIKI$/);
    await expect(menu(page).getByRole('link', { name: 'Wiki' })).toBeVisible();
    expect((await spaceOf(page, 'WIKI'))?.project?.key).toBe('WIKI');
  });

  test('without the option the project starts without a wiki', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Projekt erstellen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Projekt erstellen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Ohne Bereich');
    await dialog.getByRole('checkbox', { name: /Wiki-Bereich dazu anlegen/ }).uncheck();
    await dialog.getByRole('button', { name: 'Projekt erstellen' }).click();
    await expect(page).toHaveURL(/\/projects\/OB$/);
    expect(await spaceOf(page, 'OB')).toBeNull();
    await expect(menu(page).getByRole('button', { name: 'Wiki anlegen' })).toBeVisible();
  });

  test('a project without a wiki creates one from its menu, linked right away', async ({
    page,
  }) => {
    await page.request.post('/api/v1/projects', {
      data: { key: 'NOWI', name: 'Noch ohne Wiki', template: 'kanban' },
    });
    await page.goto('/projects/NOWI');
    await menu(page).getByRole('button', { name: 'Wiki anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Bereich anlegen' });
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Noch ohne Wiki');
    await expect(dialog.getByLabel('Schlüssel', { exact: true })).toHaveValue('NOWI');
    await shot(page, 'projekt-2-wiki-aus-menue');
    await dialog.getByRole('button', { name: 'Bereich anlegen' }).click();

    await expect(page).toHaveURL(/\/spaces\/NOWI/);
    await expect(menu(page).locator('[aria-current="page"]')).toHaveText('Wiki');
    await expect(menu(page).getByRole('button', { name: 'Wiki anlegen' })).toHaveCount(0);
    expect((await spaceOf(page, 'NOWI'))?.project?.key).toBe('NOWI');
  });

  test('the wiki pages settings show the linked wiki or create one', async ({ page }) => {
    await page.request.post('/api/v1/projects', {
      data: { key: 'NOWB', name: 'Einstellungstest', template: 'basic' },
    });
    await page.goto('/projects/NOWB/settings');
    await page.getByRole('button', { name: 'Wiki-Seiten' }).click();
    await expect(page.getByText('noch keinen eigenen Wiki-Bereich')).toBeVisible();
    await shot(page, 'projekt-3-einstellungen');
    await page.getByRole('main').getByRole('button', { name: 'Wiki anlegen' }).click();
    await page
      .getByRole('dialog', { name: 'Bereich anlegen' })
      .getByRole('button', { name: 'Bereich anlegen' })
      .click();
    await expect(page).toHaveURL(/\/spaces\/NOWB/);

    await page.goto('/projects/NOWB/settings');
    await page.getByRole('button', { name: 'Wiki-Seiten' }).click();
    await expect(page.getByText('Verknüpft mit')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Einstellungstest (NOWB)' })).toBeVisible();
  });

  test('a taken space key keeps the project and says how to add the wiki later', async ({
    page,
  }) => {
    await page.request.post('/api/v1/spaces', { data: { key: 'BELEGT', name: 'Schon da' } });
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Projekt erstellen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Projekt erstellen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Belegt');
    await dialog.getByLabel('Schlüssel', { exact: true }).fill('BELEGT');
    await dialog.getByRole('button', { name: 'Projekt erstellen' }).click();
    await expect(
      dialog.getByText('Das Projekt ist angelegt, der Wiki-Bereich nicht'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Zum Projekt' }).click();
    await expect(page).toHaveURL(/\/projects\/BELEGT$/);
  });
});
