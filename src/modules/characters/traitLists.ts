// Trait lists at creation and on the sheet (M5b step 0b part B, ruled Now 2026-11-01;
// design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md §4; 04 Actors: traitLists; 07 traitLists). Pure: the
// setting's trait lists read from its entries, which creation steps they make (one per list a sheet field points
// at), an entry's roll range, the step's why-line, and the words a saved value shows (the entry's name).
// On the creation step shell (M5b step 0c, slice 6; cr-17): a list gated by an option is absent when the option is
// off, a per-race list (the field's `from` as a pattern, "backgrounds-{race}") is chosen by the character's race, a
// list may leave out some races (`excludeRaces`), and an entry may grant starting gear (`entries[].items`, 07).
import type { FieldDefinition, TraitLookup } from './fields.ts';
import { layoutKeys, optionSpecOn as sharedSpecOn, specText } from '../library/optionGate.ts';
import { gearLines, type KitItem } from './startingGear.ts';
import { spellRollOf, type SpellRoll } from './traitSpellRoll.ts';
import { levelWord } from './levelNames.ts';

/** A gear line in words: "Rope ×2", "Arrows · 10", a one-off by its name. */
export function gearWords(line: KitItem, itemName: (itemId: string) => string | undefined): string {
  const name = line.itemId ? (itemName(line.itemId) ?? line.itemId) : (line.name ?? '');
  if (line.units !== undefined) return `${name} (${line.units})`;
  return line.qty > 1 ? `${name} ×${line.qty}` : name;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

export interface TraitEntry {
  id: string;
  name: string;
  /** The roll range when the list has a die (07: min and max). */
  min: number | null;
  max: number | null;
  blurb: string;
  notes: string;
  /** "p. 34" (07: source). */
  source: string;
  /**
   * Starting gear the entry grants (07 `entries[].items`, the starting-kit shape; `units`, cs-6; a `{ name }` line is a
   * one-off, rc-3); filled into the pack when picked.
   */
  items: KitItem[];
  /** Coins the entry adds to starting money (rc-2 `money`, a whole number in the money's coin); 0 without. */
  money?: number;
  /** `money` given as dice (rc-2: rolled at the table); '' without. Not read yet: see the plan's Departures. */
  moneyDice?: string;
  /** A spell rolled when the entry is picked (rc-2 `spells.roll`; bq3-18: under the pick, on this step); absent without. */
  spellRoll?: SpellRoll;
  /**
   * The powers the entry gives once picked or rolled (07 `traitLists[].entries[].abilities`, G-213, the classes'
   * shape): they join the sheet's Abilities rows. Absent without.
   */
  abilities?: TraitAbility[];
}

/** One power a trait-list entry gives (G-213): `uses` for the dots; `spellId` the spell it casts (any attached pack). */
export interface TraitAbility {
  name: string;
  note: string;
  uses?: { count: number; per: string };
  spellId?: string;
}

/** An entry's `abilities` as the pack gives them; ones without a name are left out. */
function traitAbilitiesOf(raw: unknown): TraitAbility[] {
  return (Array.isArray(raw) ? raw.filter(isRecord) : []).flatMap((a) => {
    const name = text(a.name);
    if (!name) return [];
    const uses = isRecord(a.uses) ? a.uses : null;
    const count = uses ? whole(uses.count) : null;
    const spellId = text(a.spellId);
    return [{ name, note: text(a.note) || text(a.notes), ...(count !== null && count > 0 ? { uses: { count, per: text(uses!.per) } } : {}), ...(spellId ? { spellId } : {}) }];
  });
}

export interface TraitList {
  id: string;
  name: string;
  /** "d6", "d100"…: rolled at the table, then tapped. '' when the list is picked, not rolled. */
  die: string;
  notes: string;
  /** The list's own Help me choose words (07 `traitLists[].help`, ruled 2026-11-02); '' when it has none. */
  help: string;
  /** The option that must be on for the list to be offered ("<option id>[:<choice id>]"); '' when always. */
  option: string;
  /** Races that don't take this list (their ids). */
  excludeRaces: string[];
  source: string;
  /**
   * How many times a character rolls or picks on the list at creation (07 `rolls`, pf-16, ruled 2026-11-13); 1 when
   * the pack leaves it out or gives anything but a whole number of 1 or more.
   */
  rolls: number;
  /** No result twice (07 `distinct`, pf-16): a second take of an entry already picked is refused. */
  distinct: boolean;
  entries: TraitEntry[];
}

/** A list's `rolls` (pf-16): a whole number of 1 or more, else 1. */
const rollsOf = (value: unknown): number => {
  const n = whole(value);
  return n !== null && n >= 1 ? n : 1;
};

/** The setting's trait lists (kind traitList), in the order given; lists without usable entries are left out. */
export function traitListsOf(entries: readonly { kind: string; packEntryId: string; name: string; data: Record<string, unknown> }[]): TraitList[] {
  return entries
    .filter((e) => e.kind === 'traitList')
    .map((e) => ({
      id: e.packEntryId,
      name: e.name,
      die: text(e.data.die),
      notes: text(e.data.notes),
      help: text(e.data.help),
      option: specText(e.data.option),
      excludeRaces: (Array.isArray(e.data.excludeRaces) ? e.data.excludeRaces : []).map(text).filter(Boolean),
      source: text(e.data.source),
      rolls: rollsOf(e.data.rolls),
      distinct: e.data.distinct === true,
      entries: (Array.isArray(e.data.entries) ? e.data.entries : []).filter(isRecord).flatMap((raw, index) => {
        const id = text(raw.id) || `entry-${index + 1}`;
        const name = text(raw.name) || id;
        const items = gearLines(Array.isArray(raw.items) ? raw.items.filter(isRecord) : []);
        const money = whole(raw.money) !== null && whole(raw.money)! > 0 ? whole(raw.money)! : 0;
        const spellRoll = spellRollOf(raw.spells);
        const abilities = traitAbilitiesOf(raw.abilities);
        return [{ id, name, min: whole(raw.min), max: whole(raw.max), blurb: text(raw.blurb) || text(raw.summary), notes: text(raw.notes), source: text(raw.source), items, ...(money > 0 ? { money } : {}), ...(typeof raw.money === 'string' && text(raw.money) ? { moneyDice: text(raw.money) } : {}), ...(spellRoll ? { spellRoll } : {}), ...(abilities.length > 0 ? { abilities } : {}) }];
      }),
    }))
    .filter((list) => list.entries.length > 0);
}

/** An entry's roll range as words ("3–5", or "4" when min and max agree); '' without one. */
export function traitRange(entry: TraitEntry): string {
  if (entry.min === null && entry.max === null) return '';
  const min = entry.min ?? entry.max!;
  const max = entry.max ?? entry.min!;
  return min === max ? String(min) : `${min}–${max}`;
}

/** The row's name: the range first when the list has a die ("3–5 · Reed cutter"). */
export function traitRowName(list: TraitList, entry: TraitEntry): string {
  const range = list.die ? traitRange(entry) : '';
  return range ? `${range}: ${entry.name}` : entry.name;
}

export interface TraitStep {
  /** The step's id in the flow and on the To finish card: the list's id (the ruling). */
  id: string;
  list: TraitList;
  /** The sheet field that keeps the pick (a list field holds the entry's id; a text field, its name). */
  field: FieldDefinition;
  /** What the field keeps: the entry's id (a list field fed by the list) or its name (a text field, a per-race list). */
  keeps: 'id' | 'name';
}

/** What a sheet layout says about a field beyond what the campaign's field keeps (its `from` pattern, its option). */
export interface LayoutHint {
  from: string;
  option: string;
}

/**
 * The layout's word on each field, by key (both forms, optionGate.ts `layoutKeys`), from the setting's sheet layouts (kind fieldTemplate): its `from` (a
 * pattern like "backgrounds-{race}" isn't kept on the campaign's field) and its `option` ("secondary-skills=on").
 */
export function layoutHints(entries: readonly { kind: string; data: Record<string, unknown> }[]): Map<string, LayoutHint> {
  const out = new Map<string, LayoutHint>();
  for (const e of entries.filter((x) => x.kind === 'fieldTemplate')) {
    for (const f of (Array.isArray(e.data.fields) ? e.data.fields : []).filter(isRecord)) {
      const key = text(f.key);
      if (key && (text(f.from) || specText(f.option))) for (const k of layoutKeys(key)) out.set(k, { from: text(f.from), option: specText(f.option) });
    }
  }
  return out;
}

/**
 * What each field is for, by key, from the setting's sheet layouts: the layout field's `help` (ct3-3, "The faction
 * your character works with…"), shown behind the field's ⓘ on the sheet. Fields without one are left out.
 */
export function layoutHelp(entries: readonly { kind: string; data: Record<string, unknown> }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entries.filter((x) => x.kind === 'fieldTemplate')) {
    for (const f of (Array.isArray(e.data.fields) ? e.data.fields : []).filter(isRecord)) {
      if (text(f.key) && text(f.help) && !out.has(text(f.key))) out.set(text(f.key), text(f.help));
    }
  }
  return out;
}

