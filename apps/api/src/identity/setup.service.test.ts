import { describe, expect, it } from 'vitest';
import { setupMessage, setupUrl } from './setup.service.js';

describe('setup log message', () => {
  it('names the full address when PUBLIC_URL is set', () => {
    expect(setupUrl('https://lenipo.example.org/')).toBe('https://lenipo.example.org/setup');
    expect(setupMessage('https://lenipo.example.org', 'ABCD-EFGH')).toBe(
      'Setup required. Open https://lenipo.example.org/setup and enter the setup code ABCD-EFGH (valid for 24 hours).',
    );
  });

  it('names only the path without PUBLIC_URL, never the internal API port', () => {
    expect(setupUrl(undefined)).toBe('/setup');
    const message = setupMessage(undefined, 'ABCD-EFGH');
    expect(message).toContain('/setup at the address of this installation');
    expect(message).not.toContain('4000');
  });
});
