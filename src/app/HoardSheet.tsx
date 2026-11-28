// B15 of docs/plans/scene-point-to-point.md (p2p-28, p2p-29): a hoard as one piece in the book's words, and a magic
// item's truth as a piece. Page 30, approved by Francis 2026-11-20 (pg30-1 to pg30-5): HM1 (the hoard's piece opens its
// sheet, a small arrow before its eye; the line under it says where it went), HM2 and HM5 (the hoard's sheet: the
// book's line, one row a thing with its count, "Send all", "Edit the piece's words"; once everything is sent "Send all"
// is gone and each row says where it went), HM3 (the magic item's eye: the toast with Undo). The send itself is the Pack
// page's PK5 and PK5b (approved 2026-11-14, ap-6): "Send", then "To a character" (which one) or "To the party stash",
// and the toast with Undo. Everything here is the GM's: nothing of a hoard's rows or a thing's worth reaches a player.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { withoutThe, withTheStart } from '../core/nameWords.ts';
import { loadCommandLog, type LogEvent } from '../core/events.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { giveFind, loadClockChanges, NOT_NAMED_WORDS, rowKey, sendOf, sentRows, undoFind } from '../modules/expedition/findSend.ts';
import { hoardRows, magicPieceOf, namedThings, oneThing, thingWords, type Hoard, type HoardRow } from '../modules/expedition/hoard.ts';
import { heldLinesOf, loadHolders, loadRevealed, showItemTruth } from '../modules/expedition/itemTruth.ts';
import { sharedStep, type TurnClock } from '../modules/expedition/placeKnowledge.ts';
import type { GroupPlace, Piece } from '../modules/expedition/placePlay.ts';
import { denominationsOf, type Denomination } from '../modules/inventory/coinWords.ts';
import { loadCarriers, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { secondsAt } from '../modules/inventory/stashHistory.ts';
import { loadCampaignEntries } from '../modules/library/campaignPacks.ts';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { ListRow, RowList, StackedButton } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './HoardSheet.css';

/** Where a sent row went, in words (PK5b): "Sent to Wren", or "In the party stash". */
export const sentWords = (to: string | null, nameOf: (id: string) => string): string => (to === null ? 'In the party stash' : `Sent to ${nameOf(to)}`);

/**
 * The line under a hoard's piece on the GM's card (HM1, HM3, HM5; PK5b): nothing before anything is sent; "Sent to
 * Wren" (or "In the party stash") once everything went to one; "All sent: Wren, Ash, the party stash" once everything
 * went to several, each named once; "2 of 5 sent" while some is left (plan B15, "a hoard half sent").
 */
export function hoardLine(rows: readonly HoardRow[], sent: ReadonlyMap<string, { to: string | null }>, nameOf: (id: string) => string): { text: string; tick: boolean } | null {
  const went = rows.flatMap((r) => (sent.has(rowKey(r)) ? [sent.get(rowKey(r))!.to] : []));
  if (went.length === 0 || rows.length === 0) return null;
  if (went.length < rows.length) return { text: `${went.length} of ${rows.length} sent`, tick: false };
  const takers = [...new Set(went)];
  if (takers.length === 1) return { text: sentWords(takers[0]!, nameOf), tick: true };
  return { text: `All sent: ${takers.map((t) => (t === null ? 'the party stash' : nameOf(t))).join(', ')}`, tick: true };
}

const lowerFirst = (text: string): string => (text ? text[0]!.toLowerCase() + text.slice(1) : text);

/**
 * The find sheet's head and line for a Treasure piece (sf-8; page 44, TR1): over the sheet the hoard's name, else the
 * piece's own lead word, else its one row's words ("Bronze ring"); under it the hoard's words, else the piece's words,
 * left out where they only say the head again. Pure.
 */
export function sheetHoard(hoard: Hoard, piece: Pick<Piece, 'text' | 'lead'>): Hoard {
  const only = hoard.rows.length === 1 ? hoard.rows[0]! : null;
  const name = hoard.name ?? (piece.lead?.trim() || (only ? (only.kind === 'thing' ? thingWords(only) : only.text) : null));
  const words = hoard.words ?? (piece.text.trim() || null);
  return { ...hoard, name, words: words === name ? null : words };
}

/**
 * A sent piece's line in its sheet (sf-8, TR1): "Sent to Wren, turn 3." or "In the party stash, turn 3.", the turn in
 * the strip's own step words when the send was in the expedition under way; else "Sent to Wren.".
 */
export const sentPieceWords = (to: string | null, nameOf: (id: string) => string, step: string | null = null): string => `${sentWords(to, nameOf)}${step ? `, ${step}` : ''}.`;

/** "Take it back"'s toast (sf-8, TR1): "Taken back from Wren: bronze ring.", or "from the party stash". */
export const takenBackWords = (to: string | null, nameOf: (id: string) => string, rows: readonly HoardRow[]): string =>
  `Taken back from ${to === null ? 'the party stash' : nameOf(to)}: ${sendListWords(rows)}.`;

/** What a send carries, said once (PK5, PK5b's toast): "240 herons, 2 moon opals, hooded lantern". */
export function sendListWords(rows: readonly HoardRow[]): string {
  return rows
    .map((r) => (r.kind === 'coin' ? (r.amounts.length > 0 ? r.amounts.map((a) => a.words).join(', ') : r.text) : r.qty > 1 ? `${r.qty} ${lowerFirst(r.text)}` : lowerFirst(r.text)))
    .join(', ');
}

/**
 * The toast of a magic item's eye (HM3; Home Two's alternative, Francis picked B, 24 Nov): "Shown to the players: <name>."
 * and, for the item where it is held, "The <thing> <holder's full name> holds now carries its name.", a character and a
 * hireling alike, with no possessive; the stash: "The <thing> in the party stash now carries its name."; a holder whose
 * name isn't known (''): "The <thing> now carries its name.". Never a group's name: once revealed, the name is every
 * player's (Francis, 2026-11-21).
 */
export function truthToastWords(name: string, thing: string, holders: readonly (string | null)[]): string {
  const first = `Shown to the players: ${name}.`;
  const plain = lowerFirst(thing);
  if (holders.length === 0) return first;
  if (holders.length > 1) return `${first} Each ${withoutThe(plain)} sent now carries its name.`;
  const holder = holders[0];
  if (holder === null) return `${first} ${withTheStart(plain)} in the party stash now carries its name.`;
  return holder ? `${first} ${withTheStart(plain)} ${holder} holds now carries its name.` : `${first} ${withTheStart(plain)} now carries its name.`;
}

interface Setting {
  coins: Denomination[];
  items: Set<string>;
  libraryIds: Map<string, string>;
  carriers: NamedCarrier[];
}

type Open = { piece: Piece; step: 'hoard' | 'send' | 'who'; rows: HoardRow[] } | null;

/**
 * The hoard's piece and the magic item's eye on the GM's card (B15). `place` is the place's pack entry (its treasure
 * and hoards); `row` the group's visit.
 */
export function useHoards({
  db,
  user,
  campaign,
  row,
  place,
  placeName,
  phone = false,
  turns = null,
  onEdit,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  row: GroupPlace | null;
  place: Record<string, unknown> | null;
  /** The Location's name as the card shows it ("2. The Wreck"), over the hoard's name on a tablet (HM2; HM5 draws none). */
  placeName: string;
  /** A phone: the sheets rise from the foot (HM5); on a tablet they stand at the right (HM2, pg30-5). */
  phone?: boolean;
  /** The expedition's step on the clock, for "Sent to Wren, turn 3." (TR1); null: the line names no turn. */
  turns?: TurnClock | null;
  onEdit: (piece: Piece) => void;
  onChanged: () => void;
}) {
  const show = useToast();
  const [setting, setSetting] = useState<Setting | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [clock, setClock] = useState<Awaited<ReturnType<typeof loadClockChanges>>>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  // After a send that leaves things in the hoard, the row focus goes to: the first one not sent yet (Francis picked A).
  const [focusRow, setFocusRow] = useState<number | null>(null);
  // Focus goes back to the piece's words that opened the hoard as the sheet closes, from any step (impeccable audit 1):
  // the Dialog's own rule now, which goes back past a step's button to the piece.
  const close = () => setOpen(null);
  const placeId = row?.place?.id ?? null;
  const hasTreasure = !!place && Array.isArray(place.treasure) && place.treasure.length > 0;

  // The setting's coins and items, and who can take a find: read once the place has treasure.
  useEffect(() => {
    if (!hasTreasure) return;
    let live = true;
    void Promise.all([loadCampaignEntries(db, campaign.id), loadCarriers(db, campaign.id)]).then(([entries, carriers]) => {
      if (!live) return;
      const all = entries ?? [];
      const items = all.filter((e) => e.kind === 'item');
      setSetting({
        coins: denominationsOf(all.filter((e) => e.kind === 'rulesSet').map((e) => e.data)),
        items: new Set(items.map((e) => e.packEntryId)),
        libraryIds: new Map(items.flatMap((e) => (e.entryId ? [[e.packEntryId, e.entryId] as const] : []))),
        carriers: carriers ?? [],
      });
    });
    return () => {
      live = false;
    };
  }, [db, campaign.id, hasTreasure]);

  // The GM's send lines: what was sent from here, and where a found thing is now.
  useEffect(() => {
    if (!hasTreasure) return;
    let live = true;
    void loadCommandLog(db, campaign.id, giveFind.name).then((found) => live && found && setEvents(found));
    // The clock's changes, for the turn each send was made in (TR1). Unread, the line names no turn.
    void loadClockChanges(db, campaign.id).then((found) => live && setClock(found), () => live && setClock(null));
    return () => {
      live = false;
    };
  }, [db, campaign.id, hasTreasure, tick, row]);

  const sent = useMemo(() => (placeId ? sentRows(events, placeId) : new Map<string, { to: string | null; eventId: string; seq: number }>()), [events, placeId]);
  /** The turn a send was made in ("turn 3"), counted in the expedition under way; null when it can't be said. */
  const sentStep = (seq: number): string | null => {
    if (!clock) return null;
    const seconds = secondsAt({ seq }, clock.changes, clock.seconds);
    return seconds === null ? null : sharedStep(seconds, turns);
  };
  const nameOf = useCallback((id: string) => setting?.carriers.find((c) => c.actorId === id)?.name ?? 'someone', [setting]);
  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  /** What a Treasure piece hands out (HM1; sf-8: every Treasure piece, a single thing too): null with nothing to send. */
  const hoardOf = (piece: Piece): Hoard | null => {
    if (!place || !setting) return null;
    const hoard = hoardRows(piece, place, setting.coins, setting.items);
    return hoard.rows.length > 0 ? hoard : null;
  };

  /** The line under a hoard's piece (HM1, HM3, HM5). */
  const noteOf = (piece: Piece): ReactNode => {
    const hoard = hoardOf(piece);
    const line = hoard ? hoardLine(hoard.rows, sent, nameOf) : null;
    return line ? <SentLine text={line.text} tick={line.tick} /> : null;
  };

  async function send(to: string | null, rows: readonly HoardRow[]) {
    if (!placeId || !row || !setting || busy || !open) return;
    const what = sendOf(rows, setting.libraryIds);
    setBusy(true);
    // Each thing whose magic item's piece is revealed, to any group, arrives named (HM3's pick; the local review of #10),
    // every one in the send. If the shows can't be read, those shown on this card still count.
    const magic = place ? row.pieces.filter((p) => magicPieceOf(p, place) !== null) : [];
    const revealed = (await loadRevealed(db, magic.map((p) => p.id))) ?? new Set(magic.filter((p) => p.shown).map((p) => p.id));
    const named = place ? namedThings(rows, row.pieces, place, revealed) : [];
    const result = await runCommand(registry, db, user, giveFind, {
      campaignId: campaign.id,
      to,
      placeId,
      things: what.things,
      coins: what.coins,
      rows: what.rows,
      named,
    });
    setBusy(false);
    if (!result.ok) return show({ text: result.message, error: true });
    const going = new Set(rows.map(rowKey));
    const all = hoardOf(open.piece)?.rows ?? [];
    const next = all.findIndex((r) => !sent.has(rowKey(r)) && !going.has(rowKey(r)));
    // Something left: back to the hoard, focus on its first row not sent; nothing left: closed, focus back on the
    // Strongbox piece (Home Two's re-check, Francis picked A, 24 Nov), never on the page.
    if (next >= 0) {
      setFocusRow(next);
      setOpen({ piece: open.piece, step: 'hoard', rows: [] });
    } else close();
    refresh();
    const said = `${to === null ? 'Put in the party stash' : `Sent to ${nameOf(to)}`}: ${sendListWords(rows)}.`;
    // A magic item that couldn't be named still went: the toast keeps its Undo and says what to do (the review of #1101).
    const words = result.value.notNamed ? `${said} ${NOT_NAMED_WORDS}` : said;
    const eventId = result.value.eventId;
    show({
      text: words,
      onUndo: () =>
        void runCommand(registry, db, user, undoFind, { campaignId: campaign.id, eventId }).then((undone) => {
          refresh();
          if (!undone.ok) show({ text: undone.message, error: true });
        }),
    });
  }

  /**
   * "Take it back" on a sent piece's sheet (sf-8, TR1): the send's own Undo, once, at once, with a toast; the sheet stays,
   * offering where to send it again. Refused (the thing was used or passed on): the error toast with the reason, as every
   * refused command on this page says it (sf-27: the refusal pop-up is drawn after 5 Dec).
   */
  async function takeBack(went: { to: string | null; eventId: string }, rows: readonly HoardRow[]) {
    if (busy) return;
    setBusy(true);
    const undone = await runCommand(registry, db, user, undoFind, { campaignId: campaign.id, eventId: went.eventId });
    setBusy(false);
    if (!undone.ok) return show({ text: undone.message, error: true });
    refresh();
    show({ text: takenBackWords(went.to, nameOf, rows) });
  }

  /** A magic item's piece, its eye tapped while hidden (HM3): shown, and the item named wherever it is held. */
  const isMagic = (piece: Piece): boolean => !!place && magicPieceOf(piece, place) !== null;
  async function showTruth(piece: Piece) {
    if (!row || !place || !placeId || busy) return;
    const magic = magicPieceOf(piece, place);
    if (!magic) return;
    setBusy(true);
    // Every line the thing went to, whoever holds it now (Francis, 2026-11-21: a revealed name is everyone's).
    const lines = heldLinesOf(events, placeId, magic.entry);
    const held = await loadHolders(db, lines);
    if (!held) {
      setBusy(false);
      return show({ text: "Couldn't show it. Try again.", error: true });
    }
    const result = await runCommand(registry, db, user, showItemTruth, { campaignId: campaign.id, row, piece, lines });
    setBusy(false);
    refresh();
    if (!result.ok) return show({ text: result.message, error: true });
    const thing = String(((place.treasure as unknown[])[magic.entry] as Record<string, unknown>).text ?? '').trim();
    // A holder's full name, or '' when it isn't known (the toast then names the thing alone).
    const holders = lines.flatMap((line) => (held.has(line) ? [held.get(line) ?? null] : [])).map((id) => (id === null ? null : (setting?.carriers.find((c) => c.actorId === id)?.name ?? '')));
    show({
      text: truthToastWords(magic.name, thing, holders),
      onUndo: () =>
        void (async () => {
          const eventId = await latestChange(db, campaign.id, showItemTruth.name, user.id);
          const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
          refresh();
          if (!undone) show({ text: 'Nothing to undo.', error: true });
          else if (!undone.ok) show({ text: undone.message, error: true });
        })(),
    });
  }

  const found = open ? hoardOf(open.piece) : null;
  const hoard = open && found ? sheetHoard(found, open.piece) : null;
  const unsent = hoard ? hoard.rows.filter((r) => !sent.has(rowKey(r))) : [];
  const single = hoard ? oneThing(hoard) : null;
  const singleWent = single ? (sent.get(rowKey(single)) ?? null) : null;
  // Over the sheet the Location's numbered name, on a phone too (page 44, TR2 B to D).
  const over = placeName || undefined;
  const sheets =
    open && hoard ? (
      open.step === 'hoard' && single ? (
        <FoundThingSheet
          hoard={hoard}
          over={over}
          side={!phone}
          went={singleWent ? sentPieceWords(singleWent.to, nameOf, sentStep(singleWent.seq)) : null}
          onCharacter={() => setOpen({ ...open, step: 'who', rows: [single] })}
          onStash={() => void send(null, [single])}
          onTakeBack={() => singleWent && void takeBack(singleWent, [single])}
          onEdit={() => {
            setOpen(null);
            onEdit(open.piece);
          }}
          onClose={close}
        />
      ) : open.step === 'hoard' ? (
        <HoardSheetView
          hoard={hoard}
          over={over}
          side={!phone}
          sent={sent}
          nameOf={nameOf}
          focusRow={focusRow}
          onRow={(r) => {
            const went = sent.get(rowKey(r));
            // A sent row still opens: its send's toast, with Undo while that can be undone (HM5).
            if (went) {
              show({
                text: `${sentWords(went.to, nameOf)}.`,
                onUndo: () => void runCommand(registry, db, user, undoFind, { campaignId: campaign.id, eventId: went.eventId }).then((undone) => (refresh(), undone.ok ? undefined : show({ text: undone.message, error: true }))),
              });
              return;
            }
            setFocusRow(null);
            setOpen({ ...open, step: 'send', rows: [r] });
          }}
          onSendAll={unsent.length > 0 ? () => (setFocusRow(null), setOpen({ ...open, step: 'send', rows: unsent })) : null}
          onEdit={() => {
            setOpen(null);
            onEdit(open.piece);
          }}
          onClose={close}
        />
      ) : open.step === 'send' ? (
        <SendSheet side={!phone} back={hoard.name ?? ''} words={sendListWords(open.rows)} onBack={() => setOpen({ ...open, step: 'hoard', rows: [] })} onCharacter={() => setOpen({ ...open, step: 'who' })} onStash={() => void send(null, open.rows)} onClose={close} />
      ) : (
        // Back to where "To a character" was tapped: the one thing's sheet, else the Send step.
        <WhichCharacter side={!phone} characters={(setting?.carriers ?? []).filter((c) => c.actorId !== null)} onBack={() => setOpen({ ...open, step: single ? 'hoard' : 'send' })} onPick={(id) => void send(id, open.rows)} onClose={close} />
      )
    ) : null;

  return {
    /** Whether a tap on this piece's words or its arrow opens its find sheet (pg30-1; sf-8: every Treasure piece with something to send). */
    opens: (piece: Piece) => hoardOf(piece) !== null,
    open: (piece: Piece) => {
      setFocusRow(null);
      setOpen({ piece, step: 'hoard', rows: [] });
    },
    noteOf,
    /** Whether a find sheet is open, its own button the accent (Move on plain behind it; page 44, TR1). */
    isOpen: sheets !== null,
    isMagic,
    showTruth,
    // On a phone the Sheet variant, rising from the foot (HM5, pg30-5); on a tablet each passes `side`, the standing panel.
    sheets: sheets && <SheetScope.Provider value>{sheets}</SheetScope.Provider>,
  };
}

/** "✓ Sent to Wren" under a hoard's piece or row (PK5b): the tick and the words; a half-sent count has no tick. */
export function SentLine({ text, tick }: { text: string; tick: boolean }) {
  return (
    <span className="hoard-sent">
      {tick && <Icon name="tick" size={16} />}
      {text}
    </span>
  );
}

/**
 * The hoard's sheet, a count's find sheet (HM2; HM5 B and C; page 44, TR1 and TR2 C): over its name the Location's, the
 * book's line once, then one row a thing with its count (coin a row like any other), a sent row saying where it went;
 * "Edit the piece's words"; then, while anything is left, "Send all" (the sheet's one accent) at the foot's right.
 */
export function HoardSheetView({
  hoard,
  over,
  sent,
  nameOf,
  onRow,
  onSendAll,
  onEdit,
  onClose,
  side = false,
  preview = false,
  focusRow = null,
}: {
  hoard: Hoard;
  /** The row (its place in `hoard.rows`) focus goes to as the sheet opens, past the Dialog's first control (after a send). */
  focusRow?: number | null;
  over?: string;
  /** The standing panel at the right (a tablet, HM2); else the sheet from the foot (a phone, HM5). */
  side?: boolean;
  sent: ReadonlyMap<string, { to: string | null }>;
  nameOf: (id: string) => string;
  onRow: (row: HoardRow) => void;
  onSendAll: (() => void) | null;
  onEdit: () => void;
  onClose: () => void;
  preview?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  // Runs after the Dialog's own opening focus (a child's effect runs first), once, as the sheet opens.
  useEffect(() => {
    if (focusRow === null || preview) return;
    body.current?.querySelectorAll<HTMLElement>('.list-row__body')[focusRow]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Dialog label={hoard.name ?? 'Treasure'} over={over} side={side} onClose={onClose} preview={preview}>
      <div className="hoard-sheet" ref={body} data-toast-above>
        {hoard.words && <p className="hoard-sheet__words">{hoard.words}</p>}
        <RowList label="Things in it" dotted>
          {hoard.rows.map((r) => {
            const went = sent.get(rowKey(r));
            const note = r.kind === 'coin' && r.readAs ? r.readAs.note : null;
            const name = r.kind === 'thing' ? thingWords(r) : r.text;
            return (
              <ListRow
                key={rowKey(r)}
                // Each thing's name in bold, as FD5 and page 44's TR2 draw it (⚑ 5 of #158, B, 28 Nov); the edit row stays plain.
                title={<span className="hoard-sheet__name">{name}</span>}
                sub={went ? <SentLine text={sentWords(went.to, nameOf)} tick /> : (note ?? undefined)}
                // What is heard stays as it was with the plain words: the name, then the pack's note.
                openLabel={went ? undefined : [name, note].filter((p) => p).join(', ')}
                onOpen={() => onRow(r)}
              />
            );
          })}
          {/* The edit row in the rows' own list, so one list and one rule (page 44, TR1). */}
          <EditWordsRow onEdit={onEdit} />
        </RowList>
        {/* "Send all" at the foot's right, under the edit row (page 44, TR1, finding 16). */}
        {onSendAll && (
          <div className="dialog__actions">
            <StackedButton icon="open-palm" label="Send all" variant="primary" onClick={onSendAll} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** "Edit the piece's words", each find sheet's last row (page 44, TR1): the quill before the words. */
export function EditWordsRow({ onEdit }: { onEdit: () => void }) {
  return <ListRow lead={<Icon name="quill-ink" size={24} />} title="Edit the piece's words" onOpen={onEdit} />;
}

/**
 * The find sheet of a Treasure piece that is one thing (sf-8; page 44, TR1 and TR2 B, D): the piece's words, then where
 * it goes, "To a character" (which one) and "To the party stash" (at once). Once sent (`went`: "Sent to Wren."): where
 * it went, and "Take it back", which acts at once and so has no arrow. "Edit the piece's words" last; a thing a person
 * carries (page 50, dec5-gaps F) has no edit row of its own (`onEdit` left out): her sheet has it.
 */
export function FoundThingSheet({
  hoard,
  over,
  went,
  onCharacter,
  onStash,
  onTakeBack,
  onEdit,
  onClose,
  side = false,
  preview = false,
}: {
  hoard: Hoard;
  over?: string;
  /** Where it went, in words, once sent; null while it waits to be sent. */
  went: string | null;
  onCharacter: () => void;
  onStash: () => void;
  onTakeBack: () => void;
  onEdit?: () => void;
  onClose: () => void;
  side?: boolean;
  preview?: boolean;
}) {
  return (
    <Dialog label={hoard.name ?? 'Treasure'} over={over} side={side} onClose={onClose} preview={preview}>
      <div className="hoard-sheet" data-toast-above>
        {hoard.words && <p className="hoard-sheet__words">{hoard.words}</p>}
        {went !== null && <SentLine text={went} tick />}
        <RowList label={went === null ? 'Where it goes' : 'Where it went'} dotted>
          {went === null ? (
            <>
              <ListRow lead={<Icon name="open-palm" size={24} />} title="To a character" onOpen={onCharacter} />
              <ListRow lead={<Icon name="swap-bag" size={24} />} title="To the party stash" onOpen={onStash} />
            </>
          ) : (
            <ListRow lead={<Icon name="anticlockwise-rotation" size={24} />} title="Take it back" chevron={false} onOpen={onTakeBack} />
          )}
          {onEdit && <EditWordsRow onEdit={onEdit} />}
        </RowList>
      </div>
    </Dialog>
  );
}

/** "Send" (PK5): what is sent, said once, and the two equal answers; the way back to the hoard. */
export function SendSheet({ back, words, onBack, onCharacter, onStash, onClose, side = false, preview = false }: { back: string; words: string; onBack: () => void; onCharacter: () => void; onStash: () => void; onClose: () => void; side?: boolean; preview?: boolean }) {
  return (
    <Dialog label="Send" over={back} onBack={onBack} onClose={onClose} side={side} preview={preview}>
      <div className="hoard-sheet">
        <p>{words ? `${words[0]!.toUpperCase()}${words.slice(1)}.` : ''}</p>
        <div className="hoard-sheet__answers">
          <StackedButton icon="players" label="To a character" onClick={onCharacter} />
          <StackedButton icon="locked-chest" label="To the party stash" onClick={onStash} />
        </div>
      </div>
    </Dialog>
  );
}

/** "Send to" (PK5b): the characters by name; a tap sends. */
export function WhichCharacter({ characters, onBack, onPick, onClose, side = false, preview = false }: { characters: readonly NamedCarrier[]; onBack: () => void; onPick: (actorId: string) => void; onClose: () => void; side?: boolean; preview?: boolean }) {
  return (
    <Dialog label="Send to" onBack={onBack} onClose={onClose} side={side} preview={preview}>
      <div className="hoard-sheet">
        {characters.length === 0 ? (
          <p>No character can take it yet. Send it to the party stash instead.</p>
        ) : (
          <RowList label="Characters" dotted>
            {characters.map((c) => (
              <ListRow key={c.actorId} title={c.name} chevron={false} onOpen={() => onPick(c.actorId!)} />
            ))}
          </RowList>
        )}
      </div>
    </Dialog>
  );
}
