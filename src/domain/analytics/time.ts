/**
 * Wall-clock helpers for one IANA time zone without a tz library: analytics buckets days and
 * months in the portal's zone (ANALYTICS_TZ), not the server's UTC.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday ?? ""] ?? 0,
  };
}

function offsetMs(utcMs: number, tz: string): number {
  const p = zonedParts(new Date(utcMs), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The instant at which the clock in `tz` shows the given wall time. Out-of-range days roll
 * over (day 32 -> next month), which the period maths relies on.
 */
export function zonedTime(tz: string, year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = offsetMs(guess, tz);
  let t = guess - first;
  const second_ = offsetMs(t, tz);
  if (second_ !== first) t = guess - second_;
  return new Date(t);
}

/** 'YYYY-MM-DD' of the instant as seen in `tz`. */
export function dayKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Midnight in `tz` of the day `date` falls on. */
export function startOfDay(date: Date, tz: string): Date {
  const p = zonedParts(date, tz);
  return zonedTime(tz, p.year, p.month, p.day);
}

/** Midnight in `tz`, `days` days after the day `date` falls on. */
export function addDays(date: Date, days: number, tz: string): Date {
  const p = zonedParts(date, tz);
  return zonedTime(tz, p.year, p.month, p.day + days);
}

/** Every day key in [start, end). */
export function daysBetween(start: Date, end: Date, tz: string): string[] {
  const out: string[] = [];
  let d = startOfDay(start, tz);
  while (d < end) {
    out.push(dayKey(d, tz));
    d = addDays(d, 1, tz);
  }
  return out;
}
