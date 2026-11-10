import { describe, expect, it } from 'vitest';
import { senderVerified } from './sender-check.js';

describe('senderVerified', () => {
  it('accepts a passed DMARC check for the From domain', () => {
    expect(
      senderVerified(['mx.example.net; dmarc=pass (p=none) header.from=kunde.de'], 'anna@kunde.de'),
    ).toBe(true);
  });

  it('accepts DKIM or SPF only when aligned with the From domain', () => {
    expect(senderVerified(['mx; dkim=pass header.d=kunde.de header.s=sel'], 'anna@kunde.de')).toBe(
      true,
    );
    expect(senderVerified(['mx; dkim=pass header.d=mail.kunde.de'], 'anna@kunde.de')).toBe(true);
    expect(senderVerified(['mx; spf=pass smtp.mailfrom=bounce@kunde.de'], 'anna@kunde.de')).toBe(
      true,
    );
    expect(senderVerified(['mx; dkim=pass header.d=fremd.com'], 'anna@kunde.de')).toBe(false);
    expect(senderVerified(['mx; spf=pass smtp.mailfrom=x@fremd.com'], 'anna@kunde.de')).toBe(false);
  });

  it('refuses failed checks, other results and missing headers', () => {
    expect(
      senderVerified(['mx; dmarc=fail header.from=kunde.de; spf=softfail'], 'anna@kunde.de'),
    ).toBe(false);
    expect(senderVerified(['mx; dmarc=pass header.from=fremd.com'], 'anna@kunde.de')).toBe(false);
    expect(senderVerified([], 'anna@kunde.de')).toBe(false);
    // A suffix that is not a subdomain does not count.
    expect(senderVerified(['mx; dkim=pass header.d=bkunde.de'], 'anna@kunde.de')).toBe(false);
  });
});
