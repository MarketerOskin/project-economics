'use client';

import { cn } from '@/lib/cn';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn('inline-flex border border-border bg-surface-muted p-0.5', className)}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 text-sm transition-colors',
            value === o.value ? 'bg-accent font-medium text-accent-fg' : 'text-fg-secondary hover:text-accent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
