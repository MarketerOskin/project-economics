import { describe, expect, it } from 'vitest';
import {
  dailySeries,
  employeeProfile,
  monthPeriod,
  monthUsage,
  summarizeProject,
  taskRows,
  teamOverview,
  type Meeting,
  type ProjectActivity,
  type TaskStat,
  type TimeEntry,
} from '@/domain/analytics';

const TZ = 'Asia/Krasnoyarsk';
const H = 3600;
const at = (s: string) => new Date(`${s}+07:00`);

function task(id: number, over: Partial<TaskStat> = {}): TaskStat {
  return {
    id,
    projectId: 'p1',
    title: `Задача ${id}`,
    status: '5',
    created: at('2026-10-02T10:00:00'),
    started: at('2026-10-02T11:00:00'),
    closed: at('2026-10-03T10:00:00'),
    deadline: null,
    responsibleId: '10',
    responsibleName: 'Мария',
    url: null,
    ...over,
  };
}

const entry = (taskId: number, userId: string, seconds: number, when: string): TimeEntry => ({
  taskId,
  userId,
  seconds,
  at: at(when),
  comment: '',
});

const meeting = (id: string, start: string, minutes: number, attendees: string[]): Meeting => ({
  id,
  projectId: 'p1',
  title: 'Созвон',
  start: at(start),
  end: new Date(at(start).getTime() + minutes * 60_000),
  attendeeIds: attendees,
});

function project(over: Partial<ProjectActivity> = {}): ProjectActivity {
  return { projectId: 'p1', name: 'Поддержка', limitHours: 4, tasks: [], entries: [], meetings: [], ...over };
}

const october = monthPeriod(2026, 10, TZ);
const now = at('2026-10-20T12:00:00');

describe('support metrics (ADR-034)', () => {
  it('counts created / done / open, reaction and resolution', () => {
    const p = project({
      tasks: [
        task(1), // reaction 1h, resolution 24h
        task(2, { created: at('2026-10-05T10:00:00'), started: at('2026-10-05T13:00:00'), closed: at('2026-10-05T16:00:00') }),
        task(3, { status: '3', closed: null, created: at('2026-10-06T10:00:00'), started: null, deadline: at('2026-10-10T00:00:00') }),
        task(4, { created: at('2026-09-20T10:00:00'), closed: at('2026-09-21T10:00:00') }), // outside
      ],
    });
    const s = summarizeProject(p, october, now);
    expect(s.created).toBe(3);
    expect(s.done).toBe(2);
    expect(s.openNow).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.avgReactionSeconds).toBe(2 * H); // (1h + 3h) / 2; task 3 not started
    expect(s.medianReactionSeconds).toBe(2 * H);
    expect(s.avgResolutionSeconds).toBe(Math.round((24 * H + 6 * H) / 2));
  });

  it('hours = time records in the window + meetings that already started', () => {
    const p = project({
      tasks: [task(1)],
      entries: [entry(1, '10', 2 * H, '2026-10-02T12:00:00'), entry(1, '10', H, '2026-09-30T12:00:00')],
      meetings: [meeting('m1', '2026-10-10T10:00:00', 60, ['10', '11']), meeting('m2', '2026-10-25T10:00:00', 60, ['10'])],
    });
    const s = summarizeProject(p, october, now);
    expect(s.taskSeconds).toBe(2 * H);
    expect(s.meetingSeconds).toBe(H); // m2 is in the future
    expect(s.totalSeconds).toBe(3 * H);
    expect(s.meetings).toBe(1);
  });

  it('a meeting counts once for the project but in full for every attendee', () => {
    const p = project({ meetings: [meeting('m1', '2026-10-10T10:00:00', 90, ['10', '11'])] });
    expect(summarizeProject(p, october, now).meetingSeconds).toBe(1.5 * H);
    const team = teamOverview([p], october, now);
    expect(team.map((r) => [r.userId, r.meetingSeconds])).toEqual([
      ['10', 1.5 * H],
      ['11', 1.5 * H],
    ]);
  });

  it('the employee filter narrows tasks, time and meetings to one person', () => {
    const p = project({
      tasks: [task(1), task(2, { responsibleId: '11' })],
      entries: [entry(1, '10', H, '2026-10-02T12:00:00'), entry(2, '11', 2 * H, '2026-10-02T12:00:00')],
      meetings: [meeting('m1', '2026-10-10T10:00:00', 60, ['11'])],
    });
    const s = summarizeProject(p, october, now, { employeeId: '10' });
    expect(s.created).toBe(1);
    expect(s.taskSeconds).toBe(H);
    expect(s.meetingSeconds).toBe(0);
  });

  it('monthly package: overage is hours over the limit, per calendar month', () => {
    const p = project({
      limitHours: 4,
      entries: [entry(1, '10', 3 * H, '2026-10-02T12:00:00'), entry(1, '10', 2 * H, '2026-10-15T12:00:00')],
      meetings: [meeting('m1', '2026-10-10T10:00:00', 30, ['10'])],
    });
    const [oct] = monthUsage(p, october, TZ, now);
    expect(oct!.totalSeconds).toBe(5.5 * H);
    expect(oct!.limitSeconds).toBe(4 * H);
    expect(oct!.overageSeconds).toBe(1.5 * H);

    const noLimit = monthUsage({ ...p, limitHours: null }, october, TZ, now)[0]!;
    expect(noLimit.limitSeconds).toBeNull();
    expect(noLimit.overageSeconds).toBe(0);
  });

  it('a record at 23:30 local on the last day belongs to that month, not the next', () => {
    const p = project({ entries: [entry(1, '10', H, '2026-10-31T23:30:00')] });
    expect(monthUsage(p, october, TZ, now)[0]!.taskSeconds).toBe(H);
    const series = dailySeries([p], october, TZ, now);
    expect(series.at(-1)).toMatchObject({ day: '2026-10-31', taskSeconds: H });
    expect(series).toHaveLength(31);
  });

  it('task rows: only tasks created, closed or worked on in the window, newest first', () => {
    const old = task(1, { created: at('2026-08-01T10:00:00'), closed: at('2026-08-02T10:00:00') });
    const workedOn = task(2, { created: at('2026-08-01T10:00:00'), status: '3', closed: null });
    const fresh = task(3, { created: at('2026-10-09T10:00:00') });
    const rows = taskRows([old, workedOn, fresh], [entry(2, '10', H, '2026-10-03T10:00:00')], october);
    expect(rows.map((r) => r.task.id)).toEqual([3, 2]);
    expect(rows[1]!.seconds).toBe(H);
  });

  it('employee profile splits hours by project and keeps a time journal', () => {
    const p1 = project({ tasks: [task(1)], entries: [entry(1, '10', H, '2026-10-02T12:00:00')] });
    const p2 = project({
      projectId: 'p2',
      name: 'Внедрение',
      tasks: [task(2, { projectId: 'p2' })],
      entries: [entry(2, '10', 3 * H, '2026-10-04T12:00:00')],
    });
    const prof = employeeProfile('10', [p1, p2], october, now);
    expect(prof.byProject.map((s) => [s.projectId, s.totalSeconds])).toEqual([
      ['p2', 3 * H],
      ['p1', H],
    ]);
    expect(prof.journal).toHaveLength(2);
    expect(prof.journal[0]!.projectId).toBe('p2');
    expect(prof.summary.totalSeconds).toBe(4 * H);
  });
});
