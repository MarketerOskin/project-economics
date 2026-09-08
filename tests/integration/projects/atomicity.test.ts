import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';

process.env.SESSION_SECRET = 'atomicity-test-secret-at-least-32-bytes-xx';

// Force the audit write to fail — the whole mutation must roll back (ТЗ §52).
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return { ...actual, writeAudit: vi.fn(actual.writeAudit) };
});

const { writeAudit } = await import('@/lib/audit');
const { POST: createRoute } = await import('@/app/api/projects/route');

describe('mutation + audit atomicity', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('project is not created when the audit write throws', async () => {
    const s = await seedPortal();
    (writeAudit as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('audit down'));

    const token = await signSession({ portalId: s.portalId, appUserId: s.managerId, role: 'MANAGER', demo: false });
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: new Headers({
        cookie: `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`,
        'content-type': 'application/json',
        [CSRF_HEADER]: 't',
      }),
      body: JSON.stringify({ name: 'Должен откатиться' }),
    });

    const before = await testDb.project.count({ where: { portalId: s.portalId } });
    const res = await createRoute(req);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(await testDb.project.count({ where: { portalId: s.portalId } })).toBe(before);
  });
});
