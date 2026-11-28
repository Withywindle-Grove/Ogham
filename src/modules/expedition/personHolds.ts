// dec5-gaps piece F (#192; G-228, dg-10 to dg-16, dg-19; page 50, approved by Francis 2026-11-28 with findings 1, 5
// and 6): what a person carries. Her pack lists it (`npcs[].holds`, 07 §5); the importer keeps it on her library entry,
// which is GM-only (kind `npc`), so it never reaches a player. What she still holds is read from the GM's log at every
// place (`sentHeld`, piece E; dg-12's technical pick), never stored. Pure: no database, no screen.
import { heldKey } from './findSend.ts';

/** A library entry as the campaign's setting rules hold it (`CampaignEntry`): the fields read here. */
export interface HoldsEntry {
  packId: string;
  kind: string;
  packEntryId: string;
  name: string;
  data: unknown;
  /** The campaign's library entry id, which the send names (`find.give`'s `libraryEntryId`). */
  entryId?: string;
}

/** One thing she carries, found in an attached pack. */
export interface HeldThing {
  /** Its held key in the log (`heldKey`): the person's id and the item's bare id. */
  key: string;
  itemId: string;
  name: string;
  /** A whole number of 1 or more (1 when the pack leaves it out). */
  qty: number;
  /** The book's note ("On a cord at her neck"); null when none. */
  note: string | null;
  libraryEntryId: string | null;
}

/** Her things, in the pack's order, and how many lines name an item no attached pack has (finding 6: never named). */
export interface PersonHolds {
  personId: string;
  things: HeldThing[];
  missing: number;
}

/** Where a send put a held thing (`sentHeld`'s value). */
export interface HeldSend {
  to: string | null;
  placeId: string;
  eventId: string;
  seq: number;
}

export type HeldState = HeldThing & { sent: HeldSend | null };

/**
 * The label over a piece's GM-only lines on the place page, as page 50 draws it. One string, so loop 4's #205 changes
 * it in one place ("Only you see these details." under a shown piece, sb4-4, l4-2).
 */
export const GM_ONLY_LABEL = 'Only you see this.';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
/** The bare item id of an `itemRef`, as a shop's stock line reads it: everything after the first ':'. */
const bare = (ref: string): string => {
  const at = ref.indexOf(':');
  return (at < 0 ? ref : ref.slice(at + 1)).trim();
};
const lowerFirst = (words: string): string => (words ? words[0]!.toLowerCase() + words.slice(1) : words);
const upperFirst = (words: string): string => (words ? words[0]!.toUpperCase() + words.slice(1) : words);

/** The packs in the order they are searched: `first` (the place's or her own pack), then the campaign's order. */
function ranked<T extends { packId: string }>(entries: readonly T[], order: readonly string[], first: string | null): T[] {
  const packs = first ? [first, ...order.filter((p) => p !== first)] : [...order];
  const rank = (p: string) => (packs.indexOf(p) < 0 ? packs.length : packs.indexOf(p));
  return [...entries].sort((a, b) => rank(a.packId) - rank(b.packId));
}

/** The person a piece names ("NPC: <id>"), found by her pack id in the place's own pack first, then the packs' order. */
export function personOf<T extends HoldsEntry>(entries: readonly T[], personId: string, order: readonly string[], placePack: string | null): T | null {
  return ranked(entries.filter((e) => e.kind === 'npc' && e.packEntryId === personId), order, placePack)[0] ?? null;
}

/**
 * What she carries (dg-10, dg-15): each `holds` line's item (`itemId`, or `itemRef` with its pack dropped, as a shop's
 * stock line), found in her own pack first and then in the packs' order; `qty` a whole number of 1 or more, else 1 (the
 * checker warns); the book's `note`. A line whose item no attached pack has, or that names none, is counted. The same
 * item twice on her is one thing, the first line kept. Null when she holds nothing.
 */
