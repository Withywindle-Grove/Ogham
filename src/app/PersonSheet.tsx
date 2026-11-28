// dec5-gaps piece F (#192; G-228, dg-10 to dg-16, dg-19): what a person carries, on the GM's place page. Page 50,
// approved by Francis 2026-11-28 with findings 1, 5 and 6. Her piece gains a Carries line under "Only you see this."
// (on a phone above her stat line, finding 5); her words and arrow open her sheet, the find sheet (TR1, `HoardSheet.tsx`)
// in the person's dress: over the title the place, her name, the piece's words, "Carries" and a row a thing (the book's
// note under it), "Sent before" for things sent at another place, "Edit the piece's words" last; no "Send all" and no
// accent (finding 1). A thing's row opens TR1's one-thing sheet: To a character, To the party stash, through piece E's
// held key (`find.give`); once sent, where it went and Take it back (`find.undo`). What she still holds is read from the
// GM's log (dg-12), never stored. Everything here is the GM's: her entry is GM-only, so nothing reaches a player.
// Piece Q (#228; dgc-5, dgc-6, dgc-14, sb4-11 to sb4-13): each "Sent before" line is a row that opens that thing's sheet,
// "Sent to Wren at 4. The Customs Shed, turn 3.", with Take it back wherever she is now; Take it back's toast has Undo
// (the built send again); the names keep the pack's capitals; her words name her, not "she".
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { capitalised } from '../core/chargeUnit.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCommandLog, type LogEvent } from '../core/events.ts';
import type { Db } from '../core/supabase.ts';
import { giveFind, loadClockChanges, loadSentPlaces, sentHeld, undoFind } from '../modules/expedition/findSend.ts';
import {
  carriesUnreadWords,
  carriesWords,
  heldSentWords,
  heldStates,
  heldTakenBackWords,
  heldThingWords,
  missingWords,
  personHolds,
  personOf,
  sentBeforeWords,
  sentHereWords,
  sentThereWords,
  type HeldSend,
  type HeldState,
  type PersonHolds,
} from '../modules/expedition/personHolds.ts';
import { idsInFacts } from '../modules/expedition/pieceNames.ts';
import { sharedStep, type TurnClock } from '../modules/expedition/placeKnowledge.ts';
import type { GroupPlace, Piece } from '../modules/expedition/placePlay.ts';
import { keyedName } from '../modules/expedition/placeTree.ts';
import { loadCarriers, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { secondsAt } from '../modules/inventory/stashHistory.ts';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { ListRow, RowList } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { loadCampaignPacksAndEntries } from './campaignSetting.ts';
import { useLogUserId, useLogVersion } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { EditWordsRow, FoundThingSheet, SentLine, sentPieceWords, WhichCharacter } from './HoardSheet.tsx';
import { registry } from './services.ts';
import './PersonSheet.css';

/** The person a piece names ("NPC: <id>"), or null for any other piece. */
const personIdOf = (piece: Piece): string | null => (piece.kind === 'person' ? (idsInFacts(piece.gm).find((w) => w.kind === 'npc')?.id ?? null) : null);

/** A note as the one-thing sheet's line (page 50: "A lantern on a pole."). */
const sentence = (note: string | null): string | null => (note ? `${capitalised(note)}${/[.!?]$/.test(note) ? '' : '.'}` : null);

/** The Carries line on her piece (page 50): "Carries:" in bold, then what she holds and what went. */
export function CarriesLine({ lead, rest }: { lead: string; rest: string }) {
  return (
    <span className="person-carries">
      <strong>{lead}</strong> {rest}
    </span>
  );
}

type Open = { piece: Piece; step: 'person' | 'thing' | 'who'; key: string | null } | null;

/**
 * Her things on the GM's place page (page 50). `placePack`: the place's own pack, searched first for her; `keyOf` the
 * map key of a pack's place (for "Sent before: …, at 4. The Customs Shed."). On a phone the sheets rise from the foot;
 * on a tablet they stand at the right, as the find sheet does.
 */
export function usePersonThings({
  db,
  user,
  campaign,
  row,
  pieces,
  placePack,
  placeName,
  phone = false,
  turns = null,
  keyOf,
  onEdit,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  row: GroupPlace | null;
  pieces: readonly Piece[];
  placePack: string | null;
  placeName: string;
  phone?: boolean;
  turns?: TurnClock | null;
  keyOf: (packId: string, entryId: string) => string | null;
  onEdit: (piece: Piece) => void;
  onChanged: () => void;
}) {
  const show = useToast();
  const userId = useLogUserId();
  const version = useLogVersion();
  const [setting, setSetting] = useState<{ holds: Map<string, { name: string; holds: PersonHolds }>; carriers: NamedCarrier[] } | null>(null);
  // The GM's sends; 'unread' when the log couldn't be read and nothing was read before. A failed read keeps the last good
  // one, as HoardSheet does, so a blip never reads as "nothing was sent" and offers a thing twice (#197's review S1).
  const [events, setEvents] = useState<LogEvent[] | 'unread' | null>(null);
  const [clock, setClock] = useState<Awaited<ReturnType<typeof loadClockChanges>>>(null);
  // Other places' names and pack entries, as read; their map key is applied while drawing (`keyOf` may read late).
  const [sentPlaces, setSentPlaces] = useState<Awaited<ReturnType<typeof loadSentPlaces>>>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const placeId = row?.place?.id ?? null;
  const people = [...new Set(pieces.flatMap((p) => personIdOf(p) ?? []))].sort().join(' ');

  // Her entry and the items, read on this device as the pieces' names are (the kept copy, so offline too), and who can
  // take a thing. Only where a piece names a person.
  useEffect(() => {
    if (!people) return;
    let live = true;
    // A failed read of her entry keeps what was last read (no Carries line before a first good one); a failed read of
    // who can take a thing keeps the last list.
    const settle = (rows: Awaited<ReturnType<typeof loadCampaignPacksAndEntries>>, carriers: NamedCarrier[] | null) => {
      if (!live || !rows) return;
      const entries = rows.entries;
      const order = rows.packs.map((p) => p.packId);
      const holds = new Map<string, { name: string; holds: PersonHolds }>();
      for (const id of people.split(' ')) {
        const person = personOf(entries, id, order, placePack);
        const found = person ? personHolds(person, entries, order) : null;
        if (person && found && found.things.length > 0) holds.set(id, { name: person.name.trim() || 'Someone', holds: found });
      }
      setSetting((was) => ({ holds, carriers: carriers ?? was?.carriers ?? [] }));
    };
    void Promise.all([loadCampaignPacksAndEntries(db, userId, campaign.id), loadCarriers(db, campaign.id)]).then(
      ([rows, carriers]) => settle(rows, carriers),
      () => settle(null, null),
    );
    return () => {
      live = false;
    };
  }, [db, userId, campaign.id, people, placePack, version]);

  const carrying = !!setting && setting.holds.size > 0;
  // The GM's sends at every place (dg-12), and the clock's changes for "Sent to Wren, turn 3." (TR1).
  useEffect(() => {
    if (!carrying) return;
    let live = true;
    const failed = () => live && setEvents((was) => was ?? 'unread');
    void loadCommandLog(db, campaign.id, giveFind.name).then((found) => (found ? live && setEvents(found) : failed()), failed);
    void loadClockChanges(db, campaign.id).then((found) => live && setClock(found), () => live && setClock(null));
    return () => {
      live = false;
    };
  }, [db, campaign.id, carrying, tick, row, version]);

  const read = Array.isArray(events) ? events : null;
  const sent = useMemo(() => sentHeld(read ?? []), [read]);
  // Other places' names, for "Sent before" (the numbered name, as the card says it).
  const elsewhere = [...new Set([...sent.values()].map((s) => s.placeId).filter((id) => id !== placeId))].sort().join(' ');
  useEffect(() => {
    if (!elsewhere) return;
    let live = true;
    // A failed read keeps the names last read; with none, "Sent before" names no place.
    void loadSentPlaces(db, elsewhere.split(' ')).then(
      (found) => live && found && setSentPlaces(found),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [db, elsewhere]);
  /** "4. The Customs Shed": a place's numbered name, as the card says it; null when it couldn't be read. */
  const placeNameOf = (id: string): string | null => {
    const p = sentPlaces?.get(id);
    return p ? keyedName(p.packId && p.entryId ? keyOf(p.packId, p.entryId) : null, p.name) : null;
  };

  const nameOf = useCallback((id: string) => setting?.carriers.find((c) => c.actorId === id)?.name ?? 'someone', [setting]);
  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };
  /** Her things and where each went; null while her entry or the log is still being read (no line flashes "held"). */
  const statesOf = (piece: Piece): HeldState[] | null => {
    const id = personIdOf(piece);
    const held = id && setting ? setting.holds.get(id) : undefined;
    return held && read ? heldStates(held.holds, sent) : null;
  };
  /** Her log couldn't be read and nothing was read before: her piece says so in plain words, and offers no send. */
  const unreadOf = (piece: Piece): boolean => {
    const id = personIdOf(piece);
    return events === 'unread' && !!id && !!setting?.holds.has(id);
  };
  const sentStep = (seq: number): string | null => {
    if (!clock) return null;
    const seconds = secondsAt({ seq }, clock.changes, clock.seconds);
    return seconds === null ? null : sharedStep(seconds, turns);
  };

  async function send(to: string | null, thing: HeldState) {
    if (!placeId || busy || !open) return;
    setBusy(true);
    const result = await sendOne(to, placeId, thing);
    setBusy(false);
    if (!result.ok) return show({ text: result.message, error: true });
    // Back to her sheet, which says where it went (page 50).
    setOpen({ piece: open.piece, step: 'person', key: null });
    refresh();
    const eventId = result.value.eventId;
    show({
      text: heldSentWords(thing, to, nameOf),
      onUndo: () =>
        void runCommand(registry, db, user, undoFind, { campaignId: campaign.id, eventId }).then((undone) => {
          refresh();
          if (!undone.ok) show({ text: undone.message, error: true });
        }),
    });
  }

  /** One thing a send, no coin; its row is her held key alone (piece E), never a hoard row. */
  const sendOne = (to: string | null, at: string, thing: HeldState) =>
    runCommand(registry, db, user, giveFind, {
      campaignId: campaign.id,
      to,
      placeId: at,
      things: [thing.libraryEntryId ? { libraryEntryId: thing.libraryEntryId, qty: thing.qty } : { name: thing.name, qty: thing.qty }],
      coins: {},
      rows: [thing.key],
    });

  /**
   * Take it back (TR1), here or from a "Sent before" line wherever she is now (dgc-5): the send's Undo, at once, with a
   * toast whose Undo sends it to the same hands again, from the place it was first sent (#228); refused, the error toast
   * with the reason.
   */
  async function takeBack(thing: HeldState) {
    if (busy || !thing.sent) return;
    const went = thing.sent;
    setBusy(true);
    const undone = await runCommand(registry, db, user, undoFind, { campaignId: campaign.id, eventId: went.eventId });
    setBusy(false);
    if (!undone.ok) return show({ text: undone.message, error: true });
    refresh();
    show({
      text: heldTakenBackWords(thing, went.to, nameOf),
      onUndo: () =>
        void sendOne(went.to, went.placeId, thing).then((again) => {
          refresh();
          if (!again.ok) show({ text: again.message, error: true });
        }),
    });
  }

  const states = open ? statesOf(open.piece) : null;
  const held = open && setting ? setting.holds.get(personIdOf(open.piece) ?? '') : undefined;
  const personName = held?.name ?? '';
  const thing = open && states && open.key ? (states.find((s) => s.key === open.key) ?? null) : null;
  const here = states ? states.filter((s) => s.sent === null || s.sent.placeId === placeId) : [];
  const before = states ? states.flatMap((s) => (s.sent !== null && s.sent.placeId !== placeId ? [{ thing: s, went: s.sent }] : [])) : [];
  /** Where a sent thing went, on its own sheet: "Sent to Wren, turn 3." from here; from another place, that place too (sb4-13). */
  const wentWords = (went: HeldSend): string =>
    went.placeId === placeId ? sentPieceWords(went.to, nameOf, sentStep(went.seq)) : sentThereWords(went.to, nameOf, placeNameOf(went.placeId), sentStep(went.seq));
  const close = () => setOpen(null);
  const sheets =
    open && states ? (
      open.step === 'person' || !thing ? (
        <PersonSheetView
          name={personName}
          over={placeName || undefined}
          words={open.piece.text}
          rows={here}
          before={before.map(({ thing: s, went }) => ({ thing: s, line: sentBeforeWords(s, went.to, nameOf, placeNameOf(went.placeId)) }))}
          missing={missingWords(held?.holds.missing ?? 0, personName)}
          nameOf={nameOf}
          side={!phone}
          onThing={(s) => setOpen({ ...open, step: 'thing', key: s.key })}
          onEdit={() => {
            setOpen(null);
            onEdit(open.piece);
          }}
          onClose={close}
        />
      ) : open.step === 'thing' ? (
        <FoundThingSheet
          hoard={{ name: heldThingWords(thing), words: sentence(thing.note), rows: [] }}
          over={personName}
          side={!phone}
          went={thing.sent ? wentWords(thing.sent) : null}
          onCharacter={() => setOpen({ ...open, step: 'who' })}
          onStash={() => void send(null, thing)}
          onTakeBack={() => void takeBack(thing)}
          onClose={close}
        />
      ) : (
        <WhichCharacter side={!phone} characters={(setting?.carriers ?? []).filter((c) => c.actorId !== null)} onBack={() => setOpen({ ...open, step: 'thing' })} onPick={(id) => void send(id, thing)} onClose={close} />
      )
    ) : null;

  return {
    /** Whether her piece's words and arrow open her sheet: she holds something an attached pack has (page 50). */
    opens: (piece: Piece): boolean => statesOf(piece) !== null,
    open: (piece: Piece) => setOpen({ piece, step: 'person', key: null }),
    /** Her Carries line, or null: a piece that names no one who carries anything, or still loading, is as today. */
    carriesOf: (piece: Piece): ReactNode => {
      if (unreadOf(piece)) return <span className="person-carries">{carriesUnreadWords(setting?.holds.get(personIdOf(piece) ?? '')?.name ?? 'Someone')}</span>;
      const found = statesOf(piece);
      return found ? <CarriesLine {...carriesWords(found, nameOf)} /> : null;
    },
    /** Whether her sheet is open (Move on plain behind it, as TR1). */
    isOpen: sheets !== null,
    sheets: sheets && <SheetScope.Provider value>{sheets}</SheetScope.Provider>,
  };
}

/**
 * Her sheet (page 50, "the person's dress" of the find sheet, TR1): over the title the place, the title her name, the
 * piece's words, "Carries" and a row a thing (its note under it, or where it went), the quiet line for things not in the
 * packs, "Sent before" for things sent at another place, each a row that opens that thing (dgc-5, #228: a 44 px target,
 * its quiet words and tick as page 50 draws them, the row's arrow), and "Edit the piece's words" last. No "Send all", no
 * accent.
 */
export function PersonSheetView({
  name,
  over,
  words,
  rows,
  before,
  missing,
  nameOf,
  onThing,
  onEdit,
  onClose,
  side = false,
  preview = false,
}: {
  name: string;
  over?: string;
  words: string;
  rows: readonly HeldState[];
  /** "Sent before: Warden’s lantern, to Wren, at 4. The Customs Shed.", one a thing sent at another place, and that thing. */
  before: readonly { thing: HeldState; line: string }[];
  missing: string | null;
  nameOf: (id: string) => string;
  onThing: (thing: HeldState) => void;
  onEdit: () => void;
  onClose: () => void;
  side?: boolean;
  preview?: boolean;
}) {
  return (
    <Dialog label={name} over={over} side={side} onClose={onClose} preview={preview}>
      <div className="hoard-sheet person-sheet" data-toast-above>
        {words.trim() && <p className="hoard-sheet__words">{words}</p>}
        <p className="label person-sheet__label">Carries</p>
        <RowList label="Carries" dotted>
          {rows.map((s) => (
            <ListRow
              key={s.key}
              title={<span className="hoard-sheet__name">{heldThingWords(s)}</span>}
              sub={s.sent ? <SentLine text={sentHereWords(s.sent.to, nameOf)} tick /> : (s.note ?? undefined)}
              onOpen={() => onThing(s)}
            />
          ))}
          {missing && <p className="person-sheet__quiet">{missing}</p>}
          {before.map(({ thing, line }) => (
            <ListRow
              key={thing.key}
              title={
                <span className="person-sheet__before">
                  <Icon name="tick" size={16} />
                  <span>{line}</span>
                </span>
              }
              openLabel={line}
              onOpen={() => onThing(thing)}
            />
          ))}
          <EditWordsRow onEdit={onEdit} />
        </RowList>
      </div>
    </Dialog>
  );
}
