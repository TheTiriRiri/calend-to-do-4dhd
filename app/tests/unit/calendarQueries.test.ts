import { describe, it, expect } from 'vitest';
import { newTask, type CalendarEvent } from '../../src/lib/models/types';
import { eventsOn, tasksScheduledOn, eventTimesValid, dayTimeline } from '../../src/lib/models/calendarQueries';
import { addDays, startOfDay, toISODate } from '../../src/lib/models/dates';

const now = new Date();
const today = startOfDay(now);

function taskOn(day: Date, completed = false) {
  const t = newTask('t', 'a');
  t.scheduledDate = toISODate(day);
  if (completed) t.dateCompleted = now.toISOString();
  return t;
}

describe('tasksScheduledOn (spec §5 past-day rule)', () => {
  it('shows incomplete tasks on today and future days', () => {
    expect(tasksScheduledOn([taskOn(today)], today, now)).toHaveLength(1);
    expect(tasksScheduledOn([taskOn(addDays(today, 2))], addDays(today, 2), now)).toHaveLength(1);
  });

  it('hides incomplete tasks when browsing a PAST day (they live on the daily list)', () => {
    const past = addDays(today, -3);
    expect(tasksScheduledOn([taskOn(past)], past, now)).toEqual([]);
  });

  it('keeps completed tasks visible on their past day (proof of work)', () => {
    const past = addDays(today, -3);
    expect(tasksScheduledOn([taskOn(past, true)], past, now)).toHaveLength(1);
  });
});

describe('eventsOn', () => {
  it('returns only that day, sorted by start', () => {
    const e1: CalendarEvent = { id: '1', title: 'b', startsAt: addDays(now, 0).toISOString() };
    const e2: CalendarEvent = { id: '2', title: 'a', startsAt: addDays(now, 1).toISOString() };
    expect(eventsOn([e1, e2], now).map((e) => e.id)).toEqual(['1']);
  });
});

describe('eventTimesValid', () => {
  it('accepts a missing end and an end after the start', () => {
    expect(eventTimesValid('12:00')).toBe(true);
    expect(eventTimesValid('12:00', '13:00')).toBe(true);
  });

  it('rejects an end before or equal to the start', () => {
    expect(eventTimesValid('12:00', '11:00')).toBe(false);
    expect(eventTimesValid('12:00', '12:00')).toBe(false);
  });
});

describe('dayTimeline', () => {
  const e = (id: string, iso: string): CalendarEvent => ({ id, title: id, startsAt: iso });
  const at = (h: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).toISOString();
  const timed = (id: string, time?: string) => ({ ...taskOn(today), id, title: id, scheduledTime: time });

  it('merges events and tasks into one chronological list, undated tasks last', () => {
    const entries = dayTimeline(
      [e('e10', at(10)), e('e8', at(8))],
      [timed('t9', '09:00'), timed('t-none')],
    );
    expect(entries.map((x) => (x.kind === 'event' ? x.event.id : x.task.id)))
      .toEqual(['e8', 't9', 'e10', 't-none']);
  });

  it("mode 'timed' drops tasks without a time, mode 'none' drops all tasks", () => {
    const tasks = [timed('t9', '09:00'), timed('t-none')];
    expect(dayTimeline([], tasks, 'timed').map((x) => (x.kind === 'task' ? x.task.id : '')))
      .toEqual(['t9']);
    expect(dayTimeline([e('e8', at(8))], tasks, 'none')).toHaveLength(1);
  });
});
