// The creation step shell's logic (M5b step 0c, slice 2; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-2,
// cr-9, cr-10, cr-11; docs/05 "Guided creation, rebuilt"; mockups creation/00–03). Pure: what Next says when a step
// isn't ready, the fit lines under race and class rows, the modifier words under a score tile, and the ability
// adjustment trade (which taps the rule allows, the bank, the undo). The screens and the tests read these the same way.
import { inRange } from '../library/fills.ts';
import { raceClassLimit } from '../library/classLimits.ts';
import { classLevelCap, raceAsPlayed, replacesKindredTraits, type CreationEntry, type CreationMethod } from './creation.ts';
import { abilitiesByKind, languageNamer, type AdjustmentRule, type ScoresRule } from './creationRules.ts';
import { columnKinds, modifierCells, signedNumber } from './modifierColumns.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const keysOf = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : isRecord(value) ? Object.keys(value) : []);

export type Label = (key: string) => string;

/** The note on a pick whose requirement isn't met (ruled 2026-11-02, replacing cr-7's request): picked all the same, flagged for the GM at approval. */
export const SPECIAL_NOTE = "Needs the GM's special approval";

/** A pick flagged for the GM's approval: the step, the entry and the requirement it misses. Kept on the creation record as `specialApprovals`. */
export interface SpecialApproval {
  /** `alignment`: an alignment outside the class's soft limit (cs-3), flagged on Who they are; `languages`: a language learnt with the GM's leave (cs-6); `gear`: a kit of another class's, for a class with none of its own (after-test A4); `weaponSkills`: a weapon not the class's, picked with the pack's penalty (R3-5). */
  // `patron`: a patron marked `approval: "gm"` (December 1a), flagged on Who they are with the pack's note as its reason.
  step: 'race' | 'class' | 'alignment' | 'languages' | 'gear' | 'weaponSkills' | 'patron';
  entryId: string;
  name: string;
  requirement: string;
}

/** A creation record with one step's special approvals replaced by these (none: that step's are cleared). */
export function withStepApprovals(record: Record<string, unknown>, step: SpecialApproval['step'], approvals: readonly SpecialApproval[]): Record<string, unknown> {
  const was = Array.isArray(record.specialApprovals) ? (record.specialApprovals as SpecialApproval[]) : [];
  const next = [...was.filter((s) => s.step !== step), ...approvals.filter((s) => s.step === step)];
  const rest = { ...record };
  delete rest.specialApprovals;
  return next.length > 0 ? { ...rest, specialApprovals: next } : rest;
}

/** The flag for a pick, when its fit says the requirement isn't met; null when it fits. */
export function specialApprovalOf(step: 'race' | 'class', entry: CreationEntry, fit: Fit): SpecialApproval | null {
  return fit.problem ? { step, entryId: entry.packEntryId, name: entry.name, requirement: fit.problem } : null;
}

// Scores ------------------------------------------------------------------------------------------------------------

