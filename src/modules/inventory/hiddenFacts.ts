// The facts still hidden on an item (K22b; ruling k22-4, picks 6 and 9; docs/plans/k22-reveal.md): one row per fact,
// in the Reveal pop-up's order, duplicates merged, GM notes never. Read from the line (what it already says, what was
// told) and its entry as the GM has it (its visible part with its hidden part laid over). The database's twin,
// private.hidden_facts (supabase/migrations/20261122100000_k22_unidentified_face.sql), decides what a tell may tell;
// the two must give the same ids in the same order.

import { gmChargeUnitOf } from '../../core/chargeUnit.ts';

/** A fact's id, as the line's `revealedFields` and inventory.tell name it. */
export type FactId = 'magic' | 'name' | 'bonus' | 'cursed' | 'charges' | `power:${number}` | `fields.${string}`;

export interface HiddenFact {
  id: FactId;
  /** The row's words ("Its bonus"; a labelled field under its own label). */
  label: string;
  /** What it is, under the label ("+1 to saves"); empty when the fact is its own words ("That it's cursed"). */
  detail: string;
}

/** What the fact list reads of a line. */
export interface LineFacts {
  identified: boolean;
  revealedFields: readonly string[];
  details: Record<string, unknown>;
  chargesHidden: boolean;
  category: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const at = (data: Record<string, unknown>, path: readonly string[]): unknown =>
  path.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), data);
// Present means the key is there, even holding null (as the database's `#>` reads it).
const has = (data: Record<string, unknown>, path: readonly string[]) => at(data, path) !== undefined;
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const sorted = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(sorted) : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted(value[k])])) : value;

/** Where a bonus lives (07): the gmOnly `bonus`, and a weapon's or armour's magic bonus and bonus against a foe. */
const BONUS_PATHS: readonly (readonly string[])[] = [['bonus'], ['weapon', 'magicBonus'], ['weapon', 'bonusVs'], ['armour', 'magicBonus'], ['armour', 'bonusVs']];

/** The custom fields a setting hides by label: `"fields.<label>"` in gmOnly, or every label when `fields` is hidden whole. */
export function hiddenLabels(whole: Record<string, unknown>): string[] {
  const gmOnly = Array.isArray(whole.gmOnly) ? whole.gmOnly.filter((g): g is string => typeof g === 'string') : [];
  const labels = gmOnly.filter((g) => g.startsWith('fields.') && g.length > 7).map((g) => g.slice(7));
  if (gmOnly.includes('fields') && isRecord(whole.fields)) labels.push(...Object.keys(whole.fields));
  return [...new Set(labels)].sort();
}

/**
 * The custom fields a setting leaves visible that carry a hidden fact in words (07 lets `fields.Bonus` carry the bonus),
 * by label, case and spaces aside, each with its fact; the database's private.fact_fields (review of #40, finding 4).
 */
const FACT_LABELS: Readonly<Record<string, 'bonus' | 'cursed' | 'charges' | 'magic' | 'powers'>> = {
  bonus: 'bonus',
  curse: 'cursed',
  cursed: 'cursed',
  charges: 'charges',
  magic: 'magic',
  power: 'powers',
  powers: 'powers',
};
export function factFields(whole: Record<string, unknown>): { label: string; fact: string }[] {
  if (!isRecord(whole.fields)) return [];
  return Object.keys(whole.fields).flatMap((label) => {
    const fact = FACT_LABELS[label.trim().toLowerCase()];
    return fact ? [{ label, fact }] : [];
  });
}

