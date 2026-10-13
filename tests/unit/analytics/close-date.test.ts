import { describe, it, expect } from 'vitest';
import { hoursOnClose, TASK_STATUS, type TaskStat, type TimeEntry } from '@/domain/analytics';

const task = (id: number, closed: Date | null): TaskStat => ({
  id,
  projectId: 'p',
  title: `t${id}`,
  status: closed ? TASK_STATUS.COMPLETED : TASK_STATUS.IN_PROGRESS,
  created: new Date('2026-08-01T00:00:00Z'),
  started: null,
  closed,
  deadline: null,
  responsibleId: '1',
  responsibleName: '',
  url: '',
});
const entry = (taskId: number, at: string, seconds = 3600): TimeEntry => ({
  taskId,
  userId: '1',
  seconds,
  at: new Date(at),
  comment: '',
});

describe('hoursOnClose', () => {
  it('moves every record of a closed task to its closing date', () => {
    const closed = new Date('2026-09-20T12:00:00Z');
    const out = hoursOnClose(
      [task(1, closed)],
      [entry(1, '2026-08-10T10:00:00Z'), entry(1, '2026-09-02T10:00:00Z', 1800)],
    );
    expect(out.map((e) => [e.at, e.seconds])).toEqual([
      [closed, 3600],
      [closed, 1800],
    ]);
  });

  it('leaves out the hours of a task that is still open', () => {
    expect(hoursOnClose([task(2, null)], [entry(2, '2026-09-02T10:00:00Z')])).toEqual([]);
  });

  it('keeps a record whose task is not in the list', () => {
    const e = entry(3, '2026-09-02T10:00:00Z');
    expect(hoursOnClose([], [e])).toEqual([e]);
  });
});
