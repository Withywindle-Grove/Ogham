// The GM's view as the player (tfg-1; page 32, M3c to M3k, approved 2026-11-21): whose view the hosted Player screen
// is showing. Present only inside the view, so the Player screen and the parts it hosts can tell the GM's look at a
// character from its player's own screen (the band, the tab memory, what the tabs show by role, pg32-3; the player-only
// pop-ups, pg32-6).
import { createContext, useContext } from 'react';
import { isGm, type CurrentUser } from '../core/commands.ts';

/** Where "Go to Waiting for you" opens (pg32-5, pg32-6): at a request, at a sheet change, or at its top. */
export type WaitingTarget = { request: string } | { change: string } | null;

export interface PlayerView {
  /** The character's player's name ("Sam"); null for the GM's own character ("Your view of Ash", pg32-7c). */
  player: string | null;
  /** The character's name ("Wren"). */
  character: string;
  /** "Go to Waiting for you" (pg32-6): leaves the view for Players, Waiting for you open at the target. */
  goToWaiting?: (at: WaitingTarget) => void;
}

export const PlayerViewContext = createContext<PlayerView | null>(null);

/** Whose view the screen shows, or null on a player's own screen. */
export function usePlayerView(): PlayerView | null {
  return useContext(PlayerViewContext);
}

/**
 * Whether this screen shows what the GM sees (hidden figures, secret timers, GM-only lines): the GM, but not inside
 * the view, which shows the player's numbers exactly (pg32-3, X). Only what is shown: the GM's acts in the view still
 * run as his, through `can()`.
 */
export function useSeesAsGm(user: CurrentUser, campaignId: string): boolean {
  const view = usePlayerView();
  return isGm(user, campaignId) && view === null;
}
