import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { CrmSourcesManager } from '@/components/crm/crm-sources-manager';
import { requirePageSession } from '@/server/page-session';
import { listImportSources } from '@/server/services/crm-sources';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function CrmSourcesPage() {
  const { session, scope } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  const sources = await listImportSources(scope);

  return (
    <>
      <PageHeader
        title="Источники импорта из CRM"
        subtitle="Сделки и компании доступны всегда. Добавьте смарт-процессы, если проекты в вашем портале — это они"
      />
      <div className="px-4 sm:px-8 py-6">
        <CrmSourcesManager initial={sources} />
      </div>
    </>
  );
}
