import { describe, expect, it } from 'vitest';
import { formatDuration, formatHours } from '@/lib/format';

const nb = (s: string) => s.replace(/ /g, ' ');

describe('duration formatting', () => {
  it('formats durations for people', () => {
    expect(formatDuration(null)).toBe('—');
    expect(nb(formatDuration(30))).toBe('< 1 мин');
    expect(nb(formatDuration(45 * 60))).toBe('45 мин');
    expect(nb(formatDuration(2 * 3600 + 15 * 60))).toBe('2 ч 15 мин');
    expect(nb(formatDuration(3 * 3600))).toBe('3 ч');
    expect(nb(formatDuration(50 * 3600))).toBe('2 д 2 ч');
  });

  it('formats hours with a decimal comma', () => {
    expect(formatHours(0)).toBe('0');
    expect(formatHours(5400)).toBe('1,5');
    expect(formatHours(4 * 3600 + 20 * 60)).toBe('4,33');
  });
});
