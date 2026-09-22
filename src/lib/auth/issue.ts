import type { NextResponse } from 'next/server';
import type { AppRole } from '@prisma/client';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from './session';
import { CSRF_COOKIE, csrfCookieOptions, newCsrfToken } from '@/lib/csrf';

/**
 * Stamp a signed session cookie + a fresh CSRF token onto a response.
 * Used by the Bitrix placement handler and the demo bootstrap / role switch.
 */
export async function issueSession(
  res: NextResponse,
  input: { portalId: string; appUserId: string; role: AppRole; demo: boolean },
): Promise<NextResponse> {
  const token = await signSession(input);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(CSRF_COOKIE, newCsrfToken(), csrfCookieOptions());

  // Some browsers block this cookie outright inside the Bitrix24 iframe — SameSite=None and
  // even Partitioned/CHIPS don't help, confirmed against production traffic (ADR-024), not a
  // hypothesis. When this response is a redirect (install/handler/demo-bootstrap all are),
  // carry the token in the target URL too, so proxy.ts can bridge it into the request cookie
  // jar for this and later loads even when the Set-Cookie above never survives the round trip.
  const location = res.headers.get('location');
  if (location) {
    const url = new URL(location);
    url.searchParams.set('pe_token', token);
    res.headers.set('location', url.toString());
  }

  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}
