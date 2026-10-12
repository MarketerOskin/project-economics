import { AlertTriangle } from 'lucide-react';
import { formatTimeIn } from '@/lib/format';

/** Per-project load problems (missing rights, Bitrix24 down) and the data timestamp. */
export function LoadNotices({
  problems,
  fetchedAt,
  tz,
}: {
  problems: Array<{ name: string; text: string }>;
  fetchedAt: Date | null;
  tz: string;
}) {
  return (
    <>
      {problems.length > 0 ? (
        <div className="flex items-start gap-2.5 border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm text-fg-secondary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <ul className="space-y-1">
            {problems.map((p, i) => (
              <li key={i}>
                <strong className="font-medium text-fg">{p.name}:</strong> {p.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fetchedAt ? (
        <p className="font-mono text-[11px] text-fg-tertiary">Данные из Битрикс24 на {formatTimeIn(fetchedAt, tz)}</p>
      ) : null}
    </>
  );
}
