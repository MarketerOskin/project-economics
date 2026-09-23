import { NextResponse, type NextRequest } from 'next/server';
import {
  bindMenuPlacement,
  bindUninstallEvent,
  syncCurrentUser,
  upsertPortalFromInstall,
  type BitrixAuthPayload,
} from '@/lib/bitrix/auth';
import { issueSession } from '@/lib/auth/issue';
import { resolveRole } from '@/lib/auth/resolve';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * Bitrix24 splits the install payload across two places: some fields (DOMAIN, PROTOCOL,
 * LANG, APP_SID) arrive on the query string of the install URL itself, others (AUTH_ID,
 * REFRESH_ID, member_id, application_token, ...) in the POST body. Merge both — query
 * string first as a base, body values win on any overlap — so neither source alone
 * being incomplete causes a false "missing member_id / DOMAIN" rejection.
 */
async function readPayload(req: NextRequest): Promise<BitrixAuthPayload> {
  const obj: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) obj[k] = v;

  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = (await req.json().catch(() => null)) as Record<string, string> | null;
    if (json) Object.assign(obj, json);
  } else {
    const form = await req.formData().catch(() => null);
    if (form) for (const [k, v] of form.entries()) obj[k] = String(v);
  }
  return obj as unknown as BitrixAuthPayload;
}

/**
 * Bitrix24 POSTs here both at install time with fresh OAuth tokens (ТЗ §42) AND every
 * time someone opens a Local Application from Bitrix's own menu/shortcut — unlike a
 * Marketplace placement, a Local Application has no separate "open" URL, Bitrix just
 * re-POSTs the same install payload again on every open. So on every call we upsert
 * the portal (a no-op after the first time), then go straight into a session — a
 * static "installed, now open it from the menu" page is a dead end the user can never
 * get past, since that same menu item is what re-triggers this very endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await readPayload(req);
    const portal = await upsertPortalFromInstall(payload);
    await bindMenuPlacement(portal);
    await bindUninstallEvent(portal);

    const user = await syncCurrentUser(portal, payload.AUTH_ID);
    const res = NextResponse.redirect(new URL('/', process.env.APP_URL ?? req.nextUrl.origin));
    return issueSession(res, {
      portalId: portal.id,
      appUserId: user.id,
      role: resolveRole(user),
      demo: false,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return new NextResponse(err.userMessage, { status: err.httpStatus });
    }
    console.error('[bitrix/install] unhandled error', err);
    return new NextResponse('Install failed', { status: 400 });
  }
}

export const GET = POST;
