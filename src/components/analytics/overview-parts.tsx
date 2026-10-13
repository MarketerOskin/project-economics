import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Donut, type DonutItem } from './donut';
import { ChartCard } from '@/components/charts/chart-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  type EmployeeRow,
  type Meeting,
  type SourceSlice,
  type StatusSlice,
} from '@/domain/analytics';
import { formatDateIn, formatHours, formatTimeIn } from '@/lib/format';
import { initials, plural } from '@/lib/text';

/**
 * Overview blocks shared by the portal overview, a project's analytics and the team pages
 * (ADR-047), in the layout of the statistics app the team already uses.
 */

const SOURCE_COLORS = [
  'var(--cat-orange)',
  'var(--cat-violet)',
  'var(--cat-cyan)',
  'var(--cat-burgundy)',
];
const STAGE_COLORS = [
  'var(--accent)',
  'var(--cat-blue)',
  'var(--cat-violet)',
  'var(--cat-orange)',
  'var(--cat-cyan)',
  'var(--warning)',
];
const STATUS_COLORS: Record<string, string> = {
  '1': 'var(--cat-blue)',
  '2': 'var(--warning)',
  '3': 'var(--accent)',
  '4': 'var(--cat-cyan)',
  '5': 'var(--positive)',
  '6': 'var(--fg-tertiary)',
  '7': 'var(--negative)',
};

export function SourcesCard({ slices, href }: { slices: SourceSlice[]; href?: string }) {
  let crm = 0;
  const items: DonutItem[] = slices.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.seconds,
    display: `${formatHours(s.seconds)} ч`,
    href,
    color:
      s.key === 'tasks'
        ? 'var(--accent)'
        : s.key === 'meetings'
          ? 'var(--cat-blue)'
          : SOURCE_COLORS[crm++ % SOURCE_COLORS.length]!,
  }));
  const total = slices.reduce((a, s) => a + s.seconds, 0);
  return (
    <ChartCard title="Часы по источникам" hint="Задачи, встречи и заявки из CRM">
      <Donut items={items} center={`${formatHours(total)} ч`} empty="Часов за период нет" />
    </ChartCard>
  );
}

export function StatusesCard({
  slices,
  hrefOf,
}: {
  slices: StatusSlice[];
  hrefOf?: (status: string) => string;
}) {
  let stageIdx = 0;
  const items: DonutItem[] = [...slices]
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      key: s.status,
      label: s.label,
      value: s.count,
      display: String(s.count),
      href: hrefOf?.(s.status),
      color:
        s.status.startsWith('stage:') && s.baseStatus !== '5'
          ? STAGE_COLORS[stageIdx++ % STAGE_COLORS.length]!
          : (STATUS_COLORS[s.baseStatus] ?? 'var(--fg-tertiary)'),
    }));
  return (
    <ChartCard title="Задачи по стадиям" hint="Созданные или закрытые за период">
      <Donut
        items={items}
        center={String(slices.reduce((a, s) => a + s.count, 0))}
        empty="Задач за период нет"
      />
    </ChartCard>
  );
}

export function UpcomingMeetingsCard({
  meetings,
  tz,
  projectNames,
  allHref,
}: {
  meetings: Meeting[];
  tz: string;
  projectNames?: Record<string, string>;
  allHref?: string;
}) {
  return (
    <div className="border-border bg-surface border p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="tx-mark text-accent">Ближайшие встречи</h3>
        {allHref ? (
          <Link
            href={allHref}
            className="text-fg-tertiary hover:text-accent inline-flex items-center gap-1 text-xs"
          >
            все <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
      {meetings.length === 0 ? (
        <p className="text-fg-tertiary text-sm">Запланированных встреч в ближайшие 30 дней нет.</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {meetings.slice(0, 5).map((m) => (
            <li
              key={`${m.projectId}:${m.id}:${m.start.getTime()}`}
              className="flex items-baseline gap-3 py-2 text-sm first:pt-0"
            >
              <span className="nums text-fg-secondary w-24 shrink-0">
                {formatDateIn(m.start, tz).slice(0, 5)} {formatTimeIn(m.start, tz)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-fg block truncate">{m.title}</span>
                {projectNames ? (
                  <span className="text-fg-tertiary block truncate text-xs">
                    {projectNames[m.projectId] ?? ''}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface PersonCardInfo {
  name: string;
  position: string | null;
  photoUrl: string | null;
}

/** People as cards: hours (bar relative to the busiest), closed, meetings, open. */
export function PeopleCards({
  rows,
  people,
  query,
  limit,
}: {
  rows: EmployeeRow[];
  people: Record<string, PersonCardInfo>;
  query: string;
  limit?: number;
}) {
  const shown = (limit ? rows.slice(0, limit) : rows).filter(
    (r) => r.totalSeconds > 0 || r.done > 0 || r.openNow > 0,
  );
  if (shown.length === 0)
    return <p className="text-fg-tertiary text-sm">За период никто не работал по этим проектам.</p>;
  const max = Math.max(...shown.map((r) => r.totalSeconds), 1);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {shown.map((r) => {
        const p = people[r.userId] ?? {
          name: `Сотрудник ${r.userId}`,
          position: null,
          photoUrl: null,
        };
        return (
          <Link
            key={r.userId}
            href={`/analytics/team/${r.userId}${query}`}
            className="border-border bg-surface hover:border-accent flex flex-col gap-4 rounded-2xl border p-6 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Avatar className="ring-accent/60 ring-offset-surface size-16 shrink-0 ring-2 ring-offset-2">
                {p.photoUrl ? <AvatarImage src={p.photoUrl} alt="" /> : null}
                <AvatarFallback className="text-lg">{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-fg truncate text-lg font-semibold">{p.name}</div>
                {p.position ? (
                  <div className="text-fg-tertiary truncate text-sm">{p.position}</div>
                ) : null}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display nums text-[48px] leading-none font-bold">
                {formatHours(r.totalSeconds)}
              </span>
              <span className="text-fg-tertiary text-lg">ч</span>
            </div>
            <div className="bg-surface-muted h-3 overflow-hidden rounded-full" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--cat-blue)]"
                style={{ width: `${Math.round((r.totalSeconds / max) * 100)}%` }}
              />
            </div>
            <div className="text-fg-tertiary flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
              <span>
                <b className="text-fg mr-1.5 font-semibold">{r.done}</b>закрыто
              </span>
              <span>
                {r.meetings} {plural(r.meetings, 'встреча', 'встречи', 'встреч')}
              </span>
              <span>
                <b className="text-fg mr-1.5 font-semibold">{r.openNow}</b>открыто
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Header row of a section with a "see all" link on the right. */
export function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="tx-mark text-accent">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-fg-secondary hover:text-accent inline-flex items-center gap-1 text-sm"
        >
          {linkLabel} <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
