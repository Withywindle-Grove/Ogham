// Where a group is (M5 step 11; ruled 2026-10-30, DG9, DG11; Francis's ruling of 2026-10-31: a shown place is for its
// group's players only; docs/05 "Places for players", "The room's GM layer"; docs/06 "Dungeon play", Components
// "Room GM layer"):
//   PlaceCard, the GM's room GM layer for the group in focus: the place's name, whether players see it (in words),
//   what players notice (the description, saved as typed), Show players / Hide (at once, with Undo), Where now?
//   (a recent place or a typed name), the checks it triggers (the mode's, until adventure rooms in M8b), the GM's
//   notes under five headings (R1 text). Rules lookup is the GM reference screen's (the top row's open book, M5 gate
//   B4); the card's GM screen button went (R3 audit 27, M5b g5). Messages replace Send to players… (M5b g4).
//   PlaceLine, a player's "where you are": the place's name and the pieces the GM shows.
// Pieces (M5b step g2; ruled 2026-11-01, M5 gate B1; mockup design/mockups/m5-gate/b1-show-pieces.html): the card is
// a list of pieces, each with a 44 × 44 eye button at its right that shows it to the group in focus (open eye and the
// pressed look: shown; an eye struck through: hidden; no word; the accessible label "Show players" / "Hide from
// players"); "+ Piece" adds one line by hand with its kind; "Hide all" takes everything back; each change at once with
// Undo; the header counts "N of M pieces shown". The whole-place Show players / Hide and "What players notice" are
// gone (a place's description is its description piece). PlaceLine shows a player the place's name with the shown
// pieces, in the order shown, and nothing else.
// After they're added (M5b step g2b; ruled 2026-11-02, gp-1 … gp-6; mockup design/mockups/m5-gate/b1b-edit-piece.html):
// a row's text is a button ("Edit piece: …") that opens the same form filled in, titled Edit piece, with Save and a
// quiet Remove this piece (retired by its flag, Undo brings it back); a shown piece that changes reaches its players
// quietly. Where now? to a place visited before brings back what was shown at the end of its last visit (the toast
// counts them; the log's "back at" line has its own Undo).
// On a phone (M5b step 1, build order 7; ruled bq-4, 2026-11-03; 06 "Wilderness day", S7): in a wilderness day the
// location view opens as a sheet. Both PlaceCard and PlaceLine take `phone`: the card is then an Open card (the place's
// name and a summary line) whose tap opens the same card in a sheet (Dialog, variant Wide: the whole screen, ✕ at the
// top right). The empty state is "Where are we? · Set place" (not "Somewhere unnamed"); Set place opens Where now?.
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { loadPackPlaceEntry, loadPackPlaces, loadPackTables, loadStatBlockName } from '../modules/expedition/placePlay.ts';
import type { PackPlaceEntry } from '../modules/expedition/placeFromPack.ts';
import { hasPlaceFacts, leadWords, readPlaceFacts } from '../modules/expedition/placeFacts.ts';
import type { ReadTable } from '../modules/expedition/tables.ts';
import { NoteLines, PlaceFactLines, PlaceFactsBody, PlaceIdentity, PlaceTable } from './PlaceFacts.tsx';
import { ancestorsOf, childrenOf, placeOf, wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { PlacePicker, placeWords, type PickedPlace } from './PlacePicker.tsx';
import { short, usePlaceActions } from './placeActions.ts';
import { CallsLine } from './CallsToAdventure.tsx';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { assetPath, fileLinks } from '../core/files.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { Check } from '../modules/expedition/modes.ts';
import { addPlacePicture, PLACE_PICTURE_SIZE, setPlacePicture } from '../modules/expedition/placePicture.ts';
import { chanceWords } from '../modules/expedition/play.ts';
import {
  hidePiece,
  NOTE_HEADINGS,
  NOTE_WORDS,
  PIECE_KIND_WORDS,
  PIECE_KINDS,
  PIECE_TEXT_MAX,
  PLACE_TEXT_MAX,
  showPiece,
  shownCount,
  type GroupPlace,
  type NoteHeading,
  type Piece,
  type PicturePiece,
  type Place,
  type PieceKind,
  type ScenePlace,
} from '../modules/expedition/placePlay.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { Chip, OpenCard, SourceLine, StackedButton, StackedGroup } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import { PhotoError, shrinkImage } from './image.ts';
import { isEncounterCheck } from '../modules/expedition/checks.ts';
import { loadPlaceChain, placeCheckOf, readPlaceRules, type ChainEntry, type PlayersRule } from '../modules/expedition/placeRules.ts';
import { PlaceRuleButtons, PlaceRulesSheet } from './PlaceRules.tsx';
import './PlaceCard.css';

/** What the GM's card needs around the group's place. */
export interface PlaceCardProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The group it's for, and its name when the party is split ("Group 2"), else null. */
  group: number;
  groupLabel: string | null;
  /** The group's current place row (null: none yet in this expedition). */
  row: GroupPlace | null;
  /** The mode's checks (what the place triggers until adventure rooms, M8b). */
  checks: readonly Check[];
  /** The campaign's places named or picked before, newest first (the picker's Recently visited). */
  recent: readonly Place[];
  /** The rules sets' regional encounter tables (⚑ 7): a picked place remembers its region. */
  regionalTables?: Record<string, unknown>;
  /** The ground around the group (M5b step 1, Q1): the terrain's name from its travel row; null outside a budget mode. */
  terrain?: string | null;
  /** A phone in a wilderness day (S7): an Open card that opens the location view as a sheet. */
  phone?: boolean;
  /** At a settlement place (one marked Safe or Hostile before m8b-0 delivery 5; M5b step 6c, ST3): the town screen's sections. */
  town?: ReactNode;
  onChanged: () => void;
}

