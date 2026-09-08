import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { CategoriesManager } from '@/components/categories/categories-manager';
import { requirePageSession } from '@/server/page-session';
import { listCategories } from '@/server/services/categories';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const { session, scope } = await requirePageSession();
  if (!can.manageCategories(session.actor)) redirect('/');

  const categories = await listCategories(scope, { includeArchived: true });

  return (
    <>
      <PageHeader
        title="Статьи доходов и расходов"
        subtitle="Управляйте статьями, их цветом и порядком"
      />
      <div className="px-8 py-6">
        <CategoriesManager initial={categories} />
      </div>
    </>
  );
}
