import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** Liveness + DB readiness probe for Docker / the reverse proxy. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'degraded', db: 'unreachable' }, { status: 503 });
  }
}
