import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
      {icon ? <div className="mb-3 text-fg-tertiary">{icon}</div> : null}
      <h3 className="text-[15px] font-medium text-fg">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-fg-secondary">{description}</p>
      ) : null}
      {actions ? <div className="mt-5 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
