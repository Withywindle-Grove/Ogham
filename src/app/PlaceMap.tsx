// "Add this place's map" (December dec-7 piece 5m-2; docs/plans/dec-7-5-place-page-and-map.md; mockup december/11,
// frames 2c and 4d, approved by Francis 2026-11-13, pg-1). The pack names a map for this place and the campaign has no
// copy yet: the row names the picture wanted (its title, its file) and "+ Map" takes the file from the GM's device. It
// is made smaller on the device (MAP_SIZE on its longest side; mc-32: nothing else is changed), uploaded as the
// campaign's map asset (place.addMap: the GM's alone) and tied to the place (place.setMap). The toast says so, with Undo
// (which unties it, as a place's picture's Undo does, and hides the copy again if it was shown since). A refused file says why in a toast that goes by itself; the row
// stays as it was.
//
// A part: the GM's place page (5b) mounts it where the map will stand, and reads the place's map again on `onAdded`.
import { useEffect, useRef, useState } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import { assetPath, fileLinks, forgetFileLinks } from '../core/files.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { PackMap } from '../modules/library/packMaps.ts';
import { addPlaceMap, loadMapShown, loadPackPicture, loadPlaceMap, loadPlayersMaps, setPlaceMap, shareEventOf, shareMap, type PlaceMapState, type PlayersMap, type UpTrail } from '../modules/expedition/placeMap.ts';
import type { Place } from '../modules/expedition/placePlay.ts';
import { MapCard, MapPopup, MapWanted, type MapSource } from '../ui/MapParts.tsx';
import { EyeToggle } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { PhotoError, shrinkMap } from './image.ts';
import { PACK_PICTURE_UNREAD_WORDS, tiePackMap } from './packMapTie.ts';
import { registry } from './services.ts';

/** The toast once a map is added: hidden until the GM shares it (frame 2c). */
export const mapAddedWords = (placeName: string) => `Map added (hidden): ${placeName.trim() || 'this place'}`;

/** Undo stops here when it can't read whether the map is shown: nothing is changed. */
export const UNDO_UNREAD_WORDS = "Couldn't check the map. Nothing was undone. Try again.";
/** Undo hid a shown map but found no tie left to take back. */
export const MAP_HIDDEN_ONLY_WORDS = 'Map hidden from the players. Nothing else to undo.';

/** What undoing an added map came to: nothing to say (done), or a toast's words; `retry` when trying again may work. */
export type MapUndoOutcome = { text: string; error: boolean; retry?: boolean } | null;

/**
 * Undoing an added map (the toast's Undo and the log's, one path; #958's re-review): a copy the eye has shown since is
 * hidden from the players again first (Francis, "Yes hide", 2026-11-18): place.shareMap's own logged change, so the
 * players' read rules stop sending it, row and file. Then the place.setMap line (`eventId`) is undone. When whether it
 * is shown can't be read, nothing is changed: untying first could leave a shown copy shown (hidden means hidden).
 */
export async function undoAddedMap(db: Db, user: CurrentUser, campaignId: string, assetId: string, eventId: string | null, authorUserId: string | null): Promise<MapUndoOutcome> {
  const shown = await loadMapShown(db, assetId);
  if (shown === null) return { text: UNDO_UNREAD_WORDS, error: true, retry: true };
  if (shown) {
    const hidden = await runCommand(registry, db, user, shareMap, { campaignId, assetId, shown: false });
    if (!hidden.ok) return { text: hidden.message, error: true };
  }
  if (!eventId) return shown ? { text: MAP_HIDDEN_ONLY_WORDS, error: false } : { text: 'Nothing to undo.', error: true };
  const undone = await runCommand(registry, db, user, undoChange, { campaignId, eventId, authorUserId });
  if (undone.ok) return null;
  // Hidden, but still tied: say both (the hide stands; it is its own line in the log).
  return { text: shown ? `Map hidden from the players. ${undone.message}` : undone.message, error: true };
}

