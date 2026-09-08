import { describe, it, expect } from 'vitest';
import { createProjectSchema, updateProjectSchema, listProjectsQuerySchema } from '@/server/dto/project';

describe('createProjectSchema', () => {
  it('accepts a minimal valid project', () => {
    const r = createProjectSchema.parse({ name: '  Внедрение CRM  ' });
    expect(r.name).toBe('Внедрение CRM');
    expect(r.status).toBe('ACTIVE');
    expect(r.source).toBe('MANUAL');
    expect(r.memberIds).toEqual([]);
  });

  it('rejects an empty name', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects endDate earlier than startDate', () => {
    const r = createProjectSchema.safeParse({
      name: 'X',
      startDate: '2026-05-01',
      endDate: '2026-04-01',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('endDate'))).toBe(true);
    }
  });

  it('accepts equal start and end dates', () => {
    expect(
      createProjectSchema.safeParse({ name: 'X', startDate: '2026-05-01', endDate: '2026-05-01' })
        .success,
    ).toBe(true);
  });

  it('parses dates into Date objects', () => {
    const r = createProjectSchema.parse({ name: 'X', startDate: '2026-01-15' });
    expect(r.startDate).toBeInstanceOf(Date);
  });
});

describe('updateProjectSchema', () => {
  it('does not allow setting status to ARCHIVED (archive has its own endpoint)', () => {
    expect(updateProjectSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('listProjectsQuerySchema', () => {
  it('defaults status ACTIVE, sort profit desc', () => {
    const r = listProjectsQuerySchema.parse({});
    expect(r).toMatchObject({ status: 'ACTIVE', sort: 'profit', dir: 'desc' });
  });
});
