import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { requirePageSession, requireSection } from '@/server/page-session';
import { listSalesFunnels } from '@/server/services/sales-funnels';
import { can } from '@/lib/permissions';
import Link from 'next/link';
import { formatRubStr, formatDateTime, formatPercent } from '@/lib/format';
import { m } from '@/domain/finance/money';
import { loadCrmOverview, type SectionOverview } from '@/server/services/crm-overview';

const ROLE_LABEL = { TRAFFIC: 'Обращения и трафик', SALES: 'Продажи' } as const;

function SectionCard({ s }: { s: SectionOverview }) {
  const conversion = s.created > 0 ? m(s.won).div(s.created).times(100) : null;
  return (
    <div className="flex flex-col gap-2 border border-border bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{s.title}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-fg-tertiary">{ROLE_LABEL[s.role]}</span>
      </div>
      {s.error ? (
        <p className="text-sm text-fg-tertiary">Битрикс24 не отдал данные: {s.error}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-fg-secondary">{s.role === 'TRAFFIC' ? 'Пришло' : 'Создано'}</dt>
          <dd className="text-right tabular-nums">
            {s.created}
            {s.truncated ? '+' : ''}
          </dd>
          <dt className="text-fg-secondary">В работе</dt>
          <dd className="text-right tabular-nums">{s.inWork}</dd>
          <dt className="text-fg-secondary">Успешно</dt>
          <dd className="text-right tabular-nums text-positive">
            {s.won} · {formatPercent(conversion)}
          </dd>
          <dt className="text-fg-secondary">Провалено</dt>
          <dd className="text-right tabular-nums text-fg-tertiary">{s.lost}</dd>
          {s.role === 'SALES' ? (
            <>
              <dt className="text-fg-secondary">Сумма успешных</dt>
              <dd className="text-right tabular-nums">{formatRubStr(s.wonAmount)}</dd>
            </>
          ) : null}
        </dl>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function SalesFunnelsPage() {
  const { session, scope } = await requirePageSession();
  if (!can.viewAllProjects(session.actor)) redirect('/');
  requireSection(session, 'sales');

  if (session.plan !== 'PRO') {
    return (
      <>
        <PageHeader title="Продажи и обращения" subtitle="Первичные продажи, абонентское обслуживание и другие воронки — раздельно" />
        <div className="px-4 sm:px-8 py-6">
          <UpsellNotice feature="Статистика продаж по воронкам" />
        </div>
      </>
    );
  }

  const [{ funnels, syncedAt }, overview] = await Promise.all([listSalesFunnels(scope), loadCrmOverview(session, scope)]);

  return (
    <>
      <PageHeader
        title="Продажи и обращения"
        subtitle={syncedAt ? `Снимок из Битрикс24 на ${formatDateTime(new Date(syncedAt))}` : 'Ещё не синхронизировано'}
      />
      <div className="flex flex-col gap-6 px-4 sm:px-8 py-6">
        {!session.demo ? (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="tx-mark text-accent">Этот месяц по разделам CRM</h2>
              {can.manageSettings(session.actor) ? (
                <Link href="/setup" className="text-sm text-accent underline underline-offset-2">
                  Что считать трафиком и продажами
                </Link>
              ) : null}
            </div>
            {overview.error ? (
              <p className="text-sm text-fg-tertiary">Не удалось загрузить: {overview.error}</p>
            ) : overview.sections.length === 0 ? (
              <p className="text-sm text-fg-tertiary">
                Ни один раздел не отмечен как трафик или продажи в настройке под портал.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overview.sections.map((s) => (
                  <SectionCard key={s.entityTypeId} s={s} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <h2 className="tx-mark text-accent">Воронки сделок</h2>
        {funnels.length === 0 ? (
          <p className="text-sm text-fg-tertiary">
            Данных пока нет — ночная синхронизация ещё не прошла, либо в CRM нет сделок.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-fg-tertiary">
                  <th className="px-4 py-3 font-medium">Воронка</th>
                  <th className="px-4 py-3 text-right font-medium">В работе</th>
                  <th className="px-4 py-3 text-right font-medium">Выиграно</th>
                  <th className="px-4 py-3 text-right font-medium">Проиграно</th>
                </tr>
              </thead>
              <tbody>
                {funnels.map((f) => (
                  <tr key={f.categoryId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-fg">{f.categoryName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {f.inProgressCount} · {formatRubStr(f.inProgressAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-positive">
                      {f.wonCount} · {formatRubStr(f.wonAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-tertiary">
                      {f.lostCount} · {formatRubStr(f.lostAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
