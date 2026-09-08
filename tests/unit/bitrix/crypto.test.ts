import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptToken, decryptToken, redactTokens } from '@/lib/bitrix/crypto';

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('token crypto (ТЗ §42)', () => {
  it('round-trips a token', () => {
    const token = 'abc.def.ghi-bitrix-access-token-value';
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'));
  });

  it('fails to decrypt with a different key', () => {
    const enc = encryptToken('secret');
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptToken(enc)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.from('too short').toString('base64');
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  it('redacts token query params from log strings', () => {
    const line = 'GET https://x.bitrix24.ru/rest/user.get?auth=SECRETTOKEN&ID=1';
    expect(redactTokens(line)).toBe('GET https://x.bitrix24.ru/rest/user.get?auth=***&ID=1');
  });
});
