// A trait-list entry's spell roll (rc-2 `spells.roll { listId, level }`; ruled 2026-11-04, bq3-18 A: it opens under
// the entry's pick, on the entry's own step, not on the Magic step). Pure: the roll's rows (the list's spells at that
// level, numbered for the die in the order the setting lists them), what a number typed or tapped lands on, the words
// on the step, the review and the sheet, and the rolled spell as the creation record keeps it (`traitSpells.<list id>`:
// the entry it was rolled for, the spell, the number). The app never rolls; a spell list level the setting doesn't
// fill asks for nothing (of-2).
import { classSpellList, spellChoice, type SpellChoice, type SpellEntry } from './firstSpells.ts';
import { levelNameOf, levelWord, startCapital } from './levelNames.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The roll an entry gives: one spell of a spell list's level. */
export interface SpellRoll {
  listId: string;
  level: number;
}

/** An entry's `spells.roll`, or null when it has none (or the shape isn't `{ listId, level }`). */
export function spellRollOf(spells: unknown): SpellRoll | null {
  const roll = isRecord(spells) ? spells.roll : undefined;
  if (!isRecord(roll) || typeof roll.listId !== 'string' || !roll.listId.trim()) return null;
  if (typeof roll.level !== 'number' || !Number.isInteger(roll.level) || roll.level < 0) return null;
  return { listId: roll.listId.trim(), level: roll.level };
}

/** One row of the roll: the number on the die and the spell it gives. */
export interface SpellRollRow {
  n: number;
  spell: SpellChoice;
}

/** The roll on the step: its die ("d12", one side per spell) and its rows; no rows when the level is empty. */
export interface SpellRollPlan {
  die: string;
  rows: SpellRollRow[];
  /** What one row is, inside a sentence (lv-1): the list's `one` for the level ("glimmer"), else "level 0 spell". */
  what: string;
}

/** The roll's rows from the setting's spells and spell lists in play (those an option switches off left out). */
export function spellRollPlan(roll: SpellRoll, setting: { spells: readonly SpellEntry[]; lists: readonly SpellEntry[] }): SpellRollPlan {
  const ids = classSpellList('', roll.listId, setting.lists, setting.spells).get(roll.level) ?? [];
  const known = ids.filter((id) => setting.spells.some((s) => s.packEntryId === id));
  const list = setting.lists.find((l) => l.packEntryId === roll.listId) ?? null;
  const rows = known.map((id, i) => ({ n: i + 1, spell: spellChoice(id, roll.level, setting.spells, [roll.listId], 1, list) }));
  return { die: rows.length > 0 ? `d${rows.length}` : '', rows, what: levelWord(levelNameOf(list, roll.level), roll.level, 'aSpell') };
}

/** An entry's roll from the setting's entries (spells and spell lists an option switches off left out); null without one. */
export function entryRollPlan(roll: SpellRoll | undefined, all: readonly (SpellEntry & { kind: string })[]): SpellRollPlan | null {
  if (!roll) return null;
  const inPlay = all.filter((e) => !e.optionOff);
  return spellRollPlan(roll, { spells: inPlay.filter((e) => e.kind === 'spell'), lists: inPlay.filter((e) => e.kind === 'spellList') });
}

/** The group's heading (bq3-18): "From Hedge apprentice · roll d12 for one cantrip". */
export const spellRollHeading = (entryName: string, plan: SpellRollPlan): string => `From ${entryName}: roll ${plan.die || 'the dice'} for one ${plan.what}`;

/** What a typed number lands on: the row, or the words saying why none ("No row has 14."); empty text: nothing. */
export function rollTyped(plan: SpellRollPlan, typed: string): { row: SpellRollRow | null; line: string } {
  const value = typed.trim();
  if (!value) return { row: null, line: `A number from 1 to ${plan.rows.length}.` };
  if (!/^\d{1,4}$/.test(value)) return { row: null, line: 'Type the number you rolled.' };
  const row = plan.rows.find((r) => r.n === Number(value)) ?? null;
  return row ? { row, line: `${row.n}: ${row.spell.name}` } : { row: null, line: `No row has ${Number(value)}.` };
}

/** The rolled spell as the creation record keeps it, by list. */
export interface RolledSpell {
  entryId: string;
  spellId: string;
  roll: number;
}

/** The spell rolled for this list's entry, or null (none, or rolled for another entry since changed). */
export function rolledSpellOf(creation: unknown, listId: string, entryId: string | null): RolledSpell | null {
  const all = isRecord(creation) && isRecord(creation.traitSpells) ? creation.traitSpells : {};
  const kept = all[listId];
  if (!isRecord(kept) || typeof kept.entryId !== 'string' || typeof kept.spellId !== 'string' || typeof kept.roll !== 'number') return null;
  return entryId !== null && kept.entryId === entryId ? { entryId: kept.entryId, spellId: kept.spellId, roll: kept.roll } : null;
}

/** True when the record already keeps exactly this roll for the list (or none, with `rolled` null): nothing to save. */
export function sameRolledSpell(creation: unknown, listId: string, rolled: RolledSpell | null): boolean {
  const kept = isRecord(creation) && isRecord(creation.traitSpells) ? creation.traitSpells[listId] : undefined;
  if (!rolled) return kept === undefined;
  return isRecord(kept) && kept.entryId === rolled.entryId && kept.spellId === rolled.spellId && kept.roll === rolled.roll;
}

/** The creation record with this list's rolled spell set, or taken off (null). */
export function withRolledSpell(creation: Record<string, unknown>, listId: string, rolled: RolledSpell | null): Record<string, unknown> {
  const next = { ...creation };
  const all = isRecord(next.traitSpells) ? { ...next.traitSpells } : {};
  if (rolled) all[listId] = rolled;
  else delete all[listId];
  if (Object.keys(all).length > 0) next.traitSpells = all;
  else delete next.traitSpells;
  return next;
}

/** The review's and the sheet's words: "Spark · cantrip, rolled 10 on d12"; the id when the setting lacks the spell. */
export function rolledSpellWords(rolled: RolledSpell, plan: SpellRollPlan): string {
  const name = plan.rows.find((r) => r.spell.id === rolled.spellId)?.spell.name ?? rolled.spellId;
  return `${name}: ${plan.what}, rolled ${rolled.roll}${plan.die ? ` on ${plan.die}` : ''}`;
}

/** What Next says while the roll is due (the level has spells and none is tapped); null when it's done or not asked. */
export function spellRollProblem(plan: SpellRollPlan | null, rolled: { spellId: string } | null): string | null {
  if (!plan || plan.rows.length === 0 || rolled) return null;
  return `Roll ${plan.die} at the table for your ${plan.what}, then tap it.`;
}

/**
 * The review's line for a picked entry's roll (bq3-18): the spell rolled ("Spark · cantrip, rolled 10 on d12"), or,
 * while it's due, "Cantrip not rolled yet" in bold with the step's check. Null: the entry has no roll, or its level
 * has no spells (nothing to ask).
 */
export function rolledSpellReview(plan: SpellRollPlan | null, rolled: RolledSpell | null): { text: string; strong?: boolean; problem: string | null } | null {
  if (!plan || plan.rows.length === 0) return null;
  if (rolled) return { text: rolledSpellWords(rolled, plan), problem: null };
  const what = startCapital(plan.what);
  return { text: `${what} not rolled yet`, strong: true, problem: spellRollProblem(plan, null) };
}
