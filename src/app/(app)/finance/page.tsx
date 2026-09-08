import { Receipt } from 'lucide-react';
import { PageHeader } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/common/empty-state';
import { EntriesTable } from '@/components/finance/entries-table';
import { EntryFormDialog } from '@/components/finance/entry-form-dialog';
import { FinanceFilters, Pagination } from '@/components/finance/finance-filters';
import { requirePageSession } from '@/server/page-session';
import { queryEntries } from '@/server/services/finance-read';
import { listEntriesQuerySchema } from '@/server/dto/finance';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const query = listEntriesQuerySchema.parse(flat);
  const { rows, total, page, pageSize } = await queryEntries(scope, session.actor, query);
  const canMutate = can.mutateFinance(session.actor);

  return (
    <>
      <PageHeader
        title="Финансы"
        subtitle="Все доступные операции по проектам"
        actions={canMutate ? <EntryFormDialog /> : null}
      />
      <div className="flex flex-col gap-4 px-4 sm:px-8 py-6">
        <FinanceFilters />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-8" />}
            title="Операций пока нет"
            description={
              canMutate
                ? 'Добавьте первый доход или расход по проекту.'
                : 'По доступным вам проектам операций ещё нет.'
            }
          />
        ) : (
          <>
            <EntriesTable rows={rows} canMutate={canMutate} />
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </div>
    </>
  );
}
