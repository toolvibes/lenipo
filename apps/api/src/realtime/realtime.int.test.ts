import type { ProjectDetails } from '@tasklore/shared';
import { and, eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, projectRoleMembers } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { REALTIME_PATH } from './realtime.service.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId: string;
let origin: string;
const sockets: Socket[] = [];

function connect(cookie?: string, headers: Record<string, string> = {}): Socket {
  const socket = io(origin, {
    path: REALTIME_PATH,
    transports: ['websocket'],
    extraHeaders: { ...(cookie ? { cookie } : {}), ...headers },
    reconnection: false,
  });
  sockets.push(socket);
  return socket;
}

const connected = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

const subscribe = (socket: Socket, rooms: string[]) =>
  new Promise<string[]>((resolve) => {
    socket.emit('subscribe', rooms, (result: { joined: string[] }) => resolve(result.joined));
  });

/** The next "change" signal, or null after a short wait. */
const nextChange = (socket: Socket, ms = 1500) =>
  new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once('change', (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

beforeAll(async () => {
  test = await startTestApp();
  origin = test.baseUrl.replace(/\/api\/v1$/, '');
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  const sec = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'SEC',
    name: 'Sicher',
    template: 'basic',
  });
  const [usersGroup] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, sec.body.id),
        eq(projectRoleMembers.groupId, usersGroup?.id ?? ''),
      ),
    );
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Login',
  });
  await admin.request('POST', '/issues', {
    projectKey: 'SEC',
    issueType: 'task',
    summary: 'Audit',
  });
}, 60_000);

afterAll(async () => {
  for (const socket of sockets) socket.close();
  await test?.close();
});

describe('realtime', () => {
  it('needs a session from the same origin', async () => {
    await expect(connected(connect())).rejects.toThrow();
    await expect(
      connected(connect(mira.cookie, { origin: 'https://evil.example' })),
    ).rejects.toThrow();
  });

  it('joins only rooms the person may see', async () => {
    const socket = connect(mira.cookie);
    await connected(socket);
    expect(
      await subscribe(socket, [
        'project:WEB',
        'issue:WEB-1',
        'project:SEC',
        'issue:SEC-1',
        'nonsense',
      ]),
    ).toEqual(['project:WEB', 'issue:WEB-1']);
  });

  it('signals changes after commit, with ids only', async () => {
    const socket = connect(mira.cookie);
    await connected(socket);
    await subscribe(socket, ['issue:WEB-1']);
    const change = nextChange(socket);
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Login über Keycloak' });
    expect(await change).toEqual({ type: 'issue', issueKey: 'WEB-1', projectKey: 'WEB' });
    // Nothing about projects the person cannot see.
    const nothing = nextChange(socket, 500);
    await admin.request('PATCH', '/issues/SEC-1', { summary: 'Audit 2026' });
    expect(await nothing).toBeNull();
  });

  it('rings the bell of the recipient', async () => {
    const socket = connect(mira.cookie);
    await connected(socket);
    await admin.request('PATCH', '/issues/WEB-1', { assigneeId: miraId });
    const change = new Promise<unknown>((resolve) => {
      socket.on('change', (payload: { type: string }) => {
        if (payload.type === 'notification') resolve(payload);
      });
    });
    await test.app.get(EventProcessor).drain();
    expect(await change).toEqual({ type: 'notification', userId: miraId });
  });
});
