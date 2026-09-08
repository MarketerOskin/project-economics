import type { AppRole } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  portalId: string;
  appUserId: string;
  /** Role stamped at issue time — a convenience. Protected handlers re-resolve it from the DB. */
  role: AppRole;
  demo: boolean;
}

export const SESSION_COOKIE = 'pe_session';
const ALG = 'HS256';
const TTL_SECONDS = 8 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (set it in .env).');
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (
      typeof payload.portalId !== 'string' ||
      typeof payload.appUserId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.demo !== 'boolean'
    ) {
      return null;
    }
    return {
      portalId: payload.portalId,
      appUserId: payload.appUserId,
      role: payload.role as AppRole,
      demo: payload.demo,
    };
  } catch {
    return null;
  }
}

/**
 * Cookie policy follows the deployment URL, not NODE_ENV:
 *   https:// → Secure + SameSite=None  (required for the Bitrix24 iframe)
 *   http://  → not Secure + SameSite=Lax  (an http demo by IP; Secure cookies would
 *              be dropped by the browser and the session would loop)
 */
export function isSecureDeployment(): boolean {
  const url = process.env.APP_URL ?? '';
  if (url.startsWith('https://')) return true;
  if (url.startsWith('http://')) return false;
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  maxAge: number;
} {
  const secure = isSecureDeployment();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  };
}
