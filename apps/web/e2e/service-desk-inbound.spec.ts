import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('service desk requests without an account', () => {
  test('unknown senders and the webhook are set up in the settings', async ({ page }) => {
    await page.request.post('/api/v1/projects', {
      data: { key: 'SUP', name: 'Support', template: 'basic' },
    });
    await page.request.put('/api/v1/projects/SUP/service-desk', {
      data: {
        customerAccess: 'list',
        intro: '',
        firstResponseHours: {},
        resolutionHours: {},
        pauseStatusIds: [],
        timeZone: 'Europe/Berlin',
        dayStartHour: 9,
      },
    });
    await page.request.post('/api/v1/projects/SUP/service-desk/request-types', {
      data: { name: 'Fehler', issueType: 'task', fields: [] },
    });

    await page.goto('/projects/SUP/settings');
    await page.getByRole('button', { name: 'Service Desk', exact: true }).click();
    await expect(page.getByText('Anfragen ohne Konto')).toBeVisible();

    const unknown = page.getByRole('checkbox', { name: /Mails unbekannter Absender annehmen/ });
    await unknown.click();
    // The box shows what the server saved.
    await expect(unknown).toBeChecked();
    const domains = page.getByLabel('Nur diese Domains');
    await expect(domains).toBeVisible();
    await domains.fill('kunde.de, Beispiel.com');
    await domains.press('Enter');
    await expect
      .poll(async () => {
        const desk = await (await page.request.get('/api/v1/projects/SUP/service-desk')).json();
        return desk.settings.allowedDomains;
      })
      .toEqual(['kunde.de', 'beispiel.com']);

    await page.getByRole('button', { name: 'Token erzeugen und einschalten' }).click();
    const token = (await page.getByRole('status').locator('code').textContent()) ?? '';
    expect(token).toMatch(/^sdin_/);
    await expect(
      page.getByText('POST http://127.0.0.1:4180/api/v1/service-desk/inbound/SUP', { exact: true }),
    ).toBeVisible();
    await page.getByText('JSON-Schema der Anfrage').click();
    await expect(page.getByText('"title": "InboundServiceRequest"')).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      axe.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => violation.id),
    ).toEqual([]);
    if (process.env.E2E_SHOTS) {
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/servicedesk-eingang.png`,
        fullPage: true,
      });
    }

    // The token from the settings files a request, with a new contact as reporter.
    const filed = await page.request.post('/api/v1/service-desk/inbound/SUP', {
      headers: { authorization: `Bearer ${token}` },
      data: { email: 'karla@kunde.de', name: 'Karla Kundin', summary: 'Rezept leer' },
    });
    expect(filed.status()).toBe(201);
    const { key } = (await filed.json()) as { key: string };
    const issue = await (await page.request.get(`/api/v1/issues/${key}`)).json();
    expect(issue.reporter.displayName).toBe('Karla Kundin');
  });
});
