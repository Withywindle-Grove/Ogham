// The party on Scene, in its groups (M5 step 8; ruled 2026-10-30, DG14 and DG8; docs/05 "Splitting the party"):
// the marching order, and Split the party / Join up. With no split there is one group, the party, and Scene looks as
// before (the GM's full marching order; a player's compact strip that opens to it). After a split:
//   the GM switches which group is in focus (chips "Group 1 · 3"), and sees that group's marching order;
//   a player sees their own group's order (their characters' groups);
//   Split the party opens a pop-up: each character with its group (the player picks their own characters' groups, the
//   GM anyone's; "A new group" splits off), each change at once with Undo;
//   Join up merges two groups (one tap with two groups, a pick with more): the GM, or a player while the groups are in
//   the same place (places per group come later, so for now any player).
// One clock for everyone: Next turn moves every group, and each group gets its own wandering checks (SceneTime).
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import { groupName, groupOf, groupsOf, isSplit, type GroupOf, type PartyGroup } from '../core/partyGroups.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { chooseGroup, joinUp, loadGroupMembers, mayChooseGroup } from '../modules/expedition/groupPlay.ts';
import { loadMarchers, type Marcher } from '../modules/expedition/marchingPlay.ts';
import { modeById, optionOn, readExploration } from '../modules/expedition/modes.ts';
import { isSettlement, loadGroupPlaces, loadMeeting, loadRecentPlaceRows, loadScenePlaces, meetingPairs, type GroupPlace, type Place, type ScenePlace } from '../modules/expedition/placePlay.ts';
import { regionalTablesOfRulesSets } from '../modules/expedition/placeFromPack.ts';
import { loadScene, type Expedition } from '../modules/expedition/play.ts';
import { choicesInPlay, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { PlaceCard, PlaceLine } from './PlaceCard.tsx';
import { GmPlacePage } from './GmPlacePage.tsx';
import { useExpectPanel } from './sceneWaiting.tsx';
import { TownLine, TownScreen } from './TownScreen.tsx';
import { readTown } from '../modules/expedition/town.ts';
import { loadLastPlaces, loadSceneTowns, type SceneTown } from '../modules/expedition/townPlaces.ts';
import { loadTownSwitches } from '../modules/expedition/townPlay.ts';
import type { TownSwitches } from '../modules/expedition/townSwitches.ts';
import { MAP_UNREAD_WORDS, PlayersMapCard, usePlayersMaps } from './PlaceMap.tsx';
import { WhatWeKnow } from './WhatWeKnow.tsx';
import { TownActions } from './TownActions.tsx';
import { campaignUnits } from '../modules/expedition/play.ts';
import { isPartOfDay, type TimeUnits } from '../modules/expedition/clock.ts';
import { TravelCard } from './TravelCard.tsx';
import { ActivityButtons, offeredActivities, yieldItemOf } from './ActivityButtons.tsx';
import type { ActorFacts } from '../modules/expedition/activities.ts';
import { loadTravelView, terrainOf, type TravelView } from './travelView.ts';
import { CampCard } from './CampCard.tsx';
import { campInfo } from './campView.ts';
import { loadCamps, type CampRow } from '../modules/expedition/campPlay.ts';
import type { CampEntry } from '../modules/expedition/camp.ts';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, SkeletonRows, StackedButton } from '../ui/parts.tsx';
import { RefreshFailedRow } from '../ui/WhereToParts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { MarchingOrder } from './MarchingOrder.tsx';
import { registry } from './services.ts';
import { usePhone } from './useWide.ts';
import { loadPlayersRules, type PlayersRule } from '../modules/expedition/placeRules.ts';
import { useLastGoodRules } from './PlaceRules.tsx';
import { NothingSharedYet, PlayersActivities, PlayersSceneCard, PlayersSceneLoading, PlayersScenePage, showsPlayersPage, SomewhereNew } from './PlayersScenePage.tsx';
import { activitiesWithRules } from '../modules/expedition/playerActions.ts';
import { PlayersWhereTo, usePlayersWaysOn, WhereToNoneYet } from './PlayersWhereTo.tsx';
import { stepNowOf } from '../modules/expedition/playersWays.ts';
import { PlayersAreaCard, PlayersLocationCard, usePlayersPlaceCards } from './PlayersPlaceCard.tsx';
import type { TurnClock } from '../modules/expedition/placeKnowledge.ts';
import './PartyGroups.css';

