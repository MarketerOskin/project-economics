import { describe, expect, it } from 'vitest';
import { adjacentMonths, dayKey, monthsTouched, parseAnalyticsPeriod, zonedTime, MAX_PERIOD_DAYS } from '@/domain/analytics';

const KRSK = 'Asia/Krasnoyarsk'; // UTC+7
const now = new Date('2026-10-12T05:00:00Z'); // 12:00 in Krasnoyarsk

describe('analytics periods (ADR-034)', () => {
  it('zonedTime is the instant the zone clock shows that wall time', () => {
    expect(zonedTime(KRSK, 2026, 10, 1).toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(zonedTime('Europe/Moscow', 2026, 1, 1, 9).toISOString()).toBe('2026-01-01T06:00:00.000Z');
    // Day overflow rolls into the next month.
    expect(zonedTime(KRSK, 2026, 10, 32).toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('defaults to the current calendar month in the zone', () => {
    const p = parseAnalyticsPeriod({}, KRSK, now);
    expect(p.preset).toBe('month');
    expect(p.label).toBe('Октябрь 2026');
    expect(p.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('a month just after local midnight on the 1st is already the new month', () => {
    const p = parseAnalyticsPeriod({}, KRSK, new Date('2026-10-31T17:30:00Z')); // 1 Nov 00:30 local
    expect(p.label).toBe('Ноябрь 2026');
  });

  it('m=YYYY-MM picks a month; garbage falls back to the current one', () => {
    expect(parseAnalyticsPeriod({ m: '2026-02' }, KRSK, now).label).toBe('Февраль 2026');
    expect(parseAnalyticsPeriod({ m: '2026-13' }, KRSK, now).label).toBe('Октябрь 2026');
    expect(parseAnalyticsPeriod({ p: 'nonsense' }, KRSK, now).label).toBe('Октябрь 2026');
  });

  it('last N days includes today', () => {
    const p = parseAnalyticsPeriod({ p: '7d' }, KRSK, now);
    expect(dayKey(p.start, KRSK)).toBe('2026-10-06');
    expect(dayKey(new Date(p.end.getTime() - 1), KRSK)).toBe('2026-10-12');
  });

  it('custom ranges are inclusive and clipped to the maximum length', () => {
    const p = parseAnalyticsPeriod({ p: 'custom', from: '2026-10-01', to: '2026-10-05' }, KRSK, now);
    expect(p.label).toBe('01.10.2026 – 05.10.2026');
    expect(p.end.toISOString()).toBe(zonedTime(KRSK, 2026, 10, 6).toISOString());

    const long = parseAnalyticsPeriod({ p: 'custom', from: '2020-01-01', to: '2026-10-05' }, KRSK, now);
    expect(Math.round((long.end.getTime() - long.start.getTime()) / 86_400_000)).toBe(MAX_PERIOD_DAYS);

    // Reversed range -> fallback month.
    expect(parseAnalyticsPeriod({ p: 'custom', from: '2026-10-05', to: '2026-10-01' }, KRSK, now).preset).toBe('month');
  });

  it('adjacent months wrap the year', () => {
    expect(adjacentMonths('2026-01')).toEqual({ prev: '2025-12', next: '2026-02' });
    expect(adjacentMonths('2026-12')).toEqual({ prev: '2026-11', next: '2027-01' });
  });

  it('monthsTouched lists every calendar month of a window', () => {
    const p = parseAnalyticsPeriod({ p: 'custom', from: '2026-09-20', to: '2026-11-02' }, KRSK, now);
    expect(monthsTouched(p, KRSK)).toEqual([
      [2026, 9],
      [2026, 10],
      [2026, 11],
    ]);
  });
});
