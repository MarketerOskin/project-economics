import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { requirePageSession } from '@/server/page-session';
import { listSalesFunnels } from '@/server/services/sales-funnels';
import { can } from '@/lib/permissions';
import { formatRubStr, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SalesFunnelsPage() {
  const { session, scope } = await requirePageSession();
  if (!can.viewAllProjects(session.actor)) redirect('/');

  if (session.plan !== 'PRO') {
    return (
      <>
        <PageHeader title="Продажи по воронкам" subtitle="Первичные продажи, абонентское обслуживание и другие воронки — раздельно" />
        <div className="px-4 sm:px-8 py-6">
          <UpsellNotice feature="Статистика продаж по воронкам" />
        </div>
      </>
    );
  }

  const { funnels, syncedAt } = await listSalesFunnels(scope);

  return (
    <>
      <PageHeader
        title="Продажи по воронкам"
        subtitle={syncedAt ? `Снимок из Битрикс24 на ${formatDateTime(new Date(syncedAt))}` : 'Ещё не синхронизировано'}
      />
      <div className="px-4 sm:px-8 py-6">
        {funnels.length === 0 ? (
          <p className="text-sm text-fg-tertiary">
            Данных пока нет — ночная синхронизация ещё не прошла, либо в CRM нет сделок.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-secondary">
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
