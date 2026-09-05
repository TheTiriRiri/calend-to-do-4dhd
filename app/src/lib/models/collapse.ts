import type { Priority } from './types';

/** Hard rule (spec §6): lower sections collapse while a higher section has active
 *  tasks. nonEmpty contains priorities that have ACTIVE tasks only (done-today
 *  items never affect collapsing). A deliberate tap overrides. */
/** A tap opens a lower section, it does not disable the rule for the rest of the
 *  day. The expand is remembered together with the ids that were active above it
 *  at that moment: while those only get ticked off, the section stays open; the
 *  moment work that was not there appears above it, the override drops and the
 *  section closes again. No nagging — the section simply returns to a tile. */
export function expansionHolds(idsAtExpand: ReadonlySet<string>, higherActiveIds: readonly string[]): boolean {
  return higherActiveIds.every((id) => idsAtExpand.has(id));
}

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
