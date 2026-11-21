// Patrons (December step 1a; plans/dec-1-creation.md 1a, plans/m5b-patrons.md A–C; rulings pt-1 … pt-8 in
// design/rulings/m5b-patrons-session-2026-11-07.md). A pack's top-level `patrons[]`: the gods a cleric (or another
// class the patron names) follows. Pure: which patrons a character is offered, what the pick does to the alignment,
// the tiers of garb and marks reached, the class's spell list with the patron's swaps, the entry a patron opens, the
// lines the sheet shows, and the flag for a patron the GM must approve. The screens and the tests read these the same
// way; the app keeps no patron, class or option ids of its own.
import { classAlignmentLimit, type AlignmentLimit } from '../library/classLimits.ts';
import type { SpecialApproval } from './creationSteps.ts';
import { alignmentRequirement } from './whoTheyAre.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const wholeNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const orList = (words: readonly string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : (words[0] ?? ''));
const andList = (words: readonly string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? ''));

/** What the app says for something a patron names that no attached pack has (a swap's spell, a follower class). */
export const NOT_ATTACHED = 'pack not attached';

/** A patron entry as the campaign's setting holds it (one per id after stacking), marked when its option is off. */
export interface PatronEntry {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
  packId?: string;
  optionOff?: string;
}

/** One tier of holy garb: worn from creation (`atSpellLevel` 0), then from the first spells of that level. */
export interface GarbTier {
  atSpellLevel: number;
  text: string;
  itemIds: string[];
  /** What the garb would cost, in the pack's words for the entry; it is given free (pt-6, pt-8). */
  costGp: number | null;
}

/** One spell the patron's followers cast in place of one of the class's, as a spell of the class at `level`. */
export interface SpellSwap {
  level: number;
  replaces: string;
  with: string;
}

/** A mark of the patron's favour: a line on the sheet from the first spells of that level (0: from creation). */
export interface PatronMark {
  atSpellLevel: number;
  text: string;
}

export interface Patron {
  id: string;
  name: string;
  title: string;
  blurb: string;
  description: string;
  depiction: string;
  realm: string;
  /** The GM's (hidden from players by the database): '' on a player's device. */
  cult: string;
  source: string;
  /** The god's own alignment: shown, never applied. */
  alignment: string;
  /** The class ids that may follow it. */
  classes: string[];
  /** The alignments its followers may have; none listed: any (plan m5b-patrons ⚑2). */
  alignments: string[];
  holySymbol: string;
  garb: GarbTier[];
  prayer: string;
  strictures: string;
  /** The class whose spell list the swaps change ('' when the pack doesn't say: the follower's own). */
  spellsExtends: string;
  swaps: SpellSwap[];
  spellsNote: string;
  marks: PatronMark[];
  /** Picking it needs the GM's approval (`approval: "gm"`). */
  needsGm: boolean;
  approvalNote: string;
  packId: string;
}

/** A patron entry read into its parts; anything missing or misshapen reads as empty, never an error. */
export function readPatron(entry: PatronEntry): Patron {
  const d = entry.data;
  const followers = isRecord(d.followers) ? d.followers : {};
  const spells = isRecord(d.spells) ? d.spells : {};
  const byTier = <T extends { atSpellLevel: number }>(rows: T[]) => [...rows].sort((a, b) => a.atSpellLevel - b.atSpellLevel);
  return {
    id: entry.packEntryId,
    name: entry.name,
    title: text(d.title),
    blurb: text(d.blurb),
    description: text(d.description),
    depiction: text(d.depiction),
    realm: text(d.realm),
    cult: text(d.cult),
    source: text(d.source),
    alignment: text(d.alignment),
    classes: texts(followers.classes),
    alignments: texts(followers.alignments),
    holySymbol: text(d.holySymbol),
    garb: byTier(
      (Array.isArray(d.holyGarb) ? d.holyGarb.filter(isRecord) : []).flatMap((tier) => {
        const at = wholeNumber(tier.atSpellLevel);
        return at === null ? [] : [{ atSpellLevel: at, text: text(tier.text), itemIds: texts(tier.itemIds), costGp: wholeNumber(tier.costGp) }];
      }),
    ),
    prayer: text(d.prayer),
    strictures: text(d.strictures),
    spellsExtends: text(spells.extends),
    swaps: (Array.isArray(spells.swap) ? spells.swap.filter(isRecord) : []).flatMap((swap) => {
      const level = wholeNumber(swap.level);
      const withId = text(swap.with);
      return level === null || !withId ? [] : [{ level, replaces: text(swap.replaces), with: withId }];
    }),
    spellsNote: text(spells.note),
    marks: byTier(
      (Array.isArray(d.marks) ? d.marks.filter(isRecord) : []).flatMap((mark) => {
        const at = wholeNumber(mark.atSpellLevel);
        return at === null || !text(mark.text) ? [] : [{ atSpellLevel: at, text: text(mark.text) }];
      }),
    ),
    needsGm: text(d.approval).toLowerCase() === 'gm',
    approvalNote: text(d.approvalNote),
    packId: entry.packId ?? '',
  };
}

