import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * Bitrix24 outbound events. Every event carries `auth[application_token]` — we verify it
 * against the portal's stored token before acting, so an attacker who merely knows a
 * `member_id` cannot deactivate a portal / wipe its tokens (ТЗ §42, §44).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: true });

  const get = (k: string) => form.get(k)?.toString();
  const event = get('event');
  const memberId =
    get('auth[member_id]') ?? get('data[MEMBER_ID]') ?? get('member_id');
  const appToken = get('auth[application_token]') ?? get('application_token');

  // No recognisable event payload at all — ack so Bitrix doesn't retry, but do nothing.
  if (!event) return NextResponse.json({ ok: true });

  // An event that wants us to act MUST carry a valid application_token for a known portal.
  const portal = memberId
    ? await db.portalInstallation.findUnique({ where: { memberId } })
    : null;
  if (!portal || !appToken || !portal.applicationToken || portal.applicationToken !== appToken) {
    return new NextResponse('Invalid application token', { status: 401 });
  }

  if (event === 'ONAPPUNINSTALL' || event === 'ONAPPUNINSTALLED') {
    await db.portalInstallation.update({
      where: { id: portal.id },
      data: { isActive: false, authTokenEnc: null, refreshTokenEnc: null },
    });
  }

  return NextResponse.json({ ok: true });
}
