import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from './http.js';
import { generateSecret, sign } from './signature.js';

describe('Standard Webhooks signature', () => {
  it('matches the example from the specification', () => {
    expect(
      sign(
        'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
        'msg_p5jXN8AQM9LWM0D4loKWxJek',
        1614265330,
        '{"test": 2432232314}',
      ),
    ).toBe('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });

  it('generates distinct secrets in the whsec_ format', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9+/]{43}=$/);
    expect(generateSecret()).not.toBe(secret);
  });
});

describe('isPrivateAddress', () => {
  it('blocks loopback, private, link-local and metadata addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.178.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const address of ['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});
