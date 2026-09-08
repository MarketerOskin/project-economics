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
    <div className="rounded-[16px] border border-border bg-surface p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {hint ? <p className="text-xs text-fg-tertiary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
