import { SignJWT, jwtVerify } from 'jose';
import { isSecureDeployment } from '@/lib/auth/session';
import { verifyOperatorPassword } from './password';

/**
 * The operator is YOU — the app owner. Not a Bitrix24 user, not scoped to any portal,
 * not part of the ADMIN/MANAGER/EMPLOYEE role system. A single account, credentials in
 * env (ТЗ: manual billing ahead of Marketplace payment integration). Separate cookie,
 * separate JWT payload shape, so it can never be confused with a portal session.
 */

export const OPERATOR_COOKIE = 'pe_operator_session';
const ALG = 'HS256';
const TTL_SECONDS = 12 * 60 * 60;

interface OperatorPayload {
  operatorEmail: string;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (set it in .env).');
  }
  return new TextEncoder().encode(s);
}

/** Checks email + password against OPERATOR_EMAIL / OPERATOR_PASSWORD_HASH. */
export function verifyOperatorCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.OPERATOR_EMAIL;
  const hash = process.env.OPERATOR_PASSWORD_HASH;
  if (!expectedEmail || !hash) return false;
  // Constant-time-ish: always run the password check even on an email mismatch,
  // so a wrong email doesn't short-circuit faster than a wrong password.
  const emailMatches = email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const passwordMatches = verifyOperatorPassword(password, hash);
  return emailMatches && passwordMatches;
}

export async function signOperatorSession(operatorEmail: string): Promise<string> {
  return new SignJWT({ operatorEmail })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyOperatorSession(token: string | undefined | null): Promise<OperatorPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (typeof payload.operatorEmail !== 'string') return null;
    return { operatorEmail: payload.operatorEmail };
  } catch {
    return null;
  }
}

export function operatorCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isSecureDeployment(),
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  };
}
