// "Who they are", the creation step after the class (M5b step 0c, slice 3; design/rulings/m5b-0c-creation-rebuild-
// 2026-11-01.md cr-12, cr-23; mockup creation/04): the hit points rolled at the table (the class's die and the HP
// modifier shown, the pack's minimum applied, the roll typed and checked against the die's range), the alignment as
// option rows with the pack's notes, and the Derived fields (only the layout's `fill` fields, read-only). Pure.
import { alignmentFit, type AlignmentLimit } from '../library/classLimits.ts';
import { showFilled, type Filled } from '../library/fills.ts';
import { layoutKeys } from '../library/optionGate.ts';
import { rowOf, tableOf, type CreationTable } from './kindredTables.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const top = (rulesSets: readonly Record<string, unknown>[], key: string): unknown => {
  for (const rules of [...rulesSets].reverse()) if (rules[key] !== undefined) return rules[key];
  return undefined;
};

/** A dice expression's lowest and highest total and how many dice it rolls: "d8" → 1–8, "3d6+1" → 4–19. Null when it isn't dice. */
export function diceRange(dice: string): { min: number; max: number; count: number } | null {
  const match = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-−])\s*(\d+))?\s*$/i.exec(dice);
  if (!match) return null;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  if (count < 1 || sides < 1) return null;
  const plus = match[4] ? (match[3] === '+' ? 1 : -1) * Number(match[4]) : 0;
  return { min: count + plus, max: count * sides + plus, count };
}

/**
 * The pack's lowest starting hit points: the rules set's `hitPoints.startMinimum` (07: `hitPoints { startMinimum?,
 * minimumPerDie?, reroll? }`, cf-2, ruled 2026-11-02; `minimumPerDie` is level-up's, M7). Null when the pack says none.
 */
export function hpMinimum(rulesSets: readonly Record<string, unknown>[]): number | null {
  const block = top(rulesSets, 'hitPoints');
  if (!isRecord(block)) return null;
  const min = block.startMinimum;
  return typeof min === 'number' && Number.isInteger(min) ? min : null;
}

export interface HpRoll {
  /** The dice the class rolls at this level ("d8", "3d8"). */
  dice: string;
  /** The HP modifier from the scores, its ability's name ("Grit") and the score it comes from (13), when the setting has one. */
  modifier: { value: number; ability: string; score?: number } | null;
  /** The pack's lowest starting hit points, when it gives one. */
  minimum: number | null;
}

/** The roll as typed, as a whole number; null when empty or not a whole number. */
const readRoll = (text: string): number | null => (/^\s*\d+\s*$/.test(text) ? Number(text.trim()) : null);

/**
 * What Next says about the hit points roll, or null when it's fine: missing, not a number, or outside the dice's
 * range ("d8 gives 1–8").
 */
export function hpProblem(text: string, rule: HpRoll): string | null {
  if (!text.trim()) return 'Type the hit points you rolled.';
  const roll = readRoll(text);
  if (roll === null) return 'Type the roll as a whole number.';
  const range = diceRange(rule.dice);
  if (range && (roll < range.min || roll > range.max)) return `${rule.dice} gives ${range.min}–${range.max}: type what the dice showed.`;
  return null;
}

/** The lowest starting hit points: the pack's minimum, else 1 (Francis, 2026-11-07: never below 1). */
const hpFloor = (rule: HpRoll) => rule.minimum ?? 1;

/** The hit points the roll gives: the roll, the modifier once per die, then the floor (the pack's minimum, else 1). Null until the roll is good. */
export function hpFromRoll(text: string, rule: HpRoll): number | null {
  if (hpProblem(text, rule)) return null;
  const roll = readRoll(text)!;
  const count = diceRange(rule.dice)?.count ?? 1;
  const hp = roll + (rule.modifier?.value ?? 0) * count;
  return Math.max(hp, hpFloor(rule));
}

/** The setting's hit-points re-roll (07 `hitPoints.reroll`, cf-1): offered when the die shows `atMost` or less. */
export interface HpReroll {
  atMost: number;
  /** The option that turns it on (its id, from the pack); null when it always applies. */
  option: string | null;
  note: string;
}

/** The rules set's `hitPoints.reroll`, the top one that has a `hitPoints` block; null without one (no callout). */
export function hpReroll(rulesSets: readonly Record<string, unknown>[]): HpReroll | null {
  const block = top(rulesSets, 'hitPoints');
  const raw = isRecord(block) ? block.reroll : undefined;
  if (!isRecord(raw) || typeof raw.atMost !== 'number' || !Number.isInteger(raw.atMost) || raw.atMost < 1) return null;
  const option = typeof raw.option === 'string' && raw.option.trim() ? raw.option.trim() : null;
  return { atMost: raw.atMost, option, note: typeof raw.note === 'string' ? raw.note.trim() : '' };
}

