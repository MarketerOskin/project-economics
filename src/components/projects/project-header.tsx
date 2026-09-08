import Link from 'next/link';
import { ExternalLink, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/text';
import { Tip } from '@/components/ui/tooltip';
import { StatusBadge } from './status-badge';
import type { ProjectDetail } from '@/server/services/project-read';

export function ProjectHeader({ project }: { project: ProjectDetail }) {
  const dates =
    project.startDate || project.endDate
      ? [project.startDate && formatDate(new Date(project.startDate)), project.endDate && formatDate(new Date(project.endDate))]
          .filter(Boolean)
          .join(' — ')
      : null;

  return (
    <div className="border-b border-border px-8 pb-5 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
            {project.clientName ? <span>{project.clientName}</span> : null}
            {dates ? <span>{dates}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.members.length > 0 ? (
            <div className="mr-1 flex -space-x-2">
              {project.members.slice(0, 5).map((m) => (
                <Tip key={m.id} label={m.fullName}>
                  <Avatar className="size-7 ring-2 ring-bg">
                    {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                    <AvatarFallback className="text-[10px]">{initials(m.fullName)}</AvatarFallback>
                  </Avatar>
                </Tip>
              ))}
            </div>
          ) : null}
          {project.crm?.url ? (
            <Button asChild variant="secondary" size="sm">
              <a href={project.crm.url} target="_blank" rel="noreferrer">
                Открыть в Bitrix24
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
          {project.canEdit ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="size-3.5" />
                Редактировать
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
