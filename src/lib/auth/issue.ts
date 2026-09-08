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
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}
