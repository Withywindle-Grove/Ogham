// The party stash as a screen of its own, for players (K11; pk-4, docs/design/rulings/pack-rework-rulings-2026-11-11.md;
// mockup pack/08, frames PK4, PK6, PK7b, PK9b, approved 2026-11-14, ap-6 and ap-7). Opened from the Pack's "Party stash"
// row; the bar names it and its way back returns to the pack. Three facts, each with who and when (what is in it, the
// last thing in, the last thing out); the lists, every row saying who put the thing in and when; the foot, the count
// and "Put in". Beside the lists on a tablet (under them on a phone): "You are taking for" (only for a player with more
// than one character), the taker's room, and the stash's recent lines, your own keeping Undo while it can be undone.
// No accent: nothing here is the one next step. Who and when are read from the log (K14, `stashHistory.ts`).
// The coin row first (K13, `coin`): the stash's coin line, opening "Party stash's coin" (`PurseSheet`).
// Take (K12; pk-2, pk-3; frames PK4b and PK7b, approved 2026-11-14, ap-6): every row ends in Take. A single thing goes
// on the tap (the screen that owns the pack writes it and shows the toast, with Undo and the taker's load); a stack
// opens the sheet "Take": the thing, what the stash has, a box, and one accent naming the amount; a refusal is words
// under the row and the button stays a button. Offline, Take stays a button and a tap opens the blocked-action pop-up
// saying why it waits (⚑ 7, re-ruled "A" 25 Nov: `BlockedSheet`, not PK7b's box on a phone); so does the Take sheet's
// accent when the network drops while it is open (26 Nov).
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { undoChange } from '../core/undo.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import { loadClockNow } from '../modules/expedition/lightPlay.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { loadStashHistory, whoWords, type StashHistory, type StashMove } from '../modules/inventory/stashHistory.ts';
import { shownName } from '../modules/inventory/packView.ts';
import { asksHowMany, readTake, TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY, takeLabel, takeRefusal } from '../modules/inventory/stashTake.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, StackedButton, WarningLine, WarningSign } from '../ui/parts.tsx';
import { useOnline } from '../ui/creation.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { itemCount } from './packHelpers.ts';
import { factWords, putInWords, recentWhen, recentWords, thingCount, thingWords } from './stashWords.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';
import './PackScreen.css';
import './PurseSheet.css';

/** How many of the stash's recent lines show (PK4 draws three, PK9b four). */
const RECENT = 4;

/**
 * A stack's "Take" sheet (PK4b): the thing named once, what the stash has under it, a box (a quiet 0 until typed), and
 * one accent naming the amount. The Coin sheet's row and box (`.purse-sheet__row`), for a thing.
 */
function TakeSheet({ line, onClose, onTake }: { line: InventoryLine; onClose: () => void; onTake: (qty: number) => void }) {
  const box = useId();
  const [typed, setTyped] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const online = useOnline();
  // Offline (the network dropped while the sheet was open) the accent stays a button and opens the same blocked-action
  // pop-up as a row's Take, over this sheet; nothing is written (Home Two's audit of #66, finding 1, 26 Nov).
  const blocked = useBlockedSheet();
  const name = shownName(line.name);
  function take() {
    if (!online) return blocked.explain(TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY);
    const n = readTake(typed, line.qty);
    if (n === null) return setRefusal(takeRefusal(typed, line.qty));
    onTake(n);
  }
  return (
    <Dialog label="Take" onClose={onClose}>
      <div className="purse-sheet__rows" role="group" aria-label="How many">
        <div className="purse-sheet__row">
          <span className="purse-sheet__coin">
            <label className="purse-sheet__name" htmlFor={box}>
              {name}
            </label>
            <span className="purse-sheet__has" id={`${box}-has`}>{`The stash has ${line.qty.toLocaleString('en')}.`}</span>
          </span>
          <input
            id={box}
            className="field__input purse-sheet__box"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-describedby={`${box}-has`}
            aria-invalid={refusal !== null || undefined}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setRefusal(null);
            }}
          />
        </div>
        {refusal && (
          <p className="purse-sheet__refusal" role="alert">
            <WarningLine>{refusal}</WarningLine>
          </p>
        )}
      </div>
      <div className="dialog__actions purse-sheet__foot">
        <StackedButton variant="primary" icon="grab" label={takeLabel(line, typed, line.qty)} className="purse-sheet__go" onClick={take} />
      </div>
      {blocked.sheet}
    </Dialog>
  );
}

