import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb } from '../../helpers/db';
import { POST as installRoute } from '@/app/api/bitrix/install/route';
import { POST as handlerRoute } from '@/app/api/bitrix/handler/route';
import { POST as eventsRoute } from '@/app/api/bitrix/events/route';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.SESSION_SECRET = 'bitrix-install-test-secret-32-bytes-xxxxx';
process.env.APP_URL = 'https://economics.example.com';

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://localhost/api/bitrix/x', { method: 'POST', body: fd });
}

describe('Bitrix install + handler (ТЗ §42, §44)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('install creates a portal with encrypted tokens and seeds default categories', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ result: true }), { status: 200 }));

    const res = await installRoute(
      form({
        AUTH_ID: 'ACCESS_TOKEN_VALUE',
        REFRESH_ID: 'REFRESH_TOKEN_VALUE',
        member_id: 'acme',
        DOMAIN: 'acme.bitrix24.ru',
        application_token: 'APP_TOKEN',
      }),
    );
    expect(res.status).toBe(200);

    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(portal).not.toBeNull();
    expect(portal?.authTokenEnc).toBeTruthy();
    expect(portal?.authTokenEnc).not.toContain('ACCESS_TOKEN_VALUE');
    expect(portal?.applicationToken).toBe('APP_TOKEN');

    const cats = await testDb.financeCategory.count({ where: { portalId: portal!.id } });
    expect(cats).toBe(6);
  });

  it('handler resolves the current user (admin) and issues a session cookie', async () => {
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { ID: '7', NAME: 'Пётр', LAST_NAME: 'Админов', ADMIN: true } }), { status: 200 }),
    );

    const res = await handlerRoute(
      form({ member_id: 'acme', application_token: 'APP_TOKEN', AUTH_ID: 'A2', REFRESH_ID: 'R2' }),
    );
    expect(res.status).toBe(307);
    const setCookie = res.headers.getSetCookie().join(';');
    expect(setCookie).toContain('pe_session=');

    const user = await testDb.appUser.findFirst({ where: { bitrixUserId: '7' } });
    expect(user?.isBitrixAdmin).toBe(true);
    expect(user?.role).toBe('ADMIN');
  });

  it('handler rejects a wrong application_token', async () => {
    await installRoute(
      form({ AUTH_ID: 'A', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'RIGHT' }),
    );
    const res = await handlerRoute(form({ member_id: 'acme', application_token: 'WRONG' }));
    expect(res.status).toBe(401);
  });

  it('ONAPPUNINSTALL deactivates the portal and clears tokens', async () => {
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru' }),
    );
    await eventsRoute(form({ event: 'ONAPPUNINSTALL', 'auth[member_id]': 'acme' }));
    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(portal?.isActive).toBe(false);
    expect(portal?.authTokenEnc).toBeNull();
  });
});
