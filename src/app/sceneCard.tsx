// The GM's check card from elsewhere on Scene (M5b step 1 follow-up, build order 8; ruled 2026-10-30, D9): a Move…
// on the travel card that sets off a check (alsoWhen) puts its Hit / Miss line on the time strip's card, where every
// other check is rolled; the move's Undo takes the lines off again. The time strip (SceneTime) listens; the travel
// card sends. Without a listener (a players' screen, a test with the card alone) nothing is sent and the caller says
// so in its toast instead.
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { CardLine } from '../modules/expedition/card.ts';

/** Lines to add to the card, or the keys of lines to take off it. */
export type CardChange = { add: CardLine[] } | { remove: string[] };
type Listener = (change: CardChange) => void;

const Context = createContext<RefObject<Listener | null> | null>(null);

export function SceneCardProvider({ children }: { children: ReactNode }) {
  const listenerRef = useRef<Listener | null>(null);
  return <Context.Provider value={listenerRef}>{children}</Context.Provider>;
}

/** The time strip takes changes sent to its card (null: it takes none, e.g. on a player's device). */
export function useSceneCardListener(take: Listener | null): void {
  const listenerRef = useContext(Context);
  useEffect(() => {
    if (!listenerRef || !take) return;
    listenerRef.current = take;
    return () => {
      if (listenerRef.current === take) listenerRef.current = null;
    };
  }, [listenerRef, take]);
}

/** Sends a change to the time strip's card; false when no card is listening (or there's nothing to send). */
export function useSendToSceneCard(): (change: CardChange) => boolean {
  const listenerRef = useContext(Context);
  return useCallback(
    (change: CardChange) => {
      if (!listenerRef?.current) return false;
      if ('add' in change ? change.add.length === 0 : change.remove.length === 0) return false;
      listenerRef.current(change);
      return true;
    },
    [listenerRef],
  );
}