/**
 * Whether Who they are offers Roll again / Keep it (cf-1; never forced): the roll is good, what the dice showed (before
 * the modifier) is at most the rule's `atMost`, and its option, when it names one, is on.
 */
export function rerollOffered(text: string, rule: HpRoll, reroll: HpReroll | null, optionOn: (optionId: string) => boolean = () => true): boolean {
  if (!reroll || !rule.dice || hpProblem(text, rule)) return false;
  if (reroll.option && !optionOn(reroll.option)) return false;
  return readRoll(text)! <= reroll.atMost;
}

/** "Grit 13" (the ability and the score it comes from), or "Grit" without the score. */
const modifierSource = (modifier: NonNullable<HpRoll['modifier']>) => (modifier.score === undefined ? modifier.ability : `${modifier.ability} ${modifier.score}`);

/**
 * The hit points' Roll row (final drafts C, cut by cs-8 in dec-10 D; picture creation/final 19-D3): the roll alone,
 * "Roll 1d4 for hit points and enter it." What the score adds is said once, in the sum under the stepper.
 */
export function hpAskLine(rule: HpRoll): string {
  return `Roll ${rule.dice} for hit points and enter it.`;
}

/** "+1 for Grit 13", with several dice counted for each and said so: "+2 for Grit 13 (1 a die)"; '' with none. */
function modifierWords(rule: HpRoll): string {
  const count = diceRange(rule.dice)?.count ?? 1;
  const value = rule.modifier?.value ?? 0;
  const added = value * count;
  if (!rule.modifier || added === 0) return '';
  return `${added > 0 ? '+' : '−'}${Math.abs(added)} for ${modifierSource(rule.modifier)}${count > 1 ? ` (${Math.abs(value)} a die)` : ''}`;
}

const hpWords = (hp: number) => `${hp} ${hp === 1 ? 'hit point' : 'hit points'}`;

/**
 * The sum under the roll (final drafts C; Francis, 2026-11-07): "3 rolled, +1 for Grit 13: 4 hit points"; with
 * several dice the modifier counted for each; at the floor ", never below 1". '' until the roll is good.
 */
export function hpWorkedLine(text: string, rule: HpRoll): string {
  const hp = hpFromRoll(text, rule);
  if (hp === null) return '';
  const roll = readRoll(text)!;
  const added = (rule.modifier?.value ?? 0) * (diceRange(rule.dice)?.count ?? 1);
  const mod = modifierWords(rule);
  const floored = roll + added < hpFloor(rule) ? `, never below ${hpFloor(rule)}` : '';
  return `${roll} rolled${mod ? `, ${mod}` : ''}: ${hpWords(hp)}${floored}`;
}

/**
 * The sum after the average stepper's line while it's untouched (final drafts A5, C; D3): "Average. +1 for Grit 13: 3
 * hit points"; '' without a modifier (the average is the hit points then).
 */
export function hpAverageLine(average: number, rule: HpRoll): string {
  const mod = modifierWords(rule);
  const hp = hpFromRoll(String(average), rule);
  return mod && hp !== null ? `${mod}: ${hpWords(hp)}` : '';
}

/** One alignment row: the choice, the pack's one line for its row, and its full note for its entry. */
export interface AlignmentRow {
  name: string;
  /** `alignmentBlurbs`' one line, shown on the row; '' when the pack has none (the row shows the name alone). */
  blurb: string;
  /** `alignmentNotes`' text, shown in the alignment's entry (ct3-11), never on the row. */
  note: string;
}

/**
 * The alignment as option rows (cr-12): the campaign field's choices, else the setting's `alignments`, each with the
 * pack's `alignmentBlurbs` line for the row and its `alignmentNotes` text for the entry (Design, 2026-11-05: the whole
 * paragraph on the row was heavy on a phone). Empty when the setting has none (the group doesn't appear).
 */
export function alignmentRows(choices: readonly string[], rulesSets: readonly Record<string, unknown>[]): AlignmentRow[] {
  const listed = top(rulesSets, 'alignments');
  const names = choices.length > 0 ? choices : Array.isArray(listed) ? listed.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
  const notes = top(rulesSets, 'alignmentNotes');
  const blurbs = top(rulesSets, 'alignmentBlurbs');
  const line = (from: unknown, name: string) => (isRecord(from) && typeof from[name] === 'string' ? String(from[name]).trim() : '');
  return names.map((name) => ({ name, blurb: line(blurbs, name), note: line(notes, name) }));
}

