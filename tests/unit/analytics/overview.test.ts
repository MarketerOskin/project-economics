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
