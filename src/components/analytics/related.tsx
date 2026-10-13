import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateIn, formatDuration } from '@/lib/format';
import type { RelatedGroup } from '@/lib/bitrix/related';

const TH = 'px-3 py-2.5 font-medium';
const TD = 'px-3 py-2.5';
const SHOWN = 50;

const SEMANTIC_TONE = {
  success: 'text-positive',
  closed: 'text-fg-secondary',
  fail: 'text-fg-tertiary',
  process: 'text-accent',
} as const;

/** Elements of other CRM types linked to the project's entity (ADR-039), one block per type. */
export function RelatedItems({
  groups,
  error,
  tz,
  names,
}: {
  groups: RelatedGroup[];
  error: string | null;
  tz: string;
  names: Record<string, string>;
}) {
  if (error && groups.length === 0) {
    return <p className="border border-dashed border-border px-4 py-5 text-sm text-fg-secondary">Не удалось загрузить: {error}</p>;
  }
  if (groups.length === 0) {
    return (
      <p className="border border-dashed border-border px-4 py-5 text-sm text-fg-secondary">
        В Битрикс24 нет элементов, которые ссылаются на этот проект. Сюда попадают элементы смарт-процессов и
        сделки, у которых в поле-привязке (например, «Проект») выбран этот элемент.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const count = (s: 'success' | 'fail' | 'process' | 'closed') =>
          g.items.filter((i) => (i.stageId ? g.stages[i.stageId]?.semantic : 'process') === s).length;
        return (
          <div key={g.entityTypeId} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">{g.title}</h3>
              <span className="font-mono text-[11px] text-fg-tertiary">
                всего {g.items.length}
                {g.truncated ? '+' : ''} · в работе {count('process')} · завершено {count('success') + count('closed')} · отменено {count('fail')}
                {g.seconds !== null ? ` · время ${formatDuration(g.seconds)}` : ''}
                {' · по полю '}
                {g.via.join(', ')}
              </span>
            </div>
            <div className="overflow-x-auto border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-fg-tertiary">
                    <th className={TH}>Название</th>
                    <th className={TH}>Стадия</th>
                    <th className={TH}>Ответственный</th>
                    {g.seconds !== null ? <th className={TH}>Время</th> : null}
                    <th className={TH}>Создано</th>
                    <th className={TH}>Смена стадии</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.slice(0, SHOWN).map((i) => {
                    const stage = i.stageId ? g.stages[i.stageId] : null;
                    return (
                      <tr key={i.id} className="border-b border-border last:border-0">
                        <td className={TD}>
                          <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent">
                            {i.title}
                            <ExternalLink className="size-3 text-fg-tertiary" />
                          </a>
                        </td>
                        <td className={cn(TD, stage && SEMANTIC_TONE[stage.semantic])}>{stage?.name ?? '—'}</td>
                        <td className={TD}>{(i.assignedById && names[i.assignedById]) || '—'}</td>
                        {g.seconds !== null ? <td className={cn(TD, 'nums')}>{formatDuration(i.seconds)}</td> : null}
                        <td className={cn(TD, 'nums')}>{formatDateIn(i.createdAt, tz)}</td>
                        <td className={cn(TD, 'nums')}>{formatDateIn(i.movedAt, tz)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {g.items.length > SHOWN ? (
                <p className="px-3 py-2 text-xs text-fg-tertiary">Показаны последние {SHOWN} из {g.items.length}.</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
