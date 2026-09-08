import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { withPortal } from '@/lib/db/with-portal';
import { AppError } from '@/lib/errors';

describe('withPortal — portal isolation (ТЗ §54)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('findByIdOrThrow refuses a row from another portal', async () => {
    const a = await seedPortal();
    const b = await seedPortal();
    const projectB = await testDb.project.create({ data: { portalId: b.portalId, name: 'B' } });

    const scopeA = withPortal(a.portalId, testDb);
    await expect(scopeA.project.findByIdOrThrow(projectB.id)).rejects.toBeInstanceOf(AppError);
  });

  it('findMany only returns the scoped portal rows', async () => {
    const a = await seedPortal();
    const b = await seedPortal();
    await testDb.project.create({ data: { portalId: a.portalId, name: 'A1' } });
    await testDb.project.create({ data: { portalId: a.portalId, name: 'A2' } });
    await testDb.project.create({ data: { portalId: b.portalId, name: 'B1' } });

    const rows = await withPortal(a.portalId, testDb).project.findMany();
    expect(rows.map((r) => r.name).sort()).toEqual(['A1', 'A2']);
  });

  it('create injects portalId', async () => {
    const a = await seedPortal();
    const created = await withPortal(a.portalId, testDb).project.create({ name: 'New' });
    expect(created.portalId).toBe(a.portalId);
  });

  it('scopedWhere always carries portalId for raw groupBy/aggregate', () => {
    const scope = withPortal('portal_x', testDb);
    expect(scope.scopedWhere({ status: 'ACTIVE' })).toEqual({
      portalId: 'portal_x',
      status: 'ACTIVE',
    });
  });
});
