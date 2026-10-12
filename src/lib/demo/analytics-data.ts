import type { Meeting, TaskStat, TimeEntry } from '@/domain/analytics/types';
import { startOfDay, addDays } from '@/domain/analytics/time';

/**
 * Synthetic support activity for the demo portal (ADR-034), so «Аналитика» shows something
 * real-looking without a Bitrix24 connection. Deterministic per project id and calendar day:
 * the numbers don't jump between page loads, and they move with "now" so the current month
 * always has data.
 */

const TITLES = [
  'Настроить права доступа для отдела продаж',
  'Не приходят уведомления о новых лидах',
  'Добавить поле «Источник» в карточку сделки',
  'Ошибка при импорте контактов из Excel',
  'Настроить робота на смену стадии',
  'Подключить телефонию к CRM',
  'Сделать отчёт по менеджерам за месяц',
  'Перенести воронку «Опт» в новую категорию',
  'Не работает виджет на сайте',
  'Настроить бизнес-процесс согласования счёта',
  'Обновить шаблон коммерческого предложения',
  'Доработать интеграцию с 1С',
  'Почистить дубли компаний',
  'Обучение новых сотрудников работе в CRM',
];

const MEETINGS = ['Планёрка по поддержке', 'Созвон с клиентом', 'Демонстрация доработок', 'Разбор заявок за неделю'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoActivity {
  tasks: TaskStat[];
  entries: TimeEntry[];
  meetings: Meeting[];
}

const DAYS_BACK = 120;
const HOUR = 3600_000;

export function demoActivity(
  project: { id: string; index: number },
  people: Array<{ bitrixUserId: string; name: string }>,
  tz: string,
  now: Date,
): DemoActivity {
  const tasks: TaskStat[] = [];
  const entries: TimeEntry[] = [];
  const meetings: Meeting[] = [];
  if (people.length === 0) return { tasks, entries, meetings };

  const today = startOfDay(now, tz);
  // Busier projects first; every project gets a different rhythm.
  const intensity = [0.55, 0.4, 0.3, 0.22, 0.18, 0.14, 0.1][project.index % 7]!;
  let taskId = 1000 + project.index * 1000;

  for (let back = DAYS_BACK; back >= 0; back--) {
    const day = addDays(today, -back, tz);
    const r = rng(hash(`${project.id}:${day.toISOString().slice(0, 10)}`));
    const weekday = new Date(day.getTime() + 12 * HOUR).getUTCDay();
    const workday = weekday !== 0 && weekday !== 6;
    if (!workday && r() > 0.1) continue;

    const count = r() < intensity ? (r() < 0.3 ? 2 : 1) : 0;
    for (let i = 0; i < count; i++) {
      const created = new Date(day.getTime() + (9 + Math.floor(r() * 8)) * HOUR + Math.floor(r() * 60) * 60_000);
      if (created > now) continue;
      const owner = people[Math.floor(r() * people.length)]!;
      const reactionMs = Math.floor((0.2 + r() * 6) * HOUR);
      const started = new Date(created.getTime() + reactionMs);
      const workMs = Math.floor((1 + r() * 40) * HOUR);
      const closedAt = new Date(started.getTime() + workMs);
      // Old tasks are closed; a few recent ones are still open, as on a real support desk.
      const isClosed = closedAt <= now && (back > 10 || r() < 0.7);
      const startedReal = started <= now ? started : null;
      const status = isClosed ? '5' : startedReal ? '3' : '2';
      const id = taskId++;

      tasks.push({
        id,
        projectId: project.id,
        title: TITLES[Math.floor(r() * TITLES.length)]!,
        status,
        created,
        started: startedReal,
        closed: isClosed ? closedAt : null,
        deadline: new Date(created.getTime() + (24 + Math.floor(r() * 96)) * HOUR),
        responsibleId: owner.bitrixUserId,
        responsibleName: owner.name,
        url: null,
      });

      if (startedReal) {
        const logs = 1 + Math.floor(r() * 2);
        for (let k = 0; k < logs; k++) {
          const at = new Date(startedReal.getTime() + k * 3 * HOUR);
          if (at > now) break;
          entries.push({
            taskId: id,
            userId: owner.bitrixUserId,
            seconds: (15 + Math.floor(r() * 9) * 15) * 60,
            at,
            comment: '',
          });
        }
      }
    }

    // A meeting roughly once a week on busier projects.
    if (workday && r() < intensity / 3) {
      const start = new Date(day.getTime() + (10 + Math.floor(r() * 6)) * HOUR);
      const minutes = [30, 45, 60, 90][Math.floor(r() * 4)]!;
      const attendees = people.filter(() => r() < 0.6).map((p) => p.bitrixUserId);
      meetings.push({
        id: `${project.index}${back}`,
        projectId: project.id,
        title: MEETINGS[Math.floor(r() * MEETINGS.length)]!,
        start,
        end: new Date(start.getTime() + minutes * 60_000),
        attendeeIds: attendees.length ? attendees.sort() : [people[0]!.bitrixUserId],
      });
    }
  }

  return { tasks, entries, meetings };
}
