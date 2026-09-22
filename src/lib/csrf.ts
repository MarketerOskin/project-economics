import { randomBytes } from 'node:crypto';
import { isSecureDeployment } from '@/lib/auth/session';

/**
 * Double-submit CSRF. A non-HttpOnly `pe_csrf` cookie is mirrored by the client into the
 * `x-csrf-token` header on every mutating request; the server checks they match (ТЗ §44).
 */
export const CSRF_COOKIE = 'pe_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function csrfCookieOptions(): {
  httpOnly: false;
  secure: boolean;
  sameSite: 'none' | 'lax';
  partitioned: boolean;
  path: string;
  maxAge: number;
} {
  const secure = isSecureDeployment();
  return {
    httpOnly: false,
    secure,
    sameSite: secure ? 'none' : 'lax',
    // Same CHIPS reasoning as the session cookie (see sessionCookieOptions) — must match,
    // or a partitioned session cookie paired with an unpartitioned CSRF cookie would have
    // the CSRF cookie silently dropped instead while the session cookie survives.
    partitioned: secure,
    path: '/',
    maxAge: 8 * 60 * 60,
  };
}

export function csrfOk(cookieValue: string | undefined, headerValue: string | null): boolean {
  if (!cookieValue || !headerValue) return false;
  // Lengths are fixed; a plain constant-ish compare is sufficient here.
  return cookieValue === headerValue;
}
