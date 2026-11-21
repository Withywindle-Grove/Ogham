// "Give to a player…" (page 13 of the December mockups, frames G1 to G5 and P1 to P3; approved by Francis 2026-11-13
// with the lead's fix gp-5): a small plain button on a character's row of the GM's Players page, and the sheet it opens
// (the app's own Dialog until the redesign's panel exists). The sheet lists the campaign's players as option rows, each
// with the character they play; for a character a player has, a line with the tick names them ("Sam has Wren now.")
// and "You, the GM" leads the list. A tap gives at once (character.reassign): the sheet shuts and the toast says so,
// with Undo (the log's own, by this give's line). No players: the page's own words and "Invite a player".
import { useState } from 'react';
import { RETIRED, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Player } from '../core/gmCampaign.ts';
import type { Db } from '../core/supabase.ts';
import { undoChange } from '../core/undo.ts';
import { reassignCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { giveEventId, giveSheet, givenWords, notGivenWords, stillAPlayer, type GiveCandidate } from '../modules/characters/giving.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { OptionRow } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';
import './GiveCharacter.css';

/** The players as the sheet lists them: the character each plays now, else their first approved one. */
export function candidatesOf(players: readonly Player[]): GiveCandidate[] {
  return players.map((p) => {
    const current = p.characters.filter((c) => !c.archived && c.approval === 'approved');
    const plays = current.find((c) => c.active) ?? current[0];
    return { userId: p.userId, name: p.name, plays: plays?.name ?? null };
  });
}

export function GiveCharacter({
  db,
  user,
  character,
  players,
  onChanged,
  onInvite,
}: {
  db: Db;
  user: CurrentUser;
  character: CharacterRef & { name: string };
  players: readonly Player[];
  /** After a give or its Undo: the page reads again. */
  onChanged: () => void;
  /** No players yet: "Invite a player" opens today's invite. */
  onInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const show = useToast();
  const sheet = giveSheet(character, candidatesOf(players));

  const undo = async (requestId: string) => {
    const eventId = await giveEventId(db, character.campaignId, character.id, requestId);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: character.campaignId, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  async function give(to: { userId: string; name: string } | null) {
    if (busy) return;
    setBusy(true);
    // The give's own request id: its toast's Undo finds this give's line by it, never a newer give from another tab.
    const requestId = crypto.randomUUID();
    const result = await runCommand(
      registry,
      db,
      user,
      reassignCharacter,
      { character, to: to ? { userId: to.userId, role: 'player' } : { userId: null, role: null } },
      { requestId },
    );
    setBusy(false);
    setOpen(false);
    onChanged();
    if (!result.ok) {
      // Frame G5's words only when the target really is no longer a player of the campaign; any other refusal (the
      // character changed meanwhile, a retired campaign) says the command's own words.
      const left = to && result.reason === 'not-allowed' && result.message !== RETIRED && (await stillAPlayer(db, character.campaignId, to.userId)) === false;
      show({ text: left ? notGivenWords(character.name, to.name) : result.message, error: true });
      return;
    }
    show({ text: givenWords(character.name, to?.name ?? null), onUndo: () => void undo(requestId) });
  }

  const empty = players.length === 0;
  return (
    <>
      <button type="button" className="button-secondary button-secondary--small" aria-label={`Give ${character.name} to a player`} onClick={() => setOpen(true)}>
        Give to a player…
      </button>
      {open && (
        <Dialog label="Give to a player" over={character.name} onClose={() => setOpen(false)}>
          {sheet.hasLine && (
            <p className="give__has">
              <Icon name="tick" size={20} />
              <span>{sheet.hasLine}</span>
            </p>
          )}
          {empty && !sheet.gmRow ? (
            <div className="give__empty">
              <p className="gm__meta">No players yet. Invite someone to get started.</p>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setOpen(false);
                  onInvite();
                }}
              >
                Invite a player
              </button>
            </div>
          ) : (
            <div className="give__rows" role="radiogroup" aria-label="Players">
              {sheet.gmRow && <OptionRow name="You, the GM" summary="" label={`Give ${character.name} back to you, the GM`} onPick={() => void give(null)} />}
              {sheet.rows.map((row) => (
                <OptionRow key={row.userId} name={row.name} summary={row.summary} label={`Give ${character.name} to ${row.name}, ${row.summary}`} onPick={() => void give(row)} />
              ))}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
