import { requirePageSession } from '@/server/page-session';
import { loadOr404 } from '@/server/page-guards';
import { getProjectDetail } from '@/server/services/project-read';
import { ProjectHeader } from '@/components/projects/project-header';
import { ProjectKpi } from '@/components/projects/project-kpi';
import { ProjectTabs } from '@/components/projects/project-tabs';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { session, scope } = await requirePageSession();
  const { id } = await params;
  const project = await loadOr404(() => getProjectDetail(scope, session.actor, id));

  return (
    <>
      <ProjectHeader project={project} />
      <ProjectKpi e={project.economics} />
      <ProjectTabs projectId={project.id} canViewHistory={can.viewHistory(session.actor)} />
      {children}
    </>
  );
}