/** A patron on the step's list: its name as the row shows it (with its pack when another patron has the same name, sn-1). */
export interface OfferedPatron {
  patron: Patron;
  /** "The Lantern Warden", or "The Lantern Warden, Road pack" when two in play share the name. */
  label: string;
  /** How the patron's followers sit with the class's alignment limit (`patronFit`); 'ok' when no limit is given. */
  fit: PatronFit;
}

/** How a patron sits with a class's alignment limit: open, open with the GM's special approval (soft), or not open (hard). */
export type PatronFit = 'ok' | 'soft' | 'closed';

/** The class's alignment limit and the campaign's alignment names, to cross with each patron's followers. */
export interface PatronFitTo {
  limit: AlignmentLimit | null;
  /** The names of the alignment rows Who they are offers (empty: not known, or still loading; nothing is then closed, `patronFit`). */
  alignments?: readonly string[];
}

/** The class's alignment limit (from its data) with the campaign's alignment names, for `patronsFor` and `patronNeeded`. */
export const patronFitTo = (klass: Record<string, unknown> | null | undefined, alignments: readonly string[]): PatronFitTo => ({ limit: classAlignmentLimit(klass), alignments });

/**
 * Whether a class may follow this patron (fix-patron-class-alignment, 2026-11-12): crosses the patron's
 * `followers.alignments` with the class's alignment limit (cs-3, rc-5). 'ok' when the patron names no follower
 * alignment, the class sets no limit, or the two share a name; otherwise 'soft' for a soft limit (the GM's special
 * approval) and 'closed' for a hard one. As `alignmentOffer` does, a limit whose names match none of the campaign's
 * alignments counts as none (a pack mismatch: nothing is closed); so does a patron whose followers' alignments match
 * none of them (it narrows nothing on Who they are, `patronAlignments`).
 */
export function patronFit(patron: Pick<Patron, 'alignments'>, limit: AlignmentLimit | null, alignments: readonly string[] = []): PatronFit {
  // No alignment names (the campaign doesn't track alignment, or its fields are still loading): nothing is closed,
  // as CreateCharacter's steps offer no alignment then (review of #665, Important 1).
  if (!limit || patron.alignments.length === 0 || alignments.length === 0) return 'ok';
  if (!alignments.some((a) => limit.names.some((n) => same(a, n)))) return 'ok';
  if (!alignments.some((a) => patron.alignments.some((p) => same(a, p)))) return 'ok';
  if (patron.alignments.some((p) => limit.names.some((n) => same(p, n)))) return 'ok';
  return limit.soft ? 'soft' : 'closed';
}

/**
 * The patrons a character of this class is offered (the lead's ruling, 2026-11-11): every patron in play (its own
 * option on; `optionOff` unset) whose `followers.classes` names the class, in the packs' order. Two with the same name
 * each show their pack after a comma (standing rule sn-1; a comma, not a middle dot: words rule 11). Empty: no Patron section at all.
 */
export function patronsFor(entries: readonly PatronEntry[], classId: string, packs: readonly { packId: string; name: string }[] = [], fitTo?: PatronFitTo): OfferedPatron[] {
  const offered = entries.filter((e) => !e.optionOff).map(readPatron).filter((p) => !!classId && p.classes.includes(classId));
  const packName = (packId: string) => packs.find((p) => p.packId === packId)?.name ?? '';
  return offered.map((patron) => {
    const namesake = offered.some((other) => other !== patron && same(other.name, patron.name));
    const from = namesake ? packName(patron.packId) : '';
    return { patron, label: from ? `${patron.name}, ${from}` : patron.name, fit: fitTo ? patronFit(patron, fitTo.limit, fitTo.alignments) : 'ok' };
  });
}

