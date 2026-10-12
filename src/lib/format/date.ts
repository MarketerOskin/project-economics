const ruDate = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ruDateTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ruTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** "8 сент. 2026 г." */
export function formatDate(d: Date): string {
  return ruDate.format(d);
}

/** "8 сент. 2026 г., 14:32" */
export function formatDateTime(d: Date): string {
  return ruDateTime.format(d);
}

/** "14:32" */
export function formatTime(d: Date): string {
  return ruTime.format(d);
}

/** YYYY-MM-DD in UTC — for <input type="date"> and query params. */
export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const zonedCache = new Map<string, Intl.DateTimeFormat>();

function zoned(tz: string, kind: 'date' | 'datetime' | 'time' | 'short'): Intl.DateTimeFormat {
  const key = `${tz}:${kind}`;
  let f = zonedCache.get(key);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions =
      kind === 'date'
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : kind === 'datetime'
          ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          : kind === 'time'
            ? { hour: '2-digit', minute: '2-digit' }
            : { day: 'numeric', month: 'short' };
    f = new Intl.DateTimeFormat('ru-RU', { ...opts, timeZone: tz });
    zonedCache.set(key, f);
  }
  return f;
}

/** Analytics dates are shown in the portal's zone, not the server's: "12.10.2026". */
export function formatDateIn(d: Date | null | undefined, tz: string): string {
  return d ? zoned(tz, 'date').format(d) : '—';
}

/** "12.10.2026, 14:32" in `tz`. */
export function formatDateTimeIn(d: Date | null | undefined, tz: string): string {
  return d ? zoned(tz, 'datetime').format(d) : '—';
}

/** "14:32" in `tz`. */
export function formatTimeIn(d: Date, tz: string): string {
  return zoned(tz, 'time').format(d);
}

/** A 'YYYY-MM-DD' day key as "12 окт." (chart axes). */
export function formatDayKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return zoned('UTC', 'short').format(new Date(Date.UTC(y, m - 1, d, 12)));
}
