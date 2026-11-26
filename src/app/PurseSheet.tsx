// The coin's sheets on the Pack tab (K10; December step 6, piece c; rulings pu-2, pu-4, pu-5, pu-8; mockup pack/07
// frames PC3, PC4 and PC5, approved by Francis 2026-11-13). One sheet at a time (psw-6), opened from the coin line:
//   "<Name>'s coin": every coin the setting names, a 0 shown as 0 (and any coin held under a key it doesn't list, as
//     written, pu-6), then the rows Spend… and Give to…, with no sentence under them.
//   "Spend" and "Give to": the way back to the coin's sheet at the top; a row a coin with what the character has under
//     it and a box for how much (a quiet 0 until typed); Spend's "What for" ("If you like"); Give's Party and People
//     (names only: no player reads another's purse); one accent naming the amount ("Spend 2 herons", "Give Moss 5
//     herons", "Put in 10 herons"). A refusal is words with the warning sign under the coin's row; the button stays a
//     button. Done: the sheet shuts and a toast says it in the log line's words, with Undo.
// The GM (K15; pu-3, pu-8; frames PC7 and PC8, approved 2026-11-13) opens the same sheet on a character's Pack, with
// the GM's two acts in place of the player's: "Give coin…" (purse.add: "Give Wren 40 herons") and "Take coin…"
// (purse.remove, out of play: "Take 10 herons"), on the same rows, box, refusal and accent.
// The Party stash's coin (K13; pu-3, pu-5; frames PC6 and PC6b, approved 2026-11-13): the same sheet, "Party stash's
// coin", opened from the stash's own coin row; for a player one row leads on, "Take…", to "Take coin": "The stash has
// 40." under each coin, one accent naming the amount ("Take 10 herons"), the refusal "The stash has 40 herons.", and
// the toast "Wren took 10 herons from the stash" with Undo (purse.take, into the taker's own coin). Offline, Take… stays
// a row and a tap says why it waits. Coin goes in by "Give to…" from a player's own coin (PC5).
// Only the character's own player and the GM open these (the Pack shows the coin line to them alone); the commands
// and the database check again (src/modules/inventory/purse.ts).
import { useId, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { amountWords, coinLine, type Denomination } from '../modules/inventory/coinWords.ts';
import type { NamedCarrier } from '../modules/inventory/inventory.ts';
import { addCoin, AMOUNT, giveCoin, removeCoin, spendCoin, takeCoin, type CoinNames, type Coins } from '../modules/inventory/purse.ts';
import { TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY } from '../modules/inventory/stashTake.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { useOnline } from '../ui/creation.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { DestinationList, ListRow, RowList, StackedButton, WarningLine } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { registry } from './services.ts';
import './PurseSheet.css';

/** One coin's row in a sheet: the setting's coin (or a key it doesn't list, as written) and how many are held. */
export interface PurseRow {
  coin: Denomination;
  has: number;
}

/** Every coin the setting names, in its order, a 0 for none; then any coin held under a key it doesn't list (pu-6). */
export function purseRows(denominations: readonly Denomination[], coins: Coins): PurseRow[] {
  const rows: PurseRow[] = [];
  for (const coin of denominations) if (!rows.some((r) => r.coin.key === coin.key)) rows.push({ coin, has: coins[coin.key] ?? 0 });
  for (const [key, has] of Object.entries(coins)) if (has > 0 && !rows.some((r) => r.coin.key === key)) rows.push({ coin: { key, label: key }, has });
  return rows;
}

/** A coin's name as a row's label: its plural name or label, as written, the first letter a capital ("Herons"). */
export const rowLabel = (coin: Denomination) => {
  const name = coin.pluralName ?? coin.label;
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The setting's coin names for a refusal from the database ("30 herons"), by key. */
const namesOf = (rows: readonly PurseRow[]): CoinNames => Object.fromEntries(rows.map((r) => [r.coin.key, r.coin.pluralName ?? r.coin.label]));

/** Thousands with a comma, as the Pack prints them. */
const count = (n: number) => n.toLocaleString('en');

/**
 * What was typed, read: the coins (each 1 or more), or the key of the first row that isn't a whole number. An empty box
 * or a 0 is none of that coin.
 */
export function readAmount(rows: readonly PurseRow[], typed: Readonly<Record<string, string>>): { coins: Record<string, number> } | { bad: string } {
  const coins: Record<string, number> = {};
  for (const { coin } of rows) {
    const text = (typed[coin.key] ?? '').trim();
    if (text === '') continue;
    if (!/^\d+$/.test(text)) return { bad: coin.key };
    const n = Number(text);
    if (n > 0) coins[coin.key] = n;
  }
  return { coins };
}

/** An amount in the setting's words, in its order: "2 crowns, 2 herons" (the coin line's words). */
const amountIn = (rows: readonly PurseRow[], coins: Coins) => coinLine(rows.map((r) => r.coin), coins);

/** The toast after a spend, in the log line's words: "Wren spent 2 herons: a room at the inn". */
export const spentWords = (name: string, amount: string, whatFor: string) => `${name} spent ${amount}${whatFor.trim() ? `: ${whatFor.trim()}` : ''}`;
/** The toast after a give, in the log line's words: "Wren gave Moss 5 herons"; to the stash, "Wren put 10 herons in the stash". */
export const gaveWords = (name: string, to: NamedCarrier, amount: string) => (to.locationId !== null ? `${name} put ${amount} in the stash` : `${name} gave ${to.name} ${amount}`);

/** The toast after the GM gives, in the log line's words: "Your GM gave Wren 40 herons" (events.ts, purse.add). */
export const gmGaveWords = (name: string, amount: string) => `Your GM gave ${name} ${amount}`;
/** The toast after the GM takes, in the log line's words: "Your GM took 10 herons from Wren" (pu-7). */
export const gmTookWords = (name: string, amount: string) => `Your GM took ${amount} from ${name}`;

/** The toast after a player takes from the stash, in the log line's words: "Wren took 10 herons from the stash" (K13). */
export const tookWords = (name: string, amount: string) => `${name} took ${amount} from the stash`;

/** The player's pages (spend, give; take, from the stash) and the GM's (add: "Give coin", remove: "Take coin"). */
type Page = 'coin' | 'spend' | 'give' | 'take' | 'add' | 'remove';

export function PurseSheet({
  db,
  user,
  carrier,
  recipients,
  denominations,
  coins,
  gm = false,
  taker = null,
  onClose,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  /** The character whose coin it is (the person's own), or the Party stash (K13). */
  carrier: NamedCarrier;
  /** Who coin can go to: the Party stash and the other characters. */
  recipients: readonly NamedCarrier[];
  denominations: readonly Denomination[];
  coins: Coins;
  /** The GM's sheet (K15): "Give coin…" and "Take coin…" in place of Spend… and Give to…. */
  gm?: boolean;
  /** On the stash's coin (K13): the player's character the coin is taken for ("You are taking for"). */
  taker?: NamedCarrier | null;
  onClose: () => void;
  /** Coin moved (or a move was undone): read the purse again. */
  onChanged: () => void;
}) {
  const id = useId();
  const [page, setPage] = useState<Page>('coin');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [whatFor, setWhatFor] = useState('');
  const [to, setTo] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ key: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const show = useToast();
  const online = useOnline();
  // Offline, the stash coin's Take… opens the blocked-action pop-up over this sheet (⚑ 7, re-ruled "A" 25 Nov), and so
  // does Take coin's accent when the network drops while it is open (Home Two's audit of #66, finding 1, 26 Nov).
  const blocked = useBlockedSheet();
  const rows = purseRows(denominations, coins);
  const name = carrier.name;
  // The stash's coin (K13): what it holds reads "The stash has 40." (PC6b).
  const stash = carrier.locationId !== null;
  const holder = stash ? 'The stash' : name;
  const keyOf = (c: NamedCarrier) => (c.actorId ?? c.locationId)!;
  // The party's stash first, then the people (PC5).
  const others = [...recipients.filter((r) => r.locationId !== null), ...recipients.filter((r) => r.actorId !== null && r.actorId !== carrier.actorId)];
  const chosen = others.find((r) => keyOf(r) === to) ?? null;

  const go = (next: Page) => {
    setPage(next);
    setTyped({});
    setWhatFor('');
    setTo(null);
    setRefusal(null);
  };

  const read = readAmount(rows, typed);
  const amount = 'coins' in read && Object.keys(read.coins).length > 0 ? amountIn(rows, read.coins) : '';
  const verb =
    page === 'add'
      ? `Give ${name}${amount ? ` ${amount}` : ''}`
      : page === 'remove' || page === 'take'
        ? `Take${amount ? ` ${amount}` : ''}`
        : page === 'spend'
      ? amount
        ? `Spend ${amount}`
        : 'Spend'
      : chosen?.locationId
        ? amount
          ? `Put in ${amount}`
          : 'Put in'
        : `Give${chosen ? ` ${chosen.name}` : ''}${amount ? ` ${amount}` : ''}`;

  async function undo(type: string) {
    const eventId = await latestChange(db, carrier.campaignId, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: carrier.campaignId, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  }

  async function confirm() {
    if (busy) return;
    // Offline, nothing is read or written: the pop-up says why it waits, before any refusal.
    if (page === 'take' && !online) return blocked.explain(TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY);
    setRefusal(null);
    const first = rows[0]?.coin.key ?? '';
    if ('bad' in read) return setRefusal({ key: read.bad, text: AMOUNT });
    const wanted = read.coins;
    const keys = Object.keys(wanted);
    if (keys.length === 0) return setRefusal({ key: first, text: AMOUNT });
    // The GM's give has no ceiling here: the database refuses past 999,999,999 (pu-8), shown under the row.
    if (page !== 'add') for (const row of rows) {
      const n = wanted[row.coin.key] ?? 0;
      if (n > row.has) return setRefusal({ key: row.coin.key, text: `${holder} has ${amountWords(row.coin, row.has) ?? `${count(row.has)} ${row.coin.label}`}.` });
    }
    if (page === 'give' && !chosen) return show({ text: 'Choose who gets it.' });
    setBusy(true);
    const names = namesOf(rows);
    const done =
      page === 'add'
        ? await runCommand(registry, db, user, addCoin, { to: carrier, coins: wanted, names })
        : page === 'remove'
          ? await runCommand(registry, db, user, removeCoin, { from: carrier, coins: wanted, names })
          : page === 'take'
          ? await runCommand(registry, db, user, takeCoin, { from: { ...carrier, downOrDead: false }, to: taker!, coins: wanted, names })
          : page === 'spend'
            ? await runCommand(registry, db, user, spendCoin, { from: carrier, coins: wanted, whatFor, names })
            : await runCommand(registry, db, user, giveCoin, { from: carrier, to: chosen!, coins: wanted, names });
    setBusy(false);
    if (!done.ok) return setRefusal({ key: keys[0]!, text: done.message });
    const words =
      page === 'add' ? gmGaveWords(name, amount) : page === 'remove' ? gmTookWords(name, amount) : page === 'take' ? tookWords(taker!.name, amount) : page === 'spend' ? spentWords(name, amount, whatFor) : gaveWords(name, chosen!, amount);
    const type = page === 'add' ? addCoin.name : page === 'remove' ? removeCoin.name : page === 'take' ? takeCoin.name : page === 'spend' ? spendCoin.name : giveCoin.name;
    onClose();
    onChanged();
    // The stash's Take: Undo with the turned-back arrow above the word, as a thing's take (⚑ 6, ruled 24 Nov).
    show({ text: words, onUndo: () => void undo(type), ...(page === 'take' ? { undoIcon: true } : {}) });
  }

  const refusalLine = (key: string) =>
    refusal?.key === key ? (
      <p className="purse-sheet__refusal" role="alert">
        <WarningLine>{refusal.text}</WarningLine>
      </p>
    ) : null;

  if (page === 'coin') {
    return (
      <Dialog label={`${name}’s coin`} onClose={onClose}>
        <div className="purse-sheet__amounts">
          {rows.map(({ coin, has }) => (
            <p key={coin.key} className="book-line">
              <span className="book-label">{rowLabel(coin)}</span> {count(has)}
            </p>
          ))}
        </div>
        {gm ? (
          <RowList>
            <ListRow title="Give coin…" onOpen={() => go('add')} />
            <ListRow title="Take coin…" onOpen={() => go('remove')} />
          </RowList>
        ) : stash ? (
          // A player on the stash's coin (PC6): one row leads on; offline it stays a row and a tap opens the blocked-action
          // pop-up saying why it waits (⚑ 7, re-ruled "A" 25 Nov).
          taker && (
            <RowList>
              <ListRow title="Take…" onOpen={() => (online ? go('take') : blocked.explain(TAKE_OFFLINE_TITLE, TAKE_OFFLINE_WHY))} />
            </RowList>
          )
        ) : (
          <RowList>
            <ListRow title="Spend…" onOpen={() => go('spend')} />
            <ListRow title="Give to…" onOpen={() => go('give')} />
          </RowList>
        )}
        {blocked.sheet}
      </Dialog>
    );
  }

  return (
    <Dialog label={page === 'add' ? 'Give coin' : page === 'remove' || page === 'take' ? 'Take coin' : page === 'spend' ? 'Spend' : 'Give to'} onClose={onClose}>
      <button type="button" className="button-quiet purse-sheet__back" onClick={() => go('coin')}>
        ‹ {name}’s coin
      </button>
      <div className="purse-sheet__rows" role="group" aria-label="How much">
        {rows.map(({ coin, has }) => {
          const box = `${id}-${coin.key}`;
          const text = typed[coin.key] ?? '';
          return (
            <div key={coin.key}>
              <div className="purse-sheet__row">
                <span className="purse-sheet__coin">
                  <label className="purse-sheet__name" htmlFor={box}>
                    {rowLabel(coin)}
                  </label>
                  <span className="purse-sheet__has" id={`${box}-has`}>{`${holder} has ${count(has)}.`}</span>
                </span>
                <input
                  id={box}
                  className="field__input purse-sheet__box"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  aria-describedby={`${box}-has`}
                  aria-invalid={refusal?.key === coin.key || undefined}
                  value={text}
                  onChange={(event) => {
                    setTyped({ ...typed, [coin.key]: event.target.value });
                    if (refusal?.key === coin.key) setRefusal(null);
                  }}
                />
              </div>
              {refusalLine(coin.key)}
            </div>
          );
        })}
        {rows.length === 0 && refusalLine('')}
      </div>
      {page === 'spend' ? (
        <label className="field purse-sheet__for" htmlFor={`${id}-for`}>
          <span className="label">What for</span>
          <input id={`${id}-for`} className="field__input" maxLength={500} placeholder="If you like" value={whatFor} onChange={(event) => setWhatFor(event.target.value)} />
        </label>
      ) : page === 'give' ? (
        <DestinationList
          label="Give to"
          destinations={others.map((r) => ({ id: keyOf(r), name: r.name, group: r.locationId ? 'Party' : 'People' }))}
          selected={to}
          onSelect={setTo}
          onBlocked={(why) => show({ text: why })}
        />
      ) : null}
      <div className="dialog__actions purse-sheet__foot">
        {/* Stacked (ic-1, stk-1): the icon over the words, which keep the amount on one line (the lead, 2026-11-14). */}
        <StackedButton
          variant="primary"
          icon={page === 'spend' ? 'two-coins' : page === 'remove' || page === 'take' ? 'grab' : page === 'add' ? 'receive-money' : !chosen?.locationId ? 'open-palm' : 'open-chest'}
          label={verb}
          className="purse-sheet__go"
          onClick={() => void confirm()}
        />
      </div>
      {blocked.sheet}
    </Dialog>
  );
}
