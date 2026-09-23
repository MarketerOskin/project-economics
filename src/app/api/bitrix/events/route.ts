import { NextResponse, type NextRequest } from 'next/server';
import { handleBitrixEvent } from '@/lib/bitrix/events';

export const dynamic = 'force-dynamic';

/**
 * Bitrix24 outbound events (documented target — see ADR-030 for why /api/bitrix/install also
 * has to recognise these for some app configurations).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: true });

  const payload: Record<string, string> = {};
  for (const [k, v] of form.entries()) payload[k] = String(v);

  const { status, body } = await handleBitrixEvent(payload);
  return NextResponse.json(body, { status });
}
