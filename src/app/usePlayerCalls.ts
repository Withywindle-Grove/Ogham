// The calls to adventure in a player's prompt slot (row P7 of docs/plans/dec-9-the-players-scene.md, the mount; rulings
// p7-1 to p7-13, docs/design/rulings/p7-call-card-2026-11-24.md; page 40). A player reads the sends they may read and
// their own seen marks (loadPlayerCalls; the database's read rules decide, so another player's send never arrives),
// again whenever the live log moves (a send's line reaches the players it is for, so a call the GM sends shows without
// reloading). "Got it" runs hook.seen through the command layer; the card folds at once with the time it gives back,
// and a refused or failed one leaves the card standing with the command's own words in a toast (page 40, critique 7:
// no frame draws a failure). Loading and a failed read draw nothing: the slot's other prompts stand as they are, and a
// failed read keeps the last good one.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { callsInSlot, loadPlayerCalls, markCallSeen, type CallSend, type CallsInSlot } from '../modules/library/callCards.ts';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';

type Read = { sends: CallSend[]; seen: Map<string, string> };

/** The slot's calls (null until the first good read, and for the GM), and "Got it". */
export function usePlayerCalls(db: Db, user: CurrentUser, campaignId: string, on: boolean, reloadKey: number): { calls: CallsInSlot | null; gotIt: (send: CallSend) => void } {
  const show = useToast();
  const [read, setRead] = useState<Read | null>(null);
  // Marks given on this device before the next read brings them back (so the card folds at once).
  const [marked, setMarked] = useState<ReadonlyMap<string, string>>(new Map());
  const sending = useRef(new Set<string>());

  useEffect(() => {
    if (!on) return;
    let current = true;
    void loadPlayerCalls(db, campaignId, user.id).then((found) => {
      // A failed read keeps the last good one (nothing hidden is guessed, nothing shown is lost).
      if (current && found) setRead(found);
    });
    return () => {
      current = false;
    };
  }, [db, on, campaignId, user.id, reloadKey]);

  const calls = useMemo(() => {
    if (!on || !read) return null;
    const seen = new Map(read.seen);
    for (const [id, at] of marked) if (!seen.has(id)) seen.set(id, at);
    return callsInSlot(read.sends, seen);
  }, [on, read, marked]);

  const gotIt = useCallback(
    (send: CallSend) => {
      // A second tap while the first is on its way sends nothing more.
      if (sending.current.has(send.id)) return;
      sending.current.add(send.id);
      void runCommand(registry, db, user, markCallSeen, { send: { id: send.id, campaignId: send.campaignId, actorId: send.actorId, playerUserId: send.playerUserId } }).then((result) => {
        sending.current.delete(send.id);
        if (!result.ok) {
          show({ text: result.message, error: true });
          return;
        }
        setMarked((m) => new Map(m).set(send.id, result.value));
      });
    },
    [db, user, show],
  );

  return { calls, gotIt };
}
