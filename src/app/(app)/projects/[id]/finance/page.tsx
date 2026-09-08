import { requirePageSession } from '@/server/page-session';
import { queryEntries } from '@/server/services/finance-read';
import { listEntriesQuerySchema } from '@/server/dto/finance';
import { EntriesTable } from '@/components/finance/entries-table';
import { EntryFormDialog } from '@/components/finance/entry-form-dialog';
import { FinanceFilters, Pagination } from '@/components/finance/finance-filters';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  const { id } = await params;
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const query = listEntriesQuerySchema.parse({ ...flat, projectId: id });
  const { rows, total, page, pageSize } = await queryEntries(scope, session.actor, query);
  const canMutate = can.mutateFinance(session.actor);
  const basePath = `/projects/${id}/finance`;

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div className="flex items-center justify-between">
        <FinanceFilters basePath={basePath} lockedProject />
        {canMutate ? <EntryFormDialog lockedProjectId={id} label="Операция" /> : null}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border py-10 text-center text-sm text-fg-tertiary">
          Операций по проекту пока нет
        </p>
      ) : (
        <>
          <EntriesTable rows={rows} canMutate={canMutate} showProject={false} />
          <Pagination page={page} pageSize={pageSize} total={total} basePath={basePath} />
        </>
      )}
    </div>
  );
}
