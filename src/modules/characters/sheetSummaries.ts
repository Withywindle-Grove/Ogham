// The full sheet's one-line summaries (sr-7, sheet plan order 4; docs/06 "Sheet section"): on a phone each section
// folds to its fold row, "Saves" over "Doom 11, Ray 12", that opens in place. These build the words under the section's
// name; the line is cut with "…" on screen when it runs out of room, so the first parts are the ones that matter most.
// No middle dot (plan m5b-players-screens-standard A2): commas inside the line, a colon after a count.
// Nothing here is a rule: the words come from what the section shows.

/** The separator between a summary's parts. */
const SEP = ', ';

/** The parts that say something, joined: blanks and "—" (nothing filled in) are left out. */
export function joinSummary(parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter((p) => p !== '' && p !== '—')
    .join(SEP);
}

/** Label and value for each row that has a value ("Speed 40, Exploring 120"); "—" rows are left out. */
export function labelledSummary(rows: readonly { label: string; value: string | number }[]): string {
  return joinSummary(rows.filter((r) => String(r.value).trim() !== '' && String(r.value) !== '—').map((r) => `${r.label} ${r.value}`));
}

/**
 * The values alone, for a section of words ("Lantern, Reedish, Common, Hedge apprentice"); a number keeps its label
 * ("Might 13"), since a bare number says nothing.
 */
export function valuesSummary(rows: readonly { label: string; value: string | number }[]): string {
  return joinSummary(rows.map((r) => (/^[+\-−]?\d/.test(String(r.value).trim()) ? `${r.label} ${r.value}` : String(r.value))));
}

/** A count, a colon, then the names ("4: Lantern ward, Moon sight, Iron-shy"): the mockup's Traits and Skills lines. */
export function countedSummary(names: readonly string[]): string {
  if (names.length === 0) return '';
  return `${names.length}: ${names.join(', ')}`;
}

/** Magic: each kind with its count ("Spell book 4, Prepared 1, Glamours 2"). */
export function magicSummary(tabs: readonly { title: string; count: number }[]): string {
  return joinSummary(tabs.map((t) => `${t.title} ${t.count}`));
}

/** The Pack load: the speed it sets (over the most, the setting's words for it), then how many things. */
export function packLoadSummary(speed: { speed: number | null; why: string } | null, items: number): string {
  const over = speed?.why ? speed.why.charAt(0).toUpperCase() + speed.why.slice(1) : '';
  const moving = speed === null ? '' : speed.speed === null ? over : `Speed ${speed.speed}`;
  return joinSummary([moving, items === 0 ? 'Nothing carried' : items === 1 ? '1 item' : `${items} items`]);
}

// The Player screen's foot rows (dec-13 C12): a hosted section's line names its rows.
/** Most names a row's line carries; more than that ends "and N more" (the row opens them all). */
export const SUMMARY_NAMES = 4;

/** A row's one line: the names joined by commas ("Horns, Sure-footed"), the rest counted ("…, and 3 more"). */
export function summaryLine(names: readonly string[]): string {
  const kept = names.map((n) => n.trim()).filter(Boolean);
  if (kept.length <= SUMMARY_NAMES) return kept.join(', ');
  const more = kept.length - SUMMARY_NAMES;
  return `${kept.slice(0, SUMMARY_NAMES).join(', ')}, and ${more} more`;
}
