import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { POST as bugReportRoute } from '@/app/api/support/bug-report/route';

process.env.SESSION_SECRET = 'support-test-secret-at-least-32-bytes-xxxxx';
process.env.SUPPORT_BITRIX_WEBHOOK_URL = 'https://developer.bitrix24.ru/rest/1/webhook-secret/';

async function portalCookie(portalId: string, userId: string) {
  const t = await signSession({ portalId, appUserId: userId, role: 'MANAGER', demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

function req(cookie: string, body: unknown) {
  return new NextRequest('http://localhost/api/support/bug-report', {
    method: 'POST',
    headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: JSON.stringify(body),
  });
}

describe('support: bug reports land as a lead in the developer\'s own Bitrix24', () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('posts a crm.lead.add call to the fixed webhook with the reporter and portal context', async () => {
    const s = await seedPortal();
    const calls: { url: string; body: string }[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      calls.push({ url: String(url), body: String((init as RequestInit)?.body ?? '') });
      return new Response(JSON.stringify({ result: 42 }), { status: 200 });
    });

    const res = await bugReportRoute(
      req(await portalCookie(s.portalId, s.managerId), { description: 'Кнопка «Сохранить» не реагирует', pageUrl: '/finance' }),
    );
    expect(res.status).toBe(200);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://developer.bitrix24.ru/rest/1/webhook-secret/crm.lead.add.json');
    const params = new URLSearchParams(call.body);
    expect(params.get('fields[TITLE]')).toContain('test.bitrix24.ru');
    expect(params.get('fields[COMMENTS]')).toContain('Кнопка «Сохранить» не реагирует');
    expect(params.get('fields[COMMENTS]')).toContain('test.bitrix24.ru');
    expect(params.get('fields[COMMENTS]')).toContain('/finance');
  });

  it('rejects a description that is too short, without calling the webhook', async () => {
    const s = await seedPortal();
    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await bugReportRoute(req(await portalCookie(s.portalId, s.managerId), { description: 'ой' }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await bugReportRoute(
      new NextRequest('http://localhost/api/support/bug-report', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json', cookie: `${CSRF_COOKIE}=t`, [CSRF_HEADER]: 't' }),
        body: JSON.stringify({ description: 'что-то сломалось на дашборде' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('surfaces a clear upstream error when Bitrix rejects the webhook call', async () => {
    const s = await seedPortal();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'INVALID_TOKEN', error_description: 'Wrong auth token' }), { status: 200 }),
    );

    const res = await bugReportRoute(
      req(await portalCookie(s.portalId, s.managerId), { description: 'что-то сломалось на дашборде' }),
    );
    expect(res.status).toBe(502);
  });
});
