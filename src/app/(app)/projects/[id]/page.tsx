import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { requirePageSession } from '@/server/page-session';
import { getProjectDetail } from '@/server/services/project-read';
import { loadDashboard } from '@/server/services/dashboard';
import { queryEntries } from '@/server/services/finance-read';
import { projectStreams } from '@/server/services/streams';
import { ChartCard } from '@/components/charts/chart-card';
import { IncomeExpenseChart } from '@/components/charts/income-expense-chart';
import { ExpenseStructureChart } from '@/components/charts/expense-structure-chart';
import { EntriesTable } from '@/components/finance/entries-table';
import { StreamsPanel } from '@/components/projects/streams-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { can } from '@/lib/permissions';
import { formatDate, formatDateTime, formatRubStr } from '@/lib/format';
import { initials } from '@/lib/text';
import { UpsellNotice } from '@/components/ui/upsell-notice';

export const dynamic = 'force-dynamic';

const STATUS_LABELS = { ACTIVE: 'Активный', COMPLETED: 'Завершён', ARCHIVED: 'В архиве' } as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-fg-tertiary font-mono text-[11px] tracking-[0.06em] uppercase">{label}</dt>
      <dd className="text-fg mt-1 text-sm break-words">{children}</dd>
    </div>
  );
}

/** «Обзор» проекта (ADR-052): всё о проекте, направления, команда, динамика, последние операции. */
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, scope } = await requirePageSession();
  const { id } = await params;

  const [project, dash, recent, streams, users] = await Promise.all([
    getProjectDetail(scope, session.actor, id),
    loadDashboard(scope, session.actor, session.plan, { projectId: id, status: 'ALL' }),
    queryEntries(scope, session.actor, {
      projectId: id,
      sort: 'date',
      dir: 'desc',
      page: 1,
      pageSize: 5,
      includeDeleted: false,
    }),
    projectStreams(scope, id),
    scope.user.findMany({ select: { id: true, firstName: true, lastName: true, photoUrl: true } }),
  ]);
  const people = Object.fromEntries(
    users.map((u) => [u.id, { id: u.id, fullName: `${u.firstName} ${u.lastName}`.trim(), photoUrl: u.photoUrl }]),
  );
  const dates = [project.startDate, project.endDate].map((d) => (d ? formatDate(new Date(d)) : null));
  const pkg = project.support;

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-8">
      <section className="border-border bg-surface border p-5 sm:p-6">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Клиент">{project.clientName || '—'}</Fact>
          <Fact label="Статус">{STATUS_LABELS[project.status]}</Fact>
          <Fact label="Сроки">
            {dates[0] || dates[1] ? `${dates[0] ?? '…'} — ${dates[1] ?? '…'}` : '—'}
          </Fact>
          <Fact label="В Битрикс24">
            {project.crm?.url ? (
              <a
                href={project.crm.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent inline-flex items-center gap-1 hover:underline"
              >
                {project.crm.title || 'Открыть'}
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              'Создан вручную'
            )}
          </Fact>
          <Fact label="Пакет поддержки">
            {pkg.hoursLimit || pkg.monthlyFee || pkg.hourRate
              ? [
                  pkg.hoursLimit ? `${pkg.hoursLimit.replace('.', ',')} ч в месяц` : null,
                  pkg.monthlyFee ? `${formatRubStr(pkg.monthlyFee)} в месяц` : null,
                  pkg.hourRate ? `час ${formatRubStr(pkg.hourRate)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '—'}
          </Fact>
          <Fact label="Доход / расход, факт">
            {formatRubStr(project.economics.factIncome)} / {formatRubStr(project.economics.factExpense)}
          </Fact>
          <Fact label="Создан">
            {formatDateTime(new Date(project.createdAt))}
            {project.createdBy ? `, ${project.createdBy}` : ''}
          </Fact>
          <Fact label="Изменён">
            {formatDateTime(new Date(project.updatedAt))}
            {project.updatedBy ? `, ${project.updatedBy}` : ''}
          </Fact>
          {project.description ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <Fact label="Описание">
                <span className="text-fg-secondary whitespace-pre-line">{project.description}</span>
              </Fact>
            </div>
          ) : null}
          {project.internalComment ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <Fact label="Внутренний комментарий">
                <span className="text-fg-secondary whitespace-pre-line">{project.internalComment}</span>
              </Fact>
            </div>
          ) : null}
        </dl>
      </section>

      <StreamsPanel
        projectId={id}
        streams={streams.streams}
        untagged={streams.untagged}
        people={people}
        canEdit={project.canEdit}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="tx-mark text-accent">Команда</h2>
          <Link href={`/projects/${id}/team`} className="text-accent text-sm hover:underline">
            Вся команда
          </Link>
        </div>
        {project.members.length === 0 ? (
          <p className="text-fg-tertiary text-sm">В проект пока никого не добавили.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {project.members.map((m) => (
              <div key={m.id} className="border-border bg-surface flex items-center gap-3 border py-2 pr-4 pl-2">
                <Avatar className="size-8">
                  {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px]">{initials(m.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-fg text-sm font-medium">{m.fullName}</div>
                  {m.position ? <div className="text-fg-tertiary text-xs">{m.position}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {session.plan === 'PRO' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Динамика" hint="Доходы и расходы по месяцам">
            <IncomeExpenseChart data={dash.timeseries} showPlan />
          </ChartCard>
          <ChartCard title="Структура расходов">
            <ExpenseStructureChart data={dash.expenseStructure} />
          </ChartCard>
        </div>
      ) : (
        <UpsellNotice feature="Графики и аналитика по проектам" />
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="tx-mark text-accent">Последние операции</h2>
          <Link href={`/projects/${id}/finance`} className="text-accent text-sm hover:underline">
            Все операции
          </Link>
        </div>
        {recent.rows.length === 0 ? (
          <p className="border-border text-fg-tertiary border border-dashed py-8 text-center text-sm">
            Операций пока нет
          </p>
        ) : (
          <EntriesTable rows={recent.rows} canMutate={can.mutateFinance(session.actor)} showProject={false} />
        )}
      </section>
    </div>
  );
}
