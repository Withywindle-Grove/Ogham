// The players' place card and the Knowledge the GM shares (plan dec-9-the-players-scene, row P4; rulings p4s-1, p4s-2,
// p4s-4 in docs/design/rulings/p4-sitting-2026-11-20.md; p2p-24; mc-35; rp-7). Data and words only; the screens are in
// src/app/PlayersPlaceCard.tsx and src/app/KnowledgeSheet.tsx. The database decides what a player may read
// (supabase/migrations/20261121230000_p4_players_place_card.sql): this file only shapes what it sends.
//   * The GM's eye on a section of a place's Knowledge (placeKnowledge.eye): shared with one group, at once, logged, with
//     Undo. The section's words are copied from the pack by the database, never sent by the app.
//   * A player's card (public.place_card_for_players): for each of their groups whose place is shown to them, the
//     place's number and name, the places it sits in whose names count as shown (the trail, top first; ppf-1), and the
//     other places of its Area the group was shown, each with its number and its first shown piece (ppf-4).
//   * A player's "What everyone knows" (public.knowledge_for_players): the sections shared with their group of the place
//     they're at, the places it sits in and the other places of its Area.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { clockShown, type Amount, type TimeUnits } from './clock.ts';
import { readPlaceFacts, type PlaceSection } from './placeFacts.ts';
import type { PlayersRule } from './placeRules.ts';
import { keyedName } from './placeTree.ts';
import { readsAs } from './placePlay.ts';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

// The GM's eye -------------------------------------------------------------------------------------------------------

/** One section's share with one group, as the GM reads it (public.knowledge_shares). */
export interface KnowledgeShare {
  group: number;
  packId: string;
  entryId: string;
  /** The section's place in the pack's `gm.sections` (PlaceSection.at). */
  sectionAt: number;
  shared: boolean;
  /** The campaign clock when it was last shared. */
  sharedClock: number;
}

/** The campaign's shares (the GM's alone); null when they can't be read. */
export async function loadKnowledgeShares(db: Db, campaignId: string): Promise<KnowledgeShare[] | null> {
  const { data, error } = await db.from('knowledge_shares').select('group_number, pack_id, entry_id, section_at, shared, shared_clock').eq('campaign_id', campaignId).eq('undone', false);
  if (error) return null;
  return (data ?? []).map((r) => ({
    group: Number(r.group_number),
    packId: String(r.pack_id),
    entryId: String(r.entry_id),
    sectionAt: Number(r.section_at),
    shared: r.shared === true,
    sharedClock: Number(r.shared_clock ?? 0),
  }));
}

/** The share of one section with one group, if it is shared now; null when it isn't (never shared, or taken back). */
export function shareOf(shares: readonly KnowledgeShare[], at: { group: number; packId: string; entryId: string; sectionAt: number }): KnowledgeShare | null {
  return shares.find((s) => s.shared && s.group === at.group && s.packId === at.packId && s.entryId === at.entryId && s.sectionAt === at.sectionAt) ?? null;
}