/**
 * The fields creation never asks (ct3-3, ruled B 2026-11-03): the keys of the sheet layouts' fields that carry
 * `atCreation: false` (07, fieldTemplates), such as an affiliation that comes from play. Not on Who they are, not as a
 * step; they stay on the sheet with their ⓘ. The app keeps no list of its own.
 */
export function notAskedAtCreation(entries: readonly { kind: string; data: Record<string, unknown> }[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries.filter((x) => x.kind === 'fieldTemplate')) {
    for (const f of (Array.isArray(e.data.fields) ? e.data.fields : []).filter(isRecord)) {
      // Both forms of the key (layoutKeys): a campaign's "Use this sheet layout" field holds it in lower case.
      if (text(f.key) && f.atCreation === false) for (const k of layoutKeys(text(f.key))) out.add(k);
    }
  }
  return out;
}

/**
 * Whether Who they are leaves a field out because a trait list owns it (ct3-4b): a list field fed by one of the
 * setting's lists, or one whose layout `from` is a per-race pattern. Its step asks it when the character takes the
 * list; a character the list leaves out (`excludeRaces`, an option off) is never asked it at all.
 */
export function ownedByTraitList(field: FieldDefinition, lists: readonly TraitList[], layout: ReadonlyMap<string, LayoutHint>): boolean {
  const pattern = layout.get(field.key)?.from ?? '';
  if (pattern.includes('{race}')) {
    const [before, after] = pattern.split('{race}', 2) as [string, string];
    return lists.some((l) => l.id.length > before.length + after.length && l.id.startsWith(before) && l.id.endsWith(after));
  }
  return field.type === 'list' && !!field.from && lists.some((l) => l.id === field.from);
}

