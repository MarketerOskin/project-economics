import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { HistoryFeed } from '@/components/history/history-feed';
import { Pagination } from '@/components/finance/finance-filters';
import { requirePageSession } from '@/server/page-session';
import { queryAudit } from '@/server/services/audit-read';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  if (!can.viewHistory(session.actor)) redirect('/');

  const sp = await searchParams;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? '1')) || 1;

  const { entries, total, pageSize } = await queryAudit(scope, session.actor, { page });

  return (
    <>
      <PageHeader title="История изменений" subtitle="Кто, что и когда менял" />
      <div className="flex flex-col gap-4 px-8 py-6">
        <HistoryFeed entries={entries} />
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/history" />
      </div>
    </>
  );
}
