import { describe, it, expect } from 'vitest';
import { toISODate, weekWindow } from '../../src/lib/models/dates';

describe('weekWindow (I-10: browsable calendar window)', () => {
  const anchor = new Date('2026-09-04T15:00:00'); // a Friday

  it('offset 0 starts on the anchor day and spans 7 days', () => {
    const days = weekWindow(anchor, 0);
    expect(days).toHaveLength(7);
    expect(toISODate(days[0])).toBe('2026-09-04');
    expect(toISODate(days[6])).toBe('2026-09-10');
  });

  it('positive offset shifts forward in whole weeks', () => {
    const days = weekWindow(anchor, 1);
    expect(toISODate(days[0])).toBe('2026-09-11');
    expect(toISODate(days[6])).toBe('2026-09-17');
  });

  it('negative offset shifts backward in whole weeks', () => {
    const days = weekWindow(anchor, -1);
    expect(toISODate(days[0])).toBe('2026-08-28');
    expect(toISODate(days[6])).toBe('2026-09-03');
  });
});
