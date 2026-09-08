import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { syncCurrentUser } from '@/lib/bitrix/auth';
import { issueSession } from '@/lib/auth/issue';
import { resolveRole } from '@/lib/auth/resolve';

export const dynamic = 'force-dynamic';

/**
 * The placement / iframe entry point. Bitrix POSTs auth context here every time the app is
 * opened. We verify the application_token, resolve the current user, issue our own session
 * cookie and redirect into the app (ТЗ §44).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const get = (k: string) => (form ? (form.get(k)?.toString() ?? null) : null);

  const memberId = get('member_id');
  const appToken = get('application_token') ?? get('AUTH_ID');
  if (!memberId || !appToken) {
    return new NextResponse('Missing Bitrix auth context', { status: 401 });
  }

  const portal = await db.portalInstallation.findUnique({ where: { memberId } });
  if (!portal || !portal.isActive) {
    return new NextResponse('Приложение не установлено на этом портале', { status: 403 });
  }
  if (portal.applicationToken && get('application_token') && portal.applicationToken !== get('application_token')) {
    return new NextResponse('Invalid application token', { status: 401 });
  }

  // Refresh this portal's access token from the inbound payload if provided.
  const authId = get('AUTH_ID');
  if (authId) {
    const { encryptToken } = await import('@/lib/bitrix/crypto');
    const refreshId = get('REFRESH_ID');
    await db.portalInstallation.update({
      where: { id: portal.id },
      data: {
        authTokenEnc: encryptToken(authId),
        ...(refreshId ? { refreshTokenEnc: encryptToken(refreshId) } : {}),
      },
    });
  }

  const fresh = await db.portalInstallation.findUnique({ where: { id: portal.id } });
  const user = await syncCurrentUser(fresh ?? portal);

  const res = NextResponse.redirect(new URL('/', process.env.APP_URL ?? req.nextUrl.origin));
  return issueSession(res, {
    portalId: portal.id,
    appUserId: user.id,
    role: resolveRole(user),
    demo: false,
  });
}

export const GET = POST;
