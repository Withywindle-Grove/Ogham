// The GM's place page (December dec-7 piece 5b; docs/plans/dec-7-5-place-page-and-map.md; rulings mc-31, mc-47,
// mc-50, mc-52, po-1, po-2, po-3; the lead's rulings on 5b's six scope checks, 2026-11-14). Approved pictures (pg-1,
// Francis 2026-11-13): design-december-mockups `11-gm-place-page-todays-parts.html` @ 77acc261, frames 1a, 1b, 2a, 2b,
// 4a to 4c, 5 to 8; `12-move-on-rows-and-waiting-proposals.html` @ 4ce2dba0, MO1 and W1 to W3.
//
// The Location's card redrawn (plan scene-point-to-point B3; rulings p2p-10 to p2p-12, p2p-14, p2p-15; page 23,
// `23-locations-and-reading-ahead.html` on design-p2p-reading-ahead, frames LA1, LA3, LA4, approved 2026-11-18,
// replacing page 11's frame 1b in these parts).
// The trail and reading ahead (plan scene-point-to-point B2; rulings p2p-8, p2p-9; page 23, LA1 to LA4, approved
// 2026-11-18; the driver's ruling "A", 2026-11-19): the trail reads and never moves the party. A tap on a place up it
// (an Area, or any place that is not a Region) opens the Locations panel: that place first, the party's own row marked
// "The party is here." with no tap, then each place in it, by key. A Region is plain words until its panel (LA2b) is
// approved. A row opens that place to read ahead: its own card, with the line "Reading ahead. The party is at …" and
// "Back to the party" (on a phone, in the fixed bar); the top and the right column stay the party's. The eyes are drawn,
// and a tap on one (or on any change to the place) explains in a pop-up that the party isn't there: nothing is written
// while reading ahead, but for the eye on the Knowledge of the Area the party is in (ppf-2, 2026-11-20).
// The page is otherwise the place the party is in. Every part of today's place card has its place:
//   the card at the left: the trail (each place up it a tap that opens its Locations panel), the name numbered as the key
//   writes it with no line under it, the rule's icon buttons and Move on (the footprints, ⚑ 2; the accent, or plain
//   while something waits) at its right;
//   the book's own text for the GM, folded under the head ("From the book, for the GM", gt-1, page 15 home B; the
//   whole Scene's row S14), never sent: only the GM's device reads the place's pack entry;
//   Knowledge and Rules (a place from a pack); no "Players see" and no Rename (p2p-11); the calls line only where a
//   call of the place's adventure comes from a person there (B19; p2p-15, ⚑ 8), after Knowledge and Rules as page 11's
//   frame 1b placed it;
//   "Checks here" (the place's own check with its toggle and the pack's own sentence, the setting's as plain lines);
//   the pieces with no heading: the picture first, then the description once, its words naming other pieces bold and
//   underlined, then each further piece led by its own word, no kind word, each with the bare eye; the form in place;
//   at the foot "+ Piece" and "+ Picture", the count and Hide all; "Notes" fully folded, the source line inside.
//   the right column: "Waiting for you" (one part with Players: SceneTime's encounter cards, then what players ask),
//   "Spots here" at a place that holds spots (plain rows, no eye and no count: frame 8), the place's Tables, the marching
//   order.
//   a phone: one column, what waits first, the spots after the head; Move on fixed above the tab bar with the rule's
//   button beside it (set 1's frame 22; ⚑ 12).
// The map (5m-2, 5m-3; the whole Scene's S13): `PlaceMapPart`'s card, or "+ Map" where the pack names one and the campaign
// has no copy; under the head at a place that holds spots, in the right column at a spot, a "The map" button on a
// phone; nothing where no map is named. Left out, as ruled: "People of the harbour" (later), an eye on a spot (5s), the facts row (5f), the pack's facts, headed sections and town watch on
// the card (they are in Knowledge, 6a). A town keeps today's town screen (5t). Drawn in the book's faces (po-3).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useHeadFits } from './placeHeadFit.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { isEncounterCheck } from '../modules/expedition/checks.ts';
import type { Check } from '../modules/expedition/modes.ts';
import { inSentence } from '../modules/expedition/moveOn.ts';
import { knowledgeSourceLine, readPlaceFacts, type PlaceFacts } from '../modules/expedition/placeFacts.ts';
import type { PackPlaceEntry } from '../modules/expedition/placeFromPack.ts';
import { isSettlement, loadPackPlaceEntry, loadPackPlaces, loadPackTables, loadPlaceLines, shownCount, type GroupPlace, type Piece, type Place } from '../modules/expedition/placePlay.ts';
import { checkChanceWords, checkWhenWords, loadPlaceChain, placeRulesOf, type ChainEntry, type PlayersRule } from '../modules/expedition/placeRules.ts';
import { ancestorsOf, childrenOf, keyedName, placeOf, type PackPlace } from '../modules/expedition/placeTree.ts';
import { chanceWords } from '../modules/expedition/play.ts';
import { loadReadAhead, type ReadAhead } from '../modules/expedition/readAhead.ts';
import type { ReadTable } from '../modules/expedition/tables.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { BookFaces } from '../ui/BookFaces.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { DiceWords } from '../ui/dice.tsx';
import { Icon, StepIcon } from '../ui/icons.tsx';
import { MoveOnSheet } from '../ui/MoveOnParts.tsx';
import { ListRow, RowList, SkeletonRows, StackedButton, Switch } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { CallsLine, type CallsAt } from './CallsToAdventure.tsx';
import { PlaceMapPart } from './PlaceMap.tsx';
import { TableListItem } from './EncounterTables.tsx';
import { KnowledgeSheet, useKnowledgeSharing } from './KnowledgeSheet.tsx';
import type { TurnClock } from '../modules/expedition/placeKnowledge.ts';
import { MoveOnWiring } from './MoveOn.tsx';
import { useHoards } from './HoardSheet.tsx';
import { AddPiece, NotesFold, PictureSection, PieceRow, usePieceNames } from './PlaceCard.tsx';
import { BookTextFold, PlaceTable } from './PlaceFacts.tsx';
import { PlacePicker } from './PlacePicker.tsx';
import { PlaceRuleButtons, PlaceRulesSheet, useStandInCheck } from './PlaceRules.tsx';
import { usePlaceActions } from './placeActions.ts';
import { accentOwner, useHoldAccent, useStripIsPaused, useWaitingAccentItem } from './sceneWaiting.tsx';
import { WaitingForYou } from './WaitingForYou.tsx';
import './PlaceCard.css';
import './GmPlacePage.css';

