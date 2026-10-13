import { describe, expect, it } from 'vitest';
import { parseSortValue } from '@/lib/sort-value';
import { formatRubStr } from '@/lib/format';
import { plural } from '@/lib/text';

describe('parseSortValue: what a table cell sorts by', () => {
  it('reads money, percent, hours and negative numbers as numbers', () => {
    expect(parseSortValue(formatRubStr('1250000.5'))).toBe(1250000.5);
    expect(parseSortValue('626,3 %')).toBe(626.3);
    expect(parseSortValue('−12,5')).toBe(-12.5);
    expect(parseSortValue('41')).toBe(41);
  });

  it('reads durations as seconds and dates as timestamps', () => {
    expect(parseSortValue('1 ч 30 мин')).toBe(5400);
    expect(parseSortValue('23 мин')).toBe(1380);
    expect(parseSortValue('2 д 3 ч')).toBe(2 * 86400 + 3 * 3600);
    expect(parseSortValue('13.10.2026')).toBe(Date.UTC(2026, 9, 13));
    expect(parseSortValue('13.10.2026, 09:56')).toBe(Date.UTC(2026, 9, 13, 9, 56));
  });

  it('keeps text as text and empty cells as null', () => {
    expect(parseSortValue('Яндекс Директ')).toBe('яндекс директ');
    expect(parseSortValue('—')).toBeNull();
    expect(parseSortValue('  ')).toBeNull();
  });
});

describe('plural', () => {
  it('picks the Russian form', () => {
    const f = (n: number) => plural(n, 'встреча', 'встречи', 'встреч');
    expect([1, 2, 5, 11, 21, 22, 25, 111].map(f)).toEqual([
      'встреча',
      'встречи',
      'встреч',
      'встреч',
      'встреча',
      'встречи',
      'встреч',
      'встреч',
    ]);
  });
});
