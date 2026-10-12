import ExcelJS from 'exceljs';
import {
  TASK_STATUS_LABELS,
  meetingRows,
  meetingSeconds,
  monthUsage,
  summarizeProject,
  taskRows,
  type AnalyticsPeriod,
  type Filters,
} from '@/domain/analytics';
import { m } from '@/domain/finance/money';
import { supportCost } from '@/domain/finance/support-package';
import { RUB_SIGN, formatDateIn, formatDateTimeIn, formatTimeIn } from '@/lib/format';
import type { AnalyticsWorld } from './analytics';

/**
 * The analytics .xlsx (ADR-034): the same numbers as the screen, from the same load. Hours are
 * real numbers (rounded to 0.01) so the client can sum them in Excel.
 */

const hours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF050505' } };

function sheet(wb: ExcelJS.Workbook, name: string, columns: Array<{ header: string; key: string; width: number }>) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFD6FF3F' } };
  head.fill = HEADER_FILL;
  return ws;
}

export async function buildAnalyticsWorkbook(
  world: AnalyticsWorld,
  period: AnalyticsPeriod,
  filters: Filters,
  names: Record<string, string>,
): Promise<Buffer> {
  const { tz, now, projects } = world;
  const wb = new ExcelJS.Workbook();
  wb.created = now;
  const projectName = Object.fromEntries(projects.map((p) => [p.projectId, p.name]));
  const who = (id: string | null) => (id ? (names[id] ?? `Сотрудник ${id}`) : '');

  // Summary per project.
  const summary = sheet(wb, 'Проекты', [
    { header: 'Проект', key: 'name', width: 36 },
    { header: 'Клиент', key: 'client', width: 26 },
    { header: 'Создано задач', key: 'created', width: 14 },
    { header: 'Выполнено', key: 'done', width: 12 },
    { header: 'Открыто сейчас', key: 'open', width: 15 },
    { header: 'Часы: задачи', key: 'task', width: 13 },
    { header: 'Часы: встречи', key: 'meet', width: 14 },
    { header: 'Часы всего', key: 'total', width: 12 },
    { header: 'Пакет, ч', key: 'limit', width: 10 },
    { header: 'Сверх пакета, ч', key: 'over', width: 15 },
    { header: `Абонентская плата, ${RUB_SIGN}`, key: 'fee', width: 20 },
    { header: `Доплата, ${RUB_SIGN}`, key: 'overCost', width: 12 },
    { header: `Итого, ${RUB_SIGN}`, key: 'cost', width: 12 },
  ]);
  for (const p of projects) {
    const s = summarizeProject(p, period, now, filters);
    const usage = monthUsage(p, period, tz, now);
    const cost = supportCost(
      { monthlyFee: p.monthlyFee !== null ? m(p.monthlyFee) : null, hourRate: p.hourRate !== null ? m(p.hourRate) : null },
      usage,
    );
    summary.addRow({
      name: p.name,
      client: p.clientName ?? '',
      created: s.created,
      done: s.done,
      open: s.openNow,
      task: hours(s.taskSeconds),
      meet: hours(s.meetingSeconds),
      total: hours(s.totalSeconds),
      limit: p.limitHours !== null ? hours(usage.reduce((a, u) => a + (u.limitSeconds ?? 0), 0)) : null,
      over: hours(usage.reduce((a, u) => a + u.overageSeconds, 0)),
      fee: cost.hasPricing ? cost.feeTotal.toNumber() : null,
      overCost: cost.hasPricing ? cost.overageCost.toNumber() : null,
      cost: cost.hasPricing ? cost.total.toNumber() : null,
    });
  }

  const tasks = sheet(wb, 'Задачи', [
    { header: '№', key: 'id', width: 9 },
    { header: 'Задача', key: 'title', width: 50 },
    { header: 'Проект', key: 'project', width: 30 },
    { header: 'Статус', key: 'status', width: 14 },
    { header: 'Создана', key: 'created', width: 18 },
    { header: 'Взята в работу', key: 'started', width: 18 },
    { header: 'Закрыта', key: 'closed', width: 18 },
    { header: 'Исполнитель', key: 'who', width: 24 },
    { header: 'Часы за период', key: 'hours', width: 14 },
    { header: 'Ссылка', key: 'url', width: 40 },
  ]);
  for (const r of taskRows(projects.flatMap((p) => p.tasks), projects.flatMap((p) => p.entries), period, filters)) {
    tasks.addRow({
      id: r.task.id,
      title: r.task.title,
      project: projectName[r.task.projectId] ?? '',
      status: TASK_STATUS_LABELS[r.task.status] ?? r.task.status,
      created: formatDateTimeIn(r.task.created, tz),
      started: formatDateTimeIn(r.task.started, tz),
      closed: formatDateTimeIn(r.task.closed, tz),
      who: who(r.task.responsibleId) || r.task.responsibleName,
      hours: hours(r.seconds),
      url: r.task.url ?? '',
    });
  }

  const meetings = sheet(wb, 'Встречи', [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Время', key: 'time', width: 13 },
    { header: 'Встреча', key: 'title', width: 40 },
    { header: 'Проект', key: 'project', width: 30 },
    { header: 'Участники', key: 'people', width: 40 },
    { header: 'Часы', key: 'hours', width: 8 },
    { header: 'Состоялась', key: 'held', width: 12 },
  ]);
  for (const r of meetingRows(projects.flatMap((p) => p.meetings), period, now, filters.employeeId)) {
    meetings.addRow({
      date: formatDateIn(r.meeting.start, tz),
      time: `${formatTimeIn(r.meeting.start, tz)}–${formatTimeIn(r.meeting.end, tz)}`,
      title: r.meeting.title,
      project: projectName[r.meeting.projectId] ?? '',
      people: r.meeting.attendeeIds.map(who).join(', '),
      hours: hours(meetingSeconds(r.meeting)),
      held: r.held ? 'да' : 'запланирована',
    });
  }

  const journal = sheet(wb, 'Журнал времени', [
    { header: 'Когда', key: 'at', width: 18 },
    { header: 'Сотрудник', key: 'who', width: 24 },
    { header: 'Задача', key: 'task', width: 50 },
    { header: 'Проект', key: 'project', width: 30 },
    { header: 'Комментарий', key: 'comment', width: 40 },
    { header: 'Часы', key: 'hours', width: 8 },
  ]);
  const taskById = new Map(projects.flatMap((p) => p.tasks.map((t) => [`${p.projectId}:${t.id}`, t] as const)));
  for (const p of projects) {
    for (const e of p.entries) {
      if (e.at < period.start || e.at >= period.end) continue;
      if (filters.employeeId && e.userId !== filters.employeeId) continue;
      journal.addRow({
        at: formatDateTimeIn(e.at, tz),
        who: who(e.userId),
        task: taskById.get(`${p.projectId}:${e.taskId}`)?.title ?? `Задача ${e.taskId}`,
        project: p.name,
        comment: e.comment,
        hours: hours(e.seconds),
      });
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
