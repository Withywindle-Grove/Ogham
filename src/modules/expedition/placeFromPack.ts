// A place from a pack's location (M8b slice 0, pull request 1; docs/plans/m8b-0-places-from-packs.md; ruled
// 2026-11-06: ⚑ 1, 3, 4, 7, 10, 11; docs/07 §2 `locations` and "Pieces for Show players"; supabase/migrations/
// …_m8b_0_places_from_packs.sql). The GM picks a location of an attached pack; the campaign gets a place made from it
// (its name, terrain, the players' name, its region) with the GM's notes and its pieces, all unshown: nothing reaches
// players until the eye (the pieces model, ⚑ 4). The place is linked by (the GM's pack, the entry's id in the pack),
// so coming back finds the same place, two places from a pack may share a name, and a pack update changes nothing
// the campaign already has. One request, one log line, one Undo (place.fromPack; the database writes it all at once).
// Hidden means hidden: a piece's body is what players see once shown, so a GM-side fact (a secret, a value, a
// trigger, a stat line, a page) goes into the piece's gm_* columns or the notes, never into a body.
import { defineCommand, failed, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { plainLinks } from '../library/linkMarks.ts';
import { NOTE_HEADINGS, PLACE_TEXT_MAX, toPlace, type Place, type PlaceNotes } from './placePlay.ts';

/** A pack's location as the campaign's library holds it (a CampaignEntry of kind `location`). */
export interface PackPlaceEntry {
  packId: string;
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/** The kinds a piece made from a pack can be (07 "Pieces for Show players"). */
export type PackPieceKind = 'description' | 'exit' | 'person' | 'clue' | 'treasure' | 'hazard' | 'other';

/** One piece as the database takes it: what players may be shown, and the GM's facts beside it. */
export interface PackPiece {
  kind: PackPieceKind;
  body: string;
  gm_value: string;
  gm_trigger: string;
  gm_stat_line: string;
  /** The bold lead-in players read before the body (pf-3: an aspect's `lead`); left out for every other piece. */
  lead?: string;
}

/** The longest lead-in a piece takes (place_pieces.lead). */
export const PIECE_LEAD_MAX = 200;

/** What the database is given for the place itself (its name comes from the entry on the database's side). */
export interface PackPlaceDetails {
  players_name: string;
  terrain_id: string;
  pack_type: string;
  pack_parent_id: string;
  pack_key: string;
  region_id: string;
  /** The pack marks it a settlement (07 G-157): its size and population; null otherwise. */
  settlement: { size: string; population: number | null } | null;
}

/** The place composed from a location: ready for public.make_place_from_pack. */
export interface PackPlaceParts {
  details: PackPlaceDetails;
  notes: PlaceNotes;
  pieces: PackPiece[];
}

/** The longest GM fact a piece carries (place_pieces.gm_*). */
export const PIECE_GM_MAX = 1000;
const PACK_TYPES = ['region', 'site', 'area', 'floor', 'room', 'building'] as const;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const words = (value: unknown): string => (typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value));

/** A treasure's value as words ("40 gp, 7 cp"; coin keys as written, whole numbers; 07, ruled 2026-10-24). */
export function valueWords(value: unknown): string {
  if (!isObject(value)) return '';
  return Object.entries(value)
    .filter(([, n]) => typeof n === 'number' && Number.isFinite(n))
    .map(([coin, n]) => `${Math.trunc(n as number)} ${coin}`)
    .join(', ');
}

/**
 * A place's hoards that carry their own words (B15, p2p-28; 07 `hoards`): each hoard's name to its words, link marks
 * read as their words. Only a hoard some treasure entry at the place names; a name given twice keeps its first words.
 */
export function hoardWordsOf(data: Record<string, unknown>): Map<string, string> {
  const named = new Set(list(data.treasure).flatMap((t) => (isObject(t) && text(t.hoard) ? [text(t.hoard)] : [])));
  const out = new Map<string, string>();
  for (const hoard of list(data.hoards)) {
    if (!isObject(hoard)) continue;
    const name = text(hoard.name);
    const words = plainLinks(text(hoard.text));
    if (name && words && named.has(name) && !out.has(name)) out.set(name, words);
  }
  return out;
}

/**
 * A treasure entry's magic item, the truth the GM may show (B15, p2p-29; 07 `magicItem`): its real name and what it
 * does, as written, and what the senses tell of it (`noticed`, b15f-2; '' when not given), link marks read as their
 * words. The pack's `source` is not read: it stays the GM's, in the book (b15f-4). Null without both a name and words.
 */
export function magicItemOf(treasure: Record<string, unknown>): { name: string; text: string; noticed: string } | null {
  const magic = isObject(treasure.magicItem) ? treasure.magicItem : null;
  const name = magic ? plainLinks(text(magic.name)).slice(0, PIECE_LEAD_MAX) : '';
  const words = magic ? plainLinks(text(magic.text)) : '';
  return name && words ? { name, text: words, noticed: plainLinks(text(magic!.noticed)) } : null;
}

/**
 * The region whose encounter tables this location's own encounter check names (⚑ 7): the key in the rules set's
 * `wildEncounters.regionalTables` whose table is the check's `tableRef` (with or without the pack's prefix). '' when
 * the location names no table, or no region has it.
 */
export function regionOfPlace(data: Record<string, unknown>, regionalTables: Record<string, unknown> | undefined): string {
  const check = isObject(data.encounterCheck) ? data.encounterCheck : null;
  const ref = text(check?.tableRef);
  if (!ref || !regionalTables) return '';
  const bare = ref.includes(':') ? ref.slice(ref.indexOf(':') + 1) : ref;
  const tableOf = (value: unknown) => (isObject(value) ? text(value.tableId) : text(value));
  const found = Object.entries(regionalTables).find(([, value]) => tableOf(value) === ref || tableOf(value) === bare);
  return found ? found[0] : '';
}

/** The regional tables the campaign's rules sets name, merged (a later rules set's region wins the same key). */
export function regionalTablesOf(entries: readonly { kind: string; data: Record<string, unknown> }[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.kind !== 'rulesSet') continue;
    const wild = isObject(entry.data.wildEncounters) ? entry.data.wildEncounters : null;
    if (isObject(wild?.regionalTables)) Object.assign(merged, wild.regionalTables);
  }
  return merged;
}

