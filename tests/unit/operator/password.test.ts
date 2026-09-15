import { describe, it, expect } from 'vitest';
import { hashOperatorPassword, verifyOperatorPassword } from '@/lib/operator/password';

describe('operator password hashing', () => {
  it('round-trips: correct password verifies', () => {
    const hash = hashOperatorPassword('correct-horse-battery-staple');
    expect(verifyOperatorPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashOperatorPassword('correct-horse-battery-staple');
    expect(verifyOperatorPassword('wrong-password', hash)).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', () => {
    const a = hashOperatorPassword('same-password');
    const b = hashOperatorPassword('same-password');
    expect(a).not.toBe(b);
    expect(verifyOperatorPassword('same-password', a)).toBe(true);
    expect(verifyOperatorPassword('same-password', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyOperatorPassword('anything', 'not-a-real-hash')).toBe(false);
    expect(verifyOperatorPassword('anything', 'scrypt:onlyone')).toBe(false);
  });
});
