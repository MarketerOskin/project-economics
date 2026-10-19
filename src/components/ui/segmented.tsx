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
      className={cn(
        'border-border bg-surface-muted inline-flex rounded-full border p-0.5',
        className,
      )}
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
            'rounded-full px-3.5 py-1.5 text-sm transition-colors',
            value === o.value
              ? 'bg-button-primary text-button-primary-fg font-semibold'
              : 'text-fg-secondary hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