/** The regional tables from the campaign's rules sets as the setting holds them (CampaignSetting.rulesSets). */
export function regionalTablesOfRulesSets(rulesSets: readonly Record<string, unknown>[]): Record<string, unknown> {
  return regionalTablesOf(rulesSets.map((data) => ({ kind: 'rulesSet', data })));
}

/** Text in parts no longer than `max`, broken at a line end when there is one, never dropping a character. */
export function chunksOf(value: string, max: number): string[] {
  const parts: string[] = [];
  let rest = value;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const at = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
    const cut = at > max / 2 ? at + 1 : max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** The GM's notes under the five headings, in order, each at most 4000 characters: the lines fill one heading, then the next (⚑ 11). */
export function notesAcrossHeadings(lines: readonly string[]): { ok: true; notes: PlaceNotes } | { ok: false; message: string } {
  const notes = Object.fromEntries(NOTE_HEADINGS.map((h) => [h, ''])) as PlaceNotes;
  let at = 0;
  for (const piece of lines.flatMap((line) => chunksOf(line, PLACE_TEXT_MAX))) {
    while (at < NOTE_HEADINGS.length) {
      const heading = NOTE_HEADINGS[at]!;
      const joined = notes[heading] ? `${notes[heading]}\n${piece}` : piece;
      if (joined.length <= PLACE_TEXT_MAX) {
        notes[heading] = joined;
        break;
      }
      at += 1;
    }
    if (at >= NOTE_HEADINGS.length) return { ok: false, message: `The GM notes are too long for the card (over ${PLACE_TEXT_MAX * NOTE_HEADINGS.length} characters).` };
  }
  return { ok: true, notes };
}

/**
 * The place a location makes (07 "Pieces for Show players"): the description (`playerView.text`), each aspect (pf-3:
 * kind Other with its bold lead-in), each exit, each
 * person as described, each clue's text, each treasure's text, and each contents or hazards entry's `appearance`,
 * as pieces in that order; the GM's facts beside them (an exit's `to`, a person's NPC, a clue's page and what it
 * points to, a treasure's value and item, a creature's stat block and count, a hazard's trigger and effect). The GM
 * notes, the secrets, the creatures and hazards with no appearance, the quotes, the encounter check and the page go
 * into the notes, in the pack's order, split across the headings when long (⚑ 11), never cut.
 */
export function composePackPlace(entry: PackPlaceEntry, regionalTables?: Record<string, unknown>): { ok: true; parts: PackPlaceParts } | { ok: false; message: string } {
  const data = entry.data;
  const view = isObject(data.playerView) ? data.playerView : {};
  const gm = isObject(data.gm) ? data.gm : {};
  const pieces: PackPiece[] = [];
  const noteLines: string[] = [];
  const gmFact = (given: string): string => {
    const value = plainLinks(given);
    if (value.length <= PIECE_GM_MAX) return value;
    // Never cut: what the column can't hold goes to the notes whole.
    noteLines.push(value);
    return `${value.slice(0, PIECE_GM_MAX - 1)}…`;
  };
  const piece = (kind: PackPieceKind, body: string, facts: Partial<Omit<PackPiece, 'kind' | 'body'>> = {}) => {
    // A link's marks never reach a piece (pf-5): players read its label as plain text, and never the id it names.
    chunksOf(plainLinks(body), PLACE_TEXT_MAX).forEach((part, at) => {
      const made: PackPiece = { kind, body: part, gm_value: gmFact(facts.gm_value ?? ''), gm_trigger: gmFact(facts.gm_trigger ?? ''), gm_stat_line: gmFact(facts.gm_stat_line ?? '') };
      // A long aspect split in parts keeps its lead-in on the first part only.
      if (facts.lead && at === 0) made.lead = plainLinks(facts.lead);
      pieces.push(made);
    });
  };

  if (text(view.text)) piece('description', text(view.text));
  // pf-3 (mc-17): each aspect is a piece of its own, kind Other, its lead-in bold before the text, in the pack's order.
  for (const aspect of list(view.aspects)) {
    const body = isObject(aspect) ? text(aspect.text) : text(aspect);
    const lead = isObject(aspect) ? text(aspect.lead).slice(0, PIECE_LEAD_MAX) : '';
    if (body) piece('other', body, lead ? { lead } : {});
  }
  for (const exit of list(view.exits)) {
    const body = isObject(exit) ? text(exit.text) : text(exit);
    if (body) piece('exit', body, { gm_value: isObject(exit) && text(exit.to) ? `Leads to ${text(exit.to)}` : '' });
  }
  for (const person of list(view.people)) {
    if (!isObject(person) || !text(person.description)) continue;
    piece('person', text(person.description), { gm_stat_line: text(person.npcId) ? `NPC: ${text(person.npcId)}` : '' });
  }
  for (const clue of list(data.clues)) {
    if (!isObject(clue) || !text(clue.text)) continue;
    piece('clue', text(clue.text), { gm_value: [text(clue.source) ? `Source: ${text(clue.source)}` : '', text(clue.pointsTo) ? `Points to ${text(clue.pointsTo)}` : ''].filter(Boolean).join(', ') });
  }
  // B15 (p2p-28, p2p-29; page 30, HM1): a hoard with its own words (`hoards`) is one piece in the book's words, led by
  // the hoard's name, where its first thing stands; its things make no piece of their own, and it carries no value line
  // (pg30-2). A magic item's truth (`magicItem`) is a piece of its own right after the piece its thing is in, led by
  // the item's real name; it keeps nothing in the piece's GM-only column (b15f-4: no source on it, so nothing of a magic
  // item's piece is ever the GM's alone once shown). Every piece starts hidden, as ever.
  const worded = hoardWordsOf(data);
  const treasures = list(data.treasure).filter((t): t is Record<string, unknown> => isObject(t) && !!text(t.text));
  const truthPiece = (treasure: Record<string, unknown>) => {
    const truth = magicItemOf(treasure);
    if (truth) piece('other', truth.text, { lead: truth.name });
  };
  treasures.forEach((treasure, at) => {
    const hoard = text(treasure.hoard);
    if (hoard && worded.has(hoard)) {
      // The hoard's piece where its first thing stands; then each of its things' truths, in the pack's order.
      if (treasures.findIndex((t) => text(t.hoard) === hoard) !== at) return;
      piece('treasure', worded.get(hoard)!, { lead: hoard.slice(0, PIECE_LEAD_MAX) });
      treasures.filter((t) => text(t.hoard) === hoard).forEach(truthPiece);
      return;
    }
    piece('treasure', text(treasure.text), { gm_value: [valueWords(treasure.value), text(treasure.itemId) ? `Item: ${text(treasure.itemId)}` : ''].filter(Boolean).join(', ') });
    truthPiece(treasure);
  });
  const creatureWords = (c: Record<string, unknown>) => [text(c.statBlockId) || 'a creature', words(c.count) ? `×${words(c.count)}` : '', text(c.note) ? `(${text(c.note)})` : ''].filter(Boolean).join(' ');
  const hazardWords = (h: Record<string, unknown>) => [text(h.name), [text(h.trigger), text(h.effect)].filter(Boolean).join(' → ')].filter(Boolean).join(' — ');
  const creaturesUnshown: string[] = [];
  for (const creature of list(data.contents)) {
    if (!isObject(creature)) continue;
    if (text(creature.appearance)) piece('person', text(creature.appearance), { gm_stat_line: creatureWords(creature) });
    else creaturesUnshown.push(creatureWords(creature));
  }
  const hazardsUnshown: string[] = [];
  for (const hazard of list(data.hazards)) {
    if (!isObject(hazard)) continue;
    if (text(hazard.appearance)) piece('hazard', text(hazard.appearance), { gm_value: text(hazard.name), gm_trigger: [text(hazard.trigger), text(hazard.effect)].filter(Boolean).join(' → ') });
    else if (hazardWords(hazard)) hazardsUnshown.push(hazardWords(hazard));
  }

  // The notes, in the pack's order: the GM's own words first.
  const lines: string[] = [];
  if (text(gm.notes)) lines.push(text(gm.notes));
  for (const secret of list(gm.secrets)) {
    const body = isObject(secret) ? text(secret.text) : text(secret);
    if (body) lines.push(`Secret: ${body}`);
  }
  if (creaturesUnshown.length) lines.push(`Creatures: ${creaturesUnshown.join('; ')}`);
  if (hazardsUnshown.length) lines.push(`Hazards: ${hazardsUnshown.join('; ')}`);
  for (const quote of list(data.quotes)) {
    if (!isObject(quote) || !text(quote.text)) continue;
    lines.push(`Quote${text(quote.kind) ? ` (${text(quote.kind)})` : ''}: ${text(quote.text)}`);
  }
  const check = isObject(data.encounterCheck) ? data.encounterCheck : null;
  if (check) {
    const every = isObject(check.every) ? [words(check.every.value), text(check.every.unit)].filter(Boolean).join(' ') : '';
    const chance = isObject(check.chance) ? [text(check.chance.die), list(check.chance.on).map(words).filter(Boolean).join(', ')].filter(Boolean).join(' on ') : '';
    const parts = [every ? `every ${every}` : '', chance, text(check.tableRef) ? `table ${text(check.tableRef)}` : '', text(check.note)].filter(Boolean);
    if (parts.length) lines.push(`Encounter check: ${parts.join(', ')}`);
  }
  if (data.hiddenUntilSearched === true) lines.push('Hidden until searched.');
  if (text(data.source)) lines.push(`Source: ${text(data.source)}`);
  lines.push(...noteLines);
  const notes = notesAcrossHeadings(lines.map(plainLinks));
  if (!notes.ok) return notes;

  const type = text(data.type);
  const details: PackPlaceDetails = {
    players_name: text(view.name).slice(0, 200),
    terrain_id: text(data.terrain).slice(0, 200),
    pack_type: (PACK_TYPES as readonly string[]).includes(type) ? type : '',
    pack_parent_id: text(data.parentId).slice(0, 200),
    pack_key: text(data.key).slice(0, 200),
    region_id: regionOfPlace(data, regionalTables).slice(0, 200),
    settlement: isObject(data.settlement) && text(data.settlement.size) ? { size: text(data.settlement.size).slice(0, 200), population: typeof data.settlement.population === 'number' && Number.isFinite(data.settlement.population) ? Math.trunc(data.settlement.population) : null } : null,
  };
  return { ok: true, parts: { details, notes: notes.notes, pieces } };
}

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/**
 * The campaign's place for a pack's location, made in the request under way (the same tag, so the caller's line and
 * Undo cover it), or found. Used by Start expedition, Where now? and Move… when a pack place is picked.
 */
export async function makePlaceInRequest(db: Db, campaignId: string, entry: PackPlaceEntry, regionalTables?: Record<string, unknown>): Promise<CommandResult<Place>> {
  const composed = composePackPlace(entry, regionalTables);
  if (!composed.ok) return failed(composed.message);
  const { details, notes, pieces } = composed.parts;
  const { data, error } = await db.rpc('make_place_from_pack', {
    campaign: campaignId,
    pack: entry.packId,
    entry_id: entry.packEntryId,
    details: { ...details, settlement: details.settlement ? { ...details.settlement } : null },
    notes: { ...notes },
    pieces: pieces.map((piece) => ({ ...piece })),
  });
  if (error) return fromError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return failed("The place couldn't be made.");
  // The notes as stored, with their version (#532 review): a repick of a place made before returns the GM's edited
  // notes, not the pack's, so the next save isn't refused as stale or written over the edit.
  const stored = await db.from('place_notes').select('id, traps, puzzles, encounters, treasure, doors, version').eq('id', String(row.id)).maybeSingle();
  if (stored.error) return fromError(stored.error);
  return ok(stored.data ? toPlace(row, stored.data as Record<string, unknown>) : { ...toPlace(row, null), notes, notesVersion: 1 });
}

/**
 * Pick a place from a pack (place.fromPack): the campaign's place for this location, made with its notes and its
 * unshown pieces if there isn't one (one line, Undo marks it all undone), the one made before otherwise (nothing
 * written, no line). The GM; the pack must be attached to the campaign (the database checks the link).
 */
export const placeFromPack = defineCommand({
  name: 'place.fromPack',
  log: 'simple',
  target: (input: { campaignId: string; entry: PackPlaceEntry; regionalTables?: Record<string, unknown> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input): Promise<CommandResult<Place>> => makePlaceInRequest(db, input.campaignId, input.entry, input.regionalTables),
});

/** Registered by the expedition module (index.ts), beside PLACE_COMMANDS. */
export const PACK_PLACE_COMMANDS = [placeFromPack] as const;