/**
 * The sheet fields a trait list owns that this character never takes (sr-6, ct3-4b): the list leaves out their race
 * (`excludeRaces`), or the list's or the field's option is off. A per-race field (`from` "fen-omens-{race}") whose
 * race has no list is left out too, unless something was written in it. Their values stay saved, as of-9's do.
 */
export function fieldsListLeavesOut(
  fieldDefs: readonly FieldDefinition[],
  lists: readonly TraitList[],
  layout: ReadonlyMap<string, LayoutHint>,
  who: { raceRef: string | null; values: Readonly<Record<string, unknown>> },
  choices: Readonly<Record<string, string>>,
): Set<string> {
  const out = new Set<string>();
  for (const field of fieldDefs) {
    if (!ownedByTraitList(field, lists, layout)) continue;
    const hint = layout.get(field.key);
    const pattern = hint?.from.includes('{race}') ? hint.from : '';
    if (pattern && !who.raceRef) continue;
    const list = lists.find((l) => l.id === (pattern ? pattern.replace('{race}', who.raceRef!) : field.from));
    const value = who.values[field.key];
    const empty = value === undefined || value === null || value === '';
    if (!list) {
      if (pattern && empty) out.add(field.key);
      continue;
    }
    const optionOff = !optionSpecOn(hint?.option ?? '', choices) || !optionSpecOn(list.option, choices);
    if (optionOff || (who.raceRef !== null && list.excludeRaces.includes(who.raceRef))) out.add(field.key);
  }
  return out;
}

/** "secondary-skills=on", "moon-signs:on", "moon-signs": on when the campaign chose that choice (no choice: `on`). */
export function optionSpecOn(spec: string, choices: Readonly<Record<string, string>>): boolean {
  return sharedSpecOn(spec, choices);
}