/**
 * The names of the alignment rows Who they are offers: the campaign's alignment field (shown), with the setting's list
 * when it has no choices of its own; none without the field. The Patron step and the patron checks cross patrons with
 * the class's limit against them (fix-patron-class-alignment).
 */
export function alignmentNamesOf(fieldDefs: readonly { key: string; hidden?: boolean; choices: readonly string[] }[], rulesSets: readonly Record<string, unknown>[]): string[] {
  const field = fieldDefs.find((def) => def.key.toLowerCase() === 'alignment' && !def.hidden);
  return field ? alignmentRows(field.choices, rulesSets).map((row) => row.name) : [];
}

/** An alignment row as offered to this class: `special` when picking it needs the GM's special approval (a soft limit). */
export interface OfferedAlignment extends AlignmentRow {
  special: boolean;
  /** A hard limit leaves it closed (cw-8): shown as a not-allowed row, never hidden, with no Pick. */
  closed?: boolean;
}

const aOrAn = (word: string) => `${/^[aeiou]/i.test(word) ? 'An' : 'A'} ${word}`;
const orList = (words: readonly string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : (words[0] ?? ''));

/**
 * The alignments Who they are offers a class (cs-3, rc-5): a hard limit keeps the others as not-allowed rows (cw-8) and says so in a line;
 * a soft one keeps every row, those outside it marked for the GM's special approval. Every row when the class sets
 * none, or when its names match none of the rows (a pack mismatch: nothing is hidden).
 */
export function alignmentOffer(rows: readonly AlignmentRow[], limit: AlignmentLimit | null, className: string): { rows: OfferedAlignment[]; line: string } {
  const fits = rows.map((row) => ({ ...row, fit: alignmentFit(limit, row.name) }));
  if (!limit || !fits.some((r) => r.fit === 'ok')) return { rows: rows.map((r) => ({ ...r, special: false })), line: '' };
  const allowed = orList(fits.filter((r) => r.fit === 'ok').map((r) => r.name));
  if (!limit.soft) return { rows: fits.map(({ fit, ...r }) => ({ ...r, special: false, ...(fit === 'closed' ? { closed: true } : {}) })), line: `${aOrAn(className)} may only be ${allowed}.` };
  return { rows: fits.map(({ fit, ...r }) => ({ ...r, special: fit === 'soft' })), line: `${aOrAn(className)} is usually ${allowed}; another needs the GM's special approval.` };
}

/** Why a closed alignment row can't be picked (cw-8): "A reed witch can't be Marsh." */
export function alignmentClosedReason(className: string, alignment: string): string {
  return `${aOrAn(className)} can't be ${alignment.trim()}.`;
}

/** What a soft alignment pick misses, for the GM's special approval: "A reed witch is usually Reed or Mire". */
export function alignmentRequirement(limit: AlignmentLimit, className: string): string {
  return `${aOrAn(className)} is usually ${orList(limit.names)}`;
}

/** Why a picked alignment can't stay (a hard limit, e.g. after the class changed); null when it can. */
export function alignmentProblem(limit: AlignmentLimit | null, alignment: string, className: string, word: string): string | null {
  return alignmentFit(limit, alignment) === 'closed' ? `${aOrAn(className)} can't be ${alignment.trim()}. Pick another ${word}.` : null;
}

/** The alignment group's line: the pack's general note, else none. */
export function alignmentLine(rulesSets: readonly Record<string, unknown>[]): string {
  const notes = top(rulesSets, 'alignmentNotes');
  return isRecord(notes) && typeof notes.general === 'string' ? notes.general : '';
}

/**
 * One read-only line under Derived fields: the field's label, its worked-out value ('' when the rules give none yet:
 * not shown, ct-5), and its parts when the setting gives them (AC: "unarmoured, DEX +0").
 */
export interface DerivedRow {
  key: string;
  label: string;
  value: string;
  note?: string;
}

/**
 * A filled value by its fill name, reaching into a row: "abilityModifiers.WIT.literacy" is the `literacy` of the
 * filled row "abilityModifiers.WIT". Undefined when the setting fills nothing by that name.
 */
export function filledAt(filled: Filled, name: string): Filled[string] | undefined {
  if (filled[name] !== undefined) return filled[name];
  const parts = name.split('.');
  for (let cut = parts.length - 1; cut > 0; cut--) {
    let at: unknown = filled[parts.slice(0, cut).join('.')];
    if (at === undefined) continue;
    for (const part of parts.slice(cut)) at = isRecord(at) ? at[part] : undefined;
    return at as Filled[string] | undefined;
  }
  return undefined;
}