/**
 * Whether a character still needs a patron (the lead's ruling, 2026-11-11: one left on Decide later must not reach
 * approval unfinished): its class is offered patrons it may follow and its creation record names none of them. A
 * patron the class's alignment limit closes doesn't count (fix-patron-class-alignment): a class whose every patron is
 * closed needs none.
 */
export function patronNeeded(entries: readonly PatronEntry[], classId: string | null, creation: unknown, fitTo?: PatronFitTo): boolean {
  const offered = patronsFor(entries, classId ?? '', [], fitTo).filter((o) => o.fit !== 'closed');
  const saved = isRecord(creation) && isRecord(creation.patron) ? text(creation.patron.id) : '';
  return offered.length > 0 && !offered.some((o) => o.patron.id === saved);
}

/**
 * `patronNeeded` read from a campaign's setting (every entry, of every kind): its patrons, crossed with the class's own
 * alignment limit against the campaign's alignment names (fix-patron-class-alignment). For Send to the GM, the review's
 * checks and the GM's Approve, which all ask the same.
 */
export function patronNeededIn(all: readonly (PatronEntry & { kind: string })[], classId: string | null, creation: unknown, alignmentNames: readonly string[]): boolean {
  const klass = all.find((e) => e.kind === 'class' && e.packEntryId === classId);
  return patronNeeded(all.filter((e) => e.kind === 'patron'), classId, creation, patronFitTo(klass?.data, alignmentNames));
}

const aOrAn = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

/** What Send to the GM says while the patron is still to choose: "Choose a patron first: a marsh chaplain needs one before your GM can approve." */
export const patronFirstLine = (className: string): string => `Choose a patron first: ${aOrAn(className.trim().toLowerCase() || 'character of this class')} needs one before your GM can approve.`;

/**
 * Whether the review asks for this class's patron (review of #665, nit 2): only when one is open to it, by the same fit
 * rule as `patronFit` and `patronNeededIn`. A class whose every patron is closed is never asked for one.
 */
export function patronAskedIn(all: readonly (PatronEntry & { kind: string })[], classId: string | null, alignmentNames: readonly string[]): boolean {
  const klass = all.find((e) => e.kind === 'class' && e.packEntryId === classId);
  return patronsFor(all.filter((e) => e.kind === 'patron'), classId ?? '', [], patronFitTo(klass?.data, alignmentNames)).some((o) => o.fit !== 'closed');
}

/**
 * What holds a closed patron kept from before (picked before the class's limit closed it; review of #665, nit 1), as
 * `alignmentProblem` holds a kept closed alignment: "A marsh chaplain can't follow The Sunken Bell. Pick another
 * patron.", or "Take it off." when no patron is open to the class.
 */
export const patronClosedPickLine = (className: string, patronName: string, othersOpen: boolean): string =>
  `${aOrAn(className.trim().toLowerCase() || 'character of this class').replace(/^a/, 'A')} can't follow ${patronName}. ${othersOpen ? 'Pick another patron.' : 'Take it off.'}`;

/**
 * Why Send to the GM (and the review's check, and the Patron step's Next) holds the patron: a closed one kept from
 * before (`patronClosedPickLine`), else one still to choose (`patronFirstLine`); null when nothing holds it.
 */
export function patronProblemIn(all: readonly (PatronEntry & { kind: string })[], classId: string | null, creation: unknown, alignmentNames: readonly string[]): string | null {
  const klass = all.find((e) => e.kind === 'class' && e.packEntryId === classId);
  const className = klass?.name ?? '';
  const offered = patronsFor(all.filter((e) => e.kind === 'patron'), classId ?? '', [], patronFitTo(klass?.data, alignmentNames));
  const saved = isRecord(creation) && isRecord(creation.patron) ? text(creation.patron.id) : '';
  const kept = offered.find((o) => o.patron.id === saved && o.fit === 'closed');
  if (kept) return patronClosedPickLine(className, kept.patron.name, offered.some((o) => o.fit !== 'closed'));
  return patronNeededIn(all, classId, creation, alignmentNames) ? patronFirstLine(className) : null;
}

