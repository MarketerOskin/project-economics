import { cn } from '@/lib/cn';

/** One analytics figure: counts and durations, not money (KpiCard is plan/fact money). */
export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'negative' }) {
  return (
    <div className="border border-border bg-surface p-4 transition-colors hover:border-accent">
      <div className="tx-mark text-accent">{label}</div>
      <div className={cn('font-display mt-2.5 text-[26px] font-bold leading-none tracking-tight nums', tone === 'negative' && 'text-negative')}>
        {value}
      </div>
      {hint ? <div className="mt-2 font-mono text-[11px] text-fg-tertiary">{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">{children}</div>;
}