/** Whether an item is magic, for "That it's magic" (⚑ 6): a magic category, or any item with a bonus or powers. */
export function isMagicItem(whole: Record<string, unknown>, category: string): boolean {
  return (
    /^magic(-|$)/.test(category) ||
    'bonus' in whole ||
    (isRecord(whole.weapon) && ('magicBonus' in whole.weapon || 'bonusVs' in whole.weapon)) ||
    (isRecord(whole.armour) && ('magicBonus' in whole.armour || 'bonusVs' in whole.armour)) ||
    (Array.isArray(whole.properties) && whole.properties.length > 0) ||
    factFields(whole).some((f) => f.fact === 'bonus' || f.fact === 'magic' || f.fact === 'powers')
  );
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** The bonus in words, as the setting gives it: its own text, else the magic bonus ("+1"), else "against …". */
function bonusWords(whole: Record<string, unknown>): string {
  if (typeof whole.bonus === 'string' && whole.bonus.trim()) return whole.bonus.trim();
  if (typeof whole.bonus === 'number') return signed(whole.bonus);
  const field = factFields(whole).find((f) => f.fact === 'bonus');
  const said = field && isRecord(whole.fields) ? whole.fields[field.label] : undefined;
  if (typeof said === 'string' && said.trim()) return said.trim();
  for (const block of ['weapon', 'armour']) {
    const value = at(whole, [block, 'magicBonus']);
    if (typeof value === 'number') return signed(value);
  }
  for (const block of ['weapon', 'armour']) {
    const vs = at(whole, [block, 'bonusVs']);
    const first = Array.isArray(vs) ? vs.find(isRecord) : undefined;
    if (first && typeof first.against === 'string') {
      const n = typeof first.bonus === 'number' ? first.bonus : typeof first.damage === 'number' ? first.damage : null;
      return n === null ? `against ${first.against}` : `${signed(n)} against ${first.against}`;
    }
  }
  return '';
}

/** A power's words: its name, and its note after a colon. */
function powerWords(power: unknown): string {
  if (typeof power === 'string') return power;
  if (!isRecord(power)) return '';
  const name = typeof power.name === 'string' ? power.name.trim() : '';
  const note = typeof power.note === 'string' ? power.note.trim() : '';
  return name && note ? `${name}: ${note}` : name || note;
}

const text = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '');

/**
 * The facts still hidden on this line, in order: that it's magic, its true name, its bonus, each power, that it's
 * cursed, its charges, each labelled hidden field. `whole` is the entry as the GM has it (null: the entry is gone, so
 * only the line's own charges can be told); `trueName` the entry's name.
 */
export function hiddenFacts(line: LineFacts, whole: Record<string, unknown> | null, trueName = ''): HiddenFact[] {
  const facts: HiddenFact[] = [];
  const data = line.details;
  if (!line.identified && whole && isMagicItem(whole, line.category) && !line.revealedFields.includes('magic')) {
    facts.push({ id: 'magic', label: 'That it’s magic', detail: '' });
  }
  if (!line.identified) facts.push({ id: 'name', label: 'Its true name', detail: trueName });
  // A fact said in a visible field's words, not yet on the line (its Bonus or Curse field).
  const ownFields = isRecord(data.fields) ? data.fields : {};
  const fieldUntold = (fact: string) => (whole ? factFields(whole).some((f) => f.fact === fact && !(f.label in ownFields)) : false);
  if (whole && (BONUS_PATHS.some((path) => has(whole, path) && !has(data, path)) || fieldUntold('bonus'))) {
    facts.push({ id: 'bonus', label: 'Its bonus', detail: bonusWords(whole) });
  }
  if (whole && Array.isArray(whole.properties)) {
    const own = Array.isArray(data.properties) ? data.properties : [];
    whole.properties.forEach((power, i) => {
      if (!own.some((p) => same(p, power))) facts.push({ id: `power:${i}`, label: 'A power', detail: powerWords(power) });
    });
  }
  if (whole && ((whole.cursed === true && data.cursed !== true) || fieldUntold('cursed'))) facts.push({ id: 'cursed', label: 'That it’s cursed', detail: '' });
  // The count in its unit (G-233, page 49 frame 49-3): the GM's list, so the GM's copy's unit, else the line's ("Its portions").
  if (line.chargesHidden) facts.push({ id: 'charges', label: `Its ${gmChargeUnitOf(whole, data).many}`, detail: '' });
  if (whole && isRecord(whole.fields)) {
    const fields = whole.fields;
    const own = isRecord(data.fields) ? data.fields : {};
    for (const label of hiddenLabels(whole)) {
      if (label in fields && !(label in own)) facts.push({ id: `fields.${label}`, label, detail: text(fields[label]) });
    }
  }
  return facts;
}