/** A modifier table column's words: "ac" → "AC", "extraLanguages" → "extra languages", "hp" → "hp". */
export function columnWords(column: string): string {
  if (column.toLowerCase() === 'ac') return 'AC';
  return column.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * The modifier and what it affects, from the score's row in the top rules set's table (cr-9, ct-4): "+1 melee, open
 * doors 2-in-6, loyalty 7"; modifiers signed before their column's name (a zero one left out), a value column's
 * figure and words after it (the column names the thing; a bare "2-in-6" is the pack's to fix by naming its column).
 * '' without a table or a row, or when the row changes nothing.
 */
export function modifierWords(rulesSets: readonly Record<string, unknown>[], key: string, score: number | null): string {
  if (score === null) return '';
  for (const rules of [...rulesSets].reverse()) {
    const rows = isRecord(rules.abilityModifiers) ? rules.abilityModifiers[key] : undefined;
    if (!Array.isArray(rows)) continue;
    const row = rows.find((r) => isRecord(r) && inRange(r.range, score));
    if (!isRecord(row)) return '';
    // The column's name is the thing it affects (ct-4): "+1 melee", "open doors 2-in-6"; a value column label first
    // with no sign ("loyalty 7"); a zero modifier left out (gate walk 2026-11-05, bug 3).
    return modifierCells(row, columnKinds(rulesSets))
      .map((cell) => (cell.kind === 'modifier' ? `${signedNumber(cell.value as number)} ${columnWords(cell.column)}` : `${columnWords(cell.column)} ${cell.value}`))
      .join(', ');
  }
  return '';
}

/**
 * A score's "Modifiers" on its sheet (sv-2a; plan dec-player-figure-sheet piece 2, mockup 14 frame P7b): each thing
 * the score's row changes, once, in the table's order, with what it gives: "Melee: +1.", a value column's figure
 * ("Loyalty: 7."), a text cell as the pack writes it, and an effect that gives nothing still listed ("Open doors: no
 * change.") so a middling score doesn't look as if it does nothing. The row is the one the top rules set's table gives
 * this score (as `modifierWords` finds it), else `row` (the character's filled row). No new arithmetic.
 */
export function modifierEffects(rulesSets: readonly Record<string, unknown>[], key: string, score: number | null, row: unknown = undefined): string[] {
  let at: unknown = row;
  if (score !== null) {
    for (const rules of [...rulesSets].reverse()) {
      const rows = isRecord(rules.abilityModifiers) ? rules.abilityModifiers[key] : undefined;
      if (!Array.isArray(rows)) continue;
      // The top table decides, as `modifierWords`: a score outside its ranges changes nothing that can be said.
      at = rows.find((r) => isRecord(r) && inRange(r.range, score));
      break;
    }
  }
  // Only a row names what it changes: a bare number ("+1") has no "what", so it gives no line.
  if (!isRecord(at)) return [];
  const kinds = columnKinds(rulesSets);
  const seen = new Set<string>();
  return Object.entries(at).flatMap(([column, value]): string[] => {
    if (column === 'range') return [];
    const words = columnWords(column);
    const name = words.charAt(0).toUpperCase() + words.slice(1);
    if (seen.has(name)) return [];
    let gives: string;
    if (typeof value === 'number') gives = (kinds[column] ?? 'modifier') === 'value' ? String(value) : value === 0 ? 'no change' : signedNumber(value);
    else if (typeof value === 'string' && value.trim() !== '') gives = value.trim();
    else return [];
    seen.add(name);
    return [`${name}: ${gives}${/[.!?]$/.test(gives) ? '' : '.'}`];
  });
}

/**
 * What Next says on the Scores step (cr-2, cr-9): the first score missing ("CHA is missing"), or outside the setting's
 * range ("STR must be 3–18"); null when every score is in. `range` gives the range when the pack has no `scores`
 * block (from its modifier table), null when nothing says.
 */
export function scoresProblem(
  keys: readonly string[],
  values: Record<string, number | null | undefined>,
  rule: ScoresRule | null,
  label: Label,
  range: (key: string) => { min: number; max: number | null } | null = () => null,
): string | null {
  for (const key of keys) {
    const n = values[key];
    if (n === null || n === undefined) return `${label(key)} is missing`;
    const span = rule ? { min: rule.min, max: rule.max } : range(key);
    if (!span) continue;
    if (n < span.min || (span.max !== null && n > span.max)) return span.max === null ? `${label(key)} must be ${span.min} or more` : `${label(key)} must be ${span.min}–${span.max}`;
  }
  return null;
}

// Fit lines ---------------------------------------------------------------------------------------------------------

/** A fit line: its words, the unmet number set apart (bold), and the problem Next names when it's unmet. */
export interface Fit {
  parts: { text: string; strong?: boolean; warn?: boolean }[];
  /** "Stone kin needs DEX 9 · you have 8"; null when the entry fits. */
  problem: string | null;
  /** A hard limit (cs-3): why it can't be picked at all ("Reed Witch isn't open to stone kin"); absent when it can. */
  blocked?: string | null;
}

// Parts of a fit line, joined by commas (no middle dot in creation, final drafts A9).
// A warning sits on its own line, so no comma runs up to it ("Not with Point buy, 1d8 hp," was the slip; #631).
const joinParts = (lists: Fit['parts'][]): Fit['parts'] => lists.flatMap((parts, i) => (i === 0 || parts[0]?.warn ? parts : [{ text: ', ' }, ...parts]));

/** The requirement part of a fit line: "Needs CON 9 · you have 11 ✓", the number bold when unmet; "No requirement". */
export function requirementFit(entry: CreationEntry, scores: Record<string, number>, label: Label): Fit {
  const requirements = isRecord(entry.data.requirements) ? Object.entries(entry.data.requirements).filter((e): e is [string, number] => typeof e[1] === 'number') : [];
  if (requirements.length === 0) return { parts: [{ text: 'No requirement' }], problem: null };
  const lists: Fit['parts'][] = [];
  let problem: string | null = null;
  for (const [key, minimum] of requirements) {
    const have = scores[key];
    const met = have !== undefined && have >= minimum;
    const yours = have === undefined ? 'not entered' : String(have);
    lists.push(met ? [{ text: `Needs ${label(key)} ${minimum}, you have ${have} ✓` }] : [{ text: `Needs ${label(key)} ${minimum}, you have ` }, { text: yours, strong: true }]);
    if (!met && !problem) problem = `${entry.name} needs ${label(key)} ${minimum}, you have ${yours}`;
  }
  if (problem) lists.push([{ text: SPECIAL_NOTE, warn: true }]);
  return { parts: joinParts(lists), problem };
}

/** The newest-wins value of a rules-set key (the last rules set that has it). */
const fromRules = (rulesSets: readonly Record<string, unknown>[], key: string): unknown => [...rulesSets].reverse().map((r) => r[key]).find((v) => v !== undefined);

/**
 * The prime requisite XP modifier a class gives for these scores (+5, −10, 0), read from the class's `primeXp` in the
 * packs' shape (rc-1, docs/07 classes): `{ type: "standard" }` reads the rules set's `primeRequisiteXp` rows
 * `[{ range, xp }]` by the prime's score (with several primes, the lowest when the rules set says
 * `primeRequisiteRule: "lowest"`, else the highest); `{ type: "rules", rules: [{ all | any: { ABILITY: min }, bonus }] }`
 * gives the biggest bonus whose thresholds are met, else 0. Null when nothing says, a prime isn't entered yet, or the
 * score is off the table.
 */
export function primeXpBonus(klass: CreationEntry, rulesSets: readonly Record<string, unknown>[], scores: Record<string, number>): number | null {
  const primes = keysOf(klass.data.primeRequisites);
  const primeXp = klass.data.primeXp;
  if (primes.length === 0 || !isRecord(primeXp)) return null;
  const have = primes.map((p) => scores[p]);
  if (have.some((n) => typeof n !== 'number')) return null;
  if (primeXp.type === 'standard') {
    const table = fromRules(rulesSets, 'primeRequisiteXp');
    const rows = (Array.isArray(table) ? table : []).filter(isRecord);
    const score = fromRules(rulesSets, 'primeRequisiteRule') === 'lowest' ? Math.min(...(have as number[])) : Math.max(...(have as number[]));
    const row = rows.find((r) => typeof r.xp === 'number' && inRange(r.range, score));
    return row ? (row.xp as number) : null;
  }
  if (primeXp.type === 'rules' && Array.isArray(primeXp.rules)) {
    const meets = (thresholds: unknown, every: boolean) => {
      if (!isRecord(thresholds)) return false;
      const checks = Object.entries(thresholds).map(([ability, min]) => typeof min === 'number' && (scores[ability] ?? -Infinity) >= min);
      return checks.length > 0 && (every ? checks.every(Boolean) : checks.some(Boolean));
    };
    const rules = primeXp.rules.filter(isRecord).filter((r) => typeof r.bonus === 'number');
    if (rules.length === 0) return null;
    const met = rules.filter((r) => (r.all !== undefined ? meets(r.all, true) : meets(r.any, false))).map((r) => r.bonus as number);
    return met.length > 0 ? Math.max(...met) : 0;
  }
  return null;
}

/**
 * Why a class isn't open to this race or method (cr-7, cr-10; cs-3): the race's class limits close it (a hard limit:
 * left out of its table, or NPC-only), or the method doesn't offer it; null when it's open. (creation.ts classesFor
 * filters these out; the shell keeps them in a folded "Not open to …" group, never hidden.)
 */
export function whyNotOpen(klass: CreationEntry, method: CreationMethod | null, race: CreationEntry | null): string | null {
  const methods = klass.data.creationMethods;
  if (method && Array.isArray(methods) && methods.length > 0 && !methods.includes(method.id)) return `Not with ${method.name}`;
  if (race && !raceClassLimit(race.data, klass.packEntryId).open) return `Not open to ${race.name.toLowerCase()}`;
  return null;
}

/**
 * What a method leaves out, for its row before it is picked (dec-10 B, cs-6; picture creation/final 17-B2): the classes
 * whose `creationMethods` don't include it, which picked under it need the GM's special approval (corrected
 * 2026-11-12). "The Marsh Chaplain then needs the GM's special approval"; two named; more counted; null for none.
 */
export function methodLeavesOut(method: CreationMethod, classes: readonly CreationEntry[]): string | null {
  // Same-named classes from two packs count once (sn-1).
  const out = [...new Set(classes.filter((k) => whyNotOpen(k, method, null) !== null).map((k) => k.name))];
  if (out.length === 0) return null;
  const who = out.length === 1 ? `The ${out[0]}` : out.length === 2 ? `The ${out[0]} and the ${out[1]}` : `${out.length} classes`;
  return `${who} then ${out.length === 1 ? 'needs' : 'need'} the GM’s special approval`;
}

/**
 * A class row's fit line (cr-10): the prime requisite and the XP bonus it earns, the hit die, the level cap for the
 * chosen race, "casts" for a caster; an unmet requirement first, in bold; "Not open to <race>" when the race's hard
 * limit rules it out (then it can't be picked: `blocked`), and the special-approval note when a soft limit allows it
 * (cs-3) or the method leaves it out (ruled 2026-11-02).
 */
export function classFit(klass: CreationEntry, picked: CreationEntry | null, method: CreationMethod | null, scores: Record<string, number>, rulesSets: readonly Record<string, unknown>[], label: Label): Fit {
  // A kindred-class on its own kindred (cs-4): the kindred's class limits don't apply to it, and the row says it replaces the traits.
  const race = raceAsPlayed(picked, klass);
  const replaces = !!picked && replacesKindredTraits(klass.data, picked.packEntryId);
  const closed = whyNotOpen(klass, method, race);
  const limit = raceClassLimit(race?.data, klass.packEntryId);
  const hard = !!race && !limit.open;
  const soft = !!race && limit.open && limit.soft;
  const raceWord = race ? race.name.toLowerCase() : '';
  const requirement = requirementFit(klass, scores, label);
  const lists: Fit['parts'][] = [];
  if (closed) lists.push([{ text: closed, strong: true }]);
  if (requirement.problem) lists.push(requirement.parts);
  // One wording at every width (dec-10 A; cs-5, cs-33): "Might 15, d8, +5% experience, to level 12 as Stone kin".
  const primes = keysOf(klass.data.primeRequisites);
  const have = primes.map((p) => `${label(p)} ${scores[p] ?? '?'}`);
  if (have.length > 0) lists.push([{ text: have.length > 1 ? `${have.slice(0, -1).join(', ')} and ${have.at(-1)}` : have[0]! }]);
  if (text(klass.data.hitDie)) lists.push([{ text: text(klass.data.hitDie) }]);
  const bonus = primes.length > 0 ? primeXpBonus(klass, rulesSets, scores) : null;
  if (bonus !== null) lists.push([{ text: `${bonus === 0 ? '+0' : signed(bonus)}% experience` }]);
  const cap = classLevelCap(klass, race);
  if (cap !== null) lists.push([{ text: `to level ${cap}${race && limit.maxLevel === cap ? ` as ${race.name}` : ''}` }]);
  if (isRecord(klass.data.spellcasting)) lists.push([{ text: 'casts' }]);
  if (replaces) lists.push([{ text: 'replaces your kindred’s traits' }]);
  if (hard) {
    const blocked = `${klass.name} isn't open to ${raceWord}${limit.closedBy === 'npc-only' ? ' (only the GM’s characters)' : ''}. Pick another class, or go back.`;
    return { parts: joinParts(lists), problem: `${klass.name} isn't open to ${raceWord}`, blocked };
  }
  // A class only the method closes (hard race limits returned above) says the method's reason, as its row does (F49);
  // the review and the GM's card already name the class above it, so the reason stands alone ("Not with Point buy").
  const problem = closed ? closed : soft ? `${klass.name} as ${raceWord} needs the GM's leave` : requirement.problem;
  if ((closed || soft) && !requirement.problem) lists.push([{ text: SPECIAL_NOTE, warn: true }]);
  return { parts: joinParts(lists), problem };
}

/** What Ask the GM to allow it does, in words (final drafts C, ⚑3): the pick is taken and flagged for the GM. */
export const ASK_GM_NOTE = 'Your GM can allow it as a special approval: ask, and it’s picked and marked for them to approve.';

/**
 * A closed class's rule in words, for its entry (final drafts C, ⚑3; mockup creation/final/02): whose rule closes it
 * and where it is, then what asking does. "Stone kin’s list of classes leaves out Marsh Chaplain (Fen rules, p. 40).
 * Your GM can allow it…". '' when no kindred's limit closes the class.
 */
export function closedClassNote(klass: CreationEntry, picked: CreationEntry | null, source = ''): string {
  const race = raceAsPlayed(picked, klass);
  const limit = raceClassLimit(race?.data, klass.packEntryId);
  if (!race || limit.open) return '';
  const rule = limit.closedBy === 'npc-only' ? `${race.name} take ${klass.name} only as the GM’s characters` : `${race.name}’s list of classes leaves out ${klass.name}`;
  return `${rule}${source ? ` (${source})` : ''}. ${ASK_GM_NOTE}`;
}

/**
 * What Next says on a pick step (cr-2): nothing picked; null when it's ready. A pick whose requirement isn't met is
 * ready too (ruled 2026-11-02): it carries the special-approval note and is flagged for the GM.
 */
export function pickProblem(what: string, picked: { fit: Fit } | null, later: boolean): string | null {
  // cs-27, cs-50: one sentence ("Pick a class first.").
  if (!picked) return later ? `Pick a ${what}, or Decide later` : `Pick a ${what} first.`;
  // A hard limit (cs-3) is never ready: Next says why.
  return picked.fit.blocked ?? null;
}

// The entry's full rules (six headings; cr-10, cr-24) -----------------------------------------------------------------

/** One heading of an entry (ct-2): its words, bullet lines "name — effect", or chips that open another entry. */
export interface EntryHeading {
  label: string;
  text?: string;
  bullets?: { name: string; effect: string }[];
  chips?: { id: string; name: string }[];
}

/** The abilities of one kind as bullet lines (ct-2): the pack's name, then what it does (its note, else its blurb). */
const bulletsOf = (list: { name: string; note: string; blurb: string }[]) => list.map((a) => ({ name: a.name, effect: a.note || a.blurb }));

/**
 * The headings of a race's entry (ct-2): requirement · score changes · advantages · disadvantages · languages · open
 * classes; the abilities as bullet lines by `kind`, the open classes as chips that open the class. `offered` leaves
 * out of Open classes a class the campaign doesn't offer (its optional rule is off; ct-10).
 */
export function raceHeadings(
  race: CreationEntry,
  scores: Record<string, number>,
  label: Label,
  classNameOf: (id: string) => string | undefined,
  offered: (id: string) => boolean = () => true,
  rulesSets: readonly Record<string, unknown>[] = [],
): EntryHeading[] {
  const languageName = languageNamer(rulesSets);
  const d = race.data;
  const out: EntryHeading[] = [];
  const add = (heading: string, value: string) => value && out.push({ label: heading, text: value });
  const fit = requirementFit(race, scores, label);
  add('Requirement', fit.parts.map((p) => p.text).join(''));
  if (isRecord(d.abilityModifiers)) add('Score changes', Object.entries(d.abilityModifiers).map(([k, v]) => `${label(k)} ${signed(Number(v))}`).join(', '));
  const kinds = abilitiesByKind(d);
  if (kinds.advantage.length > 0) out.push({ label: 'Advantages', bullets: bulletsOf(kinds.advantage) });
  const limits = bulletsOf(kinds.disadvantage);
  if (Array.isArray(d.npcOnlyClasses) && d.npcOnlyClasses.length > 0) limits.push({ name: `May not be ${d.npcOnlyClasses.map((id) => classNameOf(String(id)) ?? String(id)).join(', ')}`, effect: '' });
  if (limits.length > 0) out.push({ label: 'Disadvantages', bullets: limits });
  add('Languages', Array.isArray(d.languages) ? d.languages.map((l) => languageName(String(l))).join(', ') : text(d.languages));
  if (isRecord(d.classMaxLevels)) {
    const chips = Object.keys(d.classMaxLevels)
      .filter((id) => offered(id) && raceClassLimit(d, id).open)
      .map((id) => {
        const { maxLevel, soft } = raceClassLimit(d, id);
        const notes = [maxLevel !== null ? `to ${maxLevel}` : '', soft ? 'with the GM’s leave' : ''].filter(Boolean).join(', ');
        return { id, name: `${classNameOf(id) ?? id}${notes ? ` (${notes})` : ''}` };
      });
    if (chips.length > 0) out.push({ label: 'Open classes', chips });
  }
  return out;
}

/**
 * The headings of a class's entry (ct-2): requirement · prime requisite · hit die · armour and weapons · advantages ·
 * disadvantages · spellcasting · languages · level cap by race (the race step's word: `raceWord`, "kindred"). The
 * caps come from each race's `classMaxLevels`; the picked race's first.
 */
export function classHeadings(
  klass: CreationEntry,
  race: CreationEntry | null,
  scores: Record<string, number>,
  rulesSets: readonly Record<string, unknown>[],
  label: Label,
  races: readonly CreationEntry[] = [],
  raceWord = 'race',
): EntryHeading[] {
  const languageName = languageNamer(rulesSets);
  const d = klass.data;
  const out: EntryHeading[] = [];
  const add = (heading: string, value: string) => value && out.push({ label: heading, text: value });
  add('Requirement', requirementFit(klass, scores, label).parts.map((p) => p.text).join(''));
  const primes = keysOf(d.primeRequisites);
  if (primes.length > 0) {
    const bonus = primeXpBonus(klass, rulesSets, scores);
    // Several primes (P10, 2026-11-06): the pack's own line on how they count (`primeRequisiteNote`, e.g. the lowest
    // decides), after the bonus. Without one the app adds nothing of its own.
    const note = primes.length > 1 ? text(fromRules(rulesSets, 'primeRequisiteNote')) : '';
    add('Prime requisite', `${primes.map(label).join(', ')}${bonus === null ? '' : `, ${signed(bonus)}% XP with your scores`}${note ? `. ${note}` : ''}`);
  }
  add('Hit die', text(d.hitDie));
  add('Armour and weapons', [text(d.armour) && `Armour: ${text(d.armour)}`, text(d.weapons) && `Weapons: ${text(d.weapons)}`].filter(Boolean).join('. '));
  const kinds = abilitiesByKind(d);
  if (kinds.advantage.length > 0) out.push({ label: 'Advantages', bullets: bulletsOf(kinds.advantage) });
  if (kinds.disadvantage.length > 0) out.push({ label: 'Disadvantages', bullets: bulletsOf(kinds.disadvantage) });
  if (isRecord(d.spellcasting)) {
    const s = d.spellcasting;
    add('Spellcasting', [text(s.castingType) || text(s.type), typeof s.fromLevel === 'number' ? `from level ${s.fromLevel}` : '', typeof s.maxSpellLevel === 'number' ? `up to spell level ${s.maxSpellLevel}` : ''].filter(Boolean).join(', '));
  }
  add('Languages', Array.isArray(d.languages) ? d.languages.map((l) => languageName(String(l))).join(', ') : text(d.languages));
  const byRace = [...races]
    .sort((a, b) => (a.packEntryId === race?.packEntryId ? -1 : b.packEntryId === race?.packEntryId ? 1 : 0))
    .flatMap((r) => {
      const cap = raceClassLimit(r.data, klass.packEntryId);
      return cap.open && cap.maxLevel !== null ? [`${r.name.toLowerCase()} ${cap.maxLevel}${cap.soft ? ' (with the GM’s leave)' : ''}`] : [];
    });
  if (byRace.length > 0) add(`Level cap by ${raceWord.toLowerCase()}`, byRace.join(', '));
  else {
    const cap = classLevelCap(klass, race);
    if (cap !== null) add('Level cap', `${cap}${race ? ` as ${race.name.toLowerCase()}` : ''}`);
  }
  return out;
}

// The ability adjustment (cr-11) -------------------------------------------------------------------------------------

export interface Trade {
  kind: 'lower' | 'raise';
  key: string;
}

/** The scores after the trades: each lower takes lowerBy off, each raise adds raiseBy. */
export function tradedScores(base: Record<string, number>, trades: readonly Trade[], rule: AdjustmentRule): Record<string, number> {
  const next = { ...base };
  for (const t of trades) next[t.key] = (next[t.key] ?? 0) + (t.kind === 'lower' ? -rule.lowerBy : rule.raiseBy);
  return next;
}

/** What's banked: each lowering buys one raise. */
export const bankOf = (trades: readonly Trade[]) => trades.filter((t) => t.kind === 'lower').length - trades.filter((t) => t.kind === 'raise').length;

export type TapAnswer = { ok: true } | { ok: false; why: string; never?: boolean };

/** The class's prime requisites, as the rule's "raise: prime" reads them. */
export const primesOf = (klass: CreationEntry | null): string[] => (klass ? keysOf(klass.data.primeRequisites) : []);

/** Whether the rule lets this score be lowered now; `never` marks a score this setting (or class) never trades. */
export function canLower(rule: AdjustmentRule, key: string, current: number, klass: CreationEntry | null, label: Label): TapAnswer {
  const primes = primesOf(klass);
  if (rule.lowerable !== 'nonPrime' && !rule.lowerable.includes(key)) return { ok: false, why: `${label(key)} isn't tradeable in this setting.`, never: true };
  if (rule.lowerable === 'nonPrime' && primes.includes(key)) return { ok: false, why: `${label(key)} is a prime: it can only be raised.`, never: true };
  if (klass && rule.classExceptions.some((e) => e.classId === klass.packEntryId && e.cannotLower.includes(key))) return { ok: false, why: `${label(key)} can't be lowered as a ${klass.name}.`, never: true };
  // Said against the score as it stands (P11, 2026-11-06): "Nimbleness is 8: already under 9, so it can't be lowered".
  if (current < rule.floor) return { ok: false, why: `${label(key)} is ${current}: already under ${rule.floor}, so it can't be lowered.` };
  if (current - rule.lowerBy < rule.floor) return { ok: false, why: `${label(key)} is ${current}: lowering it by ${rule.lowerBy} would take it under ${rule.floor}, so it can't be lowered.` };
  return { ok: true };
}

/** Whether the rule lets this score be raised now: a prime, with something banked, under the cap. */
export function canRaise(rule: AdjustmentRule, key: string, current: number, klass: CreationEntry | null, bank: number, label: Label): TapAnswer {
  if (!primesOf(klass).includes(key)) return { ok: false, why: `${label(key)} isn't a prime of ${klass ? `a ${klass.name}` : 'this class'}: only primes are raised.`, never: true };
  if (rule.cap !== null && current + rule.raiseBy > rule.cap) return { ok: false, why: `${label(key)} can't go above ${rule.cap} by trading.` };
  if (bank <= 0) return { ok: false, why: `Nothing banked. Lower a score by ${rule.lowerBy} first, then raise ${label(key)}.` };
  return { ok: true };
}

/**
 * Which scores have a tile on Adjust scores (ct-3, option C): those the rule lets the player lower (for this class),
 * and the class's primes it can raise. The rest stay as rolled: absent from the step, named in one line.
 */
export function tradeableScores(rule: AdjustmentRule, keys: readonly string[], klass: CreationEntry | null, label: Label): { lowerable: string[]; raisable: string[]; kept: string[] } {
  const primes = primesOf(klass);
  const lowerable = keys.filter((k) => {
    const answer = canLower(rule, k, Number.MAX_SAFE_INTEGER, klass, label);
    return answer.ok || !answer.never;
  });
  const raisable = keys.filter((k) => primes.includes(k));
  const kept = keys.filter((k) => !lowerable.includes(k) && !raisable.includes(k));
  return { lowerable, raisable, kept };
}

/** "CON and DEX stay as rolled in these rules" (ct-3); '' when every score trades. */
export function keptLine(kept: readonly string[], label: Label): string {
  if (kept.length === 0) return '';
  const names = kept.map(label);
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `${listed} ${names.length > 1 ? 'stay' : 'stays'} as rolled in these rules`;
}

/**
 * The trades as chips (ct-3): each lowering paired with the raise it paid for, in order ("WIS −2 → STR +1"); a
 * lowering not yet spent stands alone ("WIS −2").
 */
export function tradeChips(trades: readonly Trade[], rule: AdjustmentRule, label: Label): { key: string; text: string }[] {
  const lowers = trades.filter((t) => t.kind === 'lower');
  const raises = trades.filter((t) => t.kind === 'raise');
  return lowers.map((l, n) => {
    const r = raises[n];
    return { key: `${n}:${l.key}:${r?.key ?? ''}`, text: `${label(l.key)} −${rule.lowerBy}${r ? ` → ${label(r.key)} +${rule.raiseBy}` : ''}` };
  });
}

/** The trades without one chip's (ct-3: its ✕): that lowering and the raise it paid for; the others stay as they are. */
export function withoutChip(trades: readonly Trade[], index: number): Trade[] {
  let lowers = -1;
  let raises = -1;
  return trades.filter((t) => {
    if (t.kind === 'lower') return ++lowers !== index;
    return ++raises !== index;
  });
}

/** The bank line (cr-11): "Lowered WIS by 2 → raised STR by 1 · 0 to spend". */
export function bankLine(trades: readonly Trade[], rule: AdjustmentRule, label: Label): string {
  const words = trades.map((t) => (t.kind === 'lower' ? `Lowered ${label(t.key)} by ${rule.lowerBy}` : `raised ${label(t.key)} by ${rule.raiseBy}`));
  const bank = bankOf(trades);
  return `${words.length === 0 ? 'No trades yet' : words.join(' → ')}: ${bank} to spend`;
}

/** What Next says on the Adjust step: unspent points; null when the bank is empty. */
export function adjustProblem(trades: readonly Trade[]): string | null {
  const bank = bankOf(trades);
  return bank > 0 ? `${bank} to spend: raise a prime, or undo the lowering` : null;
}

/** The foot's hint on the Adjust step: "1 trade made", "No trades". */
export function tradesHint(trades: readonly Trade[]): string {
  const n = trades.filter((t) => t.kind === 'raise').length;
  return n === 0 ? 'No trades yet' : `${n} ${n === 1 ? 'trade' : 'trades'} made`;
}

/**
 * Whether the Adjust scores step exists for this character (cr-3, cr-11): the rule as data, a class with a prime the
 * rule can raise, and at least one score it lets you lower above the floor.
 */
export function adjustStepExists(rule: AdjustmentRule | null, klass: CreationEntry | null, keys: readonly string[], scores: Record<string, number>, label: Label): boolean {
  if (!rule || !klass) return false;
  const raisable = primesOf(klass).some((p) => canRaise(rule, p, scores[p] ?? 0, klass, 1, label).ok);
  const lowerable = keys.some((k) => canLower(rule, k, scores[k] ?? 0, klass, label).ok);
  return raisable && lowerable;
}

/** "before → after" and the modifier's change under an adjusted tile: "16 −2" and "+2 → +1 saves". */
export function tileChange(before: number, after: number, wordsBefore: string, wordsAfter: string): { delta: string; words: string } {
  const delta = after === before ? '' : `${before} ${signed(after - before)}`;
  const words = wordsBefore === wordsAfter ? wordsAfter : wordsBefore && wordsAfter ? `${wordsBefore} → ${wordsAfter}` : wordsAfter || wordsBefore;
  return { delta, words };
}

/**
 * Adjust scores' lead (final draft 1, P8, P10): the prime(s) named in bold, then the rule in one breath. "Your prime
 * is Might" (bold), "the Lantern Warden’s main score. Lower another score by 2
 * to raise your prime by 1. Nothing may go under 9." With two primes the experience sentence is the pack's own
 * `primeRequisiteNote`; without one, when the class's experience follows the setting's table and the rules set's
 * `primeRequisiteRule` says which prime counts, the app says so from that rule (Design on #564: a two-prime class always
 * says which prime counts), "With two primes the lower one sets your experience."; else nothing. One prime says no
 * experience sentence (dec-10 A, cs-2: the lead names the prime without "A higher prime earns experience faster.").
 */
export function adjustLead(rule: AdjustmentRule, klass: CreationEntry, rulesSets: readonly Record<string, unknown>[], label: Label): { bold: string; rest: string } {
  const primes = primesOf(klass);
  const names = primes.map(label);
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '');
  const several = primes.length > 1;
  const counted = fromRules(rulesSets, 'primeRequisiteRule');
  const standard = isRecord(klass.data.primeXp) && klass.data.primeXp.type === 'standard';
  const ruleLine = standard && (counted === 'lowest' || counted === 'highest') ? `With two primes the ${counted === 'lowest' ? 'lower' : 'higher'} one sets your experience.` : '';
  const note = several ? text(fromRules(rulesSets, 'primeRequisiteNote')) || ruleLine : '';
  const sentence = (s: string) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);
  const rest = [
    `, the ${klass.name}’s main ${several ? 'scores' : 'score'}.`,
    sentence(note),
    `Lower another score by ${rule.lowerBy} to raise ${several ? 'a prime' : 'your prime'} by ${rule.raiseBy}.`,
    `Nothing may go under ${rule.floor}.`,
  ];
  return { bold: `Your ${several ? 'primes are' : 'prime is'} ${listed}`, rest: rest.filter(Boolean).join(' ').replace(' ,', ',') };
}

