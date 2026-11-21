// The place picker (M8b slice 0, pull request 2; docs/plans/m8b-0-places-from-packs.md "The mockup", approved
// 2026-11-06; ⚑ 1 A: every attached adventure and region pack, one folded group per pack; ⚑ 8 A: only where places
// are named today; ⚑ 10 names; docs/06 Components "Place picker"). One organism for Where? at Start expedition, the
// place card's Change place / Set place, and Move…'s place:
//   * a search field (name or map number; results name the source pack; "Other… use "x" as a new place");
//   * Near here (the current place's own places, then its neighbours), absent before the first place;
//   * Recently visited (the campaign's places, newest first; a typed one says so);
//   * From your packs: one group per pack, folded to start, the pack's own tree inside (hexes by map number, with
//     their number); the square button at a row's right only unfolds or folds (plus / minus, never an arrow);
//   * Other…: a typed name (as today), with Move on, unnamed where the caller allows it.
// Locations only (p2p-2; plan scene-point-to-point B5; its ⚑ 6 ruled 2026-11-18): an Area or a Region that holds
// Locations is never a row to pick. In the tree its row opens or folds its places, as its square button does; the
// search, Near here and Recently visited leave it out. Everything else is as before: a pack with no Locations, typed
// names, Other…, unnamed and places made by hand (`holdersOfLocations`, placeTree.ts). The Depart sheet's Where?
// (p2p-5; page 24, DP1; plan scene-point-to-point B7) lists Locations, grouped under their Area, where packs give any,
// with Other… under them for everything else, as ⚑ 6 keeps it (`LocationsPickerBody`; `PlacePicker`'s `locations`).
// A tap on a place's name picks it at once: the caller closes the picker, moves the party and shows the toast with
// Undo (no accent button: every row is the action). The pack's places are a few fields of each entry, loaded once
// per campaign (never their GM side here; the GM's device alone reads them); the tree renders only what's unfolded,
// so about 900 places stay light on a phone. States: loading, no packs with places, nothing found, offline.
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { Db } from '../core/supabase.ts';
import { loadPackPlaces, type Place } from '../modules/expedition/placePlay.ts';
import { PLACE_NAME_MAX } from '../modules/expedition/play.ts';
import { childrenOf, countUnder, holdersOfLocations, keyedName, nearHere, packsWithPlaces, pickablePlaces, placeOf, rootsOf, searchPlaces, wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { departLocationGroups, type LocationGroup } from '../modules/expedition/sceneTop.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { Note, SkeletonRows } from '../ui/parts.tsx';
import './PlacePicker.css';

/** What the picker gives back: a place the campaign has, a pack's place (to make or find), a typed name, or unnamed. */
export type PickedPlace = { kind: 'place'; place: Place } | { kind: 'pack'; place: PackPlace } | { kind: 'other'; name: string } | { kind: 'unnamed' };

/** The words for a campaign place: a pack place's words, or the typed name. */
export function placeWords(place: Pick<Place, 'name' | 'pack'>, packPlaces: readonly PackPlace[] | null): string {
  const from = place.pack && packPlaces ? placeOf(packPlaces, place.pack.packId, place.pack.entryId) : undefined;
  return from ? wordsFor(packPlaces!, from) : place.name;
}

/** How many of a pack's roots (or a place's children) show before "Show N more" (hexes come by the hundred). */
const PAGE = 40;

export interface PlacePickerBodyProps {
  /** The attached packs' places; null while loading; 'error' when they couldn't be read. */
  places: readonly PackPlace[] | null | 'error';
  /** The campaign's places named or picked before, newest first. */
  recent: readonly Place[];
  /** Where the group is now (its row marks "here now"; Near here comes from it). */
  current: Place | null;
  /** The device is offline (a pack's list needs a connection the first time). */
  offline?: boolean;
  /** The caller allows "Move on, unnamed" (Where now?). */
  allowUnnamed?: boolean;
  /** What starts unfolded ("pack:<packId>", "<packId>:<entryId>"); the gallery's specimens. */
  initialOpen?: readonly string[];
  /** A search already typed; the gallery's specimens. */
  initialQuery?: string;
  onPick: (picked: PickedPlace) => void;
}

/** The picker's content (also the gallery's specimen): the sections above, with search and Other…. */
export function PlacePickerBody({ places, recent, current, offline = false, allowUnnamed = false, initialOpen = [], initialQuery = '', onPick }: PlacePickerBodyProps) {
  const [query, setQuery] = useState(initialQuery);
  const [other, setOther] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen));
  const [more, setMore] = useState<Set<string>>(() => new Set());
  const field = useId();
  const list = useMemo(() => (places && places !== 'error' ? places : []), [places]);
  const packs = useMemo(() => packsWithPlaces(list), [list]);
  const currentPack = current?.pack ? (placeOf(list, current.pack.packId, current.pack.entryId) ?? null) : null;
  // The Areas and Regions that hold Locations: never a row to pick (p2p-2). The search reads only what can be picked.
  const holders = useMemo(() => holdersOfLocations(list), [list]);
  const pickable = useMemo(() => pickablePlaces(list, holders), [list, holders]);
  const near = useMemo(() => nearHere(list, currentPack).filter((p) => !holders.has(p)), [list, currentPack, holders]);
  const q = query.trim();
  const results = useMemo(() => (q ? searchPlaces(pickable, q) : []), [pickable, q]);
  const toggle = (set: Set<string>, key: string, into: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    into(next);
  };
  const isHere = (p: PackPlace) => currentPack === p;
  // A place that holds Locations is in the tree only: a tap on its name opens or folds its places and picks nothing.
  const rowOf = (p: PackPlace, extra: ReactNode = null, indent = 0) => {
    const key = `${p.packId}:${p.entryId}`;
    const holds = holders.has(p);
    return <PlaceRow key={key} words={wordsFor(list, p)} here={isHere(p)} indent={indent} expanded={holds ? open.has(key) : undefined} onPick={() => (holds ? toggle(open, key, setOpen) : onPick({ kind: 'pack', place: p }))} extra={extra} />;
  };
  // One level of the tree: the places under `parent` (or a pack's roots), each with its fold button when it has places of its own.
  const level = (packId: string, parent: PackPlace | null, indent: number): ReactNode => {
    const all = parent ? childrenOf(list, parent) : rootsOf(list, packId);
    const key = parent ? `${parent.packId}:${parent.entryId}` : `pack:${packId}`;
    const shown = more.has(key) ? all : all.slice(0, PAGE);
    return (
      <>
        {shown.map((p) => {
          const under = countUnder(list, p);
          const folded = !open.has(`${p.packId}:${p.entryId}`);
          const words = wordsFor(list, p);
          return (
            <div key={`${p.packId}:${p.entryId}`}>
              {rowOf(
                p,
                under > 0 && (
                  <button type="button" className="button-secondary place-pick__fold" aria-expanded={!folded} aria-label={`${folded ? 'Show' : 'Fold'} the ${under === 1 ? 'place' : 'places'} in ${words}`} onClick={() => toggle(open, `${p.packId}:${p.entryId}`, setOpen)}>
                    <Icon name={folded ? 'plus' : 'minus'} size={20} />
                  </button>
                ),
                indent,
              )}
              {!folded && under > 0 && level(packId, p, indent + 1)}
            </div>
          );
        })}
        {all.length > shown.length && (
          <button type="button" className="button-secondary button-secondary--small place-pick__more" style={{ marginLeft: `calc(var(--space-5) * ${indent})` }} onClick={() => toggle(more, key, setMore)}>
            {`Show ${all.length - shown.length} more${all.every((p) => p.hex) ? ' hexes, by map number' : ''}`}
          </button>
        )}
      </>
    );
  };

  if (other !== null) {
    const name = other.trim();
    return (
      <div className="place-pick">
        <label className="field" htmlFor={`${field}-other`}>
          <span className="label">A place that isn't listed</span>
          <input id={`${field}-other`} className="field__input place-pick__field" aria-label="A place that isn't listed" value={other} maxLength={PLACE_NAME_MAX} autoComplete="off" onChange={(e) => setOther(e.target.value)} />
        </label>
        <div className="place-pick__actions">
          <button type="button" className="button-primary" onClick={() => (name ? onPick({ kind: 'other', name }) : allowUnnamed ? onPick({ kind: 'unnamed' }) : undefined)}>
            {name ? 'Set place' : allowUnnamed ? 'Move on, unnamed' : 'Set place'}
          </button>
          <button type="button" className="button-secondary" onClick={() => setOther(null)}>
            Back to the list
          </button>
        </div>
      </div>
    );
  }

  const otherRow = (words: string) => (
    <button type="button" className="button-secondary place-pick__row" onClick={() => setOther(q)}>
      {words}
    </button>
  );
  // Recently visited leaves out an Area or a Region the party stood at before, where its pack gives Locations.
  const holdsLocations = (p: Place) => {
    const from = p.pack ? placeOf(list, p.pack.packId, p.pack.entryId) : undefined;
    return from !== undefined && holders.has(from);
  };
  const recentRows = recent.filter((p) => p.id !== current?.id && !holdsLocations(p));

  return (
    <div className="place-pick">
      <label className="field" htmlFor={field}>
        <span className="label">Search places by name or map number</span>
        <input id={field} className="field__input place-pick__field" aria-label="Search places by name or map number" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      </label>
      {offline && <Note tone="info">You're offline. Recently visited places and Other… still work; a pack's list needs a connection the first time.</Note>}
      {q ? (
        <>
          {results.length > 0 ? <p className="auth__meta place-pick__count">{results.length === 1 ? '1 place' : `${results.length} places`}</p> : places !== null && <p className="auth__meta place-pick__count">{`No place called “${q}” in your packs.`}</p>}
          {results.map((p) => rowOf(p, <span className="auth__meta place-pick__source">{p.packName}</span>))}
          {otherRow(`Other… use “${q}” as a new place`)}
        </>
      ) : (
        <>
          {near.length > 0 && (
            <section aria-label="Near here">
              <h3 className="label">Near here</h3>
              {near.map((p) => rowOf(p))}
            </section>
          )}
          {recentRows.length > 0 && (
            <section aria-label="Recently visited">
              <h3 className="label">Recently visited</h3>
              {recentRows.map((p) => (
                <PlaceRow key={p.id} words={placeWords(p, list)} extra={p.pack ? null : <span className="auth__meta place-pick__source">typed</span>} onPick={() => onPick({ kind: 'place', place: p })} />
              ))}
            </section>
          )}
          <section aria-label="From your packs">
            <h3 className="label">From your packs</h3>
            {places === null && !offline && <SkeletonRows rows={2} label="Loading your packs' places" />}
            {places === 'error' && <Note tone="warning">Your packs' places couldn't be read. Check your connection and try again.</Note>}
            {places !== null && places !== 'error' && packs.length === 0 && (
              <p className="auth__meta place-pick__count">None of this campaign's packs lists places. Type one, or attach an adventure or a region in the Rules library.</p>
            )}
            {packs.map((pack) => {
              const folded = !open.has(`pack:${pack.packId}`);
              return (
                <div key={pack.packId} className="place-pick__group">
                  <div className="place-pick__group-head">
                    <div className="place-pick__group-words">
                      <span>{pack.name}</span>
                      {/* 2c: the group is headed by the pack's own name alone, never "Region pack" or "Homebrew"; the count under it. */}
                      <span className="auth__meta">{pack.count === 1 ? '1 place' : `${pack.count} places`}</span>
                    </div>
                    <button type="button" className="button-secondary place-pick__fold" aria-expanded={!folded} aria-label={`${folded ? 'Show' : 'Fold'} ${pack.name}`} onClick={() => toggle(open, `pack:${pack.packId}`, setOpen)}>
                      <Icon name={folded ? 'plus' : 'minus'} size={20} />
                    </button>
                  </div>
                  {!folded && <div className="place-pick__group-body">{level(pack.packId, null, 0)}</div>}
                </div>
              );
            })}
          </section>
          {otherRow('Other… a place that isn’t listed')}
        </>
      )}
    </div>
  );
}