/**
 * The trait-list steps: one per list a visible sheet field points at (`from`), in the fields' order (the layout's,
 * which is the pack's). A field whose list the setting doesn't have makes no step (it's free text, as before).
 * With `context` (creation, m5b-0c slice 6, cr-17): a `{race}` in the field's `from` is the character's race; a list
 * or field whose option is off makes no step; nor does a list that leaves out the character's race.
 */
export function traitSteps(
  fieldDefs: readonly FieldDefinition[],
  lists: readonly TraitList[],
  context: { layout?: ReadonlyMap<string, LayoutHint>; raceId?: string | null; choices?: Readonly<Record<string, string>> } = {},
): TraitStep[] {
  const steps: TraitStep[] = [];
  const choices = context.choices ?? null;
  for (const field of fieldDefs) {
    if (field.hidden) continue;
    const hint = context.layout?.get(field.key);
    const pattern = hint?.from.includes('{race}') ? hint.from : '';
    const wanted = pattern ? (context.raceId ? pattern.replace('{race}', context.raceId) : '') : field.type === 'list' ? (field.from ?? '') : '';
    if (!wanted || steps.some((s) => s.id === wanted)) continue;
    // A per-race list's field is kept as text by the campaign (the pattern isn't a list id): it keeps the name.
    if (pattern && field.type !== 'list' && field.type !== 'text' && field.type !== 'longtext') continue;
    const list = lists.find((l) => l.id === wanted);
    if (!list) continue;
    if (choices && (!optionSpecOn(hint?.option ?? '', choices) || !optionSpecOn(list.option, choices))) continue;
    if (context.raceId && list.excludeRaces.includes(context.raceId)) continue;
    steps.push({ id: list.id, list, field, keeps: field.type === 'list' && field.from === list.id ? 'id' : 'name' });
  }
  return steps;
}

/** The die as the table says it: "d12" is "1d12"; "2d6" stays. */
export function dieWords(die: string): string {
  return /^d\d+$/i.test(die.trim()) ? `1${die.trim().toLowerCase()}` : die.trim();
}

/** Whether words already name the die ("Roll 1d12 …", "a d12"): then the app adds no roll line of its own. */
function namesDie(words: string, die: string): boolean {
  const sides = /d(\d+)$/i.exec(die.trim())?.[1];
  return !!sides && new RegExp(`(^|[^a-z0-9])[0-9]*d${sides}(?![0-9])`, 'i').test(words);
}

/**
 * cr-17, ct-9; Design on #570 (2026-11-09): "Roll 1d12 at the table, then tap the row, or pick one." with the list's own
 * die; null for a list that is picked.
 */
export function traitPickLine(list: TraitList): string | null {
  return list.die ? `Roll ${dieWords(list.die)} at the table, then tap the row, or pick one.` : null;
}

/**
 * The step's line and its Roll row (ct-9; retest 4 S1: every roll in its Roll row with the die's glyph, never in the
 * line; Design on #570: a list's line is its own, never another list's or the step's). The line is the list's notes;
 * with a die the Roll row names it: the notes when they name the die themselves (then no line besides), else the
 * app's roll line. A list with no notes has no line of its own beyond its Roll row; one with no die and no notes reads
 * "Pick one.".
 */
export function traitLines(list: TraitList): { why: string; roll: string | null } {
  if (!list.die) return { why: list.notes || 'Pick one.', roll: null };
  if (list.notes && namesDie(list.notes, list.die)) return { why: '', roll: list.notes };
  return { why: list.notes, roll: traitPickLine(list) };
}

/**
 * Help me choose on a trait-list step, keyed by the step and its list (retest 4 T5, 2026-11-09; ct3-8): the list's own
 * help (07 `traitLists[].help`), else the app's generic trait-list help naming the list. The step's
 * `creationGuide.traits.help` no longer stands in: it spoke of one list (a base setting's secondary skills) and showed
 * on every other list's step (an overlay's bloodline).
 */
export function traitHelp(list: TraitList): string {
  return list.help.trim() || genericTraitHelp(list);
}

