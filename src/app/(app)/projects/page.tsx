import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/common/empty-state';
import { ProjectFilters } from '@/components/projects/project-filters';
import { ProjectsTable } from '@/components/projects/projects-table';
import { Button } from '@/components/ui/button';
import { requirePageSession } from '@/server/page-session';
import { queryProjects } from '@/server/services/project-read';
import { listProjectsQuerySchema } from '@/server/dto/project';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const query = listProjectsQuerySchema.parse(flat);
  const rows = await queryProjects(scope, session.actor, query);
  const canCreate = can.mutateProject(session.actor);

  return (
    <>
      <PageHeader
        title="Проекты"
        subtitle="Экономика по каждому проекту"
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="size-4" />
                Создать проект
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <ProjectFilters />
        {rows.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-8" />}
            title="Пока нет проектов"
            description={
              canCreate
                ? 'Создайте проект вручную или выберите сделку из Bitrix24.'
                : 'Вас пока не добавили ни в один проект.'
            }
            actions={
              canCreate ? (
                <Button asChild>
                  <Link href="/projects/new">Создать проект</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <ProjectsTable rows={rows} />
        )}
      </div>
    </>
  );
}
