import { describe, it, expect } from 'vitest';
import type { Solution } from '../../src/lib/models/types';
import { bestSolution, nextBest } from '../../src/lib/models/problemSolver';

function sol(text: string, rating: number): Solution {
  return { id: text, formId: 'f', text, pros: [], cons: [], rating };
}

describe('problemSolver', () => {
  it('best is highest rated', () => {
    expect(bestSolution([sol('low', 3), sol('high', 9)])?.text).toBe('high');
  });

  it('nextBest after rejecting the winner', () => {
    const a = sol('a', 9);
    expect(nextBest(a, [a, sol('b', 7), sol('c', 2)])?.text).toBe('b');
  });

  it('nextBest is undefined when exhausted', () => {
    const a = sol('a', 9);
    expect(nextBest(a, [a])).toBeUndefined();
  });
});
