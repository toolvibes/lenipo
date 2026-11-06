import { expect, type Page, test } from '@playwright/test';

// Without a loaded profile the language follows the browser.
test.use({ locale: 'de-DE' });

/** Readable pages instead of the router's "Something went wrong". */
test.describe('when loading fails', () => {
  test('waits for a server that is away and carries on once it is back', async ({ page }) => {
    let away = true;
    // No answer at all, as while the server restarts.
    await page.route('**/api/v1/**', (route) => (away ? route.abort() : route.fallback()));
    await page.goto('/projects');
    await expect(
      page.getByRole('heading', { name: 'Lenipo ist gerade nicht erreichbar' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText('alle paar Sekunden');
    away = false;
    await expect(page.getByRole('heading', { name: 'Projekte' }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows the maintenance page for maintenance', async ({ page }) => {
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'urn:lenipo:problem:maintenance',
          title: 'Service Unavailable',
          status: 503,
        }),
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Lenipo wird gewartet' })).toBeVisible();
  });

  test('names unknown addresses', async ({ page }) => {
    await page.goto('/gibt-es-nicht');
    await expect(page.getByRole('heading', { name: 'Nicht gefunden' })).toBeVisible();
  });
});

test.describe('signing in', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const signIn = async (page: Page) => {
    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill('kollege@example.org');
    await page.getByLabel('Passwort').fill('ein-langes-passwort');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  };

  test('shows the maintenance page instead of a wrong password', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'urn:lenipo:problem:maintenance',
          title: 'Service Unavailable',
          status: 503,
        }),
      }),
    );
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Lenipo wird gewartet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Als Admin anmelden' })).toBeVisible();
  });

  test('still names wrong credentials', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('E-Mail-Adresse oder Passwort ist falsch.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