/**
 * A score's modifier now and its nearest threshold in the direction its control allows (final draft 1, P9; Design on
 * #544, 2026-11-07: one rule, taken from the controls), from the setting's modifier table: "+1 now, +2 at 16" (`up`, a
 * prime's +), "+0 now, −1 at 8" (`down`, another score's −), "+0 now" (`none`, a tile with no control). The table's
 * first modifier column is the one counted. '' when the setting has no table for the score, no modifier column, or no
 * row for this number: the line is left out rather than guessed.
 */
export function thresholdLine(rulesSets: readonly Record<string, unknown>[], key: string, score: number, direction: 'up' | 'down' | 'none'): string {
  for (const rules of [...rulesSets].reverse()) {
    const rows = isRecord(rules.abilityModifiers) ? rules.abilityModifiers[key] : undefined;
    if (!Array.isArray(rows)) continue;
    const kinds = columnKinds(rulesSets);
    const records = rows.filter(isRecord);
    const column = records.flatMap((r) => Object.entries(r).filter(([c, v]) => c !== 'range' && typeof v === 'number' && (kinds[c] ?? 'modifier') === 'modifier').map(([c]) => c))[0];
    if (!column) return '';
    const at = (n: number): number | null => {
      const row = records.find((r) => inRange(r.range, n));
      if (!row) return null;
      return typeof row[column] === 'number' ? (row[column] as number) : 0;
    };
    const now = at(score);
    if (now === null) return '';
    const parts = [`${signedNumber(now)} now`];
    if (direction === 'down') {
      for (let n = score - 1; n >= Math.max(0, score - 30); n--) {
        const v = at(n);
        if (v === null) break;
        if (v !== now) {
          parts.push(`${signedNumber(v)} at ${n}`);
          break;
        }
      }
    }
    if (direction === 'up') {
      for (let n = score + 1; n <= score + 30; n++) {
        const v = at(n);
        if (v === null) break;
        if (v !== now) {
          parts.push(`${signedNumber(v)} at ${n}`);
          break;
        }
      }
    }
    return parts.join(', ');
  }
  return '';
}

