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
    <div className="border-border bg-surface border p-5">
      <div className="mb-4">
        <h3 className="tx-mark text-fg text-[15px]">{title}</h3>
        {hint ? <p className="text-fg-tertiary mt-1 text-xs">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
