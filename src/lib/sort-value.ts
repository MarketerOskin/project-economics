import { RUB_SIGN } from '@/lib/format';

/**
 * What a table cell sorts by (ADR-050): a date, a duration, a number (money, percent, hours)
 * or the text itself. Empty cells and «—» sort last whatever the direction.
 */

const DATE = /^(\d{2})\.(\d{2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/;
const UNIT = new RegExp(`(?:${RUB_SIGN}|%|п\\.п\\.|ч)$`, 'u');
const DURATION = /^(?:<\s*)?(?:(\d+)\s*д)?\s*(?:(\d+)\s*ч)?\s*(?:(\d+)\s*мин)?$/;

export function parseSortValue(raw: string): number | string | null {
  const text = raw.replace(/[  ]/g, ' ').trim();
  if (!text || text === '—' || text === '-') return null;

  const date = DATE.exec(text);
  if (date) {
    const [, d, m, y, h = '0', min = '0'] = date;
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }

  const dur = DURATION.exec(text);
  if (dur && (dur[1] || dur[2] || dur[3])) {
    return Number(dur[1] ?? 0) * 86400 + Number(dur[2] ?? 0) * 3600 + Number(dur[3] ?? 0) * 60;
  }

  const num = text.replace(/[−–]/g, '-').replace(/\s/g, '').replace(UNIT, '').replace(',', '.');
  if (/^[+-]?\d+(\.\d+)?$/.test(num)) return Number(num);

  return text.toLowerCase();
}