/** One band of the prime-requisite experience table (R3-7): its score range, its experience, and whether it's the character's. */
export interface PrimeXpBand {
  range: string;
  xp: string;
  you: boolean;
}

/**
 * The rules set's prime-requisite experience table as rows (R3-7, mockup creation/final/11): each `primeRequisiteXp`
 * row's range ("13–15") and experience ("+5 %"), in the pack's order. With a class whose experience follows the table
 * (`primeXp.type` "standard") and its primes entered, the band the character's prime falls in is marked: with two
 * primes, the one the rules set's rule reads (`primeRequisiteRule`: "lowest" the lower prime). Null without the data.
 */
export function primeXpBands(rulesSets: readonly Record<string, unknown>[], klass: CreationEntry | null, scores: Record<string, number>): PrimeXpBand[] | null {
  const table = fromRules(rulesSets, 'primeRequisiteXp');
  const rows = (Array.isArray(table) ? table : []).filter(isRecord).filter((r) => typeof r.xp === 'number' && (typeof r.range === 'string' || typeof r.range === 'number'));
  if (rows.length === 0) return null;
  const primes = klass ? keysOf(klass.data.primeRequisites) : [];
  const have = primes.map((p) => scores[p]);
  const standard = !!klass && isRecord(klass.data.primeXp) && klass.data.primeXp.type === 'standard';
  const score = standard && have.length > 0 && have.every((n) => typeof n === 'number') ? (fromRules(rulesSets, 'primeRequisiteRule') === 'lowest' ? Math.min(...(have as number[])) : Math.max(...(have as number[]))) : null;
  const at = score === null ? -1 : rows.findIndex((r) => inRange(r.range, score));
  return rows.map((r, n) => ({ range: String(r.range).trim().replace(/-/g, '–'), xp: `${signedNumber(r.xp as number)} %`, you: n === at }));
}

