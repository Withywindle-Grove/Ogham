// What feeds the rule of piece A (`linesAtHand`, pieceNames.ts) for one place's card (spec scene-pack, piece B, #205;
// sf-6b, ⚑ 9 "Home Two's fix"; page 44, DT1, DT2, TR1, approved 2026-11-26 as redrawn; page 50 for a person's piece,
// approved 2026-11-28). The lines a piece names come from its GM facts (`idsInFacts`); the lines the place's pack names
// beyond its pieces are its creatures (`contents`), its treasure's things (`treasure[].itemId`) and the people whose
// place it is (`npcs[].locationId`, 07 §5, F19: "if an npc is at a location i should be able to quickly access their
// information"). Each becomes a detail row (`BookDetail`), named from the pack entry, never by its id. All the GM's:
// read on the GM's device from the campaign's entries, and never sent.
import { useEffect, useMemo, useState } from 'react';
import type { Db } from '../core/supabase.ts';
import { idsInFacts, linesAtHand, type GmFacts, type HandLine, type LinesAtHand, type NamedKind, type PieceRef } from '../modules/expedition/pieceNames.ts';
import { hoardRows } from '../modules/expedition/hoard.ts';
import type { Piece } from '../modules/expedition/placePlay.ts';
import { sourceLine } from '../modules/library/describe.ts';
import { layOutStatBlock, type StatBlockLayout } from '../modules/library/statBlockLayout.ts';
import type { SourceTitles } from '../modules/library/sourceTitles.ts';
import type { BookDetail } from './BookDetail.tsx';
import { loadCampaignPacksAndEntries } from './campaignSetting.ts';
import { useLogUserId, useLogVersion } from './campaignLog.tsx';

/** Under a shown piece's GM-only rows (l4-2); under a hidden piece the words stay "Only you see this." (`GM_ONLY_LABEL`). */
export const GM_ONLY_DETAILS_LABEL = 'Only you see these details.';
/** The fold's quiet line where pieces carry lines (sf-24). */
export const ON_THEIR_ROWS = 'The other stat lines and the items are on their own rows.';

/** A pack entry and the pack's own ways of laying it out, as the campaign's setting rules hold them. */
export interface AtHandRead {
  packs: readonly { packId: string; shortName?: string; statBlockLayout?: StatBlockLayout | null; sourceTitles?: SourceTitles }[];
  entries: readonly { packId: string; kind: string; packEntryId: string; name: string; data: Record<string, unknown> }[];
}
/** The place's own pack entry: null for a place the GM made by hand. */
export interface AtHandPlace {
  packId: string;
  entryId: string;
  data: Record<string, unknown>;
}
/** Where each line stands (piece A), and whether any piece carries one (the fold's quiet line). */
export type CardLines = LinesAtHand<BookDetail> & { onPieces: boolean };

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
// A creature's count after its id in the stored line: "reed-ferryman ×3 (asleep)" → "3"; "×1d4" → "1d4".
const COUNT = /^\S+ ×(\S+)/;

/**
 * The lines a piece's GM facts name (`idsInFacts`), each with the piece's count for a creature. On a place the GM made
 * by hand (`fromPack` false) only an id some pack knows is a line: a typed "asleep" or "wolves ×3" stays the GM's words.
 */
export function pieceRefsOf(gm: GmFacts, fromPack: boolean, known: (ref: string) => boolean): PieceRef[] {
  return idsInFacts(gm).flatMap((w): PieceRef[] => {
    const ref = `${w.kind}/${w.id}`;
    if (!fromPack && !known(ref)) return [];
    return [{ ref, count: w.kind === 'statBlock' ? (COUNT.exec(gm.statLine)?.[1] ?? null) : null }];
  });
}

/** The lines the place's own pack names beyond its pieces: its creatures, its things, the people who live there. */
function placeRefsOf(place: AtHandPlace, read: AtHandRead): string[] {
  const creatures = list(place.data.contents).flatMap((c) => (isObject(c) && text(c.statBlockId) ? [`statBlock/${text(c.statBlockId)}`] : []));
  const people = read.entries.filter((e) => e.kind === 'npc' && e.packId === place.packId && text(e.data.locationId) === place.entryId).map((e) => `npc/${e.packEntryId}`);
  const things = list(place.data.treasure).flatMap((t) => (isObject(t) && text(t.itemId) ? [`item/${text(t.itemId)}`] : []));
  return [...creatures, ...people, ...things];
}

/**
 * Where each stat line and item line stands on one place's card (piece A's rule), the pieces in the order drawn. Each
 * line is built from its pack entry, found in the place's own pack first, then in the campaign's order; a line no
 * attached pack has stands on its piece as "Not in your packs: a creature" (no name to give, never the id) and is left
 * out of the fold.
 */
