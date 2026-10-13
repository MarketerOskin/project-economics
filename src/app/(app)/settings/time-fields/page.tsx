import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { TimeFieldsManager } from '@/components/settings/time-fields-manager';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function TimeFieldsPage() {
  const { session } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  return (
    <>
      <PageHeader
        title="Учёт времени"
        subtitle="Время берётся из учёта времени в задачах. Если в смарт-процессе или сделках его пишут в свои поля, укажите их здесь"
      />
      <div className="max-w-3xl px-4 py-6 sm:px-8">
        <TimeFieldsManager />
      </div>
    </>
  );
}