/** The GM's eye on a section of a place's Knowledge (p4s-2, mc-35): shared with the group, or taken back. Logged, with Undo. */
export const setKnowledgeShare = defineCommand({
  name: 'placeKnowledge.eye',
  target: (input: { campaignId: string; group: number; packId: string; entryId: string; sectionAt: number; share: boolean }) => ({ campaignId: input.campaignId }),
  allowed: (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<boolean>> => {
    const { error } = await db.rpc('set_knowledge_share', { campaign: input.campaignId, group_no: input.group, pack: input.packId, entry_id: input.entryId, section_at: input.sectionAt, share: input.share });
    return error ? fromError(error) : ok(input.share);
  },
});

export const PLACE_KNOWLEDGE_COMMANDS = [setKnowledgeShare] as const;

/** What the "turn N" words need: the expedition's start and step on the clock, and the campaign's units. */
export interface TurnClock {
  startedAt: number;
  step: Amount;
  units: TimeUnits;
}

/**
 * When a section was shared, in the strip's own step words ("turn 9"), counted in the expedition under way; null when it
 * was shared before it began, or no expedition's step is known (the line then says "Shared." alone). Pure.
 */
export function sharedStep(clock: number, turns: TurnClock | null): string | null {
  if (!turns || clock < turns.startedAt) return null;
  const step = clockShown(clock, turns.units, { expedition: { startedAt: turns.startedAt, step: turns.step } }).step;
  return step ? `${step.unit} ${step.number}` : null;
}

/** The players' line under a shared section's row (PL1, PR4): "Shared, turn 9.", or "Shared." with no step to name. */
export const sharedLine = (clock: number, turns: TurnClock | null): string => {
  const step = sharedStep(clock, turns);
  return step ? `Shared, ${step}.` : 'Shared.';
};

/** The GM's line under a shared section (frame 7b): "Shared with the players, turn 9." ("Group 2" for a split party). */
export const sharedWithLine = (clock: number, turns: TurnClock | null, group: string | null = null): string => {
  const step = sharedStep(clock, turns);
  const whom = group ?? 'the players';
  return step ? `Shared with ${whom}, ${step}.` : `Shared with ${whom}.`;
};

/** The sheet's foot (frame 7b): "1 of 3 sections shared." */
export const sharedCount = (shared: number, of: number): string => `${shared} of ${of} ${of === 1 ? 'section' : 'sections'} shared.`;

// A player's card ------------------------------------------------------------------------------------------------------

/** A place on a player's card: its campaign id, its number ('' for none) and its name as players know it. */
export interface KnownPlace {
  placeId: string;
  key: string;
  name: string;
  /** A known Location's second line (ppf-4, PL1b): the first piece the group was shown there; '' for none. */
  line?: string;
}

/** What a player's device reads for one of their groups' place (public.place_card_for_players). */
export interface PlayersPlaceCard {
  group: number;
  here: KnownPlace;
  /** The places it sits in whose names count as shown (ppf-1: one shown, or a place inside it shown), top first. */
  trail: string[];
  /** The Area it sits in directly, when its name counts as shown: the right card's heading; null otherwise (no stand-in). */
  area: string | null;
  /** The other places of its Area the group was shown, by number, each with its first shown piece (ppf-4). */
  known: KnownPlace[];
}

/** A place's name with its number, "1. The Jetty" (p2p-3), by the place page's own rule. */
export const numbered = (place: Pick<KnownPlace, 'key' | 'name'>): string => keyedName(place.key || null, place.name);

/** The rows of public.place_card_for_players, by group. Pure. */
export function readPlaceCards(rows: readonly Record<string, unknown>[]): Map<number, PlayersPlaceCard> {
  const out = new Map<number, PlayersPlaceCard>();
  const sorted = [...rows].sort((a, b) => Number(a.at ?? 0) - Number(b.at ?? 0));
  for (const r of sorted) {
    if (r.kind !== 'here') continue;
    const group = Number(r.group_number);
    out.set(group, { group, here: { placeId: text(r.place_id), key: text(r.key), name: text(r.name) }, trail: [], area: null, known: [] });
  }
  for (const r of sorted) {
    const card = out.get(Number(r.group_number));
    if (!card) continue;
    if (r.kind === 'trail' && text(r.name)) card.trail.push(text(r.name));
    if (r.kind === 'area' && text(r.name)) card.area = text(r.name);
    if (r.kind === 'known' && text(r.place_id)) card.known.push({ placeId: text(r.place_id), key: text(r.key), name: text(r.name), line: text(r.line) });
  }
  return out;
}

/** A player's cards; null when they can't be read (the screen keeps its last good read). */
export async function loadPlayersPlaceCards(db: Db, campaignId: string, asPlayer?: string): Promise<Map<number, PlayersPlaceCard> | null> {
  const { data, error } = await db.rpc('place_card_for_players', readsAs(campaignId, asPlayer));
  if (error) return null;
  return readPlaceCards((data ?? []) as Record<string, unknown>[]);
}

/** A section shared with a player's group (public.knowledge_for_players). */
export interface SharedKnowledge {
  group: number;
  id: string;
  /** The place it is knowledge of, as players know it (the place they're at, for one they were never shown). */
  placeName: string;
  section: PlaceSection;
  sharedClock: number;
}

/** The rows of public.knowledge_for_players, read by the Knowledge sheet's own reader (pf-18b). Pure. */
export function readSharedKnowledge(rows: readonly Record<string, unknown>[]): SharedKnowledge[] {
  return rows.flatMap((r): SharedKnowledge[] => {
    const section = readPlaceFacts({ gm: { sections: [{ heading: text(r.heading), text: r.body ?? null }] } }).sections[0];
    if (!section) return [];
    return [{ group: Number(r.group_number), id: text(r.share_id), placeName: text(r.place_name), section, sharedClock: Number(r.shared_clock ?? 0) }];
  });
}

/** What a player's groups have been shared; null when it can't be read. */
export async function loadPlayersKnowledge(db: Db, campaignId: string, asPlayer?: string): Promise<SharedKnowledge[] | null> {
  const { data, error } = await db.rpc('knowledge_for_players', readsAs(campaignId, asPlayer));
  if (error) return null;
  return readSharedKnowledge((data ?? []) as Record<string, unknown>[]);
}

// The Rules row (rp-7) -------------------------------------------------------------------------------------------------

/**
 * The Rules row's line (rp-7; frame PR4): one rule, its name; else a bare count, "3 rules"; when a second shown place has
 * rules too, "3 here, 1 of Saltwick Island" (the place the party is at first, then the others in the read's order).
 * Null when there is no rule: no row. Pure.
 */
export function rulesRowLine(rules: readonly Pick<PlayersRule, 'placeName' | 'name'>[], here: string): string | null {
  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0]!.name;
  const byPlace = rulesByPlace(rules, here);
  if (byPlace.length === 1) return `${rules.length} rules`;
  return byPlace.map(([place, list], i) => (i === 0 && place === here ? `${list.length} here` : `${list.length} of ${place}`)).join(', ');
}

/** The rules under each place's name, the place the party is at first, then in the read's order (PR5b). Pure. */
export function rulesByPlace<R extends Pick<PlayersRule, 'placeName'>>(rules: readonly R[], here: string): [string, R[]][] {
  const groups = new Map<string, R[]>();
  if (rules.some((r) => r.placeName === here)) groups.set(here, []);
  for (const rule of rules) groups.set(rule.placeName, [...(groups.get(rule.placeName) ?? []), rule]);
  return [...groups.entries()];
}

// A known Location's pieces (p4s-4) ------------------------------------------------------------------------------------

/** A piece a player was shown: its words and its lead-in ('' for none). */
export interface ShownPiece {
  id: string;
  kind: string;
  text: string;
  lead: string;
}

/**
 * The pieces of a place a player's group was shown, each once (a piece shown on two visits is one piece), the
 * description first, then the others in the order first shown (p2p-24's book format: the read sends no place in the
 * book's order, which would hint at the pieces still hidden). Pure.
 */
export function bookFormat<P extends { id: string; kind: string }>(pieces: readonly P[]): P[] {
  const once = [...new Map(pieces.map((p) => [p.id, p])).values()];
  return [...once.filter((p) => p.kind === 'description'), ...once.filter((p) => p.kind !== 'description')];
}