/**
 * One place's row: its words as the button (the action), "✓ here now" on the current place, an optional fold button.
 * `expanded` is given only for a place that holds Locations, whose tap opens or folds its places (p2p-2). Such a row
 * is never a pressed choice: where the party stands there (from before the rule) it keeps "✓ here now" and
 * `aria-current`, and carries `aria-expanded` alone, never `aria-pressed` beside it (the review of #1008).
 */
function PlaceRow({ words, here = false, indent = 0, extra = null, expanded, onPick }: { words: string; here?: boolean; indent?: number; extra?: ReactNode; expanded?: boolean; onPick: () => void }) {
  return (
    <div className="place-pick__line" style={indent ? { paddingLeft: `calc(var(--space-5) * ${indent})` } : undefined}>
      <button type="button" className="button-secondary place-pick__row" aria-pressed={(here && expanded === undefined) || undefined} aria-current={here ? 'location' : undefined} aria-expanded={expanded} onClick={onPick}>
        <span className="place-pick__words">{words}</span>
        {here && <span className="auth__meta">✓ here now</span>}
      </button>
      {extra}
    </div>
  );
}

/**
 * The Depart sheet's Where? (p2p-2, p2p-5; page 24, DP1, approved 2026-11-18): only Locations, each group headed by
 * its Area's name (`departLocationGroups`); a Location's row is the pick, its key before its name ("1. The Jetty"), the
 * picked one ticked. No search and no recent places (DP1 draws none); `PlacePicker` adds Other… under the groups,
 * which opens today's picker (⚑ 6).
 */
