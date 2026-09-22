import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { TimeDraftsManager } from '@/components/time-drafts/time-drafts-manager';
import { requirePageSession } from '@/server/page-session';
import { listPendingDrafts } from '@/server/services/time-drafts';
import { listCategories } from '@/server/services/categories';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function TimeDraftsPage() {
  const { session, scope } = await requirePageSession();
  if (!can.mutateFinance(session.actor)) redirect('/');

  const [drafts, categories] = await Promise.all([
    listPendingDrafts(scope),
    listCategories(scope),
  ]);

  return (
    <>
      <PageHeader
        title="Часы к подтверждению"
        subtitle="Автоматически собраны из задач Битрикс24, привязанных к проектам из CRM — подтвердите, чтобы записать как расход"
      />
      <div className="px-4 sm:px-8 py-6">
        <TimeDraftsManager initial={drafts} expenseCategories={categories.filter((c) => c.kind === 'EXPENSE')} />
      </div>
    </>
  );
}
