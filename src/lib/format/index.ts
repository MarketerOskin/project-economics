/**
 * Centralised formatting. The ₽ sign and ru-RU number/percent/date formatting live here
 * and nowhere else in the app (ТЗ §11, §17). Business logic imports from here.
 */
export { formatRub } from './money';
export { formatPercent, formatPoints } from './percent';
export { formatNumber, DASH, MINUS, NBSP } from './number';
export { formatDate, formatDateTime, formatTime, toDateInputValue } from './date';
