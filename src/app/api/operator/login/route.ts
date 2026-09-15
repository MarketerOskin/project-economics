import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyOperatorCredentials } from '@/lib/operator/session';
import { issueOperatorSession } from '@/lib/operator/issue';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Operator login. Not behind routeOperator (there's no session yet) — rate-limited by
 * IP so brute-forcing the single operator account isn't cheap.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'anon';
  const { ok, retryAfter } = rateLimit(`op-login:${ip}`, 3);
  if (!ok) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток. Подождите немного.' } },
      { status: 429, headers: { 'retry-after': String(retryAfter) } },
    );
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Введите email и пароль.' } }, { status: 400 });
  }

  const { email, password } = parsed.data;
  if (!verifyOperatorCredentials(email, password)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль.' } },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  return issueOperatorSession(res, email.trim().toLowerCase());
}
