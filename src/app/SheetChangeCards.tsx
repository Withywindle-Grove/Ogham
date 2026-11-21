// The GM's side of a sheet change (plan m5b-sheet-revised B6): under Players' "Waiting for approval", one card per
// change a player asked for ("Wren asks: Muscle 16 → 17", who and when), with Approve and Refuse as for a new
// character. Approve writes the figure onto the character (sheet.approveChange, logged); Refuse asks for a reason
// (optional) that the player's line then shows (sheet.refuseChange, logged). Both toast here; the player's sheet
// toasts when the answer reaches it.
import { useState, type FormEvent } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { approveSheetChange, changeWords, refuseSheetChange, type SheetChange } from '../modules/characters/sheetChanges.ts';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';
import { whenWords } from './SheetParts.tsx';

/** One change waiting: the character's and player's names come from the Players list. */
export interface WaitingChange {
  change: SheetChange;
  character: string;
  player: string;
}

export function SheetChangeCard({ db, user, waiting, onAnswered }: { db: Db; user: CurrentUser; waiting: WaitingChange; onAnswered: () => void }) {
  const { change, character, player } = waiting;
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, approveSheetChange, { change });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    toast({ text: `Approved: ${character}'s ${change.label} is ${change.to}.` });
    onAnswered();
  }

  async function refuse(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, refuseSheetChange, { change, reason });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    toast({ text: `Refused: ${character}'s ${change.label} stays ${change.from ?? 'as it was'}.` });
    onAnswered();
  }

  return (
    <div className="gm__approval" role="group" aria-label={`Sheet change waiting: ${character}, ${changeWords(change)}`}>
      <p className="gm__row-name">{`${character} asks: ${changeWords(change)}`}</p>
      <p className="gm__meta">{`From ${player}, sent ${whenWords(change.createdAt)}`}</p>
      {refusing ? (
        <form className="gm__approval-form" onSubmit={(event) => void refuse(event)} noValidate>
          <div className="field">
            <label className="label" htmlFor={`refuse-${change.id}`}>
              Why (optional, {player} sees it)
            </label>
            <input
              id={`refuse-${change.id}`}
              className="field__input"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(event) => {
                if (busy) return;
                setReason(event.target.value);
              }}
            />
          </div>
          <div className="gm__actions">
            <button type="submit" className="button-secondary" aria-busy={busy}>
              {busy ? 'Refusing…' : 'Refuse'}
            </button>
            <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => setRefusing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="gm__actions">
          <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void approve()}>
            {busy ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" className="button-secondary" aria-busy={busy} onClick={() => setRefusing(true)}>
            Refuse
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
