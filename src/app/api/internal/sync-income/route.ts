import type { NextRequest } from 'next/server';
import { syncAllPortalsIncome } from '@/server/services/income-sync';

export const dynamic = 'force-dynamic';

/** Same shared-secret model as /api/internal/sync-hours (ADR-027/028) — cron, not a browser route. */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) {
    return Response.json({ error: 'INTERNAL_SYNC_SECRET не задан' }, { status: 503 });
  }
  if (req.headers.get('x-sync-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const byPortal = await syncAllPortalsIncome();
    return Response.json({ ok: true, portals: byPortal });
  } catch (err) {
    console.error('[sync-income] unhandled error', err);
    return Response.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
