import type { NextResponse } from 'next/server';
import { OPERATOR_COOKIE, operatorCookieOptions, signOperatorSession } from './session';
import { CSRF_COOKIE, csrfCookieOptions, newCsrfToken } from '@/lib/csrf';

/** Stamp the operator session cookie + a fresh CSRF token onto a response. */
export async function issueOperatorSession(res: NextResponse, operatorEmail: string): Promise<NextResponse> {
  const token = await signOperatorSession(operatorEmail);
  res.cookies.set(OPERATOR_COOKIE, token, operatorCookieOptions());
  res.cookies.set(CSRF_COOKIE, newCsrfToken(), csrfCookieOptions());
  return res;
}

export function clearOperatorSession(res: NextResponse): NextResponse {
  res.cookies.delete(OPERATOR_COOKIE);
  res.cookies.delete(CSRF_COOKIE);
  return res;
}