export function cardLinesAtHand(pieces: readonly Piece[], place: AtHandPlace | null, read: AtHandRead): CardLines {
  const order = read.packs.map((p) => p.packId);
  const first = place?.packId ?? null;
  const packs = first ? [first, ...order.filter((p) => p !== first)] : order;
  const rank = (p: string) => (packs.indexOf(p) < 0 ? packs.length : packs.indexOf(p));
  const entryOf = (kind: string, id: string) =>
    read.entries.filter((e) => e.kind === kind && e.packEntryId === id && packs.includes(e.packId)).sort((a, b) => rank(a.packId) - rank(b.packId))[0] ?? null;
  const byRef = (ref: string) => {
    const at = ref.indexOf('/');
    return entryOf(ref.slice(0, at), ref.slice(at + 1));
  };
  const nameOf = (id: string) => read.entries.find((e) => e.packEntryId === id)?.name;
  const packOf = (packId: string) => read.packs.find((p) => p.packId === packId);
  const sourceOf = (e: { packId: string; data: Record<string, unknown> }) => {
    const pack = packOf(e.packId);
    return sourceLine(e.data.source, pack?.shortName ?? '', nameOf, undefined, pack?.sourceTitles ?? {});
  };
  const blockOf = (e: { packId: string; data: Record<string, unknown> }) => layOutStatBlock(e.data, packOf(e.packId)?.statBlockLayout ?? null, nameOf);

  const lineOf = (ref: string): HandLine<BookDetail> | null => {
    const found = byRef(ref);
    if (!found) return null;
    const kind = found.kind as NamedKind;
    const name = found.name.trim() && found.name.trim() !== found.packEntryId ? found.name.trim() : null;
    if (!name) return null;
    if (kind === 'statBlock') return { ref, kind, name, line: ref, detail: { name, shown: blockOf(found), source: sourceOf(found) } };
    if (kind === 'item') {
      const rule = text(found.data.description) || null;
      return { ref, kind, name, line: ref, detail: { name, rule, shown: layOutStatBlock(found.data, null, nameOf), source: sourceOf(found) } };
    }
    // A named character: who they are, then the block they use (07 §5, `statBlockId`); their line is that block's, so a
    // second name with the same block is the short row, and one with a block of their own keeps their own.
    const blockId = text(found.data.statBlockId);
    const block = blockId ? entryOf('statBlock', blockId) : null;
    const gm = isObject(found.data.gm) ? found.data.gm : {};
    const view = isObject(found.data.playerView) ? found.data.playerView : {};
    const words = {
      name,
      description: text(gm.notes) || text(view.description),
      abilities: text(gm.wants) ? [{ name: 'Wants', note: text(gm.wants) }] : [],
      source: found.data.source,
    };
    return {
      ref,
      kind,
      name,
      line: block ? `statBlock/${block.packEntryId}` : ref,
      detail: { name, kind: text(found.data.role) || null, shown: layOutStatBlock(words, null, nameOf), source: sourceOf(found), uses: block ? { name: block.name, shown: blockOf(block) } : null },
    };
  };

  const fromPack = place !== null;
  // A Treasure piece also names its hoard's things (`hoardRows`, as its find sheet reads them; 44-5 B: the Crate
  // carries "Lamp oil ×8"), each once, with the hoard's count.
  const items = new Set(read.entries.filter((e) => e.kind === 'item').map((e) => e.packEntryId));
  const hoardRefs = (p: Piece): PieceRef[] =>
    place
      ? hoardRows(p, place.data, [], items).rows.flatMap((r) => {
          const id = r.kind === 'thing' ? (r.itemId ?? r.unknownItemId ?? null) : null;
          return id && r.kind === 'thing' ? [{ ref: `item/${id}`, count: r.qty > 1 ? String(r.qty) : null }] : [];
        })
      : [];
  const refs = pieces.map((p) => {
    const own = pieceRefsOf(p.gm, fromPack, (ref) => byRef(ref) !== null);
    const more = hoardRefs(p).filter((h) => !own.some((o) => o.ref === h.ref));
    return [...own.map((o) => ({ ...o, count: o.count ?? hoardRefs(p).find((h) => h.ref === o.ref)?.count ?? null })), ...more];
  });
  const wanted = [...refs.flat().map((r) => r.ref), ...(place ? placeRefsOf(place, read) : [])];
  const lines = [...new Set(wanted)].flatMap((ref) => lineOf(ref) ?? []);
  // A line the pieces name but no pack has stays off `lines`: piece A then says "Not in your packs" on its piece.
  const atHand = linesAtHand(refs, lines);
  return { ...atHand, onPieces: atHand.pieces.some((rows) => rows.length > 0) };
}

/**
 * The card's lines, read on this device from the campaign's entries (the kept copy, so offline too), again whenever
 * the log moves. Null while the first read runs or when it fails: the pieces are then drawn as before.
 */
export function useCardLines(db: Db, campaignId: string, pieces: readonly Piece[], place: AtHandPlace | null): CardLines | null {
  const userId = useLogUserId();
  const version = useLogVersion();
  const [read, setRead] = useState<AtHandRead | null>(null);
  useEffect(() => {
    let live = true;
    void loadCampaignPacksAndEntries(db, userId, campaignId).then(
      (rows) => live && rows && setRead({ packs: rows.packs, entries: rows.entries }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [db, userId, campaignId, version]);
  return useMemo(() => (read ? cardLinesAtHand(pieces, place, read) : null), [read, pieces, place]);
}
