import { NextResponse, type NextRequest } from 'next/server';
import { CSRF_COOKIE, CSRF_HEADER, csrfOk } from '@/lib/csrf';
import { AppError, forbidden, toErrorResponse, unauthorized } from '@/lib/errors';
import { OPERATOR_COOKIE, verifyOperatorSession } from '@/lib/operator/session';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Mirrors src/server/handler.ts's `route()`, but for the operator back-office — no
 * portal, no Bitrix role, a single account authenticated against env credentials
 * (see src/lib/operator/session.ts). Deliberately a separate pipeline: an operator
 * session must never be usable where a portal ResolvedSession is expected, or vice versa.
 */

export interface OperatorContext<P = Record<string, string>> {
  req: NextRequest;
  params: P;
  operatorEmail: string;
}

type Handler<P> = (ctx: OperatorContext<P>) => Promise<Response | unknown>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function routeOperator<P = Record<string, string>>(handler: Handler<P>) {
  return async function handleRequest(
    req: NextRequest,
    segment?: { params: Promise<P> },
  ): Promise<Response> {
    try {
      if (!SAFE_METHODS.has(req.method)) {
        const cookie = req.cookies.get(CSRF_COOKIE)?.value;
        const header = req.headers.get(CSRF_HEADER);
        if (!csrfOk(cookie, header)) {
          throw forbidden('Сессия устарела, обновите страницу.');
        }
      }

      const session = await verifyOperatorSession(req.cookies.get(OPERATOR_COOKIE)?.value);
      if (!session) throw unauthorized('Требуется вход.');

      if (!SAFE_METHODS.has(req.method)) {
        const { ok, retryAfter } = rateLimit(`op-mut:${session.operatorEmail}`);
        if (!ok) {
          return NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Слишком много запросов. Подождите немного.' } },
            { status: 429, headers: { 'retry-after': String(retryAfter) } },
          );
        }
      }

      const params = (segment ? await segment.params : ({} as P)) as P;
      const ctx: OperatorContext<P> = { req, params, operatorEmail: session.operatorEmail };

      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (!(err instanceof AppError) && process.env.NODE_ENV !== 'test') {
        console.error('[routeOperator] unhandled error', err);
      }
      const mapped = toErrorResponse(err);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
  };
}
