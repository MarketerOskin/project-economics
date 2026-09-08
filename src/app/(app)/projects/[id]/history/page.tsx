import { redirect } from 'next/navigation';
import { requirePageSession } from '@/server/page-session';
import { queryAudit } from '@/server/services/audit-read';
import { HistoryFeed } from '@/components/history/history-feed';
import { Pagination } from '@/components/finance/finance-filters';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  if (!can.viewHistory(session.actor)) redirect(`/projects/${(await params).id}`);

  const { id } = await params;
  const sp = await searchParams;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? '1')) || 1;
  const { entries, total, pageSize } = await queryAudit(scope, session.actor, { projectId: id, page });
  const basePath = `/projects/${id}/history`;

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-8 py-6">
      <HistoryFeed entries={entries} />
      <Pagination page={page} pageSize={pageSize} total={total} basePath={basePath} />
    </div>
  );
}
