import { describe, it, expect } from 'vitest';
import { m, ZERO, sum } from '@/domain/finance/money';

describe('money', () => {
  it('adds without floating-point error', () => {
    expect(m('0.1').plus(m('0.2')).toString()).toBe('0.3');
  });

  it('ZERO is zero', () => {
    expect(ZERO.isZero()).toBe(true);
  });

  it('accepts number, string and Decimal inputs equivalently', () => {
    expect(m(1000).equals(m('1000'))).toBe(true);
    expect(m(m('42.50')).toString()).toBe('42.5');
  });

  it('sum() folds a list starting from zero', () => {
    expect(sum([m('0.1'), m('0.2'), m('0.3')]).toString()).toBe('0.6');
    expect(sum([]).toString()).toBe('0');
  });

  it('keeps 2dp precision through a large aggregate', () => {
    const items = Array.from({ length: 3 }, () => m('1000000.33'));
    expect(sum(items).toString()).toBe('3000000.99');
  });
});
