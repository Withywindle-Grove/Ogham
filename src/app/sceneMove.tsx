// Move on through the time strip (piece 5b-0, ruled by the lead 2026-11-14; pt-f2): the Move on sheet sits beside the
// time strip (SceneTime), not inside it, but a move must run the strip's own advance, so that the checks and
// reminders that fall due during the move, the open rest flows and the lights reach the card exactly as Advance by…
// does, and then put the move's encounter check on the card (dec-4 piece d). The strip listens; Move on sends. As
// sceneCard.tsx: without a listener (a players' screen, a test with the sheet alone) nothing is sent and the caller
// says so.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Check } from '../modules/expedition/modes.ts';
import type { MoveCheck } from '../modules/expedition/moveOn.ts';
import type { WayTaken } from '../modules/expedition/placeMove.ts';

/** One move, as Move on asks the strip to make it. */
export interface MoveRequest {
  /**
   * Where the link leads: the campaign's place, or null when the campaign hasn't made it yet (the strip makes it from
   * the pack first, place.fromPack, as the place picker does: its own line, ruled 2026-11-11 on #637's ⚑ 1).
   */
  to: { placeId: string | null; packId: string; entryId: string; name: string };
  /** The way's own time as the pack gives it; the strip turns it into this campaign's turns (moveTime). */
  time: { value: number; unit: string };
  /** An obstacle's extra turns (0 without one). */
  extraTurns: number;
  /** The way taken; null for a link with one amount and no named way. */
  way: WayTaken | null;
  /**
   * The check of the place a crossing passes (an obstacle's `through`), when that place has its own: the move's
   * encounter check uses it instead of the one in force here (frame 13, "with the breakwater’s chance").
   */
  throughCheck?: Check | null;
}

/** What the strip offers Move on. */
export interface SceneMover {
  /** Runs the move through the strip's advance; false when it was refused before it was sent (the strip says why). */
  move: (request: MoveRequest) => Promise<boolean>;
  /**
   * The party leaves (B10, p2p-22: Move on's "End expedition" at a Location the pack marks a way out): the expedition
   * ends as the menu's End expedition ends it, its own command, its toast with Undo. False when it didn't end.
   */
  leave: () => Promise<boolean>;
}

// Two contexts, as sceneCard.tsx keeps one: the mover's ref (read at the moment of use) and the check (state, so the
// sheet's words follow the strip as it loads and changes).
const MoverContext = createContext<RefObject<SceneMover | null> | null>(null);
const CheckContext = createContext<{ check: MoveCheck | null; setCheck: (check: MoveCheck | null) => void } | null>(null);

const sameCheck = (a: MoveCheck | null, b: MoveCheck | null) => JSON.stringify(a) === JSON.stringify(b);

export function SceneMoveProvider({ children }: { children: ReactNode }) {
  const moverRef = useRef<SceneMover | null>(null);
  const [check, setCheckNow] = useState<MoveCheck | null>(null);
  const setCheck = useCallback((next: MoveCheck | null) => setCheckNow((was) => (sameCheck(was, next) ? was : next)), []);
  const shared = useMemo(() => ({ check, setCheck }), [check, setCheck]);
  return (
    <MoverContext.Provider value={moverRef}>
      <CheckContext.Provider value={shared}>{children}</CheckContext.Provider>
    </MoverContext.Provider>
  );
}

/**
 * The time strip offers its mover and the check a move asks for now (null mover: it offers none, e.g. on a player's
 * device or the compact strip). Each render's newest functions are offered; the check is shared only when it changes.
 */
export function useSceneMoverListener(mover: SceneMover | null, check: MoveCheck | null): void {
  const moverRef = useContext(MoverContext);
  const setCheck = useContext(CheckContext)?.setCheck;
  useEffect(() => {
    if (!moverRef || !mover) return;
    moverRef.current = mover;
    return () => {
      if (moverRef.current === mover) moverRef.current = null;
    };
  }, [moverRef, mover]);
  useEffect(() => {
    if (setCheck && mover) setCheck(check);
  }, [setCheck, mover, check]);
}

/** The strip's mover now, or null when no strip is listening. Read at the moment of use, never kept. */
export function useSceneMover(): () => SceneMover | null {
  const moverRef = useContext(MoverContext);
  return useCallback(() => moverRef?.current ?? null, [moverRef]);
}

/** The check each move asks for after it, as the strip last said (null: none, or no strip). */
export function useSceneMoveCheck(): MoveCheck | null {
  return useContext(CheckContext)?.check ?? null;
}
