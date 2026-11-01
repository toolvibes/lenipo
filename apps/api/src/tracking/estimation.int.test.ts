import type { Estimation, Issue } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let jonas: TestClient;
let issue: Issue;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'jonas@example.org',
    displayName: 'Jonas Schulz',
    password: 'ein-langes-passwort',
  });
  jonas = new TestClient(test.baseUrl);
  await jonas.request('POST', '/auth/login', {
    email: 'jonas@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  issue = (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary: 'Anmeldung',
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('planning poker (TL-51)', () => {
  it('hides the cards until they are revealed', async () => {
    const path = `/issues/${issue.key}/estimation`;
    expect((await admin.request<{ round: null }>('GET', path)).body).toEqual({ round: null });
    // Voting needs an open round.
    expect((await jonas.request('PUT', `${path}/vote`, { value: '3' })).status).toBe(409);

    const started = await admin.request<Estimation>('POST', path);
    expect(started.body).toMatchObject({
      revealed: false,
      votes: [],
      canManage: true,
      startedBy: { displayName: 'Lena Vogt' },
    });

    await admin.request('PUT', `${path}/vote`, { value: '5' });
    const voted = await jonas.request<Estimation>('PUT', `${path}/vote`, { value: '8' });
    expect(voted.body.mine).toBe('8');
    expect(voted.body.votes.map((vote) => vote.value)).toEqual([null, null]);
    expect((await jonas.request('PUT', `${path}/vote`, { value: '7' })).status).toBe(400);

    const revealed = await admin.request<Estimation>('POST', `${path}/reveal`);
    expect(revealed.body.votes.map((vote) => [vote.user.displayName, vote.value])).toEqual([
      ['Lena Vogt', '5'],
      ['Jonas Schulz', '8'],
    ]);
    // After revealing, the cards stay as they are.
    expect((await jonas.request('PUT', `${path}/vote`, { value: '3' })).status).toBe(409);

    // A fresh round clears the cards; ending removes it.
    const again = await admin.request<Estimation>('POST', path);
    expect(again.body).toMatchObject({ revealed: false, votes: [], mine: null });
    expect((await admin.request('DELETE', path)).status).toBe(204);
    expect((await admin.request<{ round: null }>('GET', path)).body).toEqual({ round: null });
  });
});
