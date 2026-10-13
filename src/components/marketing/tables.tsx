import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercentStr, formatRubStr } from '@/lib/format';
import { m } from '@/domain/finance/money';
import type {
  ChannelMetricsDto,
  ChannelRowDto,
  PlanFactRowDto,
  SalesRowDto,
} from '@/server/services/marketing';

const n = (v: number | string) => formatNumber(m(v));

/** Builds the link behind a number: the kind of list and the row's source or manager. */
export type ItemHref = (kind: string, key: string | null) => string;

/** A count that opens the list it counts (ADR-049); zero stays plain text. */
function Num({ v, href }: { v: number; href?: string }) {
  if (!href || v === 0) return <>{n(v)}</>;
  return (
    <Link href={href} className="hover:text-accent underline decoration-dotted underline-offset-4">
      {n(v)}
    </Link>
  );
}

const TH = 'px-3 py-2.5 font-medium';
const TD = 'px-3 py-2.5 text-right nums';

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-border text-fg-tertiary border-b text-left font-mono text-[11px] tracking-[0.06em] uppercase">
        {cols.map((c, i) => (
          <th key={c} className={cn(TH, i > 0 && 'text-right', i === 0 && 'pl-4')}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface overflow-x-auto border">
      <table className="w-full min-w-[56rem] text-sm">{children}</table>
    </div>
  );
}

function ChannelCells({
  c,
  href,
  rowKey,
}: {
  c: ChannelMetricsDto;
  href?: ItemHref;
  rowKey: string | null;
}) {
  const romiNegative = c.romi !== null && c.romi.startsWith('-');
  return (
    <>
      <td className={TD}>{formatRubStr(c.spent)}</td>
      <td className={TD}>
        <Num v={c.leads} href={href?.('leads', rowKey)} />
      </td>
      <td className={TD}>{formatRubStr(c.cpl)}</td>
      <td className={TD}>
        <Num v={c.qualified} href={href?.('qualified', rowKey)} />
      </td>
      <td className={TD}>{formatRubStr(c.cpl2)}</td>
      <td className={cn(TD, 'text-fg-secondary')}>{formatPercentStr(c.leadToQualified)}</td>
      <td className={TD}>
        <Num v={c.sales} href={href?.('sales', rowKey)} />
      </td>
      <td className={TD}>{formatRubStr(c.cac)}</td>
      <td className={TD}>{formatRubStr(c.revenue)}</td>
      <td
        className={cn(
          TD,
          c.romi === null ? 'text-fg-tertiary' : romiNegative ? 'text-negative' : 'text-positive',
        )}
      >
        {formatPercentStr(c.romi)}
      </td>
    </>
  );
}

/** «Каналы»: spend, leads, qualified leads and sales per source, with CPL, CPL-2, CAC and ROMI. */
export function ChannelsTable({
  rows,
  total,
  href,
}: {
  rows: ChannelRowDto[];
  total: ChannelMetricsDto;
  href?: ItemHref;
}) {
  return (
    <Frame>
      <Head
        cols={[
          'Канал',
          'Расход',
          'Лиды',
          'CPL',
          'Квал. лиды',
          'CPL-2',
          'Лид → квал',
          'Продажи',
          'CAC',
          'Выручка',
          'ROMI',
        ]}
      />
      <tbody>
        {rows.map((r) => (
          <tr key={r.sourceId || 'none'} className="border-border border-b">
            <td className="text-fg px-4 py-2.5 font-medium">
              {href ? (
                <Link href={href('leads', r.sourceId)} className="hover:text-accent">
                  {r.name}
                </Link>
              ) : (
                r.name
              )}
              {!m(r.paid).isZero() ? (
                <span className="text-fg-tertiary block font-mono text-[11px] font-normal">
                  оплачено {formatRubStr(r.paid)}
                </span>
              ) : null}
            </td>
            <ChannelCells c={r} href={href} rowKey={r.sourceId} />
          </tr>
        ))}
        <tr className="bg-surface-muted font-medium">
          <td className="px-4 py-2.5">Итого</td>
          <ChannelCells c={total} href={href} rowKey={null} />
        </tr>
      </tbody>
    </Frame>
  );
}

function Progress({ done }: { done: string | null }) {
  if (done === null) return <span className="text-fg-tertiary">—</span>;
  const v = Math.max(0, Math.min(100, Number(done)));
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="bg-surface-muted hidden h-1.5 w-20 sm:inline-block">
        <span
          className={cn('block h-full', Number(done) >= 100 ? 'bg-positive' : 'bg-accent')}
          style={{ width: `${v}%` }}
        />
      </span>
      {formatPercentStr(done)}
    </span>
  );
}

/** «План / факт» for the month: plan, fact, how much is done and where the month will land. */
export function PlanFactTable({ rows }: { rows: PlanFactRowDto[] }) {
  const show = (r: PlanFactRowDto, v: string | null) =>
    v === null ? '—' : r.money ? formatRubStr(v) : n(v);
  return (
    <div className="border-border bg-surface overflow-x-auto border">
      <table className="w-full min-w-[36rem] text-sm">
        <Head cols={['Показатель', 'План', 'Факт', 'Выполнение', 'Прогноз на месяц']} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-border border-b last:border-0">
              <td className="text-fg px-4 py-2.5 font-medium">{r.label}</td>
              <td className={TD}>{show(r, r.plan)}</td>
              <td className={TD}>{show(r, r.fact)}</td>
              <td className={TD}>
                <Progress done={r.done} />
              </td>
              <td className={cn(TD, 'text-fg-secondary')}>{show(r, r.forecast)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesCells({
  r,
  href,
  rowKey,
}: {
  r: SalesRowDto;
  href?: ItemHref;
  rowKey: string | null;
}) {
  return (
    <>
      <td className={TD}>
        <Num v={r.created} href={href?.('deals', rowKey)} />
      </td>
      <td className={cn(TD, 'text-fg-secondary')}>
        <Num v={r.inWork} href={href?.('inwork', rowKey)} />
      </td>
      <td className={cn(TD, 'text-positive')}>
        <Num v={r.won} href={href?.('won', rowKey)} />
      </td>
      <td className={cn(TD, 'text-fg-tertiary')}>
        <Num v={r.lost} href={href?.('lost', rowKey)} />
      </td>
      <td className={TD}>{formatPercentStr(r.conversion)}</td>
      <td className={TD}>
        <Num v={r.sales} href={href?.('sales', rowKey)} />
      </td>
      <td className={TD}>{formatRubStr(r.revenue)}</td>
      <td className={TD}>{formatRubStr(r.avgCheck)}</td>
    </>
  );
}

/** Sales by source or by manager, with the total. */
export function SalesTable({
  first,
  rows,
  total,
  href,
}: {
  first: string;
  rows: SalesRowDto[];
  total: SalesRowDto;
  href?: ItemHref;
}) {
  return (
    <Frame>
      <Head
        cols={[
          first,
          'Создано',
          'В работе',
          'Выиграно',
          'Проиграно',
          'Конверсия',
          'Продажи',
          'Выручка',
          'Средний чек',
        ]}
      />
      <tbody>
        {rows.map((r) => (
          <tr key={r.key || 'none'} className="border-border border-b">
            <td className="text-fg px-4 py-2.5 font-medium">{r.name}</td>
            <SalesCells r={r} href={href} rowKey={r.key} />
          </tr>
        ))}
        <tr className="bg-surface-muted font-medium">
          <td className="px-4 py-2.5">Итого</td>
          <SalesCells r={total} href={href} rowKey={null} />
        </tr>
      </tbody>
    </Frame>
  );
}
