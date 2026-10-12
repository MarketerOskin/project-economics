export function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-surface p-5">
      <div className="mb-4">
        <h3 className="tx-mark text-accent">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-fg-tertiary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