/**
 * The Derived fields (cr-12, cr-23, ct-5): every visible layout field with a `fill`, its value live from the setting's
 * fills ('' when none yet; the screens show only those with a value), `notes` by fill name (AC's parts).
 */
export function derivedRows(fields: readonly { key: string; label: string; fill: string | null; hidden: boolean }[], filled: Filled, notes: Record<string, string> = {}): DerivedRow[] {
  return fields
    .filter((f) => !f.hidden && typeof f.fill === 'string' && f.fill.trim() !== '')
    .map((f) => {
      const value = filledAt(filled, f.fill!);
      const shown = value === undefined ? '' : showFilled(value).trim();
      const note = shown ? notes[f.fill!.trim()] : undefined;
      return { key: f.key, label: f.label, value: shown, ...(note ? { note } : {}) };
    });
}

/** "Name", "Name and hp", "Name, hp and alignment". */
const listed = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? ''));

/**
 * The foot's hint and Next's check (cr-2): what's missing ("Name and hp missing"), a roll out of range in full, else
 * what's set ("Name, hp and alignment set"). `hp` is null when the setting doesn't ask for hit points here; the
 * alignment counts as missing only when the campaign's field is required. Next says the first problem in full.
 */
export function whoHint(input: {
  name: string;
  hp: { typed: boolean; problem: string | null } | null;
  /** `problem`: the picked alignment isn't open to the class (a hard limit, cs-3; alignmentProblem). */
  alignment: { set: boolean; required: boolean; label: string; problem?: string | null } | null;
}): { problem: string | null; hint: string } {
  const noName = !input.name.trim();
  const hpWrong = input.hp?.problem ?? null;
  const noHp = !!hpWrong && !input.hp!.typed;
  const noAlignment = !!input.alignment && input.alignment.required && !input.alignment.set;
  const word = (input.alignment?.label ?? 'alignment').toLowerCase();
  // A roll typed but out of range is said in full: it isn't missing, it's wrong. So is an alignment the class can't take.
  if (hpWrong && !noHp) return { problem: hpWrong, hint: hpWrong };
  if (input.alignment?.problem) return { problem: input.alignment.problem, hint: input.alignment.problem };
  const missing = [noName ? 'Name' : null, noHp ? 'hp' : null, noAlignment ? word : null].filter((m): m is string => !!m);
  if (missing.length > 0) {
    const first = noName ? 'Give your character a name.' : noHp ? hpWrong! : `Pick your ${word}.`;
    const hint = `${listed(missing)} missing`;
    // "hp" stays as the mockup writes it; an alignment word starts the line with a capital.
    return { problem: missing.length > 1 ? `${hint}.` : first, hint: missing[0] === 'hp' ? hint : hint.charAt(0).toUpperCase() + hint.slice(1) };
  }
  const set = ['Name', input.hp ? 'hp' : null, input.alignment?.set ? word : null].filter((s): s is string => !!s);
  return { problem: null, hint: `${listed(set)} set` };
}

/** A field Who they are asks from a table (07: a field `from` a table; the knight's liege, cs-3): the field and its table. */
export interface TableField {
  key: string;
  label: string;
  table: CreationTable;
}

/**
 * The fields fed by a table (a layout field's `from` naming one of the campaign's tables in play, with rows): each
 * opens the table and saves the row tapped. `fields` are the character's (already gated by option and class); a list
 * field fed by a trait list, a number or a Yes/No isn't one.
 */
export function tableFields(fields: readonly { key: string; label: string; type: string; hidden: boolean }[], layoutFrom: ReadonlyMap<string, string>, tables: readonly { packEntryId: string; name: string; data: Record<string, unknown> }[]): TableField[] {
  return fields.flatMap((field) => {
    const from = layoutFrom.get(field.key) ?? '';
    if (field.hidden || !from || (field.type !== 'text' && field.type !== 'longtext')) return [];
    const entry = tables.find((t) => t.packEntryId === from);
    const table = entry ? tableOf(entry) : null;
    return table ? [{ key: field.key, label: field.label, table }] : [];
  });
}

/** The alignment a table field's picked row sets (cs-3, G-89). */
export interface SetAlignment {
  /** The field's label ("Liege"). */
  by: string;
  /** The row's words ("House Harrowmoor (Lawful)"). */
  row: string;
  /** As the row has it ("Lawful"). */
  alignment: string;
}

