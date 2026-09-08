import { describe, it, expect } from 'vitest';
import { createEntrySchema, listEntriesQuerySchema } from '@/server/dto/finance';

const base = {
  projectId: 'p1',
  categoryId: 'c1',
  direction: 'EXPENSE' as const,
  budgetType: 'FACT' as const,
  operationDate: '2026-03-01',
};

describe('createEntrySchema (ТЗ §51)', () => {
  it('FIXED requires a positive amount', () => {
    expect(createEntrySchema.safeParse({ ...base, calculationMode: 'FIXED' }).success).toBe(false);
    expect(
      createEntrySchema.safeParse({ ...base, calculationMode: 'FIXED', amount: '0' }).success,
    ).toBe(false);
    expect(
      createEntrySchema.safeParse({ ...base, calculationMode: 'FIXED', amount: '50000' }).success,
    ).toBe(true);
  });

  it('HOURS_RATE requires hours > 0 and rate >= 0', () => {
    expect(
      createEntrySchema.safeParse({ ...base, calculationMode: 'HOURS_RATE', hourlyRate: '2000' })
        .success,
    ).toBe(false);
    expect(
      createEntrySchema.safeParse({
        ...base,
        calculationMode: 'HOURS_RATE',
        hours: '-1',
        hourlyRate: '2000',
      }).success,
    ).toBe(false);
    expect(
      createEntrySchema.safeParse({
        ...base,
        calculationMode: 'HOURS_RATE',
        hours: '12.5',
        hourlyRate: '2000',
      }).success,
    ).toBe(true);
    expect(
      createEntrySchema.safeParse({
        ...base,
        calculationMode: 'HOURS_RATE',
        hours: '10',
        hourlyRate: '0',
      }).success,
    ).toBe(true);
  });

  it('HOURS_RATE is rejected for INCOME', () => {
    expect(
      createEntrySchema.safeParse({
        ...base,
        direction: 'INCOME',
        calculationMode: 'HOURS_RATE',
        hours: '10',
        hourlyRate: '100',
      }).success,
    ).toBe(false);
  });

  it('parses amount as a string (Decimal-safe)', () => {
    const r = createEntrySchema.parse({ ...base, amount: '125000.50' });
    expect(r.amount).toBe('125000.50');
  });

  it('rejects a non-numeric amount', () => {
    expect(createEntrySchema.safeParse({ ...base, amount: 'abc' }).success).toBe(false);
  });
});

describe('listEntriesQuerySchema', () => {
  it('defaults: date desc, page 1, size 25, deleted hidden', () => {
    expect(listEntriesQuerySchema.parse({})).toMatchObject({
      sort: 'date',
      dir: 'desc',
      page: 1,
      pageSize: 25,
      includeDeleted: false,
    });
  });

  it('coerces page/pageSize from query strings', () => {
    const r = listEntriesQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(50);
  });
});
