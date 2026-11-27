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
// (p2p-5; plan scene-point-to-point B7) lists Locations, grouped under their Area, where packs give any; since sf-2
// (page 44, DP3, DP3b) as one view with the search, Recently visited, folding Areas, the packs with other places and
// Other… (`LocationsPickerBody`; `PlacePicker`'s `locations`); where none does, today's picker (⚑ 6).
// A tap on a place's name picks it at once: the caller closes the picker, moves the party and shows the toast with
// Undo (no accent button: every row is the action). The pack's places are a few fields of each entry, loaded once
// per campaign (never their GM side here; the GM's device alone reads them); the tree renders only what's unfolded,
// so about 900 places stay light on a phone. States: loading, no packs with places, nothing found, offline.
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { Db } from '../core/supabase.ts';
import { loadPackPlaces, type Place } from '../modules/expedition/placePlay.ts';
import { PLACE_NAME_MAX } from '../modules/expedition/play.ts';
import { byMapNumber, childrenOf, countUnder, holdersOfLocations, isLocation, keyedName, nearHere, packsWithPlaces, pickablePlaces, placeOf, rootsOf, searchPlaces, wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { departAreaOf, departLocationGroups, departOpenGroup } from '../modules/expedition/sceneTop.ts';
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

  if (other !== null) return <OtherPlace initial={other} allowUnnamed={allowUnnamed} onPick={onPick} onBack={() => setOther(null)} />;

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

/** Other…: a typed name, Set place (or Move on, unnamed where allowed), and the way back to the list. */
function OtherPlace({ initial, allowUnnamed, onPick, onBack }: { initial: string; allowUnnamed: boolean; onPick: (picked: PickedPlace) => void; onBack: () => void }) {
  const [other, setOther] = useState(initial);
  const field = useId();
  const name = other.trim();
  return (
    <div className="place-pick">
      <label className="field" htmlFor={field}>
        <span className="label">A place that isn't listed</span>
        <input id={field} className="field__input place-pick__field" aria-label="A place that isn't listed" value={other} maxLength={PLACE_NAME_MAX} autoComplete="off" onChange={(e) => setOther(e.target.value)} />
      </label>
      <div className="place-pick__actions">
        <button type="button" className="button-primary" onClick={() => (name ? onPick({ kind: 'other', name }) : allowUnnamed ? onPick({ kind: 'unnamed' }) : undefined)}>
          {name ? 'Set place' : allowUnnamed ? 'Move on, unnamed' : 'Set place'}
        </button>
        <button type="button" className="button-secondary" onClick={onBack}>
          Back to the list
        </button>
      </div>
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

/** "1 place", "7 places" (finding 11: one word for the count, lower case). */
function placesCount(n: number): string {
  return n === 1 ? '1 place' : `${n} places`;
}

/** The fold mark (finding 5): the chevron in its square, down while folded and up while open. */
function FoldMark({ open, name, onToggle }: { open: boolean; name: string; onToggle: () => void }) {
  return (
    <button type="button" className={`button-secondary place-pick__fold depart-pick__fold${open ? ' depart-pick__fold--open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Fold' : 'Show'} ${name}`} onClick={onToggle}>
      <Icon name="chevron" size={20} />
    </button>
  );
}

/** Step in for a pack's tree (N4): a group 16 px a level; a place 24 px more than its group (40 px from the pack's edge). */
const stepIn = (px: string) => ({ paddingLeft: px });
const groupIndent = (depth: number) => stepIn(`calc(var(--space-4) * ${depth})`);
const rowIndent = (depth: number) => (depth <= 1 ? groupIndent(depth) : stepIn(`calc(var(--space-4) * ${depth - 1} + var(--space-5))`));

/**
 * The Depart sheet's Where? as one view (sf-2; page 44, DP3 and DP3b, approved 2026-11-26; ⚑ 10, N4): the search and
 * Recently visited over the groups; each Area of the packs' Locations a group that folds by the chevron, the Area last
 * played open and the others folded (`departOpenGroup`); then From your packs, the packs with places to pick beside
 * those Locations, each unfolding in place (its Areas as groups stepped in 16 px, their places stepped in again, in
 * number order with their numbers); then Other…. No second view, so no "Back". A row is the pick, at once; the picked
 * one ticked. A search names each row's Area at its right (`departAreaOf`).
 */
export function LocationsPickerBody({
  places,
  recent,
  picked,
  initialOpen,
  initialQuery = '',
  onPick,
}: {
  places: readonly PackPlace[];
  /** The campaign's places, newest first (Recently visited; the Area last played). */
  recent: readonly Place[];
  picked: PackPlace | null;
  /** What starts unfolded ("area:<key>", "pack:<packId>", "<packId>:<entryId>"); else the Area last played. */
  initialOpen?: readonly string[];
  initialQuery?: string;
  onPick: (picked: PickedPlace) => void;
}) {
  const groups = useMemo(() => departLocationGroups(places), [places]);
  const holders = useMemo(() => holdersOfLocations(places), [places]);
  const pickable = useMemo(() => pickablePlaces(places, holders), [places, holders]);
  const [open, setOpen] = useState<Set<string>>(() => {
    if (initialOpen) return new Set(initialOpen);
    const last = departOpenGroup(groups, places, recent);
    return new Set(last ? [`area:${last}`] : []);
  });
  const [more, setMore] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState(initialQuery);
  const [other, setOther] = useState<string | null>(null);
  const field = useId();
  const q = query.trim();
  const results = useMemo(() => (q ? searchPlaces(pickable, q) : []), [pickable, q]);
  // From your packs: the packs with a place to pick that the groups don't list (a Region of hexes, a dungeon's rooms).
  const packs = useMemo(() => {
    const others = new Set(pickable.filter((p) => !isLocation(p)).map((p) => p.packId));
    return packsWithPlaces(places).filter((pack) => others.has(pack.packId));
  }, [places, pickable]);
  const toggle = (set: Set<string>, key: string, into: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    into(next);
  };
  const isPicked = (p: PackPlace) => picked !== null && picked.packId === p.packId && picked.entryId === p.entryId;
  const row = (key: string, words: string, on: boolean, pick: () => void, area: string | null = null, indent?: { paddingLeft: string }) => (
    <button key={key} type="button" className="depart-pick__row" style={indent} aria-pressed={on} onClick={pick}>
      <span className="depart-pick__tick" aria-hidden="true">
        {on && <Icon name="tick" size={20} />}
      </span>
      <span className="depart-pick__words">{words}</span>
      {area && <span className="auth__meta depart-pick__where">{area}</span>}
    </button>
  );
  const packRow = (p: PackPlace, area: string | null, indent?: { paddingLeft: string }, key = `${p.packId}:${p.entryId}`) => row(key, keyedName(p.key, p.name), isPicked(p), () => onPick({ kind: 'pack', place: p }), area, indent);
  const head = (name: string, count: number, key: string, kind: 'area' | 'pack', indent?: { paddingLeft: string }) => (
    <div className={`depart-pick__head depart-pick__head--${kind}`} style={indent}>
      {kind === 'pack' ? <span className="depart-pick__pack">{name}</span> : <h3 className="label depart-pick__area">{name}</h3>}
      <span className="auth__meta depart-pick__count">{placesCount(count)}</span>
      <FoldMark open={open.has(key)} name={name} onToggle={() => toggle(open, key, setOpen)} />
    </div>
  );
  // A pack's tree, one level at a time: a place with places under it is a group that folds; any other is a row.
  const level = (packId: string, parent: PackPlace | null, depth: number): ReactNode => {
    // Every level in number order, with the numbers (F2): no number first, then 0, 1, 2 … 10 (`byMapNumber`, Q1).
    const all = byMapNumber(parent ? childrenOf(places, parent) : rootsOf(places, packId), (p) => p.key);
    const key = parent ? `${parent.packId}:${parent.entryId}` : `pack:${packId}`;
    const shown = more.has(key) ? all : all.slice(0, PAGE);
    return (
      <>
        {shown.map((p) => {
          const under = countUnder(places, p);
          const at = `${p.packId}:${p.entryId}`;
          if (under === 0) return packRow(p, null, rowIndent(depth));
          return (
            <section key={at} className="depart-pick__group" aria-label={p.name}>
              {head(p.name, under, at, 'area', groupIndent(depth))}
              {open.has(at) && level(packId, p, depth + 1)}
            </section>
          );
        })}
        {all.length > shown.length && (
          <button type="button" className="button-secondary button-secondary--small place-pick__more depart-pick__more" style={rowIndent(depth)} onClick={() => toggle(more, key, setMore)}>
            {`Show ${all.length - shown.length} more${all.every((p) => p.hex) ? ' hexes, by map number' : ''}`}
          </button>
        )}
      </>
    );
  };
  // A pack whose one root holds all its places unfolds straight to that root's places (the pack is that place).
  const packLevel = (packId: string): ReactNode => {
    const roots = rootsOf(places, packId);
    const only = roots.length === 1 ? roots[0] : undefined;
    return only && countUnder(places, only) > 0 ? level(packId, only, 1) : level(packId, null, 1);
  };

  if (other !== null) return <OtherPlace initial={other} allowUnnamed={false} onPick={onPick} onBack={() => setOther(null)} />;

  const otherButton = (words: string) => (
    <button type="button" className="button-secondary place-pick__row depart-pick__other" onClick={() => setOther(q)}>
      {words}
    </button>
  );
  // Recently visited: the campaign's places, newest first; never an Area or a Region that holds Locations (p2p-2).
  const recentRows = recent.flatMap((p) => {
    const from = p.pack ? placeOf(places, p.pack.packId, p.pack.entryId) : undefined;
    if (from && holders.has(from)) return [];
    if (from) return [packRow(from, departAreaOf(places, from), undefined, p.id)];
    return [row(p.id, p.name, false, () => onPick({ kind: 'place', place: p }), p.pack ? null : 'typed')];
  });

  return (
    <div className="depart-pick">
      <label className="field" htmlFor={field}>
        <span className="label">Search places by name or map number</span>
        <input id={field} className="field__input place-pick__field" aria-label="Search places by name or map number" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      </label>
      {q ? (
        results.length > 0 ? (
          <section className="depart-pick__group" aria-label="Places found">
            <p className="auth__meta depart-pick__found">{`${placesCount(results.length)}.`}</p>
            {results.map((p) => packRow(p, departAreaOf(places, p)))}
            {otherButton(`Other… use “${q}” as a new place`)}
          </section>
        ) : (
          <>
            <p className="depart-pick__found">{`No place matches “${q}”.`}</p>
            {otherButton(`Other… use “${q}” as a new place`)}
          </>
        )
      ) : (
        <>
          {recentRows.length > 0 && (
            <section className="depart-pick__group" aria-label="Recently visited">
              <h3 className="label">Recently visited</h3>
              {recentRows}
            </section>
          )}
          {groups.map((group) => {
            const key = `area:${group.key}`;
            return (
              <section key={key} className="depart-pick__group" aria-label={group.name}>
                {head(group.name, group.locations.length, key, 'area')}
                {open.has(key) && group.locations.map((p) => packRow(p, null))}
              </section>
            );
          })}
          {packs.length > 0 && (
            <section className="depart-pick__group" aria-label="From your packs">
              <h3 className="label">From your packs</h3>
              {packs.map((pack) => (
                <div key={pack.packId} className="depart-pick__group">
                  {head(pack.name, pack.count, `pack:${pack.packId}`, 'pack')}
                  {open.has(`pack:${pack.packId}`) && packLevel(pack.packId)}
                </div>
              ))}
            </section>
          )}
          {otherButton('Other… a place that isn’t listed')}
        </>
      )}
    </div>
  );
}

/**
 * The picker as a pop-up (a Wide Dialog: a centred card on a tablet, the whole screen on a phone), loading the
 * attached packs' places once per campaign. `title`: "Where are we?" (Start, Set place), "Where now?" or "Move where?".
 * `locations` (the Depart sheet's Where?, p2p-5, sf-2): where an attached pack gives Locations, the Depart list
 * (`LocationsPickerBody`); where none does, today's picker (⚑ 6).
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
  // Depart's one view where an attached pack gives Locations; else today's picker (⚑ 6).
  const hasLocations = useMemo(() => locations && places !== null && places !== 'error' && departLocationGroups(places).length > 0, [locations, places]);
  const loading = locations && places === null && !offline;
  return (
    <Dialog label={title} over={over} onClose={onClose} wide>
      {loading ? (
        // Depart's list waits for the packs' places, so no row of today's picker can be tapped before it shows.
        <SkeletonRows rows={2} label="Loading your packs' places" />
      ) : hasLocations && places !== null && places !== 'error' ? (
        <LocationsPickerBody places={places} recent={recent} picked={picked} onPick={onPick} />
      ) : (
        <PlacePickerBody places={places} recent={recent} current={current} offline={offline && places === null} allowUnnamed={allowUnnamed} onPick={onPick} />
      )}
    </Dialog>
  );
}