/**
 * A prime's tile line (follow-up to final draft 1, Design / Francis 2026-11-07): the experience, not the modifier. The
 * experience its score gives now and the next step up, from the class's `primeXp` (the setting's prime-XP thresholds,
 * or the class's own rules): "+5% experience now, +10% at 15"; under the first step "+0% experience now, +5% at 12";
 * at the top "+10% experience now". Each prime is read on its own, the other scores as they stand. '' when the class's
 * experience doesn't say (no `primeXp`, a prime not entered, a score off the table): the tile keeps its modifier line.
 */
export function primeXpLine(klass: CreationEntry, key: string, rulesSets: readonly Record<string, unknown>[], scores: Record<string, number>): string {
  const score = scores[key];
  if (!primesOf(klass).includes(key) || typeof score !== 'number') return '';
  const now = primeXpBonus(klass, rulesSets, scores);
  if (now === null) return '';
  const parts = [`${signedNumber(now)}% experience now`];
  for (let n = score + 1; n <= score + 30; n++) {
    const then = primeXpBonus(klass, rulesSets, { ...scores, [key]: n });
    if (then === null) break;
    if (then !== now) {
      parts.push(`${signedNumber(then)}% at ${n}`);
      break;
    }
  }
  return parts.join(', ');
}

/**
 * The words under an Adjust tile (final draft 1): its line (a prime's experience, another score's thresholds); at the
 * floor, the reason after it ("+0 now, −1 at 8. At the floor: can't go lower"); under it, only the reason, marked with
 * the sign (`warn`). Two primes add nothing of their own (creation follow-up, 2026-11-07): both are tagged Prime and
 * the rules set's `primeRequisiteNote` explains in the lead, as each two-prime class sets its own thresholds.
 */
