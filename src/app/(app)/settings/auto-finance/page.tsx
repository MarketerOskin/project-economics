import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { TimeDraftsManager } from '@/components/time-drafts/time-drafts-manager';
import { IncomeDraftsManager } from '@/components/income-drafts/income-drafts-manager';
import { SupportBillingManager } from '@/components/support-billing/support-billing-manager';
import { requirePageSession, requireSection } from '@/server/page-session';
import { listPendingDrafts } from '@/server/services/time-drafts';
import { listPendingIncomeDrafts } from '@/server/services/crm-income-drafts';
import { listCategories } from '@/server/services/categories';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** «Авторасчёт финансов» (ADR-045): everything that writes money into projects from Bitrix24. */
export default async function AutoFinancePage() {
  const { session, scope } = await requirePageSession();
  if (!can.mutateFinance(session.actor)) redirect('/');
  requireSection(session, 'automation');

  const [timeDrafts, incomeDrafts, categories] = await Promise.all([
    listPendingDrafts(scope),
    listPendingIncomeDrafts(scope),
    listCategories(scope),
  ]);
  const income = categories.filter((c) => c.kind === 'INCOME' && !c.isArchived);
  const expense = categories.filter((c) => c.kind === 'EXPENSE' && !c.isArchived);

  return (
    <>
      <PageHeader
        title="Авторасчёт финансов"
        subtitle="Доходы и расходы проектов считаются из Битрикс24 по часам и сделкам. Проверьте и запишите их в финансы, без ручного ввода."
      />
      <div className="flex flex-col gap-8 px-4 py-6 sm:px-8">
        <section>
          <h2 className="tx-mark text-fg mb-1 text-[15px]">Поддержка по часам</h2>
          <p className="text-fg-secondary mb-3 max-w-3xl text-sm">
            Доход: абонентская плата и часы сверх пакета по цене часа, или все часы по цене часа,
            если пакета нет. Расход: часы каждого специалиста по его ставке. Цена часа задаётся в
            проекте (вкладка «Аналитика», блок «Пакет часов»), ставки сотрудников в настройках
            команды.
          </p>
          {session.plan === 'PRO' ? (
            <SupportBillingManager incomeCategories={income} expenseCategories={expense} />
          ) : (
            <p className="text-fg-tertiary text-sm">
              Расчёт по часам из Битрикс24 доступен на тарифе Pro.
            </p>
          )}
        </section>

        <section>
          <h2 className="tx-mark text-fg mb-3 text-[15px]">Часы по задачам к подтверждению</h2>
          <TimeDraftsManager initial={timeDrafts} expenseCategories={expense} />
        </section>

        <section>
          <h2 className="tx-mark text-fg mb-3 text-[15px]">Доход по сделкам</h2>
          <IncomeDraftsManager initial={incomeDrafts} incomeCategories={income} />
        </section>
      </div>
    </>
  );
}
