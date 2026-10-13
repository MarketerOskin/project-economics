import { describe, it, expect, vi, afterEach, afterAll, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { withPortal } from '@/lib/db/with-portal';
import { loadAnalytics } from '@/server/services/analytics';
import type { ResolvedSession } from '@/lib/auth/resolve';

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

// «Отчет по проектам BK» (1048) item 89 is the project; «Заявки BK» (1044) point at it.
const ZAYAVKI_FIELDS = {
  title: { type: 'string', title: 'Название' },
  ufCrm33_project: { type: 'crm', title: 'Проект', settings: { DYNAMIC_1048: 'Y' } },
};

function mockBitrix(opts: { zayavkiIgnored?: boolean } = {}) {
  const taskFilters: string[][] = [];
  vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
    const method = String(url).split('/').pop()!.replace('.json', '');
    const body = (init as RequestInit).body;
    const params = body instanceof URLSearchParams ? body : new URLSearchParams(String(body ?? ''));
    const text = decodeURIComponent(params.toString());
    const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });
    if (method === 'crm.type.list')
      return ok({
        types: [
          { id: 45, title: 'Заявки BK', entityTypeId: 1044 },
          { id: 47, title: 'Отчет по проектам BK', entityTypeId: 1048 },
        ],
      });
    if (method === 'batch' && text.includes('crm.item.fields'))
      return ok({ result: { f2: { fields: {} }, f1044: { fields: ZAYAVKI_FIELDS } } });
    if (method === 'batch' && text.includes('crm.status.list'))
      return ok({
        result: { s0: [{ STATUS_ID: 'DT1044_55:NEW', NAME: 'Новая', SEMANTICS: null }] },
      });
    if (method === 'batch' && text.includes('task.elapseditem.getlist')) {
      return ok({
        result: {
          t501: [{ USER_ID: '2', SECONDS: '5400', DATE_START: '2026-10-05T10:00:00+03:00' }],
        },
      });
    }
    if (method === 'crm.item.list') {
      if (opts.zayavkiIgnored) throw new Error('an ignored section must not be read');
      return ok({
        items: text.includes('filter[ufCrm33_project]=89')
          ? [
              {
                id: 3097,
                title: 'Доработки по дашборду',
                stageId: 'DT1044_55:NEW',
                categoryId: 55,
                assignedById: 2,
                createdTime: '2026-10-01T10:00:00+03:00',
              },
            ]
          : [],
      });
    }
    if (method === 'tasks.task.list') {
      const bindings = [...params.entries()]
        .filter(([k]) => k.startsWith('filter[UF_CRM_TASK]'))
        .map(([, v]) => v);
      taskFilters.push(bindings);
      // The project's own binding has no tasks; the linked request has one with 1.5 h.
      const tasks = bindings.includes('T414_3097')
        ? [
            {
              id: 501,
              title: 'Собрать выгрузку',
              status: '5',
              responsibleId: 2,
              createdDate: '2026-10-02T09:00:00+03:00',
              closedDate: '2026-10-07T18:00:00+03:00',
              timeSpentInLogs: 5400,
            },
          ]
        : [];
      return ok({ tasks });
    }
    return ok(null);
  });
  return { taskFilters };
}

describe('linked elements in project tasks and hours (ADR-046)', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    process.env.DEMO_MODE = 'false';
    const s = await seedPortal();
    const portal = await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: {
        plan: 'PRO',
        restEndpoint: 'https://it.bitrix24.ru/rest/',
        domain: 'it.bitrix24.ru',
        authTokenEnc: encryptToken('ACCESS'),
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        usersSyncedAt: new Date(),
      },
    });
    const project = await testDb.project.create({
      data: {
        portalId: s.portalId,
        name: 'BK',
        sourceType: 'BITRIX_CRM',
        crmEntityTypeId: 1048,
        crmEntityId: '89',
      },
    });
    const user = await testDb.appUser.findUniqueOrThrow({ where: { id: s.managerId } });
    const session = {
      portal,
      user,
      actor: { userId: user.id, role: 'MANAGER' },
      demo: false,
      plan: 'PRO',
    } as unknown as ResolvedSession;
    return { s, project, session, scope: withPortal(s.portalId) };
  }

  it('a linked element without its own time is not a task row; tasks bound to it bring their time (ADR-051)', async () => {
    const { project, session, scope } = await setup();
    const { taskFilters } = mockBitrix();

    const world = await loadAnalytics(session, scope, { projectId: project.id, refresh: true });
    const p = world.projects[0]!;
    expect(p.error).toBeNull();
    expect(p.tasks.map((t) => t.title)).toEqual(['Собрать выгрузку']);
    expect(p.entries).toEqual([
      {
        taskId: 501,
        userId: '2',
        seconds: 5400,
        // Hours sit on the task's closing date (ADR-056), not when they were logged.
        at: new Date('2026-10-07T15:00:00Z'),
        comment: '',
      },
    ]);
    expect(taskFilters.some((f) => f.includes('T414_3097'))).toBe(true);
  });

  it('sections set to «Не использовать» bring nothing in', async () => {
    const { s, project, session, scope } = await setup();
    await testDb.crmSectionRole.create({
      data: { portalId: s.portalId, entityTypeId: 1044, label: 'Заявки BK', role: 'IGNORE' },
    });
    mockBitrix({ zayavkiIgnored: true });

    const world = await loadAnalytics(session, scope, { projectId: project.id, refresh: true });
    expect(world.projects[0]!.tasks).toEqual([]);
  });
});
