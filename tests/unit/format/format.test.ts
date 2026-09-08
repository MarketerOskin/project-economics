import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import { formatRub, formatPercent, formatPoints, formatDate } from '@/lib/format';

const nbsp = ' '; // ru-RU groups with a non-breaking space

describe('formatRub', () => {
  it('renders "—" for null/undefined (ТЗ §16)', () => {
    expect(formatRub(null)).toBe('—');
    expect(formatRub(undefined)).toBe('—');
  });

  it('groups thousands and appends ₽', () => {
    expect(formatRub(m(1_250_000))).toBe(`1${nbsp}250${nbsp}000${nbsp}₽`);
  });

  it('shows kopecks only when present', () => {
    expect(formatRub(m('1000'))).toBe(`1${nbsp}000${nbsp}₽`);
    expect(formatRub(m('1000.50'))).toBe(`1${nbsp}000,5${nbsp}₽`);
  });

  it('handles negatives', () => {
    expect(formatRub(m(-200_000))).toBe(`−200${nbsp}000${nbsp}₽`);
  });
});

describe('formatPercent', () => {
  it('renders "—" for null', () => {
    expect(formatPercent(null)).toBe('—');
  });
  it('formats with one decimal by default', () => {
    expect(formatPercent(m(30))).toBe(`30,0${nbsp}%`);
    expect(formatPercent(m('-40'))).toBe(`−40,0${nbsp}%`);
  });
});

describe('formatPoints', () => {
  it('renders "—" for null', () => {
    expect(formatPoints(null)).toBe('—');
  });
  it('signed, in percentage points, not percent (ТЗ §16)', () => {
    expect(formatPoints(m('4.2'))).toBe(`+4,2${nbsp}п.п.`);
    expect(formatPoints(m('-1.3'))).toBe(`−1,3${nbsp}п.п.`);
    expect(formatPoints(m(0))).toBe(`0,0${nbsp}п.п.`);
  });
});

describe('formatDate', () => {
  it('formats a ru short date', () => {
    expect(formatDate(new Date('2026-09-08'))).toMatch(/8\s.*2026/);
  });
});
