import { requirePageSession } from '@/server/page-session';
import { getProjectDetail } from '@/server/services/project-read';
import { TeamManager } from '@/components/projects/team-manager';

export const dynamic = 'force-dynamic';

export default async function ProjectTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, scope } = await requirePageSession();
  const { id } = await params;
  const project = await getProjectDetail(scope, session.actor, id);

  return (
    <div className="px-4 sm:px-8 py-6">
      <TeamManager
        projectId={project.id}
        members={project.members}
        canManage={project.canManageMembers}
      />
    </div>
  );
}