/** What the GM's Approve says for a character that arrived without one: no approval. */
export const patronFirstForGm = (name: string, className: string): string =>
  `${name} has no patron yet: ${aOrAn(className.trim().toLowerCase() || 'character of this class')} needs one before you can approve. Send it back to choose one.`;

/**
 * The patron a creation record names (`patron: { id, name }`), among the setting's patrons in play; null without one.
 * One whose option is off is hidden (null) and kept on the record, back when the option is on again (pt-9, hide and
 * keep, 2026-11-12). `patronKept` reads it whatever its option says.
 */
export function patronOf(creation: unknown, entries: readonly PatronEntry[]): Patron | null {
  const entry = patronEntryOf(creation, entries);
  return entry && !entry.optionOff ? readPatron(entry) : null;
}

/** The patron a creation record names while its option is off (hidden, kept on the record); null otherwise. */
export function patronKept(creation: unknown, entries: readonly PatronEntry[]): Patron | null {
  const entry = patronEntryOf(creation, entries);
  return entry && entry.optionOff ? readPatron(entry) : null;
}

const patronEntryOf = (creation: unknown, entries: readonly PatronEntry[]): PatronEntry | undefined => {
  const saved = isRecord(creation) && isRecord(creation.patron) ? text(creation.patron.id) : '';
  return saved ? entries.find((e) => e.packEntryId === saved) : undefined;
};

/** The name a creation record keeps for its patron, for a screen without the setting (the review's line); '' without one. */
export function patronNameOf(creation: unknown): string {
  return isRecord(creation) && isRecord(creation.patron) ? text(creation.patron.name) || text(creation.patron.id) : '';
}

/** A creation record with its patron set to this one (null: taken off). */
export function withPatron(record: Record<string, unknown>, patron: Pick<Patron, 'id' | 'name'> | null): Record<string, unknown> {
  const rest = { ...record };
  delete rest.patron;
  return patron ? { ...rest, patron: { id: patron.id, name: patron.name } } : rest;
}

/** The row's second line (pt-3): the blurb, then who may follow ("Lawful or Neutral followers"). */
export function patronRowLine(patron: Patron): string {
  const who = patron.alignments.length > 0 ? `${orList(patron.alignments)} followers` : '';
  // A blurb with no end punctuation gets a full stop before the followers (cp-1 d); one ending in . ! ? or …, a closing
  // quote after it included, is left as it stands.
  return [patron.blurb || patron.title, who].filter(Boolean).join(patron.blurb && !ENDS_SENTENCE.test(patron.blurb) ? '. ' : ' ');
}

