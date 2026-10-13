import { channelPage } from '@/server/analytics-page';
import type { SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { ExportButton } from '@/components/analytics/export-button';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { Section, Toolbar } from '@/components/analytics/page-parts';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { SalesTable } from '@/components/marketing/tables';
import { m } from '@/domain/finance/money';
import { formatNumber, formatPercentStr, formatRubStr } from '@/lib/format';
import { salesReport } from '@/server/services/marketing';

export const dynamic = 'force-dynamic';

/** «Продажи» (ADR-048): deals by source and by manager — created, won, lost, revenue. */
export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await channelPage(searchParams);
  if (!ctx.pro) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <UpsellNotice feature="Маркетинг и продажи по каналам" />
      </div>
    );
  }
  const { session, scope, period, tz } = ctx;
  const r = await salesReport(session, scope, period, tz, { refresh: ctx.refresh });
  const t = r.total;
  const problems = [
    ...r.errors.map((e) => ({ name: 'Битрикс24', text: e })),
    ...(r.truncated
      ? [
          {
            name: 'Много данных',
            text: 'в разделе больше 5 000 элементов за период, посчитаны первые 5 000',
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/api/marketing/export"
            extra={{ tab: 'sales', format: 'xlsx' }}
            label="XLSX"
          />
          <ExportButton
            endpoint="/api/marketing/export"
            extra={{ tab: 'sales', format: 'csv' }}
            label="CSV"
          />
        </div>
      </Toolbar>
      <LoadNotices problems={problems} fetchedAt={new Date(r.fetchedAt)} tz={tz} />

      <StatGrid>
        <Stat
          label="Создано сделок"
          value={formatNumber(m(t.created))}
          hint={`В работе ${formatNumber(m(t.inWork))}`}
        />
        <Stat label="Продажи" value={formatNumber(m(t.sales))} hint="Выиграно за период" />
        <Stat label="Выручка" value={formatRubStr(t.revenue)} />
        <Stat label="Средний чек" value={formatRubStr(t.avgCheck)} />
        <Stat
          label="Конверсия"
          value={formatPercentStr(t.conversion)}
          hint={`${formatNumber(m(t.won))} выиграно · ${formatNumber(m(t.lost))} проиграно`}
        />
        <Stat
          label="Цикл сделки"
          value={r.cycleDays === null ? '—' : `${formatNumber(m(r.cycleDays))} дн.`}
          hint="От создания до победы"
        />
      </StatGrid>

      <Section
        title="По источникам"
        hint="«Создано», «В работе», «Выиграно», «Проиграно» и конверсия — по сделкам, созданным за период. «Продажи» и «Выручка» — сделки, выигранные за период."
      >
        {r.byChannel.length ? (
          <SalesTable first="Источник" rows={r.byChannel} total={t} />
        ) : (
          <p className="text-fg-tertiary text-sm">За период сделок нет.</p>
        )}
      </Section>

      <Section title="По менеджерам">
        {r.byManager.length ? (
          <SalesTable first="Менеджер" rows={r.byManager} total={t} />
        ) : (
          <p className="text-fg-tertiary text-sm">За период сделок нет.</p>
        )}
      </Section>
    </div>
  );
}
