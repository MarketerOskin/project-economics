import { cn } from '@/lib/cn';

const MAP = {
  ACTIVE: { label: 'Активный', className: 'bg-positive-soft text-positive' },
  COMPLETED: { label: 'Завершён', className: 'bg-accent-soft text-accent' },
  ARCHIVED: { label: 'Архив', className: 'bg-surface-muted text-fg-tertiary' },
} as const;

export function StatusBadge({ status }: { status: keyof typeof MAP }) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}