export function StashScreen({
  db,
  user,
  campaign,
  stash,
  lines,
  allLines,
  carriers,
  setting,
  takers,
  takerId,
  onTaker,
  room,
  list,
  coin = null,
  onTake,
  onPutIn,
  side,
  version,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  stash: NamedCarrier;
  /** What is in the stash now. */
  lines: InventoryLine[];
  /** Every line the reader may read (a thing taken out is named from where it is now). */
  allLines: InventoryLine[];
  /** The campaign's approved characters and the stash (names for who did it). */
  carriers: NamedCarrier[];
  setting: CampaignSetting;
  /** The reader's own characters who may take (more than one shows "You are taking for"). */
  takers: NamedCarrier[];
  takerId: string | null;
  onTaker: (actorId: string) => void;
  /** The taker's load, under "<Name>'s room" (the Pack's own load summary). */
  room: ReactNode;
  /** The stash's lists, given each row's who-and-when line and its end (Take, K12). */
  list: (rowNote: (line: InventoryLine) => string | null, rowEnd: (line: InventoryLine) => ReactNode) => ReactNode;
  /** Take this many of a line for the taker (K12): the owner of the pack writes it, then shows the toast. */
  onTake: (line: InventoryLine, qty: number) => void;
  /** The coin row, first above the lists (K13). */
  coin?: ReactNode;
  onPutIn: () => void;
  /** On a landscape tablet, the right-hand column: the taker's room and the recent lines go there. */
  side: HTMLElement | null;
  /** Bumped when the pack reloads, so the history is read again. */
  version: number;
  /** Something was undone here. */
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<StashHistory | null>(null);
  const [again, setAgain] = useState(0);
  // The stack whose "Take" sheet is open (PK4b).
  const [asking, setAsking] = useState<InventoryLine | null>(null);
  const online = useOnline();
  const show = useToast();
  // Offline, Take's why opens under the button on a tablet, from the foot on a phone (⚑ 7, re-ruled "A" 25 Nov).
  const blocked = useBlockedSheet();
  const lineIds = lines.map((l) => l.id).join(',');

  useEffect(() => {
    let live = true;
    void Promise.all([loadClockNow(db, campaign.id), loadCampaignSettings(db, campaign.id)])
      .then(([seconds, settings]) =>
        loadStashHistory(db, campaign.id, {
          stashId: stash.locationId!,
          lineIds: lineIds ? lineIds.split(',') : [],
          clock: seconds === null ? null : { seconds, units: campaignUnits(settings, setting.rulesSets) },
          now: new Date().toISOString(),
        }),
      )
      .then(
        (found) => live && found && setHistory(found),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [db, campaign.id, stash.locationId, lineIds, setting.rulesSets, version, again]);

  const names = new Map(carriers.flatMap((c) => (c.actorId ? [[c.actorId, c.name] as const] : [])));
  /** Who did it: "Your GM", the character, or, for a line a player made straight on the stash, their one character. */
  const who = (move: StashMove): string | null => {
    const said = whoWords(move.who, names);
    if (said || move.who.gm || !move.userId) return said;
    const theirs = carriers.filter((c) => c.actorId && c.ownerUserId === move.userId);
    return theirs.length === 1 ? theirs[0]!.name : null;
  };
  /** The thing a move moved: the log's copy of it, else the line wherever it is now; null when neither says. */
  const thing = (move: StashMove): string | null => {
    const line = allLines.find((l) => l.id === move.lineId);
    if (!line && !move.name) return null;
    return thingWords(line ?? { name: move.name!, details: {} }, move.qty ?? line?.qty ?? 1);
  };
  const fact = (label: string, move: StashMove | null) => {
    const named = move && thing(move);
    if (!move || !named) return null;
    return (
      <p className="stash__fact">
        <span className="stash__fact-label">{label}</span> {factWords(named, who(move), move)}
      </p>
    );
  };
  const rowNote = (line: InventoryLine) => {
    const move = history?.rows.get(line.id);
    return move ? putInWords(line, who(move), move) : null;
  };
  const recent = (history?.moves ?? [])
    .slice()
    .reverse()
    .flatMap((move) => {
      const named = thing(move);
      const words = named ? recentWords(move, who(move), named) : null;
      return words ? [{ move, words }] : [];
    })
    .slice(0, RECENT);

  async function undo(move: StashMove) {
    const done = await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId: move.eventId, authorUserId: user.id });
    if (!done.ok) return show({ text: done.message, error: true });
    setAgain((n) => n + 1);
    onChanged();
  }

  /** Every row ends in Take (pk-3): offline it explains; a stack asks how many; a single thing goes at once. */
  const takeEnd = (line: InventoryLine) => (
    <StackedButton
      icon="grab"
      label="Take"
      aria-label={`Take ${line.name}`}
      aria-haspopup={online && asksHowMany(line) ? 'dialog' : undefined}
      onClick={() => {
        if (!online) return blocked.explain(TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY);
        if (asksHowMany(line)) return setAsking(line);
        onTake(line, 1);
      }}
    />
  );

  const taker = takers.find((t) => t.actorId === takerId) ?? takers[0] ?? null;
  const beside = (
    <div className="stash__beside">
      {takers.length > 1 && (
        // "You are taking for" (PK9b): a chip a character, the chosen one pressed; the room under it follows.
        <div className="stash__takers" role="group" aria-label="You are taking for">
          <span>You are taking for</span>
          {takers.map((t) => (
            <Chip key={t.actorId} pressed={t.actorId === taker?.actorId} onClick={() => onTaker(t.actorId!)}>
              {t.name}
            </Chip>
          ))}
        </div>
      )}
      {taker && (
        <section className="stash__room" aria-label={`${taker.name}’s room`}>
          <h2 className="stash__head">{`${taker.name}’s room`}</h2>
          {room}
        </section>
      )}
      {recent.length > 0 && (
        <section className="stash__recent" aria-label="Recently">
          <h2 className="stash__head">Recently</h2>
          <ul className="stash__recent-lines">
            {recent.map(({ move, words }) => (
              <li key={move.eventId} className="stash__recent-line">
                <span className="stash__recent-words">
                  <span>{words}</span>
                  <span className="auth__meta">{recentWhen(move)}</span>
                </span>
                {/* Your own line keeps Undo while it can be undone (PK9b): by the log's own rule (`mayUndo`), a give or a
                    take may, a Put in may not; the database still says when the thing has moved on since. The turned-back
                    arrow above the word (ic-2; ⚑ 4, ruled 24 Nov). */}
                {move.userId === user.id && move.undoable && (
                  <StackedButton icon="anticlockwise-rotation" label="Undo" className="stash__undo" aria-label={`Undo: ${words}`} onClick={() => void undo(move)} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  return (
    <section className="pack stash" aria-label="Party stash">
      {!online && (
        // Offline (PK7b): the word with the warning sign at the top, and the stash shown as last read, said once.
        <>
          <p className="stash__offline">
            <WarningSign /> Offline
          </p>
          <p>As it was when you were last online.</p>
        </>
      )}
      {lines.length > 0 && (
        <div className="stash__facts">
          <p className="stash__fact">
            <span className="stash__fact-label">In it.</span> {`${thingCount(lines.length)}.`}
          </p>
          {fact('Last in.', history?.lastIn ?? null)}
          {fact('Last out.', history?.lastOut ?? null)}
        </div>
      )}
      {coin}
      {lines.length > 0 ? list(rowNote, takeEnd) : <p className="stash__empty">Nothing in the Party stash yet.</p>}
      <div className="pack__foot">
        <span className="auth__meta">{itemCount(lines.length)}</span>
        <StackedButton icon="open-chest" label="Put in" onClick={onPutIn} />
      </div>
      {side ? createPortal(beside, side) : beside}
      {asking && (
        <TakeSheet
          line={asking}
          onClose={() => setAsking(null)}
          onTake={(qty) => {
            setAsking(null);
            onTake(asking, qty);
          }}
        />
      )}
      {blocked.sheet}
    </section>
  );
}
