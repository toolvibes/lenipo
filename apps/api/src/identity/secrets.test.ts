import { describe, expect, it } from 'vitest';
import {
  constantTimeEquals,
  hasPrefix,
  randomSecret,
  readCookie,
  readSessionCookie,
  setupCode,
  sha256,
} from './secrets.js';

describe('secrets', () => {
  it('creates distinct url-safe secrets', () => {
    const a = randomSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomSecret()).not.toBe(a);
  });

  it('hashes deterministically', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('compares in constant time', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
  });

  it('reads one cookie from a header', () => {
    expect(readCookie('a=1; tl_session=x%2By; b=2', 'tl_session')).toBe('x+y');
    expect(readCookie('a=1', 'tl_session')).toBeUndefined();
    expect(readCookie(undefined, 'tl_session')).toBeUndefined();
  });

  it('accepts cookies and tokens with the earlier prefix (E-129)', () => {
    expect(readSessionCookie('lp_session=neu; tl_session=alt')).toBe('neu');
    expect(readSessionCookie('tl_session=alt')).toBe('alt');
    expect(hasPrefix('lp_pat_abc', 'lp_pat_')).toBe(true);
    expect(hasPrefix('tl_pat_abc', 'lp_pat_')).toBe(true);
    expect(hasPrefix('tl_oat_abc', 'lp_pat_')).toBe(false);
  });

  it('formats setup codes in groups of four without ambiguous characters', () => {
    expect(setupCode()).toMatch(/^([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);
  });
});
