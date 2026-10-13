import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as getRoute, PUT as putRoute } from '@/app/api/crm/time-fields/route';
import { GET as fieldsRoute } from '@/app/api/crm/time-fields/fields/route';

process.env.SESSION_SECRET = 'time-fields-test-secret-at-least-32-bytes-x';
process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

async function cookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

function req(url: string, c: string, opts: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers: new Headers({ cookie: c, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const FIELDS = {
  title: { type: 'string', title: 'Название' },
  ufCrm45_h: { type: 'double', title: 'Реальные трудозатраты, ч' },
  ufCrm45_m: { type: 'integer', title: 'Реальные трудозатраты, мин' },
  ufCrm45_who: { type: 'employee', title: 'Исполнитель' },
  ufCrm45_date: { type: 'date', title: 'Дата' },
};

function mockBitrix() {
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const method = String(url).split('/').pop()!.replace('.json', '');
    const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });
    if (method === 'crm.type.list')
      return ok({ types: [{ id: 45, title: 'Заявки BK', entityTypeId: 1044 }] });
    if (method === 'crm.item.fields') return ok({ fields: FIELDS });
    return ok(null);
  });
}

async function realPortal() {
  const s = await seedPortal();
  await testDb.portalInstallation.update({
    where: { id: s.portalId },
    data: {
      isDemo: false,
      plan: 'PRO',
      restEndpoint: 'https://it.bitrix24.ru/rest/',
      authTokenEnc: encryptToken('ACCESS'),
      tokenExpiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return s;
}

describe('time fields settings (ADR-040)', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('offers numeric fields for time and employee fields for the worker', async () => {
    const s = await realPortal();
    mockBitrix();
    const res = await fieldsRoute(
      req(
        '/api/crm/time-fields/fields?entityTypeId=1044',
        await cookie(s.portalId, s.adminId, 'ADMIN'),
      ),
    );
    const body = await res.json();
    expect(body.numeric.map((f: { name: string }) => f.name)).toEqual(['ufCrm45_m', 'ufCrm45_h']); // sorted by title
    expect(body.users.map((f: { name: string }) => f.name)).toEqual(['ufCrm45_who']);
  });

  it('saves a mapping, lists it, and clearing both time fields removes it', async () => {
    const s = await realPortal();
    mockBitrix();
    const c = await cookie(s.portalId, s.adminId, 'ADMIN');
    const saved = await putRoute(
      req('/api/crm/time-fields', c, {
        method: 'PUT',
        body: {
          entityTypeId: 1044,
          hoursField: 'ufCrm45_h',
          minutesField: 'ufCrm45_m',
          userField: null,
        },
      }),
    );
    expect(saved.status).toBe(200);

    const listed = await (await getRoute(req('/api/crm/time-fields', c))).json();
    expect(listed.mappings).toEqual([
      {
        entityTypeId: 1044,
        label: 'Заявки BK',
        hoursField: 'ufCrm45_h',
        minutesField: 'ufCrm45_m',
        userField: null,
      },
    ]);

    await putRoute(
      req('/api/crm/time-fields', c, {
        method: 'PUT',
        body: { entityTypeId: 1044, hoursField: null, minutesField: null, userField: null },
      }),
    );
    expect(await testDb.crmTimeField.count({ where: { portalId: s.portalId } })).toBe(0);
  });

  it('rejects a field the type does not have or of the wrong kind', async () => {
    const s = await realPortal();
    mockBitrix();
    const c = await cookie(s.portalId, s.adminId, 'ADMIN');
    for (const hoursField of ['ufCrm45_nope', 'ufCrm45_date']) {
      const res = await putRoute(
        req('/api/crm/time-fields', c, {
          method: 'PUT',
          body: { entityTypeId: 1044, hoursField, minutesField: null, userField: null },
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it('only those who manage settings can change it', async () => {
    const s = await realPortal();
    mockBitrix();
    const res = await putRoute(
      req('/api/crm/time-fields', await cookie(s.portalId, s.employeeId, 'EMPLOYEE'), {
        method: 'PUT',
        body: { entityTypeId: 1044, hoursField: 'ufCrm45_h', minutesField: null, userField: null },
      }),
    );
    expect(res.status).toBe(403);
  });
});
