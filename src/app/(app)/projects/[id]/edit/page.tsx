import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { ProjectForm } from '@/components/projects/project-form';
import { requirePageSession } from '@/server/page-session';
import { getProjectDetail } from '@/server/services/project-read';
import { can } from '@/lib/permissions';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, scope } = await requirePageSession();
  if (!can.mutateProject(session.actor)) redirect('/projects');

  const { id } = await params;
  const project = await getProjectDetail(scope, session.actor, id);

  return (
    <>
      <PageHeader title="Редактирование проекта" subtitle={project.name} />
      <div className="px-4 sm:px-8 py-6">
        <ProjectForm
          initial={{
            id: project.id,
            name: project.name,
            clientName: project.clientName,
            description: project.description,
            internalComment: project.internalComment,
            startDate: project.startDate ? toDateInputValue(project.startDate) : null,
            endDate: project.endDate ? toDateInputValue(project.endDate) : null,
            memberIds: project.members.map((m) => m.id),
          }}
        />
      </div>
    </>
  );
}
