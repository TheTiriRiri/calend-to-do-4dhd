import type { Solution } from './types';

export function bestSolution(solutions: Solution[]): Solution | undefined {
  return [...solutions].sort((x, y) => y.rating - x.rating)[0];
}

export function nextBest(after: Solution, solutions: Solution[]): Solution | undefined {
  return bestSolution(solutions.filter((s) => s.id !== after.id));
}
