import { strings } from './strings';

/** "Pt 04.09" — the review-screen date. Composed by hand: pl-PL Intl gives
 *  "pt, 04.09" (comma, lowercase), which the design does not use. */
export function shortDate(d: Date): string {
  const weekday = strings.dates.weekdaysShort[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${day}.${month}`;
}

const plural = new Intl.PluralRules('pl-PL');

/** "3 zadania" — Polish has three forms and the 12-14 exception, so a template
 *  string is not enough ("5 zadania" would be wrong). */
export function taskCount(n: number): string {
  const forms = strings.dailyList.taskCountForms;
  const rule = plural.select(n);
  const word = rule === 'one' ? forms.one : rule === 'few' ? forms.few : forms.many;
  return `${n} ${word}`;
}
