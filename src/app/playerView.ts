// The GM's view as the player (tfg-1; page 32, M3c to M3k, approved 2026-11-21): whose view the hosted Player screen
// is showing. Present only inside the view, so the Player screen and the parts it hosts can tell the GM's look at a
// character from its player's own screen (the band, the tab memory; what the tabs show by role comes in later rows).
import { createContext, useContext } from 'react';

export interface PlayerView {
  /** The character's player's name ("Sam"); null for the GM's own character ("Your view of Ash", pg32-7c). */
  player: string | null;
  /** The character's name ("Wren"). */
  character: string;
}

export const PlayerViewContext = createContext<PlayerView | null>(null);

/** Whose view the screen shows, or null on a player's own screen. */
export function usePlayerView(): PlayerView | null {
  return useContext(PlayerViewContext);
}
