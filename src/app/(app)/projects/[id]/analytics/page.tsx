import Link from 'next/link';
import { FileText } from 'lucide-react';
import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { ExportButton } from '@/components/analytics/export-button';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { HoursByDayChart, TaskFlowChart } from '@/components/analytics/charts';
import { UsageBar } from '@/components/analytics/usage';
import { MeetingsTable, TasksTable } from '@/components/analytics/tables';
import { SupportPackageForm } from '@/components/analytics/support-package-form';
import { BitrixLinkForm } from '@/components/analytics/bitrix-link-form';
import { RelatedItems } from '@/components/analytics/related';
import { loadRelated } from '@/server/services/related';
import { AnalyticsUpsell, Section, Toolbar } from '@/components/analytics/page-parts';
import { ChartCard } from '@/components/charts/chart-card';
import { Button } from '@/components/ui/button';
import { PeopleCards, SourcesCard, StatusesCard, UpcomingMeetingsCard } from '@/components/analytics/overview-parts';
import {
  dailySeries,
  hoursBySource,
  meetingRows,
  monthUsage,
  statusSplit,
  summarizeProject,
  taskRows,
  teamOverview,
  upcomingMeetings,
} from '@/domain/analytics';
import { m } from '@/domain/finance/money';
import { supportCost } from '@/domain/finance/support-package';
import { can } from '@/lib/permissions';
import { formatDuration, formatHours, formatRub } from '@/lib/format';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export default async function ProjectAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const ctx = await analyticsPage(searchParams, { projectId: id });
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, filters, periodQuery, session, scope } = ctx;
  const project = world.projects[0];

  if (!project) {
    const manual = world.unlinked.some((u) => u.id === id);
    return (
      <div className="flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8">
        <p className="border border-dashed border-border px-4 py-5 text-sm text-fg-secondary">
          {manual
            ? 'Проект создан вручную и не связан с Битрикс24, поэтому задач, часов и встреч здесь нет. Выберите, откуда их брать: проект из раздела «Проекты» Битрикс24 (задачи и встречи календаря) или сделку, компанию, смарт-процесс (задачи, привязанные к ним). Финансы и команда проекта не изменятся.'
            : 'Аналитика считается только по активным проектам.'}
        </p>
        {manual && can.mutateProject(session.actor) ? <BitrixLinkForm projectId={id} /> : null}
      </div>
    );
  }

  const { tz, now } = world;
  const s = summarizeProject(project, period, now, filters);
  const usage = monthUsage(project, period, tz, now);
  const cost = supportCost(
    {
      monthlyFee: project.monthlyFee !== null ? m(project.monthlyFee) : null,
      hourRate: project.hourRate !== null ? m(project.hourRate) : null,
    },
    usage,
  );
  const series = dailySeries([project], period, tz, now, filters);
  const rows = taskRows(project.tasks, project.entries, period, filters);
  const meetings = meetingRows(project.meetings, period, now, filters.employeeId);
  const canEdit = can.mutateProject(session.actor);
  const raw = await scope.project.findByIdOrThrow(id);
  const staffNames = Object.fromEntries([...world.people].map(([uid, p]) => [uid, p.name]));
  const related = project.sourceKind === 'crm' ? await loadRelated(session, scope, raw, staffNames) : null;
  // Responsibles of linked elements the staff list doesn't know (fired people too).
  const names = { ...ctx.names, ...(related?.names ?? {}) };

  const team = teamOverview([project], period, now).filter((r) => !filters.employeeId || r.userId === filters.employeeId);
  const people = Object.fromEntries(
    team.map((r) => {
      const p = world.people.get(r.userId);
      return [r.userId, { name: names[r.userId] ?? p?.name ?? `Сотрудник ${r.userId}`, position: p?.position ?? null, photoUrl: p?.photoUrl ?? null }];
    }),
  );

  const peopleOptions = Object.entries(names)
    .filter(([uid]) => project.tasks.some((t) => t.responsibleId === uid) || project.entries.some((e) => e.userId === uid) || project.meetings.some((x) => x.attendeeIds.includes(uid)))
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsFilters people={peopleOptions} />
          <ExportButton projectId={id} />
          <Button asChild variant="secondary">
            <Link href={`/report/projects/${id}${periodQuery}`} target="_blank">
              <FileText />
              Отчёт для клиента
            </Link>
          </Button>
        </div>
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={tz} />

      <StatGrid>
        <Stat label="Создано задач" value={String(s.created)} />
        <Stat label="Выполнено" value={String(s.done)} />
        <Stat label="Открыто сейчас" value={String(s.openNow)} hint={s.overdue ? `просрочено ${s.overdue}` : undefined} tone={s.overdue ? 'negative' : undefined} />
        <Stat label="Реакция" value={formatDuration(s.avgReactionSeconds)} hint={`медиана ${formatDuration(s.medianReactionSeconds)}`} />
        <Stat label="Решение" value={formatDuration(s.avgResolutionSeconds)} />
        <Stat label="Часы" value={formatHours(s.totalSeconds)} hint={`задачи ${formatHours(s.taskSeconds)} · встречи ${formatHours(s.meetingSeconds)}`} />
        <Stat label="Встреч" value={String(s.meetings)} hint="состоялось за период" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <SourcesCard slices={hoursBySource([project], period, now, filters)} />
        <StatusesCard slices={statusSplit(project.tasks, period, filters)} />
        <UpcomingMeetingsCard meetings={upcomingMeetings(project.meetings, now, 30, filters.employeeId)} tz={tz} />
      </div>

      <Section
        title="Пакет часов"
        hint="Считается по проекту целиком за календарный месяц: задачи и прошедшие встречи. Фильтр по сотруднику на пакет не влияет."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {usage.map((u) => (
              <div key={u.month} className="flex flex-col gap-2.5 border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-fg-secondary">{u.label}</span>
                  {u.overageSeconds > 0 ? (
                    <span className="font-mono text-[11px] font-bold uppercase text-negative">сверх пакета {formatHours(u.overageSeconds)} ч</span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[24px] font-bold leading-none nums">{formatHours(u.totalSeconds)}</span>
                  <span className="text-sm text-fg-tertiary">{u.limitSeconds !== null ? `из ${formatHours(u.limitSeconds)} ч` : 'ч, лимит не задан'}</span>
                </div>
                <UsageBar used={u.totalSeconds} limit={u.limitSeconds} />
                <div className="font-mono text-[11px] text-fg-tertiary">
                  задачи {formatHours(u.taskSeconds)} ч · встречи {formatHours(u.meetingSeconds)} ч
                </div>
              </div>
            ))}
          </div>

          {cost.hasPricing ? (
            <div className="overflow-x-auto border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-fg-tertiary">
                    <th className="px-3 py-2.5 font-medium">Месяц</th>
                    <th className="px-3 py-2.5 text-right font-medium">Абонентская плата</th>
                    <th className="px-3 py-2.5 text-right font-medium">Часы к оплате</th>
                    <th className="px-3 py-2.5 text-right font-medium">Доплата</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.months.map((mo) => (
                    <tr key={mo.label} className="border-b border-border">
                      <td className="px-3 py-2.5">{mo.label}</td>
                      <td className="px-3 py-2.5 text-right nums">{formatRub(mo.fee)}</td>
                      <td className="px-3 py-2.5 text-right nums">{formatHours(mo.billableSeconds)} ч</td>
                      <td className={cn('px-3 py-2.5 text-right nums', mo.overageCost.gt(0) && 'text-negative')}>{formatRub(mo.overageCost)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2.5 font-medium" colSpan={3}>
                      Итого за период
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold nums text-accent">{formatRub(cost.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {canEdit ? (
            <SupportPackageForm
              projectId={id}
              initial={{
                hoursLimit: raw.supportHoursLimit?.toString() ?? '',
                monthlyFee: raw.supportMonthlyFee?.toString() ?? '',
                hourRate: raw.supportHourRate?.toString() ?? '',
              }}
            />
          ) : null}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Часы по дням">
          <HoursByDayChart data={series} />
        </ChartCard>
        <ChartCard title="Задачи по дням" hint="Созданные и выполненные">
          <TaskFlowChart data={series} />
        </ChartCard>
      </div>

      <Section title="Сотрудники проекта" hint="Часы, закрытые задачи и встречи каждого за период">
        <PeopleCards rows={team} people={people} query={periodQuery} />
      </Section>

      <Section title="Задачи">
        <TasksTable rows={rows} tz={tz} names={names} />
      </Section>

      {related ? (
        <Section title="Связанные элементы" hint="Элементы смарт-процессов и сделки, которые ссылаются на этот проект в Битрикс24">
          <RelatedItems groups={related.groups} error={related.error} tz={tz} names={names} />
        </Section>
      ) : null}

      {project.sourceKind !== 'crm' ? (
        <Section title="Встречи" hint="Из календаря проекта в Битрикс24">
          <MeetingsTable rows={meetings} tz={tz} names={names} />
        </Section>
      ) : null}
    </div>
  );
}
