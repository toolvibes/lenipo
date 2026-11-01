import createClient, { type Client } from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { components, paths };
export type Schemas = components['schemas'];
export type LenipoClient = Client<paths>;

export interface ClientOptions {
  /** Origin of the Lenipo installation, e.g. `https://lenipo.example.org`. Empty for same-origin browser use. */
  baseUrl?: string;
  /** Personal access token (`lp_pat_…`). Browsers use the session cookie instead. */
  token?: string;
  fetch?: typeof globalThis.fetch;
}

/** Creates a typed client; paths, parameters, bodies and responses are checked against the API. */
export function createLenipoClient(options: ClientOptions = {}): LenipoClient {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    credentials: 'same-origin',
    headers: options.token ? { authorization: `Bearer ${options.token}` } : undefined,
    fetch: options.fetch,
  });
}