export interface GmPlacePageProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The expedition under way (Move on reads the ways from where its party is). */
  expeditionId: string;
  group: number;
  /** "Group 2" when the party is split, else null. */
  groupLabel: string | null;
  /** The group's current place (null: none yet in this expedition). */
  row: GroupPlace | null;
  /** The mode's checks (the setting's, until the place's own stands in). */
  checks: readonly Check[];
  /** The campaign's places named or picked before, newest first (Somewhere else…'s Recently visited). */
  recent: readonly Place[];
  regionalTables?: Record<string, unknown>;
  /** The ground around the group in a mode that counts travel by the day; null otherwise. */
  terrain?: string | null;
  /** A phone (one column; Move on fixed above the tab bar). */
  phone?: boolean;
  /** One column on a wider screen (the day's layout puts the page beside the day's controls). */
  oneColumn?: boolean;
  /** The marching order, the last thing in the right column. */
  marching?: ReactNode;
  /** The expedition's step on the clock, for the Knowledge sheet's "Shared with the players, turn 9." (P4). */
  turns?: TurnClock | null;
  onChanged: () => void;
}

/**
 * A place's name with its key in front, the number and a full stop (p2p-3, 2026-11-18: "1. The Jetty"); a name that
 * already starts with its key ("1 The Jetty", "1. The Jetty") is not doubled. The full stop is the app's; the name's
 * capitals are the pack's.
 */
export function numberedName(key: string | null, name: string): string {
  return keyedName(key, name);
}

/**
 * The spots in the order of the map's key ("1", "2", … "10"), those without a key after them in the pack's order:
 * the pack's rows come back in no set order, and the key is the order the GM reads the map in.
 */
export function byKey<T extends { key: string | null }>(places: readonly T[]): T[] {
  return places
    .map((p, at) => ({ p, at }))
    .sort((a, b) => (a.p.key && b.p.key ? a.p.key.localeCompare(b.p.key, undefined, { numeric: true }) : a.p.key ? -1 : b.p.key ? 1 : 0) || a.at - b.at)
    .map(({ p }) => p);
}

const NO_FACTS: PlaceFacts = { identity: '', facts: [], sections: [], tableIds: [], watch: null, text: null };

/**
 * The pop-up a tap on an eye (or on any change to the place) opens while reading ahead (the driver's ruling "A",
 * 2026-11-19: never a disabled button; the blocked action's pattern in 06: a short title, why, the way forward). The
 * words are a ⚑ for Francis.
 */
export const NOT_HERE = { title: "The party isn't here", why: "You're reading ahead. Show and change what is here once the party arrives." } as const;

/** The same place of the same pack. */
const samePlace = (a: Pick<PackPlace, 'packId' | 'entryId'> | null | undefined, b: Pick<PackPlace, 'packId' | 'entryId'> | null | undefined): boolean => !!a && !!b && a.packId === b.packId && a.entryId === b.entryId;

/** A trail's place opens the Locations panel unless it is a Region (LA2b, the Region's own panel, is a proposal). */
export const opensPanel = (place: Pick<PackPlace, 'type'>): boolean => place.type !== 'region';

/** The pieces in the book's order (p2p-10): the description once, first (a long one the pack split keeps its parts in order), then the rest as they stand. */
const bookOrder = (pieces: readonly Piece[]): Piece[] => [...pieces.filter((p) => p.kind === 'description'), ...pieces.filter((p) => p.kind !== 'description')];
/** The other pieces' own words, which the description marks. */
const namedIn = (pieces: readonly Piece[]): string[] => pieces.flatMap((p) => (p.kind !== 'description' && p.lead ? [p.lead] : []));