export function PlaceCard({ db, user, campaign, group, groupLabel, row, checks, recent, regionalTables, terrain = null, phone = false, town = null, onChanged }: PlaceCardProps) {
  const [moving, setMoving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [hereOpen, setHereOpen] = useState(false);
  const place = row?.place ?? null;
  const pieces = row?.pieces ?? [];
  const who = groupLabel ?? 'the party';
  // A place from a pack (pull request 2): the pack's places, for its words, its parent and the places under it.
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
  const parent = current && packPlaces ? (ancestorsOf(packPlaces, current)[0] ?? null) : null;
  const here = current && packPlaces ? childrenOf(packPlaces, current) : [];
  // December piece 2c: what the pack's entry says about the place (the GM's: identity, facts, headed prose, tables,
  // the watch), read on the GM's device; null while it loads or for a typed place, and a pack without it reads as before.
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
  const facts = entry?.key === packKey && entry.entry ? readPlaceFacts(entry.entry.data) : null;
  const tableKey = facts && place?.pack ? `${place.pack.packId}:${facts.tableIds.join(',')}:${facts.watch?.statBlockId ?? ''}` : '';
  const [packTables, setPackTables] = useState<{ key: string; tables: Map<string, ReadTable>; watch: string } | null>(null);
  useEffect(() => {
    if (!tableKey || !facts || !place?.pack) return;
    let live = true;
    const packId = place.pack.packId;
    void Promise.all([loadPackTables(db, packId, facts.tableIds), loadStatBlockName(db, packId, facts.watch?.statBlockId ?? '')]).then(([tables, watch]) => live && setPackTables({ key: tableKey, tables, watch }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack, the tables and the stat block
  }, [db, tableKey]);
  const loaded = packTables?.key === tableKey ? packTables : null;
  const [openTable, setOpenTable] = useState<ReadTable | null>(null);
  // December dec-7 piece 3: the place's rules and its own check, and those of the places it sits in (rg-4, mc-51),
  // read from the pack on the GM's device; the Rules button shows only when there is something to list.
  const [chain, setChain] = useState<{ key: string; chain: ChainEntry[] } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    if (!packKey || !place?.pack) return;
    let live = true;
    void loadPlaceChain(db, place.pack.packId, place.pack.entryId).then((found) => live && setChain({ key: packKey, chain: found ?? [] }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the pack and entry
  }, [db, packKey]);
  const placeChain = chain?.key === packKey ? chain.chain : [];
  // The nearest place's check decides (07): Rules shows for a rule anywhere in the chain, or a deciding check that
  // stands in (review of #726), never for a check further up that a nearer one overrides.
  const hasRules = placeChain.some((e) => readPlaceRules(e.data).length > 0) || placeCheckOf(placeChain, [])?.replaces === true;
  const settingCheck = checks.find((c) => isEncounterCheck(c, 'dot'))?.name ?? null;

  const { editing, setEditing, togglePiece, hideAll, add, edit, remove, move: moveTo, save } = usePlaceActions({ db, user, campaign, group, groupLabel, row, regionalTables, packPlaces, onChanged });
  const move = (picked: PickedPlace) => {
    setMoving(false);
    void moveTo(picked);
  };

  const whereNow = moving && (
    <PlacePicker db={db} campaignId={campaign.id} title={place ? 'Where now?' : 'Where are we?'} recent={recent} current={place} allowUnnamed onPick={(picked) => void move(picked)} onClose={() => setMoving(false)} />
  );
  const name = place ? placeWords(place, packPlaces) : 'Where are we?';
  // The pack's line under the name: the pack, the terrain it names, and the count (the mockup's meta line).
  const packLine = place?.pack ? [current?.packName ?? null, place.terrainId || null].filter((part): part is string => !!part).join(', ') : '';
  const card = (
    <section className="place-card" aria-label={`Where ${who} is`}>
      <div className="place-card__head">
        {/* The empty state (S6, bq-4): no place yet, or the party moved on without naming one. */}
        <h3 className="place-card__name">{name}</h3>
        {facts && <PlaceIdentity identity={facts.identity} />}
        {terrain && <p className="place-card__state">{`Around them: ${terrain}`}</p>}
        {/* B16 (M5 gate): no "Only you see this" (the card is the GM's by construction). B1: the count says it. */}
        {place && (pieces.length > 0 || packLine) && (
          <p className="place-card__state">
            {`${groupLabel ? `${groupLabel}: ` : ''}${[packLine || null, pieces.length > 0 ? `${shownCount(pieces)} of ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} shown` : null].filter(Boolean).join(', ')}`}
          </p>
        )}
      </div>
      {/* No "Players see" and no Rename for players, on any card (p2p-11, 2026-11-18): players see the pack's name for a
          place, or a name the GM gave before, kept as it is (⚑ 3, "Keep it"). */}
      {/* Calls to adventure (dec-12 B, mc-61): a line of its own with what is left to give; none without a hook. */}
      {place && <CallsLine db={db} user={user} campaign={campaign} placeName={place.playersName || place.name} />}
      {facts && <PlaceFactLines facts={facts} />}
      {/* Up and down from here (delivery 6; ruled A: a tap moves the party at once, with Undo; no "›", an icon each). */}
      {(parent || here.length > 0) && packPlaces && (
        <div className="place-card__related">
          {parent && (
            <button type="button" className="button-secondary place-pick__row" onClick={() => void move({ kind: 'pack', place: parent })}>
              <Icon name="within" size={20} />
              <span className="place-pick__words">{`Part of ${wordsFor(packPlaces, parent)}`}</span>
            </button>
          )}
          {here.length > 0 && (
            <div className="place-pick__group">
              <div className="place-pick__group-head">
                <Icon name="inside" size={20} />
                <div className="place-pick__group-words">
                  <span>{`Here: ${here.length === 1 ? '1 place' : `${here.length} places`}`}</span>
                </div>
                <button type="button" className="button-secondary place-pick__fold" aria-expanded={hereOpen} aria-label={hereOpen ? 'Fold the places here' : 'Show the places here'} onClick={() => setHereOpen((o) => !o)}>
                  <Icon name={hereOpen ? 'minus' : 'plus'} size={20} />
                </button>
              </div>
              {hereOpen && (
                <div className="place-pick__group-body">
                  {here.map((p) => (
                    <button key={p.entryId} type="button" className="button-secondary place-pick__row" onClick={() => void move({ kind: 'pack', place: p })}>
                      <span className="place-pick__words">{wordsFor(packPlaces, p)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {place && row && <PictureSection key={place.id} db={db} user={user} campaign={campaign} place={place} row={row} picture={row.picture ?? null} who={who} onChanged={onChanged} />}
      {place && (
        <div className="place-card__pieces">
          <h4 className="label">Pieces</h4>
          {pieces.length > 0 && (
            <ul className="place-card__piece-list">
              {pieces.map((piece) => (
                <PieceRow key={piece.id} piece={piece} onToggle={() => void togglePiece(piece)} onEdit={() => setEditing(piece)} />
              ))}
            </ul>
          )}
          {editing ? (
            <AddPiece
              key={`edit:${editing.id}:${editing.version}`}
              first={false}
              editing={editing}
              who={who}
              onAdd={(kind, text) => edit(editing, kind, text)}
              onRemove={() => void remove(editing)}
              onClose={() => setEditing(null)}
            />
          ) : (
            <AddPiece key={place.id} first={!pieces.some((p) => p.kind === 'description')} onAdd={add} />
          )}
        </div>
      )}
      <div className="place-card__actions">
        {/* hx-2: offered only while something is shown (a piece or the picture). */}
        {place && (shownCount(pieces) > 0 || !!row?.picture?.shown) && (
          <button type="button" className="button-secondary" onClick={() => void hideAll()}>
            Hide all
          </button>
        )}
        <button type="button" className="button-secondary" onClick={() => setMoving(true)}>
          {place && <Icon name="pin" size={20} />}
          {place ? 'Change place' : 'Set place'}
        </button>
        {place && hasRules && (
          <button type="button" className="button-secondary" onClick={() => setRulesOpen(true)}>
            <Icon name="scales" size={20} />
            Rules
          </button>
        )}
      </div>
      {rulesOpen && <PlaceRulesSheet db={db} user={user} campaignId={campaign.id} chain={placeChain} settingCheck={settingCheck} onChanged={onChanged} onClose={() => setRulesOpen(false)} />}

      {facts && hasPlaceFacts(facts) && (
        <PlaceFactsBody facts={facts} town={!!place?.settlement} tables={loaded?.tables ?? null} watchFightsAs={loaded?.watch ?? ''} onOpenTable={setOpenTable} />
      )}
      {openTable && <PlaceTable table={openTable} onClose={() => setOpenTable(null)} />}
      {/* A settlement place (bq3-1): the town screen's sections; its Encounters list the checks, so they show once. */}
      {place && town}
      {checks.length > 0 && !(place && town) && (
        <div className="place-card__checks">
          <h4 className="label">Checks here</h4>
          <ul className="place-card__list">
            {checks.map((c) => (
              <li key={c.id}>{`${c.name}, ${c.byTerrain ? 'by terrain' : chanceWords(c.chance)}`}</li>
            ))}
          </ul>
        </div>
      )}

      {place?.notes && <NotesFold place={place} onSave={(notes) => void save({ notes })} />}

    </section>
  );
  if (!phone) {
    return (
      <>
        {card}
        {whereNow}
      </>
    );
  }
  // A phone (S7): the Open card; with no place, it is the empty state and its tap is Set place.
  const around = terrain ? `Around them: ${terrain}` : null;
  const summary = place
    ? [around, pieces.length > 0 ? `${shownCount(pieces)} of ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} shown` : 'Nothing shown yet'].filter(Boolean).join(', ')
    : [around, 'Set place'].filter(Boolean).join(', ');
  const heading = `${groupLabel ? `${groupLabel}: ` : ''}${name}`;
  return (
    <>
      <OpenCard title={heading} summary={summary} label={`${heading}: ${summary}`} onOpen={() => (place ? setSheet(true) : setMoving(true))} />
      {sheet && (
        <Dialog wide label={`Where ${who} is`} onClose={() => setSheet(false)}>
          {card}
        </Dialog>
      )}
      {whereNow}
    </>
  );
}

/**
 * A place's picture (M5b step 1 follow-up, build order 7): the picture across the card, its whole height kept in
 * bounds; a tap opens it full screen. Loading shows a quiet block; a picture the bucket won't give says so. The GM's
 * card and a player's PlaceLine both use it (a player's link exists only while the place is shown to their group).
 */
export function PlacePicture({
  db,
  campaignId,
  assetId,
  name,
  bare = false,
  large = false,
}: {
  db: Db;
  campaignId: string;
  assetId: string;
  name: string;
  /** The picture alone, with no tap of its own (the place page's picture row is the tap: TW13). */
  bare?: boolean;
  /** Drawn large, as in the picture's pop-up (TW13). */
  large?: boolean;
}) {
  const path = assetPath(campaignId, assetId);
  // The link for the picture asked for (a link for an earlier picture reads as still loading).
  const [got, setGot] = useState<{ path: string; link: string | 'failed' } | null>(null);
  const link = got?.path === path ? got.link : null;
  const [full, setFull] = useState(false);
  useEffect(() => {
    let current = true;
    void fileLinks(db, [path]).then(
      (links) => current && setGot({ path, link: links.get(path) ?? 'failed' }),
      () => current && setGot({ path, link: 'failed' }),
    );
    return () => {
      current = false;
    };
  }, [db, path]);
  const label = `The picture of ${name || 'this place'}`;
  if (link === 'failed') return <p className="place-card__hint">The picture couldn't be opened. Check your connection.</p>;
  if (link === null) return <span className="place-picture place-picture--loading" role="img" aria-label={`${label}, loading`} />;
  if (bare || large) return <img className={large ? 'place-picture__full' : 'place-picture__img'} src={link} alt={large ? label : ''} />;
  return (
    <>
      <button type="button" className="place-picture" aria-label={`Open ${label.charAt(0).toLowerCase()}${label.slice(1)}`} onClick={() => setFull(true)}>
        <img className="place-picture__img" src={link} alt="" />
      </button>
      {full && (
        <Dialog label={label} onClose={() => setFull(false)}>
          <img className="place-picture__full" src={link} alt={label} />
        </Dialog>
      )}
    </>
  );
}

/**
 * The GM's picture section on the place card: the picture with its own eye (ruled B, 2026-11-03: players get it only
 * when the GM shows the picture itself, like a piece), Change picture and Take it off; or + Picture. A picture from
 * the device is shrunk, uploaded (place.addPicture) and made the place's picture piece, hidden (place.setPicture);
 * Undo puts the one before back. The eye is the pieces' own (place.showPiece / place.hidePiece), for this visit.
 */
export function PictureSection({
  db,
  user,
  campaign,
  place,
  row,
  picture,
  who,
  onChanged,
  page,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  place: Place;
  row: GroupPlace;
  picture: PicturePiece | null;
  who: string;
  onChanged: () => void;
  /**
   * The GM's place page (5b, page 11): `row` is the picture as the first row of Pieces (the picture, "Picture.", Change
   * picture and Take it off, its bare eye at the right; no heading, no state line: the eye says it); `add` is "+ Picture"
   * alone, beside "+ Piece", while there is none. Today's card (a town) leaves it out.
   */
  page?: 'row' | 'add';
}) {
  const show = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  // The place page's picture opened large in the standing pop-up (TW13, ic-4).
  const [opened, setOpened] = useState(false);

  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  async function pick(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    let image: Blob;
    try {
      image = await shrinkImage(file, PLACE_PICTURE_SIZE);
    } catch (problem) {
      setUploading(false);
      return show({ text: problem instanceof PhotoError ? problem.message : "Couldn't read that picture. Try a JPEG or PNG.", error: true });
    }
    const added = await runCommand(registry, db, user, addPlacePicture, { campaignId: campaign.id, place, image });
    if (!added.ok) {
      setUploading(false);
      return show({ text: added.message, error: true });
    }
    const linked = await runCommand(registry, db, user, setPlacePicture, { campaignId: campaign.id, place, assetId: added.value });
    setUploading(false);
    onChanged();
    if (!linked.ok) return show({ text: linked.message, error: true });
    setOpened(false);
    show({ text: `${picture ? 'Picture changed (hidden)' : 'Picture added (hidden)'}: ${short(place.name || 'this place')}`, onUndo: () => void undoLatest(setPlacePicture.name) });
  }

  async function takeOff() {
    if (uploading || busy) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, setPlacePicture, { campaignId: campaign.id, place, assetId: null });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    setOpened(false);
    // The place page's words (TW13); today's card keeps its own.
    show({ text: page === 'row' ? 'Picture taken off.' : `Picture taken off: ${short(place.name || 'this place')}`, onUndo: () => void undoLatest(setPlacePicture.name) });
  }

  async function toggle() {
    if (!picture || busy) return;
    setBusy(true);
    const command = picture.shown ? hidePiece : showPiece;
    const result = await runCommand(registry, db, user, command, { campaignId: campaign.id, row, piece: { id: picture.id } });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `${picture.shown ? `Hidden from ${who}` : `Shown to ${who}`}: the picture`, onUndo: () => void undoLatest(command.name) });
  }

  const input = (
    <input
      ref={picker}
      type="file"
      accept="image/*"
      hidden
      aria-label="Choose a picture"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        void pick(file);
      }}
    />
  );
  if (page === 'add') {
    if (picture) return null;
    return uploading ? (
      <p className="place-page__hint" role="status">
        Uploading the picture…
      </p>
    ) : (
      <>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => picker.current?.click()}>
          + Picture
        </button>
        {input}
      </>
    );
  }
  if (page === 'row') {
    if (!picture) return null;
    // TW13 (ic-4, for first play): the row keeps the thumbnail, "Picture." and its eye; a tap on it opens the picture
    // large in the standing pop-up titled "Picture", whose foot carries Change (the easel) and Take it off (the cross) as
    // stacked buttons, right-justified (ft-1, ic-1). Take it off happens at once, with Undo in the toast.
    return (
      <li className="place-page__piece place-page__piece--picture">
        <button type="button" className="place-page__picture-open" aria-label="Picture: open it" onClick={() => setOpened(true)}>
          <span className="place-page__thumb">
            <PlacePicture bare db={db} campaignId={campaign.id} assetId={picture.assetId} name={place.name} />
          </span>
          <span className="book-label">Picture.</span>
        </button>
        <EyeButton shown={picture.shown} show="Show players the picture" hide="Hide the picture from players" onToggle={() => void toggle()} />
        {input}
        {opened && (
          <Dialog label="Picture" onClose={() => setOpened(false)}>
            <PlacePicture large db={db} campaignId={campaign.id} assetId={picture.assetId} name={place.name} />
            {uploading ? (
              <p className="place-page__hint" role="status">
                Uploading the picture…
              </p>
            ) : (
              <div className="dialog__actions">
                <StackedGroup>
                  <StackedButton icon="easel" label="Change" aria-label="Change the picture" onClick={() => picker.current?.click()} />
                  <StackedButton icon="cancel" label="Take it off" aria-label="Take the picture off" onClick={() => void takeOff()} />
                </StackedGroup>
              </div>
            )}
          </Dialog>
        )}
      </li>
    );
  }
  return (
    <div className="place-card__picture">
      {/* Sections appear only with data (06, S6): no heading until there's a picture; + Picture alone before. */}
      {picture && <h4 className="label">Picture</h4>}
      {picture && (
        <div className="place-card__picture-row">
          <PlacePicture db={db} campaignId={campaign.id} assetId={picture.assetId} name={place.name} />
          <button
            type="button"
            className={`button-secondary place-card__eye${picture.shown ? ' place-card__eye--shown' : ''}`}
            aria-label={picture.shown ? 'Hide the picture from players' : 'Show players the picture'}
            title={picture.shown ? 'Players see it' : 'Hidden'}
            onClick={() => void toggle()}
          >
            <Icon name={picture.shown ? 'eye' : 'eye-off'} />
          </button>
        </div>
      )}
      {uploading ? (
        <p className="place-card__hint" role="status">
          Uploading the picture…
        </p>
      ) : picture ? (
        <>
          <p className="place-card__hint">{picture.shown ? `Shown to ${who}.` : 'Hidden: players see it once you show it.'}</p>
          <div className="place-card__actions">
            <button type="button" className="button-secondary" onClick={() => picker.current?.click()}>
              Change picture
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => void takeOff()}>
              Take it off
            </button>
          </div>
        </>
      ) : (
        <p className="place-card__add">
          <button type="button" className="button-secondary button-secondary--small" onClick={() => picker.current?.click()}>
            + Picture
          </button>
          <span className="place-card__hint">From this device; hidden until you show it.</span>
        </p>
      )}
      {input}
    </div>
  );
}

/**
 * The bare eye (ds-2; page 11): the open eye while players see it, the closed eye while they don't, no word beside it;
 * its spoken label says what a tap does and `aria-pressed` says the state. 44 x 44.
 */
export function EyeButton({ shown, show, hide, onToggle }: { shown: boolean; show: string; hide: string; onToggle: () => void }) {
  return (
    <button type="button" className={`place-page__eye${shown ? ' place-page__eye--shown' : ''}`} aria-label={shown ? hide : show} aria-pressed={shown} onClick={onToggle}>
      <Icon name={shown ? 'eye' : 'eye-shut'} />
    </button>
  );
}

/**
 * The GM's alone fact of a piece, as its own small line on the place page (page 11): "Value stays yours (40 herons).";
 * '' when it keeps none.
 */
export function gmFactLine(piece: Piece): string {
  if (piece.kind === 'treasure' && piece.gm.value) return `Value stays yours (${piece.gm.value}).`;
  if (piece.kind === 'hazard' && piece.gm.trigger) return `Look only; trigger stays yours (${piece.gm.trigger}).`;
  if (piece.kind === 'person' && piece.gm.statLine) return `The stat line never shows (${piece.gm.statLine}).`;
  return '';
}

/** What a piece is, and the GM-only facts it keeps (never shown): "Treasure · value stays yours (40 gp)". */
function kindLine(piece: Piece): string {
  const kind = PIECE_KIND_WORDS[piece.kind];
  if (piece.kind === 'treasure' && piece.gm.value) return `${kind}, value stays yours (${piece.gm.value})`;
  if (piece.kind === 'hazard' && piece.gm.trigger) return `${kind}, look only; trigger stays yours (${piece.gm.trigger})`;
  if (piece.kind === 'person' && piece.gm.statLine) return `${kind}, the stat line never shows (${piece.gm.statLine})`;
  return kind;
}

/**
 * A description's words, cut where a word names another piece (p2p-10, plan scene-point-to-point B3): `named` marks the
 * words to set bold and underlined. A name is another piece's own lead word, as the pack writes it, found as whole words
 * whatever their case ("Mooring buoy" marks "mooring buoy"), every time it is written; the longer of two names that
 * overlap wins. A lead's closing stop is not part of the name. The words themselves are never changed.
 */
export function namedParts(text: string, names: readonly string[]): { text: string; named: boolean }[] {
  const wanted = [...new Set(names.map((n) => n.trim().replace(/[.:!?]+$/, '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (wanted.length === 0 || !text) return text ? [{ text, named: false }] : [];
  const escaped = wanted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  // A whole word: no letter or digit just before or just after it (matched by hand, so no look-behind is needed).
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  const parts: { text: string; named: boolean }[] = [];
  let at = 0;
  for (const found of text.matchAll(pattern)) {
    const start = (found.index ?? 0) + found[1]!.length;
    if (start > at) parts.push({ text: text.slice(at, start), named: false });
    parts.push({ text: found[2]!, named: true });
    at = start + found[2]!.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), named: false });
  return parts;
}

/**
 * One piece (B1): its text and kind, and the 44 × 44 eye button that shows it to the group in focus. The text is the
 * tap target for Edit piece (g2b, gp-1: the whole row but the eye; no pencil, the text is the thing).
 */
export function PieceRow({
  piece,
  onToggle,
  onEdit,
  page = false,
  named = [],
  onOpen,
  note,
}: {
  piece: Piece;
  onToggle: () => void;
  onEdit: () => void;
  page?: boolean;
  named?: readonly string[];
  /** B15 (pg30-1): a hoard's piece opens its hoard on a tap, a small arrow before its eye saying so. */
  onOpen?: () => void;
  /** B15 (HM1, PK5b): the line under a hoard's piece, saying where it went. */
  note?: ReactNode;
}) {
  if (page) {
    // The Location's card (p2p-10; page 23, LA1, approved 2026-11-18): in the book's format, no kind word. A piece the
    // pack leads with its own word starts with it in bold; the description has none, and its words that name another
    // piece (`named`: the other pieces' own words) are bold and underlined. Then the GM's alone fact in the small line,
    // and the bare eye at the right.
    const fact = gmFactLine(piece);
    const parts = piece.kind === 'description' ? namedParts(piece.text, named) : [{ text: piece.text, named: false }];
    return (
      <li className="place-page__piece">
        <button type="button" className="place-page__piece-words" aria-label={onOpen ? `Open ${piece.lead ?? piece.text}` : `Edit piece: ${piece.text}`} onClick={onOpen ?? onEdit}>
          <span className="place-page__piece-text">
            {piece.lead && (
              <>
                <strong>{leadWords(piece.lead)}</strong>{' '}
              </>
            )}
            {parts.map((part, i) => (
              <Fragment key={i}>{part.named ? <strong className="place-page__named">{part.text}</strong> : part.text}</Fragment>
            ))}
          </span>
          {fact && !onOpen && <span className="place-page__fact">{fact}</span>}
          {note}
        </button>
        {onOpen && (
          <span className="place-page__opens" aria-hidden="true">
            <Icon name="chevron" size={20} />
          </span>
        )}
        <EyeButton shown={piece.shown} show="Show players" hide="Hide from players" onToggle={onToggle} />
      </li>
    );
  }
  return (
    <li className="place-card__piece">
      <button type="button" className="place-card__piece-words" aria-label={`Edit piece: ${piece.text}`} onClick={onEdit}>
        <span className="place-card__piece-text">
          {/* An aspect's lead-in (pf-3) before the text, the shared book label (kw-1 (a)). */}
          {piece.lead && (
            <>
              <span className="book-label">{leadWords(piece.lead)}</span>{' '}
            </>
          )}
          {piece.text}
        </span>
        <span className="place-card__piece-kind">{kindLine(piece)}</span>
      </button>
      {/* The eye with its word (2c): Shown or Hidden beside the icon, never the icon alone. */}
      <button
        type="button"
        className={`button-secondary place-card__eye place-card__eye--word${piece.shown ? ' place-card__eye--shown' : ''}`}
        aria-label={piece.shown ? 'Hide from players' : 'Show players'}
        aria-pressed={piece.shown}
        onClick={onToggle}
      >
        <Icon name={piece.shown ? 'eye' : 'eye-off'} />
        <span aria-hidden="true">{piece.shown ? 'Shown' : 'Hidden'}</span>
      </button>
    </li>
  );
}

/**
 * + Piece: one line players may be shown, with its kind (hidden until the GM shows it). With `editing`, the same
 * form filled in (Edit piece, g2b): Save instead of Add, a quiet Remove this piece, and a line saying who sees it now.
 */
export function AddPiece({
  first,
  editing,
  who,
  onAdd,
  onRemove,
  onClose,
  page = false,
  beside,
}: {
  first: boolean;
  editing?: Piece;
  who?: string;
  onAdd: (kind: PieceKind, text: string) => Promise<boolean>;
  onRemove?: () => void;
  onClose?: () => void;
  /**
   * The place page (page 11, frame 7): "+ Piece" alone with no explainer (mc-46), `beside` it ("+ Picture"); the form
   * boxed, "Remove this piece" quiet at the left, Cancel and Save (or Add) plain at the right.
   */
  page?: boolean;
  beside?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(editing !== undefined);
  const [kind, setKind] = useState<PieceKind>(editing?.kind ?? (first ? 'description' : 'exit'));
  const [text, setText] = useState(editing?.text ?? '');
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  if (!open && page) {
    return (
      <div className="place-page__adds">
        <StackedButton icon="jigsaw-piece" label="+ Piece" onClick={() => setOpen(true)} />
        {beside}
      </div>
    );
  }
  if (!open) {
    return (
      <p className="place-card__add">
        <button type="button" className="button-secondary button-secondary--small" onClick={() => setOpen(true)}>
          + Piece
        </button>
        <span className="place-card__hint">One line players will see; show it when you say it.</span>
      </p>
    );
  }
  const submit = async () => {
    if (await onAdd(kind, text)) {
      setText('');
      setOpen(false);
    }
  };
  if (page) {
    return (
      <div className="place-page__form" role="group" aria-label={editing ? 'Edit piece' : '+ Piece'}>
        <h5 className="place-page__form-title">{editing ? 'Edit piece' : '+ Piece'}</h5>
        <div className="place-card__kinds" role="group" aria-label="What kind of piece">
          {PIECE_KINDS.map((k) => (
            <Chip key={k} pressed={kind === k} onClick={() => setKind(k)}>
              {PIECE_KIND_WORDS[k]}
            </Chip>
          ))}
        </div>
        <label className="field" htmlFor={id}>
          <span className="label">What players will see</span>
          <input
            id={id}
            className="field__input"
            type="text"
            maxLength={PIECE_TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </label>
        {editing?.shown && <p className="place-page__hint">{`Shown to ${who ?? 'the party'} now, players see the change as you save it.`}</p>}
        <div className="place-page__form-foot">
          {editing && onRemove && (
            <button type="button" className="button-secondary button-secondary--small" onClick={onRemove}>
              Remove this piece
            </button>
          )}
          <span className="place-page__form-end">
            <button type="button" className="button-secondary button-secondary--small" onClick={close}>
              Cancel
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => void submit()}>
              {editing ? 'Save' : 'Add'}
            </button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="place-card__add-form" role="group" aria-label={editing ? 'Edit piece' : '+ Piece'}>
      <h5 className="place-card__form-title">{editing ? 'Edit piece' : '+ Piece'}</h5>
      <div className="place-card__kinds" role="group" aria-label="What kind of piece">
        {PIECE_KINDS.map((k) => (
          <Chip key={k} pressed={kind === k} onClick={() => setKind(k)}>
            {PIECE_KIND_WORDS[k]}
          </Chip>
        ))}
      </div>
      <label className="field" htmlFor={id}>
        <span className="label">What players will see</span>
        <input
          id={id}
          className="field__input"
          type="text"
          maxLength={PIECE_TEXT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </label>
      {editing?.shown && <p className="place-card__hint">{`Shown to ${who ?? 'the party'} now, players see the change as you save it.`}</p>}
      <div className="place-card__actions">
        <button type="button" className="button-secondary" onClick={() => void submit()}>
          {editing ? 'Save' : 'Add'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={close}>
          Cancel
        </button>
        {editing && onRemove && (
          <button type="button" className="button-secondary button-secondary--small place-card__remove" onClick={onRemove}>
            Remove this piece
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * "Notes" (B16), folded at the foot: on today's card (a town) the chevron and the notes' first line while folded; on the
 * place page (`page`) the fully folded row of p2p-12. A place from a pack reads its notes with their lead-ins and Edit
 * notes opens the fields (2c, frame 10); a place made by hand opens on the fields.
 */
export function NotesFold({
  place,
  onSave,
  page = false,
  source = null,
  onEditBlocked,
}: {
  place: Place;
  onSave: (notes: Partial<Record<NoteHeading, string>>) => void;
  /**
   * The place page (p2p-12; page 23, LA1, approved 2026-11-18): a fully folded row, "Notes" and the fold mark (a plus,
   * a minus while open) with no words of the notes showing; opened, the notes, then the pack's source line (`source`).
   * With nothing to say (no notes written, no source) the row is absent; a place made by hand keeps it, as the way to
   * write its notes (page 11, frame 2b).
   */
  page?: boolean;
  source?: string | null;
  /**
   * Reading ahead (plan scene-point-to-point B2): the notes stay read-only, and "Edit notes" calls this (the page's
   * pop-up) instead of opening the fields, so no words are typed that could not be saved. The place page only.
   */
  onEditBlocked?: () => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (page) {
    const written = !!place.notes && !!firstNote(place.notes);
    if (!written && !source && (place.pack || !place.notes)) return null;
    return (
      <div className="place-page__notes">
        <button type="button" className="place-page__notes-row" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <span className="place-page__notes-word">Notes</span>
          <Icon name={open ? 'minus' : 'plus'} size={20} />
        </button>
        {open && (
          <div id={bodyId} className="place-page__notes-body">
            {place.notes && place.pack && !editingNotes && (
              <>
                <NoteLines notes={NOTE_HEADINGS.map((h) => place.notes![h]).join('\n')} />
                <button type="button" className="button-secondary button-secondary--small place-page__notes-edit" onClick={() => (onEditBlocked ? onEditBlocked() : setEditingNotes(true))}>
                  Edit notes
                </button>
              </>
            )}
            {place.notes &&
              (!place.pack || editingNotes) &&
              NOTE_HEADINGS.map((heading) => (
                <TextNote key={`${place.id}:${heading}:${place.notesVersion}`} label={NOTE_WORDS[heading]} value={place.notes![heading]} rows={2} onSave={(text) => onSave({ [heading]: text })} />
              ))}
            {source && <SourceLine>{source}</SourceLine>}
          </div>
        )}
      </div>
    );
  }
  if (!place.notes) return null;
  const first = firstNote(place.notes);
  return (
    <details className="place-card__notes">
      <summary className="place-card__summary">
        <span className="place-card__chevron" aria-hidden="true">
          ›
        </span>
        <span className="place-card__summary-words">
          Notes
          {first && <span className="auth__meta place-card__first">{first}</span>}
        </span>
      </summary>
      {place.pack && !editingNotes && (
        <>
          <NoteLines notes={NOTE_HEADINGS.map((h) => place.notes![h]).join('\n')} />
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setEditingNotes(true)}>
            Edit notes
          </button>
        </>
      )}
      {(!place.pack || editingNotes) &&
        NOTE_HEADINGS.map((heading) => (
          <TextNote key={`${place.id}:${heading}:${place.notesVersion}`} label={NOTE_WORDS[heading]} value={place.notes![heading]} rows={2} onSave={(text) => onSave({ [heading]: text })} />
        ))}
    </details>
  );
}

/** The notes' first line, for the folded Notes (B16): the first heading with something written. */
export function firstNote(notes: Partial<Record<NoteHeading, string>>): string {
  for (const heading of NOTE_HEADINGS) {
    const line = (notes[heading] ?? '').split('\n').find((l) => l.trim());
    if (line) return line.trim();
  }
  return '';
}

/** A text field saved when it's left (only if it changed). */
export function TextNote({ label, value, rows, onSave }: { label: string; value: string; rows: number; onSave: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  return (
    <label className="field" htmlFor={id}>
      <span className="label">{label}</span>
      <textarea
        id={id}
        className="field__input field__textarea"
        rows={rows}
        maxLength={PLACE_TEXT_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== value) onSave(text);
        }}
      />
    </label>
  );
}

/**
 * A player's "where you are" (B1): the place's name with the pieces the GM has shown their group, in the order shown;
 * nothing before the first piece, and nothing else about the place (the device never receives it).
 */
export function PlaceLine({ place, db, campaignId, phone = false, rules = [] }: { place: ScenePlace | null; db?: Db; campaignId?: string; phone?: boolean; rules?: readonly PlayersRule[] }) {
  const [sheet, setSheet] = useState(false);
  if (!place || (place.pieces.length === 0 && !place.pictureAssetId)) return null;
  const line = (
    <section className="place-line" aria-label="Where you are">
      <h3 className="place-line__name">{place.name}</h3>
      {/* The place's picture (build order 7): only once the GM shows the picture itself to this group (ruled B). */}
      {place.pictureAssetId && db && campaignId && <PlacePicture db={db} campaignId={campaignId} assetId={place.pictureAssetId} name={place.name} />}
      {place.pieces.map((piece) => (
        <p key={piece.id} className="place-line__text">
          {piece.lead && <strong className="place-card__lead">{`${leadWords(piece.lead)} `}</strong>}
          {piece.text}
        </p>
      ))}
      {/* A place's rules open to players (dec-7 piece 3, mc-51): the ones with a button of their own (02-20). */}
      <PlaceRuleButtons rules={rules} />
    </section>
  );
  if (!phone) return line;
  // A phone in a wilderness day (S7): the Open card, then the same line in a sheet. Only what the scene gives.
  const first = place.pieces[0];
  const summary = first ? `${short(first.text)}${place.pieces.length > 1 ? `, ${place.pieces.length - 1} more` : ''}` : 'A picture';
  return (
    <>
      <OpenCard title={place.name} summary={summary} label={`Where you are: ${place.name}, ${summary}`} onOpen={() => setSheet(true)} />
      {sheet && (
        <Dialog wide label="Where you are" onClose={() => setSheet(false)}>
          {line}
        </Dialog>
      )}
    </>
  );
}