export function personHolds(person: HoldsEntry, entries: readonly HoldsEntry[], order: readonly string[]): PersonHolds | null {
  const lines = isObject(person.data) && Array.isArray(person.data.holds) ? person.data.holds : [];
  if (lines.length === 0) return null;
  const items = ranked(
    entries.filter((e) => e.kind === 'item'),
    order,
    person.packId,
  );
  const things: HeldThing[] = [];
  let missing = 0;
  for (const line of lines) {
    const id = isObject(line) ? (text(line.itemId) || bare(text(line.itemRef))) : '';
    const found = id ? items.find((e) => e.packEntryId === id) : undefined;
    const key = found ? heldKey(person.packEntryId, id) : null;
    if (!found || !key) {
      missing += 1;
      continue;
    }
    if (things.some((t) => t.key === key)) continue;
    const qty = isObject(line) && Number.isInteger(line.qty) && (line.qty as number) >= 1 ? (line.qty as number) : 1;
    const note = isObject(line) ? text(line.note) : '';
    things.push({ key, itemId: id, name: text(found.name) || id, qty, note: note || null, libraryEntryId: found.entryId ?? null });
  }
  return { personId: person.packEntryId, things, missing };
}

/** Each of her things, held or sent (`sent`: `sentHeld` of the GM's log, every place's sends). */
export function heldStates(holds: PersonHolds, sent: ReadonlyMap<string, HeldSend>): HeldState[] {
  return holds.things.map((thing) => ({ ...thing, sent: sent.get(thing.key) ?? null }));
}

/** A thing's words, as its row names it: "Oil flask ×999", or the name alone for one. */
export const heldThingWords = (thing: Pick<HeldThing, 'name' | 'qty'>): string => (thing.qty > 1 ? `${thing.name} ×${thing.qty}` : thing.name);

const whom = (to: string | null, nameOf: (id: string) => string): string => (to === null ? 'the party stash' : nameOf(to));

/**
 * The Carries line on her piece (dg-10, dg-12; page 50): "Carries: warden’s lantern, iron key."; a thing sent follows as
 * its own sentence, "Carries: iron key. Warden’s lantern sent to Wren."; everything sent, "Carries nothing now.". `lead`
 * is the bold word.
 */
export function carriesWords(states: readonly HeldState[], nameOf: (id: string) => string): { lead: string; rest: string } {
  const held = states.filter((s) => s.sent === null);
  if (held.length === 0) return { lead: 'Carries', rest: 'nothing now.' };
  const sent = states.flatMap((s) => (s.sent ? [`${upperFirst(heldThingWords(s))} sent to ${whom(s.sent.to, nameOf)}.`] : []));
  return { lead: 'Carries:', rest: [`${held.map((s) => lowerFirst(heldThingWords(s))).join(', ')}.`, ...sent].join(' ') };
}

/** A row sent from here (page 50): "Sent to Wren." or "Sent to the party stash.". */
export const sentHereWords = (to: string | null, nameOf: (id: string) => string): string => `Sent to ${whom(to, nameOf)}.`;

/** A thing sent at another place (dg-12): "Sent before: Warden’s lantern, to Wren, at 4. The Customs Shed.". */
export const sentBeforeWords = (thing: Pick<HeldThing, 'name' | 'qty'>, to: string | null, nameOf: (id: string) => string, placeName: string | null): string =>
  `Sent before: ${heldThingWords(thing)}, to ${whom(to, nameOf)}${placeName ? `, at ${placeName}` : ''}.`;

/** The send's toast (page 50): "Warden’s lantern sent to Wren.". */
export const heldSentWords = (thing: Pick<HeldThing, 'name' | 'qty'>, to: string | null, nameOf: (id: string) => string): string =>
  `${upperFirst(heldThingWords(thing))} sent to ${whom(to, nameOf)}.`;

/** Take it back's toast, as TR1's: "Taken back from Wren: warden’s lantern.". */
export const heldTakenBackWords = (thing: Pick<HeldThing, 'name' | 'qty'>, to: string | null, nameOf: (id: string) => string): string =>
  `Taken back from ${whom(to, nameOf)}: ${lowerFirst(heldThingWords(thing))}.`;

/** The quiet line for things no attached pack has (finding 6, no id): null when there are none. */
export const missingWords = (count: number): string | null =>
  count <= 0 ? null : count === 1 ? 'One thing she carries isn’t in your packs.' : `${count} things she carries aren’t in your packs.`;
