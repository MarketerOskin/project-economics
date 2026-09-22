import type { NextRequest } from 'next/server';
import { syncAllPortals } from '@/server/services/time-sync';

export const dynamic = 'force-dynamic';

/**
 * Machine-to-machine endpoint for the VPS system crontab (ADR-027) — not a browser route, so
 * it deliberately doesn't go through `route()` (no Bitrix session exists for a cron call).
 * Auth is a single shared secret in a header, matching SUPPORT_BITRIX_WEBHOOK_URL's model of
 * "server-to-server secret, not a user session".
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) {
    return Response.json({ error: 'INTERNAL_SYNC_SECRET не задан' }, { status: 503 });
  }
  if (req.headers.get('x-sync-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const byPortal = await syncAllPortals();
    return Response.json({ ok: true, portals: byPortal });
  } catch (err) {
    console.error('[sync-hours] unhandled error', err);
    return Response.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
