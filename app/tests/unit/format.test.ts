import { describe, expect, it } from 'vitest';
import { shortDate, taskCount } from '../../src/lib/design/format';

describe('shortDate', () => {
  it('renders a Polish short weekday with a zero-padded day and month', () => {
    // 2026-09-04 is a Friday; noon-anchored so no timezone can shift the day
    expect(shortDate(new Date('2026-09-04T12:00:00'))).toBe('Pt 04.09');
  });

  it('pads single-digit days and months', () => {
    expect(shortDate(new Date('2026-01-05T12:00:00'))).toBe('Pn 05.01');
  });

  it('covers every weekday, Sunday included', () => {
    // padStart: `2026-09-010` is not ISO and parses as Invalid Date
    const week = [4, 5, 6, 7, 8, 9, 10].map((d) => shortDate(new Date(`2026-09-${String(d).padStart(2, '0')}T12:00:00`)));
    expect(week).toEqual(['Pt 04.09', 'So 05.09', 'Nd 06.09', 'Pn 07.09', 'Wt 08.09', 'Śr 09.09', 'Cz 10.09']);
  });
});

describe('taskCount', () => {
  it('uses the singular for exactly one', () => {
    expect(taskCount(1)).toBe('1 zadanie');
  });

  it('uses the "few" form for 2-4', () => {
    expect(taskCount(2)).toBe('2 zadania');
    expect(taskCount(3)).toBe('3 zadania');
    expect(taskCount(4)).toBe('4 zadania');
  });

  it('uses the "many" form for 5 and up', () => {
    expect(taskCount(5)).toBe('5 zadań');
    expect(taskCount(11)).toBe('11 zadań');
    expect(taskCount(25)).toBe('25 zadań');
  });

  it('keeps the Polish teens rule: 12-14 are "many", not "few"', () => {
    expect(taskCount(12)).toBe('12 zadań');
    expect(taskCount(22)).toBe('22 zadania');
  });
});