/** The app's own words for a trait list without help: about this list, so no two steps share them. */
export function genericTraitHelp(list: TraitList): string {
  const name = list.name.trim() || 'This list';
  const how = list.die ? `roll ${dieWords(list.die)} at the table and tap what you rolled, or pick one if your group agrees` : 'pick the one that fits your character';
  const unsure = list.die ? 'roll and take what comes' : 'pick the one you would most like to play';
  return `${name}: ${how}. Tap a name to read what it gives before you choose. If you're unsure, ${unsure}, or ask your GM.`;
}

/**
 * The entry pop-up's headings: the roll range, the full notes, the gear it grants (by the setting's item names), and
 * the spell it rolls, in `spellWord` (the roll's own word for one spell, lv-1: "glimmer"), else the fallback words.
 */
export function traitHeadings(list: TraitList, entry: TraitEntry, itemName: (itemId: string) => string | undefined, spellWord?: string): { label: string; text: string }[] {
  const range = list.die ? traitRange(entry) : '';
  const gear = entry.items.map((i) => gearWords(i, itemName)).join(', ');
  return [
    ...(range ? [{ label: 'Roll', text: `${range} on ${list.die}` }] : []),
    ...(entry.blurb && entry.blurb !== entry.notes ? [{ label: 'In short', text: entry.blurb }] : []),
    ...(entry.notes ? [{ label: 'Rules', text: entry.notes }] : []),
    ...(gear ? [{ label: 'Starts with', text: `${gear}, added to your pack when picked` }] : []),
    ...((entry.money ?? 0) > 0 ? [{ label: 'Money', text: `Adds ${entry.money} to your starting money` }] : entry.moneyDice ? [{ label: 'Money', text: `Roll ${entry.moneyDice} at the table: your GM adds it to your starting money` }] : []),
    ...(entry.spellRoll ? [{ label: 'Spell', text: `One ${spellWord ?? levelWord(null, entry.spellRoll.level, 'aSpell')}, rolled at the table when you pick it` }] : []),
  ];
}

/** A pick on a trait-list step: an entry of the list, or a typed Other… with its note. */
export type TraitPick = { entryId: string } | { other: string; note: string };

/** What a pick keeps in the field: the entry's id (a list field) or its name; a typed Other… keeps "Name — note". */
export function traitValue(step: TraitStep, pick: TraitPick): string {
  if ('entryId' in pick) return step.keeps === 'id' ? pick.entryId : (step.list.entries.find((e) => e.id === pick.entryId)?.name ?? pick.entryId);
  return pick.note ? `${pick.other} — ${pick.note}` : pick.other;
}

/** The pick a saved value holds (Back, the To finish card): an entry by id or by name, else a typed Other…. */
export function traitPickOf(step: TraitStep, saved: unknown): TraitPick | null {
  if (typeof saved !== 'string' || !saved.trim()) return null;
  const value = saved.trim();
  const entry = step.list.entries.find((e) => e.id === value || e.name.toLowerCase() === value.toLowerCase());
  if (entry) return { entryId: entry.id };
  const [other, ...note] = value.split(' — ');
  return { other: other!.trim(), note: note.join(' — ').trim() };
}

/**
 * How a list rolled more than once keeps its picks in the field (pf-16): each pick's words (as `traitValue`), joined
 * by "; ". The field stays text, so nothing about its type changes and a pick saved before reads as one.
 */
export const TRAIT_PICKS_JOIN = '; ';

/** What N picks keep in the field: each pick's words, joined (one pick: as before). */
export function traitValues(step: TraitStep, picks: readonly TraitPick[]): string {
  return picks.map((p) => traitValue(step, p)).join(TRAIT_PICKS_JOIN);
}

/**
 * The picks a saved value holds (pf-16): a list rolled once holds one, as before; a list rolled more often holds them
 * joined by "; ". A value that is one entry as a whole (an id, or a name with "; " in it) is one pick, so a single
 * pick saved before the list rolled twice still reads as one.
 */
export function traitPicksOf(step: TraitStep, saved: unknown): TraitPick[] {
  const whole = traitPickOf(step, saved);
  if (!whole) return [];
  if (step.list.rolls <= 1 || 'entryId' in whole) return [whole];
  return (saved as string).split(TRAIT_PICKS_JOIN).flatMap((part) => {
    const pick = traitPickOf(step, part);
    return pick ? [pick] : [];
  });
}

