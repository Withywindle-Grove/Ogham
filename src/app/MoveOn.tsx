// The GM's Move on, wired (piece 5b-0 of docs/plans/dec-7-5-place-page-and-map.md, ruled by the lead 2026-11-14;
// dec-4 pieces b and d; pt-f2, pt-f3). 4a's MoveOnSheet fed with the ways from the place the party is in
// (moveOnWays.ts), and a move made through the time strip's own advance (sceneMove.tsx), so the checks and reminders
// that fall due in the move reach the card and the move's encounter check follows it. Mounted by the redesigned
// place page (5b), whose Move on opens it; no screen mounts it before then (po-2: each thing once, in its final place).
// The split party's pop-up (pt-f3 point 3) is the caller's to draw (`onBlocked`): it has no approved picture yet.
import { useEffect, useState } from 'react';
import type { Db } from '../core/supabase.ts';
import { destinationsOf, throughOf, wayMoveOf, wayOf } from '../modules/expedition/moveOnRows.ts';
import { loadMoveOn, moveBlocked, type MoveOnRead } from '../modules/expedition/moveOnWays.ts';
import { inSentence } from '../modules/expedition/moveOn.ts';
import { MoveOnSheet } from '../ui/MoveOnParts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { useSceneMoveCheck, useSceneMover } from './sceneMove.tsx';

/** Why Move on can't read its ways (a toast; the sheet then closes). */
export const MOVE_ON_UNREAD = "Couldn't read the ways on from here. Check your connection and try again.";
/** No time strip is listening (Move on outside Scene). */
export const MOVE_ON_NO_STRIP = 'Move on works on Scene, beside the time strip.';

/**
 * The GM's Move on sheet for the expedition under way, read afresh each time it opens (and when the log changes).
 * Move, or Yes on a way whose obstacle the GM decides, makes the move; No closes the sheet and moves nothing (nothing
 * is logged in this cut: what a No records is 4b's). While the party is split, a move is not sent: `onBlocked` gets the refusal's words.
 * At a Location the pack marks a way out, the list ends with "End expedition" (B10), which ends it through the strip.
 */
export function MoveOnWiring({
  db,
  campaignId,
  expeditionId,
  version = 0,
  onClose,
  onElsewhere,
  onBlocked,
  onMoved,
}: {
  db: Db;
  campaignId: string;
  expeditionId: string;
  /** The log's version: a change elsewhere reads the ways again. */
  version?: number;
  onClose: () => void;
  /** Somewhere else…: the place picker (the free jump). */
  onElsewhere: () => void;
  /** The party is split: the words for the caller's pop-up (pt-f3 point 3; no disabled button, no hiding). */
  onBlocked: (words: string) => void;
  /** The move was sent through the strip (the sheet is closed by the caller). */
  onMoved?: () => void;
}) {
  const show = useToast();
  const mover = useSceneMover();
  const check = useSceneMoveCheck();
  const [read, setRead] = useState<MoveOnRead | null | 'unread'>(null);
  useEffect(() => {
    let current = true;
    void loadMoveOn(db, campaignId, expeditionId).then((found) => current && setRead(found ?? 'unread'));
    return () => {
      current = false;
    };
  }, [db, campaignId, expeditionId, version]);
  useEffect(() => {
    if (read !== 'unread') return;
    show({ text: MOVE_ON_UNREAD, error: true });
    onClose();
  }, [read, show, onClose]);
  if (read === null || read === 'unread') return null;

  /**
   * End expedition, Move on's last row at a Location the pack marks a way out (B10; p2p-22): the party leaves through the
   * strip, as the menu's End expedition ends it (its own command, its toast with Undo).
   */
  async function leave() {
    const strip = mover();
    if (!strip) return show({ text: MOVE_ON_NO_STRIP, error: true });
    if (await strip.leave()) onMoved?.();
  }

  async function go(destinationId: string, key: string) {
    if (read === null || read === 'unread') return;
    const blocked = moveBlocked(read.groups);
    if (blocked) return onBlocked(blocked);
    const strip = mover();
    if (!strip) return show({ text: MOVE_ON_NO_STRIP, error: true });
    const found = wayOf(read, destinationId, key);
    const far = read.farEnds.get(destinationId);
    if (!found || !far) return;
    const { link, way } = found;
    const sent = await strip.move({
      to: { placeId: far.placeId, packId: read.here.packId, entryId: far.entryId, name: far.name },
      time: { value: way.value, unit: way.unit },
      extraTurns: link.barrier?.extraTurns ?? 0,
      way: way.by ? { by: way.by, name: way.name } : null,
      throughCheck: throughOf(read, link.barrier?.through ?? null)?.check ?? null,
    });
    if (sent) onMoved?.();
  }

  return (
    <MoveOnSheet
      here={inSentence(read.here.name)}
      destinations={destinationsOf(read)}
      moveOf={(id, key) => wayMoveOf(read, id, key, check)}
      onMove={(id, key) => void go(id, key)}
      onAnswer={(id, key, yes) => (yes ? void go(id, key) : onClose())}
      onElsewhere={onElsewhere}
      onEnd={read.wayOut ? () => void leave() : undefined}
      onClose={onClose}
    />
  );
}
