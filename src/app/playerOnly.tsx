// The player-only actions in the GM's view as the player (tfg-5, d5-21, pg32-5, pg32-6; page 32, M3f, M3f2, M3i, M3j,
// approved 2026-11-21). In the view each such button stays as the player sees it (never disabled, hard rule 7); a tap
// opens a pop-up to read, "Only Sam can …", its one line, then "Got it". The three that point to Waiting for you carry
// "Go to Waiting for you" before "Got it". Nothing is logged: nothing happened. On the GM's own character none opens.
// M3f2's words, word for word, but one: taking back a sheet change names Waiting for approval, where its "Go to Waiting
// for you" lands (⚑ 51, ruled (a) 2026-11-22). The ninth ("New" on a find) has no button and so no pop-up.
import { useState, type ReactNode } from 'react';
import { BlockedSheet } from '../ui/BlockedSheet.tsx';
import { usePlayerView, type WaitingTarget } from './playerView.ts';

export type PlayerOnlyAct = 'askChange' | 'sendRequest' | 'takeBackRequest' | 'chooseCharacter' | 'takeBackChange' | 'answerOffer' | 'stayHere' | 'undoPurchase';

/** A pop-up's title and line, and whether it points to Waiting for you (M3f2). */
export function playerOnlyWords(act: PlayerOnlyAct, player: string, character: string): { title: string; why: string; toWaiting: boolean } {
  switch (act) {
    case 'askChange':
      return { title: `Only ${player} can ask for a change`, why: `A change ${player} asks for comes to you to approve. To change ${character}’s sheet yourself, use Edit in ⋯ on Players.`, toWaiting: false };
    case 'sendRequest':
      return { title: `Only ${player} can send this request`, why: `A request goes from ${player} to you. When ${player} sends it, it waits for you in Waiting for you.`, toWaiting: true };
    case 'takeBackRequest':
      return { title: `Only ${player} can take back this request`, why: 'You can answer it instead: it waits for you in Waiting for you.', toWaiting: true };
    case 'chooseCharacter':
      return { title: `Only ${player} can choose who they play`, why: `${player} picks from Your characters on their own screen.`, toWaiting: false };
    case 'takeBackChange':
      return { title: `Only ${player} can take back this change`, why: `${player} asked you for it. You can answer it instead: Approve or Refuse it in Waiting for approval.`, toWaiting: true };
    case 'answerOffer':
      return { title: `Only ${player} can answer your offer`, why: `${player} accepts or declines it on their own screen.`, toWaiting: false };
    case 'stayHere':
      return { title: `Only ${player} can choose where ${character} stays`, why: `${player} picks a lodging on their own screen.`, toWaiting: false };
    case 'undoPurchase':
      return { title: `Only ${player} can undo this purchase`, why: `The purchase was ${player}’s, so its Undo is too.`, toWaiting: false };
  }
}

/**
 * A screen's player-only pop-up: `blocked(act, at)` opens it and says true inside the GM's view of a player's character
 * (the caller then does nothing else), and says false anywhere else, the GM's own character included (pg32-7c), so the
 * button acts as it always has. `at` is where "Go to Waiting for you" opens. Render `sheet` once in the screen.
 */
export function usePlayerOnly(): { sheet: ReactNode; blocked: (act: PlayerOnlyAct, at?: WaitingTarget) => boolean } {
  const view = usePlayerView();
  const [open, setOpen] = useState<{ act: PlayerOnlyAct; at: WaitingTarget } | null>(null);
  const words = open && view?.player ? playerOnlyWords(open.act, view.player, view.character) : null;
  const goTo = view?.goToWaiting;
  const sheet =
    open && words ? (
      <BlockedSheet
        title={words.title}
        why={words.why}
        reading
        onClose={() => setOpen(null)}
        action={
          words.toWaiting && goTo ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setOpen(null);
                goTo(open.at);
              }}
            >
              Go to Waiting for you
            </button>
          ) : undefined
        }
      />
    ) : null;
  return {
    sheet,
    blocked: (act, at = null) => {
      if (!view?.player) return false;
      setOpen({ act, at });
      return true;
    },
  };
}
