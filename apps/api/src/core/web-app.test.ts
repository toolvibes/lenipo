import { describe, expect, it } from 'vitest';
import { isAppNavigation } from './web-app.js';

describe('isAppNavigation', () => {
  it('serves the app for browser navigations', () => {
    expect(isAppNavigation('GET', '/', true)).toBe(true);
    expect(isAppNavigation('GET', '/projects/WEB/board', true)).toBe(true);
    expect(isAppNavigation('GET', '/oauth/authorize', true)).toBe(true);
  });

  it('leaves OAuth metadata and MCP to the API, also for clients accepting anything', () => {
    expect(isAppNavigation('GET', '/.well-known/oauth-protected-resource/mcp', true)).toBe(false);
    expect(isAppNavigation('GET', '/.well-known/oauth-authorization-server', true)).toBe(false);
    expect(isAppNavigation('GET', '/mcp', true)).toBe(false);
  });

  it('leaves API calls, other methods and non-HTML requests alone', () => {
    expect(isAppNavigation('GET', '/api/v1/me', true)).toBe(false);
    expect(isAppNavigation('GET', '/rest/api/2/search', true)).toBe(false);
    expect(isAppNavigation('GET', '/scim/v2/Users', true)).toBe(false);
    expect(isAppNavigation('POST', '/', true)).toBe(false);
    expect(isAppNavigation('GET', '/', false)).toBe(false);
  });
});
