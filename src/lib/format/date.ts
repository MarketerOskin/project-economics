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
