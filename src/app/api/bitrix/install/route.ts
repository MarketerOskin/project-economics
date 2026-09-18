import { NextResponse, type NextRequest } from 'next/server';
import { bindMenuPlacement, upsertPortalFromInstall, type BitrixAuthPayload } from '@/lib/bitrix/auth';
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
 * Bitrix24 calls this once at install time with fresh OAuth tokens (ТЗ §42).
 * We store them encrypted, seed default categories, and bind the left-menu placement.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await readPayload(req);
    const portal = await upsertPortalFromInstall(payload);
    await bindMenuPlacement(portal);

    return new NextResponse(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Установка</title></head>
       <body style="font-family:-apple-system,sans-serif;padding:40px">
         <h2>Приложение «Экономика проектов» установлено</h2>
         <p>Откройте его из пункта левого меню Bitrix24.</p>
         <script>if(window.top){try{BX24.installFinish&&BX24.installFinish()}catch(e){}}</script>
       </body></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return new NextResponse(err.userMessage, { status: err.httpStatus });
    }
    return new NextResponse('Install failed', { status: 400 });
  }
}

export const GET = POST;
