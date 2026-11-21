// The town screen (M5b step 6c; docs/plans/m5b-6-settlements.md "Step 6c"; ruled 2026-10-30, ST3, ST12; bq3-1: a
// place marked Safe or Hostile is a settlement place; 06 Components "Town screen", "Town place row", "Town switches").
// The settlement version of the location view, scoped to the group's current settlement place:
//   Overview: in town (no place card around it) the place's name and Safe or Hostile; the lifestyle's daily cost as
//   text (until purses, M7b).
//   Places in town: the setting's services that are places to go and its lodgings (town.ts), as shops, lodgings and
//   others, each a Town place row: its name and what it does, Show players (the pieces' eye) and Open · Closed, each
//   one tap with Undo. On a phone the name wraps above the two controls.
//   Things to do: the setting's town activities (services of kind `other`), each rule one tap away.
//   Encounters (the GM's): the current mode's checks, with the two town switches (sw-2: the strip's ⋯ state, a
//   second way in); they come due only during an expedition (bq3-2).
//   People and Rumours come with an adventure's town (M8b); until then one quiet line says so.
// The calmer town page (December piece 2c; ruled mc-15, variant B; mc-18): Encounters is one fact, "Safety and
// encounters", that opens a sheet with the checks and the two switches; a place's row keeps its eye only, its name
// opening the place in a pop-up where Open or Closed is set, and a closed place says "Closed today." on its row. No
// People section and no line about it (mc-18: a person sits beside their place). A lodging says its grade and the
// pack's inn that offers it (pf-5).
// TownLine is a player's: the places in town the GM shows their group, open or closed, and nothing else (the device
// never receives the rest: public.scene_town).
import { useEffect, useRef, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { Check } from '../modules/expedition/modes.ts';
import { chanceWords } from '../modules/expedition/play.ts';
import { loadPackPlaces, type GroupPlace, type Place } from '../modules/expedition/placePlay.ts';
import { placeOf, type PackPlace } from '../modules/expedition/placeTree.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { entryOf, playerWords, shownInPlay, shownWords, thingsToDoOf, TOWN_GROUP_WORDS, TOWN_GROUPS, townPlacesOf, type TownPlace, type TownRules } from '../modules/expedition/town.ts';
import { openTownPlace, showTownPlace, type SceneTown } from '../modules/expedition/townPlaces.ts';
import { setActiveNight, setOutDay } from '../modules/expedition/townPlay.ts';
import { ACTIVE_NIGHT, flipToastWords, OUT_DAY, type TownSwitches } from '../modules/expedition/townSwitches.ts';
import { Icon } from '../ui/icons.tsx';
import { ButtonRow, OpenCard } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './PlaceCard.css';
import './TownScreen.css';

export interface TownScreenProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The settlement place (marked Safe or Hostile). */
  place: Place;
  /**
   * The group's visit there (its pieces, each with whether the group sees it, and the picture): players read the
   * town only once the place is shown to them, so the first Show players shows the town too (review finding 2,
   * ruled B). Null: not known here.
   */
  visit: Pick<GroupPlace, 'id' | 'pieces' | 'picture'> | null;
  /** "Group 2" when the party is split, else null. */
  groupLabel: string | null;
  /** What the setting says about towns (readTown); null: nothing. */
  rules: TownRules | null;
  /** The current mode's checks (Encounters). */
  checks: readonly Check[];
  /** The town switches, and whether they're offered here (the strip's rule: in Adventure, the mode uses one or it's on). */
  switches: TownSwitches | null;
  offerSwitches: boolean;
  /** An expedition is under way (the checks come due only then, bq3-2). */
  underWay: boolean;
  /** Inside the place card (during an expedition): the card is the overview, so no name and no Safe or Hostile here. */
  embedded?: boolean;
  onChanged: () => void;
}

