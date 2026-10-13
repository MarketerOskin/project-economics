import { describe, expect, it } from 'vitest';
import { hoursBySource, upcomingMeetings, monthSecondsByPerson } from '@/domain/analytics';
import type { ProjectActivity } from '@/domain/analytics';

const H = 3600;
const w = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-11-01T00:00:00Z') };
const now = new Date('2026-10-13T12:00:00Z');

const project: ProjectActivity = {
  projectId: 'p1',
  name: 'P',
  limitHours: null,
  tasks: [],
  entries: [
    { taskId: 5, userId: '1', seconds: 2 * H, at: new Date('2026-10-02T10:00:00Z'), comment: '' },
    {
      taskId: -(1044 * 10_000_000 + 7),
      userId: '2',
      seconds: 3 * H,
      at: new Date('2026-10-03T10:00:00Z'),
      comment: 'Заявки BK',
    },
    { taskId: 6, userId: '1', seconds: H, at: new Date('2026-09-30T10:00:00Z'), comment: '' },
  ],
  meetings: [
    {
      id: 'm1',
      projectId: 'p1',
      title: 'Планёрка',
      start: new Date('2026-10-05T10:00:00Z'),
      end: new Date('2026-10-05T11:00:00Z'),
      attendeeIds: ['1', '2'],
    },
    {
      id: 'm2',
      projectId: 'p1',
      title: 'Созвон',
      start: new Date('2026-10-20T10:00:00Z'),
      end: new Date('2026-10-20T10:30:00Z'),
      attendeeIds: ['2'],
    },
    {
      id: 'm3',
      projectId: 'p1',
      title: 'Далеко',
      start: new Date('2026-12-20T10:00:00Z'),
      end: new Date('2026-12-20T10:30:00Z'),
      attendeeIds: ['2'],
    },
  ],
};

describe('overview slices (ADR-047)', () => {
  it('splits hours into CRM sections, tasks and held meetings', () => {
    expect(hoursBySource([project], w, now)).toEqual([
      { key: 'crm:Заявки BK', label: 'Заявки BK', seconds: 3 * H },
      { key: 'tasks', label: 'Задачи', seconds: 2 * H },
      { key: 'meetings', label: 'Встречи', seconds: H },
    ]);
    expect(hoursBySource([project], w, now, { employeeId: '1' }).map((s) => s.key)).toEqual([
      'tasks',
      'meetings',
    ]);
  });

  it('lists meetings in the next 30 days only', () => {
    expect(upcomingMeetings(project.meetings, now).map((m) => m.id)).toEqual(['m2']);
    expect(upcomingMeetings(project.meetings, now, 30, '1')).toEqual([]);
  });

  it('counts a meeting in full for every attendee', () => {
    const by = monthSecondsByPerson(project, '2026-10', 'UTC', now);
    expect(Object.fromEntries(by)).toEqual({ '1': 3 * H, '2': 4 * H });
  });
});

describe('drillTasks (ADR-049)', () => {
  it('each list has exactly as many tasks as the figure that opens it', async () => {
    const { drillTasks, summarizeAll } = await import('@/domain/analytics');
    const w = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-11-01T00:00:00Z') };
    const now = new Date('2026-10-20T00:00:00Z');
    const t = (
      id: number,
      status: string,
      created: string,
      closed: string | null,
      deadline: string | null = null,
    ) => ({
      id,
      projectId: 'p',
      title: `T${id}`,
      status,
      created: new Date(created),
      started: null,
      closed: closed ? new Date(closed) : null,
      deadline: deadline ? new Date(deadline) : null,
      responsibleId: id % 2 ? '1' : '2',
      responsibleName: '',
      url: null,
    });
    const tasks = [
      t(1, '5', '2026-10-02T00:00:00Z', '2026-10-05T00:00:00Z'),
      t(2, '3', '2026-10-03T00:00:00Z', null, '2026-10-10T00:00:00Z'),
      t(3, '2', '2026-09-03T00:00:00Z', null),
      t(4, '5', '2026-09-01T00:00:00Z', '2026-10-15T00:00:00Z'),
    ];
    const entries = [
      { taskId: 3, userId: '1', seconds: 3600, at: new Date('2026-10-04T00:00:00Z'), comment: '' },
    ];
    const project = { projectId: 'p', name: 'P', limitHours: null, tasks, entries, meetings: [] };
    const s = summarizeAll([project], w, now);
    expect(drillTasks(tasks, entries, w, now, 'created')).toHaveLength(s.created);
    expect(drillTasks(tasks, entries, w, now, 'done')).toHaveLength(s.done);
    expect(drillTasks(tasks, entries, w, now, 'open')).toHaveLength(s.openNow);
    expect(drillTasks(tasks, entries, w, now, 'overdue')).toHaveLength(s.overdue);
    expect(drillTasks(tasks, entries, w, now, 'worked').map((r) => r.task.id)).toEqual([3]);
    expect(
      drillTasks(tasks, entries, w, now, 'touched', { status: '5' }).map((r) => r.task.id),
    ).toEqual([1, 4]);
    expect(
      drillTasks(tasks, entries, w, now, 'created', { employeeId: '2' }).map((r) => r.task.id),
    ).toEqual([2]);
  });
});
