import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { analyticsPage, type SearchParams } from '@/server/analytics-page';
import { AnalyticsUpsell, Section } from '@/components/analytics/page-parts';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { JournalTable } from '@/components/analytics/tables';
import { Button } from '@/components/ui/button';
import { taskStatusLabel, reactionSeconds, resolutionSeconds } from '@/domain/analytics';
import { formatDateIn, formatDuration } from '@/lib/format';
import { drillHref } from '@/lib/drill';

export const dynamic = 'force-dynamic';

/** One task's card (ADR-049): its dates, people and every time record; Bitrix24 one click away. */
export default async function AnalyticsTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: SearchParams;
}) {
  const { taskId } = await params;
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, names, projectNames, periodQuery, projectFilter } = ctx;
  const id = Number(taskId);
  const project = world.projects.find((p) => p.tasks.some((t) => t.id === id));
  const task = project?.tasks.find((t) => t.id === id);
  if (!project || !task) notFound();

  const records = project.entries
    .filter((e) => e.taskId === id)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((entry) => ({ entry, task, projectId: project.projectId }));
  const total = records.reduce((a, r) => a + r.entry.seconds, 0);
  const people = [...new Set(records.map((r) => r.entry.userId))];
  const when = (d: Date | null) => (d ? formatDateIn(d, world.tz) : '—');

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={drillHref('/analytics/tasks', periodQuery, { projectId: projectFilter })}
            className="text-accent text-sm hover:underline"
          >
            ← К задачам
          </Link>
          <h2 className="text-fg mt-2 text-xl font-semibold">{task.title}</h2>
          <p className="text-fg-secondary mt-1 text-sm">
            <Link href={`/projects/${project.projectId}/analytics`} className="hover:text-accent">
              {projectNames[project.projectId] ?? project.name}
            </Link>
            {' · '}
            {taskStatusLabel(task)}
            {task.responsibleId ? (
              <>
                {' · '}
                <Link href={`/analytics/team/${task.responsibleId}`} className="hover:text-accent">
                  {names[task.responsibleId] ?? task.responsibleName}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {task.url ? (
          <Button asChild>
            <a href={task.url} target="_blank" rel="noreferrer">
              <ExternalLink />
              Открыть в Битрикс24
            </a>
          </Button>
        ) : null}
      </div>

      <StatGrid>
        <Stat
          label="Время всего"
          value={formatDuration(total)}
          hint={`${records.length} записей · ${people.length} чел.`}
        />
        <Stat label="Создана" value={when(task.created)} />
        <Stat
          label="Взята в работу"
          value={when(task.started)}
          hint={`реакция ${formatDuration(reactionSeconds(task))}`}
        />
        <Stat
          label="Закрыта"
          value={when(task.closed)}
          hint={`решение ${formatDuration(resolutionSeconds(task))}`}
        />
        <Stat
          label="Срок"
          value={when(task.deadline)}
          tone={task.deadline && !task.closed && task.deadline < world.now ? 'negative' : undefined}
        />
      </StatGrid>

      <Section title="Записи времени" hint="За всё время, не только за выбранный период">
        <JournalTable rows={records} tz={world.tz} projectNames={projectNames} names={names} />
      </Section>
    </div>
  );
}
