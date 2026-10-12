import { describe, expect, it } from 'vitest';
import { parseCalendarEvent, parseElapsed, parseTask } from '@/lib/bitrix/analytics';

describe('Bitrix24 analytics parsing (ADR-034)', () => {
  it('parses a task with offsets and the responsible person', () => {
    const t = parseTask(
      {
        id: '42',
        title: 'Не приходят лиды',
        status: '5',
        createdDate: '2026-10-01T10:00:00+03:00',
        dateStart: '2026-10-01T11:30:00+03:00',
        closedDate: '2026-10-02T09:00:00+03:00',
        responsibleId: '7',
        responsible: { name: 'Мария Титова' },
        timeSpentInLogs: '5400',
      },
      'p1',
      (x) => `https://portal/task/${x.id}`,
    );
    expect(t).toMatchObject({ id: 42, projectId: 'p1', status: '5', responsibleId: '7', responsibleName: 'Мария Титова', spentSeconds: 5400, url: 'https://portal/task/42' });
    expect(t.created?.toISOString()).toBe('2026-10-01T07:00:00.000Z');
  });

  it('drops auto-timer noise and empty records', () => {
    expect(parseElapsed({ TASK_ID: 1, USER_ID: 7, SECONDS: 1, SOURCE: 3, DATE_START: '2026-10-01T10:00:00+03:00' })).toBeNull();
    expect(parseElapsed({ TASK_ID: 1, USER_ID: 7, SECONDS: 0, DATE_START: '2026-10-01T10:00:00+03:00' })).toBeNull();
    expect(parseElapsed({ TASK_ID: 1, USER_ID: 7, SECONDS: 120, SOURCE: 3, DATE_START: '2026-10-01T10:00:00+03:00' })).toMatchObject({ seconds: 120, userId: '7' });
    // Falls back to CREATED_DATE.
    expect(parseElapsed({ TASK_ID: 1, USER_ID: 7, SECONDS: 600, CREATED_DATE: '2026-10-01T10:00:00+03:00', COMMENT_TEXT: ' созвон ' })).toMatchObject({ comment: 'созвон' });
  });

  it('reads calendar time in the event zone, not the broken *_TS_UTC fields', () => {
    const m = parseCalendarEvent(
      {
        ID: '9',
        NAME: 'Планёрка',
        ACTIVE: 'Y',
        DATE_FROM: '12.10.2026 10:00:00',
        DATE_TO: '12.10.2026 11:30:00',
        TZ_FROM: 'Asia/Krasnoyarsk',
        MEETING_HOST: '3',
        ATTENDEE_LIST: [
          { id: '3', status: 'Y' },
          { id: '5', status: 'Y' },
          { id: '6', status: 'N' },
          { id: '8', status: 'Q' },
        ],
      },
      'p1',
      'Europe/Moscow',
    );
    expect(m?.start.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect((m!.end.getTime() - m!.start.getTime()) / 60_000).toBe(90);
    expect(m?.attendeeIds).toEqual(['3', '5']);
  });

  it('skips all-day, inactive, deleted and implausibly long events', () => {
    const base = { ID: '1', ACTIVE: 'Y', DATE_FROM: '12.10.2026 10:00:00', DATE_TO: '12.10.2026 11:00:00', TZ_FROM: 'Europe/Moscow' };
    expect(parseCalendarEvent({ ...base, DT_SKIP_TIME: 'Y' }, 'p', 'Europe/Moscow')).toBeNull();
    expect(parseCalendarEvent({ ...base, ACTIVE: 'N' }, 'p', 'Europe/Moscow')).toBeNull();
    expect(parseCalendarEvent({ ...base, DELETED: 'Y' }, 'p', 'Europe/Moscow')).toBeNull();
    expect(parseCalendarEvent({ ...base, DATE_TO: '13.10.2026 11:00:00' }, 'p', 'Europe/Moscow')).toBeNull();
  });

  it('an event nobody accepted is attributed to its creator; a bad zone falls back', () => {
    const m = parseCalendarEvent(
      { ID: '2', ACTIVE: 'Y', DATE_FROM: '12.10.2026 10:00:00', DATE_TO: '12.10.2026 10:30:00', TZ_FROM: 'Mars/Olympus', CREATED_BY: '4' },
      'p',
      'Europe/Moscow',
    );
    expect(m?.attendeeIds).toEqual(['4']);
    expect(m?.start.toISOString()).toBe('2026-10-12T07:00:00.000Z');
  });
});
