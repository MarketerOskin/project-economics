import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

/**
 * Next 16 "proxy" (formerly middleware). Demo-mode only: when a visitor hits an app page
 * without a session, bounce them through the demo bootstrap which seeds + signs them in.
 * Production sign-in goes through the Bitrix placement handler instead.
 */
export function proxy(req: NextRequest): NextResponse {
  if (process.env.DEMO_MODE !== 'true') return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isAppPage =
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon') &&
    pathname !== '/robots.txt';

  if (isAppPage && !req.cookies.get(SESSION_COOKIE)) {
    const base = process.env.APP_URL ?? req.nextUrl.origin;
    const url = new URL('/api/demo/bootstrap', base);
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
