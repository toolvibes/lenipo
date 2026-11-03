import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { createLenipoClient, type LenipoClient } from '@toolvibes/sdk';
import { type Auth, type Config, loadConfig, type Profile, saveConfig } from './config.js';

export interface Io {
  out(text: string): void;
  err(text: string): void;
  env: Record<string, string | undefined>;
  configFile: string;
  /** Opens the browser; the URL is printed as well, for machines without one. */
  openUrl(url: string): void;
  /** Width of the terminal for tables, if any. */
  columns?: number;
  /** Raw stdin/stdout for `lenipo mcp`. */
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

/** A message for the person at the terminal; no stack trace. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly code = 1,
  ) {
    super(message);
  }
}

/** Takes the problem details the API answers with and makes them readable. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) {
    const problem = error as
      | {
          detail?: string;
          title?: string;
          queryErrors?: Array<{ message: string }>;
          claimConflicts?: Array<{ issueKey: string; user: { displayName: string } }>;
        }
      | undefined;
    // Overlapping claims name who works where (TL-94).
    const conflicts = problem?.claimConflicts
      ?.map((entry) => `${entry.issueKey} (${entry.user.displayName})`)
      .join(', ');
    const detail =
      problem?.queryErrors?.map((entry) => entry.message).join('; ') ??
      (conflicts ? `${problem?.detail}: ${conflicts}` : undefined) ??
      problem?.detail ??
      problem?.title ??
      response.statusText;
    throw new CliError(`${response.status}: ${detail}`);
  }
  return data as T;
}

const normalize = (url: string) => url.replace(/\/+$/, '');

/** The profile to use: LENIPO_URL/LENIPO_TOKEN first (CI), then --profile, then the current one. */
export async function resolveProfile(
  io: Io,
  name: string | undefined,
): Promise<{ name: string | null; profile: Profile; config: Config }> {
  const config = await loadConfig(io.configFile);
  // TASKLORE_URL/TASKLORE_TOKEN are the names before the rename (E-129).
  const url = io.env.LENIPO_URL ?? io.env.TASKLORE_URL;
  const token = io.env.LENIPO_TOKEN ?? io.env.TASKLORE_TOKEN;
  if (url && token) {
    return { name: null, config, profile: { url: normalize(url), auth: { type: 'token', token } } };
  }
  const chosen = name ?? config.current;
  const profile = chosen ? config.profiles[chosen] : undefined;
  if (!chosen || !profile) {
    throw new CliError('Nicht angemeldet. Erst `lenipo login <adresse>` ausführen.', 2);
  }
  return { name: chosen, profile, config };
}

interface TokenAnswer {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(endpoint: string, body: Record<string, string>): Promise<TokenAnswer> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const answer = (await response.json()) as TokenAnswer;
  if (!response.ok) {
    throw new CliError(
      `Anmeldung fehlgeschlagen: ${answer.error_description ?? answer.error ?? response.status}`,
    );
  }
  return answer;
}

/** A current access token; OAuth tokens are refreshed shortly before they run out and saved. */
export async function accessToken(io: Io, name: string | null, profile: Profile, config: Config) {
  const auth = profile.auth;
  if (auth.type === 'token') return auth.token;
  if (auth.expiresAt - Date.now() > 60_000) return auth.accessToken;
  const answer = await tokenRequest(auth.tokenEndpoint, {
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
  }).catch((error: unknown) => {
    throw new CliError(
      `${error instanceof Error ? error.message : String(error)}. Bitte neu anmelden: lenipo login ${profile.url}`,
      2,
    );
  });
  const next: Auth = {
    ...auth,
    accessToken: answer.access_token,
    refreshToken: answer.refresh_token,
    expiresAt: Date.now() + answer.expires_in * 1000,
  };
  profile.auth = next;
  if (name) {
    config.profiles[name] = profile;
    await saveConfig(io.configFile, config);
  }
  return next.accessToken;
}

export interface Session {
  url: string;
  client: LenipoClient;
  /** Fetch with a current token, e.g. for the MCP bridge. */
  authorizedFetch: typeof fetch;
}

export async function openSession(io: Io, profileName: string | undefined): Promise<Session> {
  const { name, profile, config } = await resolveProfile(io, profileName);
  const token = await accessToken(io, name, profile, config);
  return {
    url: profile.url,
    client: createLenipoClient({ baseUrl: profile.url, token }),
    authorizedFetch: async (input, init) => {
      const fresh = await accessToken(io, name, profile, config);
      const headers = new Headers(init?.headers);
      headers.set('authorization', `Bearer ${fresh}`);
      return fetch(input, { ...init, headers });
    },
  };
}

/**
 * Sign-in in the browser (D-CLI-01, E-117): registers the CLI as a public OAuth client, waits on
 * a loopback port for the redirect, exchanges the code with PKCE and keeps the tokens.
 */
export async function oauthLogin(io: Io, url: string): Promise<Auth> {
  const metadataResponse = await fetch(`${url}/.well-known/oauth-authorization-server`);
  if (!metadataResponse.ok) {
    throw new CliError(`${url} bietet keine Anmeldung per Browser an; mit --token anmelden.`);
  }
  const metadata = (await metadataResponse.json()) as {
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint: string;
    revocation_endpoint?: string;
  };
  const registration = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: `Lenipo CLI (${hostname()})`,
      redirect_uris: ['http://127.0.0.1/callback'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!registration.ok) throw new CliError(`Registrierung abgelehnt (${registration.status})`);
  const { client_id: clientId } = (await registration.json()) as { client_id: string };

  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    let redirectUri = '';
    const server = createServer((request, response) => {
      const target = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (target.pathname !== '/callback') {
        response.writeHead(404).end();
        return;
      }
      const ok = target.searchParams.get('state') === state && target.searchParams.get('code');
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        ok
          ? '<p>Angemeldet. Dieses Fenster kann geschlossen werden.</p>'
          : '<p>Anmeldung abgebrochen.</p>',
      );
      clearTimeout(timer);
      server.close();
      if (ok) resolve({ code: target.searchParams.get('code') as string, redirectUri });
      else
        reject(
          new CliError(`Anmeldung abgebrochen: ${target.searchParams.get('error') ?? 'unbekannt'}`),
        );
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new CliError('Keine Anmeldung innerhalb von fünf Minuten'));
    }, 300_000);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      redirectUri = `http://127.0.0.1:${port}/callback`;
      const authorize = new URL(metadata.authorization_endpoint);
      for (const [key, value] of Object.entries({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        scope: 'issues:read issues:write wiki:read wiki:write',
      })) {
        authorize.searchParams.set(key, value);
      }
      io.err(`Anmeldung im Browser: ${authorize}`);
      io.openUrl(authorize.toString());
    });
  });
  const answer = await tokenRequest(metadata.token_endpoint, {
    grant_type: 'authorization_code',
    code: code.code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: code.redirectUri,
  });
  return {
    type: 'oauth',
    clientId,
    tokenEndpoint: metadata.token_endpoint,
    revocationEndpoint: metadata.revocation_endpoint ?? null,
    accessToken: answer.access_token,
    refreshToken: answer.refresh_token,
    expiresAt: Date.now() + answer.expires_in * 1000,
  };
}

export { normalize as normalizeUrl };
