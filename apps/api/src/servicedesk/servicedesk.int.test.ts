import type {
  Comment,
  Issue,
  PortalDesk,
  PortalRequest,
  PortalRequestDetail,
  ServiceDesk,
  UserSummary,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { Mailer, type MailMessage } from '../notifications/mailer.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let kunde: TestClient;
let fremd: TestClient;
let desk: ServiceDesk;
const sent: MailMessage[] = [];

async function external(email: string, displayName: string): Promise<UserSummary> {
  return (
    await admin.request<UserSummary>('POST', '/admin/users', {
      email,
      displayName,
      password: 'ein-langes-passwort',
      external: true,
    })
  ).body;
}

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

beforeAll(async () => {
  test = await startTestApp({
    SMTP_URL: 'smtp://127.0.0.1:1',
    PUBLIC_URL: 'https://lenipo.example.org',
  });
  test.app.get(Mailer).transport = {
    sendMail: async (message) => {
      sent.push(message);
    },
  };
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'HELP', name: 'Hilfe', template: 'basic' });
  const customer = await external('kunde@example.org', 'Karla Kunde');
  await external('fremd@example.org', 'Fred Fremd');
  kunde = await signIn('kunde@example.org');
  fremd = await signIn('fremd@example.org');

  const saved = await admin.request<ServiceDesk>('PUT', '/projects/HELP/service-desk', {
    customerAccess: 'list',
    intro: 'Wir helfen gern.',
    firstResponseHours: {},
    resolutionHours: {},
    pauseStatusIds: [],
    timeZone: 'Europe/Berlin',
    dayStartHour: 9,
  });
  expect(saved.status).toBe(200);
  await admin.request('POST', '/projects/HELP/service-desk/request-types', {
    name: 'Zugang beantragen',
    issueType: 'task',
    fields: ['priority'],
  });
  desk = (
    await admin.request<ServiceDesk>('POST', '/projects/HELP/service-desk/customers', {
      userId: customer.id,
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('service desk portal (TL-47)', () => {
  it('lets listed customers file requests they alone can follow', async () => {
    expect(desk.portalPath).toBe('/portal/HELP');
    const desks = (await kunde.request<PortalDesk[]>('GET', '/portal/desks')).body;
    expect(desks).toMatchObject([{ key: 'HELP', intro: 'Wir helfen gern.' }]);
    expect((await fremd.request<PortalDesk[]>('GET', '/portal/desks')).body).toEqual([]);
    expect((await fremd.request('GET', '/portal/desks/HELP')).status).toBe(404);

    const filed = await kunde.request<PortalRequestDetail>('POST', '/portal/desks/HELP/requests', {
      requestTypeId: desks[0]?.requestTypes[0]?.id,
      summary: 'Zugang zum Wiki',
      description: { markdown: 'Bitte freischalten.' },
      priority: 'high',
    });
    expect(filed.status).toBe(201);
    expect(filed.body).toMatchObject({ requestType: 'Zugang beantragen', comments: [] });
    const key = filed.body.key;

    // Agents see an ordinary issue with the customer as reporter; the customer sees no project.
    const issue = (await admin.request<Issue>('GET', `/issues/${key}`)).body;
    expect(issue).toMatchObject({
      reporter: { displayName: 'Karla Kunde' },
      priority: { key: 'high' },
    });
    expect((await kunde.request('GET', `/issues/${key}`)).status).toBe(404);
    expect((await fremd.request('GET', `/portal/requests/${key}`)).status).toBe(404);

    await test.app.get(EventProcessor).drain();
    sent.length = 0;
    const note = await admin.request<Comment>('POST', `/issues/${key}/comments`, {
      body: { markdown: 'Intern: erst Freigabe holen' },
      internal: true,
    });
    expect(note.body.internal).toBe(true);
    await admin.request('POST', `/issues/${key}/comments`, {
      body: { markdown: 'Ist freigeschaltet.' },
    });
    await test.app.get(EventProcessor).drain();
    const toCustomer = sent.filter((mail) => mail.to === 'kunde@example.org');
    expect(toCustomer).toHaveLength(1);
    expect(toCustomer[0]?.text).toContain(`https://lenipo.example.org/portal/requests/${key}`);

    const detail = (await kunde.request<PortalRequestDetail>('GET', `/portal/requests/${key}`))
      .body;
    expect(JSON.stringify(detail.comments)).not.toContain('Intern');
    expect(detail.comments).toMatchObject([{ fromAgent: true }]);

    const answered = await kunde.request<PortalRequestDetail>(
      'POST',
      `/portal/requests/${key}/comments`,
      { body: { markdown: 'Danke!' } },
    );
    expect(answered.body.comments.map((comment) => comment.fromAgent)).toEqual([true, false]);
    const mine = (await kunde.request<PortalRequest[]>('GET', '/portal/requests')).body;
    expect(mine.map((request) => request.key)).toEqual([key]);
  });

  it('can open the portal to everyone signed in', async () => {
    const settings = (await admin.request<ServiceDesk>('GET', '/projects/HELP/service-desk')).body
      .settings;
    await admin.request('PUT', '/projects/HELP/service-desk', {
      ...settings,
      customerAccess: 'everyone',
    });
    expect((await fremd.request<PortalDesk[]>('GET', '/portal/desks')).body).toHaveLength(1);
  });
});
