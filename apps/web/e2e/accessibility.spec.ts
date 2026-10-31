import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { STATE } from './global-setup';

/** WCAG 2.1 A and AA rules; serious and critical findings fail (TL-43, E-124). */
async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    );
}

const data = () =>
  JSON.parse(readFileSync(join(STATE, 'data.json'), 'utf8')) as { boardId: string | null };

const PAGES = [
  '/',
  '/issues',
  '/projects',
  '/projects/WEB',
  '/issues/WEB-1',
  '/spaces',
  '/spaces/WEB',
  '/calendar',
  '/timesheet',
  '/dashboards',
  '/notifications',
  '/profile',
  '/admin/sign-in',
  '/admin/operations',
];

test.describe('signed in', () => {
  for (const path of PAGES) {
    test(`no serious violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // The page itself (or below it), not a redirect to the sign-in or welcome steps.
      expect(new URL(page.url()).pathname.startsWith(path)).toBe(true);
      expect(await violations(page)).toEqual([]);
    });
  }

  test('no serious violations on the board', async ({ page }) => {
    const { boardId } = data();
    test.skip(!boardId, 'no board');
    await page.goto(`/boards/${boardId}`);
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
  });

  test('skip link jumps past the navigation', async ({ page }) => {
    // A page without a field that takes the focus on its own.
    await page.goto('/profile');
    const skip = page.getByRole('link', { name: 'Zum Inhalt springen' });
    await skip.waitFor({ state: 'attached' });
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('on a phone the navigation is a drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/projects/WEB');
    await page.getByRole('button', { name: 'Menü öffnen' }).click();
    const drawer = page.getByRole('dialog', { name: 'Hauptnavigation' });
    await expect(drawer).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeFocused();
  });

  test('is installable: manifest and service worker', async ({ page }) => {
    await page.goto('/');
    const manifest = await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).icons).toHaveLength(3);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe('http://127.0.0.1:4180/');
  });
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ['/login', '/accessibility']) {
    test(`no serious violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await violations(page)).toEqual([]);
    });
  }
});
