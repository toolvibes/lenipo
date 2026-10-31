import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, totpCode, verifyTotp } from './totp.js';

// RFC 6238 appendix B: the SHA-1 test secret "12345678901234567890".
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (TL-18)', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(totpCode(SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpCode(SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpCode(SECRET, Math.floor(1234567890 / 30))).toBe('005924');
  });

  it('round-trips base32', () => {
    expect(base32Decode(SECRET).toString()).toBe('12345678901234567890');
  });

  it('accepts one step of drift and refuses replays', () => {
    const now = 1111111109 * 1000;
    const step = Math.floor(1111111109 / 30);
    expect(verifyTotp(SECRET, totpCode(SECRET, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(SECRET, totpCode(SECRET, step - 2), null, now)).toBeNull();
    expect(verifyTotp(SECRET, totpCode(SECRET, step), step, now)).toBeNull();
    expect(verifyTotp(SECRET, 'abc', null, now)).toBeNull();
  });
});