export function adjustTileWords(line: string, floor: 'at' | 'under' | null, floorValue: number): { text: string; warn: boolean } {
  if (floor === 'under') return { text: `Already under ${floorValue}: can't be lowered`, warn: true };
  if (floor === 'at') return { text: [line, "At the floor: can't go lower"].filter(Boolean).join('. '), warn: false };
  return { text: line, warn: false };
}

/**
 * The toast after a lowering alone (Design on #544, 2026-11-07: Undo over confirm, so the lowering is reversible at
 * once): "Charm 11 → 9: now raise Might by 1"; with several primes "… raise Might or Wit by 1". The raise's toast
 * replaces it.
 */
export function loweredToast(lowered: string, after: Record<string, number>, primes: readonly string[], rule: AdjustmentRule, label: Label): string {
  const names = primes.map(label);
  const which = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : (names[0] ?? 'your prime');
  return `${label(lowered)} ${(after[lowered] ?? 0) + rule.lowerBy} → ${after[lowered] ?? 0}: now raise ${which} by ${rule.raiseBy}`;
}

/** The toast after a trade (final draft 1): "Charm 11 → 9, Might 13 → 14". */
export function tradeToast(lowered: string, raised: string, after: Record<string, number>, rule: AdjustmentRule, label: Label): string {
  const fromTo = (key: string, by: number) => `${label(key)} ${(after[key] ?? 0) - by} → ${after[key] ?? 0}`;
  return `${fromTo(lowered, -rule.lowerBy)}, ${fromTo(raised, rule.raiseBy)}`;
}

