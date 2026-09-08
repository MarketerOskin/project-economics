import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import {
  profit,
  margin,
  hoursRateAmount,
  deviation,
  marginDeltaPoints,
} from '@/domain/finance/calculations';

describe('profit (ТЗ §65)', () => {
  it('1 000 000 income − 700 000 expense = 300 000', () => {
    expect(profit(m(1_000_000), m(700_000)).toString()).toBe('300000');
  });

  it('loss: 500 000 − 700 000 = −200 000', () => {
    expect(profit(m(500_000), m(700_000)).toString()).toBe('-200000');
  });
});

describe('margin (ТЗ §16, §65)', () => {
  it('300 000 / 1 000 000 × 100 = 30', () => {
    expect(margin(m(1_000_000), m(300_000))?.toString()).toBe('30');
  });

  it('zero income => null (never Infinity/NaN/0%)', () => {
    expect(margin(m(0), m(-100_000))).toBeNull();
    expect(margin(m(0), m(0))).toBeNull();
  });

  it('loss margin: −200 000 / 500 000 × 100 = −40', () => {
    expect(margin(m(500_000), m(-200_000))?.toString()).toBe('-40');
  });
});

describe('hoursRateAmount (ТЗ §14, §65)', () => {
  it('12.5 ч × 2 000 = 25 000', () => {
    expect(hoursRateAmount(m('12.5'), m(2000)).toString()).toBe('25000');
  });

  it('100 ч × 2 000 = 200 000', () => {
    expect(hoursRateAmount(m(100), m(2000)).toString()).toBe('200000');
  });

  it('rounds to 2 decimal places, half up', () => {
    expect(hoursRateAmount(m('1.005'), m(1)).toString()).toBe('1.01');
    expect(hoursRateAmount(m('0.333'), m('0.333')).toString()).toBe('0.11');
  });
});

describe('deviation (ТЗ §16)', () => {
  it('fact − plan', () => {
    expect(deviation(m(900_000), m(1_000_000)).toString()).toBe('-100000');
    expect(deviation(m(1_200_000), m(1_000_000)).toString()).toBe('200000');
  });
});

describe('marginDeltaPoints (ТЗ §16 — percentage points)', () => {
  it('34.2 − 30 = 4.2 points', () => {
    expect(marginDeltaPoints(m('34.2'), m(30))?.toString()).toBe('4.2');
  });

  it('null when either margin is null', () => {
    expect(marginDeltaPoints(m(30), null)).toBeNull();
    expect(marginDeltaPoints(null, m(30))).toBeNull();
    expect(marginDeltaPoints(null, null)).toBeNull();
  });
});
