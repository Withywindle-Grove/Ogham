// What the GM does to the place a group is in, shared by today's place card (a town, until 5t) and the GM's place page
// (dec-7 piece 5b): show and hide a piece, Hide all, + Piece, Edit piece, Remove this piece, go somewhere (place.set),
// and save the place's own words (players' name, notes). Each through its command, at once, with an Undo toast. Moved
// here unchanged from PlaceCard.tsx (5b), so both screens act the same way: build once, change once.
import { useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { loadPackPlaceEntry } from '../modules/expedition/placePlay.ts';
import { wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { PLACE_NAME_MAX, shownAgainWords } from '../modules/expedition/play.ts';
import {
  addPiece,
  editPiece,
  editPlace,
  hideAllPieces,
  hidePiece,
  removePiece,
  setPlace,
  showPiece,
  shownCount,
  type GroupPlace,
  type NoteHeading,
  type Piece,
  type PieceKind,
} from '../modules/expedition/placePlay.ts';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { placeWords, type PickedPlace } from './PlacePicker.tsx';
import { registry } from './services.ts';

/** A piece's words in a toast: its first 60 characters. */
export function short(text: string): string {
  const line = text.trim().replace(/\s+/g, ' ');
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

export function usePlaceActions({
  db,
  user,
  campaign,
  group,
  groupLabel,
  row,
  regionalTables,
  packPlaces,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  group: number;
  groupLabel: string | null;
  row: GroupPlace | null;
  regionalTables?: Record<string, unknown>;
  packPlaces: readonly PackPlace[] | null;
  onChanged: () => void;
}) {
  const show = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Piece | null>(null);
  const place = row?.place ?? null;
  const pieces = row?.pieces ?? [];
  const who = groupLabel ?? 'the party';

  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  async function togglePiece(piece: Piece) {
    if (!row || busy) return;
    setBusy(true);
    const command = piece.shown ? hidePiece : showPiece;
    const result = await runCommand(registry, db, user, command, { campaignId: campaign.id, row, piece });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `${piece.shown ? `Hidden from ${who}` : `Shown to ${who}`}: ${short(piece.text)}`, onUndo: () => void undoLatest(command.name) });
  }

  async function hideAll() {
    if (!row || busy) return;
    // The picture counts too (it's hidden by Hide all like a piece). Hide all is offered only while something is shown
    // (hx-2), so nothing shown is no tap of anyone's: nothing to say.
    if (shownCount(pieces) === 0 && !row.picture?.shown) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, hideAllPieces, { campaignId: campaign.id, row });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `Hidden from ${who}: ${result.value === 1 ? '1 piece' : `${result.value} pieces`}`, onUndo: () => void undoLatest(hideAllPieces.name) });
  }

  async function add(kind: PieceKind, text: string): Promise<boolean> {
    if (!place || busy) return false;
    if (!text.trim()) {
      show({ text: 'Write what players will see.', error: true });
      return false;
    }
    setBusy(true);
    const result = await runCommand(registry, db, user, addPiece, { campaignId: campaign.id, placeId: place.id, kind, text });
    setBusy(false);
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    show({ text: `Piece added (hidden): ${short(text)}`, onUndo: () => void undoLatest(addPiece.name) });
    return true;
  }

  async function edit(piece: Piece, kind: PieceKind, text: string): Promise<boolean> {
    if (busy) return false;
    if (!text.trim()) {
      show({ text: 'Write what players will see.', error: true });
      return false;
    }
    if (kind === piece.kind && text.trim() === piece.text) {
      setEditing(null);
      return true;
    }
    setBusy(true);
    const result = await runCommand(registry, db, user, editPiece, { campaignId: campaign.id, piece, kind, text });
    setBusy(false);
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    setEditing(null);
    show({ text: `Piece changed: ${short(text)}`, onUndo: () => void undoLatest(editPiece.name) });
    return true;
  }

  async function remove(piece: Piece) {
    if (busy) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, removePiece, { campaignId: campaign.id, piece });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    setEditing(null);
    show({ text: `Piece removed: ${short(piece.text)}`, onUndo: () => void undoLatest(removePiece.name) });
  }

  /**
   * Where now? (place.set): a typed name, unnamed, a place the campaign has, or a pack's place (made or found in the
   * same request: one line, one Undo). A tap on a place up the trail moves at once (ruled A, 2026-11-06).
   */
  async function move(picked: PickedPlace) {
    if (busy) return;
    if (picked.kind === 'other' && picked.name.trim().length > PLACE_NAME_MAX) return show({ text: `A place's name is at most ${PLACE_NAME_MAX} characters.`, error: true });
    setEditing(null);
    setBusy(true);
    const entry = picked.kind === 'pack' ? await loadPackPlaceEntry(db, picked.place.packId, picked.place.entryId) : null;
    if (picked.kind === 'pack' && !entry) {
      setBusy(false);
      return show({ text: "That place isn't in an attached pack any more.", error: true });
    }
    const result = await runCommand(registry, db, user, setPlace, {
      campaignId: campaign.id,
      group,
      name: picked.kind === 'other' ? picked.name : '',
      placeId: picked.kind === 'place' ? picked.place.id : null,
      packEntry: entry,
      regionalTables,
    });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    const where = picked.kind === 'other' ? picked.name.trim() : picked.kind === 'place' ? placeWords(picked.place, packPlaces) : picked.kind === 'pack' ? wordsFor(packPlaces ?? [picked.place], picked.place) : 'somewhere unnamed';
    const again = shownAgainWords(result.value.backShown);
    show({ text: `${groupLabel ? `${groupLabel} is at ${where}` : `The party is at ${where}`}${again}`, onUndo: () => void undoLatest('place.set') });
  }

  async function save(changes: { description?: string; playersName?: string; notes?: Partial<Record<NoteHeading, string>> }) {
    if (!place) return;
    const result = await runCommand(registry, db, user, editPlace, { campaignId: campaign.id, place, ...changes });
    if (!result.ok) show({ text: result.message, error: true });
    onChanged();
  }

  return { busy, editing, setEditing, who, undoLatest, togglePiece, hideAll, add, edit, remove, move, save };
}
