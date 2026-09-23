import type { NextRequest } from 'next/server';
import { syncAllPortalsSalesFunnels } from '@/server/services/sales-funnel-sync';

export const dynamic = 'force-dynamic';

/** Same shared-secret cron model as sync-hours/sync-income (ADR-027/028/029). */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) {
    return Response.json({ error: 'INTERNAL_SYNC_SECRET не задан' }, { status: 503 });
  }
  if (req.headers.get('x-sync-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const byPortal = await syncAllPortalsSalesFunnels();
    return Response.json({ ok: true, portals: byPortal });
  } catch (err) {
    console.error('[sync-sales-funnels] unhandled error', err);
    return Response.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