export function LocationsPickerBody({ groups, picked, onPick }: { groups: readonly LocationGroup[]; picked: PackPlace | null; onPick: (place: PackPlace) => void }) {
  return (
    <div className="depart-pick">
      {groups.map((group) => (
        <section key={group.key} className="depart-pick__group" aria-label={group.name}>
          <h3 className="label depart-pick__area">{group.name}</h3>
          {group.locations.map((place) => {
            const on = picked !== null && picked.packId === place.packId && picked.entryId === place.entryId;
            return (
              <button key={`${place.packId}:${place.entryId}`} type="button" className="depart-pick__row" aria-pressed={on} onClick={() => onPick(place)}>
                <span className="depart-pick__tick" aria-hidden="true">
                  {on && <Icon name="tick" size={20} />}
                </span>
                <span className="depart-pick__words">{keyedName(place.key, place.name)}</span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/**
 * The picker as a pop-up (a Wide Dialog: a centred card on a tablet, the whole screen on a phone), loading the
 * attached packs' places once per campaign. `title`: "Where are we?" (Start, Set place), "Where now?" or "Move where?".
 * `locations` (the Depart sheet's Where?, p2p-5): where an attached pack gives Locations, those grouped under their
 * Area (`LocationsPickerBody`), then Other…, which opens today's picker; where none does, today's picker (⚑ 6).
 */
export function PlacePicker({
  db,
  campaignId,
  title = 'Where are we?',
  over,
  recent,
  current,
  allowUnnamed = false,
  locations = false,
  picked = null,
  onPick,
  onClose,
}: {
  db: Db;
  campaignId: string;
  title?: string;
  /** A small line over the title (the Depart sheet's Where?: "Depart"). */
  over?: string;
  recent: readonly Place[];
  current: Place | null;
  allowUnnamed?: boolean;
  locations?: boolean;
  /** The Location already picked, ticked in the Locations' list. */
  picked?: PackPlace | null;
  onPick: (picked: PickedPlace) => void;
  onClose: () => void;
}) {
  const [places, setPlaces] = useState<readonly PackPlace[] | null | 'error'>(null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  useEffect(() => {
    let live = true;
    void loadPackPlaces(db, campaignId).then((found) => live && setPlaces(found ?? 'error'));
    return () => {
      live = false;
    };
  }, [db, campaignId]);
  const groups = useMemo(() => (locations && places && places !== 'error' ? departLocationGroups(places) : []), [locations, places]);
  // Other… under the Locations opens today's picker (the plan's ⚑ 6, ruled 2026-11-18: typed names, Other…, unnamed and
  // places made by hand keep working, and so do the places of packs with no Locations; the review of #1037).
  const [everyPlace, setEveryPlace] = useState(false);
  const loading = locations && places === null && !offline;
  return (
    <Dialog label={title} over={over} onClose={onClose} wide>
      {loading ? (
        // Depart's list waits for the packs' places, so no row of today's picker can be tapped before it shows.
        <SkeletonRows rows={2} label="Loading your packs' places" />
      ) : groups.length > 0 && !everyPlace ? (
        <>
          <LocationsPickerBody groups={groups} picked={picked} onPick={(place) => onPick({ kind: 'pack', place })} />
          <button type="button" className="button-secondary place-pick__row depart-pick__other" onClick={() => setEveryPlace(true)}>
            Other…
          </button>
        </>
      ) : (
        <PlacePickerBody places={places} recent={recent} current={current} offline={offline && places === null} allowUnnamed={allowUnnamed} onPick={onPick} />
      )}
    </Dialog>
  );
}
