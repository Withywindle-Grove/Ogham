// Hit points in place (ruled 2026-11-08, mockup players/04 C), the one HP box both the Player screen and the full
// sheet's left column draw (plan m5b-sheet-revised A1): the figure at the left (a tap types a value), − and + at the
// right, each tap at once; taps within two seconds fold into one setHp with one Undo toast. With no most recorded,
// a quiet Set max. Someone who may not change the character gets the blocked Sheet saying who may.
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { burstWords, HP_BURST_MS, hpLine, readHpInput, setHp, shownHp, stepHp } from '../modules/characters/hp.ts';
import { hpSegments } from '../modules/characters/play.ts';
import { HP_MAX_FIELD, requestSheetChange } from '../modules/characters/sheetChanges.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { HpBox } from '../ui/HpBox.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';
import { whoMayChange } from './whoMayChange.ts';
import { possessive } from '../core/nameWords.ts';

export type HpCharacter = CharacterRef & { name: string; hpCurrent: number | null; hpMax: number | null };

export function HpInPlace({
  db,
  user,
  character,
  downAt,
  onSaved,
  onMaxSaved,
  onShown,
}: {
  db: Db;
  user: CurrentUser;
  character: HpCharacter;
  /** The HP at which the rules set marks a character Down (`downAtOf`); null: the toast never says Down. */
  downAt: number | null;
  onSaved?: () => void;
  /** The figure the box shows, each time it moves (a tap, a burst, an Undo, a read): the head's Down ring follows it. */
  onShown?: (hp: number | null) => void;
  /** The most hit points were set ("Set max", N24), so the character is read again. */
  onMaxSaved?: () => void;
}) {
  const toast = useToast();
  const [hp, setHpShown] = useState<number | null>(() => shownHp(character.hpCurrent, character.hpMax));
  const [open, setOpen] = useState<'type' | 'max' | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = character.hpMax;

  async function save(next: number) {
    const before = hp;
    shownRef.current = next;
    setHpShown(next);
    setBusy(true);
    setError(null);
    const result = await sending(runCommand(registry, db, user, setHp, { character, hpCurrent: next }));
    setBusy(false);
    if (!result.ok) {
      shownRef.current = before;
      setHpShown(before);
      setError(result.message);
      return false;
    }
    onSaved?.();
    return true;
  }

  // The burst (ruled 2026-11-08): − and + change the figure at once; two seconds after the last tap the burst's total
  // goes as one setHp, so the log has one line and the toast one Undo. The figure shown lives in a ref too, so a tap
  // reads the latest one before React draws it.
  const blocked = useBlockedSheet();
  const mayChange = registry.can(user, setHp.name, character);
  const shownRef = useRef(hp);
  const burstRef = useRef<{ start: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  // Writes on their way (fix-hp-remount-race): while one is, the figure shown is newer than the character passed in.
  const outRef = useRef(0);
  function sending<T>(work: Promise<T>): Promise<T> {
    outRef.current += 1;
    return work.finally(() => {
      outRef.current -= 1;
    });
  }

  /** Sends a burst's total: one setHp from where it started to where it is now. Undo after this sends it back. */
  async function send(start: number, now: number): Promise<boolean> {
    if (now === start) return true;
    const result = await sending(runCommand(registry, db, user, setHp, { character, hpCurrent: now }));
    if (!result.ok) {
      toast({ text: result.message, error: true });
      return false;
    }
    onSaved?.();
    return true;
  }

  /** Sends the burst still waiting, at once (before typing a value, or when the box goes away). */
  function flush(): Promise<boolean> {
    const pending = burstRef.current;
    if (!pending) return Promise.resolve(true);
    clearTimeout(pending.timer);
    burstRef.current = null;
    const now = shownRef.current ?? pending.start;
    return send(pending.start, now).then((sent) => {
      if (!sent) {
        shownRef.current = pending.start;
        setHpShown(pending.start);
      }
      return sent;
    });
  }
  function step(by: 1 | -1) {
    if (!mayChange) return blocked.explain(by < 0 ? 'Take damage' : 'Heal', whoMayChange(user, character, `${possessive(character.name)} hit points`));
    const current = shownRef.current;
    if (current === null) return;
    const next = stepHp(current, max, by);
    const pending = burstRef.current;
    const start = pending?.start ?? current;
    const text = burstWords({ name: character.name, start, now: next, max, downAt, step: by });
    if (next === current && !pending) return toast({ text });
    if (pending) clearTimeout(pending.timer);
    shownRef.current = next;
    setHpShown(next);
    const mine = { start, timer: setTimeout(() => void flush(), HP_BURST_MS) };
    burstRef.current = mine;
    // Undo: still waiting, the burst is dropped and nothing is sent; once sent, the figure goes back in one change.
    const undo = () => {
      if (burstRef.current === mine) {
        clearTimeout(mine.timer);
        burstRef.current = null;
        shownRef.current = start;
        setHpShown(start);
        return;
      }
      shownRef.current = start;
      setHpShown(start);
      void sending(runCommand(registry, db, user, setHp, { character, hpCurrent: start })).then((result) => (result.ok ? onSaved?.() : toast({ text: result.message, error: true })));
    };
    toast(next === start ? { text } : { text, onUndo: undo });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const typedValue = readHpInput(typed);
    if (typedValue === null) return setError('Type a whole number, like 7 or -2.');
    if (await save(typedValue)) setOpen(null);
  }

  // "Set max" (N24): the most hit points, a whole number of at least 1, saved on the character.
  async function submitMax(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const most = readHpInput(typed);
    if (most === null || most < 1) return setError('Type a whole number of at least 1, like 8.');
    setBusy(true);
    setError(null);
    // Once approved, a player's Max HP waits for the GM like any Max HP change, the first one too (Design on #567, ⚑ 3).
    const asks = !isGm(user, character.campaignId) && character.approval === 'approved';
    const result = asks
      ? await runCommand(registry, db, user, requestSheetChange, { character, field: HP_MAX_FIELD, label: 'Max HP', to: most })
      : await runCommand(registry, db, user, editCharacter, { character, changes: { hpMax: most } });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setOpen(null);
    if (asks) toast({ text: `Sent to your GM: Max HP ${most}.` });
    onSaved?.();
    onMaxSaved?.();
  }

  const openMax = () => {
    setTyped('');
    setError(null);
    setOpen('max');
  };

  // The figure's tap: a small Sheet to type a value, after sending any burst still waiting.
  const openType = async () => {
    if (!mayChange) return blocked.explain('Hit points', whoMayChange(user, character, `${possessive(character.name)} hit points`));
    if (busy) return;
    await flush();
    setTyped(shownRef.current === null ? '' : String(shownRef.current));
    setError(null);
    setOpen('type');
  };

  // The box stays drawn across a reload (fix-hp-remount-race): each time the character is read again (a new object: a
  // save landing, an undo from the log, the GM's change) its figure shows, even when the number read is the one read
  // before, unless a burst is waiting or a write is on its way; then the figure on screen is newer than the one passed
  // in, and a tap must start from it.
  const given = shownHp(character.hpCurrent, character.hpMax);
  const takeGiven = useEffectEvent((next: number | null) => {
    if (burstRef.current || outRef.current > 0 || shownRef.current === next) return;
    shownRef.current = next;
    setHpShown(next);
  });

  // Leaving the screen mid-burst still sends it. The effects come after every handler that changes the burst's refs
  // (the React compiler's rule: no change to a value after an effect reads it).
  const flushOnLeave = useEffectEvent(() => void flush());
  useEffect(() => () => flushOnLeave(), []);
  useEffect(() => takeGiven(given), [given, character]);
  const tellShown = useEffectEvent((shown: number | null) => onShown?.(shown));
  useEffect(() => tellShown(hp), [hp]);

  return (
    <>
      {blocked.sheet}
      <HpBox
        hp={hp}
        max={max}
        fills={hpSegments(hp, max).fills}
        figureLabel={hp === null ? 'Hit points not set yet. Type them' : `Hit points ${hpLine(hp, max)}. Type a value`}
        onFigure={() => void openType()}
        onStep={step}
      />
      {/* No most recorded (N24): the number alone, no bar, and a quiet way to set it. */}
      {hp !== null && max === null && (
        <button type="button" className="button-secondary button-secondary--small vitals__set-max" onClick={openMax}>
          Set max
        </button>
      )}
      {open === 'type' && (
        <Dialog label="Hit points" onClose={() => setOpen(null)}>
          <form className="hp__keypad hp__keypad--fit" onSubmit={(event) => void submit(event)} noValidate>
            <label className="label" htmlFor="hp-typed">
              {max === null ? 'Current HP' : `Current HP (max ${max})`}
            </label>
            <input id="hp-typed" className="field__input hp__input" type="number" step={1} value={typed} onChange={(event) => setTyped(event.target.value)} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <HpFoot onCancel={() => setOpen(null)} />
          </form>
        </Dialog>
      )}
      {open === 'max' && (
        <Dialog label="Max hit points" onClose={() => setOpen(null)}>
          <form className="hp__keypad hp__keypad--fit" onSubmit={(event) => void submitMax(event)} noValidate>
            <label className="label" htmlFor="hp-max-typed">
              Max HP
            </label>
            <input id="hp-max-typed" className="field__input hp__input" type="number" step={1} min={1} value={typed} onChange={(event) => setTyped(event.target.value)} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <HpFoot onCancel={() => setOpen(null)} />
          </form>
        </Dialog>
      )}
      {error && open === null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** The foot of the two small hit points pop-ups (Hit points, Max hit points): the pop-up's standard foot, the group at
 *  the right (ft-1, `.dialog__actions`), the accent first as no drawing settles the order; Set and Cancel one height
 *  in their row (p2p-16, 2026-11-18; `.hp__foot` in PlayerScreen.css). In the fitted form (`.hp__keypad--fit`) it sits
 *  directly under the number box, as wide as the box (tf-A2, Francis on the built picture, 19 Nov). */
function HpFoot({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="dialog__actions hp__foot">
      <button type="submit" className="button-primary">
        Set
      </button>
      <button type="button" className="button-secondary button-secondary--small" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