export function TownScreen({ db, user, campaign, place, visit, groupLabel, rules, checks, switches, offerSwitches, underWay, embedded = false, onChanged }: TownScreenProps) {
  const show = useToast();
  const places = townPlacesOf(rules);
  const todo = thingsToDoOf(rules);
  const lifestyles = rules?.lifestyles ?? [];
  const [sheet, setSheet] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  // A lodging's inn from the pack (pf-5): its name, when the town is a pack's and the pack lists that place.
  const [packPlaces, setPackPlaces] = useState<readonly PackPlace[] | null>(null);
  const packId = place.pack?.packId ?? '';
  useEffect(() => {
    if (!packId || !places.some((p) => p.placeId)) return;
    let live = true;
    void loadPackPlaces(db, campaign.id).then((found) => live && setPackPlaces(found));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per town
  }, [db, campaign.id, packId]);
  const innOf = (p: TownPlace): string => (p.placeId && packPlaces && packId ? (placeOf(packPlaces, packId, p.placeId)?.name ?? '') : '');
  // The place is shown to the group once a piece of it (or its picture) is; the description is what shows it.
  const townShown = visit === null || visit.pieces.some((p) => p.shown) || visit.picture?.shown === true;
  const description = visit?.pieces.find((p) => p.kind === 'description') ?? null;

  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  // One change at a time: a second tap before the first lands would be saved from an old copy (and refused).
  const busy = useRef(false);
  const once = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true;
    try {
      return await work();
    } finally {
      busy.current = false;
    }
  };

  async function toggleShown(entry: TownPlace) {
    const shown = !entryOf(place.town, entry).shown;
    // The first place shown in a town players don't see yet shows the town with it, in the same tap.
    const withTown = shown && visit !== null && !townShown;
    if (withTown && !description) return show({ text: `Players see ${place.name} once a piece of it is shown: add a Description to the place first.`, error: true });
    const alsoShow = withTown && description ? { visitId: visit.id, pieceId: description.id } : null;
    const done = await once(() => runCommand(registry, db, user, showTownPlace, { campaignId: campaign.id, place, entry, shown, alsoShow }));
    if (!done) return;
    onChanged();
    if (!done.ok) return show({ text: done.message, error: true });
    const text = withTown ? `Shown: ${place.name} and ${entry.name}` : `${shown ? 'Shown to players' : 'Hidden from players'}: ${entry.name}`;
    show({ text, onUndo: () => void undoLatest(showTownPlace.name) });
  }

  async function setOpen(entry: TownPlace, open: boolean) {
    if (entryOf(place.town, entry).open === open) return;
    const done = await once(() => runCommand(registry, db, user, openTownPlace, { campaignId: campaign.id, place, entry, open }));
    if (!done) return;
    onChanged();
    if (!done.ok) return show({ text: done.message, error: true });
    show({ text: `${entry.name}: ${open ? 'Open' : 'Closed'}`, onUndo: () => void undoLatest(openTownPlace.name) });
  }

  async function flip(which: keyof TownSwitches, on: boolean) {
    const command = which === 'outDay' ? setOutDay : setActiveNight;
    const done = await runCommand(registry, db, user, command, { campaignId: campaign.id, on });
    onChanged();
    if (!done.ok) return show({ text: done.message, error: true });
    show({ text: flipToastWords(switches, which, on), onUndo: () => void undoLatest(command.name) });
  }

  const uses = (which: 'outDay' | 'activeNight') => checks.some((c) => c.onlyWhen === which);
  const offered = (['outDay', 'activeNight'] as const).filter((w) => offerSwitches && (uses(w) || switches?.[w]));
  // A settlement from a pack says its size (and population); an older place marked by the GM says Safe or Hostile.
  const settlementWords = place.settlement ? `${place.settlement.size.charAt(0).toUpperCase()}${place.settlement.size.slice(1)}${place.settlement.population ? `, ${place.settlement.population} people` : ''}` : null;
  const overview = [!embedded && (place.safety === 'hostile' ? 'Hostile' : place.safety === 'safe' ? 'Safe' : settlementWords), ...lifestyles.map((l) => `Living: ${l.name}${l.rate ? `, ${l.rate}` : ''}`)].filter(
    (line): line is string => typeof line === 'string' && line.length > 0,
  );

  return (
    <section className={embedded ? 'town town--embedded' : 'town place-card'} aria-label={`The town: ${place.name}`}>
      {!embedded && (
        <div className="place-card__head">
          <h3 className="place-card__name">{place.name}</h3>
          {groupLabel && <p className="place-card__state">{groupLabel}</p>}
        </div>
      )}
      {overview.length > 0 && (
        <div className="town__section">
          <h4 className="label">Overview</h4>
          {overview.map((line) => (
            <p key={line} className="place-card__hint">
              {line}
            </p>
          ))}
        </div>
      )}
      {/* mc-15: Safety, Out and about today and Active tonight are one fact, opening their sheet. */}
      {(checks.length > 0 || offered.length > 0) && (
        <OpenCard title="Safety and encounters" summary={safetyWords(place, offered, switches)} label={`Safety and encounters: ${safetyWords(place, offered, switches)}`} onOpen={() => setSheet(true)} />
      )}

      <div className="town__section">
        <h4 className="label">Places in town</h4>
        {places.length === 0 ? (
          <p className="place-card__hint">The setting lists no shops or lodgings. An adventure's town adds its own.</p>
        ) : (
          <>
            <p className="place-card__hint">{shownWords(places, place.town)}</p>
            {TOWN_GROUPS.map((g) => {
              const inGroup = places.filter((p) => p.group === g);
              if (inGroup.length === 0) return null;
              return (
                <div key={g} className="town__group">
                  <h5 className="town__group-name">{TOWN_GROUP_WORDS[g]}</h5>
                  <ul className="town__list">
                    {inGroup.map((p) => (
                      <TownPlaceRow key={p.key} entry={p} inn={innOf(p)} shown={entryOf(place.town, p).shown} open={entryOf(place.town, p).open} onShow={() => void toggleShown(p)} onOpenPlace={() => setOpened(p.key)} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>

      {todo.length > 0 && (
        <div className="town__section">
          <h4 className="label">Things to do</h4>
          <ul className="town__list">
            {todo.map((t) => (
              <li key={t.id} className="town__todo">
                {t.note ? (
                  <details>
                    <summary className="place-card__summary">
                      <span className="place-card__chevron" aria-hidden="true">
                        ›
                      </span>
                      <span className="town__todo-name">{t.name}</span>
                    </summary>
                    <p className="place-card__hint">{t.note}</p>
                  </details>
                ) : (
                  <p className="town__todo-name town__todo-plain">{t.name}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet && (
        <Dialog wide label="Safety and encounters" onClose={() => setSheet(false)}>
          <div className="town__section">
            <h4 className="label">Encounters</h4>
            {checks.length > 0 && (
              <ul className="place-card__list">
                {checks.map((c) => (
                  <li key={c.id}>{`${c.name}, ${c.byTerrain ? 'by terrain' : chanceWords(c.chance)}${c.onlyWhen === 'outDay' ? `, only while ${OUT_DAY}` : c.onlyWhen === 'activeNight' ? `, only while ${ACTIVE_NIGHT}` : ''}`}</li>
                ))}
              </ul>
            )}
            {!underWay && checks.length > 0 && <p className="place-card__hint">They come due only during an expedition.</p>}
            {offered.map((w) => (
              <div key={w} className="town__switch">
                <span className="town__switch-name">{w === 'outDay' ? OUT_DAY : ACTIVE_NIGHT}</span>
                <ButtonRow<'off' | 'on'>
                  label={w === 'outDay' ? OUT_DAY : ACTIVE_NIGHT}
                  options={[
                    { value: 'off', label: 'Off' },
                    { value: 'on', label: 'On' },
                  ]}
                  value={switches?.[w] ? 'on' : 'off'}
                  onChange={(v) => {
                    if ((v === 'on') !== !!switches?.[w]) void flip(w, v === 'on');
                  }}
                />
              </div>
            ))}
            <p className="place-card__hint">Each change is logged, with Undo.</p>
          </div>
        </Dialog>
      )}
      {opened && (() => {
        const p = places.find((x) => x.key === opened);
        if (!p) return null;
        const open = entryOf(place.town, p).open;
        const inn = innOf(p);
        return (
          <Dialog label={p.name} onClose={() => setOpened(null)}>
            <div className="town__section">
              <p className="place-card__piece-kind">{p.words}</p>
              {inn && <p className="place-card__hint">{`At ${inn}`}</p>}
              {p.note && <p className="place-card__hint">{p.note}</p>}
              <div className="town__switch">
                <span className="town__switch-name">Today it is</span>
                <ButtonRow<'open' | 'closed'>
                  label={`${p.name}: open or closed`}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'closed', label: 'Closed' },
                  ]}
                  value={open ? 'open' : 'closed'}
                  onChange={(v) => void setOpen(p, v === 'open')}
                />
              </div>
              <p className="place-card__hint">Players see Closed on a place they know.</p>
            </div>
          </Dialog>
        );
      })()}
    </section>
  );
}

/** The Safety and encounters fact's line (mc-15): Safe or Hostile when the GM set it, then each switch offered, On or Off. */
function safetyWords(place: Place, offered: readonly (keyof TownSwitches)[], switches: TownSwitches | null): string {
  const safety = place.safety === 'hostile' ? 'Hostile' : place.safety === 'safe' ? 'Safe' : '';
  const flips = offered.map((w) => `${w === 'outDay' ? OUT_DAY : ACTIVE_NIGHT}: ${switches?.[w] ? 'On' : 'Off'}`);
  return [safety, ...flips].filter(Boolean).join('. ') || 'The checks in town';
}

/**
 * A place in town (06 "Town place row"; variant B, mc-15): its name and what it does, a tap that opens it (where Open
 * or Closed is set), and Show players (the pieces' 44 × 44 eye: open and pressed when shown, struck through when
 * hidden). A closed place says so in words. The name takes the width and wraps.
 */
function TownPlaceRow({ entry, inn, shown, open, onShow, onOpenPlace }: { entry: TownPlace; inn: string; shown: boolean; open: boolean; onShow: () => void; onOpenPlace: () => void }) {
  return (
    <li className="town-place">
      <button type="button" className="town-place__words place-card__piece-words" aria-label={`Open ${entry.name}`} onClick={onOpenPlace}>
        <span className="place-card__piece-text">{entry.name}</span>
        <span className="place-card__piece-kind">{[entry.words, inn ? `at ${inn}` : ''].filter(Boolean).join(', ')}</span>
        {!open && <span className="place-card__piece-kind">Closed today.</span>}
        {entry.note && <span className="place-card__piece-kind">{entry.note}</span>}
      </button>
      <div className="town-place__controls">
        <button
          type="button"
          className={`button-secondary place-card__eye${shown ? ' place-card__eye--shown' : ''}`}
          aria-label={shown ? `Hide ${entry.name} from players` : `Show players ${entry.name}`}
          title={shown ? 'Players see it' : 'Hidden'}
          onClick={onShow}
        >
          <Icon name={shown ? 'eye' : 'eye-off'} />
        </button>
      </div>
    </li>
  );
}

/**
 * A player's town (Town on Scene, 06): the places in town the GM shows their group, each with what it does and
 * whether it's open; nothing before the first one. `named` puts the town's name on top (in town, where no place line
 * is above it).
 */
export function TownLine({ town, rules, named }: { town: SceneTown | null; rules: TownRules | null; named: boolean }) {
  const shown = town ? shownInPlay(town.places, rules) : [];
  if (!town || shown.length === 0) return null;
  const places = townPlacesOf(rules);
  return (
    <section className="place-line town-line" aria-label={`In ${town.name}`}>
      {named && <h3 className="place-line__name">{town.name}</h3>}
      <h4 className="label">Places in town</h4>
      <ul className="town__list">
        {shown.map((p) => (
          <li key={p.key} className="town-line__place">
            <span className="place-card__piece-text">{p.name}</span>
            <span className="place-card__piece-kind">{playerWords(p, places)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