export function AddPlaceMap({
  db,
  user,
  campaignId,
  place,
  map,
  packed,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  place: Pick<Place, 'id' | 'name' | 'version'>;
  /** The map the pack names for this place, not added yet. */
  map: Pick<PackMap, 'title' | 'file'>;
  /** The picture came with the pack (B14, p2p-27; its path there): "+ Map" adds it at once, with no file to pick. */
  packed?: string;
  /** The map was added or its adding undone: read the place's map again. */
  onChanged: () => void;
}) {
  const show = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  const undo = async (assetId: string): Promise<void> => {
    const eventId = await latestChange(db, campaignId, setPlaceMap.name, user.id);
    const outcome = await undoAddedMap(db, user, campaignId, assetId, eventId, user.id);
    onChanged();
    // "Try again." carries its Undo, so trying again is one tap (#958's re-review).
    if (outcome) show({ text: outcome.text, error: outcome.error, ...(outcome.retry ? { onUndo: () => void undo(assetId) } : {}) });
  };

  // `file`: the one picked by hand, or (B14) the pack's own picture, fetched from where the pack keeps it.
  async function pick(source: Blob | undefined | (() => Promise<Blob | null>)) {
    if (!source || sending) return;
    setSending(true);
    const file = typeof source === 'function' ? await source() : source;
    if (!file) {
      setSending(false);
      return show({ text: PACK_PICTURE_UNREAD_WORDS, error: true });
    }
    let image: Blob;
    try {
      image = await shrinkMap(file);
    } catch (problem) {
      setSending(false);
      return show({ text: problem instanceof PhotoError ? problem.message : "Couldn't read that picture. Try a JPEG or PNG.", error: true });
    }
    const added = await runCommand(registry, db, user, addPlaceMap, { campaignId, place, title: map.title, image });
    if (!added.ok) {
      setSending(false);
      return show({ text: added.message, error: true });
    }
    const tied = await runCommand(registry, db, user, setPlaceMap, { campaignId, place, assetId: added.value });
    setSending(false);
    onChanged();
    if (!tied.ok) return show({ text: tied.message, error: true });
    show({ text: mapAddedWords(place.name), onUndo: () => void undo(added.value) });
  }

  return (
    <>
      <MapWanted title={map.title} file={map.file} sending={sending} onAdd={() => (packed ? void pick(() => loadPackPicture(db, packed)) : picker.current?.click())} />
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        aria-label={`Choose the map's file: ${map.file}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void pick(file);
        }}
      />
    </>
  );
}

/** The eye's name, read aloud as a switch with its state (ds-2). */
export const MAP_EYE_LABEL = 'The map shown to the players';
/** The eye's toast (the pieces' words, 5m-3): shown or hidden, then the map's title. */
export const mapEyeWords = (shown: boolean, title: string) => `${shown ? 'Shown to the players' : 'Hidden from the players'}: ${title}`;

/**
 * The place's map on the GM's place page (the whole Scene's S13; mc-58 with the lead's ruling (c); page 11's frames
 * 1a, 1b, 2c, 4a, 4b, 4d; the eye, 5m-3). It reads the place's map, and reads it again whenever it changes (+ Map, its
 * Undo, the eye):
 *   no map: nothing (a place made by hand with none, or a pack place no map names);
 *   wanted: the row with "+ Map" (AddPlaceMap);
 *   added: the map card, its tools the magnifiers and the eye (no locate: the party has no position on a map, so it
 *     opens whole, ruling (c)), a tap opening the pop-up with the eye beside the ✕; on a phone (`phone`) a button
 *     "The map" in its place, opening the same pop-up.
 * `upTrail` lets a spot show the map of the place it is in; `nameOf` names that place over the pop-up's title.
 */
export function PlaceMapPart({
  db,
  user,
  campaignId,
  place,
  upTrail,
  nameOf,
  phone = false,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  place: Pick<Place, 'id' | 'name' | 'version' | 'pack'>;
  upTrail?: UpTrail;
  /** The name of a pack place by its entry id (the place whose map a spot shows). */
  nameOf?: (entryId: string) => string | null;
  phone?: boolean;
}) {
  const show = useToast();
  // Read again on each change: `round` moves on, and the reads below are keyed by it.
  const [round, setRound] = useState(0);
  const again = () => setRound((n) => n + 1);
  // The place's own key, and the read's: a read again keeps showing the last one until it comes (no blink).
  const placeKey = `${campaignId}:${place.id}:${place.pack?.packId ?? ''}:${place.pack?.entryId ?? ''}`;
  const key = `${placeKey}:${round}`;
  const [read, setRead] = useState<{ key: string; placeKey: string; state: PlaceMapState | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadPlaceMap(db, campaignId, place, upTrail).then((state) => live && setRead({ key, placeKey, state }));
    return () => {
      live = false;
    };
    // The key names the place, its pack entry and the round; the page mounts this once the pack's places are read, so
    // the trail is the same for the place's key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  }, [db, key]);
  const state = read?.placeKey === placeKey ? read.state : null;
  const assetId = state?.kind === 'added' ? state.assetId : null;

  // B14 (p2p-27; Francis, 2026-11-24): the pack brought the map's picture, so the place has its map with no tap: tied
  // once a mount (packMapTie.ts), hidden, with no toast. Nothing is drawn while it runs; if it fails, the toast says so
  // and the row's "+ Map" tries again (after that row's Undo, this mount doesn't tie it back).
  // `tied`: the place this mount has tied (or tried to): until then a wanted map with the pack's picture is tied, and
  // nothing is drawn. A second run at once (the effect run twice) shares the first (tiePackMap).
  const [tied, setTied] = useState<{ placeKey: string; failed: string | null } | null>(null);
  const tying = state?.kind === 'wanted' && !!state.packed && isGm(user, campaignId) && tied?.placeKey !== placeKey;
  useEffect(() => {
    if (!tying || state?.kind !== 'wanted' || !state.packed) return;
    const { map, packed } = state;
    void (async () => {
      const done = await tiePackMap(registry, db, user, campaignId, place, map.title, packed);
      // Read again before the row could show: the map and the end of the run land together (no "+ Map" flash).
      const next = done.ok ? await loadPlaceMap(db, campaignId, place, upTrail) : null;
      if (next) setRead({ key: `${placeKey}:tied`, placeKey, state: next });
      setTied({ placeKey, failed: done.ok ? null : done.message });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once a mount for the place, when its read asks for it
  }, [tying, placeKey]);
  // A failed tie's toast, once the row is drawn to try again.
  const tieFailed = tied?.placeKey === placeKey ? tied.failed : null;
  useEffect(() => {
    if (tieFailed) show({ text: tieFailed, error: true });
  }, [tieFailed, tied, show]);

  // The copy's eye and its file's link, once there is a copy.
  const [eye, setEye] = useState<{ key: string; assetId: string; shown: boolean | null } | null>(null);
  const [link, setLink] = useState<{ key: string; src: string | null } | null>(null);
  const [linkRound, setLinkRound] = useState(0);
  const assetKey = assetId ? `${assetId}:${round}` : '';
  const linkKey = assetId ? `${assetId}:${linkRound}` : '';
  useEffect(() => {
    if (!assetId) return;
    let live = true;
    void loadMapShown(db, assetId).then((shown) => live && setEye({ key: assetKey, assetId, shown }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the copy and the round
  }, [db, assetKey]);
  useEffect(() => {
    if (!assetId) return;
    let live = true;
    const path = assetPath(campaignId, assetId);
    void fileLinks(db, [path]).then((links) => live && setLink({ key: linkKey, src: links.get(path) ?? null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the copy and the try
  }, [db, campaignId, linkKey]);
  const [open, setOpen] = useState(false);

  if (!state || state.kind === 'none') return null;
  if (state.kind === 'wanted' && tying) return null;
  if (state.kind === 'wanted') return <AddPlaceMap db={db} user={user} campaignId={campaignId} place={place} map={state.map} packed={state.packed} onChanged={again} />;

  const linked = link && assetId && link.key.startsWith(`${assetId}:`) ? link : null;
  const source: MapSource = { src: linked?.src ?? null, alt: state.alt, failed: !!linked && !linked.src };
  const retry = () => {
    if (assetId) forgetFileLinks(assetPath(campaignId, assetId));
    setLinkRound((n) => n + 1);
  };
  // Kept until the eye's read again comes, so the switch doesn't flick back while it does. Null: not read yet, or the
  // read failed; no eye is drawn then (never a closed one the copy may not have), a retry where it failed.
  const known = eye?.assetId === assetId ? eye : null;
  const shown = known?.shown ?? null;

  // The toast's Undo takes back the share it names: the line its own run wrote, by that run's request id.
  const undo = async (requestId: string) => {
    const eventId = await shareEventOf(db, campaignId, requestId);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId, eventId, authorUserId: user.id }) : null;
    again();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };
  const share = async (next: boolean) => {
    const requestId = crypto.randomUUID();
    const done = await runCommand(registry, db, user, shareMap, { campaignId, assetId: state.assetId, shown: next }, { requestId });
    again();
    if (!done.ok) return show({ text: done.message, error: true });
    show({ text: mapEyeWords(next, state.title), onUndo: () => void undo(requestId) });
  };
  const eyeButton =
    shown !== null ? (
      <EyeToggle label={MAP_EYE_LABEL} shown={shown} onChange={(next) => void share(next)} />
    ) : known ? (
      <button type="button" className="button-secondary" aria-label="Whether the players see the map couldn't be read. Try again" onClick={again}>
        Try again
      </button>
    ) : null;
  const whose = (state.from && nameOf?.(state.from)) || place.name;

  return (
    <>
      {phone ? (
        <button type="button" className="button-secondary place-map__open" onClick={() => setOpen(true)}>
          The map
        </button>
      ) : (
        <MapCard source={source} title={state.title} tools={eyeButton} onOpen={() => setOpen(true)} onRetry={retry} />
      )}
      {open && <MapPopup source={source} place={whose} headTools={eyeButton} onClose={() => setOpen(false)} onRetry={retry} />}
    </>
  );
}

/** A player's map read that failed with nothing read before (PL9's failed read, in the map's place). */
export const MAP_UNREAD_WORDS = "Couldn't load the map. Check your connection and try again.";

/** The maps a player's groups see, as last read: `maps` null until a read has come; `failed` when the latest failed. */
export interface PlayersMapsRead {
  maps: ReadonlyMap<number, PlayersMap> | null;
  failed: boolean;
  retry: () => void;
}

/**
 * The maps a player's groups see (P5; public.map_for_players), read again with the log and the group's signal. "Not read
 * yet" (null) is kept apart from "read, none shared" (an empty map); a failed read keeps the last good one, so the frame
 * never blinks away on a network blip, and with none says so (the caller's Try again calls `retry`).
 */
export function usePlayersMaps(db: Db, campaignId: string, player: boolean): PlayersMapsRead {
  const logVersion = useLogVersion();
  const [round, setRound] = useState(0);
  const [read, setRead] = useState<{ maps: ReadonlyMap<number, PlayersMap> | null; failed: boolean }>({ maps: null, failed: false });
  useEffect(() => {
    if (!player) return;
    let live = true;
    void loadPlayersMaps(db, campaignId).then((maps) => live && setRead((was) => (maps ? { maps, failed: false } : { maps: was.maps, failed: true })));
    return () => {
      live = false;
    };
  }, [db, campaignId, player, logVersion, round]);
  return { ...read, retry: () => setRound((n) => n + 1) };
}

/**
 * The players' map (plan dec-9-the-players-scene P5; mc-37, mc-44, mc-44a, dp-1, dp-3; set 1's `01-08`, `01-08c`,
 * `01-08d`, approved 2026-11-12; page 18 PL1, PL5b): the map card with its title at the left and the magnifiers, on a
 * phone too (PL5b); a tap opens the pop-up, a drag moves it. Fitted whole (01-08c): a map carries no positions yet (07
 * §9, pins are R2), so there is no locate tool and nothing to open it on.
 */
export function PlayersMapCard({ db, campaignId, map, label }: { db: Db; campaignId: string; map: PlayersMap; label?: string }) {
  const [link, setLink] = useState<{ key: string; src: string | null } | null>(null);
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  const key = `${map.assetId}:${round}`;
  useEffect(() => {
    let live = true;
    const path = assetPath(campaignId, map.assetId);
    void fileLinks(db, [path]).then((links) => live && setLink({ key, src: links.get(path) ?? null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the copy and the try
  }, [db, campaignId, key]);
  const linked = link?.key === key ? link : null;
  const source: MapSource = { src: linked?.src ?? null, alt: `${map.title || 'The map'}, the map`, failed: !!linked && !linked.src };
  const retry = () => {
    forgetFileLinks(assetPath(campaignId, map.assetId));
    setRound((n) => n + 1);
  };
  return (
    <>
      <MapCard source={source} title={map.title || undefined} label={label} onOpen={() => setOpen(true)} onRetry={retry} />
      {open && <MapPopup source={source} place={map.title} onClose={() => setOpen(false)} onRetry={retry} />}
    </>
  );
}
