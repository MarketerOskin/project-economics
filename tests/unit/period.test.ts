import { describe, it, expect } from 'vitest';
import { resolvePeriod, granularityFor } from '@/lib/period';

const NOW = new Date('2026-05-14T10:00:00Z');
const iso = (d: Date | undefined) => d?.toISOString().slice(0, 10);

describe('resolvePeriod', () => {
  it('this_month -> full May', () => {
    const p = resolvePeriod('this_month', undefined, NOW);
    expect(iso(p.from)).toBe('2026-05-01');
    expect(iso(p.to)).toBe('2026-05-31');
  });

  it('last_month -> full April', () => {
    const p = resolvePeriod('last_month', undefined, NOW);
    expect(iso(p.from)).toBe('2026-04-01');
    expect(iso(p.to)).toBe('2026-04-30');
  });

  it('this_quarter -> Q2 (Apr–Jun)', () => {
    const p = resolvePeriod('this_quarter', undefined, NOW);
    expect(iso(p.from)).toBe('2026-04-01');
    expect(iso(p.to)).toBe('2026-06-30');
  });

  it('this_year -> whole 2026', () => {
    const p = resolvePeriod('this_year', undefined, NOW);
    expect(iso(p.from)).toBe('2026-01-01');
    expect(iso(p.to)).toBe('2026-12-31');
  });

  it('all_time -> no bounds', () => {
    const p = resolvePeriod('all_time', undefined, NOW);
    expect(p.from).toBeUndefined();
    expect(p.to).toBeUndefined();
  });

  it('custom -> passes the given range through', () => {
    const from = new Date('2026-02-10');
    const to = new Date('2026-03-20');
    const p = resolvePeriod('custom', { from, to }, NOW);
    expect(p.from).toBe(from);
    expect(p.to).toBe(to);
  });
});

describe('granularityFor', () => {
  it('short range -> day', () => {
    expect(granularityFor(new Date('2026-05-01'), new Date('2026-05-31'))).toBe('day');
  });
  it('quarter -> week', () => {
    expect(granularityFor(new Date('2026-04-01'), new Date('2026-06-30'))).toBe('week');
  });
  it('year -> month', () => {
    expect(granularityFor(new Date('2026-01-01'), new Date('2026-12-31'))).toBe('month');
  });
});