// The app's own Help me choose text (cw-4): one plain paragraph, no labels; about the choice, never the rules ------------------------------------------

export const APP_HELP: Record<string, string> = {
  method: "Your setting can build a character in more than one way. In some, you choose your people (your kindred, or race) and then your class, the adventuring trade you follow. In others, one choice covers both. This step only sets how many choices come next. If you're unsure, take the first one, or ask your GM which the group is using.",
  scores: "Ability scores are the numbers that say what your character is naturally good or bad at: strength, quickness, wits and so on. You roll them at the table, as your setting says, and type in what you rolled. They decide which choices are open to you later, and they give small bonuses or penalties that follow you everywhere; each tile shows what its number changes. If you're unsure, keep them as rolled, or ask your GM.",
  race: "Your kindred (some settings say race) is the people your character was born to. It decides what your body can do, which languages you start with, and which classes are open to you. Tap a name to read about it before you pick. If you're unsure, read two or three and pick the one you'd most like to play, or ask your GM.",
  class: "Your class is your character's trade as an adventurer: a fighter, a thief, a spell-caster and so on. It decides how you fight, what you can learn, what you may wear and carry, and how fast you gain levels. Tap a name to read about it before you pick. If you're unsure, pick the class your best score suits, or ask your GM.",
  adjust: "Some settings let you trade points between scores before you start: you lower one score to raise another that matters more to your class. A higher score in your class's main ability usually means you gain experience faster. The tiles show what you may lower, what you may raise, and what each change costs. If you're unsure, trade nothing and tap Next, or ask your GM.",
  who: "Here your character gets a name, an outlook and their starting hit points. Hit points are how much harm they can take before they fall. The outlook (your setting may call it alignment) is where your character stands on the world's big questions; it matters to some magic and some places, and only you and your GM see it. If you're unsure, pick a name you'll enjoy saying out loud and the outlook that sounds most like them, or ask your GM.",
  spells: "Your character starts with a few spells already learned. They are the only spells you can cast until you find or learn more, so they shape your first adventures. Tap a spell's name to read what it does. If your setting has you roll for them, roll at the table and tap what you rolled. If you're unsure, pick the ones you can picture using on your first adventure, or ask your GM.",
  languages: "Languages are the tongues your character speaks, and reads if they can read. They decide who you can talk to without a go-between and which old writings you can make out. Some come with your kindred; here you choose any extra ones. If you're unsure, ask your GM which tongue is most spoken where your first adventure is set.",
  weaponSkills: "Weapon skills are the weapons your character has trained with. You fight normally with those; any other weapon is clumsier in your hands. Your class sets how many you may choose. If you're unsure, pick the weapons you expect to carry, one for close fighting and one for range, or ask your GM.",
  details: "These are touches that help the table picture your character: looks, manner, a belief, a keepsake. None of them change the rules. Fill in what you like, roll for the rest, or skip the step; you can add them later from your sheet. If you're unsure, skip it.",
};

/** The step's title and the foot's hint words shared by the shell. */
export const STEP_TITLES = { method: 'How do you want to build?', scores: 'Scores', race: 'Race', class: 'Class', patron: 'Patron', adjust: 'Adjust scores', who: 'Who they are', spells: 'First spells', details: 'Details' } as const;

/** "Simple picked · 8 steps" for the Method step's hint. */
export const methodHint = (picked: { name: string } | null, steps: number) => (picked ? `${picked.name} picked: about ${steps} steps` : 'Pick one first.');