/** The players' map, not read: the GM's view as another player has no read naming that player yet (read, none shared). */

interface Loaded {
  members: GroupOf;
  marchers: Marcher[];
  /** Places per group (M5 step 11): the expedition under way, each group's current place, and which groups meet. */
  expedition: Expedition | null;
  places: Map<number, GroupPlace>;
  /** A player's view (M5b g2): each of their groups' place name and shown pieces (empty for the GM). */
  scene: Map<number, ScenePlace>;
  meeting: Map<number, number>;
  /** The campaign's places named or picked before, newest first (the picker's Recently visited). */
  recent: Place[];
  setting: CampaignSetting | null;
  /** The travel card's view (M5b step 1): the expedition under way in a day-by-day mode with a budget; else null. */
  travel: TravelView | null;
  /** Tonight's camp per group (M5b step 4), for the travel view's day; empty without one. */
  camps: Map<number, { camp: CampRow; entries: CampEntry[] }>;
  /** The campaign clock now (the campfire's time left). */
  now: number;
  /**
   * The town screen (M5b step 6c, ST3): the GM's view of each group's place between expeditions (the newest
   * expedition's last places; empty while one is under way), a player's towns (public.scene_town), the town
   * switches (the GM's), the mode the town's checks come from, and whether the campaign is in Adventure.
   */
  lastPlaces: Map<number, GroupPlace>;
  towns: Map<number, SceneTown>;
  /** Whether a player's towns could be read: when not, nobody can say they aren't in one (the players' page waits). */
  townsRead: boolean;
  switches: TownSwitches | null;
  townMode: string | null;
  adventure: boolean;
  /** The campaign's time units (M5b step 6e: the overnight card's morning). */
  units: TimeUnits | null;
  /**
   * A player's view of the rules of the place each group is in (dec-7 piece 3, mc-51): only the open ones; null when the
   * read failed (the screen keeps its last good list, so a network blip never reads as a closed rule).
   */
  placeRules: PlayersRule[] | null;
}

/**
 * The expedition under way, its groups' places, which groups share a place, and (the GM's) the places named before.
 * `gm` is false in the GM's view as the player (C15f), whose reads are the player's; `me` is whose characters are mine.
 */
async function loadPlaces(db: Db, user: CurrentUser, campaignId: string, members: GroupOf | null, marchers: readonly Marcher[] | null, gm: boolean, me: string, asPlayer: string | undefined) {
  const [scene, meeting, setting, settings] = await Promise.all([loadScene(db, campaignId), loadMeeting(db, campaignId), loadCampaignSetting(db, user.id, campaignId), loadCampaignSettings(db, campaignId)]);
  const expedition = scene?.expedition ?? null;
  const [places, known, shown, lastPlaces, towns, switches, placeRules] = await Promise.all([
    expedition && gm ? loadGroupPlaces(db, campaignId, expedition.id) : Promise.resolve(new Map<number, GroupPlace>()),
    gm ? loadRecentPlaceRows(db, campaignId) : Promise.resolve([]),
    expedition && !gm ? loadScenePlaces(db, campaignId, asPlayer) : Promise.resolve(new Map<number, ScenePlace>()),
    !expedition && gm ? loadLastPlaces(db, campaignId) : Promise.resolve(new Map<number, GroupPlace>()),
    // A player's towns are extra: when they can't be read the rest of Scene still shows.
    gm ? Promise.resolve(new Map<number, SceneTown>()) : loadSceneTowns(db, campaignId, asPlayer),
    gm ? loadTownSwitches(db, campaignId) : Promise.resolve(null),
    // A player's place rules are extra too: unreadable, the place line shows without its rule buttons.
    expedition && !gm ? loadPlayersRules(db, campaignId, asPlayer) : Promise.resolve([] as PlayersRule[]),
  ]);
  const travel = scene && setting && settings && members && marchers ? await loadTravelView(db, campaignId, scene, setting, settings, members, marchers, { userId: me, gm }) : null;
  const camps = travel ? await loadCamps(db, campaignId, travel.expeditionId, travel.day) : new Map<number, { camp: CampRow; entries: CampEntry[] }>();
  return scene && places && meeting && shown && camps && lastPlaces
    ? {
        expedition,
        places,
        scene: shown,
        meeting,
        recent: known,
        setting,
        travel,
        camps,
        now: scene.clock?.seconds ?? 0,
        lastPlaces,
        towns: towns ?? new Map<number, SceneTown>(),
        townsRead: towns !== null,
        switches,
        townMode: expedition?.mode ?? scene.lastMode ?? null,
        adventure: scene.campaignMode !== 'downtime',
        units: setting ? campaignUnits(settings ?? null, setting.rulesSets) : null,
        placeRules,
      }
    : null;
}

