import { NextResponse, type NextRequest } from 'next/server';
import { CSRF_COOKIE, CSRF_HEADER, csrfOk } from '@/lib/csrf';
import { AppError, forbidden, toErrorResponse, unauthorized } from '@/lib/errors';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { resolveSessionFromToken, type ResolvedSession } from '@/lib/auth/resolve';
import { SESSION_COOKIE } from '@/lib/auth/session';

export interface HandlerContext<P = Record<string, string>> {
  req: NextRequest;
  params: P;
  session: ResolvedSession;
  scope: PortalScope;
}

export interface RouteOptions {
  /** Require a valid session (default true). */
  auth?: boolean;
  /** Enforce the CSRF double-submit token on non-GET requests (default true). */
  csrf?: boolean;
}

type Handler<P> = (ctx: HandlerContext<P>) => Promise<Response | unknown>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Wraps a route handler with the standard pipeline (ТЗ §44, §52):
 *   CSRF check -> resolveSession -> build portal-scoped client -> handler -> error mapping.
 * The handler returns either a `Response` or a plain value (serialised as JSON 200).
 */
export function route<P = Record<string, string>>(handler: Handler<P>, options: RouteOptions = {}) {
  const requireAuth = options.auth ?? true;
  const requireCsrf = options.csrf ?? true;

  return async function handleRequest(
    req: NextRequest,
    segment?: { params: Promise<P> },
  ): Promise<Response> {
    try {
      if (requireCsrf && !SAFE_METHODS.has(req.method)) {
        const cookie = req.cookies.get(CSRF_COOKIE)?.value;
        const header = req.headers.get(CSRF_HEADER);
        if (!csrfOk(cookie, header)) {
          throw forbidden('Сессия устарела, обновите страницу.');
        }
      }

      const session = await resolveSessionFromToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (requireAuth && !session) throw unauthorized();

      const params = (segment ? await segment.params : ({} as P)) as P;

      const ctx: HandlerContext<P> = {
        req,
        params,
        // When auth is not required and there's no session, handlers must not touch `scope`.
        session: session as ResolvedSession,
        scope: session ? withPortal(session.portal.id) : (undefined as unknown as PortalScope),
      };

      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (!(err instanceof AppError) && process.env.NODE_ENV !== 'test') {
        // Log the internal detail server-side only; never in the response.
        console.error('[route] unhandled error', err);
      }
      const mapped = toErrorResponse(err);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
  };
}
