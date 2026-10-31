import { createHash, randomBytes } from 'node:crypto';
import type { OAuthClientInfo, OAuthConsentResult, OAuthGrant } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';

let test: TestApp;
let admin: TestClient;
let origin = '';
let clientId = '';
let refresh = '';
let access = '';
const REDIRECT = 'http://127.0.0.1:33418/callback';
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

async function form(path: string, body: Record<string, string>) {
  const response = await fetch(`${test.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

async function mcp(token?: string) {
  return fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
}

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
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('OAuth for MCP clients (TL-69)', () => {
  it('tells an unauthenticated MCP client where to sign in', async () => {
    const response = await mcp();
    expect(response.status).toBe(401);
    const header = response.headers.get('www-authenticate') ?? '';
    expect(header).toContain('/.well-known/oauth-protected-resource/mcp');
    const resource = (await (
      await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)
    ).json()) as { resource: string };
    expect(resource.resource).toBe(`${origin}/mcp`);
    const server = await (await fetch(`${origin}/.well-known/oauth-authorization-server`)).json();
    expect(server).toMatchObject({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('registers public clients with safe redirect URIs only', async () => {
    const bad = await fetch(`${test.baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Böse', redirect_uris: ['http://evil.example/cb'] }),
    });
    expect(bad.status).toBe(400);
    const good = await fetch(`${test.baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude Code', redirect_uris: [REDIRECT] }),
    });
    expect(good.status).toBe(201);
    clientId = ((await good.json()) as { client_id: string }).client_id;
  });

  it('asks for consent and hands out a code bound to PKCE', async () => {
    const info = await admin.request<OAuthClientInfo>(
      'GET',
      `/oauth/client?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://127.0.0.1:51000/callback')}&scope=issues:read`,
    );
    expect(info.body).toMatchObject({ name: 'Claude Code', requestedScopes: ['issues:read'] });
    const consent = await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
      clientId,
      redirectUri: REDIRECT,
      scopes: ['issues:read', 'wiki:read'],
      approve: true,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      state: 'xyz',
    });
    const redirect = new URL(consent.body.redirect);
    expect(redirect.searchParams.get('state')).toBe('xyz');
    const code = redirect.searchParams.get('code') ?? '';

    const wrong = await form('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: 'falsch-falsch-falsch-falsch-falsch-falsch-falsch',
      client_id: clientId,
    });
    expect(wrong.body.error).toBe('invalid_grant');
    // The failed attempt used the code and revoked its grant; a new consent gives a new one.
    const again = await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
      clientId,
      redirectUri: REDIRECT,
      scopes: ['issues:read', 'wiki:read'],
      approve: true,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    const tokens = await form('/oauth/token', {
      grant_type: 'authorization_code',
      code: new URL(again.body.redirect).searchParams.get('code') ?? '',
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: REDIRECT,
    });
    expect(tokens.status).toBe(200);
    expect(tokens.body).toMatchObject({ token_type: 'Bearer', scope: 'issues:read wiki:read' });
    access = tokens.body.access_token ?? '';
    refresh = tokens.body.refresh_token ?? '';
    expect((await mcp(access)).status).toBe(200);
  });

  it('rotates refresh tokens and revokes the grant when an old one comes back', async () => {
    const next = await form('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refresh,
    });
    expect(next.status).toBe(200);
    expect((await mcp(next.body.access_token)).status).toBe(200);
    const replay = await form('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refresh,
    });
    expect(replay.body.error).toBe('invalid_grant');
    const after = await mcp(next.body.access_token);
    expect(after.status).toBe(401);
    expect(after.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('lists connected apps in the profile and lets people disconnect them', async () => {
    const consent = await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
      clientId,
      redirectUri: REDIRECT,
      scopes: ['issues:read'],
      approve: true,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    const tokens = await form('/oauth/token', {
      grant_type: 'authorization_code',
      code: new URL(consent.body.redirect).searchParams.get('code') ?? '',
      code_verifier: verifier,
    });
    const grants = (await admin.request<OAuthGrant[]>('GET', '/me/oauth-grants')).body;
    expect(grants.map((grant) => [grant.client.name, grant.scopes])).toEqual([
      ['Claude Code', ['issues:read']],
    ]);
    expect((await admin.request('DELETE', `/me/oauth-grants/${grants[0]?.id}`)).status).toBe(204);
    expect((await mcp(tokens.body.access_token)).status).toBe(401);

    const denied = await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
      clientId,
      redirectUri: REDIRECT,
      scopes: [],
      approve: false,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    expect(new URL(denied.body.redirect).searchParams.get('error')).toBe('access_denied');
  });
});
