import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { SESSION_HEADER } from '@/lib/auth/constants';

/**
 * Next 16 "proxy" (formerly middleware). Two independent jobs:
 *
 * 1. Session-cookie bridge (ADR-024, all modes). Some browsers block the pe_session cookie
 *    outright inside the Bitrix24 iframe — confirmed against production traffic, not a
 *    hypothesis. issueSession() carries the token in the redirect URL as a fallback; the
 *    client bridges it into localStorage and replays it as the `x-pe-session` header on every
 *    same-origin fetch afterward (see lib/client/session.tsx). Either way, this proxy injects
 *    that token into the REQUEST's own cookie jar before the page/route handler runs, so
 *    everything downstream (`cookies()` in Server Components, `req.cookies` in route()) keeps
 *    reading the one cookie jar it already reads — no changes needed there.
 *
 * 2. Demo-mode bounce (unchanged): when a visitor hits an app page without a session, bounce
 *    them through the demo bootstrap which seeds + signs them in. Production sign-in goes
 *    through the Bitrix placement handler instead.
 */
export function proxy(req: NextRequest): NextResponse {
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const urlToken = req.nextUrl.searchParams.get('pe_token');
  const bridgeToken = urlToken ?? req.headers.get(SESSION_HEADER);

  if (bridgeToken && !hasCookie) {
    // Mutating req.cookies rewrites the underlying Cookie header on req.headers; re-passing
    // those headers into NextResponse.next() is the documented way to make that mutation
    // visible downstream (Server Components' cookies(), route()'s req.cookies) for THIS request.
    req.cookies.set(SESSION_COOKIE, bridgeToken);
    const res = NextResponse.next({ request: { headers: req.headers } });
    // Best-effort: sticks for browsers that don't block it, harmless when they do.
    res.cookies.set(SESSION_COOKIE, bridgeToken, sessionCookieOptions());
    return demoBounce(req, res);
  }

  return demoBounce(req, NextResponse.next());
}

function demoBounce(req: NextRequest, res: NextResponse): NextResponse {
  if (process.env.DEMO_MODE !== 'true') return res;

  const { pathname } = req.nextUrl;
  const isAppPage =
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon') &&
    // The operator back-office is not a Bitrix24 portal page — it has its own login and
    // session cookie (see src/lib/operator/) and must never be swept into demo bootstrap.
    !pathname.startsWith('/operator') &&
    pathname !== '/robots.txt';

  if (isAppPage && !req.cookies.get(SESSION_COOKIE)) {
    const base = process.env.APP_URL ?? req.nextUrl.origin;
    const url = new URL('/api/demo/bootstrap', base);
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
