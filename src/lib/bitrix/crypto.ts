import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for Bitrix24 OAuth tokens at rest (ТЗ §42). Key = APP_ENCRYPTION_KEY,
 * a base64-encoded 32 bytes. Payload format: base64(iv).base64(tag).base64(ciphertext).
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error('APP_ENCRYPTION_KEY is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)');
  }
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted token');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Best-effort: never let a token substring reach a log line. */
export function redactTokens(input: string): string {
  return input.replace(/([?&](auth|refresh|access_token|refresh_token)=)[^&\s"]+/gi, '$1***');
}
