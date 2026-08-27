import { describe, it, expect } from 'vitest';
import { newTask, type CalendarEvent } from '../../src/lib/models/types';
import { eventsOn, tasksScheduledOn } from '../../src/lib/models/calendarQueries';
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
