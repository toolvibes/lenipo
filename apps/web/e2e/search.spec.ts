import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 860 } });

const query = (page: Page) => page.getByRole('combobox', { name: 'TQL-Abfrage' });
const options = (page: Page) =>
  page.getByRole('listbox', { name: 'Vorschläge' }).getByRole('option');

async function openTql(page: Page) {
  await page.goto('/issues');
  await page.getByRole('button', { name: 'TQL', exact: true }).click();
  await query(page).fill('');
}

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

test.describe('TQL quick selection', () => {
  test('the empty field offers templates, "/" filters them and Enter searches', async ({
    page,
  }) => {
    await openTql(page);
    await query(page).click();
    await expect(options(page).filter({ hasText: 'Überfällig' })).toBeVisible();
    await expect(options(page).filter({ hasText: 'Im laufenden Sprint' })).toContainText('Vorlage');
    expect(await violations(page)).toEqual([]);
    await shot(page, 'tql-1-vorlagen');

    await query(page).fill('/über');
    await expect(options(page)).toHaveCount(1);
    await query(page).press('Enter');
    await expect(page).toHaveURL(/due/);
    await expect(query(page)).toHaveValue(
      'due < startOfDay() AND resolution is EMPTY ORDER BY due',
    );
    await expect(page.getByText('Das hat nicht geklappt')).toHaveCount(0);

    // The search just made comes first the next time the field is empty.
    await query(page).fill('project = WEB ORDER BY created DESC');
    await query(page).press('Enter');
    await query(page).fill('');
    await expect(options(page).first()).toContainText('project = WEB ORDER BY created DESC');
    await expect(options(page).first()).toContainText('Zuletzt');
  });

  test('suggestions explain fields, operators and functions in one line', async ({ page }) => {
    await openTql(page);
    await query(page).fill('assi');
    await expect(options(page).filter({ hasText: 'assignee' })).toContainText(
      'wer den Vorgang bearbeitet',
    );
    await query(page).fill('assignee ');
    await expect(options(page).filter({ hasText: /^=/ }).first()).toContainText('ist gleich');
    await query(page).fill('assignee = cur');
    await expect(options(page).filter({ hasText: 'currentUser()' })).toContainText('du selbst');
    await shot(page, 'tql-2-erklaerungen');
  });

  test('the quick help inserts building blocks at the cursor and runs templates', async ({
    page,
  }) => {
    await openTql(page);
    await query(page).fill('assignee =');
    await page.getByRole('button', { name: 'Vorlagen und Hilfe' }).click();
    const help = page.getByRole('dialog', { name: 'Vorlagen und Kurzhilfe' });
    await expect(help.getByRole('heading', { name: 'Bausteine' })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await shot(page, 'tql-3-kurzhilfe');

    await help.getByRole('button', { name: 'currentUser() du selbst' }).click();
    await expect(help).toBeHidden();
    await expect(query(page)).toHaveValue('assignee = currentUser() ');
    await expect(query(page)).toBeFocused();

    await page.getByRole('button', { name: 'Vorlagen und Hilfe' }).click();
    await help.getByRole('button', { name: 'IN (…)' }).click();
    await expect(query(page)).toHaveValue('assignee = currentUser() IN ()');

    await page.getByRole('button', { name: 'Vorlagen und Hilfe' }).click();
    await help.getByRole('button', { name: /Offen ohne Bearbeiter/ }).click();
    await expect(query(page)).toHaveValue(
      'assignee is EMPTY AND resolution is EMPTY ORDER BY created DESC',
    );
    await expect(page).toHaveURL(/assignee/);
    await expect(page.getByText('Das hat nicht geklappt')).toHaveCount(0);
  });

  test('on a phone the quick help fits the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openTql(page);
    await page.getByRole('button', { name: 'Vorlagen und Hilfe' }).click();
    const box = await page.getByRole('dialog', { name: 'Vorlagen und Kurzhilfe' }).boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(800);
    await shot(page, 'tql-4-telefon');
  });
});
