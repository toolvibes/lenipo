import { expect, type Page, test } from '@playwright/test';

const PAGES = [
  '/admin/webhooks',
  '/admin/git',
  '/admin/import',
  '/admin/maintenance',
  '/admin/operations',
  '/admin/permission-schemes',
  '/admin/notification-schemes',
  '/admin/security-schemes',
  '/admin/sign-in',
  '/admin/directories',
  '/admin/automation',
  '/admin/embeds',
  '/admin/ai',
  '/admin/agents',
  '/admin/apps',
  '/admin/print-templates',
  '/admin/access-check',
  '/admin/custom-fields',
  '/admin/time-tracking',
  '/admin/templates',
  '/admin/templates/new',
];

/** Distance of the page content from the administration menu and from the top of the menu. */
async function offsets(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Administration"]');
    const content = nav?.nextElementSibling?.firstElementChild;
    if (!nav || !content) return null;
    const menu = nav.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    const first = content.querySelector('h1, h2, p, button, a, input');
    const text = first?.getBoundingClientRect() ?? box;
    return { left: Math.round(text.left - menu.right), top: Math.round(text.top - menu.top) };
  });
}

test.describe('administration layout', () => {
  test('every page keeps the same distance from the menu', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const result = await offsets(page);
      expect(result, path).not.toBeNull();
      expect(result?.left, path).toBe(40);
      expect(result?.top, path).toBeGreaterThanOrEqual(28);
      if (process.env.E2E_SHOTS) {
        const name = path.split('/').slice(2).join('-');
        await page.screenshot({ path: `${process.env.E2E_SHOTS}/admin-${name}.png` });
      }
    }
  });

  test('on a phone the content keeps a margin to the screen edge', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const path of ['/admin/maintenance', '/admin/webhooks']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const left = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Administration"]');
        const heading = nav?.nextElementSibling?.querySelector('h1');
        return heading ? Math.round(heading.getBoundingClientRect().left) : null;
      });
      expect(left, path).toBeGreaterThanOrEqual(16);
    }
  });
});
