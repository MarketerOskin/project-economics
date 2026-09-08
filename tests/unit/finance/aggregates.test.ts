import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import {
  aggregateProject,
  aggregateCompany,
  expenseStructure,
  timeSeries,
} from '@/domain/finance/aggregates';
import type { EntryInput } from '@/domain/finance/types';

const e = (o: Partial<EntryInput>): EntryInput => ({
  direction: 'INCOME',
  budgetType: 'FACT',
  amount: m(0),
  categoryId: 'c1',
  operationDate: new Date('2026-01-01'),
  deletedAt: null,
  ...o,
});

describe('aggregateProject', () => {
  it('computes fact profit and 30% margin (ТЗ §65)', () => {
    const r = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(1_000_000) }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(700_000) }),
    ]);
    expect(r.factIncome.toString()).toBe('1000000');
    expect(r.factExpense.toString()).toBe('700000');
    expect(r.factProfit.toString()).toBe('300000');
    expect(r.factMargin?.toString()).toBe('30');
  });

  it('excludes soft-deleted entries from every total (ТЗ §31, §65)', () => {
    const r = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(1_000_000) }),
      e({
        direction: 'EXPENSE',
        budgetType: 'FACT',
        amount: m(500_000),
        deletedAt: new Date('2026-02-01'),
      }),
    ]);
    expect(r.factExpense.toString()).toBe('0');
    expect(r.factProfit.toString()).toBe('1000000');
  });

  it('keeps PLAN and FACT independent and computes deviations (ТЗ §15, §16, §65)', () => {
    const r = aggregateProject([
      e({ budgetType: 'PLAN', direction: 'INCOME', amount: m(1_000_000) }),
      e({ budgetType: 'FACT', direction: 'INCOME', amount: m(900_000) }),
      e({ budgetType: 'PLAN', direction: 'EXPENSE', amount: m(600_000) }),
      e({ budgetType: 'FACT', direction: 'EXPENSE', amount: m(650_000) }),
    ]);
    expect(r.planIncome.toString()).toBe('1000000');
    expect(r.factIncome.toString()).toBe('900000');
    expect(r.planProfit.toString()).toBe('400000');
    expect(r.factProfit.toString()).toBe('250000');
    expect(r.incomeDeviation.toString()).toBe('-100000');
    expect(r.expenseDeviation.toString()).toBe('50000');
    expect(r.profitDeviation.toString()).toBe('-150000');
    // plan margin 40, fact margin ~27.78 -> delta in points
    expect(r.planMargin?.toString()).toBe('40');
    expect(r.marginDeltaPoints).not.toBeNull();
  });

  it('zero fact income => factMargin null, no NaN in deviation', () => {
    const r = aggregateProject([e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(100_000) })]);
    expect(r.factIncome.toString()).toBe('0');
    expect(r.factMargin).toBeNull();
    expect(r.marginDeltaPoints).toBeNull();
  });

  it('no floating-point drift across many entries (ТЗ §17, §65 decimal case)', () => {
    const entries = Array.from({ length: 30 }, () =>
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m('0.10') }),
    );
    const r = aggregateProject(entries);
    expect(r.factIncome.toString()).toBe('3');
  });
});

describe('aggregateCompany', () => {
  it('sums projects and recomputes company margin from totals', () => {
    const profitable = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(1_000_000) }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(600_000) }),
    ]);
    const lossmaking = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(200_000) }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(500_000) }),
    ]);
    const company = aggregateCompany([profitable, lossmaking]);
    expect(company.factIncome.toString()).toBe('1200000');
    expect(company.factExpense.toString()).toBe('1100000');
    expect(company.factProfit.toString()).toBe('100000');
    // 100000 / 1200000 * 100
    expect(company.factMargin?.toString()).toBe(m(100_000).div(1_200_000).times(100).toString());
  });

  it('empty company is all zeros with null margins', () => {
    const c = aggregateCompany([]);
    expect(c.factIncome.toString()).toBe('0');
    expect(c.factMargin).toBeNull();
  });
});

describe('expenseStructure', () => {
  it('groups non-deleted fact expenses by category, descending', () => {
    const r = expenseStructure(
      [
        e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(100), categoryId: 'a' }),
        e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(300), categoryId: 'b' }),
        e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(50), categoryId: 'a' }),
        e({
          direction: 'EXPENSE',
          budgetType: 'FACT',
          amount: m(999),
          categoryId: 'c',
          deletedAt: new Date(),
        }),
        e({ direction: 'INCOME', budgetType: 'FACT', amount: m(999), categoryId: 'd' }),
      ],
      'FACT',
    );
    expect(r).toEqual([
      { categoryId: 'b', amount: m(300) },
      { categoryId: 'a', amount: m(150) },
    ]);
  });
});

describe('timeSeries', () => {
  it('buckets by month, plan and fact separated', () => {
    const pts = timeSeries(
      [
        e({
          direction: 'INCOME',
          budgetType: 'FACT',
          amount: m(100),
          operationDate: new Date('2026-01-05'),
        }),
        e({
          direction: 'EXPENSE',
          budgetType: 'FACT',
          amount: m(40),
          operationDate: new Date('2026-01-20'),
        }),
        e({
          direction: 'INCOME',
          budgetType: 'PLAN',
          amount: m(200),
          operationDate: new Date('2026-02-10'),
        }),
      ],
      { from: new Date('2026-01-01'), to: new Date('2026-02-28'), granularity: 'month' },
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ bucket: '2026-01-01' });
    expect(pts[0]?.factIncome.toString()).toBe('100');
    expect(pts[0]?.factExpense.toString()).toBe('40');
    expect(pts[1]?.planIncome.toString()).toBe('200');
    expect(pts[1]?.factIncome.toString()).toBe('0');
  });

  it('ignores deleted entries', () => {
    const pts = timeSeries(
      [
        e({
          direction: 'INCOME',
          budgetType: 'FACT',
          amount: m(100),
          operationDate: new Date('2026-01-05'),
          deletedAt: new Date(),
        }),
      ],
      { from: new Date('2026-01-01'), to: new Date('2026-01-31'), granularity: 'day' },
    );
    expect(pts.every((p) => p.factIncome.isZero())).toBe(true);
  });
});
