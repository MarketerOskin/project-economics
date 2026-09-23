import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { TimeDraftsManager } from '@/components/time-drafts/time-drafts-manager';
import { IncomeDraftsManager } from '@/components/income-drafts/income-drafts-manager';
import { requirePageSession } from '@/server/page-session';
import { listPendingDrafts } from '@/server/services/time-drafts';
import { listPendingIncomeDrafts } from '@/server/services/crm-income-drafts';
import { listCategories } from '@/server/services/categories';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const { session, scope } = await requirePageSession();
  if (!can.mutateFinance(session.actor)) redirect('/');

  const [timeDrafts, incomeDrafts, categories] = await Promise.all([
    listPendingDrafts(scope),
    listPendingIncomeDrafts(scope),
    listCategories(scope),
  ]);

  return (
    <>
      <PageHeader
        title="Автоматизация"
        subtitle="Из Битрикс24 автоматически подтягиваются часы по задачам и суммы сделок — подтвердите, чтобы записать в финансы проекта"
      />
      <div className="flex flex-col gap-8 px-4 sm:px-8 py-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-fg">Часы к подтверждению</h2>
          <TimeDraftsManager initial={timeDrafts} expenseCategories={categories.filter((c) => c.kind === 'EXPENSE')} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-fg">Доход по сделкам</h2>
          <IncomeDraftsManager initial={incomeDrafts} incomeCategories={categories.filter((c) => c.kind === 'INCOME')} />
        </section>
      </div>
    </>
  );
}
