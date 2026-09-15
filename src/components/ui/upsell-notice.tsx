import { Lock } from 'lucide-react';

/** Shown in place of a PRO-only control for a FREE portal. Backend still enforces the gate. */
export function UpsellNotice({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-dashed border-border bg-surface-muted px-3.5 py-3 text-sm text-fg-secondary">
      <Lock className="mt-0.5 size-4 shrink-0 text-fg-tertiary" />
      <span>
        <strong className="font-medium text-fg">{feature}</strong> доступно на тарифе Pro. Свяжитесь с нами,
        чтобы подключить.
      </span>
    </div>
  );
}
