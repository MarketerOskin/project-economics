import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * One analytics figure: counts and durations, not money (KpiCard is plan/fact money). With
 * `href` the card opens what the number is made of (ADR-049).
 */
export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'negative';
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="tx-mark text-accent">{label}</div>
        {href ? (
          <ChevronRight className="text-fg-tertiary group-hover:text-accent size-4 shrink-0 transition-colors" />
        ) : null}
      </div>
      <div
        className={cn(
          'font-display nums mt-2.5 text-[26px] leading-none font-bold tracking-tight',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-fg-tertiary mt-2 font-mono text-[11px]">{hint}</div> : null}
    </>
  );
  const cls = 'border border-border bg-surface p-4 transition-colors hover:border-accent';
  if (href) {
    return (
      <Link href={href} className={cn(cls, 'group block')}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">{children}</div>
  );
}
