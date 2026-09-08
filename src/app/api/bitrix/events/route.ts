import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** Bitrix24 outbound events. We only care about uninstall (ТЗ §43). */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const event = form?.get('event')?.toString();
  const memberId = form?.get('auth[member_id]')?.toString() ?? form?.get('data[MEMBER_ID]')?.toString();

  if ((event === 'ONAPPUNINSTALL' || event === 'ONAPPUNINSTALLED') && memberId) {
    await db.portalInstallation.updateMany({
      where: { memberId },
      data: { isActive: false, authTokenEnc: null, refreshTokenEnc: null },
    });
  }

  return NextResponse.json({ ok: true });
}
