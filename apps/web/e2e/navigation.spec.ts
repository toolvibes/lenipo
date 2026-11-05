import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { STATE } from './global-setup';

const data = () =>
  JSON.parse(readFileSync(join(STATE, 'data.json'), 'utf8')) as { boardId: string | null };

test.use({ viewport: { width: 1280, height: 800 } });

const areas = (page: Page) => page.getByRole('navigation', { name: 'Hauptbereiche' });
const menu = (page: Page) => page.getByRole('complementary', { name: 'Bereichsmenü' });
const activeItem = (page: Page) => menu(page).locator('[aria-current="page"]');

test.describe('navigation by area', () => {
  test('the route decides area and menu item, also on direct links', async ({ page }) => {
    const { boardId } = data();
    await page.goto(`/boards/${boardId}`);
    await expect(areas(page).locator('[aria-current="true"]')).toContainText('Web-Relaunch');
    await expect(activeItem(page)).toHaveText('Board');
    await page.goto('/projects/WEB/team');
    await expect(activeItem(page)).toHaveText('Team');
    await page.goto('/spaces/WEB');
    // The wiki of a project belongs to the project.
    await expect(activeItem(page)).toHaveText('Wiki');
    await page.goto('/projects');
    await expect(areas(page).getByRole('link', { name: 'Planung' })).toHaveAttribute(
      'aria-current',
      /page|true/,
    );
    await expect(activeItem(page)).toHaveText('Alle Projekte');
    await page.goto('/notifications');
    await expect(activeItem(page)).toHaveCount(0);
  });

  test('the project tab leads into the last project and switches projects in place', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(activeItem(page)).toHaveText('Übersicht');
    await areas(page)
      .getByRole('link', { name: /Web-Relaunch/ })
      .click();
    await expect(page).toHaveURL(/\/boards\//);
    await expect(activeItem(page)).toHaveText('Board');

    await page.request.post('/api/v1/projects', {
      data: { key: 'NAV', name: 'Navigationstest', template: 'kanban' },
    });
    await page.goto('/projects/WEB/timeline');
    await page.getByRole('button', { name: /Projekt wechseln/ }).click();
    await page.getByRole('searchbox', { name: 'Projekt suchen' }).fill('navig');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Navigationstest/ })
      .click();
    await expect(page).toHaveURL(/\/projects\/NAV\/timeline/);
    await expect(activeItem(page)).toHaveText('Timeline');

    await page.getByRole('button', { name: /Projekt wechseln/ }).click();
    await page.getByRole('link', { name: 'Alle Projekte anzeigen' }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('notifications, search, help and account sit in the top bar', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Benachrichtigungen' })).toBeVisible();
    await header.getByRole('button', { name: 'Hilfe' }).click();
    await expect(page.getByRole('menuitem', { name: 'Handbuch' })).toBeVisible();
    await page.keyboard.press('Escape');
    await header.getByRole('button', { name: /Konto und Einstellungen/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Profil' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
    await page.keyboard.press('Escape');
    await header.getByRole('button', { name: /Suchen/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('every route still opens in the new frame, without an error page', async ({ page }) => {
    test.setTimeout(180_000);
    const { boardId } = data();
    const routes = [
      '/',
      `/issues?q=${encodeURIComponent('project = WEB')}`,
      '/activity',
      '/timesheet',
      '/projects',
      '/boards',
      '/plans',
      '/dashboards',
      '/agents',
      '/projects/WEB',
      '/projects/WEB/timeline',
      `/calendar?q=${encodeURIComponent('project = WEB')}`,
      '/projects/WEB/releases',
      '/projects/WEB/reports',
      '/projects/WEB/team',
      '/projects/WEB/settings',
      `/boards/${boardId}`,
      `/boards/${boardId}/backlog`,
      `/boards/${boardId}/reports`,
      '/issues/WEB-1',
      '/spaces',
      '/spaces/WEB',
      '/portal',
      '/search?q=Anmeldung',
      '/notifications',
      '/profile',
      '/help',
      '/admin/webhooks',
      '/admin/operations',
    ];
    for (const [index, path] of routes.entries()) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Das hat nicht geklappt')).toHaveCount(0);
      await expect(areas(page)).toBeVisible();
      if (process.env.E2E_SHOTS) {
        const name = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'start';
        await page.screenshot({
          path: `${process.env.E2E_SHOTS}/${String(index + 1).padStart(2, '0')}-${name.slice(0, 40)}.png`,
        });
      }
    }
  });

  test('on a phone the areas and the menu open in a drawer', async ({ page }) => {
    const { boardId } = data();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/boards/${boardId}`);
    await page.getByRole('button', { name: 'Menü öffnen' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('navigation', { name: 'Hauptbereiche' })).toBeVisible();
    await expect(drawer.locator('[aria-current="page"]')).toHaveText('Board');
  });
});