/** How many times each entry is picked (a list without `distinct` may take one twice). */
export const takesOf = (picks: readonly TraitPick[], entryId: string): number => picks.filter((p) => 'entryId' in p && p.entryId === entryId).length;

/**
 * The takes mark (the lead's rulings of 2026-11-13): an entry taken more than once on a list without `distinct` shows
 * one tick for each take on its Pick button, "Picked ✓✓", "Picked ✓✓✓"…, the shape of Weapon skills' "Specialised ✓✓";
 * no cap, never a number, and the name carries no count.
 */
export const takesLabel = (takes: number): string => `Picked ${takesTicks(takes)}`;

/** The ticks for `takes` takes, one a take and at least one: "✓", "✓✓", "✓✓✓"… (the button and the foot line). */
export const takesTicks = (takes: number): string => '✓'.repeat(Math.max(1, Math.floor(takes)));

/** What a screen reader hears after the name: "picked" (one take or fewer), "picked twice", "picked 3 times"… */
export const takesSpoken = (takes: number): string => (takes > 2 ? `picked ${takes} times` : takes === 2 ? 'picked twice' : 'picked');

/** The picks less one take of the entry (its last). */
export function withoutTake(picks: readonly TraitPick[], entryId: string): TraitPick[] {
  const at = picks.map((p) => ('entryId' in p ? p.entryId : '')).lastIndexOf(entryId);
  return at < 0 ? [...picks] : [...picks.slice(0, at), ...picks.slice(at + 1)];
}

/** "1 of 2 picked" (the app's group count words, firstSpells `groupCount`). */
const countWords = (picked: number, of: number) => `${picked} of ${of} picked`;

/**
 * A tap on an entry's ✓ (pf-16). Rolled once: picks it, or unpicks it (as before). Rolled N times: an entry not yet
 * picked is added while there's room ("2 of 2 picked: take one off to pick another." when not); one already picked is taken again
 * while there's room, unless the list is `distinct` ("Already yours: roll again." on a list with a die, "pick another."
 * without; the entry's pop-up unpicks it); with no room left, the tap takes one take of it off.
 */
export function tapTraitPick(list: TraitList, picks: readonly TraitPick[], entryId: string): { picks: TraitPick[] } | { problem: string } {
  const taken = takesOf(picks, entryId);
  if (list.rolls <= 1) return { picks: taken > 0 ? [] : [{ entryId }] };
  const full = picks.length >= list.rolls;
  if (taken > 0 && full) return { picks: withoutTake(picks, entryId) };
  if (full) return { problem: `${countWords(picks.length, list.rolls)}: take one off to pick another.` };
  if (taken > 0 && list.distinct) return { problem: `Already yours: ${list.die ? 'roll again' : 'pick another'}.` };
  return { picks: [...picks, { entryId }] };
}

/**
 * Other…: a typed entry joins the picks (rolled once: replaces the pick), unless the count is full or, on a `distinct`
 * list, it's already there. On a list rolled more than once a semicolon is refused in the name or note: the field
 * joins the picks with "; ", so one would read back as two picks.
 */
export function addTraitOther(list: TraitList, picks: readonly TraitPick[], other: string, note: string): { picks: TraitPick[] } | { problem: string } {
  if (list.rolls <= 1) return { picks: [{ other, note }] };
  if (`${other}${note}`.includes(';')) return { problem: "A name or note can't hold a semicolon on this list. Use a comma instead." };
  if (list.distinct && picks.some((p) => ('other' in p ? p.other : (list.entries.find((e) => e.id === p.entryId)?.name ?? '')).toLowerCase() === other.toLowerCase())) return { problem: `${other} is already yours.` };
  if (picks.length >= list.rolls) return { problem: `${countWords(picks.length, list.rolls)}: take one off to pick another.` };
  return { picks: [...picks, { other, note }] };
}

/** The group's count line (pf-16): "1 of 2 picked" on a list rolled more than once; null on one rolled once. */
export function traitCountLine(list: TraitList, picks: readonly TraitPick[]): string | null {
  return list.rolls > 1 ? countWords(picks.length, list.rolls) : null;
}

