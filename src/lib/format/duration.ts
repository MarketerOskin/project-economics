import { DASH, NBSP } from './number';

/** "2 ч 15 мин", "45 мин", "< 1 мин"; empty/zero -> "—". For reaction/resolution and task time. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return DASH;
  if (seconds < 60) return `<${NBSP}1${NBSP}мин`;
  const h = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const days = Math.floor(h / 24);
  if (days >= 2) {
    const rest = h % 24;
    return rest ? `${days}${NBSP}д ${rest}${NBSP}ч` : `${days}${NBSP}д`;
  }
  if (h && min) return `${h}${NBSP}ч ${min}${NBSP}мин`;
  return h ? `${h}${NBSP}ч` : `${min}${NBSP}мин`;
}

/** Seconds as decimal hours, "12,5"; 0 -> "0". The unit is added by the caller. */
export function formatHours(seconds: number | null | undefined): string {
  const h = Math.round(((seconds ?? 0) / 3600) * 100) / 100;
  return h.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace('-', '−');
}