export function PartyGroups({
  db,
  user,
  campaign,
  restButton,
  dark,
  actor,
  lead,
  player,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The players' Rest button under a group's marching order (B5, B18), from the time strip's rest flow. */
  restButton?: (group: number) => ReactNode;
  /** Whether a group is in darkness (no light lit in a dark mode), from the time strip: its tiles read "◑ No light". */
  dark?: (group: number) => boolean;
  /** The players' screen's own character (M5b step 3): what they may do; their activity buttons join Force march's group. */
  actor?: ActorFacts;
  /**
   * The GM's time strip (SceneTime), placed first (M5b step 1 follow-up, build order 7; 06 "Wilderness day"): on a
   * landscape tablet in a wilderness day it heads the day controls on the left, beside the location view and marching
   * order on the right. Always the first thing in the same place, so it never reloads as the layout changes.
   */
  lead?: ReactNode;
  /**
   * The GM's view as the player (C15f, pg32-5; page 32, M3i): whose Scene this is, so it shows their group's page as
   * they see it, never every group. The place's reads (pieces, picture, card, knowledge, rules, town) are then made as
   * that player, which the database answers for the campaign's GM only (ruling a2, 2026-11-22).
   */
  player?: string;
}) {
  const show = useToast();
  const logVersion = useLogVersion();
  const [loaded, setLoaded] = useState<Loaded | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  // The GM's group in focus (this device's).
  const [focus, setFocus] = useState(1);
  const [splitting, setSplitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const phone = usePhone();
  // A failed read of the players' place rules keeps the last good list (review of #726).
  const placeRules = useLastGoodRules(loaded && loaded !== 'error' ? loaded.placeRules : null);
  // A player's ways on (P2), read beside the page so "Where to?" comes with it; a failed read keeps the last list.
  // The GM's own Scene shows every group; in his view as the player, the player's (C15f).
  const gm = isGm(user, campaign.id) && player === undefined;
  const me = player ?? user.id;
  // The players' reads are made as the player only when that is someone else (the GM's own character reads as him).
  const readAs = player !== undefined && player !== user.id ? player : undefined;
  const ways = usePlayersWaysOn(db, campaign.id, !gm);
  // The players' place card (P4): the Area's card's read and what the GM has shared (a player's only).
  const areaCards = usePlayersPlaceCards(db, campaign.id, !gm, readAs);
  // The players' map (P5): the shared map of the last place shown to each of a player's groups. Its read has no form
  // naming a player yet, so in the GM's view as another player it isn't made: no map and no dashed frame show (not a
  // stuck skeleton, and never "No map shared yet." on a guess: the player may still see the last place's map).
  const mapsUnread = readAs !== undefined;
  const playersMaps = usePlayersMaps(db, campaign.id, !gm && !mapsUnread);

  useEffect(() => {
    let current = true;
    void Promise.all([loadGroupMembers(db, campaign.id), loadMarchers(db, campaign.id)]).then(async ([members, marchers]) => {
      const places = await loadPlaces(db, user, campaign.id, members, marchers, gm, me, readAs);
      if (!current) return;
      setLoaded(members && marchers && places ? { members, marchers, ...places } : 'error');
    });
    return () => {
      current = false;
    };
  }, [db, user, campaign.id, logVersion, version, gm, me, readAs]);

  // A place page (and with it "Waiting for you") shows for the GM wherever the party is during an expedition, but in a
  // town; while the read is still out it may: the strip keeps what waits out of sight meanwhile (S8b).
  useExpectPanel(
    gm &&
      (loaded === null ||
        (loaded !== 'error' && !!loaded.expedition && (loaded.places.size === 0 || [...loaded.places.values()].some((row) => !(row.place && isSettlement(row.place)))))),
  );
  if (loaded === null) {
    // A player's Scene (P1; PL9): still bars where the page's cards will be, one in each column.
    if (!gm)
      return (
        <div className="groups-layout">
          <div className="groups-layout__main">
            <PlayersSceneLoading />
          </div>
        </div>
      );
    return (
      <div className="groups-layout">
        <div className="groups-layout__main">
          {lead}
          <section className="groups" aria-label="Marching order">
            <SkeletonRows rows={3} label="Loading the marching order" />
          </section>
        </div>
      </div>
    );
  }
  if (loaded === 'error') {
    return (
      <div className="groups-layout">
        <div className="groups-layout__main">
          {lead}
          <section className="groups" aria-label="Marching order">
            <p className="groups__note" role="alert">
              Couldn't load the party's groups. Check your connection and try again.
            </p>
            <StackedButton icon="refresh" label="Try again" onClick={() => setVersion((v) => v + 1)} />
          </section>
        </div>
      </div>
    );
  }

  const { members, marchers, expedition, places, scene, meeting, recent, setting, travel, camps, now, lastPlaces, towns, townsRead, switches, townMode, adventure, units } = loaded;
  const camping = travel && setting ? campInfo({ setting, mode: travel.mode, modes: travel.rules.modes, units: travel.units, choices: travel.choices, gm, season: travel.season }) : null;
  const groups = groupsOf(members, marchers.map((m) => m.id));
  const split = isSplit(groups);
  // Join up (B1): only for groups in the same place (both with none counts as the same).
  const pairs = meetingPairs(groups.map((g) => g.number), meeting);
  const exploration = readExploration(setting?.rulesSets ?? []);
  // The expedition's step on the clock (P4): a shared section's "turn 9" counts in it, as the strip does.
  const tripMode = expedition ? modeById(exploration.modes, expedition.mode) : null;
  const turns: TurnClock | null = expedition && units && tripMode && !isPartOfDay(tripMode.step.unit) ? { startedAt: expedition.startedAt, step: tripMode.step, units } : null;
  const choices = setting ? choicesInPlay(setting) : {};
  const checks = expedition ? (modeById(exploration.modes, expedition.mode)?.checks ?? []).filter((c) => optionOn(c.onlyWithOption ?? null, choices)) : [];
  // The town screen (M5b step 6c): the setting's towns, and the checks of the mode the party is in (or was last in).
  const townRules = readTown(setting?.rulesSets ?? [], choices);
  const townChecks = townMode ? (modeById(exploration.modes, townMode)?.checks ?? []).filter((c) => optionOn(c.onlyWithOption ?? null, choices)) : [];
  // A player's town activities (M5b step 6e, ST8): the town mode's own, in the pack's order; a step in its words.
  const townModeRead = townMode ? modeById(exploration.modes, townMode) : null;
  const townActivities = (townModeRead?.activities ?? []).filter((a) => !a.secret && optionOn(a.onlyWithOption, choices));
  const stepWords = (steps: number) =>
    townModeRead && isPartOfDay(townModeRead.step.unit) ? (steps === 1 ? 'a part of the day' : `${steps} parts of the day`) : `${steps} ${townModeRead?.step.unit ?? 'step'}${steps === 1 ? '' : 's'}`;
  // ⚑ 7: a picked place remembers its region, from the rules sets' regional tables.
  const regionalTables = regionalTablesOfRulesSets(setting?.rulesSets ?? []);
  // The town screen (delivery 5, pull request 2): a place its pack marks a settlement, or one marked Safe or Hostile.
  const townOf = (n: number, row: GroupPlace | null | undefined, embedded: boolean) =>
    row?.place && isSettlement(row.place) ? (
      <TownScreen
        key={`town:${row.place.id}:${row.place.version}`}
        db={db}
        user={user}
        campaign={campaign}
        place={row.place}
        visit={{ id: row.id, pieces: row.pieces, picture: row.picture ?? null }}
        groupLabel={split ? groupName(n) : null}
        rules={townRules}
        checks={townChecks}
        switches={switches}
        offerSwitches={adventure}
        underWay={expedition !== null}
        embedded={embedded}
        onChanged={() => setVersion((v) => v + 1)}
      />
    ) : null;
  const shownFocus = groups.some((g) => g.number === focus) ? focus : groups[0]!.number;
  // A player's own groups: where their characters are (all groups' first, the party, if they have none here).
  const mine = groups.filter((g) => g.ids.some((id) => marchers.find((m) => m.id === id)?.ownerUserId === me));
  const shown = gm ? [shownFocus] : (mine.length > 0 ? mine : groups.slice(0, 1)).map((g) => g.number);

  /** Undoes this person's newest change of a kind (the same Undo as the log). */
  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    setVersion((v) => v + 1);
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  /** A character to a group (null: a new one), at once, with Undo. */
  async function choose(marcher: Marcher, to: number | null) {
    if (busy) return;
    const at = groupOf(members, marcher.id);
    if (to === at) return;
    if (to === null && at !== 1 && groups.find((g) => g.number === at)?.ids.length === 1) {
      return show({ text: `${marcher.name} is in a group of their own already.`, error: true });
    }
    setBusy(true);
    const result = await runCommand(registry, db, user, chooseGroup, { character: { id: marcher.id, campaignId: campaign.id, ownerUserId: marcher.ownerUserId }, group: to });
    setBusy(false);
    setVersion((v) => v + 1);
    if (!result.ok) return show({ text: result.message, error: true });
    // With one group left, the database makes everyone the party again.
    const after = new Map(members).set(marcher.id, result.value);
    const together = !isSplit(groupsOf(after, marchers.map((m) => m.id)));
    show({ text: together ? 'The party is together again' : `${marcher.name} is in ${groupName(result.value)}`, onUndo: () => void undoLatest('party.chooseGroup') });
  }

  /** Join up: one group joins another, at once, with Undo. */
  async function join(from: number, into: number) {
    if (busy) return;
    setJoining(false);
    setBusy(true);
    const result = await runCommand(registry, db, user, joinUp, { campaignId: campaign.id, together: true, from, into });
    setBusy(false);
    setVersion((v) => v + 1);
    if (!result.ok) return show({ text: result.message, error: true });
    const text = groups.length <= 2 ? 'Joined up: the party is together again' : `${groupName(from)} joined ${groupName(into)}`;
    show({ text, onUndo: () => void undoLatest('party.joinUp') });
  }

  // Wilderness day on a landscape tablet (06, S7): the GM's day controls left, the location view and marching order
  // right. Narrower screens stack the two columns, in the same order as before.
  const day = gm && travel !== null;
  // On a phone in a wilderness day (06, S7; bq-4) the location view is an Open card that opens it as a sheet.
  const sheet = phone && travel !== null;
  const controlsOf = (n: number) => (
    <>
      {travel && (
        <TravelCard
          db={db}
          user={user}
          campaign={campaign}
          group={n}
          groupLabel={split ? groupName(n) : null}
          view={travel}
          gm={gm}
          mine={mine.some((g) => g.number === n)}
          recent={recent}
          regionalTables={regionalTables}
          onChanged={() => setVersion((v) => v + 1)}
          activities={
            actor && !gm && mine.some((g) => g.number === n) && !camps.has(n)
              ? (row) =>
                  offeredActivities(travel, row.terrainId, actor).length > 0 ? (
                    <ActivityButtons
                      db={db}
                      user={user}
                      campaign={campaign}
                      group={n}
                      view={travel}
                      row={row}
                      actor={actor}
                      itemOf={(id) => {
                        const entry = setting?.items.find((e) => e.packEntryId === id);
                        return entry ? yieldItemOf(entry) : null;
                      }}
                      onChanged={() => setVersion((v) => v + 1)}
                      player={player}
                    />
                  ) : null
              : undefined
          }
        />
      )}
      {/* During camp (S4-5) the camp's steps take the activities' place. */}
      {travel && camping && camps.get(n) && (
        <CampCard
          db={db}
          user={user}
          campaign={campaign}
          groupLabel={split ? groupName(n) : null}
          info={camping}
          camp={camps.get(n)!.camp}
          entries={camps.get(n)!.entries}
          members={(groups.find((g) => g.number === n)?.ids ?? []).flatMap((id) => {
            const m = marchers.find((x) => x.id === id);
            return m && !m.archived ? [{ id: m.id, name: m.name, ownerUserId: m.ownerUserId, hpCurrent: m.hpCurrent, hpMax: m.hpMax }] : [];
          })}
          now={now}
          hour={travel.units.hour ?? null}
          forcedMarch={(travel.rows.get(n)?.forced ?? 0) > 0 && travel.rows.get(n)?.day === camps.get(n)!.camp.day}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
  // `ownGroup`: a player's own group alone on their page (PL6), its line naming who is elsewhere.
  const marchingOf = (n: number, ownGroup = false) => (
    <MarchingOrder
      db={db}
      user={user}
      campaign={campaign}
      group={n}
      split={split}
      ownGroup={ownGroup}
      footer={!gm && expedition ? restButton?.(n) : undefined}
      dark={!gm && expedition ? (dark?.(n) ?? false) : false}
      player={player}
    />
  );
  // The GM's place page (dec-7 piece 5b): wherever the party is during an expedition, but in a town, which keeps
  // today's town screen until 5t. The marching order is the last thing in its right column.
  const pageOf = (n: number) => {
    const row = places.get(n) ?? null;
    if (!expedition || !gm || (row?.place && isSettlement(row.place))) return null;
    return (
      <GmPlacePage
        db={db}
        user={user}
        campaign={campaign}
        expeditionId={expedition.id}
        group={n}
        groupLabel={split ? groupName(n) : null}
        row={row}
        checks={checks}
        recent={recent}
        regionalTables={regionalTables}
        terrain={travel ? (terrainOf(travel.mode, travel.rows.get(n)?.terrainId)?.name ?? null) : null}
        phone={phone}
        oneColumn={day}
        marching={marchingOf(n)}
        turns={turns}
        onChanged={() => setVersion((v) => v + 1)}
      />
    );
  };
  const viewOf = (n: number) =>
    pageOf(n) ?? (
    <>
      {expedition && gm && (
        <PlaceCard
          db={db}
          user={user}
          campaign={campaign}
          group={n}
          groupLabel={split ? groupName(n) : null}
          row={places.get(n) ?? null}
          checks={checks}
          recent={recent}
          regionalTables={regionalTables}
          terrain={travel ? (terrainOf(travel.mode, travel.rows.get(n)?.terrainId)?.name ?? null) : null}
          phone={sheet}
          town={townOf(n, places.get(n), true)}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
      {/* In town and in Downtime (no expedition under way): the town screen on its own, where the party stayed. */}
      {!expedition && gm && townOf(n, lastPlaces.get(n), false)}
      {/* B18: the players' table view puts the marching order (with Rest under it) above the place. */}
      {marchingOf(n)}
      {expedition && !gm && <PlaceLine place={scene.get(n) ?? null} db={db} campaignId={campaign.id} phone={sheet} rules={placeRules.filter((r) => r.group === n)} />}
      {!gm && <TownLine town={towns.get(n) ?? null} rules={townRules} named={!expedition || !placeLineShows(scene.get(n))} />}
      {!gm && actor && adventure && towns.get(n) && mine.some((g) => g.number === n && g.ids.includes(actor.id)) && (
        <TownActions
          db={db}
          user={user}
          campaign={campaign}
          town={towns.get(n)!}
          rules={townRules}
          setting={setting}
          character={{ id: actor.id, name: actor.name }}
          activities={townActivities}
          stepWords={stepWords}
          now={now}
          units={units}
        />
      )}
    </>
  );
  const focusChips = (
    <>
      {gm && split && (
        <div className="groups__focus" role="group" aria-label="Group in focus">
          {groups.map((g) => (
            <Chip key={g.number} pressed={g.number === shownFocus} onClick={() => setFocus(g.number)}>
              {`${g.number === shownFocus ? '✓ ' : ''}${groupName(g.number)}, ${g.ids.length}`}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
  const groupActions = (
    <>
      {marchers.length > 0 && (
        <div className="groups__actions">
          {/* "Split party" with the parting arrows (ic-4, S17); split, the same button reads "Change groups". */}
          <StackedButton icon="split-arrows" label={split ? 'Change groups' : 'Split party'} onClick={() => setSplitting(true)} />
          {split && pairs.length > 0 && (
            <button type="button" className="button-secondary button-secondary--small" onClick={() => (pairs.length === 1 ? void join(pairs[0]!.from, pairs[0]!.into) : setJoining(true))}>
              Join up
            </button>
          )}
        </div>
      )}
    </>
  );

  // The players' page (plan dec-9-the-players-scene, P1; page 18, PL1, PL2, PL5): two columns under the top, the
  // place the party is at at the left, what there is to read at the right, the marching order last. Structure only:
  // what stands in it is today's parts, until their own rows (P2, P4, P8) are built. Before anything of a group's
  // place is shown (mc-50, PL2) the left card says so and the right column keeps its place, empty.
  // A failed read of the towns keeps today's column: without it nobody can say the player isn't in a town.
  // One group in a town is enough to keep today's column for all of a player's groups: the town is its own plan.
  const playersPage = showsPlayersPage({ gm, expedition: expedition !== null, day: travel !== null, townsRead, inTown: shown.some((n) => towns.has(n)) });
  // A player whose characters are in more than one group has a card for each: each says whose it is. With one card
  // nothing is added (PL6 draws a split player's own group without its name).
  const cardGroup = (n: number) => (shown.length > 1 ? groupName(n) : null);
  const playersPageOf = () => (
    <PlayersScenePage
      left={
        <>
          {shown.map((n) => {
            const here = scene.get(n);
            // The Location's card (P4, ppf-6) in place of today's place line: the card's read gives the number and the
            // trail; until it comes, while it fails, or while it is still of the place before a move (matched by the
            // place's id), the place's name as the scene's read gives it, with no trail.
            const read = areaCards.cards.get(n);
            const card = read && here?.placeId && read.here.placeId === here.placeId ? read : { here: { placeId: '', key: '', name: here?.name ?? '' }, trail: [] };
            return (
              <Fragment key={n}>
                {here && placeLineShows(here) ? (
                  <PlayersLocationCard
                    card={card}
                    pieces={here.pieces.map((p) => ({ id: p.id, kind: p.kind, text: p.text, lead: p.lead ?? '' }))}
                    rules={placeRules.filter((r) => r.group === n)}
                    picture={here.pictureAssetId ? { db, campaignId: campaign.id, assetId: here.pictureAssetId } : null}
                    group={cardGroup(n)}
                  >
                    <PlayersWhereTo read={ways} group={n} step={stepNowOf(expedition ? modeById(exploration.modes, expedition.mode) : null, expedition, now, units)} />
                  </PlayersLocationCard>
                ) : (
                  <SomewhereNew group={cardGroup(n)}>
                    <WhereToNoneYet />
                  </SomewhereNew>
                )}
              </Fragment>
            );
          })}
          {/* Activities (P6; mc-45a; 01-08) under the place's card, once only: they are the setting's, not a group's.
              Before anything of the place is shown too (d5-18, 2026-11-20), so the card never blinks away at a new
              Location. */}
          <PlayersActivities activities={activitiesWithRules(setting?.rulesSets ?? [])} />
        </>
      }
      right={
        <>
          {/* The map (P5; PL1, PL5b): first in the column, the shared map of the last place shown to the group, so it
              stays through a move to a place not shown yet (mc-39b's rule; Francis, 2026-11-22). None shared: before
              anything is shown the dashed frame says so (PL2); after, no frame at all (dp-3). */}
          {shown.map((n) => {
            const label = cardGroup(n) ? `${cardGroup(n)}: the map` : 'The map';
            const map = playersMaps.maps?.get(n);
            // Read and none shared: nothing (or PL2's dashed frame). Not read yet: still bars (PL9). The first read
            // failed: says so with Try again (PL9), never "No map shared yet." on a guess. Not read at all (the GM's
            // view as another player): false, so neither a map nor the dashed frame.
            const card = mapsUnread ? false : map ? (
              <PlayersSceneCard key={`map-${n}`}>
                <PlayersMapCard db={db} campaignId={campaign.id} map={map} label={label} />
              </PlayersSceneCard>
            ) : playersMaps.maps ? null : (
              <PlayersSceneCard key={`map-${n}`} label={label}>
                {playersMaps.failed ? <RefreshFailedRow words={MAP_UNREAD_WORDS} onRetry={playersMaps.retry} /> : <SkeletonRows rows={3} label="Loading the map" />}
              </PlayersSceneCard>
            );
            return !placeLineShows(scene.get(n)) ? <NothingSharedYet key={n} group={cardGroup(n)} map={card ?? undefined} /> : card;
          })}
          {/* The Area's card (P4; PL1b): its name once shown, what the GM has shared, the Rules row, the other Locations
              the group knows. Only once something of the place is shown, as the read itself sends nothing before. */}
          {shown.map((n) => {
            const card = placeLineShows(scene.get(n)) ? areaCards.cards.get(n) : undefined;
            return card ? <PlayersAreaCard key={`area-${n}`} db={db} campaignId={campaign.id} card={card} knowledge={areaCards.knowledge.filter((k) => k.group === n)} rules={placeRules.filter((r) => r.group === n)} turns={turns} group={cardGroup(n)} asPlayer={readAs} /> : null;
          })}
          {/* Today's "What we know" left this page with the players' map (p4s-3: once P4 and P5 have both landed). */}
          {/* The marching order last in the column (PL1), today's Split party under it (PL1 doesn't draw it). Split,
              a player with one group sees it as PL6 draws: their group alone, and who is elsewhere (P8). With a card
              for each of their groups each order keeps its group's name and no such line (no frame draws that). A
              player with no character marching is shown the first group, which is not theirs: no such line either. */}
          {shown.map((n) => (
            <Fragment key={n}>{marchingOf(n, mine.length === 1)}</Fragment>
          ))}
          {groupActions}
        </>
      }
    />
  );

  return (
    <div className={day ? 'groups-layout groups-layout--day' : 'groups-layout'}>
      <div className="groups-layout__main">
        {lead}
        <section className="groups" aria-label={day ? 'The day' : split ? 'The party, split into groups' : 'The party'}>
          {focusChips}
          {playersPage ? (
            playersPageOf()
          ) : (
            <>
              {shown.map((n) => (
                <div key={n} className="groups__group">
                  {controlsOf(n)}
                  {!day && viewOf(n)}
                </div>
              ))}
              {/* What we know (S4-4): the places shown and the maps revealed to this player, on this expedition. */}
              {expedition && !gm && <WhatWeKnow db={db} campaignId={campaign.id} asPlayer={readAs} />}
              {!day && groupActions}
            </>
          )}
        </section>
      </div>
      {day && (
        <div className="groups-layout__side">
          <section className="groups" aria-label="The place and the marching order">
            {shown.map((n) => (
              <div key={n} className="groups__group">
                {viewOf(n)}
              </div>
            ))}
            {groupActions}
          </section>
        </div>
      )}

      {splitting && (
        <SplitDialog
          user={user}
          campaignId={campaign.id}
          gm={isGm(user, campaign.id)}
          groups={groups}
          members={members}
          marchers={marchers}
          onChoose={(m, to) => void choose(m, to)}
          onClose={() => setSplitting(false)}
        />
      )}

      {joining && (
        <Dialog label="Join up" onClose={() => setJoining(false)}>
          <p className="groups__note">Which groups meet? Everyone in the second joins the first, at the back of its marching order.</p>
          <ul className="groups__list">
            {pairs.map(({ from, into }) => (
              <li key={`${from}-${into}`}>
                <button type="button" className="button-secondary groups__join" onClick={() => void join(from, into)}>
                  {`${groupName(from)} joins ${groupName(into)}`}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Split the party: every character with its group. Their own player (or the GM) picks: one of the groups there are,
 * or "New group". Others' characters show where they are.
 */
function SplitDialog({
  user,
  campaignId,
  gm,
  groups,
  members,
  marchers,
  onChoose,
  onClose,
}: {
  user: CurrentUser;
  campaignId: string;
  gm: boolean;
  groups: PartyGroup[];
  members: GroupOf;
  marchers: Marcher[];
  onChoose: (marcher: Marcher, to: number | null) => void;
  onClose: () => void;
}) {
  // Your own characters first, then everyone else's (by name, as loaded).
  const mayMove = (m: Marcher) => mayChooseGroup(user, { id: m.id, campaignId, ownerUserId: m.ownerUserId });
  const ordered = [...marchers.filter(mayMove), ...marchers.filter((m) => !mayMove(m))];
  return (
    <Dialog label="Split the party" onClose={onClose}>
      <p className="groups__note">
        {gm ? 'Pick a group for anyone.' : 'Pick a group for your characters.'} Everyone shares one clock; each group has its own marching order. A
        character's hirelings go with them.
      </p>
      <ul className="groups__list">
        {ordered.map((m) => {
          const at = groupOf(members, m.id);
          return (
            <li key={m.id} className="groups__who">
              <span className="groups__name">{m.name}</span>
              {mayMove(m) ? (
                <div className="groups__choices" role="group" aria-label={`${m.name}'s group`}>
                  {groups.map((g) => (
                    <Chip key={g.number} pressed={g.number === at} onClick={() => onChoose(m, g.number)}>
                      {`${g.number === at ? '✓ ' : ''}${groupName(g.number)}`}
                    </Chip>
                  ))}
                  <Chip onClick={() => onChoose(m, null)}>New group</Chip>
                </div>
              ) : (
                <span className="groups__where">{groupName(at)}</span>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="button-secondary" onClick={onClose}>
        Done
      </button>
    </Dialog>
  );
}

/** Whether a player's place line shows anything (PlaceLine shows nothing before the first piece or the picture). */
const placeLineShows = (place: ScenePlace | undefined): boolean => !!place && (place.pieces.length > 0 || place.pictureAssetId !== null);