/** A sentence's end: . ! ? or …, with any closing quotes or brackets after it. */
const ENDS_SENTENCE = /[.!?…]["'”’)\]]*$/;

/** The alignment rows a patron's followers may have, by the rows' own names; null when it names none, or none match (a pack mismatch: nothing is hidden). */
export function patronAlignments<T extends { name: string }>(patron: Patron | null, rows: readonly T[]): T[] | null {
  if (!patron || patron.alignments.length === 0) return null;
  const allowed = rows.filter((row) => patron.alignments.some((a) => same(a, row.name)));
  return allowed.length > 0 ? allowed : null;
}

/**
 * The alignment rows while a patron is picked (pt-3: "leaves only the allowed rows open"): only the rows its followers
 * may have, and the line saying why. Unchanged without a patron, or when it names no alignment the campaign has.
 */
export function patronAlignmentOffer<T extends { name: string }>(offer: { rows: T[]; line: string }, patron: Patron | null, word: string): { rows: T[]; line: string } {
  const allowed = patronAlignments(patron, offer.rows);
  if (!patron || !allowed) return offer;
  return { rows: allowed, line: `A follower of ${patron.name} is ${orList(allowed.map((r) => r.name))}: their ${word} follows their patron.` };
}

/** Next's check while a patron narrows the alignment: the one picked must be allowed; null when it is, or nothing is picked yet. */
export function patronAlignmentProblem(patron: Patron | null, picked: string, rows: readonly { name: string }[], word: string): string | null {
  const allowed = patronAlignments(patron, rows);
  if (!patron || !allowed || !picked.trim() || allowed.some((r) => same(r.name, picked))) return null;
  return `A follower of ${patron.name} is ${orList(allowed.map((r) => r.name))}: pick another ${word}, or another patron.`;
}

/**
 * What a pick does to the alignment (pt-3): `set` when the patron allows exactly one (the pick sets it), `clear` when
 * it allows several and the one picked isn't among them (the patron rules; the player picks again), else nothing.
 */
export function patronAlignmentChange(patron: Patron, picked: string, rows: readonly { name: string }[]): { set: string } | { clear: true } | null {
  const allowed = patronAlignments(patron, rows);
  if (!allowed) return null;
  if (allowed.length === 1) return same(allowed[0]!.name, picked) ? null : { set: allowed[0]!.name };
  return picked.trim() && !allowed.some((r) => same(r.name, picked)) ? { clear: true } : null;
}

/** The toast after a pick (pt-3, pt-7; the liege's words, cw-5): what was picked, then what it changed. */
export function patronPickToast(input: { name: string; alignment?: { word: string; name: string } | null; cleared?: { word: string; name: string } | null; also?: string | null }): string {
  const head = `Patron: ${input.name}.`;
  const also = input.also ? `your ${input.also.toLowerCase()} is ${input.name}` : '';
  if (input.alignment) return `${head} Your ${input.alignment.word} is now ${input.alignment.name}, as their followers are${also ? `, and ${also}` : ''}.`;
  if (input.cleared) return `${head} Their followers can't be ${input.cleared.name}: pick your ${input.cleared.word} again${also ? `. Y${also.slice(1)}` : ''}.`;
  return also ? `${head} Y${also.slice(1)}.` : head;
}

/**
 * The flag for a patron the GM must approve: the special-approval value "patron". One marked `approval: "gm"` has the
 * pack's note as its reason; one outside the class's soft alignment limit (`soft`, fix-patron-class-alignment) has its
 * followers' alignments and the class's usual ones ("Lantern followers; a mire stalker is usually Reed or Mire"); a
 * patron that is both has both reasons. Null for a free one.
 */
export function patronApproval(patron: Patron | null, soft: { limit: AlignmentLimit; className: string } | null = null): SpecialApproval | null {
  if (!patron || (!patron.needsGm && !soft)) return null;
  const gm = patron.needsGm ? patron.approvalNote || `Following ${patron.name} needs the GM's approval` : '';
  const usual = soft ? alignmentRequirement(soft.limit, soft.className) : '';
  // Ends with a full stop (cp-1 c): "Mire followers; a marsh chaplain is usually Lantern or Reed."
  const outside = soft ? `${orList(patron.alignments)} followers; ${usual.charAt(0).toLowerCase()}${usual.slice(1)}.` : '';
  // The pack's note as it stands; with the soft reason after it, its full stop gives way to the semicolon.
  return { step: 'patron', entryId: patron.id, name: patron.name, requirement: gm && outside ? `${gm.replace(/\.$/, '')}; ${outside}` : gm || outside };
}

/**
 * Why a closed patron's entry can't be picked (fix-patron-class-alignment), in the words the build already uses for
 * the followers (`patronRowLine`) and the class's hard limit (`alignmentOffer`): "Mire followers. A marsh chaplain may
 * only be Lantern or Reed."
 */
export function patronClosedNote(patron: Patron, limit: AlignmentLimit | null, className: string): string {
  const who = `${orList(patron.alignments)} followers.`;
  return limit ? `${who} ${aOrAn(className).replace(/^a/, 'A')} may only be ${orList(limit.names)}.` : who;
}

/** A closed patron's row line, and its entry's ▲ line (cp-1 b: the same words in both): "Not open to marsh chaplain". */
export const patronNotOpen = (className: string): string => `Not open to ${className}`;

/**
 * A closed patron's opened entry (cp-1 a, b): one ▲ line in the row's words (`patronNotOpen`), and under it the why as a
 * plain sentence (`patronClosedNote`); no small-capitals heading of its own. For `EntryPanel`'s `closed`.
 */
export const patronClosedEntry = (patron: Patron, limit: AlignmentLimit | null, className: string): { why: string; note: string } => ({ why: patronNotOpen(className), note: patronClosedNote(patron, limit, className) });

/** The approval flag for an offered patron: its own `approval: "gm"`, and a soft alignment limit it falls outside. */
export const offeredPatronApproval = (offered: OfferedPatron | null | undefined, fitTo: PatronFitTo | undefined, className: string): SpecialApproval | null =>
  offered ? patronApproval(offered.patron, offered.fit === 'soft' && fitTo?.limit ? { limit: fitTo.limit, className } : null) : null;

/** The highest spell level the character casts now, from the spells a day by level (index 0 is level 1); 0 with none. */
export function topSpellLevel(slots: readonly number[]): number {
  for (let at = slots.length - 1; at >= 0; at--) if ((slots[at] ?? 0) > 0) return at + 1;
  return 0;
}

/** The garb tiers reached at this spell level: tier 0 from creation, then each tier up to the spells cast (pt-6, pt-8). */
export const garbReached = (patron: Patron, spellLevel: number): GarbTier[] => patron.garb.filter((tier) => tier.atSpellLevel <= spellLevel);

/** The item ids of every garb tier reached, in tier order: given free into the pack (an id named twice is two). */
export const garbItemIds = (patron: Patron, spellLevel: number): string[] => garbReached(patron, spellLevel).flatMap((tier) => tier.itemIds);

/** What each garb item is called in the patron's own words (its tier's `text`), by item id: for the line a step shows when an item can't be found. */
export const garbWordsById = (patron: Patron, spellLevel: number): Map<string, string> => new Map(garbReached(patron, spellLevel).flatMap((tier) => tier.itemIds.map((id) => [id, tier.text || id] as const)));

/** The line a step shows for a garb item no attached pack has on this device: named, never dropped silently. */
export const garbMissingLine = (patronName: string, words: string): string => `${patronName}'s garb “${words}” isn't in the setting rules this device can read, so it isn't in your pack. Ask your GM to add it.`;

/** The marks reached at this spell level: one sheet line each. Dice or modifiers in a mark's words are played by hand. */
export const marksReached = (patron: Patron, spellLevel: number): PatronMark[] => patron.marks.filter((mark) => mark.atSpellLevel <= spellLevel);

/** "At creation", "From level-1 spells". */
export const tierWords = (atSpellLevel: number): string => (atSpellLevel === 0 ? 'At creation' : `From level-${atSpellLevel} spells`);

/** The spell list a class casts from (its `spellcasting.listId`), by class id; undefined for a class no attached pack has, or one that casts nothing. */
export type ClassListOf = (classId: string) => string | undefined;

/**
 * Whether the patron's swaps change this class's list (the lead's ruling B, 2026-11-11): its `spells.extends` names
 * the class or names none, or the class casts from the same list as the class `extends` names (an acolyte on the
 * cleric's list). A follower class with a list of its own is not swapped; nor is one whose list can't be told (the
 * class `extends` names isn't attached).
 */
export function swapsApplyTo(patron: Patron, classId: string, listOf: ClassListOf = () => undefined): boolean {
  if (!patron.spellsExtends || patron.spellsExtends === classId) return true;
  const base = listOf(patron.spellsExtends);
  return !!base && base === listOf(classId);
}

/**
 * The class's spell list with the patron's swaps applied (pt-5; the lead's ruling, 2026-11-11): each `with` is cast as
 * a spell of the class at the swap's `level`, whatever list or pack it came from, in place of `replaces` (taken off
 * every level). A swap whose `with` no attached pack has (`known` says no) is skipped: the class's spell stays, and
 * the swap is only shown as text. `from` says which spells came from the patron ("from <patron>").
 */
export function withSwaps(
  list: ReadonlyMap<number, string[]>,
  patron: Patron | null,
  classId: string,
  known: (spellId: string) => boolean,
  listOf: ClassListOf = () => undefined,
): { list: Map<number, string[]>; from: Map<string, string> } {
  const out = new Map<number, string[]>([...list].map(([level, ids]) => [level, [...ids]]));
  const from = new Map<string, string>();
  if (!patron || !swapsApplyTo(patron, classId, listOf)) return { list: out, from };
  for (const swap of patron.swaps) {
    if (!known(swap.with)) continue;
    // The swapped-in spell comes off every level first (the class may list it at another): it is cast at the swap's
    // level only, never at two.
    for (const [level, ids] of out) out.set(level, ids.filter((id) => id !== swap.with));
    const place = swap.replaces ? (out.get(swap.level) ?? []).indexOf(swap.replaces) : -1;
    if (swap.replaces) for (const [level, ids] of out) out.set(level, ids.filter((id) => id !== swap.replaces));
    const now = [...(out.get(swap.level) ?? [])];
    if (place >= 0) now.splice(Math.min(place, now.length), 0, swap.with);
    else now.push(swap.with);
    out.set(swap.level, now);
    from.set(swap.with, patron.name);
  }
  return { list: out, from };
}

/** What the entry and the sheet need from the setting to put names to a patron's ids; an id nobody has reads undefined. */
export interface PatronNames {
  spell: (id: string) => string | undefined;
  item?: (id: string) => string | undefined;
  klass?: (id: string) => string | undefined;
}

const named = (id: string, name: string | undefined) => name ?? `${id} (${NOT_ATTACHED})`;

/** One swap in words: "Level 1: Guiding Glow in place of Mend Cup"; a spell no attached pack has keeps its id, "(pack not attached)". */
export function swapWords(swap: SpellSwap, names: PatronNames): string {
  const instead = swap.replaces ? ` in place of ${named(swap.replaces, names.spell(swap.replaces))}` : '';
  return `Level ${swap.level}: ${named(swap.with, names.spell(swap.with))}${instead}`;
}

/**
 * A patron's entry (pt-3, pt-4: the whole ladder of tiers): its title and source, its blurb, the description, then
 * the GM's-approval note, depiction, who follows, holy symbol, garb by tier, strictures, prayer, spells, marks and
 * realm. The cult shows only where the device has it (the GM's).
 */
export function patronEntry(
  patron: Patron,
  names: PatronNames,
  packName = '',
): { name: string; meta: string; tagline: string; source: string; lead: string; description: string[]; headings: { label: string; text?: string; warn?: boolean; bullets?: { name: string; effect: string }[]; lines?: boolean }[] } {
  const classes = patron.classes.map((id) => named(id, names.klass ? names.klass(id) : id));
  const who = [classes.length > 0 ? andList(classes) : '', patron.alignments.length > 0 ? `${orList(patron.alignments)} in alignment` : ''].filter(Boolean).join(', ');
  const line = (label: string, value: string) => (value ? [{ label, text: value }] : []);
  return {
    name: patron.name,
    meta: [patron.title, patron.alignment, patron.source || packName].filter(Boolean).join(', '),
    // The book format (dec-10 S3, C3): the title is the small-capitals line, the book the last line; the garb, spells
    // and marks are ladders of labelled lines, a tier a line (`lines`).
    tagline: patron.title,
    source: patron.source || packName,
    lead: patron.blurb,
    description: patron.description ? patron.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [],
    headings: [
      ...(patron.needsGm ? [{ label: "Needs the GM's special approval", text: patron.approvalNote || 'Picking this patron sends your character to the GM to approve it.', warn: true }] : []),
      ...line('Depiction', patron.depiction),
      ...line('Who follows', who),
      ...line('Holy symbol', patron.holySymbol),
      ...(patron.garb.length > 0 ? [{ label: 'Holy garb', bullets: patron.garb.map((tier) => ({ name: tierWords(tier.atSpellLevel), effect: `${tier.text || 'garb'}${tier.costGp ? ` (worth ${tier.costGp} gp, given free)` : ''}` })), lines: true }] : []),
      ...line('Strictures', patron.strictures),
      ...line('Prayer', patron.prayer),
      ...(patron.swaps.length > 0 || patron.spellsNote
        ? [{ label: 'Spells', ...(patron.spellsNote ? { text: patron.spellsNote } : {}), ...(patron.swaps.length > 0 ? { bullets: patron.swaps.map((swap) => ({ name: `Level ${swap.level}`, effect: swapWords(swap, names).replace(/^Level \d+: /, '') })), lines: true } : {}) }]
        : []),
      ...(patron.marks.length > 0 ? [{ label: 'Marks', bullets: patron.marks.map((mark) => ({ name: tierWords(mark.atSpellLevel), effect: mark.text })), lines: true }] : []),
      ...line('Realm', patron.realm),
      ...line('Cult', patron.cult),
    ],
  };
}

/** One tier of the ladder on the sheet: when it comes, the pack's words, and whether this character has reached it. */
export interface LadderTier {
  atSpellLevel: number;
  /** "At creation", "From level-1 spells" (`tierWords`). */
  words: string;
  text: string;
  reached: boolean;
}

/** What the sheet's Patron section shows (Francis, 2026-11-12: the book's whole ladder, not only what's reached). */
export interface PatronLadder {
  /** The paragraphs with a bold lead-in, in the book's order around the garb: Holy symbol, then Prayer and Strictures. */
  lines: PatronLine[];
  /** Every tier of holy garb, in order. */
  garb: LadderTier[];
  /** Every swapped spell, when the swaps reach the class (the lead's ruling B): reached once the class casts that level. */
  spells: { level: number; text: string; reached: boolean }[];
  /** The pack's own note on the patron's spells ('' without one). */
  spellsNote: string;
  /** One mark per spell level, in order. */
  marks: LadderTier[];
}

/**
 * The sheet's Patron section (Francis, 2026-11-12, replacing the tiers-reached lines): the pack's words as they stand
 * (mc-34), every tier of garb, every swapped spell and every mark, each `reached` or not at this spell level (the
 * sheet says which in words, never colour alone). A swapped spell counts as reached from level 1 before any spell is
 * cast, as the swaps already apply to the list the character prepares from.
 */
export function patronLadder(patron: Patron, spellLevel: number, classId: string, names: PatronNames, listOf: ClassListOf = () => undefined): PatronLadder {
  const line = (key: string, label: string, value: string): PatronLine[] => (value ? [{ key, label, value }] : []);
  const tier = (atSpellLevel: number, text: string): LadderTier => ({ atSpellLevel, words: tierWords(atSpellLevel), text, reached: atSpellLevel <= spellLevel });
  return {
    lines: [...line('symbol', 'Holy symbol', patron.holySymbol), ...line('prayer', 'Prayer', patron.prayer), ...line('strictures', 'Strictures', patron.strictures)],
    garb: patron.garb.filter((t) => t.text).map((t) => tier(t.atSpellLevel, t.text)),
    spells: swapsApplyTo(patron, classId, listOf) ? patron.swaps.map((swap) => ({ level: swap.level, text: swapWords(swap, names), reached: swap.level <= Math.max(spellLevel, 1) })) : [],
    spellsNote: patron.spellsNote,
    marks: patron.marks.map((m) => tier(m.atSpellLevel, m.text)),
  };
}

/** One line of the sheet's Patron section: a label and its words. */
export interface PatronLine {
  key: string;
  label: string;
  value: string;
}

/**
 * What the sheet shows of a patron at this spell level (the lead's "done properly", 2026-11-11): the holy symbol, the
 * garb of every tier reached, the prayer, the strictures, the swapped spells (when they apply to the class), and one
 * line for each mark reached. A tier not reached yet shows nothing here: the entry has the whole ladder.
 */
export function patronLines(patron: Patron, spellLevel: number, classId: string, names: PatronNames, listOf: ClassListOf = () => undefined): PatronLine[] {
  const line = (key: string, label: string, value: string): PatronLine[] => (value ? [{ key, label, value }] : []);
  const garb = garbReached(patron, spellLevel).map((tier) => tier.text).filter(Boolean);
  const swaps = swapsApplyTo(patron, classId, listOf) ? patron.swaps.filter((swap) => swap.level <= Math.max(spellLevel, 1)) : [];
  return [
    ...line('symbol', 'Holy symbol', patron.holySymbol),
    ...line('garb', 'Holy garb', garb.join('; ')),
    ...line('prayer', 'Prayer', patron.prayer),
    ...line('strictures', 'Strictures', patron.strictures),
    ...line('spells', 'Spells', [...swaps.map((swap) => swapWords(swap, names)), patron.spellsNote].filter(Boolean).join('; ')),
    ...marksReached(patron, spellLevel).map((mark, n) => ({ key: `mark:${n}`, label: 'Mark', value: mark.text })),
  ];
}
