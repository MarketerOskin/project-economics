import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as getRoute, PUT as putRoute } from '@/app/api/setup/route';
import { GET as sessionRoute } from '@/app/api/session/route';
import { countBySemantic } from '@/lib/bitrix/section-stats';
import { monthBounds } from '@/server/services/crm-overview';
import { sectionOfPath } from '@/lib/sections';

process.env.SESSION_SECRET = 'portal-setup-test-secret-at-least-32-bytes';
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

function mockTypes() {
  vi.spyOn(global, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ result: { types: [{ id: 45, title: 'Заявки BK', entityTypeId: 1044 }] } }),
        { status: 200 },
      ),
  );
}

async function realPortal() {
  const s = await seedPortal();
  await testDb.portalInstallation.update({
    where: { id: s.portalId },
    data: {
      isDemo: false,
      restEndpoint: 'https://it.bitrix24.ru/rest/',
      authTokenEnc: encryptToken('ACCESS'),
      tokenExpiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return s;
}

describe('«Настройка под портал» (ADR-041)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    process.env.DEMO_MODE = 'true';
    await testDb.$disconnect();
  });

  it('lists leads, deals and smart processes with default roles', async () => {
    const s = await realPortal();
    mockTypes();
    const body = await (
      await getRoute(req('/api/setup', await cookie(s.portalId, s.adminId, 'ADMIN')))
    ).json();
    expect(
      body.sections.map((x: { title: string; role: string; isDefault: boolean }) => [
        x.title,
        x.role,
        x.isDefault,
      ]),
    ).toEqual([
      ['Лиды', 'TRAFFIC', true],
      ['Сделки', 'SALES', true],
      ['Заявки BK', 'PROJECTS', true],
    ]);
    expect(body.completedAt).toBeNull();
  });

  it('saves roles and switched-off sections, and the menu learns about them', async () => {
    const s = await realPortal();
    mockTypes();
    const c = await cookie(s.portalId, s.adminId, 'ADMIN');
    const res = await putRoute(
      req('/api/setup', c, {
        method: 'PUT',
        body: {
          roles: [{ entityTypeId: 1044, role: 'SUPPORT' }],
          disabledSections: ['automation', 'history'],
        },
      }),
    );
    expect(res.status).toBe(200);

    const body = await (await getRoute(req('/api/setup', c))).json();
    expect(
      body.sections.find((x: { entityTypeId: number }) => x.entityTypeId === 1044),
    ).toMatchObject({ role: 'SUPPORT', isDefault: false });
    expect(body.completedAt).not.toBeNull();

    const session = await (await sessionRoute(req('/api/session', c))).json();
    expect(session.disabledSections).toEqual(['automation', 'history']);
  });

  it('rejects an unknown section and an unknown CRM type', async () => {
    const s = await realPortal();
    mockTypes();
    const c = await cookie(s.portalId, s.adminId, 'ADMIN');
    const bad1 = await putRoute(
      req('/api/setup', c, { method: 'PUT', body: { roles: [], disabledSections: ['finance'] } }),
    );
    expect(bad1.status).toBe(400);
    const bad2 = await putRoute(
      req('/api/setup', c, {
        method: 'PUT',
        body: { roles: [{ entityTypeId: 9999, role: 'SALES' }], disabledSections: [] },
      }),
    );
    expect(bad2.status).toBe(400);
  });

  it('only those who manage settings can change it', async () => {
    const s = await realPortal();
    const res = await putRoute(
      req('/api/setup', await cookie(s.portalId, s.managerId, 'MANAGER'), {
        method: 'PUT',
        body: { roles: [], disabledSections: [] },
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('CRM section counts (ADR-041)', () => {
  it('counts by stage meaning, including lead statuses', () => {
    const c = countBySemantic(
      [
        { stageId: 'NEW', opportunity: '0' },
        { stageId: 'CONVERTED', opportunity: '0' },
        { stageId: 'JUNK', opportunity: '0' },
        { stageId: 'C3:WON', opportunity: '1500.50' },
        { stageId: 'C3:CUSTOM', opportunity: '100' },
      ],
      { 'C3:WON': 'success', 'C3:CUSTOM': 'fail' },
    );
    expect(c).toEqual({ inWork: 1, won: 2, lost: 2, wonAmounts: ['0', '1500.50'] });
  });

  it('a month is bounded in the portal time zone', () => {
    const { from, to } = monthBounds(new Date('2026-10-13T02:00:00Z'), 'Europe/Moscow');
    expect(from.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-31T21:00:00.000Z');
    const dec = monthBounds(new Date('2026-12-20T12:00:00Z'), 'Europe/Moscow');
    expect(dec.to.toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });

  it('maps menu paths to switchable sections', () => {
    expect(sectionOfPath('/analytics/team')).toBe('analytics');
    expect(sectionOfPath('/sales-funnels')).toBe('sales');
    expect(sectionOfPath('/projects')).toBeNull();
  });
});
