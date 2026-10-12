/**
 * Centralised formatting. The ₽ sign and ru-RU number/percent/date formatting live here
 * and nowhere else in the app (ТЗ §11, §17). Business logic imports from here.
 */
export { formatRub, formatRubStr, RUB_SIGN } from './money';
export { formatPercent, formatPoints, formatPercentStr, formatPointsStr } from './percent';
export { formatNumber, DASH, MINUS, NBSP } from './number';
export {
  formatDate,
  formatDateTime,
  formatTime,
  toDateInputValue,
  formatDateIn,
  formatDateTimeIn,
  formatTimeIn,
  formatDayKey,
} from './date';
export { formatDuration, formatHours } from './duration';
