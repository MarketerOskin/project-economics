import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { BulkImport } from '@/components/projects/bulk-import';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function BulkImportPage() {
  const { session } = await requirePageSession();
  if (!can.mutateProject(session.actor)) redirect('/projects');

  return (
    <>
      <PageHeader title="Добавить проекты списком" subtitle="Отметьте элементы Битрикс24 или вставьте список названий" />
      <div className="px-4 py-6 sm:px-8">
        <BulkImport />
      </div>
    </>
  );
}
