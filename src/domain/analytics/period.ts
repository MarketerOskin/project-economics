import { addDays, startOfDay, zonedParts, zonedTime } from './time';

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Longest window analytics will compute (custom ranges are clipped to it). */
export const MAX_PERIOD_DAYS = 400;

export type AnalyticsPreset = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

export interface AnalyticsPeriod {
  /** Inclusive start (midnight in tz). */
  start: Date;
  /** Exclusive end. */
  end: Date;
  label: string;
  preset: AnalyticsPreset;
  /** 'YYYY-MM' for a month period (drives prev/next navigation). */
  month?: string;
}

export const PRESET_LABELS: Record<AnalyticsPreset, string> = {
  today: 'Сегодня',
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  month: 'Месяц',
  custom: 'Период',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dmy(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

function parseIsoDay(s: string | undefined): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function monthPeriod(year: number, month: number, tz: string): AnalyticsPeriod {
  return {
    start: zonedTime(tz, year, month, 1),
    end: zonedTime(tz, year, month + 1, 1),
    label: `${MONTHS[month - 1]} ${year}`,
    preset: 'month',
    month: `${year}-${pad(month)}`,
  };
}

/**
 * Resolve URL params (`p`, `m`, `from`, `to`) to a concrete window in `tz`. Unknown or broken
 * input falls back to the current month — the page never errors on a hand-edited URL.
 */
export function parseAnalyticsPeriod(
  params: { p?: string; m?: string; from?: string; to?: string },
  tz: string,
  now: Date = new Date(),
): AnalyticsPeriod {
  const today = startOfDay(now, tz);
  const t = zonedParts(now, tz);

  switch (params.p) {
    case 'today': {
      const p = zonedParts(today, tz);
      return { start: today, end: addDays(today, 1, tz), label: `${p.day} ${MONTHS_GEN[p.month - 1]} ${p.year}`, preset: 'today' };
    }
    case '7d':
    case '30d':
    case '90d': {
      const days = Number(params.p.slice(0, -1));
      return { start: addDays(today, -(days - 1), tz), end: addDays(today, 1, tz), label: `Последние ${days} дней`, preset: params.p };
    }
    case 'custom': {
      const f = parseIsoDay(params.from);
      const to = parseIsoDay(params.to);
      if (f && to) {
        let start = zonedTime(tz, f.y, f.m, f.d);
        const end = zonedTime(tz, to.y, to.m, to.d + 1);
        if (start < end) {
          const maxStart = addDays(end, -MAX_PERIOD_DAYS, tz);
          if (start < maxStart) start = maxStart;
          return { start, end, label: `${dmy(start, tz)} – ${dmy(addDays(end, -1, tz), tz)}`, preset: 'custom' };
        }
      }
      break;
    }
    default: {
      const match = /^(\d{4})-(\d{2})$/.exec(params.m ?? '');
      if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) {
        return monthPeriod(Number(match[1]), Number(match[2]), tz);
      }
    }
  }
  return monthPeriod(t.year, t.month, tz);
}

/** 'YYYY-MM' of the months before/after a month period. */
export function adjacentMonths(month: string): { prev: string; next: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { prev, next };
}

/** Calendar months a window touches, as [year, month] pairs. */
export function monthsTouched(period: { start: Date; end: Date }, tz: string): Array<[number, number]> {
  const first = zonedParts(period.start, tz);
  const last = zonedParts(new Date(period.end.getTime() - 1000), tz);
  const out: Array<[number, number]> = [];
  let [y, m] = [first.year, first.month];
  while (y < last.year || (y === last.year && m <= last.month)) {
    out.push([y, m]);
    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return out;
}
