import { channelPage } from '@/server/analytics-page';
import type { SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { ExportButton } from '@/components/analytics/export-button';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { Section, Toolbar } from '@/components/analytics/page-parts';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { ChannelsTable, PlanFactTable } from '@/components/marketing/tables';
import { MarketingEditor } from '@/components/marketing/marketing-editor';
import { MONTHS, dayKey } from '@/domain/analytics';
import { m } from '@/domain/finance/money';
import { formatNumber, formatPercentStr, formatRubStr } from '@/lib/format';
import { marketingReport } from '@/server/services/marketing';

export const dynamic = 'force-dynamic';

function monthLabel(month: string): string {
  const [y, mo] = month.split('-').map(Number) as [number, number];
  return `${MONTHS[mo - 1]} ${y}`;
}

/** «Маркетинг» (ADR-048): spend, leads, qualified leads and sales by channel, plan against fact. */
export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await channelPage(searchParams);
  if (!ctx.pro) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <UpsellNotice feature="Маркетинг и продажи по каналам" />
      </div>
    );
  }
  const { session, scope, period, tz } = ctx;
  const r = await marketingReport(session, scope, period, tz, { refresh: ctx.refresh });
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
            extra={{ tab: 'marketing', format: 'xlsx' }}
            label="XLSX"
          />
          <ExportButton
            endpoint="/api/marketing/export"
            extra={{ tab: 'marketing', format: 'csv' }}
            label="CSV"
          />
        </div>
      </Toolbar>
      <LoadNotices problems={problems} fetchedAt={new Date(r.fetchedAt)} tz={tz} />

      <StatGrid>
        <Stat
          label="Расход (реализовано)"
          value={formatRubStr(t.spent)}
          hint={`Оплачено ${formatRubStr(t.paid)}`}
        />
        <Stat label="Лиды" value={formatNumber(m(t.leads))} hint={`CPL ${formatRubStr(t.cpl)}`} />
        <Stat
          label="Квал. лиды"
          value={formatNumber(m(t.qualified))}
          hint={`CPL-2 ${formatRubStr(t.cpl2)} · ${formatPercentStr(t.leadToQualified)}`}
        />
        <Stat
          label="Продажи"
          value={formatNumber(m(t.sales))}
          hint={`CAC ${formatRubStr(t.cac)}`}
        />
        <Stat
          label="Выручка"
          value={formatRubStr(t.revenue)}
          hint={`Средний чек ${formatRubStr(t.avgCheck)}`}
        />
        <Stat
          label="ROMI"
          value={formatPercentStr(t.romi)}
          hint={`Лид → продажа ${formatPercentStr(t.leadToSale)}`}
          tone={t.romi !== null && t.romi.startsWith('-') ? 'negative' : undefined}
        />
      </StatGrid>

      {ctx.canEdit ? (
        <div>
          <MarketingEditor
            report={r}
            month={r.planMonth}
            monthLabel={monthLabel(r.planMonth)}
            today={dayKey(new Date(), tz)}
          />
        </div>
      ) : null}

      <Section
        title="Каналы"
        hint="Канал — источник лида или сделки в Битрикс24. CPL, CPL-2 и CAC считаются от реализованного бюджета, а не от пополнений кабинета."
      >
        {r.channels.length ? (
          <ChannelsTable rows={r.channels} total={t} />
        ) : (
          <p className="text-fg-tertiary text-sm">
            За период нет ни лидов, ни продаж, ни расходов.
          </p>
        )}
      </Section>

      <Section
        title={`План / факт · ${monthLabel(r.planMonth)}`}
        hint={r.planFact ? 'Прогноз — где окажется месяц, если темп сохранится.' : undefined}
      >
        {r.planFact ? (
          <PlanFactTable rows={r.planFact} />
        ) : (
          <p className="text-fg-tertiary text-sm">
            План сравнивается с фактом по месяцу: выберите период «Месяц».
          </p>
        )}
        {r.reverse && (r.reverse.leads !== null || r.reverse.budget !== null) ? (
          <p className="text-fg-secondary mt-3 text-sm">
            Обратный план: на {formatNumber(m(r.reverse.sales))} продаж при текущих конверсиях нужно{' '}
            {r.reverse.qualified !== null
              ? `${formatNumber(m(r.reverse.qualified))} квал. лидов, `
              : ''}
            {r.reverse.leads !== null ? `${formatNumber(m(r.reverse.leads))} лидов` : ''}
            {r.reverse.budget !== null ? ` и ${formatRubStr(r.reverse.budget)} бюджета` : ''}.
          </p>
        ) : null}
      </Section>
    </div>
  );
}
