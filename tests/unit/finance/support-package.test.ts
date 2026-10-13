import { describe, expect, it } from 'vitest';
import { m } from '@/domain/finance/money';
import { supportCost, supportMonthResult } from '@/domain/finance/support-package';

const H = 3600;

describe('support package cost (ADR-034)', () => {
  it('fee per month + overage hours × rate, in Decimal', () => {
    const cost = supportCost({ monthlyFee: m('15000'), hourRate: m('2500') }, [
      { label: 'Сентябрь 2026', totalSeconds: 3 * H, limitSeconds: 4 * H, overageSeconds: 0 },
      { label: 'Октябрь 2026', totalSeconds: 5.5 * H, limitSeconds: 4 * H, overageSeconds: 1.5 * H },
    ]);
    expect(cost.hasPricing).toBe(true);
    expect(cost.months[1]!.overageCost.toString()).toBe('3750');
    expect(cost.feeTotal.toString()).toBe('30000');
    expect(cost.total.toString()).toBe('33750');
  });

  it('rounds overage money to kopecks', () => {
    const cost = supportCost({ monthlyFee: null, hourRate: m('1000') }, [
      { label: 'Октябрь 2026', totalSeconds: 0, limitSeconds: 0, overageSeconds: 1000 },
    ]);
    expect(cost.months[0]!.overageCost.toString()).toBe('277.78');
  });

  it('no fee and no rate -> hours only', () => {
    const cost = supportCost({ monthlyFee: null, hourRate: null }, [
      { label: 'Октябрь 2026', totalSeconds: 10 * H, limitSeconds: 4 * H, overageSeconds: 6 * H },
    ]);
    expect(cost.hasPricing).toBe(false);
    expect(cost.total.toString()).toBe('0');
  });
});

describe('support month result (ADR-045)', () => {
  it('without a package or fee every hour is billed at the price per hour', () => {
    const cost = supportCost({ monthlyFee: null, hourRate: m('3000') }, [
      { label: 'Сентябрь 2026', totalSeconds: 2.5 * H, limitSeconds: null, overageSeconds: 0 },
    ]);
    expect(cost.months[0]!.billableSeconds).toBe(2.5 * H);
    expect(cost.total.toString()).toBe('7500');
  });

  it('a fee without a package covers every hour', () => {
    const cost = supportCost({ monthlyFee: m('20000'), hourRate: m('3000') }, [
      { label: 'Сентябрь 2026', totalSeconds: 9 * H, limitSeconds: null, overageSeconds: 0 },
    ]);
    expect(cost.total.toString()).toBe('20000');
  });

  it('expense is each specialist hours × rate; no rate means not counted, but named', () => {
    const r = supportMonthResult(
      { monthlyFee: null, hourRate: m('3000') },
      { label: 'Сентябрь 2026', totalSeconds: 3 * H, limitSeconds: null, overageSeconds: 0 },
      [
        { userId: '2', seconds: 1.5 * H, rate: m('1500') },
        { userId: '7', seconds: 1 * H, rate: m('1000.50') },
        { userId: '9', seconds: 0.5 * H, rate: null },
        { userId: '11', seconds: 0, rate: m('5000') },
      ],
    );
    expect(r.income.toString()).toBe('9000');
    expect(r.expense.toString()).toBe('3250.5');
    expect(r.profit.toString()).toBe('5749.5');
    expect(r.missingRates).toEqual(['9']);
    expect(r.workers.map((w) => w.userId)).toEqual(['2', '7', '9']);
  });
});
