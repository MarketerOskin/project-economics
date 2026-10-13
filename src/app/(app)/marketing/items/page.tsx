import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { channelPage, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { LoadNotices } from '@/components/analytics/notices';
import { Toolbar } from '@/components/analytics/page-parts';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { ITEM_KIND_LABELS, marketingItems, type ItemKind } from '@/server/services/marketing';
import { formatDateIn, formatNumber, formatRubStr } from '@/lib/format';
import { m } from '@/domain/finance/money';
import { drillHref } from '@/lib/drill';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

const KINDS = Object.keys(ITEM_KIND_LABELS) as ItemKind[];
const TONE: Record<string, string> = { success: 'text-positive', fail: 'text-fg-tertiary' };

/** The leads and deals behind a marketing or sales figure (ADR-049), each opening in Bitrix24. */
export default async function MarketingItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await channelPage(searchParams);
  if (!ctx.pro) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <UpsellNotice feature="Маркетинг и продажи по каналам" />
      </div>
    );
  }
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  const kind: ItemKind = KINDS.includes(get('kind') as ItemKind)
    ? (get('kind') as ItemKind)
    : 'leads';
  const source = get('source');
  const manager = get('manager');
  const { session, scope, period, tz, periodQuery } = ctx;
  const r = await marketingItems(session, scope, period, tz, { kind, source, manager });
  const back =
    ['leads', 'qualified'].includes(kind) || (kind === 'sales' && !manager)
      ? '/marketing'
      : '/marketing/sales';
  const filterLabel = source
    ? `источник: ${r.rows[0]?.source ?? (source === 'none' ? 'без источника' : source)}`
    : manager
      ? `менеджер: ${r.rows[0]?.manager ?? manager}`
      : null;

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <Link href={`${back}${periodQuery}`} className="text-accent text-sm hover:underline">
          ← Назад
        </Link>
      </Toolbar>
      <LoadNotices
        problems={r.errors.map((e) => ({ name: 'Битрикс24', text: e }))}
        fetchedAt={null}
        tz={tz}
      />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={drillHref('/marketing/items', periodQuery, { kind: k, source, manager })}
            className={cn(
              'border px-3 py-1.5 text-sm transition-colors',
              k === kind
                ? 'border-accent bg-accent text-accent-fg font-medium'
                : 'border-border bg-surface text-fg-secondary hover:border-accent hover:text-accent',
            )}
          >
            {ITEM_KIND_LABELS[k]}
          </Link>
        ))}
      </div>
      <p className="text-fg-secondary text-sm">
        {ITEM_KIND_LABELS[kind]}: {formatNumber(m(r.rows.length))}
        {kind !== 'leads' && kind !== 'qualified' ? ` на ${formatRubStr(r.amount)}` : ''}
        {filterLabel ? ` · ${filterLabel}` : ''}
        {filterLabel ? (
          <>
            {' · '}
            <Link
              href={drillHref('/marketing/items', periodQuery, { kind })}
              className="text-accent hover:underline"
            >
              показать все
            </Link>
          </>
        ) : null}
      </p>

      <div className="border-border bg-surface overflow-x-auto border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-border text-fg-tertiary border-b text-left font-mono text-[11px] tracking-[0.06em] uppercase">
              <th className="px-4 py-2.5 font-medium">Название</th>
              <th className="px-3 py-2.5 font-medium">Источник</th>
              <th className="px-3 py-2.5 font-medium">Ответственный</th>
              <th className="px-3 py-2.5 font-medium">Стадия</th>
              <th className="px-3 py-2.5 text-right font-medium">Сумма</th>
              <th className="px-3 py-2.5 font-medium">Создан</th>
              <th className="px-3 py-2.5 font-medium">Закрыт</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.key} className="border-border border-b last:border-0">
                <td className="max-w-[26rem] px-4 py-2.5">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent inline-flex items-start gap-1.5"
                  >
                    <span>{row.title}</span>
                    <ExternalLink className="text-fg-tertiary mt-1 size-3 shrink-0" />
                  </a>
                  <span className="text-fg-tertiary block text-xs">{row.section}</span>
                </td>
                <td className="text-fg-secondary px-3 py-2.5">{row.source}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{row.manager}</td>
                <td className={cn('px-3 py-2.5', TONE[row.semantic])}>{row.stage}</td>
                <td className="nums px-3 py-2.5 text-right whitespace-nowrap">
                  {m(row.amount).isZero() ? '—' : formatRubStr(row.amount)}
                </td>
                <td className="text-fg-secondary px-3 py-2.5 whitespace-nowrap">
                  {formatDateIn(new Date(row.createdAt), tz)}
                </td>
                <td className="text-fg-secondary px-3 py-2.5 whitespace-nowrap">
                  {row.closedAt ? formatDateIn(new Date(row.closedAt), tz) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.rows.length === 0 ? (
          <p className="text-fg-tertiary px-4 py-8 text-center text-sm">За период ничего нет</p>
        ) : null}
      </div>
    </div>
  );
}
