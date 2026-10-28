import { readFileSync } from 'node:fs';

/** The API package version (src/ and dist/ both sit one level below package.json). */
export const API_VERSION: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;
