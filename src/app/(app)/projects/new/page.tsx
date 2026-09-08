import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { ProjectForm } from '@/components/projects/project-form';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const { session } = await requirePageSession();
  if (!can.mutateProject(session.actor)) redirect('/projects');

  return (
    <>
      <PageHeader title="Новый проект" subtitle="Заполните основные данные проекта" />
      <div className="px-8 py-6">
        <ProjectForm />
      </div>
    </>
  );
}