export function GmPlacePage({ db, user, campaign, expeditionId, group, groupLabel, row, checks, recent, regionalTables, terrain = null, phone = false, oneColumn = false, marching = null, turns = null, onChanged }: GmPlacePageProps) {
  const show = useToast();
  const place = row?.place ?? null;
  const pieces = row?.pieces ?? [];
  const picture = row?.picture ?? null;
  const single = phone || oneColumn;

  // The pack's places (the trail, the spots, the place's kind and pack).
  const [packPlaces, setPackPlaces] = useState<readonly PackPlace[] | null>(null);
  const fromPack = !!place?.pack;
  useEffect(() => {
    if (!fromPack) return;
    let live = true;
    void loadPackPlaces(db, campaign.id).then((found) => live && setPackPlaces(found));
    return () => {
      live = false;
    };
  }, [db, campaign.id, fromPack]);
  const current = place?.pack && packPlaces ? (placeOf(packPlaces, place.pack.packId, place.pack.entryId) ?? null) : null;
  const spots = current && packPlaces ? byKey(childrenOf(packPlaces, current)) : [];

  // The trail's Locations panel, and the place read ahead (B2; p2p-8, p2p-9). Reading ahead holds while the party stays
  // where it was when the GM opened it: the party moving (here or on another device) brings the page back to the party.
  const [panelOf, setPanelOf] = useState<PackPlace | null>(null);
  const [aheadAt, setAheadAt] = useState<{ at: PackPlace; from: string } | null>(null);
  const reading = aheadAt && current && place && aheadAt.from === place.id && !samePlace(aheadAt.at, current) ? aheadAt.at : null;
  // The card's own place: the one read ahead, else the party's.
  const shown = reading ?? current;
  const trail = shown && packPlaces ? ancestorsOf(packPlaces, shown).reverse() : [];
  const readAhead = (at: PackPlace) => {
    setPanelOf(null);
    if (place) setAheadAt(samePlace(at, current) ? null : { at, from: place.id });
  };
  const blocked = useBlockedSheet();
  const notHere = () => blocked.explain(NOT_HERE.title, NOT_HERE.why);

  // The place read ahead: its pack entry, and its page (the campaign's place for it, else composed from the pack).
  const aheadKey = reading ? `${reading.packId}/${reading.entryId}` : '';
  const [aheadTry, setAheadTry] = useState(0);
  const [ahead, setAhead] = useState<{ key: string; entry: PackPlaceEntry | null; page: ReadAhead | null } | null>(null);
  useEffect(() => {
    if (!reading) return;
    let live = true;
    void (async () => {
      const found = await loadPackPlaceEntry(db, reading.packId, reading.entryId);
      const page = found ? await loadReadAhead(db, campaign.id, found) : null;
      if (live) setAhead({ key: `${aheadKey}#${aheadTry}`, entry: found, page });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and entry; a try reads it again
  }, [db, campaign.id, aheadKey, aheadTry]);
  const aheadNow = reading && ahead?.key === `${aheadKey}#${aheadTry}` ? ahead : null;

  // Each row's one line in the Locations panel: the place's own and those of the places in it.
  const panelIds = panelOf && packPlaces ? [panelOf.entryId, ...childrenOf(packPlaces, panelOf).map((p) => p.entryId)] : [];
  const panelKey = panelOf ? `${panelOf.packId}:${panelIds.join(',')}` : '';
  const [panelLines, setPanelLines] = useState<{ key: string; lines: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!panelKey || !panelOf) return;
    let live = true;
    void loadPlaceLines(db, panelOf.packId, panelIds).then((found) => live && setPanelLines({ key: panelKey, lines: found }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and the places
  }, [db, panelKey]);
  // The map (S13): a spot no map names shows the map of the place it is in, named over the pop-up's title.
  const upTrail = (entryId: string) => {
    const at = packPlaces && current ? placeOf(packPlaces, current.packId, entryId) : undefined;
    return at && packPlaces ? [entryId, ...ancestorsOf(packPlaces, at).map((p) => p.entryId)] : [entryId];
  };
  const nameOf = (entryId: string) => (packPlaces && current ? (placeOf(packPlaces, current.packId, entryId)?.name ?? null) : null);

  // The pack's entry: the place's line, its Knowledge, its tables, its page.
  const packKey = place?.pack ? `${place.pack.packId}/${place.pack.entryId}` : '';
  const [entry, setEntry] = useState<{ key: string; entry: PackPlaceEntry | null } | null>(null);
  useEffect(() => {
    if (!packKey || !place?.pack) return;
    let live = true;
    void loadPackPlaceEntry(db, place.pack.packId, place.pack.entryId).then((found) => live && setEntry({ key: packKey, entry: found }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and entry
  }, [db, packKey]);
  const readEntry = entry?.key === packKey ? entry.entry : null;
  const facts = readEntry ? readPlaceFacts(readEntry.data) : null;

  // The place's tables (the Tables card).
  const tableKey = facts && place?.pack ? `${place.pack.packId}:${facts.tableIds.join(',')}` : '';
  const [tables, setTables] = useState<{ key: string; tables: Map<string, ReadTable> } | null>(null);
  useEffect(() => {
    if (!tableKey || !facts || !place?.pack) return;
    let live = true;
    void loadPackTables(db, place.pack.packId, facts.tableIds).then((found) => live && setTables({ key: tableKey, tables: found }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and the tables
  }, [db, tableKey]);
  const loadedTables = tables?.key === tableKey ? tables.tables : null;
  const [openTable, setOpenTable] = useState<ReadTable | null>(null);

  // Each spot's one line ("Spots here").
  const spotKey = current && spots.length > 0 ? `${current.packId}:${spots.map((s) => s.entryId).join(',')}` : '';
  const [spotLines, setSpotLines] = useState<{ key: string; lines: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!spotKey || !current) return;
    let live = true;
    void loadPlaceLines(
      db,
      current.packId,
      spots.map((s) => s.entryId),
    ).then((found) => live && setSpotLines({ key: spotKey, lines: found }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and the spots
  }, [db, spotKey]);
  const lines = spotLines?.key === spotKey ? spotLines.lines : null;

  // The place's rules and its own check, and those of the places it sits in (rg-4, mc-51): the card's own place, so
  // reading ahead shows the read place's check and Rules (the head's rule buttons are the party's, and hidden then).
  const chainOf = reading ? { packId: reading.packId, entryId: reading.entryId } : place?.pack ? { packId: place.pack.packId, entryId: place.pack.entryId } : null;
  const chainKey = chainOf ? `${chainOf.packId}/${chainOf.entryId}` : '';
  const [chain, setChain] = useState<{ key: string; chain: ChainEntry[] } | null>(null);
  useEffect(() => {
    if (!chainKey || !chainOf) return;
    let live = true;
    void loadPlaceChain(db, chainOf.packId, chainOf.entryId).then((found) => live && setChain({ key: chainKey, chain: found ?? [] }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and entry
  }, [db, chainKey]);
  const placeChain = chain?.key === chainKey ? chain.chain : [];
  const settingCheck = checks.find((c) => isEncounterCheck(c, 'dot'))?.name ?? null;
  const [rulesChanged, setRulesChanged] = useState(0);
  const changed = () => {
    setRulesChanged((n) => n + 1);
    onChanged();
  };
  const own = useStandInCheck({ db, user, campaignId: campaign.id, chain: placeChain, settingCheck, onChanged, outside: rulesChanged });
  // The rules with a button of their own, beside Move on (mc-49, mc-52): every one of them, open to players or not.
  const ruleButtons: PlayersRule[] = own.switches
    ? placeRulesOf(placeChain, own.switches)
        .filter((r) => r.rule.button)
        .map((r) => ({ group, placeName: r.owner.name, name: r.rule.name, blocks: r.rule.blocks, button: r.rule.button }))
    : [];

  const actions = usePlaceActions({ db, user, campaign, group, groupLabel, row, regionalTables, packPlaces, onChanged });
  const { editing, setEditing, who } = actions;
  // B15 (page 30): a hoard's piece opens its hoard; a magic item's eye also names the item wherever it is held.
  const hoards = useHoards({ db, user, campaign, row, place: readEntry?.data ?? null, placeName: place ? numberedName(current?.key ?? null, place.name) : '', phone, onEdit: setEditing, onChanged });

  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  // The eye on each section of the Knowledge sheet (P4, p4s-2): shared with this group. Reading ahead, it works on the
  // Knowledge of a place the party's Location sits in (its Area: ppf-2, the one thing written while reading ahead);
  // anywhere else read ahead, the page's pop-up and nothing written, as every other eye there (B2).
  const readingHolder = !!reading && !!current && !!packPlaces && ancestorsOf(packPlaces, current).some((p) => samePlace(p, reading));
  const sharing = useKnowledgeSharing({ db, user, campaignId: campaign.id, group, groupLabel, place: chainOf, turns, open: knowledgeOpen, blocked: reading && !readingHolder ? notHere : undefined });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [elsewhere, setElsewhere] = useState(false);

  // What waits: the strip's encounter cards and the list's own items. While any wait, Move on is plain (W1).
  useHoldAccent();
  const paused = useStripIsPaused();
  // One accent (the #785 review; st-2): Move on, unless no session runs (Start or Resume session) or the open item of
  // "Waiting for you" has an answer, its first then the accent (W1; S8). An open item with no answer (a player's item)
  // gives none, so Move on holds it then (the model's rule 6).
  const waitingAccent = useWaitingAccentItem();
  const moveOnAccent = accentOwner({ running: !paused, page: true, waiting: waitingAccent !== null && waitingAccent !== undefined }) === 'move';

  const total = pieces.length + (picture ? 1 : 0);
  const shownTotal = shownCount(pieces) + (picture?.shown ? 1 : 0);
  const name = place ? numberedName(current?.key ?? null, place.name) : 'Where are we?';
  // The pack's source line, "From your adventure: The Reed Marches, p. 38.": in Knowledge, and inside Notes (p2p-12; the
  // card's foot line and its lone kind word went, LA1's fixes).
  const source = current ? knowledgeSourceLine(current.packKind, current.packName, readEntry?.data.source) : null;
  // The pieces in the book's order (p2p-10); the other pieces' own words are what the description marks.
  const ordered = bookOrder(pieces);
  const named = namedIn(pieces);
  // The pack entries' names for the GM's small line (Q7): read on this device, the stored ids kept.
  const names = usePieceNames(db, campaign.id, pieces);

  // The card's own place while reading ahead (B2): its name, its entry, its facts and its source line. The party's
  // stand as they are for the top, the right column and the line that says where the party is.
  const cardName = reading ? numberedName(reading.key, reading.name) : name;
  const cardEntry = reading ? (aheadNow?.entry ?? null) : readEntry;
  const cardEntryRead = reading ? aheadNow !== null : entry?.key === packKey;
  const cardFacts = reading ? (cardEntry ? readPlaceFacts(cardEntry.data) : null) : facts;
  const cardSource = reading ? knowledgeSourceLine(reading.packKind, reading.packName, cardEntry?.data.source) : source;

  // Move on carries the footprints, the app's `travel` mark, as every approved frame draws it (⚑ 2, ruled 2026-11-18:
  // "Yes, footprints"); Set place, from nowhere, keeps it too.
  const moveOn = (
    <button type="button" className={`${moveOnAccent ? 'button-primary' : 'button-secondary'} place-page__move`} onClick={() => setMoveOpen(true)}>
      <StepIcon name="travel" size={20} />
      {place ? 'Move on' : 'Set place'}
    </button>
  );
  // ap-16 (page 16, T12 A): the actions beside the name while its column keeps its floor (11-01a); on a narrower card,
  // on a line of their own under the name and its line, at the right. The card's own width decides (placeHeadFit.ts).
  const titleRow = useRef<HTMLDivElement>(null);
  // Reading ahead the head has no actions (LA3): nothing to fit.
  const beside = useHeadFits(titleRow, !phone && !reading, ruleButtons.length);
  const headActions = (
    <div className="place-page__head-actions">
      <PlaceRuleButtons rules={ruleButtons} />
      {moveOn}
    </div>
  );

  const waiting = (
    <WaitingForYou
      db={db}
      user={user}
      campaign={campaign}
      onChanged={onChanged}
      // With nothing waiting it collapses to "Nothing waits." (S8; page 16 T1, T12), at a place with spots too (the
      // approval's fix 5, 2026-11-18: frame 1a's leaving it out is overtaken), and in the day view's one column; only a
      // phone still leaves it out (T8a; #958's review).
      quiet={phone}
    />
  );

  // The place's map (S13; frames 1a, 1b, 2c, 4a, 4b, 4d): in the card under "Players see" at a place that holds spots,
  // in the right column under "Waiting for you" at a spot, and a button in the card on a phone or in one column. It
  // waits for the pack's places, so a spot finds the map of the place it is in.
  const mapPart = place && (!place.pack || packPlaces) && (
    <PlaceMapPart key={place.id} db={db} user={user} campaignId={campaign.id} place={place} upTrail={upTrail} nameOf={nameOf} phone={phone} />
  );
  const mapInCard = !single && spots.length > 0;

  const spotsCard = spots.length > 0 && (
    <section className="place-page__box" aria-label="Locations">
      {/* p2p-1: "Spots here" reads "Locations". */}
      <h3 className="place-page__heading">Locations</h3>
      <ul className="place-page__rows">
        {spots.map((s) => (
          <li key={s.entryId} className="place-page__spot">
            <span className="place-page__spot-name">{numberedName(s.key, s.name)}</span>
            {lines?.get(s.entryId) && <span className="place-page__spot-line">{lines.get(s.entryId)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );

  const found = loadedTables && facts ? facts.tableIds.flatMap((id) => (loadedTables.get(id) ? [loadedTables.get(id)!] : [])) : [];
  const tablesCard = facts && facts.tableIds.length > 0 && (
    <section className="place-page__box" aria-label="Tables">
      <h3 className="place-page__heading">Tables</h3>
      {loadedTables === null ? (
        <SkeletonRows rows={Math.min(3, facts.tableIds.length)} label="Loading the tables" />
      ) : found.length === 0 ? (
        <p className="place-page__hint">The tables it names aren't in your packs.</p>
      ) : (
        <div className="table-list">
          {found.map((t) => (
            <TableListItem key={t.id} table={t} tag={t.die ?? ''} onOpen={() => setOpenTable(t)} />
          ))}
        </div>
      )}
    </section>
  );

  const standIn = own.standIn;
  const settingLines = !standIn || !standIn.inForce ? checks : [];
  const otherOwn = own.check && !own.check.replaces ? own.check : null;
  const checksPart = (standIn || otherOwn || settingLines.length > 0) && (
    <div className="place-page__section">
      <h3 className="place-page__heading">Checks here</h3>
      {/* The check's card (p2p-14; LA1): its line and toggle, then the pack's own sentence with its die, word for word;
          no sentence of the app's, in force or not (the toggle's cross and the setting's line below say it is off). */}
      {standIn && (
        <div className="place-page__check">
          <Switch label={<DiceWords>{checkLineWords(standIn.name, standIn.check, standIn.eachMove)}</DiceWords>} on={standIn.inForce} onChange={(on) => (reading ? notHere() : void own.toggleCheck(on))} />
          {standIn.sentence && (
            <p className="place-page__check-sentence">
              <DiceWords>{standIn.sentence}</DiceWords>
            </p>
          )}
        </div>
      )}
      {(otherOwn || settingLines.length > 0) && (
        <ul className="place-page__rows">
          {otherOwn && (
            <li className="place-page__check-line">
              <DiceWords>{checkLineWords(otherOwn.name, otherOwn.check, otherOwn.eachMove)}</DiceWords>
            </li>
          )}
          {settingLines.map((c) => (
            <li key={c.id} className="place-page__check-line">
              <DiceWords>{`${c.name}, ${c.byTerrain ? 'by terrain' : (checkChanceWords(c.chance) ?? chanceWords(c.chance))}`}</DiceWords>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // The trail reads and never moves the party (p2p-8): a place up it opens its Locations panel; a Region is plain words
  // until its own panel is approved (LA2b).
  const head = (
    <>
      {trail.length > 0 && shown && (
        <nav className="place-page__trail" aria-label="Where it sits">
          <ol>
            {trail.map((p) => (
              <li key={p.entryId}>
                {opensPanel(p) ? (
                  <button type="button" className="button-quiet place-page__trail-link" aria-haspopup="dialog" onClick={() => setPanelOf(p)}>
                    {numberedName(p.key, p.name)}
                  </button>
                ) : (
                  <span className="place-page__trail-words">{numberedName(p.key, p.name)}</span>
                )}
                <Icon name="chevron" size={16} />
              </li>
            ))}
            <li aria-current="location" className="place-page__trail-here">
              {cardName}
            </li>
          </ol>
        </nav>
      )}
      <div ref={titleRow} className={`place-page__title-row${beside ? '' : ' place-page__title-row--under'}`}>
        <div className="place-page__title-words">
          {/* No line under the name (p2p-10; the description is the first piece, shown once). */}
          <h2 className="place-page__name">{cardName}</h2>
          {terrain && !reading && <p className="place-page__around">{`Around them: ${terrain}`}</p>}
        </div>
        {/* Reading ahead the head has no Move on and no rule's button (LA3). */}
        {!phone && !reading && headActions}
      </div>
    </>
  );

  // Reading ahead (p2p-9; LA3, LA4): one line at the very top of the card, on the wash, with "Back to the party" at its
  // right; on a phone the line keeps its words and the button sits in the fixed bar.
  const backToParty = (
    <button type="button" className={`button-secondary${phone ? ' place-page__move' : ' place-page__back'}`} onClick={() => setAheadAt(null)}>
      <Icon name="players" size={20} />
      Back to the party
    </button>
  );
  const aheadLine = reading && (
    <div className="place-page__ahead">
      <p className="place-page__ahead-words" role="status">
        <strong>Reading ahead.</strong>
        {` The party is at ${name}.`}
      </p>
      {!phone && backToParty}
    </div>
  );

  const book = (reading || place?.pack) && (
    <div className="place-page__pair">
      <button
        type="button"
        className="button-secondary"
        onClick={() => (cardFacts ? setKnowledgeOpen(true) : show({ text: cardEntry === null && cardEntryRead ? "This place isn't in an attached pack any more." : 'Still reading the pack…' }))}
      >
        <Icon name="open-book" size={20} />
        Knowledge
      </button>
      <button type="button" className="button-secondary" onClick={() => setRulesOpen(true)}>
        <Icon name="scales" size={20} />
        Rules
      </button>
    </div>
  );

  // The count and Hide all at the foot, beside "+ Piece" (p2p-10; LA1). hx-2: Hide all only while something is shown
  // (a piece or the picture).
  const footEnd = total > 0 && (
    <span className="place-page__foot-end">
      <span className="place-page__count">{`${groupLabel ? `${groupLabel}: ` : ''}${shownTotal} of ${total} shown`}</span>
      {/* The stacked button, the closed eye above its word (LA1, LA4; Francis 2026-11-19: "Yes, as the frame"). */}
      {shownTotal > 0 && <StackedButton icon="eye-shut" label="Hide all" onClick={() => void actions.hideAll()} />}
    </span>
  );
  // No "Pieces" heading (p2p-10): the list stands under Checks here, the picture first, then the pieces in the book's
  // order.
  const piecesPart = place && row && (
    <div className="place-page__section">
      {total > 0 && (
        <ul className="place-page__rows place-page__pieces">
          <PictureSection key={`picture:${place.id}`} page="row" db={db} user={user} campaign={campaign} place={place} row={row} picture={picture} who={who} onChanged={onChanged} />
          {ordered.map((piece) => (
            <PieceRow
              key={piece.id}
              page
              piece={piece}
              names={names}
              named={named}
              onToggle={() => void (!piece.shown && hoards.isMagic(piece) ? hoards.showTruth(piece) : actions.togglePiece(piece))}
              onEdit={() => setEditing(piece)}
              onOpen={hoards.opens(piece) ? () => hoards.open(piece) : undefined}
              note={hoards.noteOf(piece)}
            />
          ))}
        </ul>
      )}
      {/* The foot: "+ Piece" and "+ Picture" at the left (the form in their place while open), the count and Hide all
          at the right; the form takes the whole line, so they stay in view under it. */}
      <div className="place-page__foot">
        {editing ? (
          <AddPiece
            key={`edit:${editing.id}:${editing.version}`}
            page
            first={false}
            editing={editing}
            who={who}
            onAdd={(kind, text) => actions.edit(editing, kind, text)}
            onRemove={() => void actions.remove(editing)}
            onClose={() => setEditing(null)}
          />
        ) : (
          <AddPiece
            key={place.id}
            page
            first={!pieces.some((p) => p.kind === 'description')}
            onAdd={actions.add}
            beside={<PictureSection key={`add:${place.id}`} page="add" db={db} user={user} campaign={campaign} place={place} row={row} picture={picture} who={who} onChanged={onChanged} />}
          />
        )}
        {footEnd}
      </div>
    </div>
  );

  // The pieces of the place read ahead (B2; LA3): drawn as the party's are, every eye closed (a show belongs to a visit,
  // and this place has none). A tap on an eye, on a piece, on "+ Piece", on "Edit notes", on the check's switch, on an
  // eye or the switch in the Rules sheet, or a send or a give in the Calls sheet explains in a pop-up (the driver's
  // ruling "A", 2026-11-19, and the local review of #1044): nothing is written. The rules and the calls stay readable. No picture row: the picture's own section runs the
  // party's visit.
  const aheadPieces = aheadNow?.page?.pieces ?? [];
  const aheadNamed = namedIn(aheadPieces);
  const aheadNames = usePieceNames(db, campaign.id, aheadPieces);
  const aheadPart = reading && (
    <div className="place-page__section">
      {aheadNow === null ? (
        <SkeletonRows rows={3} label="Reading the place" />
      ) : aheadNow.entry === null ? (
        <p className="place-page__hint">This place isn't in an attached pack any more.</p>
      ) : aheadNow.page === null ? (
        <div className="place-page__adds">
          <p className="place-page__hint">Couldn't read this place. Check your connection and try again.</p>
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setAheadTry((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {aheadPieces.length > 0 && (
            <ul className="place-page__rows place-page__pieces">
              {bookOrder(aheadPieces).map((piece) => (
                <PieceRow key={piece.id} page piece={piece} names={aheadNames} named={aheadNamed} onToggle={notHere} onEdit={notHere} />
              ))}
            </ul>
          )}
          <div className="place-page__foot">
            <div className="place-page__adds">
              <StackedButton icon="jigsaw-piece" label="+ Piece" onClick={notHere} />
            </div>
            {aheadPieces.length > 0 && (
              <span className="place-page__foot-end">
                <span className="place-page__count">{`0 of ${aheadPieces.length} shown`}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Calls to adventure (B19; p2p-15, ⚑ 8): in a settlement always; at a place from a pack only where one of its calls
  // comes from a person there (CallsLine decides, from the hooks); never at a place typed by hand. Reading ahead, the
  // same rule for the place read.
  const callsAt: CallsAt | null = reading
    ? reading.settlement
      ? { settlement: true }
      : { settlement: false, packId: reading.packId, key: reading.key, name: reading.name }
    : !place
      ? null
      : isSettlement(place)
        ? { settlement: true }
        : current
          ? { settlement: false, packId: current.packId, key: current.key, name: current.name }
          : null;
  const callsName = reading ? aheadNow?.page?.place.playersName || reading.name : place?.playersName || place?.name || '';

  // The card in LA1's order: the trail and the head, the book's text for the GM (until B17), the map at a place that
  // holds Locations, Knowledge and Rules, then (one column) the map and the Locations, Checks here, the pieces, Notes.
  // Reading ahead (LA3): the line first, then the read place's own card; the map stays the party's, in the right
  // column (in one column, where it stands today), and the party's Locations stay out of the card.
  const card = (
    <section className="place-page__card" aria-label={reading ? `Reading ahead: ${cardName}` : `Where ${who} is`}>
      {aheadLine}
      {head}
      {cardFacts?.text && <BookTextFold key={chainKey} text={cardFacts.text} />}
      {mapInCard && !reading && mapPart}
      {book}
      {callsAt && <CallsLine db={db} user={user} campaign={campaign} placeName={callsName} at={callsAt} onBlocked={reading ? notHere : undefined} />}
      {single && mapPart}
      {single && !reading && spotsCard}
      {checksPart}
      {reading ? aheadPart : piecesPart}
      {reading
        ? aheadNow?.page && <NotesFold key={aheadKey} page place={aheadNow.page.place} source={cardSource} onSave={notHere} onEditBlocked={notHere} />
        : place && <NotesFold page place={place} source={source} onSave={(notes) => void actions.save({ notes })} />}
    </section>
  );

  return (
    <BookFaces>
      <div className={`place-page${single ? '' : ' place-page--two'}${phone ? ' place-page--phone' : ''}`}>
        {single ? (
          <>
            {waiting}
            {card}
            {tablesCard}
            {marching}
          </>
        ) : (
          <>
            {card}
            <div className="place-page__side">
              {waiting}
              {(!mapInCard || reading) && mapPart}
              {spotsCard}
              {tablesCard}
              {marching}
            </div>
          </>
        )}
        {phone && (
          <div className="place-page__bar">
            {reading ? (
              backToParty
            ) : (
              <>
                {moveOn}
                <PlaceRuleButtons rules={ruleButtons} />
              </>
            )}
          </div>
        )}
      </div>
      {panelOf && packPlaces && (
        <LocationsPanel of={panelOf} places={packPlaces} partyAt={current} lines={panelLines?.key === panelKey ? panelLines.lines : null} onRead={readAhead} onClose={() => setPanelOf(null)} />
      )}
      {blocked.sheet}
      {hoards.sheets}
      {knowledgeOpen && <KnowledgeSheet placeName={reading ? reading.name : (place?.name ?? '')} facts={cardFacts ?? NO_FACTS} source={cardSource} sharing={sharing} onClose={() => setKnowledgeOpen(false)} />}
      {rulesOpen && <PlaceRulesSheet db={db} user={user} campaignId={campaign.id} chain={placeChain} settingCheck={settingCheck} onChanged={changed} onClose={() => setRulesOpen(false)} onBlocked={reading ? notHere : undefined} />}
      {openTable && <PlaceTable table={openTable} onClose={() => setOpenTable(null)} />}
      {moveOpen &&
        (place?.pack ? (
          <MoveOnWiring
            db={db}
            campaignId={campaign.id}
            expeditionId={expeditionId}
            onClose={() => setMoveOpen(false)}
            onElsewhere={() => {
              setMoveOpen(false);
              setElsewhere(true);
            }}
            onBlocked={(words) => {
              setMoveOpen(false);
              show({ text: words, error: true });
            }}
            onMoved={() => setMoveOpen(false)}
          />
        ) : (
          // A place made by hand, or none yet: no ways in a pack, so Somewhere else… alone (set 1's frame 18).
          <MoveOnSheet
            here={place ? inSentence(place.name) : 'here'}
            destinations={[]}
            moveOf={() => ({ title: '', where: '', takes: '' })}
            onMove={() => undefined}
            onAnswer={() => undefined}
            onElsewhere={() => {
              setMoveOpen(false);
              setElsewhere(true);
            }}
            onClose={() => setMoveOpen(false)}
          />
        ))}
      {elsewhere && (
        <PlacePicker
          db={db}
          campaignId={campaign.id}
          title={place ? 'Where now?' : 'Where are we?'}
          recent={recent}
          current={place}
          allowUnnamed
          onPick={(picked) => {
            setElsewhere(false);
            void actions.move(picked);
          }}
          onClose={() => setElsewhere(false)}
        />
      )}
    </BookFaces>
  );
}

/**
 * The Locations panel (B2; p2p-8; page 23, LA2, approved 2026-11-18): the standing pop-up titled "Locations", the
 * place's name over it, closed by its ✕. Its first row is the place itself (its name and one quiet line), which opens
 * it to read; then the party's own row, marked and washed, "The party is here.", which is no tap; then every place in
 * it, by key, each opening that place to read ahead. A row's line is cut to one line; a long name wraps. Nothing in it
 * moves the party.
 */
export function LocationsPanel({
  of,
  places,
  partyAt,
  lines,
  onRead,
  onClose,
}: {
  of: PackPlace;
  places: readonly PackPlace[];
  /** The party's place (its row is marked and not a tap), or null. */
  partyAt: PackPlace | null;
  /** Each place's one line, by its pack id; null while they load. */
  lines: ReadonlyMap<string, string> | null;
  onRead: (place: PackPlace) => void;
  onClose: () => void;
}) {
  const inIt = byKey(childrenOf(places, of));
  const here = inIt.find((p) => samePlace(p, partyAt));
  const row = (p: PackPlace) => <ListRow key={p.entryId} title={numberedName(p.key, p.name)} sub={lines?.get(p.entryId)} onOpen={() => onRead(p)} />;
  return (
    <Dialog label="Locations" over={numberedName(of.key, of.name)} onClose={onClose}>
      <div className="place-page__panel">
        <RowList dotted>
          {row(of)}
          {here && (
            <div className="place-page__panel-here">
              <ListRow
                lead={
                  <span className="place-page__panel-mark" aria-hidden="true">
                    <Icon name="players" size={16} />
                  </span>
                }
                title={numberedName(here.key, here.name)}
                sub="The party is here."
              />
            </div>
          )}
          {inIt.filter((p) => p !== here).map(row)}
        </RowList>
      </div>
    </Dialog>
  );
}

/** The place's own check on one line: "Encounter check: on every move, 1 in 6." (page 11's Checks here). */
export function checkLineWords(name: string, check: Pick<Check, 'every' | 'chance'>, eachMove: boolean): string {
  const when = checkWhenWords({ eachMove, every: check.every ?? null });
  const chance = checkChanceWords(check.chance ?? null);
  return `${name}: ${when.charAt(0).toLowerCase()}${when.slice(1)}${chance ? `, ${chance}` : ''}.`;
}
