import type { Priority } from './types';

/** Hard rule (spec §6): lower sections collapse while a higher section has active
 *  tasks. nonEmpty contains priorities that have ACTIVE tasks only (done-today
 *  items never affect collapsing). A deliberate tap overrides. */
export function isCollapsed(
  section: Priority,
  nonEmpty: ReadonlySet<Priority>,
  manuallyExpanded: ReadonlySet<Priority>,
): boolean {
  if (manuallyExpanded.has(section)) return false;
  if (section === 'a') return false;
  if (section === 'b') return nonEmpty.has('a');
  return nonEmpty.has('a') || nonEmpty.has('b');
}
