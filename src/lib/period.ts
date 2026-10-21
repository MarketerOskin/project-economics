export type PeriodPreset =
  'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom';

export interface Period {
  from: Date | undefined;
  to: Date | undefined;
  preset: PeriodPreset;
}

function utc(y: number, mZeroBased: number, d: number): Date {
  return new Date(Date.UTC(y, mZeroBased, d));
}

/** Resolve a preset (or explicit range) to a concrete [from, to]. `all_time` -> undefined bounds. */
export function resolvePeriod(
  preset: PeriodPreset,
  range?: { from?: Date; to?: Date },
  now: Date = new Date(),
): Period {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();

  switch (preset) {
    case 'this_month':
      return { preset, from: utc(y, mo, 1), to: utc(y, mo + 1, 0) };
    case 'last_month':
      return { preset, from: utc(y, mo - 1, 1), to: utc(y, mo, 0) };
    case 'this_quarter': {
      const q = Math.floor(mo / 3);
      return { preset, from: utc(y, q * 3, 1), to: utc(y, q * 3 + 3, 0) };
    }
    case 'this_year':
      return { preset, from: utc(y, 0, 1), to: utc(y, 11, 31) };
    case 'all_time':
      return { preset, from: undefined, to: undefined };
    case 'custom':
      return { preset, from: range?.from, to: range?.to };
  }
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  this_month: 'Этот месяц',
  last_month: 'Прошлый месяц',
  this_quarter: 'Этот квартал',
  this_year: 'Этот год',
  all_time: 'Всё время',
  custom: 'Произвольный период',
};

/** Sensible bucket size for a range: day if <= 62d, week if <= 26w, else month. */
export function granularityFor(from?: Date, to?: Date): 'day' | 'week' | 'month' {
  if (!from || !to) return 'month';
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 62) return 'day';
  if (days <= 182) return 'week';
  return 'month';
}

/**
 * The period of the same length right before [from, to], for «к прошлому периоду» (ADR-065).
 * Whole calendar months shift by months (October → September, a year → the year before);
 * any other range shifts by its length in days. Undefined for an open range.
 */
export function previousPeriod(from?: Date, to?: Date): { from: Date; to: Date } | undefined {
  if (!from || !to) return undefined;
  const dayAfterTo = utc(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1);
  if (from.getUTCDate() === 1 && dayAfterTo.getUTCDate() === 1) {
    const months =
      (dayAfterTo.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (dayAfterTo.getUTCMonth() - from.getUTCMonth());
    return {
      from: utc(from.getUTCFullYear(), from.getUTCMonth() - months, 1),
      to: utc(from.getUTCFullYear(), from.getUTCMonth(), 0),
    };
  }
  const days = Math.round((dayAfterTo.getTime() - from.getTime()) / 86_400_000);
  return {
    from: utc(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - days),
    to: utc(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - 1),
  };
}
