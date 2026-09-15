import { NextResponse } from 'next/server';
import { clearOperatorSession } from '@/lib/operator/issue';

export const dynamic = 'force-dynamic';

export async function POST() {
  return clearOperatorSession(NextResponse.json({ ok: true }));
}