/** The first table field whose picked row carries an alignment; null when none does. */
export function alignmentSetBy(fields: readonly TableField[], values: Readonly<Record<string, unknown>>): SetAlignment | null {
  for (const field of fields) {
    const value = values[field.key];
    const at = typeof value === 'string' ? rowOf(field.table, value.trim()) : -1;
    const row = at >= 0 ? field.table.rows[at] : undefined;
    if (row?.alignment) return { by: field.label, row: row.text, alignment: row.alignment };
  }
  return null;
}

/** The alignment row a table row names (any case); undefined when none matches (a pack mismatch). */
export function alignmentNamed<T extends { name: string }>(rows: readonly T[], alignment: string): T | undefined {
  return rows.find((r) => r.name.trim().toLowerCase() === alignment.trim().toLowerCase());
}

/**
 * The alignment rows while a picked row sets it (cs-3: "picking a house sets the knight's alignment, with a line saying
 * why"): only that one, and the line ("A knight's alignment is their liege's: House Harrowmoor (Lawful)."). Unchanged
 * when nothing sets it or no row matches (nothing is hidden on a mismatch).
 */
export function alignmentOfferSet<T extends { name: string }>(offer: { rows: T[]; line: string }, set: SetAlignment | null, className: string, word: string): { rows: T[]; line: string } {
  if (!set) return offer;
  const row = alignmentNamed(offer.rows, set.alignment);
  if (!row) return offer;
  return { rows: [row], line: `${aOrAn(className)}'s ${word} is their ${set.by.toLowerCase()}'s: ${set.row}.` };
}

/** Next's check while a row sets the alignment: the one picked must be it; null when it is, or nothing sets it. */
export function alignmentSetProblem(set: SetAlignment | null, picked: string, rows: readonly { name: string }[], className: string, word: string): string | null {
  if (!set) return null;
  const row = alignmentNamed(rows, set.alignment);
  if (!row || picked.trim().toLowerCase() === row.name.trim().toLowerCase()) return null;
  return `${aOrAn(className)}'s ${word} is their ${set.by.toLowerCase()}'s: pick ${row.name}, or another ${set.by.toLowerCase()}.`;
}

/**
 * The other field a table field's pick also fills (cw-12: `alsoFills` beside `from` on a sheet layout's field; the
 * knight's liege fills the affiliation), by the table field's key (both forms, optionGate.ts `layoutKeys`).
 */
export function tableAlsoFills(entries: readonly { kind: string; data: Record<string, unknown> }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entries.filter((x) => x.kind === 'fieldTemplate')) {
    for (const f of (Array.isArray(e.data.fields) ? e.data.fields : []).filter(isRecord)) {
      const key = typeof f.key === 'string' ? f.key.trim() : '';
      const also = typeof f.alsoFills === 'string' ? f.alsoFills.trim() : '';
      if (key && also && also !== key) for (const k of layoutKeys(key)) if (!out.has(k)) out.set(k, also);
    }
  }
  return out;
}

/** The campaign's field an `alsoFills` names (either form of its key, any case); undefined when the campaign has none. */
export function alsoFillsField<T extends { key: string; hidden: boolean }>(fields: readonly T[], target: string | undefined): T | undefined {
  if (!target) return undefined;
  const keys = layoutKeys(target).map((k) => k.toLowerCase());
  return fields.find((f) => !f.hidden && keys.includes(f.key.toLowerCase()));
}

/**
 * Whether a table pick may write its `alsoFills` field (Design, 2026-11-06): only while that field is empty or still
 * holds what the previous pick wrote, so a value the player typed is never overwritten.
 */
export function mayAlsoFill(current: string, previousPick: string): boolean {
  return current.trim() === '' || (previousPick.trim() !== '' && current.trim() === previousPick.trim());
}

/**
 * The toast after a table pick (cw-5, cw-12; Design's words, 2026-11-06): what the pick set, then what it changed.
 * "Liege: House Saltreach. Your alignment is now Mire, as theirs is, and your affiliation is House Saltreach."
 */
export function tablePickToast(input: { label: string; picked: string; alignment?: { word: string; name: string } | null; also?: string | null }): string {
  const head = `${input.label}: ${input.picked}.`;
  const also = input.also ? `your ${input.also.toLowerCase()} is ${input.picked}` : '';
  if (input.alignment) return `${head} Your ${input.alignment.word} is now ${input.alignment.name}, as theirs is${also ? `, and ${also}` : ''}.`;
  return also ? `${head} Y${also.slice(1)}.` : head;
}
