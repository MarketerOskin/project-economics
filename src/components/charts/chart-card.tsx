export function ChartCard({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  /** Legend or a switch at the right of the title. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface min-w-0 border p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="tx-mark text-fg text-[15px]">{title}</h3>
          {hint ? <p className="text-fg-tertiary mt-1 text-xs">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