/** Next's check: what's still to pick ("Pick 1 more, or Decide later."), or null when it may go on. */
export function traitPicksProblem(list: TraitList, picks: readonly TraitPick[], later: boolean): string | null {
  if (list.rolls <= 1) return picks.length > 0 ? null : later ? 'Pick one, or Decide later.' : 'Pick one to go on.';
  const left = list.rolls - picks.length;
  return left > 0 ? `Pick ${left} more${later ? ', or Decide later' : ' to go on'}.` : null;
}

/** A pick's name as the step shows it. */
export const traitPickName = (list: TraitList, pick: TraitPick): string => ('entryId' in pick ? (list.entries.find((e) => e.id === pick.entryId)?.name ?? pick.entryId) : pick.other);

/**
 * The step's foot line (the lead's ruling of 2026-11-13): each picked entry once, in the order first picked, with how
 * many times it was taken, so the line can show its ticks as its row does ("Heron ✓✓, Frog in frost picked"). A typed
 * entry is its own; the review and the sheet keep one line per pick.
 */
export function traitPicksOnce(list: TraitList, picks: readonly TraitPick[]): { name: string; takes: number }[] {
  const out: { key: string; name: string; takes: number }[] = [];
  picks.forEach((p, at) => {
    const key = 'entryId' in p ? `entry:${p.entryId}` : `other:${at}`;
    const seen = out.find((o) => o.key === key);
    if (seen) seen.takes += 1;
    else out.push({ key, name: traitPickName(list, p), takes: 1 });
  });
  return out.map(({ name, takes }) => ({ name, takes }));
}

/**
 * The gear and coins N picks grant together (pf-16): the picked entries' `items` and `money` in one, so the existing
 * grant fills them as one pick's; null when no entry is picked. One pick: its entry as it is.
 */
export function pickedGearEntry(list: TraitList, picks: readonly TraitPick[]): TraitEntry | null {
  const entries = picks.flatMap((p) => ('entryId' in p ? list.entries.filter((e) => e.id === p.entryId) : []));
  if (entries.length <= 1) return entries[0] ?? null;
  const money = entries.reduce((sum, e) => sum + (e.money ?? 0), 0);
  return { ...entries[0]!, items: entries.flatMap((e) => e.items), ...(money > 0 ? { money } : {}) };
}

/** Whether the pack requires this step: `creation.require` naming "traits" (all of them) or the list's id. */
export function traitRequired(required: ReadonlySet<string>, listId: string): boolean {
  return required.has('traits') || required.has(listId);
}

/** The words for a saved trait value (the entry's name); null when the setting has no such entry (shown as saved). */
export function traitLookup(lists: readonly TraitList[]): TraitLookup {
  return (field, value) => {
    const list = lists.find((l) => l.id === field.from);
    const one = list?.entries.find((e) => e.id === value)?.name;
    if (one || !list || list.rolls <= 1 || !value.includes(TRAIT_PICKS_JOIN)) return one ?? null;
    // N picks (pf-16): each by its name, "Eel catcher, Reed cutter".
    return value
      .split(TRAIT_PICKS_JOIN)
      .map((part) => list.entries.find((e) => e.id === part)?.name ?? part)
      .join(', ');
  };
}

/** A picked entry's power (G-213), with where it comes from: the list and the entry. */
export interface PickedTraitAbility extends TraitAbility {
  list: TraitList;
  entry: TraitEntry;
}

/**
 * The powers of the trait-list entries the character picked or rolled (G-213; retest 4 T9), in the steps' order: each
 * step's field holds the entry's id or name. A power with uses whose name a class or race power with uses already has
 * stays with the class or race (`taken`, their names), so it never shows twice.
 */
export function pickedTraitAbilities(steps: readonly TraitStep[], values: Readonly<Record<string, unknown>>, taken: ReadonlySet<string> = new Set()): PickedTraitAbility[] {
  return steps.flatMap((step) => {
    // Every pick's powers (pf-16), each entry once.
    const ids = [...new Set(traitPicksOf(step, values[step.field.key]).flatMap((p) => ('entryId' in p ? [p.entryId] : [])))];
    return ids.flatMap((id) => {
      const entry = step.list.entries.find((e) => e.id === id);
      if (!entry) return [];
      return (entry.abilities ?? []).filter((a) => !(a.uses && taken.has(a.name))).map((a) => ({ ...a, list: step.list, entry }));
    });
  });
}
