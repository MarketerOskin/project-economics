import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for the single operator account (you — the app owner). No new
 * dependency: Node's built-in scrypt is fine for one credential checked rarely.
 * Format stored in OPERATOR_PASSWORD_HASH: "scrypt:<saltHex>:<hashHex>".
 */
const KEY_LEN = 64;

export function hashOperatorPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyOperatorPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const saltHex = parts[1];
  const hashHex = parts[2];
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
