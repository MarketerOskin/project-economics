import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { assertDemoMode } from '@/lib/auth/demo';
import { seedDemoPortal } from '@/lib/demo/seed-data';
import { issueSession } from '@/lib/auth/issue';

export const dynamic = 'force-dynamic';

/** Demo entrypoint: ensure the demo portal exists, sign the visitor in as the demo ADMIN. */
export async function GET(req: NextRequest) {
  assertDemoMode();

  const { portalId } = await seedDemoPortal(db);
  const admin = await db.appUser.findFirst({
    where: { portalId, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    return NextResponse.json({ error: 'demo admin missing after seed' }, { status: 500 });
  }

  const nextParam = req.nextUrl.searchParams.get('next') ?? '/';
  const safeNext = nextParam.startsWith('/') ? nextParam : '/';
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(new URL(safeNext, base));
  return issueSession(res, { portalId, appUserId: admin.id, role: 'ADMIN', demo: true });
}
