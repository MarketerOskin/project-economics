import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import { marginSeries, profitSeries, relativeChange } from '@/domain/finance/trends';

describe('relativeChange', () => {
  it('is the percent change against the previous value', () => {
    expect(relativeChange(m(150), m(100))!.toString()).toBe('50');
    expect(relativeChange(m(50), m(100))!.toString()).toBe('-50');
  });
  it('measures against the magnitude of a negative previous value', () => {
    // A loss of 100 turning into a profit of 50 is an improvement, not a "−150 %".
    expect(relativeChange(m(50), m(-100))!.toString()).toBe('150');
  });
  it('is null when there is nothing to compare against', () => {
    expect(relativeChange(m(10), m(0))).toBeNull();
  });
});

describe('profitSeries / marginSeries', () => {
  const pts = [
    { factIncome: m(1000), factExpense: m(600) },
    { factIncome: m(0), factExpense: m(200) },
  ];
  it('derives profit per bucket', () => {
    expect(profitSeries(pts).map(String)).toEqual(['400', '-200']);
  });
  it('leaves margin undefined where there is no income', () => {
    expect(marginSeries(pts).map((v) => (v === null ? null : v.toString()))).toEqual(['40', null]);
  });
});
