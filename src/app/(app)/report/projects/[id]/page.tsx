import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { analyticsPage, type SearchParams } from '@/server/analytics-page';
import { AnalyticsUpsell } from '@/components/analytics/page-parts';
import { PrintButton } from '@/components/analytics/print-button';
import { ReportHoursChart } from '@/components/analytics/report-chart';
import { dailySeries, meetingRows, meetingSeconds, monthUsage, summarizeProject, taskRows, TASK_STATUS_LABELS } from '@/domain/analytics';
import { m } from '@/domain/finance/money';
import { supportCost } from '@/domain/finance/support-package';
import { formatDateIn, formatDateTimeIn, formatDuration, formatHours, formatRub, formatTimeIn } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Client-facing report for one project (ADR-034): what was done, how long it took and how the
 * price is formed. A light "paper" page inside the app — the browser's print dialog saves it
 * as PDF, so it works inside the Bitrix24 iframe without a server-side PDF renderer.
 */
export default async function ProjectReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const ctx = await analyticsPage(searchParams, { projectId: id });
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, names, periodQuery } = ctx;
  const project = world.projects[0];
  const { tz, now } = world;

  if (!project) {
    return (
      <div className="px-4 py-6 text-sm text-fg-secondary sm:px-8">
        Отчёт строится по задачам Битрикс24, а этот проект с Битрикс24 не связан.
      </div>
    );
  }

  const s = summarizeProject(project, period, now);
  const usage = monthUsage(project, period, tz, now);
  const cost = supportCost(
    {
      monthlyFee: project.monthlyFee !== null ? m(project.monthlyFee) : null,
      hourRate: project.hourRate !== null ? m(project.hourRate) : null,
    },
    usage,
  );
  const rows = taskRows(project.tasks, project.entries, period);
  const meetings = meetingRows(project.meetings, period, now).filter((r) => r.held);
  const series = dailySeries([project], period, tz, now);

  return (
    <div className="px-4 py-6 sm:px-8 print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/projects/${id}/analytics${periodQuery}`} className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-accent">
          <ArrowLeft className="size-4" />
          К аналитике проекта
        </Link>
        <PrintButton />
      </div>

      <article className="report mx-auto max-w-[210mm] bg-white text-[13px] leading-relaxed text-[#0b0b0b] shadow-[0_0_0_1px_#262626] print:max-w-none print:shadow-none">
        <style>{`
          .report table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .report th { background: #050505; color: #d6ff3f; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 11px; }
          .report td { padding: 6px 8px; border-bottom: 1px solid #e6e6dc; vertical-align: top; }
          .report tr { break-inside: avoid; }
          .report .num { text-align: right; white-space: nowrap; }
          .report h2 { font-size: 16px; font-weight: 700; margin: 28px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #d6ff3f; }
          .report-muted { color: #6d6d65; }
          @media print { @page { size: A4; margin: 12mm 0 14mm; } }
        `}</style>

        <header className="flex items-center gap-4 bg-[#050505] px-8 py-6 text-[#f4f4ef]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-mascot.png" alt="" className="size-14 object-contain" />
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#d6ff3f]">Отчёт о выполненных работах</div>
            <div className="mt-1 text-[22px] font-bold leading-tight">{project.name}</div>
            {project.clientName ? <div className="text-sm text-[#c3c2b7]">{project.clientName}</div> : null}
          </div>
        </header>

        <div className="px-8 pb-8">
          <div className="mt-5 inline-block bg-[#d6ff3f] px-3 py-1 text-sm font-bold text-[#050505]">{period.label}</div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: String(s.created), l: 'заявок за период' },
              { v: String(s.done), l: 'выполнено' },
              { v: formatDuration(s.avgReactionSeconds), l: 'среднее время реакции' },
              { v: `${formatHours(s.totalSeconds)} ч`, l: `затрачено (задачи ${formatHours(s.taskSeconds)} ч, встречи ${formatHours(s.meetingSeconds)} ч)` },
            ].map((c) => (
              <div key={c.l} className="border border-[#dcdcd2] px-3.5 py-3">
                <div className="text-[22px] font-bold leading-none">{c.v}</div>
                <div className="report-muted mt-1.5 text-[11px] leading-snug">{c.l}</div>
              </div>
            ))}
          </div>

          {project.limitHours !== null ? (
            <>
              <h2>Пакет часов</h2>
              {usage.map((u) => {
                const pct = u.limitSeconds ? Math.min(100, Math.round((u.totalSeconds / u.limitSeconds) * 100)) : 0;
                return (
                  <div key={u.month} className="mb-3 break-inside-avoid">
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span>{u.label}</span>
                      <span>
                        <b>{formatHours(u.totalSeconds)} ч</b> из {formatHours(u.limitSeconds)} ч
                        {u.overageSeconds > 0 ? <span className="font-bold text-[#e04848]"> · сверх пакета {formatHours(u.overageSeconds)} ч</span> : null}
                      </span>
                    </div>
                    <div className="h-2 bg-[#ececE4]">
                      <div className={u.overageSeconds > 0 ? 'h-full bg-[#e04848]' : 'h-full bg-[#050505]'} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}

          <h2>Часы по дням</h2>
          <div className="report-muted mb-1 flex gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 bg-[#050505]" />
              задачи
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 bg-[#9fcf00]" />
              встречи
            </span>
          </div>
          <ReportHoursChart data={series} />

          <h2>Что сделано</h2>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Дата заявки</th>
                <th>Задача</th>
                <th>Статус</th>
                <th>Реакция</th>
                <th>Исполнитель</th>
                <th className="num">Затрачено</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="report-muted">
                    За выбранный период задач не было.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.task.id}>
                    <td>{r.task.id}</td>
                    <td className="whitespace-nowrap">{formatDateIn(r.task.created, tz)}</td>
                    <td>{r.task.title}</td>
                    <td className={r.task.status === '5' ? 'font-semibold text-[#3a7d0a]' : 'font-semibold'}>{TASK_STATUS_LABELS[r.task.status] ?? r.task.status}</td>
                    <td className="whitespace-nowrap">{formatDuration(r.reactionSeconds)}</td>
                    <td>{r.task.responsibleId ? (names[r.task.responsibleId] ?? r.task.responsibleName) : '—'}</td>
                    <td className="num">{formatDuration(r.seconds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {meetings.length > 0 ? (
            <>
              <h2>Встречи</h2>
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Время</th>
                    <th>Встреча</th>
                    <th>Участники</th>
                    <th className="num">Длительность</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map(({ meeting: x }) => (
                    <tr key={`${x.id}:${x.start.getTime()}`}>
                      <td className="whitespace-nowrap">{formatDateIn(x.start, tz)}</td>
                      <td className="whitespace-nowrap">
                        {formatTimeIn(x.start, tz)}–{formatTimeIn(x.end, tz)}
                      </td>
                      <td>{x.title}</td>
                      <td>{x.attendeeIds.map((a) => names[a] ?? `Сотрудник ${a}`).join(', ')}</td>
                      <td className="num">{formatDuration(meetingSeconds(x))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {cost.hasPricing ? (
            <>
              <h2>Как формируется стоимость</h2>
              <table>
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th className="num">Абонентская плата</th>
                    <th className="num">Использовано / пакет</th>
                    <th className="num">Часы к оплате</th>
                    <th className="num">Доплата</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.months.map((mo) => (
                    <tr key={mo.label}>
                      <td>{mo.label}</td>
                      <td className="num">{formatRub(mo.fee)}</td>
                      <td className="num">
                        {formatHours(mo.totalSeconds)} / {mo.limitSeconds !== null ? `${formatHours(mo.limitSeconds)} ч` : '—'}
                      </td>
                      <td className="num">{formatHours(mo.billableSeconds)} ч</td>
                      <td className="num">{formatRub(mo.overageCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between bg-[#050505] px-5 py-4 text-[#f4f4ef] break-inside-avoid">
                <div>
                  Итого к оплате
                  {project.hourRate ? (
                    <div className="text-[11px] text-[#a8a89c]">сверх пакета по ставке {formatRub(m(project.hourRate))} за час</div>
                  ) : null}
                </div>
                <div className="text-[22px] font-bold text-[#d6ff3f]">{formatRub(cost.total)}</div>
              </div>
              <p className="report-muted mt-3 text-[11px]">
                Абонентская плата включает пакет часов поддержки в месяц, в него входят и задачи, и встречи. Время сверх пакета
                оплачивается по почасовой ставке. Затраченное время учитывается исполнителями по каждой задаче.
              </p>
            </>
          ) : null}

          <p className="report-muted mt-6 text-[11px]">Отчёт сформирован {formatDateTimeIn(now, tz)}.</p>
        </div>
      </article>
    </div>
  );
}
