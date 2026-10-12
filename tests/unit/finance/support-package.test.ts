import { describe, expect, it } from 'vitest';
import { m } from '@/domain/finance/money';
import { supportCost } from '@/domain/finance/support-package';

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
