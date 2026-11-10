import type {
  Attachment,
  Comment,
  InboundToken,
  Issue,
  MailHandler,
  ServiceDesk,
  UserSummary,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projects, users } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { MailHandlerService, replyText } from './mail-handler.service.js';

let test: TestApp;
let admin: TestClient;
let projectId: string;
let deskId: string;

function mail(lines: Record<string, string>, body: string, attachment?: string): Buffer {
  const headers = Object.entries({ 'MIME-Version': '1.0', ...lines })
    .map(([name, value]) => `${name}: ${value}`)
    .join('\r\n');
  if (!attachment) {
    return Buffer.from(`${headers}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`);
  }
  const boundary = 'grenze';
  return Buffer.from(
    [
      `${headers}\r\nContent-Type: multipart/mixed; boundary=${boundary}\r\n`,
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8\r\n',
      body,
      `--${boundary}`,
      'Content-Type: text/plain; name="log.txt"',
      'Content-Disposition: attachment; filename="log.txt"\r\n',
      attachment,
      `--${boundary}--\r\n`,
    ].join('\r\n'),
  );
}

async function projectIdOf(key: string): Promise<string> {
  const [row] = await test.database.db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.key, key));
  return row?.id ?? '';
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
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/projects', { key: 'HELP', name: 'Hilfe', template: 'basic' });
  projectId = await projectIdOf('OPS');
  deskId = await projectIdOf('HELP');
  const customer = await admin.request<UserSummary>('POST', '/admin/users', {
    email: 'kunde@example.org',
    displayName: 'Karla Kunde',
    password: 'ein-langes-passwort',
    external: true,
  });
  await admin.request('PUT', '/projects/HELP/service-desk', {
    customerAccess: 'list',
    intro: '',
    firstResponseHours: {},
    resolutionHours: {},
    pauseStatusIds: [],
    timeZone: 'Europe/Berlin',
    dayStartHour: 9,
  });
  await admin.request('POST', '/projects/HELP/service-desk/request-types', {
    name: 'Frage',
    issueType: 'task',
    fields: [],
  });
  await admin.request('POST', '/projects/HELP/service-desk/customers', {
    userId: customer.body.id,
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('mail handler (TL-53)', () => {
  it('keeps the settings of a mailbox, never its password', async () => {
    const saved = await admin.request<{ handler: MailHandler }>(
      'PUT',
      '/projects/OPS/mail-handler',
      {
        host: 'imap.example.org',
        username: 'ops@example.org',
        password: 'geheim',
        issueType: 'bug',
      },
    );
    expect(saved.status).toBe(200);
    expect(saved.body.handler).toMatchObject({ hasPassword: true, issueType: 'bug', port: 993 });
    expect(JSON.stringify(saved.body)).not.toContain('geheim');
  });

  it('turns mails into issues and replies into comments, as the sender', async () => {
    const handler = test.app.get(MailHandlerService);
    const created = await handler.handle(
      projectId,
      mail(
        {
          From: 'Lena Vogt <lena@example.org>',
          To: 'ops@example.org',
          Subject: 'Drucker im 2. Stock streikt',
          'Message-ID': '<eins@example.org>',
        },
        'Seit heute früh kein Ausdruck.',
        'Fehler 42',
      ),
    );
    expect(created).toEqual({ outcome: 'issue', issueKey: 'OPS-1' });
    const issue = (await admin.request<Issue>('GET', '/issues/OPS-1?format=markdown')).body;
    expect(issue).toMatchObject({
      summary: 'Drucker im 2. Stock streikt',
      description: 'Seit heute früh kein Ausdruck.',
      issueType: { key: 'bug' },
      reporter: { displayName: 'Lena Vogt' },
    });
    const files = (await admin.request<Attachment[]>('GET', '/issues/OPS-1/attachments')).body;
    expect(files.map((file) => file.fileName)).toEqual(['log.txt']);

    // The same mail again changes nothing.
    expect(
      await handler.handle(
        projectId,
        mail({ From: 'lena@example.org', Subject: 'x', 'Message-ID': '<eins@example.org>' }, 'x'),
      ),
    ).toEqual({ outcome: 'issue', issueKey: 'OPS-1' });

    const reply = await handler.handle(
      projectId,
      mail(
        {
          From: 'lena@example.org',
          Subject: 'AW: [OPS-1] Drucker im 2. Stock streikt',
          'Message-ID': '<zwei@example.org>',
        },
        'Toner getauscht, geht wieder.\n\nAm 3. Nov. 2026 schrieb Lenipo <lenipo@localhost>:\n> Neuer Vorgang',
      ),
    );
    expect(reply).toEqual({ outcome: 'comment', issueKey: 'OPS-1' });
    const comments = (
      await admin.request<Comment[]>('GET', '/issues/OPS-1/comments?format=markdown')
    ).body;
    expect(comments.map((comment) => String(comment.body).trim())).toEqual([
      'Toner getauscht, geht wieder.',
    ]);
  });

  it('ignores strangers and automatic answers', async () => {
    const handler = test.app.get(MailHandlerService);
    expect(
      (
        await handler.handle(
          projectId,
          mail({ From: 'fremd@example.com', Subject: 'Hallo', 'Message-ID': '<drei@x>' }, 'Spam'),
        )
      ).outcome,
    ).toBe('unknown-sender');
    expect(
      (
        await handler.handle(
          projectId,
          mail(
            {
              From: 'lena@example.org',
              Subject: 'Abwesend',
              'Auto-Submitted': 'auto-replied',
              'Message-ID': '<vier@x>',
            },
            'Bin im Urlaub.',
          ),
        )
      ).outcome,
    ).toBe('ignored');
    const receipts = (
      await admin.request<Array<{ outcome: string }>>('GET', '/projects/OPS/mail-handler/receipts')
    ).body;
    expect(receipts.map((receipt) => receipt.outcome).sort()).toEqual([
      'comment',
      'ignored',
      'issue',
      'unknown-sender',
    ]);
  });

  it('files mails of service desk customers as requests', async () => {
    const result = await test.app
      .get(MailHandlerService)
      .handle(
        deskId,
        mail(
          { From: 'kunde@example.org', Subject: 'Passwort vergessen', 'Message-ID': '<fünf@x>' },
          'Bitte helfen.',
        ),
      );
    expect(result).toEqual({ outcome: 'issue', issueKey: 'HELP-1' });
    const issue = (await admin.request<Issue>('GET', '/issues/HELP-1')).body;
    expect(issue.reporter?.displayName).toBe('Karla Kunde');
  });

  it('lets confirmed unknown senders in where the service desk allows it (E-168)', async () => {
    const handler = test.app.get(MailHandlerService);
    const from = 'Nina Neu <neu@kunde.de>';
    const confirmed = 'mx.test; dmarc=pass (p=none) header.from=kunde.de';
    const outcome = async (headers: Record<string, string>) =>
      (await handler.handle(deskId, mail(headers, 'Das Rezept lädt nicht.'))).outcome;
    expect(await outcome({ From: from, Subject: 'Fehler', 'Message-ID': '<u1@x>' })).toBe(
      'unknown-sender',
    );

    await admin.request('PUT', '/projects/HELP/service-desk', {
      customerAccess: 'list',
      intro: '',
      firstResponseHours: {},
      resolutionHours: {},
      pauseStatusIds: [],
      timeZone: 'Europe/Berlin',
      dayStartHour: 9,
      acceptUnknownSenders: true,
      allowedDomains: ['kunde.de'],
    });
    expect(await outcome({ From: from, Subject: 'Fehler', 'Message-ID': '<u2@x>' })).toBe(
      'unverified-sender',
    );
    expect(
      await outcome({
        From: 'x@fremd.com',
        Subject: 'Fehler',
        'Message-ID': '<u3@x>',
        'Authentication-Results': 'mx.test; dmarc=pass header.from=fremd.com',
      }),
    ).toBe('domain-not-allowed');

    const created = await handler.handle(
      deskId,
      mail(
        {
          From: from,
          Subject: 'Rezept lädt nicht',
          'Message-ID': '<u4@x>',
          'Authentication-Results': confirmed,
        },
        'Das Rezept lädt nicht.',
      ),
    );
    expect(created.outcome).toBe('issue');
    const issue = (await admin.request<Issue>('GET', `/issues/${created.issueKey}`)).body;
    expect(issue.reporter?.displayName).toBe('Nina Neu');
    const [contact] = await test.database.db
      .select({ external: users.external, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, 'neu@kunde.de'));
    expect(contact).toEqual({ external: true, passwordHash: null });
    const desk = (await admin.request<ServiceDesk>('GET', '/projects/HELP/service-desk')).body;
    expect(desk.customers.map((entry) => entry.user?.displayName)).toContain('Nina Neu');

    // Now known: the answer to the request needs no confirmation any more.
    expect(
      await outcome({ From: from, Subject: `Re: ${created.issueKey}`, 'Message-ID': '<u5@x>' }),
    ).toBe('comment');
  });

  it('files requests from other systems with the token of the desk (E-168)', async () => {
    const anonymous = new TestClient(test.baseUrl);
    const body = {
      email: 'Kai@Shop.de',
      name: 'Kai Kauf',
      summary: 'Rezept fehlt',
      description: 'Das Rezept **Linsensuppe** fehlt.',
    };
    const send = (token: string, payload: unknown = body) =>
      anonymous.request<{ key: string }>('POST', '/service-desk/inbound/HELP', payload, {
        authorization: `Bearer ${token}`,
      });
    expect((await send('sdin_raten')).status).toBe(401);

    const token = await admin.request<InboundToken>(
      'POST',
      '/projects/HELP/service-desk/inbound-token',
    );
    expect(token.status, JSON.stringify(token.body)).toBe(201);
    expect(token.body.secret).toMatch(/^sdin_/);
    const desk = await admin.request<ServiceDesk>('GET', '/projects/HELP/service-desk');
    expect(desk.body.inbound).toMatchObject({
      path: '/api/v1/service-desk/inbound/HELP',
      enabled: true,
    });
    expect(JSON.stringify(desk.body)).not.toContain(token.body.secret);

    expect((await send('sdin_falsch')).status).toBe(401);
    const filed = await send(token.body.secret);
    expect(filed.status).toBe(201);
    const issue = (await admin.request<Issue>('GET', `/issues/${filed.body.key}?format=markdown`))
      .body;
    expect(issue.reporter?.displayName).toBe('Kai Kauf');
    expect(issue.description).toContain('**Linsensuppe**');
    expect((await send(token.body.secret, { ...body, requestType: 'Gibt es nicht' })).status).toBe(
      400,
    );
    expect(
      (await send(token.body.secret, { ...body, requestType: 'frage', summary: 'Zweite' })).status,
    ).toBe(201);

    // At most ten requests per person and hour.
    for (let index = 2; index < 10; index += 1) {
      expect((await send(token.body.secret, { ...body, summary: `Nr. ${index}` })).status).toBe(
        201,
      );
    }
    expect((await send(token.body.secret)).status).toBe(429);

    const rotated = await admin.request<InboundToken>(
      'POST',
      '/projects/HELP/service-desk/inbound-token',
    );
    expect((await send(token.body.secret)).status).toBe(401);
    await admin.request('DELETE', '/projects/HELP/service-desk/inbound-token');
    expect((await send(rotated.body.secret)).status).toBe(401);
  });

  it('cuts the quoted mail from replies', () => {
    expect(replyText('Danke!\n\nOn Mon, 2 Nov 2026 at 10:00, Lena wrote:\n> alt')).toBe('Danke!');
    expect(replyText('Erledigt.\n> zitiert\nnoch')).toBe('Erledigt.');
  });
});
