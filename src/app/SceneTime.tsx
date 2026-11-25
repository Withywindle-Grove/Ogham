// The time strip on Scene (M5 step 5; docs/05 "Expeditions, time and light"; docs/06 "GM — Adventure console";
// ruled 2026-10-29: D18–D23, D32, afternoon ruling 1). Everyone sees the time: the expedition's mode and step
// ("Delve · turn 3") or Downtime, and the day and time of day; changes on another device show within seconds (the
// log's live updates reload it). The GM also gets:
//   * Start session (one tap) while none is running; End session in the strip's ⋯.
//   * Between expeditions: a mode and Start expedition (one tap plus a mode, D21); Downtime's +1 day, +1 week and
//     To day… (D32: only the GM moves game time).
//   * During one: the mode's main advance ("Next turn", or the mode's own step), which runs the procedure; a long
//     press asks how many and runs it for each; Undo; and in ⋯ Advance by… (not a correction), Set time… (a
//     correction, nothing runs) and End expedition (no confirm: its summary shows with Undo and Full rest, D22).
// What came due goes on the reminder card (M5 step 6): checks with Hit / Miss and what a hit rolls, the GM's own
// reminders, the setting's remind hooks and timed recharges, merged with counts. With an expedition under way the GM
// also sees the hour track (turn modes) or the procedure strip (day modes), the checklist (Procedure, in the top
// row), and the current encounter table; players see the hour track's public events, the public reminders and the
// player-facing procedure (the check results revealed in Downtime are in the log; the Scene card went at the M5 gate,
// B17).
// M5 step 10 (ruled 2026-10-30, DG1–DG3, S2-7): Start expedition asks the mode and an optional Where? (recent places as
// chips, picking the mode they started in, or a typed name; the place is the GM's alone); Check now (⋯, or the check
// marker on the hour track) puts an ad-hoc wandering check on the card, per group after a split, and the schedule
// carries on; in day modes ⋯ has Travelling in darkness (players' screens dim without a light) and the strip says
// "Sunset around now" from the pack's daylight. `compact` is the Compact time strip (DG2): the mode and step, the
// pips and the main advance, on every other GM screen during an adventure; it shares the reminder card with Scene
// (useSticky) and links there when something is on it.
import { partyMembersOf } from './partyMembers.ts';
import { STORED_SEPARATOR } from '../core/storedWords.ts';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isGm, runCommand, type Command, type CurrentUser } from '../core/commands.ts';
import { loadCampaignSettings, updateCampaign } from '../core/campaignCommands.ts';
import type { Json } from '../core/database.types.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { setHp } from '../modules/characters/hp.ts';
import { addHandModifier, allDone, cardFrom, addCheckNow, checkAgain, checkNowLines, groupOfCheckName, mergeCard, perGroup, takeOne, withoutLines, type CardLine } from '../modules/expedition/card.ts';
import { daylightOf, daylightOn, isNight } from '../modules/expedition/daylight.ts';
import { DEPTH_LABEL, depthModifier, depthWords, hasRoll, readDungeonExit, type DungeonExit, type RolledExit } from '../modules/expedition/dungeonExit.ts';
import { askRequests, escapePromptOf, loadRequests } from '../modules/requests/requests.ts';
import { useSceneCardListener, type CardChange } from './sceneCard.tsx';
import { useSceneMoverListener, type MoveRequest, type SceneMover } from './sceneMove.tsx';
import { moveOn as placeMoveOn } from '../modules/expedition/placeMove.ts';
import { useSticky } from './stickyState.ts';
import { groupName, groupsOf, type GroupOf } from '../core/partyGroups.ts';
import { loadGroupMembers } from '../modules/expedition/groupPlay.ts';
import { loadMarchers } from '../modules/expedition/marchingPlay.ts';
import { checkPrompt, isEncounterCheck, type TableCandidate } from '../modules/expedition/checks.ts';
import { calendarStartOf, dateAfter, elapsedSteps, dateOnClock, isPartOfDay, morningStarts, partOfDay, monthsOf, seasonsOf, showDate, startForToday, startIndex, unitName, type CalendarStart, type TimeUnits } from '../modules/expedition/clock.ts';
import { FALLBACK_MODES, isPointToPoint, methodsOf, modeById, optionOn, pointToPoint, readExploration, terrainOf, type Icon, type Mode } from '../modules/expedition/modes.ts';
import { hookSchedules, rechargeSchedules, reminderSchedules } from '../modules/expedition/reminders.ts';
import {
  addReminder,
  editReminder,
  loadRecharging,
  loadCheckResults,
  loadReminders,
  recordCheck,
  recordCheckAgain,
  recordCheckNow,
  revealCheck,
  setCheckRoll,
  type CheckResult,
  type Reminder,
} from '../modules/expedition/reminderPlay.ts';
import { dueOnJump } from '../modules/expedition/schedule.ts';
import { readTable, type ReadTable, type TableRow } from '../modules/expedition/tables.ts';
import { loadTablePins, pinTable, readTableByHand, unpinTable, type TablePin } from '../modules/expedition/tablePins.ts';
import { dismissEncounter, hitQueuesEncounter, setEncounterWatch, loadWaitingEncounters, queueEncounter, startEncounter, type EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { sceneCandidatesOf, whichTables } from '../modules/expedition/tableList.ts';
import { recharge } from '../modules/inventory/charges.ts';
import {
  advanceTime,
  advanceTimeBy,
  advanceLabel,
  betweenLine,
  endDowntime,
  loadParty,
  nextPartOfDay,
  startDowntime,
  campaignUnits,
  clockHasMoved,
  DEFAULT_START_TIME,
  setStartTime,
  startTimeOf,
  startTimeWords,
  type StartTime,
  clockWords,
  answerSafePlace,
  endExpedition,
  endSession,
  expeditionLine,
  stepOfLine,
  fullRest,
  leaveBySafePaths,
  latestClockMove,
  dayStartsAfter,
  loadRecentPlaces,
  loadScene,
  loadStartPlace,
  loadWhoWent,
  noteLine,
  PLACE_NAME_MAX,
  passDowntime,
  restRefills,
  resumedMidDungeon,
  seasonNotNow,
  setTime,
  startExpedition,
  startSession,
  shownAgainWords,
  stepUnit,
  timeWords,
  type Expedition,
  type ProcedureSummary,
  type SceneState,
  type StartPlace,
  type WentCharacter,
} from '../modules/expedition/play.ts';
import { loadPartyLights } from '../modules/expedition/lightPlay.ts';
import { engineStatuses, loadRests, REST_ANSWER_WORDS, restNow, restRuleWords, statusEffects, type CharacterRest } from '../modules/expedition/statusPlay.ts';
import { answerOf, answerRest, callRest, flipped, forcedRestGroups, forcedWithoutCamp, pushedOn, restArg, restFlows, restToApply, withForcedOpen, type RestFlow } from '../modules/expedition/restFlow.ts';
import type { Marcher } from '../modules/expedition/marchingPlay.ts';
import { RestPanel, RestPrompt, RestRule, type RestLine } from './RestPrompt.tsx';
import { PromptSlot } from './PromptSlot.tsx';
import { CallsInPromptSlot } from './CallCard.tsx';
import { usePlayerCalls } from './usePlayerCalls.ts';
import { darkMode, inDarkness } from '../modules/expedition/darkness.ts';
import { loadTownSwitches, resetTownSwitches, setActiveNight, setOutDay } from '../modules/expedition/townPlay.ts';
import { ACTIVE_NIGHT, afterFlip, anyOn, endedWords, flipToastWords, OUT_DAY, reachesMorning, runsNow, switchesLine, SWITCHES_OFF, type TownSwitches } from '../modules/expedition/townSwitches.ts';
import { statusWordsOf } from './Statuses.tsx';
import { useStatusBook } from './Statuses.tsx';
import { advanceBy, checkNow, encounterCheckOf, hourTrackNow, needsSeason, nextStep, ranOutLine, setTime as correctTime, stepSeconds, type Expedition as Running } from '../modules/expedition/procedure.ts';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { BookFaces } from '../ui/BookFaces.tsx';
import { DiceWords } from '../ui/dice.tsx';
import { bandHeading, checkFact, checkSheetLines, checkRule, dateWords, DEPART_LABEL, departAreaName, departMethodOf, departModeOf, lightFact, lightLeftWords, lightSheetLines, NO_LIGHT_WORDS, partOfDayFact, partOfDayWords, partyInSettlement, placeMethodOf, regionOfChain, restEveryWords, restFact, restSheetLines, seasonIconOf, settingRule, sessionLine, sessionStateOf, showsDowntimeTop, showsTownTop, TOWN_STEP_LABEL, weatherFact, type Fact } from '../modules/expedition/sceneTop.ts';
import { BandTool, BandTools, DepartButton, FactSheet, FactsRow, NextTurnButton, SceneBand, SessionButton, type DateLine } from './SceneBand.tsx';
import { useSceneTopOpen } from './sceneTopOpen.ts';
import { loadWayOut } from '../modules/expedition/dungeonWayOut.ts';
import { applyNightRest, loadRestCharacters, NightRestSheet, REST_READ_FAILED, restListed, type Rester } from './NightRest.tsx';
import { endCardFor, endCardRows, healingWithSource, restLeftOut, restLine } from '../modules/expedition/endCard.ts';
import { MenuItem, MenuItems, MoreMenu } from '../ui/MoreMenu.tsx';
import { campInfo } from './campView.ts';
import { loadOpenCamps, openCamp, whyNoCamp } from '../modules/expedition/campPlay.ts';
import { loadTravelGroups } from '../modules/expedition/travelPlay.ts';
import { dayStartWords, loadTravelView, travelDayStarts } from './travelView.ts';
import { morningLines, ordinal, watchesOf } from '../modules/expedition/camp.ts';
import { nightAnswers, nightPlan, type NightAsked } from '../modules/expedition/nightCheck.ts';
import { ActionBar, ButtonRow, CloseButton, DamagePad, SkeletonRows, StackedButton, StackedGroup, Stepper, Switch } from '../ui/parts.tsx';
import { Icon as UiIcon, StepIcon } from '../ui/icons.tsx';
import { PlacePicker, placeWords, type PickedPlace } from './PlacePicker.tsx';
import { loadLastShownPlaces, loadPackPlaceEntry, loadPackPlaces, loadRecentPlaceRows, loadRegionNow, type Place } from '../modules/expedition/placePlay.ts';
import { loadLastPlaces } from '../modules/expedition/townPlaces.ts';
import { blocksOfRead, chainAfterRead, loadPlayersCheck, noCampHere, placeCheckOf, readPlaceRulesNow, type ChainEntry, type PlaceCheck, type PlayersCheck, type RuleSwitch } from '../modules/expedition/placeRules.ts';
import { procedureInForce, type StripStep } from '../modules/expedition/stripSteps.ts';
import { RuleSheet } from './PlaceRules.tsx';
import { placeFromPack, regionalTablesOfRulesSets } from '../modules/expedition/placeFromPack.ts';
import { loadMoveOn, moveTime, stepUnitHere } from '../modules/expedition/moveOnWays.ts';
import type { MoveCheck } from '../modules/expedition/moveOn.ts';
import { keyedName, wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { RollPrompt } from '../ui/RollPrompt.tsx';
import { useToast, useToastSwap } from '../ui/ToastHost.tsx';
import { useLogChanged, useLogVersion } from './campaignLog.tsx';
import { choicesInPlay, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { withRowLinks } from '../modules/expedition/rowLinks.ts';
import { sourceLine } from '../modules/library/describe.ts';
import { layOutStatBlock } from '../modules/library/statBlockLayout.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { SetDateSheet, startWords, WhichSeason } from './CalendarStart.tsx';
import { EncounterTables, EncounterTablesRow, TableRoll, TablesLibrary, type TableTap } from './EncounterTables.tsx';
import { EncounterWaitingSource, shownWatch } from './EncounterWaiting.tsx';
import { accentOwner, useAccentHeld, useStripPaused, useWaitingAccentItem, useWaitingPanelOn, useWaitingState, WaitingSource, type WaitingSourceItem } from './sceneWaiting.tsx';
import { firstAnswer, HitPanel, hitTitle, ReminderCard, rollsTable, type CardRoll } from './ReminderCard.tsx';
import { HourTrack, ProcedureList, ProcedureStrip } from './SceneProcedure.tsx';
import { GmReminders, PlayerReference } from './SceneReminders.tsx';
import { registry } from './services.ts';
import { useMessaging } from './Messages.tsx';
import { useWeather, useWeatherFold, WeatherCard } from './WeatherCard.tsx';
import { WeatherSheet } from './WeatherSheet.tsx';
import { LightFactSheet, type CharacterLightView } from './LightSection.tsx';
import './SceneTime.css';
import { EndCard, RestLines } from './EndCard.tsx';
import { SafePlaceQuestion, StayingAWhile } from './EndSafety.tsx';

// How long a press on the main advance must last to ask "how many" (ms).

/** An item line that recharges on a timer, as the GM's device read it. */
type RechargeItem = Awaited<ReturnType<typeof loadRecharging>>[number];

export function SceneTime({
  db,
  user,
  campaign,
  onTopActions,
  compact = false,
  onOpenScene,
  tableView,
  player,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The GM console's top-row buttons for Scene, or null for none (none since the M5 gate: Procedure moved to the strip). */
  onTopActions?: (actions: ReactNode) => void;
  /** The Compact time strip (DG2), for every GM screen but Scene: shown only during an expedition. */
  compact?: boolean;
  /** The compact strip's way to Scene, when something waits on the reminder card. */
  onOpenScene?: () => void;
  /**
   * The players' live table view (B18, M5 gate): `prompts` join the prompt slot under the time band (the rest prompt
   * and the weather card are the strip's own); `body` is the marching order and the place, given the Rest button
   * for a group (B5: calls a rest out of turn).
   */
  /**
   * The GM's view as the player (C15f, pg32-5; page 32, M3i): whose Scene this is. The strip is then the player's, their
   * characters' group and Rest; what the GM does here still runs as his, through `can()`.
   */
  player?: string;
  tableView?: { /** The slot's other prompts, one keyed element each (the slot orders them, newest on top). */ prompts: ReactNode; /** The player's own light, for the Light pop-up's "Light" (PL8). */ light?: CharacterLightView; body: (restButton: (group: number) => ReactNode, dark?: (group: number) => boolean) => ReactNode };
}) {
  const gm = isGm(user, campaign.id) && player === undefined;
  // Whose characters are "mine": the player's in the GM's view, else the reader's.
  const me = player ?? user.id;
  // The players' reads are made as the player only when that is someone else (the GM's own character reads as him).
  const readAs = player !== undefined && player !== user.id ? player : undefined;
  const logVersion = useLogVersion();
  // The GM's place page holds the screen's accent (Move on): the main advance is then plain (5b).
  const accentHeld = useAccentHeld();
  const waitingAccent = useWaitingAccentItem();
  // Opens a "Waiting for you" item from its row's button (a roll's Enter roll… opens its table in the card).
  const openWaitingRow = useWaitingState()?.openRow;
  // What the strip changes, the rest of Scene shows at once on this device (the place card, the day's travel; gate
  // walk 2026-11-06), not only when the live connection's echo arrives (a tablet can miss it).
  const logChanged = useLogChanged();
  const show = useToast();
  const toasts = useToastSwap();
  // End's toast (6 s, with Undo): taken down when downtime starts, so its Undo can't un-end an expedition mid-downtime.
  const endToast = useRef<number | null>(null);
  const [scene, setScene] = useState<SceneState | null | 'error'>(null);
  // st-11: how many scene reads had begun, and which of them the shown `scene` is (for the band's hold below).
  const readsBegun = useRef(0);
  const [sceneBegun, setSceneBegun] = useState(0);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  // The town switches (M5b step 6.0, sw-1 … sw-4): kept with the campaign, read again with the log.
  const [switches, setSwitches] = useState<TownSwitches | null>(null);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [version, setVersion] = useState(0);
  const [ended, setEnded] = useState<Expedition | null>(null);
  // Start downtime's full rest (M5b step 6a): who rested, shown with Undo until closed; null when none to show.
  const [downtimeBegan, setDowntimeBegan] = useState<WentCharacter[] | null | 'none'>('none');
  // In a safe place? (m8b-0 delivery 5, ruled 2026-11-06): the answer is kept with the expedition's end (`ended`);
  // after Yes the summary offers Start downtime · Not yet, and Not yet puts that offer away on this screen.
  const [notYet, setNotYet] = useState(false);
  const [asking, setAsking] = useState<'by' | 'part' | 'day' | 'checklist' | 'date' | 'season' | 'no-check' | 'leave' | 'light' | 'check' | 'camp' | 'reminders' | 'why' | 'depart' | null>(null);
  // Once a player lights their light from the Light pop-up, focus goes back to the Light fact, which then names the
  // light (the audit of #86, pick 1).
  const refocusLight = useRef(false);
  useEffect(() => {
    if (asking === 'light' || !refocusLight.current) return;
    refocusLight.current = false;
    document.querySelector<HTMLElement>('.scene-facts .scene-fact--light')?.focus({ preventScroll: true });
  }, [asking]);
  // A blocked band button's reason (S2: it stays tappable and says why), shown in the 'why' pop-up.
  const [whyBlocked, setWhyBlocked] = useState<{ title: string; words: string } | null>(null);
  // st-11 (the lead, on #807): from Start expedition until the reload lands, the band's buttons hold (a tap is
  // ignored), so a hurried tap can't land on the town's step the reload is about to replace. Never disabled. The hold
  // is the count of scene reads begun when Start's command ended (Infinity while it runs): only a read that shows the
  // expedition, or one begun after that, releases it; a town read begun earlier that lands late does not (fix-bandhold).
  const [heldUntil, setHeldUntil] = useState<number | null>(null);
  // B13's scope check (ruled 2026-11-01, A): whether the clock has moved, for the GM's quiet Set start time ›.
  const [clockMoved, setClockMoved] = useState<boolean | null>(null);
  // Leave the dungeon (M5 step 12, DG17): opened from its quick button, or from End expedition while the pack's
  // dungeon-exit rule is on and no escape rolls were asked for yet; and whether rolls were asked for this expedition.
  const [leaveFor, setLeaveFor] = useState<'leave' | 'end'>('leave');
  // Leave the dungeon's sheet (st-4, S2; page 16, T6b): NOT at a way out (the two ways) or CAN'T TELL (a first row that
  // leaves at once); AT never opens it (the tap leaves).
  const [leaveCase, setLeaveCase] = useState<'not' | 'cantTell'>('cantTell');
  const readingWayOut = useRef(false);
  const [askedRolls, setAskedRolls] = useState(false);
  // Where? (DG1): the place typed or picked for the next Start expedition; recent places to pick from; and where the
  // expedition under way started. All the GM's alone (DG9).
  const [placeText, setPlaceText] = useState('');
  const [recent, setRecent] = useState<StartPlace[]>([]);
  const [startPlace, setStartPlace] = useState<StartPlace | null>(null);
  // Where? through the picker (pull request 2): what was picked, the campaign's recent places, the packs' places
  // (for the picked place's words) and, under way, the region the party is in (⚑ 7).
  const [wherePicked, setWherePicked] = useState<PickedPlace | null>(null);
  const [pickingWhere, setPickingWhere] = useState(false);
  // B7 (⚑ 4, DP1): Start tapped with no Where? picked: the pop-up "Pick a Location first".
  const [needPlace, setNeedPlace] = useState(false);
  const [recentRows, setRecentRows] = useState<Place[]>([]);
  // fno-1: whether the party stands in a settlement between expeditions (the GM's; the Depart sheet's start).
  const [inSettlement, setInSettlement] = useState(false);
  const [packPlaces, setPackPlaces] = useState<readonly PackPlace[] | null>(null);
  const [regionNow, setRegionNow] = useState<string | null>(null);
  // December dec-7 piece 3 (rg-4, pf-12b, rg-5): the check of the place the party is in, when it stands in for the
  // mode's scheduled encounter checks (the GM's; null: none, or the setting's is in force there). Read here as the
  // place's chain and switches; the check itself is worked out once the setting's tables are known, for its name (B9).
  const [placeCheckRead, setPlaceCheckRead] = useState<{ chain: ChainEntry[]; switches: RuleSwitch[] } | null>(null);
  // The region the party is in, by the place's pack chain (the band's session line, S1); the GM's.
  const [regionName, setRegionName] = useState<string | null>(null);
  // The party's place and the places it sits in, as the pack gives them (the GM's): the strip's procedure, where a
  // place carries one (S7, mc-54). Empty: none read.
  const [placeChain, setPlaceChain] = useState<readonly ChainEntry[]>([]);
  // Whether the two reads Make camp leans on have answered for this expedition (B18; the review of #1020): the place's
  // chain above, and the waiting encounters. "Not read yet" and "couldn't read" are kept apart from "none": null until
  // a read answers, then the expedition it answered for and whether it could be read.
  const [placeRead, setPlaceRead] = useState<{ expedition: string; ok: boolean } | null>(null);
  const [waitingRead, setWaitingRead] = useState<{ expedition: string; ok: boolean } | null>(null);
  // The players' top (S15; st-7, mc-39b, mc-50): the last place shown to each of the reader's groups, and the shown
  // place's own check where it stands in (public.encounter_check_for_players: when it's rolled and its chance, never
  // its table). Players only; read again with the log. The last good read stays through a failed one, but only for the
  // expedition it was read on: a new expedition starts with nothing shown (#883's review).
  const [shownRead, setShownRead] = useState<{ trip: string | null; places: ReadonlyMap<number, string>; checks: readonly PlayersCheck[] }>({ trip: null, places: new Map(), checks: [] });
  // The strip's step whose text is open (S7, mc-55).
  const [stepOpen, setStepOpen] = useState<StripStep | null>(null);
  // The top's fold (p2p-20; page 24, TF1, TF1b): the GM's, during an expedition. Open the first time on this device,
  // then as the GM left it, remembered on the device (B12b; "Yes, remember it", 2026-11-19; d5-10).
  const [topOpen, setTopOpen] = useSceneTopOpen();
  // What survives going to another GM screen and back (DG2: the compact strip and Scene share one card).
  const sticky = (name: string) => `${user.id}:${campaign.id}:time:${name}`;
  // "Which season?" (ruled 2026-10-29): the advance waiting for the answer, and the clock time it lands on (the
  // landing day becomes the season's first day, ruled 2026-10-30). "Not now" is kept with the campaign for the
  // session (ruled 2026-10-30: scene.seasonNotNow, the same on every GM device).
  const waitingForSeason = useRef<{ go: (season: string | null) => void; landsAt: number } | null>(null);
  // The words of a calendar start "Which season?" has just saved for the step that waited for it (its toast's Undo
  // must survive the step's toast).
  const seasonSaved = useRef<string | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  // The Depart sheet's own pick of how the party explores (#864's review): kept to the sheet, cleared when it closes or
  // starts, so a pick never changes the town's step.
  const [departPick, setDepartPick] = useState<string | null>(null);
  // The reminder card (this device's, the GM's): what came due, merged with counts, and what the last advance added.
  const [card, setCard] = useSticky<CardLine[]>(sticky('card'), []);
  const [cardTitle, setCardTitle] = useSticky<string | null>(sticky('cardTitle'), null);
  const [lastFresh, setLastFresh] = useSticky<CardLine[]>(sticky('lastFresh'), []);
  // The same lines, read by a toast's Undo: the toast is made during its advance, before this render's lastFresh
  // holds that advance's lines, so it reads them here (fix-toast-undo-stale-lines).
  const lastFreshNow = useRef(lastFresh);
  // The ended expedition and its last advance's lines as End expedition found them, given back when any expedition is
  // in play again (that one's end undone, from the summary or the log, or a new one, from any GM device): the screen
  // then reads as on main, where those lines were still held.
  const [endedLines, setEndedLines] = useSticky<{ id: string; lines: CardLine[] } | null>(sticky('endedLines'), null);
  // A Move…'s checks (alsoWhen, M5b step 1 follow-up, build order 8): the travel card sends their Hit / Miss lines here
  // (a line already on the card isn't added twice), and the move's Undo takes them off.
  const takeMoveChecks = useCallback(
    (change: CardChange) => {
      if ('remove' in change) return setCard((c) => withoutLines(c, change.remove));
      setCard((c) => addCheckNow(c, change.add).card);
      setCardTitle((t) => t ?? 'Checks from the move');
    },
    [setCard, setCardTitle],
  );
  useSceneCardListener(gm ? takeMoveChecks : null);
  const [notes, setNotes] = useSticky(sticky('notes'), '');
  // Since End expedition, until the next advance: the card says nothing about the expedition's last turn (ap-11).
  const [endedQuiet, setEndedQuiet] = useSticky(sticky('endedQuiet'), false);
  // The session whose "Resumed: …" line this device has moved past (its first advance; DG16).
  const [resumedDone, setResumedDone] = useSticky<string | null>(sticky('resumedDone'), null);
  const [hit, setHit] = useSticky<{ line: CardLine; result: CheckResult } | null>(sticky('hit'), null);
  // A check that is a roll on its table (p2p-19, B9; page 24, WY1b): the card line whose table is open in its card.
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const rollingRow = useRef(false);
  // A line's key is the same each period (`check:<source>:<checkId>`): once its line has left the card unanswered (the
  // move undone, All done, the expedition ended), the open table goes with it, so the check's next card opens on its
  // Enter roll… again (WY1b's first state; #1086's review, finding 1). Set while rendering, as React's docs adjust state
  // when other state changes (no effect).
  if (rollingKey !== null && !card.some((l) => l.key === rollingKey)) setRollingKey(null);
  // SC-5-1 (ruled B, 2026-11-03): the night check a move into a new day already put on the card before the camp.
  const [nightAsked, setNightAsked] = useSticky<NightAsked | null>(sticky('nightAsked'), null);
  // Message… from a hit (M5 gate B3): the result's words go into a new message, editable.
  const messaging = useMessaging();
  const [recorded, setRecorded] = useSticky<Map<string, string>>(sticky('recorded'), new Map());
  const [rollFor, setRollFor] = useState<CardLine | null>(null);
  const [recharging, setRecharging] = useState<{ line: CardLine; item: RechargeItem } | null>(null);
  const [reminders, setReminders] = useState<Reminder[] | null>([]);
  const [rechargeItems, setRechargeItems] = useState<RechargeItem[]>([]);
  // Encounter tables, full screen (M5b step g3, B2): which opened them (a hit, or Explore's row), and the GM's pins
  // for this session (null until read).
  const [tablesOpen, setTablesOpen] = useState<'hit' | 'explore' | null>(null);
  const [pins, setPins] = useState<TablePin[] | null>(null);
  // Everyone's lit lights (M5 step 7), named with their characters: they burn on the clock (the database burns them
  // out as it moves); the engine says which warn or burn out on an advance, and what Set time… runs out.
  const [lights, setLights] = useState<Awaited<ReturnType<typeof loadPartyLights>>>([]);
  // The party's groups in play (DG14): with a split, each group gets its own wandering checks on the same schedule.
  const [groupNumbers, setGroupNumbers] = useState<number[]>([1]);
  // Statuses and rest (M5 step 9): the statuses on now (their timers on the hour track and in Set time…'s line), who
  // is in play (names, and a player's own characters for Rest this turn), and everyone's rest choices.
  const { book: statusBook } = useStatusBook(db, user, campaign.id, logVersion + version);
  const [marchers, setMarchers] = useState<Marcher[]>([]);
  const [rests, setRests] = useState<CharacterRest[]>([]);
  const [restAbout, setRestAbout] = useState(false);
  // The rest flow (B5): which group each character is in (one flow per group), and the GM's Minimise on this device.
  const [members, setMembers] = useState<GroupOf | null>(null);
  const [restMinimised, setRestMinimised] = useSticky<boolean>(sticky('restMinimised'), false);
  // The rest panel as a sheet (S8b; T2: a row's Answer… opens it), by the group it answers for.
  const [restSheet, setRestSheet] = useState<number | null>(null);
  // Whether "Waiting for you" holds what waits (the GM's place page, or one loading).
  const panelOn = useWaitingPanelOn();
  const busy = useRef(false);
  // Today's weather (M5b; ruled 2026-10-30, D1, S2-1, A8–A12): the players' card, folding away (the Weather fact keeps it, S15);
  // the GM's is the Weather fact and its sheet (S10, T6), opened by the fact or by "Weather: to roll" in Waiting for you.
  const weather = useWeather(db, user, campaign.id, version);
  const weatherFold = useWeatherFold(weather.view);
  const [weatherOpen, setWeatherOpen] = useState(false);
  // The calls to adventure and rumours sent to this player (P7; page 40): read again with the log, last in the slot;
  // read only while the players' slot is drawn (its table view, once the time has loaded).
  const playerCalls = usePlayerCalls(db, user, campaign.id, !gm && !compact && !!tableView && scene !== null && scene !== 'error', logVersion + version);

  const underWay = scene !== null && scene !== 'error' && scene.expedition !== null;
  const expeditionId = scene !== null && scene !== 'error' ? (scene.expedition?.id ?? null) : null;
  const shownPlaces = shownRead.trip === expeditionId ? shownRead.places : new Map<number, string>();
  const playersChecks = shownRead.trip === expeditionId ? shownRead.checks : [];
  // Starts empty on each mount (no expedition shown yet), so one already in play when the strip is drawn again counts.
  const shownExpedition = useRef<string | null>(null);
  useEffect(() => {
    const before = shownExpedition.current;
    shownExpedition.current = expeditionId;
    // An expedition in play after none was shown, not merely still shown as End expedition is sent.
    if (!endedLines || before !== null || expeditionId === null) return;
    setLastFresh(endedLines.lines);
    lastFreshNow.current = endedLines.lines;
    setEndedQuiet(false);
    setEndedLines(null);
  }, [expeditionId, endedLines, setLastFresh, setEndedQuiet, setEndedLines]);
  // Set start time › (B13, ruled 2026-11-01): the GM's full strip asks the log whether the clock has moved.
  const sceneClock = scene && scene !== 'error' ? scene.clock : null;
  useEffect(() => {
    if (!gm || compact || !sceneClock || !settings || underWay) return;
    let current = true;
    void clockHasMoved(db, campaign.id, sceneClock.seconds, campaignUnits(settings, setting?.rulesSets ?? [])).then((moved) => current && setClockMoved(moved));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, sceneClock, settings, setting, underWay]);
  // The place's own check standing in (dec-7 piece 3), the GM's: on the Scene and in the compact strip alike, so an
  // advance from either sets the mode's encounter checks aside there (review of a5e54923).
  useEffect(() => {
    if (!gm) return;
    let current = true;
    void (expeditionId ? readPlaceRulesNow(db, campaign.id, expeditionId) : Promise.resolve(null)).then((read) => {
      if (!current) return;
      // A failed read keeps the strip's last good chain (S7), so a blip doesn't swap the place's steps for the mode's.
      setPlaceChain((last) => chainAfterRead(last, read));
      setPlaceRead(expeditionId ? { expedition: expeditionId, ok: read !== 'unread' } : null);
      const found = read === 'unread' ? null : read;
      setPlaceCheckRead(found ? { chain: found.chain, switches: found.switches } : null);
      // The band's session line names the region the party is in, where the pack's places say it (S1).
      setRegionName(regionOfChain(found?.chain ?? null));
    });
    return () => {
      current = false;
    };
  }, [db, gm, campaign.id, expeditionId, logVersion, version]);
  useEffect(() => {
    if (gm || compact || !expeditionId) return;
    let current = true;
    void Promise.all([loadLastShownPlaces(db, campaign.id, readAs), loadPlayersCheck(db, campaign.id, readAs)]).then(([places, checks]) => {
      if (!current) return;
      setShownRead((last) => {
        const kept = last.trip === expeditionId ? last : { trip: expeditionId, places: new Map<number, string>(), checks: [] };
        return { trip: expeditionId, places: places ?? kept.places, checks: checks ?? kept.checks };
      });
    });
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, logVersion, version, readAs]);
  // Where? (DG1), the GM's alone: recent places between expeditions, and where the one under way started.
  useEffect(() => {
    if (!gm || compact) return;
    let current = true;
    if (expeditionId) void loadStartPlace(db, expeditionId).then((found) => current && setStartPlace(found));
    else void loadRecentPlaces(db, campaign.id).then((found) => current && setRecent(found));
    if (!expeditionId) void loadRecentPlaceRows(db, campaign.id).then((found) => current && setRecentRows(found));
    void (expeditionId ? loadRegionNow(db, campaign.id, expeditionId) : Promise.resolve(null)).then((found) => current && setRegionNow(found));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, logVersion, version]);
  // fno-1: the town screen's own read of where each group is between expeditions; unreadable reads as not in one.
  // Read when the expedition ends or starts (or the scene reloads), not on every log line: between expeditions no
  // group can move (a move needs an open expedition), so the answer changes only with the expedition.
  useEffect(() => {
    if (!gm || compact || expeditionId) return;
    let current = true;
    void loadLastPlaces(db, campaign.id).then((found) => current && setInSettlement(partyInSettlement([...(found?.values() ?? [])])));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, version]);
  useEffect(() => {
    if (!gm || compact || !wherePicked || packPlaces) return;
    let current = true;
    void loadPackPlaces(db, campaign.id).then((found) => current && setPackPlaces(found));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, wherePicked, packPlaces]);
  // Point to point (p2p-6; plan scene-point-to-point B8's Departures 3 and 5, brought to the screen by B7): one step is
  // one unit of the ways leaving the party's place (`stepUnitHere`), read with the GM's Move on read; a turn until it
  // lands, where the ways give none or disagree, and on a player's device (which reads no route).
  const pointToPointNow = scene !== null && scene !== 'error' && isPointToPoint(scene.expedition?.mode);
  // Each read is stamped with the expedition and the reads it answers (`logVersion`, `version`): until the newest has
  // landed (on start, after a Move on) the band's step holds, as st-11's hold does, so no tap steps by an old unit.
  const [unitRead, setUnitRead] = useState<{ expeditionId: string; unit: string | undefined; logVersion: number; version: number } | null>(null);
  useEffect(() => {
    if (!gm || compact || !expeditionId || !pointToPointNow) return;
    let current = true;
    void loadMoveOn(db, campaign.id, expeditionId).then((read) => current && setUnitRead({ expeditionId, unit: read ? stepUnitHere(read) : undefined, logVersion, version }));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, pointToPointNow, logVersion, version]);
  const unitHeld = gm && !compact && pointToPointNow && !(unitRead?.expeditionId === expeditionId && unitRead.logVersion === logVersion && unitRead.version === version);
  useEffect(() => {
    if (!gm || compact || !expeditionId) return;
    let current = true;
    void loadRequests(db, campaign.id).then((found) => current && setAskedRolls((found ?? []).some((r) => r.kind === 'escapeRoll' && r.expeditionId === expeditionId)));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, logVersion, version]);
  // C5's "N waiting, Players ›" line went with the band (st-1, plan dec-9-the-whole-scene S1): the Players tab says it.
  // The top-row Procedure button went at the M5 gate (B5, B14): the procedure opens from the strip's mode and turn.
  useEffect(() => () => onTopActions?.(null), [onTopActions]);
  // The compact strip between expeditions shows nothing, so it reads nothing more than the scene.
  const idle = compact && !underWay;
  useEffect(() => {
    if (idle) return;
    let current = true;
    void loadReminders(db, campaign.id).then((found) => current && setReminders(found));
    return () => {
      current = false;
    };
  }, [db, idle, campaign.id, logVersion, version]);
  useEffect(() => {
    if (idle) return;
    let current = true;
    void loadPartyLights(db, campaign.id).then((found) => current && setLights(found));
    return () => {
      current = false;
    };
  }, [db, idle, campaign.id, logVersion, version]);
  useEffect(() => {
    if (idle) return;
    let current = true;
    void Promise.all([loadGroupMembers(db, campaign.id), loadMarchers(db, campaign.id)]).then(([members, marchers]) => {
      if (!current || !members || !marchers) return;
      setMembers(members);
      if (gm) setGroupNumbers(groupsOf(members, marchers.map((m) => m.id)).map((g) => g.number));
    });
    return () => {
      current = false;
    };
  }, [db, gm, idle, campaign.id, logVersion, version]);
  useEffect(() => {
    if (idle) return;
    let current = true;
    void Promise.all([loadMarchers(db, campaign.id), loadRests(db, campaign.id)]).then(([found, chosen]) => {
      if (!current) return;
      if (found) setMarchers(found);
      if (chosen) setRests(chosen);
    });
    return () => {
      current = false;
    };
  }, [db, idle, campaign.id, logVersion, version]);
  useEffect(() => {
    if (!gm || idle) return;
    let current = true;
    void loadRecharging(db, campaign.id).then((found) => current && setRechargeItems(found));
    return () => {
      current = false;
    };
  }, [db, gm, idle, campaign.id, logVersion, version]);
  useEffect(() => {
    if (!gm || compact) return;
    let current = true;
    void loadTablePins(db, campaign.id).then((found) => current && setPins(found));
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, logVersion, version]);
  // Encounter waiting (M5b step 2, D11): the cards queued by hits on this expedition, newest first (the GM's alone).
  const [waiting, setWaiting] = useState<EncounterCard[] | null>([]);
  useEffect(() => {
    if (!gm || compact || !expeditionId) return;
    let current = true;
    void loadWaitingEncounters(db, campaign.id, expeditionId).then((found) => {
      if (!current) return;
      setWaiting(found);
      setWaitingRead({ expedition: expeditionId, ok: found !== null });
    });
    return () => {
      current = false;
    };
  }, [db, gm, compact, campaign.id, expeditionId, logVersion, version]);
  // Camp (M5b step 4, D20): the camps Next day hasn't applied yet; it applies them with the move (the GM's). With the
  // travel rows they also say which groups forced the march today and are in camp tonight: their rest is due in camp's
  // Sleep step (ruled 2026-11-03, SC-4-3 A). Everyone reads them (a player: their own group's, row-level security).
  const [openCamps, setOpenCamps] = useState<Awaited<ReturnType<typeof loadOpenCamps>>>([]);
  const [travelRows, setTravelRows] = useState<Awaited<ReturnType<typeof loadTravelGroups>>>(null);
  useEffect(() => {
    if (!expeditionId) return;
    let current = true;
    void Promise.all([loadOpenCamps(db, campaign.id, expeditionId), loadTravelGroups(db, campaign.id, expeditionId)]).then(([camps, rows]) => {
      if (!current) return;
      setOpenCamps(camps);
      setTravelRows(rows);
    });
    return () => {
      current = false;
    };
  }, [db, campaign.id, expeditionId, logVersion, version]);
  // A row's one-line description at every level (B2): its note, or the stat block's description it names.
  const statBlockLines = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of setting?.all ?? []) {
      const said = e.kind === 'statBlock' ? (e.data as Record<string, unknown>).description : undefined;
      if (typeof said === 'string' && said.trim()) map.set(e.packEntryId, said.trim());
    }
    return map;
  }, [setting]);
  const describeRow = (row: TableRow) => row.note ?? (row.statBlockId ? (statBlockLines.get(row.statBlockId) ?? null) : null);
  // Start's stat block references (read-only): the stat block's name and one-line description, and the whole block
  // laid out as its pack says (pf-13), with its source line (December 5c; the GM's alone: this console is the GM's).
  const statBlockRef = (id: string) => {
    const entry = (setting?.all ?? []).find((e) => e.kind === 'statBlock' && e.packEntryId === id);
    if (!entry) return null;
    const entryName = (ref: string) => (setting?.all ?? []).find((e) => e.packEntryId === ref)?.name;
    const pack = setting?.packs.find((p) => p.packId === entry.packId);
    return {
      name: entry.name,
      description: statBlockLines.get(id) ?? null,
      full: { shown: layOutStatBlock(entry.data, pack?.statBlockLayout ?? null, entryName), source: sourceLine(entry.data.source, pack?.shortName ?? '', entryName, undefined, pack?.sourceTitles ?? {}) },
    };
  };
  const tables = useMemo(() => {
    const map = new Map<string, ReadTable>();
    for (const e of setting?.all ?? []) {
      if (e.kind !== 'table') continue;
      const read = readTable(e.packEntryId, e.name, e.data);
      if (read) map.set(e.packEntryId, read);
    }
    // A row's stat block and next table may be in another attached pack (December 5a): resolved once, here.
    return withRowLinks(map, { packs: setting?.packs ?? [], entries: setting?.all ?? [] });
  }, [setting]);
  // The place's check, named by p2p-18 (B9): its own name, else its table's, else "Encounter check"; never its id.
  const placeCheck: PlaceCheck | null = useMemo(
    () => (placeCheckRead ? placeCheckOf(placeCheckRead.chain, placeCheckRead.switches, (id) => tables.get(id)?.name ?? null) : null),
    [placeCheckRead, tables],
  );

  useEffect(() => {
    let current = true;
    const begun = (readsBegun.current += 1);
    const land = (found: SceneState | 'error') => {
      if (!current) return;
      setScene(found);
      setSceneBegun(begun);
    };
    loadScene(db, campaign.id).then(
      (found) => land(found ?? 'error'),
      () => land('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, version]);
  useEffect(() => {
    let current = true;
    void loadCampaignSettings(db, campaign.id).then((found) => current && setSettings(found));
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion]);
  useEffect(() => {
    let current = true;
    void loadTownSwitches(db, campaign.id).then((found) => current && setSwitches(found));
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, version]);
  useEffect(() => {
    let current = true;
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => current && setSetting(found));
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, logVersion]);

  // The GM's place page reads whether a session runs (Start or Resume session is the accent while none does, st-2);
  // said before the early returns below.
  const sceneRead = scene !== null && scene !== 'error' ? scene : null;
  // The band's taps are ignored while it holds (each tap checks it): st-11, until a read shows the expedition or began
  // after Start's command.
  const bandHeld = heldUntil !== null && sceneRead !== null && !sceneRead.expedition && sceneBegun <= heldUntil;
  useStripPaused(gm && !compact && !!sceneRead && !sceneRead.session);

  // The compact strip stays out of the way until there's an expedition to show (and quietly, if the time can't load:
  // Scene says so).
  if (compact && (scene === null || scene === 'error' || !scene.expedition || !gm)) return null;
  if (scene === null)
    return (
      <>
        <section className="time-strip" aria-label="Time">
          <SkeletonRows rows={2} label="Loading the time" />
        </section>
        {tableView?.body(() => null)}
      </>
    );
  if (scene === 'error') {
    return (
      <section className="time-strip" aria-label="Time">
        <p className="form-error" role="alert">
          Couldn't load the time. Check your connection and try again.
        </p>
        <button type="button" className="button-secondary" onClick={() => setVersion((v) => v + 1)}>
          Try again
        </button>
        {/* B18: the marching order and the place still show when only the time can't load. */}
        {tableView?.body(() => null)}
      </section>
    );
  }

  const rulesSets = setting?.rulesSets ?? [];
  const units = campaignUnits(settings, rulesSets);
  const exploration = readExploration(rulesSets);
  const choices = setting ? choicesInPlay(setting) : {};
  const { clock, session, expedition, seasonNotNow: seasonDeclined, played = false, campaignMode = 'downtime', lastMode = null } = scene;
  // Between expeditions (dt-2, M5b step 6a): in Adventure ("in town": End expedition leaves the party there, and End
  // downtime comes back to it), or in Downtime (Start downtime).
  // The town's top (S5, T4) and downtime's (T5): decided in one place each (sceneTop.ts).
  const inTown = showsTownTop({ expedition, campaignMode });
  const inDowntime = showsDowntimeTop({ expedition, campaignMode });
  // B7's fold (M5 gate) is gone: st-2 (page 16, T3b, T9b) keeps a paused Scene as it was left, for the GM (S9) and
  // for players (S15).
  const sessionNow = sessionStateOf({ session, played });
  const now = clock?.seconds ?? 0;
  // The calendar (ruled 2026-10-29): the campaign's Calendar start, else the pack's defaultStart (months from 1);
  // until one is known the strip reads "Day N", and the GM gets a quiet Set date ›.
  const months = monthsOf(setting?.calendar ?? null);
  const startSaid = calendarStartOf(settings?.calendarStart) ?? calendarStartOf(setting?.calendar?.defaultStart);
  const start = startIndex(months, startSaid);
  const date = start ? dateOnClock(months, start, now, 0, units) : null;
  const seasonName = (season: string) => exploration.seasons.find((s) => s.id === season)?.name ?? season;
  const unitHere = expedition && unitRead?.expeditionId === expedition.id ? unitRead.unit : undefined;
  const mode: Mode | null = expedition
    ? isPointToPoint(expedition.mode)
      ? pointToPoint(exploration.modes, unitHere)
      : (modeById(exploration.modes, expedition.mode) ?? modeById(FALLBACK_MODES, expedition.mode) ?? FALLBACK_MODES[0]!)
    : null;
  // In town the current mode (its step is the main advance): the mode the last expedition ended in (dt-2: after End
  // expedition the party stays in that mode, a town's parts of the day). The Depart sheet starts on it, except (fno-1)
  // on the town way when no expedition was ever started or the party is in a settlement (`departSheetModeOf`); the
  // sheet's own pick (`departPick`) wins and changes only the expedition it starts. The town's own mode is unchanged.
  // B7 (p2p-5; page 24, DP1): the sheet offers the campaign's modes and Point to point (`methodsOf`); its method is unset
  // until Where? is picked, then filled in from the place (`placeMethodOf`) and open to the GM's tap (`departMethodOf`).
  const pickedMode = departModeOf(exploration.modes, modeId, lastMode)!;
  const methods = methodsOf(exploration.modes);
  const departMode = departMethodOf(methods, { picked: departPick, placed: wherePicked !== null, last: modeId ?? lastMode, inSettlement });
  const todayTags = weather.view.kind === 'in' ? (weather.view.weather?.tags ?? []) : undefined;
  /** The GM's "Which season?" from the weather card: outside an advance, today becomes the season's first day. */
  const askSeason = () => {
    waitingForSeason.current = { go: () => undefined, landsAt: now };
    setAsking('season');
  };

  /** Runs a command once at a time (a second tap while one is saving does nothing); reloads after. */
  async function act<I, T, O>(command: Command<I, T, O>, input: I): Promise<O | null> {
    if (busy.current) return null;
    busy.current = true;
    const result = await runCommand(registry, db, user, command, input);
    busy.current = false;
    setVersion((v) => v + 1);
    logChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return null;
    }
    return result.value;
  }

  /** Undoes this person's newest change of a kind (the same Undo as the log). */
  async function undoLatest(type: string, then?: () => void) {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    setVersion((v) => v + 1);
    logChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
    else then?.();
  }

  // What runs on the clock besides the mode's procedure: the GM's reminders (a player reads only the public ones),
  // and for the GM the setting's remind hooks and the items that recharge on a timer.
  const perStep = mode ? stepSeconds(mode, units) : null;
  const hooks = gm
    ? hookSchedules(
        (setting?.all ?? []).filter((e) => e.kind === 'hook').map((e) => e.data),
        { units, stepSeconds: perStep, startedAt: expedition?.startedAt ?? null, mode: expedition?.mode ?? null },
      )
    : { schedules: [], skipped: [] };
  const schedules = [...reminderSchedules(reminders ?? [], units), ...hooks.schedules, ...(gm ? rechargeSchedules(rechargeItems, units) : [])];
  const scheduleInfo = new Map(schedules.map((s) => [s.id, s.info]));

  // The engine's view of the expedition under way: the procedure runs from it, and nothing is written.
  // The table a hit rolls (engine ruling 3): the GM's pick, then the place's default (none until the current
  // location is built later in M5), then the terrain's, then the check's own. The season is the date's (or the
  // answer to "Which season?" just given).
  // Timed statuses (M5 step 9): on the hour track as effects ending (a secret one only on the GM's), and in Set time…'s
  // "ran out" line. The database ends them as the clock moves.
  const nameOf = (id: string) => marchers.find((m) => m.id === id)?.name ?? 'someone';
  const liveStatuses = statusBook && statusBook !== 'error' ? statusBook.statuses : [];

  // Rest (B5, the shared flow): the mode's rule now, the pack's condition for Push on, the rule in the pack's words
  // for ⓘ, and one flow per group in play: due when its countdown runs out, or called with the Rest button.
  const rest = expedition && mode ? restNow(mode, units, expedition.startedAt, now, perStep) : null;
  const restCondition = (() => {
    const id = rest?.condition ?? null;
    if (!id) return null;
    const found = statusBook && statusBook !== 'error' ? statusBook.conditions.find((c) => c.id === id) : undefined;
    return found ?? { id, name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '), icon: null, stacks: false, levels: null, defaultRounds: null, note: null };
  })();
  const restWords = mode ? restRuleWords(mode, restCondition?.name ?? null) : [];
  const restDay = mode?.pace === 'day';
  const groupsInPlay = members ? groupsOf(members, marchers.map((m) => m.id)) : [{ number: 1, ids: marchers.map((m) => m.id) }];
  const flows: RestFlow[] =
    rest && expedition
      ? restFlows({
          groups: groupsInPlay.map((g) => ({ number: g.number, members: g.ids })),
          rests,
          startedAt: expedition.startedAt,
          now,
          every: rest.every,
          step: perStep ?? rest.every,
          forcedGroups: forcedRestGroups(travelRows?.values() ?? [], (openCamps ?? []).map((c) => c.camp)),
        })
      : [];
  const mineIds = marchers.filter((m) => m.ownerUserId === me).map((m) => m.id);
  const myFlows = gm ? flows : flows.filter((f) => f.members.some((id) => mineIds.includes(id)));
  const splitFlows = flows.length > 1;
  const restOf = (id: string) => rests.find((r) => r.actorId === id);
  const statusSecrets = statusBook && statusBook !== 'error' ? statusBook.secrets : new Map();
  // Where the party is (the first group's travel row, as ga-2's groundNow reads it): its terrain feeds the checks the
  // way the travel card's Move… does (gate walk, the night encounter, 2026-11-10). No row: no terrain. The route
  // waits on a ruling (⚑ 1 of the status file, 2026-11-10-fix-night-check-terrain-and-answered).
  const firstTravelRow = travelRows ? [...travelRows.values()].sort((a, b) => a.group - b.group)[0] : undefined;
  const running = (season: string | null = date?.season ?? null): Running | null =>
    expedition && mode
      ? {
          rules: exploration,
          mode,
          units,
          startedAt: expedition.startedAt,
          // B5: the hour track's rest mark counts from the last rest applied (the party's group, or the first).
          restFrom: flows[0]?.from,
          now,
          lights: lights ?? [],
          effects: statusEffects(liveStatuses, statusSecrets, nameOf),
          reminders: schedules,
          // Today's weather tags feed the checks' weather modifiers (07 checks' weatherTag).
          // Who is in play feeds the checks' modifiers keyed to the party (ex-2, ga-3).
          // The party's terrain feeds the checks' terrain odds, their terrain modifiers and the terrain's table (#619);
          // ⚑ 7 (#532): the region of the party's place, so its own encounter tables come first after a hit.
          situation: {
            choices,
            season,
            placeTableId: null,
            region: regionNow ?? undefined,
            terrainId: firstTravelRow?.terrainId ?? null,
            weatherTags: todayTags,
            switches: switches ?? SWITCHES_OFF,
            party: partyMembersOf(setting, marchers),
            // A place's own check standing in (pf-12b; off with the GM's toggle, rg-5); one rolled on each move is
            // never raised by the clock (Encounter check in ⋯ still rolls it by hand).
            locationCheck: placeCheck?.inForce ? placeCheck.check : null,
            locationCheckOnMove: placeCheck?.inForce ? placeCheck.eachMove : false,
          },
        }
      : null;

  /**
   * Runs an advance that runs the procedure. The first one that needs the season while the calendar has no start
   * asks "Which season?" first (ruled 2026-10-29); Not now goes on without it, and isn't asked again on any GM device
   * until the next session (ruled 2026-10-30). The day the advance lands on (the day whose steps run) becomes the
   * chosen season's first day (ruled 2026-10-30).
   */
  function withSeason(plan: (engine: Running) => ProcedureSummary | null, title: string, command: ClockCommand | MoveCommand): Promise<boolean> {
    // Resolves when the advance is done: true once the clock moved (Move on closes its sheet only then), false when it
    // was refused or held. While "Which season?" waits, it waits with it.
    return new Promise((resolve) => {
      const go = (season: string | null) => void advance(plan(running(season)!), title, command).then(resolve);
      const engine = running();
      if (engine && months.length > 0 && !start && !seasonDeclined && seasonsOf(months).length > 0 && needsSeason(engine)) {
        waitingForSeason.current = { go, landsAt: plan(engine)?.to ?? now };
        setAsking('season');
        return;
      }
      go(date?.season ?? null);
    });
  }

  /** Calendar start, saved with the campaign's settings (logged; Undo from the toast unless `toast` is false). */
  async function saveStart(next: CalendarStart, text = `The calendar starts on ${startWords(months, next)}`, toast = true): Promise<boolean> {
    const saved = await act(updateCampaign, { campaignId: campaign.id, settings: { ...(settings ?? {}), calendarStart: { month: next.month, day: next.day } } as Json });
    if (saved === null) return false;
    setSettings((s) => ({ ...(s ?? {}), calendarStart: { month: next.month, day: next.day } }));
    if (toast) show({ text, onUndo: () => void undoLatest('campaign.update') });
    return true;
  }

  /** The first day's start time (B13): the setting and the unmoved clock in one logged change (Undo from the toast). */
  async function saveStartTime(next: StartTime, toast = true): Promise<boolean> {
    if (!clock) return false;
    const saved = await act(setStartTime, { campaignId: campaign.id, start: next, clock, units });
    if (saved === null) return false;
    setSettings((s) => ({ ...(s ?? {}), startTime: { hour: next.hour, minute: next.minute } }));
    if (toast) show({ text: `The first day starts at ${startTimeWords(next)}`, onUndo: () => void undoLatest('time.start') });
    return true;
  }

  /**
   * Set the date's save (S10, T6): the date and the hour play starts, each saved as today (logged); the hour only when
   * it changed, or when none is saved yet (the sheet shows the default, 06:00, while the clock still stands at 00:00,
   * #873's review). Saved together they share one toast whose Undo puts back both.
   */
  async function saveDateSheet(next: { date: CalendarStart | null; time: StartTime | null }): Promise<boolean> {
    const was = startTimeOf(settings?.startTime);
    const time = next.time && (!was || next.time.hour !== was.hour || next.time.minute !== was.minute) ? next.time : null;
    if (next.date && time) {
      if (!(await saveStart(next.date, undefined, false))) return false;
      if (!(await saveStartTime(time, false))) {
        // The date saved and the hour didn't: the date keeps its own toast and Undo.
        show({ text: `The calendar starts on ${startWords(months, next.date)}`, onUndo: () => void undoLatest('campaign.update') });
        return false;
      }
      show({
        text: `The calendar starts on ${startWords(months, next.date)}; the first day starts at ${startTimeWords(time)}`,
        onUndo: () => void undoLatest('time.start', () => void undoLatest('campaign.update')),
      });
      return true;
    }
    if (next.date) return saveStart(next.date);
    if (time) return saveStartTime(time);
    return true;
  }

  /** Fresh lines join the card (a line already there counts up; a note that can't be checked shows once). */
  function addToCard(unsplit: CardLine[], title: string, split = true) {
    const fresh = split ? perGroup(unsplit, groupNumbers) : unsplit;
    setCard((c) => mergeCard(c, fresh.filter((l) => l.decision !== 'info' || !c.some((x) => x.key === l.key))));
    setLastFresh(fresh);
    lastFreshNow.current = fresh;
    setEndedQuiet(false);
    // These are the last lines now (a Downtime day, say): an expedition starting later doesn't bring the old ones back.
    setEndedLines(null);
    setCardTitle(title);
    setHit(null);
  }

  async function advance(result: ProcedureSummary | null, title: string, command: ClockCommand | MoveCommand): Promise<boolean> {
    // Move on (5b-0, pt-f2): the same advance, sent as place.moveOn; the clock's camps and travel days are a day-scale
    // thing a move between linked places doesn't apply (dec-4: Move on is a turn-scale mode's).
    const moving = 'moveOn' in command ? command.moveOn : null;
    if (!clock || !result || !expedition) {
      show({ text: "This mode's step can't be read. Check its setting rules.", error: true });
      return false;
    }
    // The open rest flows (B5): the database applies their answers with the move (resting counts as rest; Push on and
    // unanswered get the condition, stacked) and restarts their countdown; one log line is the record, and one
    // information line on the card says so.
    // SC-g6-3 (ruled B, 2026-11-03): the countdown restarts where the move starts, so the next rest falls due a rest
    // period on; the log line names it as the strip counts it ("next rest due turn 20").
    const nextDueAt = rest ? result.from + rest.every : null;
    const nextDue = nextDueAt !== null && perStep ? { at: nextDueAt, unit: stepWord, number: elapsedSteps(nextDueAt, expedition.startedAt, perStep) } : null;
    // Camp (D20): a move into a new day applies the evening's camps in the same request (one Undo), and the card gets
    // the morning's camp line: the fire out and the bundles used, who didn't eat, how the night went.
    const dayOf = (at: number) => (perStep && mode?.pace === 'day' ? Math.max(0, elapsedSteps(at, expedition.startedAt, perStep) - 1) : -1);
    // A group that forced the march today and has no camp tonight (ruled B 2026-11-03): Next day applies its rest as
    // unanswered, Push on (with a camp, camp's Sleep step opened the flow and its answers apply as usual).
    const uncamped = forcedWithoutCamp(travelRows?.values() ?? [], (openCamps ?? []).map((c) => c.camp), dayOf(result.from), dayOf(result.to));
    const applying = restToApply(withForcedOpen(flows, uncamped), restCondition, nextDue);
    const restedNow = applying ? applying.actors.filter((id) => answerOf(restOf(id)) === 'resting').map(nameOf) : [];
    const pushedNow = applying ? applying.actors.filter((id) => answerOf(restOf(id)) !== 'resting').map(nameOf) : [];
    const campsNow = moving ? [] : (openCamps ?? []).filter((c) => mode?.pace === 'day' && c.camp.day < dayOf(result.to));
    // SC-5-1 (ruled B by Francis, 2026-11-03): a move that applies the evening's camps first stops at the camp's night
    // check. Only those lines go on the card and the clock stays, so a hit finds the camp open and its waiting card
    // asks Which watch?; the next Next day moves on (clock, camps and morning, one Undo) without the night check again.
    const dueLines = perGroup(cardFrom(result, { info: scheduleInfo, mode, units, startedAt: expedition.startedAt, skippedHooks: hooks.skipped }), groupNumbers);
    // A night check recorded at this time (on any GM device, or before a reload) counts as answered.
    const results: CheckResult[] = campsNow.length > 0 && nightChecks.size > 0 ? ((await loadCheckResults(db, campaign.id, 24)) ?? []) : [];
    // One recorded with Encounter check (⋯) counts only after the camp was made (a midday one isn't the night's).
    const answered = nightAnswers(
      results.filter((r) => r.expeditionId === expedition.id && r.atSeconds === result.from),
      campsNow.map((c) => c.camp),
    );
    const night = nightPlan({ lines: dueLines, nightChecks, camps: campsNow.map((c) => c.camp.id), from: result.from, asked: nightAsked, answered });
    if ('stop' in night) {
      setNightAsked(night.asked);
      const { added } = addCheckNow(card, night.stop);
      setCard((c) => addCheckNow(c, night.stop).card);
      setHit(null);
      setCardTitle('The night');
      show({
        text: `The night check first, then ${command === advanceTimeBy ? 'Advance by…' : title} again`,
        onUndo: () => {
          setCard((c) => withoutLines(c, added));
          setNightAsked(null);
        },
      });
      return false;
    }
    // A move into a new day starts each group's travel day with it (fix F86/F87): the day's budget is worked out here,
    // from the travel view read at the time the move reaches (that day's weather, the travellers' speeds now), and
    // the database starts the days with the clock, so the day's record never waits for a travel card to be open.
    const morning =
      !moving && command !== nextPartOfDay && dayOf(result.to) > dayOf(result.from) && setting && settings && members
        ? await loadTravelView(db, campaign.id, { clock: { ...clock, seconds: result.to }, session, expedition, seasonNotNow: seasonDeclined }, setting, settings as Record<string, Json | undefined>, members, marchers, { userId: me, gm })
        : null;
    const days = morning ? travelDayStarts(morning) : [];
    const moved = moving
      ? await act(placeMoveOn, { campaignId: campaign.id, placeId: moving.placeId, turns: moving.turns, seconds: result.to - result.from, clock, way: moving.way, rest: applying ? restArg(applying) : null })
      : await act(command as ClockCommand, {
          campaignId: campaign.id,
          clock,
          seconds: result.to - result.from,
          rest: applying ? restArg(applying) : null,
          ...(campsNow.length ? { camps: campsNow.map((c) => c.camp.id) } : {}),
          ...(days.length ? { days } : {}),
        });
    if (!moved) return false;
    // What the morning brought each group: not a new toast, but the one the travel card's own start showed until now
    // (the same words, at the same moment, on Scene only): the day's points, what went unused, an arrival or what's owed.
    const startedRows = morning && days.length ? await loadTravelGroups(db, campaign.id, expedition.id) : null;
    const dayWords = days.flatMap((d) => {
      const before = morning?.rows.get(d.group);
      const after = startedRows?.get(d.group);
      return morning && before && after && after.day === d.day ? [dayStartWords(morning.travel, groupsInPlay.length > 1 ? groupName(d.group) : 'the party', d.day, before, after)] : [];
    });
    // The town switches turn off at the next morning (sw-3): its own Simple log line, and a line on the card.
    const townLines = await resetAtMorning(result.from, result.to);
    const campLines: CardLine[] = campsNow.flatMap((c) => {
      const members = groupsInPlay.find((g) => g.number === c.camp.group)?.ids ?? [];
      const said = morningLines({ entries: c.entries, now: result.to, names: nameOf, members, eating: !!campRule?.steps.some((s) => s.part === 'eat'), sleeping: !!campRule?.steps.some((s) => s.part === 'sleep') });
      const who = groupsInPlay.length > 1 ? `, Group ${c.camp.group}` : '';
      return [{ key: `camp:${c.camp.id}`, group: 'rest', decision: 'info' as const, name: `Camp${who}, ${said.length ? said.join(', ') : 'the night passed'}`, icon: 'camp' as const, count: 1, note: c.camp.quick ? 'Quick camp' : null, check: null, tableId: null, recharge: null, nextAt: null, stepId: null }];
    });
    if (session) setResumedDone(session.id);
    if (applying) setRestMinimised(false);
    const restWordsNow = [restedNow.length ? `rested: ${restedNow.join(', ')}` : '', pushedNow.length ? `pushed on: ${pushedNow.join(', ')}` : ''].filter(Boolean).join(', ');
    const restedLine: CardLine[] = applying
      ? [{ key: `rested:${result.from}`, group: 'rest', decision: 'info', name: `Rest, ${restWordsNow}`, icon: 'rest', count: 1, note: null, check: null, tableId: null, recharge: null, nextAt: null, stepId: null }]
      : [];
    // dec-4 piece d: after a move, its encounter check goes on the card as Encounter check (⋯) puts it there, at the
    // time the move lands; a crossing that passes a place with its own check uses that place's (frame 13).
    const moveCheck = moving ? moveCheckLines(command as MoveCommand, result.to) : [];
    const fresh = [...night.move, ...restedLine, ...campLines, ...townLines, ...moveCheck];
    addToCard(fresh, title, false);
    setRecorded(new Map());
    setNotes(settings?.hideProcedureNotes === true ? '' : noteLine(result));
    // When "Which season?" has just set the calendar's start for this step, its toast ("Today is …") would be replaced
    // at once: the step's toast says it first and its one Undo takes back both, the step then the start.
    const season = seasonSaved.current;
    seasonSaved.current = null;
    const undo = season ? () => void undoClock().then(() => undoLatest('campaign.update')) : () => void undoClock();
    // A light that burnt out with the move is not an item of "Waiting for you" (st-1, S8b): the step's toast says it, and
    // the log keeps its line ("Torch burnt out."). Without the panel (a town) it stays a line on the card, as before.
    const ended = panelOn && gm && !compact ? fresh.filter((l) => l.key.startsWith('light-out:')).map((l) => `${l.name}.`) : [];
    const said = (text: string) => [season ? `${season}. ${text}` : text, ...ended].join(' ');
    // The compact strip (DG2) has no card of its own: a toast says what came due, with Undo for the move.
    if (compact) {
      const due = fresh.filter((l) => l.decision !== 'info').length;
      show({ text: said(`${title}, ${due === 0 ? 'nothing due' : due === 1 ? '1 thing on the card' : `${due} things on the card`}`), onUndo: undo });
    } else {
      // One toast a group, as when each group's travel card started its own day (the last one stays up).
      // Next turn's Undo is in the toast (mc-57; the band has no Undo button, st-1): on the last day's toast, else on
      // one that names the step reached; a Move on's names where the party moved ("Moved to The jetty.").
      dayWords.forEach((text, i) => show(i === dayWords.length - 1 ? { text: said(text), onUndo: undo } : { text }));
      if (dayWords.length === 0 && moving) show({ text: said(`${title}.`), onUndo: undo });
      else if (dayWords.length === 0 && mode) {
        const reached = stepOfLine(expeditionLine(mode, expedition, result.to, units), mode.name);
        show({ text: said(`${reached.charAt(0).toUpperCase()}${reached.slice(1)}.`), onUndo: undo });
      }
    }
    return true;
  }

  async function undoClock() {
    const eventId = await latestClockMove(db, campaign.id, user.id);
    if (!eventId) {
      show({ text: "Nothing to undo: the clock hasn't moved since it was last put back." });
      return;
    }
    // The travel days the move itself started go back with it (the same request, fix F86/F87). Those the card started
    // after this move (its fallback, each in its own request) go back with it too, newest first, so
    // the day before comes back as it was (its forced march too; gate walk, finding 1a). The clock goes back first, so
    // the card never sees its day behind the clock and starts it again.
    // Only the days the groups were moved on to; a first day (a new expedition, a group split off since) stays.
    const starts = expedition ? await dayStartsAfter(db, campaign.id, expedition.id, eventId) : [];
    const undone = await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
    const whose = (group: number) => (groupsInPlay.length > 1 ? `Group ${group}'s` : "the party's");
    let travelRefused: string | null = starts === null ? "the day's travel stays: the travel days couldn't be read" : null;
    if (undone.ok) {
      for (const start of starts ?? []) {
        const back = await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId: start.eventId, authorUserId: null });
        if (!back.ok) {
          travelRefused = `${whose(start.group)} travel stays: ${back.message}`;
          break;
        }
      }
    }
    setVersion((v) => v + 1);
    logChanged();
    if (!undone.ok) return show({ text: undone.message, error: true });
    // What that move brought comes off the card again (read now: the card's update runs after the ref is cleared).
    const taking = lastFreshNow.current;
    setCard((c) => {
      let left = c;
      for (const line of taking) for (let i = 0; i < line.count; i += 1) left = takeOne(left, line.key);
      return left;
    });
    setLastFresh([]);
    lastFreshNow.current = [];
    // Set-aside lines (an ended expedition) are none now too, as main's last lines are: none come back later.
    setEndedLines((e) => (e ? { ...e, lines: [] } : e));
    setNotes('');
    if (travelRefused) return show({ text: `Put the clock back, but ${travelRefused}`, error: true });
    show({ text: 'Put the clock back' });
  }

  async function downtime(seconds: number, words: string) {
    if (!clock || seconds < 1) return;
    const moved = await act(passDowntime, { campaignId: campaign.id, clock, seconds });
    if (!moved) return;
    // The reminders that fell due in the gap, merged into one card with counts.
    const due = dueOnJump(schedules, now, now + seconds);
    if (gm && due.length > 0) addToCard(cardFrom({ prompts: [], rest: null, reminders: due, to: now + seconds }, { info: scheduleInfo }), words.startsWith('to ') ? `To ${words.slice(3)}` : words);
    show({ text: words.startsWith('to ') ? `Moved on ${words}` : `${words.charAt(0).toUpperCase()}${words.slice(1)} passed`, onUndo: () => void undoLatest('time.downtime') });
  }

  // The card's buttons --------------------------------------------------------------------------------------------

  const stepWord = mode ? stepUnit(mode, units) : 'turn';
  const nextWords = (line: CardLine) =>
    line.nextAt !== null && perStep && expedition ? `next at ${stepWord} ${elapsedSteps(line.nextAt, expedition.startedAt, perStep)}` : null;

  async function record(line: CardLine, outcome: 'hit' | 'miss') {
    if (!line.check) return;
    // "Check again" (a check already run this period) is logged as checking again, in the Verbose log; Check now (DG3)
    // as checking now.
    const command = line.check.now ? recordCheckNow : line.check.again ? recordCheckAgain : recordCheck;
    const result = await act(command, {
      campaignId: campaign.id,
      record: { checkKey: line.key, name: line.name, source: line.check.source, outcome, modifiers: line.check.modifiers, note: null, secret: line.check.secret },
    });
    if (!result) return;
    // D11 (M5b step 2): an encounter check's hit queues its Encounter waiting card on the console (no extra tap).
    if (outcome === 'hit' && hitQueuesEncounter(line.check, reminders)) await act(queueEncounter, { campaignId: campaign.id, result });
    setCard((c) => takeOne(c, line.key));
    setRecorded((m) => new Map(m).set(line.key, outcome === 'hit' ? 'Hit' : 'Miss'));
    setHit(outcome === 'hit' ? { line, result } : null);
    // B2: a hit opens Which table? full screen (a check with only a note shows its note on the hit card instead).
    if (outcome === 'hit' && (line.check.hit.candidates.length > 0 || line.check.encounter) && tables.size > 0) setTablesOpen('hit');
    const next = nextWords(line);
    show({
      text: `${line.name}: ${outcome === 'miss' ? 'a miss' : rollsTable(line) ? 'to roll on its table' : 'a hit'}${next ? `, ${next}` : ''}${result.revealed ? ', players see it' : ''}`,
      onUndo: () =>
        void undoLatest(command.name, () => {
          setCard((c) => mergeCard(c, [{ ...line, count: 1 }]));
          setHit(null);
          setTablesOpen(null);
        }),
    });
  }

  /**
   * B2: the GM tapped the rolled row. With a hit open it's the check's result (check.setRoll, Simple); from Explore's
   * row without one, a row "rolled by hand" (tables.readByHand, Simple). Undo from the toast takes it back.
   */
  async function tapRow(tap: TableTap, unlight: () => void) {
    if (tablesOpen === 'hit' && hit) {
      const before = hit.result;
      const saved = await act(setCheckRoll, { campaignId: campaign.id, result: before, tableId: tap.table.id, roll: tap.roll, rowText: tap.rowText });
      if (!saved) return unlight();
      setHit({ line: hit.line, result: saved });
      setRecorded((m) => new Map(m).set(hit.line.key, `Hit: ${tap.rowText}`));
      show({
        text: `Rolled: ${tap.roll}, ${tap.words}`,
        onUndo: () =>
          void undoLatest('check.setRoll', () => {
            unlight();
            setHit((h) => (h ? { ...h, result: { ...before, version: saved.version + 1 } } : h));
            setRecorded((m) => new Map(m).set(hit.line.key, before.rowText ? `Hit: ${before.rowText}` : 'Hit'));
          }),
      });
      return;
    }
    const read = await act(readTableByHand, { campaignId: campaign.id, tableId: tap.table.id, roll: tap.roll, rowText: tap.rowText });
    if (!read) return unlight();
    show({ text: `Rolled by hand: ${tap.roll}, ${tap.words}`, onUndo: () => void undoLatest('tables.readByHand', unlight) });
  }

  /** B2: a pin in the Table library › (prep), for this session, or the next between sessions; Undo from the toast. */
  async function pinNow(tableId: string, on: boolean) {
    const name = tables.get(tableId)?.name ?? tableId;
    if (on) {
      const made = await act(pinTable, { campaignId: campaign.id, tableId });
      if (!made) return;
      show({ text: `Pinned ${name} for ${session ? 'this' : 'the next'} session`, onUndo: () => void undoLatest('tables.pin') });
      return;
    }
    const pin = pins?.find((p) => p.tableId === tableId);
    if (!pin) return;
    const done = await act(unpinTable, { campaignId: campaign.id, pin });
    if (!done) return;
    show({ text: `Unpinned ${name}`, onUndo: () => void undoLatest('tables.unpin') });
  }

  /** Reveal (ruled 2026-10-29): the GM shows one secret result to the players now; logged, with Undo. */
  async function reveal() {
    if (!hit) return;
    const shown = await act(revealCheck, { campaignId: campaign.id, result: hit.result });
    if (!shown) return;
    setHit({ line: hit.line, result: shown });
    show({ text: `Showed the players ${hit.line.name}`, onUndo: () => void undoLatest('check.reveal', () => setHit((h) => (h ? { ...h, result: { ...h.result, revealed: false, version: h.result.version + 1 } } : h))) });
  }

  /** Start (M5b: marks it started and opens the row's text; M6 makes it a fight). Undo from the toast puts it back. */
  async function startWaiting(card: EncounterCard): Promise<boolean> {
    const started = await act(startEncounter, { campaignId: campaign.id, encounter: card.encounter });
    if (!started) return false;
    show({ text: `Started: ${card.hit.name}`, onUndo: () => void undoLatest('encounter.start') });
    return true;
  }

  /** Dismiss: the card goes at once; Undo brings it back. */
  async function dismissWaiting(card: EncounterCard) {
    const done = await act(dismissEncounter, { campaignId: campaign.id, encounter: card.encounter });
    if (!done) return;
    show({ text: `Dismissed: ${card.hit.name}`, onUndo: () => void undoLatest('encounter.dismiss') });
  }

  async function rechargeNow(line: CardLine, item: RechargeItem, amount: number, roll?: string) {
    const row = item.line;
    const done = await act(recharge, {
      line: {
        id: item.lineId,
        carrier: { campaignId: campaign.id, actorId: (row.actor_id as string | null) ?? null, locationId: (row.location_id as string | null) ?? null, ownerUserId: null, archived: false },
      },
      amount,
      hidden: row.charges_hidden === true,
      roll,
    });
    if (done === null) return;
    setCard((c) => takeOne(c, line.key));
    show({ text: `Recharged ${item.name} by ${amount}`, onUndo: () => void undoLatest('inventory.recharge') });
  }

  const party = marchers.map((m) => ({ id: m.id, campaignId: m.campaignId, ownerUserId: m.ownerUserId }));

  /** An answer for the rest under way (a player's own characters; the GM's flip, Everyone rests, No one rests). */
  async function answerFor(ids: string[], answer: 'rest' | 'push') {
    const characters = party.filter((p) => ids.includes(p.id));
    if (characters.length === 0) return;
    await act(answerRest, { target: { campaignId: campaign.id, characters }, answer });
  }

  /** The Rest button (B5): calls a rest for the group (or, with one open, answers Rest for the player's own). */
  async function restCalled(group: number) {
    const flow = flows.find((f) => f.group === group);
    const own = party.filter((p) => p.ownerUserId === me && (flow?.members.includes(p.id) ?? true));
    if (!flow || own.length === 0) return show({ text: 'None of your characters is in this group.' });
    if (flow.open) {
      const done = await act(answerRest, { target: { campaignId: campaign.id, characters: own }, answer: 'rest' });
      if (done) show({ text: `${restDay ? 'Resting today' : 'Resting this turn'}. The GM's next move applies it.` });
      return;
    }
    const done = await act(callRest, { character: own[0]! });
    if (done) show({ text: 'You called a rest for the group. Everyone answers Rest or Push on.', onUndo: () => void undoLatest('rest.call') });
  }

  /** "Wren called a rest." for a flow called out of turn. */
  const calledWords = (flow: RestFlow) =>
    flow.called && !flow.due ? `${flow.called.by ? nameOf(flow.called.by) : 'Someone'} called a rest.` : flow.forced && !flow.due ? 'Rest due (forced march)' : null;
  /** A flow's rows: each character with their answer and statuses in words. */
  const restLines = (flow: RestFlow): RestLine[] =>
    flow.members.map((id) => ({ id, name: nameOf(id), answer: answerOf(restOf(id)), statuses: statusWordsOf(statusBook, id) || undefined }));
  /** The rest prompt and the GM's panel for the flows this person sees. */
  const restViews = myFlows.filter((f) => f.open);
  const restSummary = restWords[0] ?? null;
  /** The Rest button under a group's marching order (B5, B18): for a player with a character in it, while the mode has a rest rule. */
  const restButton = (group: number) => {
    const flow = flows.find((f) => f.group === group);
    if (gm || !flow || !flow.members.some((id) => mineIds.includes(id))) return null;
    return (
      <button type="button" className="button-secondary rest-call" onClick={() => void restCalled(group)}>
        Rest
      </button>
    );
  };
  // The time band's light (B18): the player's own lit light and its time left; "◑ No light" when their group (the
  // GM: any group) has none lit in a dark mode (05: the "in darkness" symbol; the screen never dims).
  const litNow = (lights ?? []).filter((l) => l.seconds === null || l.litAt + l.seconds > now);
  const darkGroups = expedition
    ? groupsInPlay.filter((g) => inDarkness({ underWay: true, pace: mode?.pace ?? null, travellingInDarkness: settings?.travellingInDarkness === true, group: g.ids, litBy: litNow.map((l) => l.id) }))
    : [];
  // SC-g6-2 (ruled B, 2026-11-03): the same "◑ No light" on each marching-order tile of a group in darkness.
  const darkGroup = (group: number) => darkGroups.some((g) => g.number === group);
  const myGroups = groupsInPlay.filter((g) => g.ids.some((id) => mineIds.includes(id)));
  const myLight = !gm ? litNow.find((l) => mineIds.includes(l.id)) : undefined;
  const lightMarks: { key: string; words: string; dark: boolean }[] = !expedition
    ? []
    : gm
      ? darkGroups.map((g) => ({ key: `dark-${g.number}`, words: groupsInPlay.length > 1 ? `◑ ${groupName(g.number)}: No light` : '◑ No light', dark: true }))
      : myGroups.some((g) => darkGroups.includes(g))
        ? [{ key: 'dark', words: '◑ No light', dark: true }]
        : myLight
          ? [{ key: 'light', words: `🔥 ${myLight.name.replace(/^.*?['’]s? /, 'Your ')}${myLight.seconds !== null && perStep ? `, ${(() => { const n = Math.max(1, Math.ceil((myLight.litAt + myLight.seconds - now) / perStep)); return `${n} ${stepWord}${n === 1 ? '' : 's'}`; })()}` : ''}`, dark: false }]
          : [];
  const [lightAbout, setLightAbout] = [asking === 'light', (on: boolean) => setAsking(on ? 'light' : null)] as const;

  /**
   * The engine as Encounter check reads it at `at` (now, or where a move lands): nc-1 and nc-3 (ruled 2026-11-11),
   * Encounter check respects the hour. Night runs from the setting's sunset to its sunrise, else 22:00 to 06:00 by the
   * clock; the night stop (a camp made, or the move held for the night check) always counts as night.
   */
  function checkEngine(base: Running | null, at = now): Running | null {
    const nightStop = nightAsked !== null || (openCamps ?? []).length > 0;
    const sun = daylightOn(daylightOf(rulesSets), { date, season: date?.season ?? null });
    const minute = units.day ? Math.floor((((at % units.day) + units.day) % units.day) / 60) : 0;
    return base ? { ...base, now: at, situation: { ...base.situation, night: isNight(sun, minute, nightStop, (perStep ?? 0) >= (units.day ?? Infinity)) } } : null;
  }

  /** The lines of a move's encounter check (dec-4 piece d), one per group, at the time the move lands. */
  function moveCheckLines(command: MoveCommand, at: number): CardLine[] {
    const through = command.moveOn.throughCheck ?? null;
    const base = running();
    // The move's own check by name, with the passing place's chance and table (frame 13: "Encounter check, with the
    // breakwater’s chance").
    const own = base ? checkNow(checkEngine(base, at)!).prompts.find((p) => p.kind === 'check') : undefined;
    const passingCheck = through ? { ...through, name: own?.name ?? through.name } : null;
    const passing = base && passingCheck ? { ...base, situation: { ...base.situation, locationCheck: passingCheck, locationCheckOnMove: false } } : base;
    const engine = checkEngine(passing, at);
    return engine ? perGroup(checkNowLines(checkNow(engine), { info: scheduleInfo, mode, units, startedAt: expedition?.startedAt }), groupNumbers) : [];
  }

  // Move on (5b-0, pt-f2): the sheet beside the strip runs its moves through this strip's advance. OfferMover offers
  // this render's mover and check on the GM's full strip (not the compact one); `move` resolves true only once the
  // clock has moved.
  const moveCheckEngine = gm && !compact ? checkEngine(running()) : null;
  const moveCheckFirst = moveCheckEngine ? checkNow(moveCheckEngine).prompts.find((p) => p.kind === 'check') : undefined;
  // A check with a table and no chance is a roll on that table (p2p-19, B9): the sheet's Then line names the table.
  const moveRollTable = moveCheckFirst && moveCheckFirst.kind === 'check' && moveCheckFirst.always ? moveCheckFirst.hit.tables[0] : undefined;
  const moveRoll = moveRollTable ? (tables.get(moveRollTable)?.name ?? null) : null;
  const moveCheck: MoveCheck | null = moveCheckFirst && moveCheckFirst.kind === 'check' ? { name: moveCheckFirst.name, chance: moveCheckFirst.chance, ...(moveRoll ? { roll: moveRoll } : {}) } : null;
  const mover: SceneMover = {
    move: async (request) => {
      if (busy.current) return false;
      const time = moveTime(request.time, request.extraTurns, units);
      if ('refusal' in time) {
        show({ text: time.refusal, error: true });
        return false;
      }
      if (!running()) {
        show({ text: "This mode's step can't be read. Check its setting rules.", error: true });
        return false;
      }
      // A far end the campaign hasn't made yet is made from the pack first (place.fromPack, its own line).
      let placeId = request.to.placeId;
      if (!placeId) {
        const entry = await loadPackPlaceEntry(db, request.to.packId, request.to.entryId);
        if (!entry) {
          show({ text: "That place isn't in an attached pack any more.", error: true });
          return false;
        }
        const made = await act(placeFromPack, { campaignId: campaign.id, entry, regionalTables: regionalTablesOfRulesSets(setting?.rulesSets ?? []) });
        if (!made) return false;
        placeId = made.id;
      }
      const moveOn = { placeId, turns: time.turns, way: request.way, throughCheck: request.throughCheck ?? null };
      return withSeason((engine) => advanceBy(engine, { value: time.turns, unit: 'turn' }), `Moved to ${request.to.name}`, { moveOn });
    },
    // Move on's "End expedition" at a Location the pack marks a way out (B10, p2p-22): it ends the expedition as the
    // menu's End expedition does at once (its command, its toast "Expedition ended. …" with Undo, the summary card),
    // with no escape rolls: the pack says the party is at a way out. While the last change is still saving, it says so
    // rather than nothing (the sheet stays open; #1086's review, finding 5), in the words the place's rules use.
    leave: async () => {
      if (busy.current) {
        show({ text: 'Still saving…' });
        return false;
      }
      return endWithToast();
    },
  };

  /**
   * Encounter check (DG3; "Check now" until the M5 gate, B12): the wandering checks in play now go on the card (one per group after a split), each logged when
   * the GM taps Hit or Miss; the regular schedule carries on. With no wandering check at all, a pop-up says why.
   */
  function checkNowNow() {
    const engine = checkEngine(running());
    const found = engine ? checkNowLines(checkNow(engine), { info: scheduleInfo, mode, units, startedAt: expedition?.startedAt }) : [];
    if (found.length === 0) return setAsking('no-check');
    // A check already on the card isn't added again (M5 gate fix): one tap, one line, with Undo.
    const { card: next, added } = addCheckNow(card, perGroup(found, groupNumbers));
    if (added.length === 0) return show({ text: found.length > 1 || groupNumbers.length > 1 ? 'The wandering checks are already on the card' : 'The wandering check is already on the card' });
    setCard(next);
    setHit(null);
    setCardTitle((t) => t ?? 'Encounter check');
    show({ text: added.length > 1 ? `${added.length} wandering checks on the card` : 'Wandering check on the card', onUndo: () => setCard((c) => withoutLines(c, added)) });
  }

  /**
   * In town (dt-2): the current mode's step ("Next part of day") moves the clock; no expedition is under way, so
   * nothing in the procedure runs. The town switches turn off at the morning, as in an expedition.
   */
  async function stepInTown() {
    if (!clock) return;
    const per = stepSeconds(pickedMode, units);
    if (!per) return show({ text: "This mode's step can't be read. Check its setting rules.", error: true });
    const partly = isPartOfDay(pickedMode.step.unit);
    const moved = await act(partly ? nextPartOfDay : advanceTime, { campaignId: campaign.id, clock, seconds: per });
    if (!moved) return;
    const town = await resetAtMorning(now, now + per);
    const where = partly ? partOfDay(now + per, units) : clockWords(now + per, units, null);
    const reset = town.length ? `, ${town[0]!.name}` : '';
    // The step put nothing on the card, so its Undo takes nothing off it.
    setLastFresh([]);
    lastFreshNow.current = [];
    setEndedLines((e) => (e ? { ...e, lines: [] } : e));
    show({ text: `${where.charAt(0).toUpperCase()}${where.slice(1)}${reset}`, onUndo: () => void undoClock() });
  }

  /**
   * Start downtime (ST10, split by dt-2): a full rest for every character in play, then Downtime; one request, so the
   * toast's and the panel's Undo put it all back (the rest, the mode and the town switches).
   */
  async function beginDowntime() {
    if (busy.current) return;
    const party = await loadParty(db, campaign.id);
    if (party === null) return show({ text: "Couldn't read the characters. Check your connection and try again.", error: true });
    const entry = (kind: string, id: string | null) => (id ? (setting?.all.find((e) => e.kind === kind && e.packEntryId === id)?.data ?? null) : null);
    const refills = restRefills(party.map((w) => ({ id: w.ref.id, level: w.level, klass: entry('class', w.classRef), race: entry('race', w.raceRef) })));
    const done = await act(startDowntime, { campaignId: campaign.id, refills });
    if (!done) return;
    if (endToast.current !== null) toasts.take(endToast.current);
    endToast.current = null;
    setEnded(null);
    setSwitches({ ...SWITCHES_OFF });
    setDowntimeBegan(party);
  }

  async function finishDowntime() {
    const done = await act(endDowntime, { campaignId: campaign.id });
    if (!done) return;
    setDowntimeBegan('none');
    show({ text: 'Downtime ended, back to adventure time', onUndo: () => void undoLatest('downtime.end') });
  }

  /**
   * The morning's reset (sw-3): a move that reaches the next morning (until parts of the day, step 6a: when the day
   * changes) turns both town switches off, as its own Simple log line. Gives the card's information line, if any.
   */
  async function resetAtMorning(from: number, to: number): Promise<CardLine[]> {
    // In a mode whose step is a part of the day, the morning is the morning part (6a); otherwise the day's change.
    const current = mode ?? (inTown ? pickedMode : null);
    const morningAt = current && isPartOfDay(current.step.unit) ? morningStarts(units) : 0;
    if (!anyOn(switches) || !reachesMorning(from, to, units.day, morningAt)) return [];
    const words = endedWords(switches!);
    const reset = await act(resetTownSwitches, { campaignId: campaign.id });
    if (reset === null) return [];
    setSwitches({ ...SWITCHES_OFF });
    return [{ key: `town:${to}`, group: 'gm', decision: 'info', name: `${words}, morning`, icon: 'note', count: 1, note: null, check: null, tableId: null, recharge: null, nextAt: null, stepId: null }];
  }

  /** Out and about today, Active tonight (sw-1, sw-2): the GM's, kept with the campaign; one Simple log line each, with Undo. */
  async function flipSwitch(which: keyof TownSwitches, on: boolean) {
    const command = which === 'outDay' ? setOutDay : setActiveNight;
    const saved = await act(command, { campaignId: campaign.id, on });
    if (saved === null) return;
    // One or the other (sm-1): a turn-on puts the other half out too, at once (the command did the same in the database).
    const before = switches;
    setSwitches((s) => afterFlip(s, which, on));
    show({ text: flipToastWords(before, which, on), onUndo: () => void undoLatest(command.name) });
  }

  /** Travelling in darkness (S2-7): kept with the campaign's settings, so players' screens follow it; logged, with Undo. */
  async function travelInDarkness(on: boolean) {
    const saved = await act(updateCampaign, { campaignId: campaign.id, settings: { ...(settings ?? {}), travellingInDarkness: on } as Json });
    if (saved === null) return;
    setSettings((s) => ({ ...(s ?? {}), travellingInDarkness: on }));
    show({ text: on ? 'Travelling in darkness: players without a light see the dark' : 'Travelling in daylight again', onUndo: () => void undoLatest('campaign.update') });
  }

  function confirmRecharge(line: CardLine) {
    const item = rechargeItems.find((i) => i.lineId === line.recharge?.lineId);
    if (!item || !line.recharge) return show({ text: 'That item is no longer in the campaign.', error: true });
    const amount = line.recharge.amount;
    if (/^\d+$/.test(amount)) return void rechargeNow(line, item, Number(amount));
    setRecharging({ line, item });
  }

  // B2 (M5 gate): the scene's encounter tables, for Explore's row and the rest of a hit's list: each encounter check's
  // candidates in D12's order (the first check's first is the likely one), then the GM's own encounter checks' tables.
  // At a place whose own check stands in (pf-12b) and names a table, that table is this place's (`sceneCandidatesOf`):
  // `whichTables` leads with it, so the row names it and not the mode's (the tables-row fault, 2026-11-18).
  const sceneCandidates = (() => {
    const found: TableCandidate[] = [];
    if (!gm || !mode) return found;
    const icons = new Map<string, Icon>(mode.procedure.filter((s) => s.kind === 'check' && s.checkId).map((s) => [s.checkId!, s.icon]));
    for (const check of mode.checks) {
      if (!optionOn(check.onlyWithOption ?? null, choices) || !runsNow(check.onlyWhen, switches)) continue;
      const icon = icons.get(check.id) ?? 'dot';
      if (!isEncounterCheck(check, icon)) continue;
      for (const c of checkPrompt(check, icon, exploration, {}).hit.candidates) if (!found.some((f) => f.tableId === c.tableId)) found.push(c);
    }
    const own = (reminders ?? []).flatMap((r) => (r.active && r.kind === 'check' && r.encounterCheck && r.tableId ? [r.tableId] : []));
    return sceneCandidatesOf({ mode: found, own, place: placeCheck, rules: exploration });
  })();
  // A hit's column: the terrain's, else the first its check names (05: the party's route pre-picks it).
  const hitColumn = hit?.line.check?.hit.column ?? hit?.line.check?.hit.columns[0] ?? null;
  const sceneColumn = (() => {
    if (!mode) return null;
    for (const check of mode.checks) {
      const plan = checkPrompt(check, 'dot', exploration, {}).hit;
      const col = plan.column ?? plan.columns[0] ?? null;
      if (col) return col;
    }
    return null;
  })();
  // ga-2: where the party is (the first group's ground), for a table row that opens a table by terrain.
  const groundNow = (() => {
    const terrain = mode ? terrainOf(mode, firstTravelRow?.terrainId) : null;
    return terrain ? { id: terrain.id, classId: terrain.classId } : null;
  })();
  const pinIds = (pins ?? []).map((p) => p.tableId);
  const knownTable = (id: string) => tables.has(id);
  const exploreList = whichTables({ pins: pinIds, candidates: sceneCandidates, known: knownTable, seasonName });
  const hitList = hit?.line.check
    ? whichTables({ pins: pinIds, candidates: hit.line.check.hit.candidates, rest: sceneCandidates.map((c) => c.tableId), known: knownTable, seasonName })
    : exploreList;
  const likelyId = exploreList.rows.find((r) => r.likely)?.tableId ?? null;
  const engine = running();
  const pips = engine ? hourTrackNow(engine, gm ? 'gm' : 'player') : null;
  // The strip: the procedure in force (S7, mc-54): the place's, else the mode's (not the app's plain fallback modes),
  // else the rules set's, else the app's own five.
  const strip = procedureInForce({ chain: placeChain, modeId: mode && !mode.fallback ? mode.id : null, rulesSets });

  const title = expedition && mode ? expeditionLine(mode, expedition, now, units) : inTown ? betweenLine(pickedMode, now, units) : 'Downtime';
  // Leave the dungeon (DG17): the pack's dungeon-exit rule, on, in a turn-by-turn mode; absent otherwise (leaving is
  // narrative then). Resumed mid-dungeon (DG16): the session started after the expedition under way did; said until
  // the first advance of this session on this device.
  const exitRule: DungeonExit | null = gm && expedition && mode?.pace === 'turn' ? readDungeonExit(rulesSets, choices) : null;
  const resumed = expedition && mode && session && resumedDone !== session.id && resumedMidDungeon(session, expedition) ? `Resumed: ${startPlace?.name ? `${startPlace.name}, ` : ''}${stepOfLine(title, mode.name)}` : null;

  /** End expedition, from ⋯: the dungeon-exit rule's escape rolls first when on (05). */
  function askEnd() {
    // Without an escape roll (of-5: safe paths only) there's nothing to ask first: End expedition ends.
    if (exitRule && hasRoll(exitRule) && !askedRolls) {
      setLeaveFor('end');
      setAsking('leave');
      return;
    }
    void endWithToast();
  }

  /** End expedition itself (⋯, or the leave sheet's End without rolls): the end, and its toast with Undo (S19, T11). */
  async function endWithToast(): Promise<boolean> {
    const done = await endNow();
    if (done) endToast.current = toasts.show({ text: `Expedition ended. ${tookWords(done)}`, onUndo: () => void undoLatest('expedition.end', () => setEnded(null)) });
    return !!done;
  }

  async function endNow(): Promise<Expedition | null> {
    if (!expedition) return null;
    const done = await act(endExpedition, { campaignId: campaign.id, expedition });
    if (!done) return null;
    setEnded(done);
    // In a safe place? is the summary's first line, unanswered: no downtime offer until a Yes.
    setNotYet(false);
    // The party stays in Adventure, in this mode (dt-2): its step is the strip's main advance in town.
    setModeId(done.mode);
    // Start downtime turns the town switches off (sw-3; the database does it with the move into Downtime).
    setSwitches({ ...SWITCHES_OFF });
    // The expedition's own lines leave the card; the GM's reminders stay.
    setCard((c) => c.filter((l) => l.group === 'gm'));
    // Those lines are gone, so an Undo after this takes nothing off the card (the GM's lines stay).
    setEndedLines({ id: expedition.id, lines: lastFreshNow.current });
    setLastFresh([]);
    lastFreshNow.current = [];
    setEndedQuiet(true);
    setHit(null);
    setNotes('');
    return done;
  }

  /** Use safe paths (of-5, sq-2): logged once per expedition, with Undo; the pack's note shows either way. */
  async function safePathsUsed() {
    if (!expedition || expedition.safePaths) return;
    const done = await act(leaveBySafePaths, { campaignId: campaign.id, expedition });
    if (done) show({ text: 'Left by safe paths', onUndo: () => void undoLatest('expedition.safePaths') });
  }

  /**
   * Leave the dungeon, the band's door (st-4, st-9; S2): AT a way out the party leaves at once, with Undo; NOT at one,
   * the sheet with the two ways; where the app CAN'T TELL (or can't read it), the same sheet with a first row that
   * leaves at once. Only ways shown to the players count (dungeonWayOut.ts).
   */
  async function leaveTap() {
    if (!expedition || readingWayOut.current) return;
    readingWayOut.current = true;
    let found: Awaited<ReturnType<typeof loadWayOut>>;
    try {
      found = await loadWayOut(db, campaign.id, expedition.id);
    } catch {
      // A read that fails is "can't tell" (the sheet with its first row), and never leaves the door deaf.
      found = null;
    } finally {
      readingWayOut.current = false;
    }
    if (found?.kind === 'at') return void leaveNow();
    setLeaveFor('leave');
    setLeaveCase(found?.kind === 'not' ? 'not' : 'cantTell');
    setAsking('leave');
  }

  /** The party leaves: the expedition ends (as End expedition does), its toast with Undo (T6b, case a). */
  async function leaveNow() {
    const where = startPlace?.name ?? null;
    if (!(await endNow())) return;
    // Tracked like End's toast: Start downtime takes it down, so its Undo can't un-end the expedition during downtime.
    endToast.current = toasts.show({ text: where ? `The party left ${where}.` : 'The party left the dungeon.', onUndo: () => void undoLatest('expedition.end', () => setEnded(null)) });
  }

  /** The tent (S2): Make camp's sheet where the setting has Quick camp; else it makes camp at once, with Undo. */
  function campTap() {
    if (!perStep) {
      setWhyBlocked({ title: 'Make camp', words: "This mode's step can't be read, so the camp's night can't be placed. Check its setting rules." });
      return setAsking('why');
    }
    // Never while an encounter waits, never at a Location the pack marks "no camp here" (B18, p2p-23): the tap
    // explains in the pop-up and makes no camp, before the two-ways sheet too. The database refuses nothing (⚑ 7).
    // What hasn't been read is not "none" (the review of #1020): until both reads have answered for this expedition,
    // or after one failed, the tap says so and makes no camp. A failed read is asked for again by the tap.
    const reads = [waitingRead, placeRead].map((r) => (r?.expedition !== expeditionId ? 'reading' : r.ok ? 'read' : 'failed'));
    const unread = reads.includes('failed') ? 'failed' : reads.includes('reading') ? 'reading' : null;
    const blocked = whyNoCamp({
      encountersWaiting: reads[0] === 'read' ? (waiting?.length ?? 0) : 0,
      noCampAt: reads[1] === 'read' ? (noCampHere(placeChain)?.name ?? null) : null,
      unread,
    });
    if (blocked) {
      if (unread === 'failed') setVersion((v) => v + 1);
      setWhyBlocked(blocked);
      return setAsking('why');
    }
    if (campRule?.quick) return setAsking('camp');
    void makeCamp(false);
  }

  /** Leave the dungeon: one escape roll request per character (or one for the party), with the depth worked out. */
  async function askForRolls(rule: RolledExit, levelsDown: number) {
    // Only what players need goes in the prompt; the doom table stays with the rule on the GM's side.
    const asked = await act(askRequests, { campaignId: campaign.id, kind: 'escapeRoll', who: rule.who, prompt: escapePromptOf(rule, levelsDown) as unknown as Record<string, unknown> });
    if (!asked) return;
    setAsking(null);
    setAskedRolls(true);
    show({ text: asked.length === 1 ? 'Asked for the escape roll, answer it under Players' : `Asked for ${asked.length} escape rolls, answer them under Players`, onUndo: () => void undoLatest('request.ask', () => setAskedRolls(false)) });
  }
  // Travelling in darkness (S2-7): a switch in day-by-day modes (turn modes are dark without a light anyway).
  const travellingInDarkness = settings?.travellingInDarkness === true;
  // Whether the current mode has a check that reads this town switch (onlyWhen), for the ⋯ items (sw-2).
  const usesSwitch = (which: keyof TownSwitches) => !!mode?.checks.some((c) => c.onlyWhen === which);
  // The strip's marker (sw-2) and the players' quiet line (sw-4): the same words, never anything about the checks.
  const switchesNow = expedition || inTown ? switchesLine(switches) : null;
  // "Sunset around now" (S2-7) went with the band (S1): its date line says what is left of the light.
  // Camp (M5b step 4, D13): the GM makes camp for the evening, for every group in play; Quick camp is one tap when
  // the pack's quick camping rule is on. The groups' camp cards show the steps.
  const campRule = expedition && mode && setting ? campInfo({ setting, mode, modes: exploration.modes, units, choices, gm }) : null;
  async function makeCamp(quick: boolean) {
    if (!expedition || !perStep || !campRule) return;
    const day = Math.max(0, elapsedSteps(now, expedition.startedAt, perStep) - 1);
    const fire = campRule.fire ? { typeId: campRule.fire.typeId, name: campRule.fire.name, fuelItem: campRule.fire.fuelItem } : null;
    let made = 0;
    for (const g of groupsInPlay) {
      const camp = await act(openCamp, { target: { campaignId: campaign.id, group: g.number, mine: false }, day, quick, fire });
      if (camp) made++;
    }
    if (made === 0) return;
    show({
      text: quick ? 'Quick camp made' : groupsInPlay.length > 1 ? `Camp made, ${groupsInPlay.length} groups` : 'Camp made',
      onUndo: () => void (async () => {
        for (let i = 0; i < made; i++) await undoLatest('camp.open');
      })(),
    });
  }
  // Which watch? (D18): a hit of the camp's night check while the group camps asks which watch was awake.
  const nightChecks = new Set((campRule?.steps ?? []).flatMap((s) => (s.part === 'night' && s.step?.checkId ? [s.step.checkId] : [])));
  const watchChoicesFor = (card: EncounterCard): string[] | null => {
    // An Encounter check during camp keys its line "now:check:mode:<id>" and names it "<check>, now" (card.ts; " · now"
    // on lines kept from before the sweep).
    // A split party's line ends "@group<N>" (perGroup), which isn't part of the check's id.
    const checkId = /^(?:now:)?(?:check|again):mode:([^:@]+)/.exec(card.hit.checkKey)?.[1];
    if (!checkId || !nightChecks.has(checkId)) return null;
    const group = groupOfCheckName(card.hit.name);
    const camp = (openCamps ?? []).find((c) => c.camp.group === group);
    return camp ? watchesOf(camp.entries).map((w, i) => `${ordinal(i + 1)} watch${STORED_SEPARATOR}${w.map(nameOf).join(', ')}`) : null;
  };
  async function setWatch(card: EncounterCard, watch: string) {
    const done = await act(setEncounterWatch, { campaignId: campaign.id, encounter: card.encounter, watch });
    if (done) show({ text: `Awake: ${shownWatch(watch)}`, onUndo: () => void undoLatest('encounter.watch') });
  }
  // The band's heading (S1), also the over-line of the sheets the band opens (T6b).
  const bandHeadingNow = bandHeading({ state: sessionNow, place: startPlace?.name ?? null, modeName: expedition && mode ? mode.name : null, step: expedition && mode ? stepOfLine(title, mode.name) : null, fallback: title });
  // The band's menu (S3, st-4; page 16, T6b and T5): what the band's icon buttons don't hold, each with its icon. Make
  // camp, Quick camp and Encounter check went to the band (S2). The town's two switches and Start downtime stay until
  // their own rows (S6's tile; the town's top) give them a home.
  const menu = gm && (
    <MoreMenu label="Time options">
      <MenuItems>
        {expedition && mode?.pace === 'day' && (
          <Switch
            label={
              <span className="scene-menu__switch">
                <span className="more-menu__symbol">
                  <UiIcon name="night-vision" />
                </span>
                Travelling in darkness
              </span>
            }
            on={travellingInDarkness}
            onChange={(on) => void travelInDarkness(on)}
          />
        )}
        {/* The town switches (sw-2): while the mode has a check that reads one, or while it's on (so it can be turned off). Interim until S6's tile. */}
        {(expedition || inTown) && (switches?.outDay || usesSwitch('outDay')) && (
          <MenuItem icon="scene" onClick={() => void flipSwitch('outDay', !switches?.outDay)}>
            {switches?.outDay ? `${OUT_DAY}: On` : `${OUT_DAY}: Off`}
          </MenuItem>
        )}
        {(expedition || inTown) && (switches?.activeNight || usesSwitch('activeNight')) && (
          <MenuItem icon="darkness" onClick={() => void flipSwitch('activeNight', !switches?.activeNight)}>
            {switches?.activeNight ? `${ACTIVE_NIGHT}: On` : `${ACTIVE_NIGHT}: Off`}
          </MenuItem>
        )}
        {/* Set time… folded into Advance by… (B12): forward by an amount, or a chosen time as a correction. */}
        <MenuItem icon="fast-forward-button" onClick={() => setAsking('by')}>
          Advance by…
        </MenuItem>
        {/* Downtime's other moves (page 16, T5: with Advance by…). Downtime's top is provisional (dw-1). */}
        {inDowntime && (
          <MenuItem icon="fast-forward-button" onClick={() => void downtime(units.week!, '1 week')}>
            +1 week
          </MenuItem>
        )}
        {inDowntime && (
          <MenuItem icon="calendar" onClick={() => setAsking('day')}>
            To day…
          </MenuItem>
        )}
        {/* Reminders (st-3): the Reminders sheet (S10, T6). */}
        {sessionNow === 'running' && (
          <MenuItem icon="ringing-bell" onClick={() => setAsking('reminders')}>
            Reminders
          </MenuItem>
        )}
        {expedition && (
          <MenuItem icon="flag-objective" sub="You'll be asked whether the party is somewhere safe" onClick={askEnd}>
            End expedition
          </MenuItem>
        )}
        {inTown && (
          <MenuItem icon="scene" sub="A full rest for everyone, then time passes by the day" onClick={() => void beginDowntime()}>
            Start downtime
          </MenuItem>
        )}
        {inDowntime && (
          <MenuItem icon="flag-objective" sub="Back to adventure time; the party stays where it is" onClick={() => void finishDowntime()}>
            End downtime
          </MenuItem>
        )}
        {session && (
          <MenuItem
            icon="power-button"
            sub="Stop playing for today; the clock keeps its place"
            onClick={async () => {
              const done = await act(endSession, { campaignId: campaign.id, session });
              if (done) show({ text: `Ended session ${done.number}`, onUndo: () => void undoLatest('session.end') });
            }}
          >
            End session
          </MenuItem>
        )}
      </MenuItems>
    </MoreMenu>
  );

  // The dialog both strips use: "Which season?" before a step that needs it. (The long press's "How many?" went
  // at the M5 gate, A6: tapping Next turn again is how several turns pass.)
  const seasonDialog = asking === 'season' && (
    <WhichSeason
      seasons={seasonsOf(months)}
      nameOf={seasonName}
      onPick={async (season) => {
        const waiting = waitingForSeason.current;
        waitingForSeason.current = null;
        setAsking(null);
        // The day the advance lands on becomes the season's first day (ruled 2026-10-30): the start is worked
        // back from it. Outside an advance it would be today.
        const daysOn = Math.floor((waiting?.landsAt ?? now) / units.day!);
        const next = startForToday(months, season, daysOn);
        const today = next ? dateAfter(months, startIndex(months, next)!, daysOn) : null;
        const words = today ? `Today is ${showDate(today)}` : next ? `The calendar starts on ${startWords(months, next)}` : null;
        // The step that waited says the start in its own toast, with one Undo for both (the advance's toast block).
        if (next && words && (await saveStart(next, words)) && waiting) seasonSaved.current = words;
        waiting?.go(season);
      }}
      onNotNow={async () => {
        const go = waitingForSeason.current?.go;
        waitingForSeason.current = null;
        setAsking(null);
        // Kept with the campaign until the next session, for every GM device (ruled 2026-10-30). Nothing blocks:
        // the step runs without a season even if this can't be saved.
        setScene((s) => (s && s !== 'error' ? { ...s, seasonNotNow: true } : s));
        await act(seasonNotNow, { campaignId: campaign.id });
        go?.(null);
      }}
      onCancel={() => {
        waitingForSeason.current = null;
        setAsking(null);
      }}
    />
  );
  const leaveDialog = asking === 'leave' && exitRule && (
    <LeaveDialog
      rule={exitRule}
      over={bandHeadingNow}
      ending={leaveFor === 'end'}
      atWayOutRow={leaveFor === 'leave' && leaveCase === 'cantTell'}
      onLeave={() => {
        setAsking(null);
        void leaveNow();
      }}
      onAsk={(levels) => {
        if (hasRoll(exitRule)) void askForRolls(exitRule, levels);
      }}
      onEnd={() => {
        setAsking(null);
        void endWithToast();
      }}
      onSafePaths={() => {
        setAsking(null);
        void safePathsUsed();
      }}
      onClose={() => setAsking(null)}
    />
  );
  // Make camp's sheet (S2, T6b): only where the setting has two ways to camp (its quick-camp rule).
  const campDialog = asking === 'camp' && campRule?.quick && (
    <SheetScope.Provider value>
      <Dialog label="Make camp" over={bandHeadingNow} onClose={() => setAsking(null)}>
        <StackedGroup>
          <StackedButton
            icon="camping-tent"
            label="Make camp"
            variant="primary"
            onClick={() => {
              setAsking(null);
              void makeCamp(false);
            }}
          />
          <StackedButton
            icon="sleeping-bag"
            label="Quick camp"
            onClick={() => {
              setAsking(null);
              void makeCamp(true);
            }}
          />
        </StackedGroup>
      </Dialog>
    </SheetScope.Provider>
  );
  // A blocked band button says why (S2: never disabled).
  const whyDialog = asking === 'why' && whyBlocked && (
    <Dialog label={whyBlocked.title} onClose={() => setAsking(null)}>
      <p className="time-strip__notes">{whyBlocked.words}</p>
    </Dialog>
  );
  // Encounter check with no wandering check (DG3): said in a pop-up, never a button that does nothing.
  const noCheckDialog = asking === 'no-check' && (
    <Dialog label="Encounter check" onClose={() => setAsking(null)}>
      <p className="time-strip__notes">This mode has no wandering check, and none of your reminders is marked Encounter check. Add one under Reminders to check by hand.</p>
    </Dialog>
  );

  // The Reminders sheet (S10; st-3; page 16, T6), from the menu's Reminders (S3): what is to come, each with when it
  // next falls due, and + Reminder.
  const gmReminders = gm && (
    <GmReminders
      reminders={reminders}
      tables={[...tables.values()].map((t) => ({ id: t.id, name: t.name }))}
      units={units}
      now={now}
      onSave={async (fields, reminder) => {
        const saved = reminder ? await act(editReminder, { campaignId: campaign.id, reminder, changes: fields }) : await act(addReminder, { campaignId: campaign.id, fields });
        if (!saved) return false;
        show({ text: reminder ? `Changed the reminder ${saved.label}` : `Made the reminder ${saved.label}`, onUndo: () => void undoLatest(reminder ? 'reminder.edit' : 'reminder.add') });
        return true;
      }}
      onStop={async (reminder, active) => {
        const saved = await act(editReminder, { campaignId: campaign.id, reminder, changes: { active } });
        if (!saved) return false;
        show({ text: active ? `Started the reminder ${saved.label} again` : `Stopped the reminder ${saved.label}`, onUndo: () => void undoLatest('reminder.edit') });
        return true;
      }}
    />
  );
  const remindersDialog = asking === 'reminders' && gmReminders && (
    <SheetScope.Provider value>
      <Dialog label="Reminders" over={bandHeadingNow} onClose={() => setAsking(null)}>
        {gmReminders}
      </Dialog>
    </SheetScope.Provider>
  );

  /** Start session, or Resume session after a pause (B7): one tap, Undo in the toast. */
  async function beginSession() {
    const started = await act(startSession, { campaignId: campaign.id });
    if (!started) return;
    show({ text: `Started session ${started.number}`, onUndo: () => void undoLatest('session.start') });
  }

  // Who may open the procedure from the strip's title (B5): the GM during an expedition; players when the setting's
  // procedure is player-readable (or the app's fallback).
  const procedureOpen = !!(expedition && mode && (gm || exploration.playerReadable || mode.fallback));

  // The Compact time strip (DG2): the mode and step, the pips and the main advance, on the GM's other screens. Its
  // advance runs the same procedure onto the same card (a toast says what came due, with Undo); "N on the card ·
  // Scene ›" goes to Scene to deal with it. The screen's own accent button stays the screen's: this one is secondary.
  if (compact) {
    if (!expedition || !mode) return null;
    const waiting = (todayTags ? card.filter((l) => !l.key.startsWith('weather:')) : card).length;
    return (
      <section className="time-strip time-strip--compact" aria-label="Time">
        <p className="time-strip__compact-title">{title}</p>
        <MainAdvance
          label={advanceLabel(mode, units)}
          quiet
          onTap={() => void withSeason((engine) => nextStep(engine), advanceLabel(mode, units), advanceTime)}
        />
        {pips && <HourTrack pips={pips} stepWord={stepWord.charAt(0).toUpperCase() + stepWord.slice(1)} />}
        {waiting > 0 && onOpenScene && (
          <button type="button" className="button-quiet time-strip__to-scene" onClick={onOpenScene}>
            {`${waiting} on the card, Scene ›`}
          </button>
        )}
        {seasonDialog}
      </section>
    );
  }

  // The GM's band, facts and session states (plan dec-9-the-whole-scene S1, S4, S9; page 16): they replace the strip's
  // head for the GM. Players keep today's head until their top is built (S15).
  // Depart is the accent in town only; downtime has none (page 16, T4 and T5).
  // "Waiting for you" holds it while its open item has an answer (S8: whatever waits, from every source); without the
  // panel's provider, while an encounter waits.
  const owner = accentOwner({ running: sessionNow === 'running', page: accentHeld, waiting: waitingAccent === undefined ? (waiting?.length ?? 0) > 0 : waitingAccent !== null, between: inTown });
  // The season in the date line as the old strip and the day's toast word it (lower case; small capitals draw it).
  const seasonWords = date?.season ? seasonName(date.season).toLowerCase() : null;
  const minuteOfDay = units.day ? Math.floor((((now % units.day) + units.day) % units.day) / 60) : 0;
  // The part of the day in town (T4), where the town's mode steps by it.
  const townPart = inTown && isPartOfDay(pickedMode.step.unit) && units.day ? partOfDay(now, units) : null;
  // Weather as a fact; between expeditions the weather has no view today (it is kept per expedition), so it is absent.
  const bandWeather = () =>
    weatherFact(
      weather.view.kind === 'in'
        ? { kind: 'in', result: weather.view.weather?.result ?? null, line: weather.view.lines[0] ?? null }
        : weather.view.kind === 'due' || weather.view.kind === 'waiting' || weather.view.kind === 'unset'
          ? // A player never gets the weather's table, not even its name (wr-1, S15).
            { kind: 'due', table: gm && weather.view.now.tableId ? (tables.get(weather.view.now.tableId)?.name ?? null) : null }
          : { kind: 'none' },
    );
  // What Set the date asks (mc-24): the date while it's unset; the hour play starts while the clock hasn't moved.
  const asksDate = months.length > 0 && !start;
  const asksTime = clockMoved === false && !expedition && !!units.day && !!units.hour;
  const bandDate: DateLine = {
    icon: seasonIconOf(seasonWords),
    // The season said apart from the date, so a phone can leave it to the icon (T8a).
    words: dateWords({ date, season: null, dayNumber: units.day ? Math.floor(now / units.day) + 1 : 1 }),
    season: date ? seasonWords : null,
    // Between expeditions no light (mc-69; T5 draws none): in town the part of the day in its place (T4).
    // In a dark mode (a dungeon) the sun's line is hidden; Light is the only light fact (⚑ 1 on #958, "yes, b").
    light: townPart
      ? partOfDayWords(townPart)
      : inTown || inDowntime || (expedition && darkMode(mode?.pace ?? null, settings?.travellingInDarkness === true))
        ? null
        : lightLeftWords(daylightOn(daylightOf(rulesSets), { date, season: date?.season ?? null }), minuteOfDay),
    // While the date is unset the line is the tap (st-2): the calendar's start, or (no calendar) the hour play starts.
    // Set the date (S10, T6): one sheet for the day, the month and the hour play starts, asking only what's unknown.
    onSet: asksDate || asksTime ? () => setAsking('date') : undefined,
  };
  // The groups a viewer's facts speak of: every group for the GM (T7); a player's own group (page 18, PL6), or every
  // group for a player with nobody in the marching order.
  const factGroups = gm || myGroups.length === 0 ? groupsInPlay : myGroups;
  const factFlows = gm || myFlows.length === 0 ? flows : myFlows;
  const myGroupNumber = myGroups[0]?.number ?? 1;
  // The light by group, for the Light fact and a player's Light pop-up (PL8).
  const lightGroups = factGroups.map((g) => ({
    group: g.number,
    name: groupName(g.number),
    dark: darkGroups.includes(g),
    lights: litNow
      .filter((l) => g.ids.includes(l.id))
      .map((l) => ({ name: l.name, stepsLeft: l.seconds === null || !perStep ? null : Math.max(1, Math.ceil((l.litAt + l.seconds - now) / perStep)) })),
  }));
  const bandFacts: Fact[] =
    sessionNow === 'none'
      ? []
      : !expedition || !mode
        ? // The town's facts (T4): Weather and the part of the day; no Light (mc-69), no safety fact (the sun and moon
          // tile takes its place, S6), Lodging's place left free until it is tracked. Downtime's (T5): Weather alone.
          [bandWeather(), townPart ? partOfDayFact(townPart, partOfDay(now + units.partOfDay!, units), { advance: gm }) : null].filter((f): f is Fact => f !== null)
        : [
          bandWeather(),
          // A town's mode has no light fact (mc-69).
          isPartOfDay(mode.step.unit)
            ? null
            : lightFact({ stepWord, groups: lightGroups }),
          rest ? restFact({ stepWord, day: restDay, ruleWords: restEveryWords(mode.rest), pushedOn: !gm && factFlows.some((f) => !f.open && f.members.some((id) => mineIds.includes(id) && pushedOn(restOf(id), expedition.startedAt))), groups: factFlows.map((f) => ({ group: f.group, name: groupName(f.group), open: f.open, stepsLeft: f.stepsLeft })) }) : null,
          (() => {
            // A player's: the last shown place's own check where it stands in (mc-39b, mc-50; the database sends when
            // it's rolled and its chance only), else the setting's from the rules set as the player's copy has it.
            const shownCheck = gm ? undefined : playersChecks.find((c) => c.group === myGroupNumber);
            if (shownCheck) return checkFact({ name: null, eachMove: shownCheck.eachMove, every: shownCheck.every, chance: shownCheck.chance, fallbackUnit: stepWord });
            const inForce = engine ? encounterCheckOf(engine) : null;
            if (!inForce) return null;
            return checkFact({ name: inForce.source === 'location' ? (placeCheck?.name ?? null) : null, eachMove: inForce.eachMove, every: inForce.check.every, chance: inForce.check.chance, fallbackUnit: stepWord });
          })(),
        ].filter((f): f is Fact => f !== null);
  // The table library ("Table library ›", the only place a pin is set): in the band without an expedition, else at the foot of
  // the Encounter tables screen the band's row opens (the approval's fix 3, 2026-11-18).
  const tablesLibrary = <TablesLibrary tables={tables} pinned={pins ? new Set(pinIds) : null} onPin={(id, on) => void pinNow(id, on)} describe={describeRow} terrain={groundNow} />;
  const bandCheck = bandFacts.find((f) => f.id === 'check') ?? null;
  const bandPart = bandFacts.find((f) => f.id === 'part') ?? null;
  // The Rest fact's whole words head its sheet (tv-1: the tile may cut them).
  const bandRest = bandFacts.find((f) => f.id === 'rest') ?? null;
  // A player's Encounter check pop-up (PL8): the setting's check's words where the player's copy opens them; none for
  // the shown place's own check, whose read sends when and chance only (⚑ on P10: its words would widen that read).
  const playersCheckRule = (() => {
    if (gm || !mode || !engine || playersChecks.some((c) => c.group === myGroupNumber)) return [];
    const inForce = encounterCheckOf(engine);
    return inForce?.source === 'mode' ? checkRule(mode, inForce.check.id, exploration.playerReadable) : [];
  })();
  const openFact = (id: Fact['id']) => {
    // The Weather fact opens its sheet (S10, T6): today's weather in plain words, and the roll when it is due.
    if (id === 'weather') setWeatherOpen(true);
    else if (id === 'light') setLightAbout(true);
    else if (id === 'rest') setRestAbout(true);
    // The part of the day opens Advance by… (the lead, 2026-11-15; its words in sceneTop.ts, PART_FACT_TAP).
    // A player's opens its words to read (S15: players don't move the clock).
    else if (id === 'part') setAsking(gm ? 'by' : 'part');
    else setAsking('check');
  };
  const advanceNow = () => void withSeason((engine) => nextStep(engine), advanceLabel(mode!, units), isPartOfDay(mode!.step.unit) ? nextPartOfDay : advanceTime);
  const bandActions = (
    <>
      {/* S2 (st-4, T6b): the icon buttons, by mode and by rule, only while a session runs on an expedition: the tent
          where the setting has a camp rule, the check on every expedition, the door where it has the leaving rule. */}
      {sessionNow === 'running' && expedition && mode && (
        <BandTools>
          {campRule && <BandTool label="Make camp" icon={<UiIcon name="camping-tent" size={24} />} onTap={() => !bandHeld && campTap()} />}
          <BandTool label="Encounter check" icon={<StepIcon name="encounter" size={24} />} onTap={() => !bandHeld && checkNowNow()} />
          {/* No Leave in point to point (p2p-22, B10): leaving is Move on's "End expedition" at a way out. */}
          {exitRule && !isPointToPoint(mode) && <BandTool label="Leave the dungeon" icon={<UiIcon name="exit-door" size={24} />} onTap={() => !bandHeld && void leaveTap()} />}
        </BandTools>
      )}
      {sessionNow !== 'running' && <SessionButton resume={sessionNow !== 'none'} accent={owner === 'session'} onTap={() => !bandHeld && void beginSession()} />}
      {sessionNow === 'running' && expedition && mode && <NextTurnButton label={advanceLabel(mode, units)} accent={false} onTap={() => !bandHeld && !unitHeld && advanceNow()} />}
      {/* In town (T4) the step reads "Advance time" whatever its length (ic-5); the mode's own words stay for the log. */}
      {sessionNow === 'running' && inTown && !ended && <NextTurnButton label={TOWN_STEP_LABEL} accent={false} onTap={() => !bandHeld && void stepInTown()} />}
      {/* Downtime (page 16, T5): "Next day", no accent; +1 week and To day… are in ⋯. Downtime's top is a placeholder
          (dw-1) and will be redesigned with lodging and activities. */}
      {sessionNow === 'running' && inDowntime && !ended && <NextTurnButton label="Next day" accent={false} onTap={() => !bandHeld && void downtime(units.day!, '1 day')} />}
      {/* Depart (ic-5, T4): opens the Depart sheet; the accent in town, plain in downtime (the lead, 2026-11-15: downtime
          keeps a way to start an expedition). Only while a session runs (p2p-4; page 24, DP2; B6): with no session, or a
          paused one, Start or Resume stands alone. */}
      {sessionNow === 'running' && (inTown || inDowntime) && !ended && <DepartButton label={DEPART_LABEL} accent={owner === 'expedition'} onTap={() => !bandHeld && setAsking('depart')} />}
    </>
  );
  // "Waiting for you" (S8b; st-1, wy-1; page 16, T2, T6b, T8b): where it shows (the GM's place page), the reminder
  // card's lines, the rest and the hit are its items, and their boxes leave the page; elsewhere (a town) the strip
  // draws today's boxes. A light that simply burnt out is not an item: the advance's toast says so, and the log keeps
  // its line (st-1).
  const waitingOn = gm && !compact && panelOn;
  /**
   * A check that is a roll on its table (p2p-19, B9; page 24, WY1b): the GM tapped the rolled row in its card. Today's two
   * commands, as a hit and its tapped row are recorded from the tables full screen: the check's result (check.record,
   * a hit: with no chance the table is always rolled) and the row read (check.setRoll). No new command. The toast never
   * says "a hit" (p2p-19: there is no hit or miss): "Rolled: 14–15, A seal, curious", as a tapped row says it. Its Undo
   * takes back both, the row first.
   */
  async function rollRow(line: CardLine, tap: TableTap) {
    if (!line.check || rollingRow.current) return;
    rollingRow.current = true;
    try {
      const command = line.check.now ? recordCheckNow : line.check.again ? recordCheckAgain : recordCheck;
      const result = await act(command, {
        campaignId: campaign.id,
        record: { checkKey: line.key, name: line.name, source: line.check.source, outcome: 'hit', modifiers: line.check.modifiers, note: null, secret: line.check.secret },
      });
      if (!result) return;
      if (hitQueuesEncounter(line.check, reminders)) await act(queueEncounter, { campaignId: campaign.id, result });
      const saved = await act(setCheckRoll, { campaignId: campaign.id, result, tableId: tap.table.id, roll: tap.roll, rowText: tap.rowText });
      setRollingKey(null);
      setCard((c) => takeOne(c, line.key));
      setRecorded((m) => new Map(m).set(line.key, saved ? `Rolled: ${tap.rowText}` : 'Rolled'));
      setHit({ line, result: saved ?? result });
      const restore = () => {
        setCard((c) => mergeCard(c, [{ ...line, count: 1 }]));
        setHit(null);
        setTablesOpen(null);
      };
      show({
        text: `${saved ? `Rolled: ${tap.roll}, ${tap.words}` : `${line.name}: the row wasn't saved`}${(saved ?? result).revealed ? ', players see it' : ''}`,
        onUndo: () => void (saved ? undoLatest('check.setRoll', () => void undoLatest(command.name, restore)) : undoLatest(command.name, restore)),
      });
    } finally {
      rollingRow.current = false;
    }
  }

  const cardShown = todayTags ? card.filter((l) => !l.key.startsWith('weather:')) : card;
  const cardRoll: CardRoll = { openKey: rollingKey, tables, describe: describeRow };
  const cardActions = {
    onHit: (line: CardLine) => void record(line, 'hit'),
    onMiss: (line: CardLine) => void record(line, 'miss'),
    onDone: (line: CardLine) => setCard((c) => takeOne(c, line.key)),
    onAllDone: () => setCard((c) => allDone(c)),
    onModifier: (line: CardLine, label: string, add: number) => setCard((c) => c.map((l) => (l.key === line.key ? addHandModifier(l, label, add) : l))),
    onRecharge: confirmRecharge,
    // The weather line opens the Weather sheet (S10), whose table's row the GM taps to enter today's weather.
    onRoll: (line: CardLine) => (line.key.startsWith('weather:') ? setWeatherOpen(true) : setRollFor(line)),
    onCheckAgain: (line: CardLine) => setCard((c) => checkAgain(c, line.key)),
    // A roll on its table (B9; WY1b): Enter roll… opens the table in the card; a tap on its row is the answer.
    onRollCheck: (line: CardLine) => setRollingKey(line.key),
    onRollRow: (line: CardLine, tap: TableTap) => void rollRow(line, tap),
  };
  // With the panel, a burnt-out light is the toast's, not the card's (#859's review): neither "All done" nor the strip's
  // "nothing due" counts it.
  const notEnded = (lines: CardLine[]) => (waitingOn ? lines.filter((l) => !l.key.startsWith('light-out:')) : lines);
  const cardItemsShown = notEnded(cardShown);
  const cardClearable = cardItemsShown.some((l) => l.decision !== 'check' && l.decision !== 'recharge');
  const accentOn = (id: string) => owner === 'waiting' && waitingAccent === id;
  const lineItems: WaitingSourceItem[] = waitingOn
    ? cardItemsShown
        .map((line): WaitingSourceItem => {
          const id = `card:${line.key}`;
          const weatherLine = line.key.startsWith('weather:');
          const first = firstAnswer(line);
          // The weather's Enter… always opens today's entry, never a silent Done (#859's review).
          const answer = {
            onAction: () =>
              weatherLine
                ? cardActions.onRoll(line)
                : first.id === 'hit'
                  ? cardActions.onHit(line)
                  : first.id === 'rollCheck'
                    ? // A roll on its table (B9; WY1b): its card opens, with the table in it; a table the setting
                      // lacks takes the hit's way, as the card's own button does.
                      tables.has(line.check?.hit.tables[0] ?? '')
                      ? (cardActions.onRollCheck(line), openWaitingRow?.(id))
                      : cardActions.onHit(line)
                  : first.id === 'again'
                    ? cardActions.onCheckAgain(line)
                    : first.id === 'recharge'
                      ? void cardActions.onRecharge(line)
                      : first.id === 'roll'
                        ? cardActions.onRoll(line)
                        : cardActions.onDone(line),
          };
          return {
            id,
            // The weather's roll, named as T2 draws it; its Enter… opens the Weather sheet (S10, T6).
            kind: weatherLine ? 'weather' : 'reminder',
            title: weatherLine ? 'Weather: to roll' : `${line.name}${line.count > 1 ? ` ×${line.count}` : ''}`,
            // Every answer with its icon (S17): Enter… and Enter roll… the rolling dice, Done the tick (page 16, T2); Hit,
            // Check again and Recharge ic-6's (page 21, SI2).
            actions: [weatherLine ? { id: 'roll', label: 'Enter…', icon: 'rolling-dices' } : { id: first.id, label: first.label, icon: first.icon }],
            ...answer,
            card: (
              <ReminderCard
                title={cardTitle}
                card={[line]}
                stepSeconds={perStep}
                startedAt={expedition?.startedAt ?? null}
                stepWord={stepWord}
                pace={mode?.pace ?? 'turn'}
                single={{ accent: accentOn(id), clearable: cardClearable }}
                roll={cardRoll}
                {...cardActions}
              />
            ),
          };
        })
    : [];
  const restItems: WaitingSourceItem[] = waitingOn
    ? restViews.map((flow): WaitingSourceItem => {
        const id = `rest:${flow.group}`;
        const title = `${splitFlows ? `${groupName(flow.group)}: ` : ''}Rest is due`;
        const words = `${restDay ? 'A rest day. ' : ''}${flow.answered} of ${flow.members.length} answered.`;
        return {
          id,
          kind: 'rest',
          title,
          words,
          // ic-4 (2026-11-14): "Answer…" with the scroll and quill (it was night-sleep), its words unchanged.
          actions: [{ id: 'answer', label: 'Answer…', icon: 'scroll-quill' }],
          onAction: () => setRestSheet(flow.group),
          card: (
            <section className="waiting-rest" aria-label={title}>
              <h3 className="waiting-rest__title">{title}</h3>
              <p className="waiting-rest__words">{words}</p>
              {calledWords(flow) && <p className="waiting-rest__words">{calledWords(flow)}</p>}
              <StackedButton icon="scroll-quill" label="Answer…" aria-label={`Answer…, ${title}`} variant={accentOn(id) ? 'primary' : 'secondary'} onClick={() => setRestSheet(flow.group)} />
            </section>
          ),
        };
      })
    : [];
  const restSheetFlow = waitingOn && restSheet !== null ? (restViews.find((f) => f.group === restSheet) ?? null) : null;
  // The hit: today's hit panel, whole, as the first encounter item (it is what the check just brought).
  const hitItems: WaitingSourceItem[] =
    gm && hit
      ? [
          {
            id: `hit:${hit.result.id}`,
            kind: 'encounter',
            title: hitTitle(hit.line),
            ...(hit.result.rowText ? { words: hit.result.rowText } : {}),
            actions: [{ id: 'done', label: 'Done', icon: 'check-mark' }],
            onAction: () => {
              setHit(null);
              setTablesOpen(null);
            },
            card: (
              <HitPanel
                line={hit.line}
                rowText={hit.result.rowText}
                onTables={tables.size > 0 ? () => setTablesOpen('hit') : undefined}
                onClose={() => {
                  setHit(null);
                  setTablesOpen(null);
                }}
                hidden={!hit.result.revealed}
                onReveal={() => void reveal()}
                onSend={messaging ? (words) => messaging.open({ kind: 'new', text: words }) : undefined}
                accent={accentOn(`hit:${hit.result.id}`)}
              />
            ),
          },
        ]
      : [];

  // The card after an expedition ends (S19; ap-11, page 16 T11 to T11d): the GM's alone, an item of "Waiting for you"
  // (first of everything), registered whether or not a panel shows, so it holds the accent there or, while none shows
  // (a town, until 5t), where the strip stands. Its answer is Done; its Undo, in its head, is the end's alone.
  const endShown = endCardFor(gm, ended);
  const endId = endShown ? `end:${endShown.id}` : null;
  const endItems: WaitingSourceItem[] =
    endShown && endId
      ? [
          {
            id: endId,
            kind: 'expeditionEnd',
            title: 'Expedition ended',
            words: tookWords(endShown),
            actions: [{ id: 'done', label: 'Done', icon: 'check-mark' }],
            onAction: () => setEnded(null),
            card: (
              <EndSummary
                db={db}
                user={user}
                campaign={campaign}
                expedition={endShown}
                setting={setting}
                act={act}
                // Without a provider (no panel anywhere) nothing else claims the accent while the card is up.
                accent={waitingAccent === undefined ? owner !== 'session' : accentOn(endId)}
                onUndo={() => void undoLatest('expedition.end', () => setEnded(null))}
                onAnswer={async (safe) => {
                  const done = await act(answerSafePlace, { campaignId: campaign.id, expedition: endShown, safe });
                  if (done) setEnded(done);
                }}
                onDone={() => setEnded(null)}
                staying={endShown.endedSafe === true && !notYet && inTown ? <StayingAWhile onStart={() => void beginDowntime()} onNotYet={() => setNotYet(true)} /> : null}
              />
            ),
          },
        ]
      : [];

  // Depart (S5; page 16, T6's Start session sheet, from town "Depart"; the lead, 2026-11-15), in the order of p2p-5
  // (B7; page 24, DP1 and DP1b, approved 2026-11-18): Where? first and required (⚑ 4), then "Exploration method", then
  // Start with the campfire as the sheet's accent. The hour is known between expeditions, so it is not asked (mc-24).
  // Opened by the band's Depart, in town and in downtime. With nothing picked, Start stays a button and says why.
  async function depart() {
    const picked = wherePicked;
    if (!picked || !departMode) return setNeedPlace(true);
    const where = placeText.trim();
    if (picked.kind === 'other' && picked.name.trim().length > PLACE_NAME_MAX) return show({ text: `A place's name is at most ${PLACE_NAME_MAX} characters.`, error: true });
    const entry = picked.kind === 'pack' ? await loadPackPlaceEntry(db, picked.place.packId, picked.place.entryId) : null;
    if (picked.kind === 'pack' && !entry) return show({ text: "That place isn't in an attached pack any more.", error: true });
    // A second tap while a command runs (act would answer null, busy) leaves the hold to the call that set it.
    if (busy.current) return;
    // st-11: the band holds from here until the reload lands.
    setHeldUntil(Infinity);
    const started = await act(startExpedition, {
      campaignId: campaign.id,
      mode: departMode.id,
      place: picked.kind === 'other' ? picked.name : null,
      placeId: picked.kind === 'place' ? picked.place.id : null,
      packEntry: entry,
      regionalTables: regionalTablesOfRulesSets(setting?.rulesSets ?? []),
    });
    if (!started) {
      setHeldUntil(null);
      return;
    }
    // Every read begun until now (the command's own included) releases it only by showing the expedition (st-11).
    setHeldUntil(readsBegun.current);
    setAsking(null);
    setDepartPick(null);
    setPlaceText('');
    setWherePicked(null);
    show({ text: `Started an expedition: ${departMode.name}${where ? `, ${where}` : ''}${shownAgainWords(started.backShown)}`, onUndo: () => void undoLatest('expedition.start') });
  }
  // The picked place on the sheet (DP1): its name, a Location's with its key ("1. The Jetty") and its Area under it.
  const whereShown = !wherePicked ? null : wherePicked.kind === 'pack' ? { name: keyedName(wherePicked.place.key, wherePicked.place.name), area: packPlaces ? departAreaName(packPlaces, wherePicked.place) : null } : { name: placeText, area: null };
  const departDialog = asking === 'depart' && gm && !expedition && (
    <SheetScope.Provider value>
      <Dialog
        label={DEPART_LABEL}
        over={bandHeadingNow}
        onClose={() => {
          setAsking(null);
          setDepartPick(null);
          setNeedPlace(false);
        }}
      >
        <div className="depart-sheet">
          {/* Where? first and required (p2p-5, ⚑ 4): only Locations, grouped under their Area, where packs give any. */}
          <div className="depart-sheet__field">
            <span className="label" aria-hidden="true">
              Where?
            </span>
            <button type="button" className="button-secondary depart-sheet__where" aria-label={`Where?: ${whereShown ? [whereShown.name, whereShown.area].filter(Boolean).join(', ') : 'Pick a Location'}`} onClick={() => setPickingWhere(true)}>
              <StepIcon name="travel" size={24} />
              <span className="depart-sheet__where-words">
                <span className="depart-sheet__where-name">{whereShown?.name || 'Pick a Location'}</span>
                {whereShown?.area && <span className="depart-sheet__where-area">{whereShown.area}</span>}
              </span>
              <UiIcon name="chevron" size={20} />
            </button>
          </div>
          {/* "Exploration method" (p2p-5): the campaign's modes and Point to point, sharing the row; unset until Where? or a
              tap, a tap shown at once; a place picked after fills it in again (DG1's rule, latest wins). */}
          <div className="depart-sheet__field">
            <span className="label" aria-hidden="true">
              Exploration method
            </span>
            <ButtonRow label="Exploration method" sides small options={methods.map((m) => ({ value: m.id, label: m.name }))} value={departMode?.id ?? null} onChange={setDepartPick} />
          </div>
          {pickingWhere && (
            // The picker keeps its own Wide pop-up (docs/06, Place picker), not the sheet it opens from (#864's review).
            <SheetScope.Provider value={false}>
              <PlacePicker
                db={db}
                campaignId={campaign.id}
                title="Where?"
                over={DEPART_LABEL}
                locations
                picked={wherePicked?.kind === 'pack' ? wherePicked.place : null}
                recent={recentRows}
                current={null}
                onClose={() => setPickingWhere(false)}
                onPick={(picked) => {
                  setPickingWhere(false);
                  if (picked.kind === 'unnamed') return;
                  setWherePicked(picked);
                  const words = picked.kind === 'other' ? picked.name : picked.kind === 'place' ? placeWords(picked.place, packPlaces) : wordsFor(packPlaces ?? [picked.place], picked.place);
                  setPlaceText(words);
                  // The place fills in the method (p2p-5): a Location is point to point (`placeMethodOf`).
                  const fromPlace = picked.kind === 'pack' ? placeMethodOf(picked.place) : null;
                  if (fromPlace && methods.some((m) => m.id === fromPlace)) return setDepartPick(fromPlace);
                  // Else a place started in a mode before picks that mode again (DG1: a dungeon place picks Dungeon mode).
                  const name = picked.kind === 'other' ? picked.name : picked.place.name;
                  const before = recent.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
                  if (before && methods.some((m) => m.id === before.mode)) setDepartPick(before.mode);
                }}
              />
            </SheetScope.Provider>
          )}
          {needPlace && (
            // Start with nothing picked stays a button and says why (DP1, with Francis's fix: one sentence).
            <SheetScope.Provider value={false}>
              <Dialog label="Pick a Location first" onClose={() => setNeedPlace(false)}>
                <p className="reading">An expedition starts at a Location.</p>
                <div className="dialog__actions">
                  <StackedButton icon="check-mark" label="Got it" onClick={() => setNeedPlace(false)} />
                </div>
              </Dialog>
            </SheetScope.Provider>
          )}
          <div className="depart-sheet__foot">
            <StackedButton icon="campfire" label="Start" variant="primary" onClick={() => void depart()} />
          </div>
        </div>
      </Dialog>
    </SheetScope.Provider>
  );
  // The Weather sheet (S10, T6): the GM's, from the Weather fact or Waiting for you's "Weather: to roll".
  const weatherSheet = weatherOpen && gm && (
    <WeatherSheet
      db={db}
      user={user}
      view={weather.view}
      tables={tables}
      over={[bandDate.words, bandDate.season].filter(Boolean).join(', ')}
      onChanged={weather.reload}
      onClose={() => setWeatherOpen(false)}
      onWhichSeason={
        months.length > 0 && seasonsOf(months).length > 0
          ? () => {
              setWeatherOpen(false);
              askSeason();
            }
          : undefined
      }
    />
  );
  // Set the date (S10, T6): the band's date line while the date is unset, or while the clock hasn't moved.
  const dateSheet = asking === 'date' && gm && (asksDate || asksTime) && (
    <SetDateSheet
      months={months}
      start={asksDate ? { ask: true, from: startSaid } : { ask: false }}
      time={asksTime ? (startTimeOf(settings?.startTime) ?? DEFAULT_START_TIME) : null}
      hoursInDay={units.day && units.hour ? Math.floor(units.day / units.hour) : 24}
      minutesInHour={units.hour ? Math.floor(units.hour / 60) : 60}
      over={campaign.name}
      onSave={saveDateSheet}
      onClose={() => setAsking(null)}
    />
  );
  // Whether the GM's top shows whole (p2p-20): always between expeditions, where there is no fold mark.
  const topShown = !expedition || topOpen;
  const gmBand = (
    <BookFaces>
      <SceneBand
        over={sessionLine({ state: sessionNow, campaignName: campaign.name, sessionNumber: session?.number ?? scene.lastSession ?? null, region: regionName })}
        heading={bandHeadingNow}
        onHeading={procedureOpen && sessionNow !== 'none' ? () => setAsking('checklist') : undefined}
        date={bandDate}
        under={resumed ? `${resumed}.` : null}
        actions={bandActions}
        menu={menu}
        // p2p-20 (TF1, TF1b): during an expedition the facts, the strip and the encounter tables' row fold away behind
        // one mark; the band stays whole, a due fact one line in it. "Waiting for you" never folds.
        fold={expedition ? { open: topOpen, onToggle: () => setTopOpen(!topOpen), due: bandFacts } : null}
      />
      {/* Between expeditions the few facts stand centred (ap-8; T4, T5), never stretched. */}
      {topShown && <FactsRow facts={bandFacts} onOpen={openFact} centred={!expedition} />}
      {/* The strip, in every state of the Scene (S7, mc-53; page 16, T1 to T5, T8), unless the GM folded the top away. */}
      {topShown && <ProcedureStrip steps={strip.steps} onOpen={setStepOpen} />}
      {stepOpen && <RuleSheet placeName="" name={stepOpen.name} blocks={blocksOfRead(stepOpen.text)} onClose={() => setStepOpen(null)} />}
      {/* The band's own sheets, inside the book's faces with it (bs-1). */}
      {campDialog}
      {leaveDialog}
      {noCheckDialog}
      {whyDialog}
      {remindersDialog}
      {departDialog}
      {weatherSheet}
      {dateSheet}
    </BookFaces>
  );

  // The players' top (S15, st-7; page 16, T9a to T9e): the GM's band without its buttons or menu (players don't move
  // the clock), naming only what has been shown to them: the session line without the region (it waits for a player
  // read of the place's chain, as the strip's place steps do), the heading with the last place shown to their group
  // (mc-50, T9c), else the mode's name. Paused (T9b, T9e): today's words where the GM's button stands, and the page as
  // it was left. The same facts, the weather as its word; the strip as the mode or the rules set gives it.
  const playersBand = (
    <BookFaces>
      <SceneBand
        over={sessionLine({ state: sessionNow, campaignName: campaign.name, sessionNumber: session?.number ?? scene.lastSession ?? null, region: null })}
        heading={bandHeading({ state: sessionNow, place: expedition ? (shownPlaces.get(myGroupNumber) ?? null) : null, modeName: expedition && mode ? mode.name : null, step: expedition && mode ? stepOfLine(title, mode.name) : null, fallback: title })}
        onHeading={procedureOpen && sessionNow !== 'none' ? () => setAsking('checklist') : undefined}
        date={{ ...bandDate, onSet: undefined }}
        under={resumed ? `${resumed}.` : null}
        actions={sessionNow === 'paused' ? <p className="scene-band__paused">Session paused, waiting for the GM</p> : null}
      />
      <FactsRow facts={bandFacts} onOpen={openFact} centred={!expedition} />
      <ProcedureStrip steps={strip.steps} onOpen={setStepOpen} />
      {stepOpen && <RuleSheet placeName="" name={stepOpen.name} blocks={blocksOfRead(stepOpen.text)} onClose={() => setStepOpen(null)} />}
      {weatherOpen && <WeatherSheet db={db} user={user} view={weather.view} over={[bandDate.words, bandDate.season].filter(Boolean).join(', ')} onChanged={weather.reload} onClose={() => setWeatherOpen(false)} />}
      {/* A player's tap on Light, Rest or the Encounter check (P10; page 18, PL8): the state, then the rule where the
          player's copy of the setting has its words. The Rest prompt's ⓘ opens the same Rest pop-up. */}
      {lightAbout && (
        <LightFactSheet
          lines={lightSheetLines(lightGroups, stepWord)}
          // PL8: the player's one act here, lighting their own light as At hand does; none with nothing to light.
          view={tableView?.light ?? null}
          onClose={() => setLightAbout(false)}
          onLit={() => {
            refocusLight.current = true;
            setLightAbout(false);
          }}
        />
      )}
      {restAbout && bandRest && (
        <FactSheet title="Rest" lines={restSheetLines(bandRest, mode?.rest ? restEveryWords(mode.rest) : null)} rule={settingRule(restWords.filter((w) => w !== REST_ANSWER_WORDS), mode?.rest?.source)} onClose={() => setRestAbout(false)} />
      )}
      {asking === 'check' && bandCheck && <FactSheet title={bandCheck.label} lines={checkSheetLines(bandCheck)} rule={playersCheckRule} onClose={() => setAsking(null)} />}
    </BookFaces>
  );

  return (
    <section className="time-strip" aria-label="Time">
      {gm && !compact && <OfferMover mover={mover} check={moveCheck} />}
      {gm && gmBand}
      {!gm && playersBand}
      {/* The town switches' line stays until the sun and moon tile replaces it (plan S6). */}
      {switchesNow && <p className="time-strip__notes time-strip__switches">{switchesNow}</p>}
      {/* B7's fold went for players too (S15; st-2, T9b): a paused Scene stays as it was left, for everyone. */}
      {(
        <>
          {/* Set date, Set start time, Start and Resume session, Next turn and its Undo are the band's now (S1, S9);
              "+ Reminder" is the menu's Reminders (S3) and Leave the dungeon the band's door (S2). */}
          {/* Start expedition's mode, Where? and button went into the band's Depart sheet (S5, T6). The GM's weather
              card went into the Weather fact's sheet (S10, T6). */}

          {!gm && (
            <>
              {/* B18: the prompt slot, between the time band and the marching order (space reserved), newest on top
                  (SC-g6-4): the rest prompt, the screen's other prompts (a request, a message, No light), the weather;
                  what is there when the screen opens keeps that order. The calls to adventure come last, always (p7-9). */}
              <PromptSlot after={<CallsInPromptSlot calls={playerCalls.calls} onGotIt={playerCalls.gotIt} />}>
                {restViews.map((flow) => (
                  <RestPrompt
                    key={`rest-${flow.group}`}
                    promptId={`rest-${flow.group}-${flow.from}-${flow.called?.at ?? 'due'}`}
                    lines={restLines(flow).filter((l) => mineIds.includes(l.id))}
                    day={restDay}
                    summary={restSummary}
                    called={calledWords(flow)}
                    onAnswer={(id, answer) => void answerFor([id], answer)}
                    onRule={() => setRestAbout(true)}
                  />
                ))}
                {tableView?.prompts}
                {/* The players' weather card stays in their slot (the page under the top is page 18's plan); folded, its
                    icon by the date went with the old head (S15): the Weather fact says the weather and opens its sheet. */}
                <WeatherCard
                  key="weather"
                  db={db}
                  user={user}
                  view={weather.view}
                  onChanged={weather.reload}
                  folded={weatherFold.folded}
                  onFold={weatherFold.fold}
                />
              </PromptSlot>
              {tableView?.body(restButton, darkGroup)}
            </>
          )}

          {/* The hour track went with the strip (S7, S15, S18: page 16 draws no pips, for the GM or for players). */}
          {gm && notes && <p className="time-strip__notes">{notes}</p>}

          {/* With "Waiting for you" on the page its lines are items there (S8b); only the strip's quiet "<title>,
              nothing due" stays here. Without it (a town), today's card. */}
          {gm && (!waitingOn || cardItemsShown.length === 0) && (
            <ReminderCard
              // "nothing due" only when the last advance brought nothing; a card emptied by the GM just collapses. With the
              // panel, a burnt-out light (the toast's) counts as nothing here.
              title={notEnded(card).length === 0 && (notEnded(lastFresh).length > 0 || endedQuiet) ? null : cardTitle}
              // Once today's weather is in (from anyone's device), its line leaves the card (A8).
              card={cardItemsShown}
              stepSeconds={perStep}
              startedAt={expedition?.startedAt ?? null}
              stepWord={stepWord}
              pace={mode?.pace ?? 'turn'}
              roll={cardRoll}
              {...cardActions}
            />
          )}
          {waitingOn && <WaitingSource sourceKey="strip" items={[...restItems, ...lineItems]} />}
          {restSheetFlow && (
            <Dialog label={`${splitFlows ? `${groupName(restSheetFlow.group)}: ` : ''}Rest is due`} onClose={() => setRestSheet(null)}>
              <RestPanel
                flow={restSheetFlow}
                lines={restLines(restSheetFlow)}
                group={splitFlows ? groupName(restSheetFlow.group) : null}
                day={restDay}
                called={calledWords(restSheetFlow)}
                onFlip={(line) => void answerFor([line.id], flipped(line.answer))}
                onAll={(answer) => void answerFor(restSheetFlow.members, answer)}
                onRule={() => setRestAbout(true)}
              />
            </Dialog>
          )}
          {gm &&
            !waitingOn &&
            !restMinimised &&
            restViews.map((flow) => (
              <RestPanel
                key={flow.group}
                flow={flow}
                lines={restLines(flow)}
                group={splitFlows ? groupName(flow.group) : null}
                day={restDay}
                called={calledWords(flow)}
                onFlip={(line) => void answerFor([line.id], flipped(line.answer))}
                onAll={(answer) => void answerFor(flow.members, answer)}
                onMinimise={() => setRestMinimised(true)}
                onRule={() => setRestAbout(true)}
              />
            ))}
          {restAbout && (gm || !bandRest) && <RestRule head={bandRest ? `${bandRest.value}.${bandRest.sub && bandRest.sub !== restWords[0] ? ` ${bandRest.sub}` : ''}` : null} words={restWords} onClose={() => setRestAbout(false)} />}
          {lightAbout && gm && (
            <Dialog label="Light" onClose={() => setLightAbout(false)}>
              <p className="time-strip__notes">
                {lightMarks.some((m) => m.dark)
                  ? `No light. ${NO_LIGHT_WORDS}`
                  : gm
                    ? 'The lights lit and the time each has left. They burn down as the clock moves on.'
                    : 'Your light and the time it has left. It burns down as the GM moves the clock on.'}
              </p>
              {/* A tap on the Light fact lists every group (T7); a player's, their own group (S15, PL6): the value whole
                  (tv-1: the tile may cut it). */}
              {expedition && (
                <ul className="time-strip__went">
                  {factGroups.map((g) => {
                    const lit = litNow.filter((l) => g.ids.includes(l.id));
                    const words = darkGroups.includes(g)
                      ? 'No light'
                      : lit.length === 0
                        ? 'Nothing lit'
                        : lit
                            .map((l) => {
                              if (l.seconds === null || !perStep) return l.name;
                              const n = Math.max(1, Math.ceil((l.litAt + l.seconds - now) / perStep));
                              return `${l.name}, ${n} ${stepWord}${n === 1 ? '' : 's'}`;
                            })
                            .join('; ');
                    return <li key={g.number}>{factGroups.length > 1 ? `${groupName(g.number)}: ${words}` : words}</li>;
                  })}
                </ul>
              )}
            </Dialog>
          )}
          {gm && hit && !waitingOn && (
            <HitPanel
              line={hit.line}
              rowText={hit.result.rowText}
              onTables={tables.size > 0 ? () => setTablesOpen('hit') : undefined}
              onClose={() => {
                setHit(null);
                setTablesOpen(null);
              }}
              hidden={!hit.result.revealed}
              onReveal={() => void reveal()}
              onSend={messaging ? (words) => messaging.open({ kind: 'new', text: words }) : undefined}
            />
          )}
          {/* The cards are a source of "Waiting for you" (S8a, sceneWaiting.tsx): in its panel on the GM's place page;
              else here. */}
          {gm && expedition && (
              <EncounterWaitingSource
                cards={waiting}
                tables={tables}
                statBlock={statBlockRef}
                when={(at) => (perStep ? `${stepWord.charAt(0).toUpperCase()}${stepWord.slice(1)} ${elapsedSteps(at, expedition.startedAt, perStep)}` : null)}
                onStart={startWaiting}
                onDismiss={(card) => void dismissWaiting(card)}
                watchChoices={watchChoicesFor}
                onWatch={(card, watch) => void setWatch(card, watch)}
                // The first action of "Waiting for you" is the accent while a session runs (st-2, W1; accentOwner).
                accent={owner === 'waiting'}
                lead={waitingOn ? hitItems : []}
              />
          )}
          {gm && expedition && topShown && (
            <EncounterTablesRow
              likely={likelyId ? (tables.get(likelyId)?.name ?? null) : null}
              pins={exploreList.rows.filter((r) => r.pinned).length}
              none={tables.size === 0}
              onOpen={() => setTablesOpen('explore')}
            />
          )}
          {/* One way to the tables in the band (the approval's fix 3, 2026-11-18): during an expedition the Encounter
              tables row, with the library ("Table library ›", the pins) at the foot of its screen; without one, the library. */}
          {gm && !expedition && tablesLibrary}
          {gm && tablesOpen && (
            <EncounterTables
              key={tablesOpen === 'hit' && hit ? hit.result.id : 'explore'}
              title={tablesOpen === 'hit' && hit ? `${hit.line.name}, Hit` : 'Encounter tables'}
              meta={expedition && perStep ? `${stepWord.charAt(0).toUpperCase()}${stepWord.slice(1)} ${elapsedSteps(now, expedition.startedAt, perStep)}` : undefined}
              context={tablesOpen === 'hit' && hit ? `${hit.line.name}, Hit` : 'Rolled by hand'}
              list={(tablesOpen === 'hit' ? hitList : exploreList).rows}
              missing={(tablesOpen === 'hit' ? hitList : exploreList).missing}
              tables={tables}
              column={tablesOpen === 'hit' ? hitColumn : sceneColumn}
              describe={describeRow}
              terrain={groundNow}
              onTap={(tap, unlight) => void tapRow(tap, unlight)}
              onClose={() => setTablesOpen(null)}
              library={tablesOpen === 'explore' ? tablesLibrary : undefined}
            />
          )}

          {!gm && <PlayerReference reminders={reminders ?? []} />}

          {gm && downtimeBegan !== 'none' && inDowntime && (
            <div className="time-strip__end" role="status">
              <div className="time-strip__end-head">
                <h3 className="label">Downtime began</h3>
                <CloseButton onClose={() => setDowntimeBegan('none')} />
              </div>
              <div className="time-strip__controls">
                <button type="button" className="button-secondary" onClick={() => void undoLatest('downtime.start', () => setDowntimeBegan('none'))}>
                  Undo
                </button>
              </div>
              <FullRestPanel db={db} user={user} campaign={campaign} setting={setting} who={downtimeBegan} none="No characters in play." />
            </div>
          )}
          {/* The card after an expedition ends (S19): an item of "Waiting for you", first of all; drawn here while no panel shows. */}
          {endItems.length > 0 && <WaitingSource sourceKey="end" items={endItems} />}

          {/* A player's tap on the part of the day: its words, nothing to do (S15). */}
          {asking === 'part' && bandPart && (
            <Dialog label={bandPart.label} onClose={() => setAsking(null)}>
              <p className="time-strip__notes">{`${bandPart.value}. ${bandPart.sub ?? ''}`.trim()}</p>
            </Dialog>
          )}
          {/* Advance by… moves the clock: the GM's alone (S15). */}
          {asking === 'by' && gm && clock && (
            <AdvanceByDialog
              units={units}
              now={now}
              forward={!!(expedition && mode)}
              onClose={() => setAsking(null)}
              onConfirm={(value, unit) => {
                setAsking(null);
                void withSeason((engine) => advanceBy(engine, { value, unit }), `${value} ${unit}${value === 1 ? '' : 's'}`, advanceTimeBy);
              }}
              onSetTime={async (to) => {
                setAsking(null);
                // A correction (05, Set time…, folded into Advance by… at the M5 gate, B12): nothing in the procedure
                // runs; timers and lights move with the clock, and what runs out ends quietly with one line (the database
                // burns the lights out in the same request, so the log line says it too), and so are status timers.
                const correction = correctTime({ now, lights: lights ?? [], effects: [], statuses: engineStatuses(liveStatuses, statusSecrets, now, nameOf) }, to);
                const moved = await act(setTime, { campaignId: campaign.id, clock, to });
                const ranOut = correction ? ranOutLine(correction) : null;
                if (moved) show({ text: `Set the time to ${clockWords(to, units)}${ranOut ? `, ${ranOut}` : ''}`, onUndo: () => void undoLatest('time.set') });
              }}
            />
          )}
          {asking === 'day' && clock && (
            <ToDayDialog
              today={Math.floor(now / units.day!) + 1}
              onClose={() => setAsking(null)}
              onConfirm={(day) => {
                setAsking(null);
                void downtime((day - (Math.floor(now / units.day!) + 1)) * units.day!, `to day ${day}`);
              }}
            />
          )}
          {seasonDialog}
          {/* The Encounter check fact's tap (S4): the check in force, to read; checking now is the band's Encounter check (S2). */}
          {asking === 'check' && bandCheck && gm && (
            <Dialog label={bandCheck.label} onClose={() => setAsking(null)}>
              <p className="time-strip__notes">
                <DiceWords>{`${bandCheck.value}${bandCheck.sub ? `, ${bandCheck.sub}` : ''}.`}</DiceWords>
              </p>            </Dialog>
          )}
          {asking === 'checklist' && mode && <ProcedureList mode={mode} card={card} recorded={recorded} gm={gm} onClose={() => setAsking(null)} />}
          {rollFor && (
            <Dialog label={rollFor.name} onClose={() => setRollFor(null)}>
              {!rollFor.tableId && (rollFor.tableChoices?.length ?? 0) > 0 ? (
                // No season yet (Not now on "Which season?", ruled 2026-10-30): the GM picks one of the weather tables.
                <WeatherPick tables={rollFor.tableChoices!.flatMap((id) => tables.get(id) ?? [])} missing={rollFor.tableChoices!.filter((id) => !tables.has(id))} />
              ) : rollFor.tableId && tables.get(rollFor.tableId) ? (
                <TableRoll table={tables.get(rollFor.tableId)!} column={null} onRead={() => undefined} />
              ) : (
                <p className="time-strip__notes">{`This step's table (${rollFor.tableId ?? 'none'}) isn't in your setting rules. Read it from your book.`}</p>
              )}
            </Dialog>
          )}
          {recharging && (
            <Dialog label={recharging.line.name} onClose={() => setRecharging(null)}>
              <RollPrompt
                label="Charges back"
                expression={recharging.line.recharge?.amount ?? '1'}
                onRolled={(result) => {
                  const { line, item } = recharging;
                  setRecharging(null);
                  void rechargeNow(line, item, result, `${line.recharge?.amount ?? ''} → ${result}`);
                }}
                onCancel={() => setRecharging(null)}
              />
            </Dialog>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The weather with no season known (ruled 2026-10-30): the GM picks one of the setting's weather tables (the
 * Encounter table panel's table pick, titled for the weather), then types the roll.
 */
function WeatherPick({ tables, missing }: { tables: ReadTable[]; missing: string[] }) {
  if (tables.length === 0) {
    return <p className="time-strip__notes">{`The weather tables (${missing.join(', ')}) aren't in your setting rules. Read it from your book.`}</p>;
  }
  return (
    <>
      <p className="time-strip__notes">No season yet: pick the weather table for today.</p>
      <WeatherTablePick tables={tables} />
    </>
  );
}

/** The weather table variant (2026-10-30): the GM picks one of the weather tables, then types the roll to read its row. */
function WeatherTablePick({ tables }: { tables: ReadTable[] }) {
  const [picked, setPicked] = useState<string | null>(tables.length === 1 ? tables[0]!.id : null);
  const table = tables.find((t) => t.id === picked) ?? null;
  return (
    <>
      {tables.length > 1 && <ButtonRow label="Weather table" options={tables.map((t) => ({ value: t.id, label: t.name }))} value={picked} onChange={setPicked} />}
      {table && <TableRoll key={table.id} table={table} column={null} onRead={() => undefined} />}
    </>
  );
}

/** The mode's main advance: a tap runs it once; a long press asks how many. `quiet`: secondary (the compact strip). */
/** The mode's main advance (Next turn). One tap is one step; several turns pass by tapping again (A6: no +N). */
function MainAdvance({ label, quiet = false, plain = false, onTap }: { label: string; quiet?: boolean; plain?: boolean; onTap: () => void }) {
  // `plain`: full size but not the accent, while the GM's place page holds it with Move on (5b, page 11).
  return (
    <button type="button" className={quiet ? 'button-secondary time-strip__next time-strip__next--compact' : plain ? 'button-secondary time-strip__next' : 'button-primary time-strip__next'} onClick={onTap}>
      {label}
    </button>
  );
}

/**
 * Leave the dungeon (DG17, DG18; redrawn on page 16, T6b, st-4, st-8): a sheet with the two ways as stacked buttons,
 * each with its line beside it, in today's words: Ask for escape rolls (the roll, and how many levels below the first
 * when the rule counts depth; T3) and Use safe paths (the pack's note; logged once per expedition, sq-2). Where the
 * app can't tell whether the party is at a way out, a first row leaves at once (`atWayOutRow`). Opened from End
 * expedition it also offers to end without rolls. A rule with no escape roll (of-5, G-104) offers Use safe paths only.
 */
function LeaveDialog({
  rule,
  over,
  ending,
  atWayOutRow,
  onLeave,
  onAsk,
  onEnd,
  onSafePaths,
  onClose,
}: {
  rule: DungeonExit;
  /** The band's heading, over the title (T6b). */
  over: string;
  ending: boolean;
  /** CAN'T TELL (st-4, case c): "The party is at a way out" first, which leaves at once. */
  atWayOutRow: boolean;
  onLeave: () => void;
  onAsk: (levelsDown: number) => void;
  onEnd: () => void;
  /** Use safe paths was tapped (sq-2: logged once per expedition, with Undo). */
  onSafePaths: () => void;
  onClose: () => void;
}) {
  // The first level is 0 below it (sq-1): 1 is the second level, and the modifier reads from there.
  const [levels, setLevels] = useState(0);
  const depth = depthModifier(rule, levels);
  const who = rule.who === 'party' ? 'one roll for the party' : 'one roll each';
  const roll = rule.roll;
  return (
    <SheetScope.Provider value>
      <Dialog label="Leave the dungeon" over={over} onClose={onClose}>
        {atWayOutRow && (
          <button type="button" className="button-secondary leave-ways__out" onClick={onLeave}>
            <span>The party is at a way out</span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        {!roll && <p className="time-strip__notes">Your rules have no escape roll: the party leaves by safe paths.</p>}
        <ul className="leave-ways">
          {roll && (
            <li className="leave-ways__row">
              <StackedButton icon="run" label="Ask for escape rolls" onClick={() => onAsk(levels)} />
              <div className="leave-ways__line">
                <p className="time-strip__notes">{`${'save' in roll ? `Save: ${roll.save}` : `Check: ${roll.check}`}, ${who}. Players enter their rolls; you send each outcome from Players.`}</p>
                {rule.depth && <Stepper label={DEPTH_LABEL} value={levels} min={0} max={99} onChange={setLevels} />}
                {rule.depth && <p className="time-strip__notes">{`${depthWords(levels)}: ${depth === 0 ? 'no change' : depth > 0 ? `+${depth}` : `−${-depth}`}`}</p>}
              </div>
            </li>
          )}
          {rule.safePaths && (
            <li className="leave-ways__row">
              <StackedButton icon="trail" label="Use safe paths" onClick={onSafePaths} />
              <p className="time-strip__notes leave-ways__line">{rule.safePaths}</p>
            </li>
          )}
        </ul>
        {ending && roll && (
          <ActionBar>
            <button type="button" className="button-secondary button-secondary--small" onClick={onEnd}>
              End without rolls
            </button>
          </ActionBar>
        )}
      </Dialog>
    </SheetScope.Provider>
  );
}

/** A whole number typed with the number pad; null when it isn't one. */
const wholeOf = (text: string) => (/^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : null);

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="field__input" inputMode="numeric" pattern="[0-9]*" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Advance by… (05; Set time… folded in at the M5 gate, B12): one sheet. **Forward by** an amount runs the procedure
 * for each step that passes (a normal advance, during an expedition); **To a time** is the logged correction, for
 * genuine mistakes (ruled 2026-10-29): timers and lights move with the clock; moving back, burnt-out lights and ended
 * statuses stay gone, and Undo reverses a move exactly. Outside an expedition only To a time is offered.
 */
function AdvanceByDialog({
  units,
  now,
  forward,
  onClose,
  onConfirm,
  onSetTime,
}: {
  units: TimeUnits;
  now: number;
  /** Forward by an amount is offered (an expedition is under way). */
  forward: boolean;
  onClose: () => void;
  onConfirm: (value: number, unit: string) => void;
  onSetTime: (to: number) => void;
}) {
  const [how, setHow] = useState<'forward' | 'to'>(forward ? 'forward' : 'to');
  return (
    <Dialog label="Advance by…" onClose={onClose}>
      {forward && (
        <ButtonRow
          label="How"
          options={[
            { value: 'forward', label: 'Forward by…' },
            { value: 'to', label: 'To a time' },
          ]}
          value={how}
          onChange={setHow}
        />
      )}
      {how === 'forward' ? <ForwardBy units={units} onConfirm={onConfirm} /> : <ToATime units={units} now={now} onConfirm={onSetTime} />}
    </Dialog>
  );
}

/** Forward by an amount and a unit ("40 minutes"): the procedure runs for each step that passes. */
function ForwardBy({ units, onConfirm }: { units: TimeUnits; onConfirm: (value: number, unit: string) => void }) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('minute');
  const [problem, setProblem] = useState<string | null>(null);
  const choices = ['minute', 'turn', 'hour', 'day'].filter((u) => units[u] !== undefined);
  return (
    <>
      <NumberField label="How much" value={amount} onChange={setAmount} />
      <ButtonRow label="Unit" options={choices.map((u) => ({ value: u, label: `${u}s` }))} value={unit} onChange={setUnit} />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            const value = wholeOf(amount);
            if (!value) return setProblem('Type a whole number above 0, like 40.');
            onConfirm(value, unitName(unit, units));
          }}
        >
          {wholeOf(amount) ? `Advance ${wholeOf(amount)} ${unit}${wholeOf(amount) === 1 ? '' : 's'}` : 'Advance'}
        </button>
      </ActionBar>
    </>
  );
}

/** To a time: a correction (the old Set time…): the day, hour and minute; nothing in the procedure runs. */
function ToATime({ units, now, onConfirm }: { units: TimeUnits; now: number; onConfirm: (to: number) => void }) {
  const day = units.day!;
  const hour = units.hour!;
  const [days, setDays] = useState(String(Math.floor(now / day) + 1));
  const [hours, setHours] = useState(String(Math.floor((now % day) / hour)));
  const [minutes, setMinutes] = useState(String(Math.floor((now % hour) / 60)));
  const [problem, setProblem] = useState<string | null>(null);
  const d = wholeOf(days);
  const h = wholeOf(hours);
  const m = wholeOf(minutes);
  // The time typed so far, when it reads (for the backwards line); null while it doesn't.
  const typed = d && d >= 1 && h !== null && h * 3600 < day && m !== null && m * 60 < hour ? (d - 1) * day + h * hour + m * 60 : null;
  return (
    <>
      <p className="time-strip__notes">A correction, for mistakes: nothing in the procedure runs. Timers and lights move with the clock.</p>
      <NumberField label="Day" value={days} onChange={setDays} />
      <NumberField label="Hour" value={hours} onChange={setHours} />
      <NumberField label="Minute" value={minutes} onChange={setMinutes} />
      {typed !== null && typed < now && <p className="time-strip__notes">Burnt-out lights and ended statuses stay gone. Use Undo to reverse a move exactly.</p>}
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (!d || d < 1) return setProblem('The day starts at 1.');
            if (h === null || h * 3600 >= day) return setProblem(`The hour is a whole number from 0 to ${Math.floor(day / 3600) - 1}.`);
            if (m === null || m * 60 >= hour) return setProblem(`The minute is a whole number from 0 to ${Math.floor(hour / 60) - 1}.`);
            onConfirm((d - 1) * day + h * hour + m * 60);
          }}
        >
          Set the time
        </button>
      </ActionBar>
    </>
  );
}

function ToDayDialog({ today, onClose, onConfirm }: { today: number; onClose: () => void; onConfirm: (day: number) => void }) {
  const [day, setDay] = useState(String(today + 1));
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Dialog label="To day…" onClose={onClose}>
      <NumberField label="Day" value={day} onChange={setDay} />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <ActionBar>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            const d = wholeOf(day);
            if (!d || d <= today) return setProblem(`It's day ${today} now: pick a later day.`);
            onConfirm(d);
          }}
        >
          {wholeOf(day) ? `Go to day ${wholeOf(day)}` : 'Go to day'}
        </button>
      </ActionBar>
    </Dialog>
  );
}

/** "Took 3 hours." or "No time passed.": the end card's line and its toast's (S19). */
function tookWords(expedition: Expedition): string {
  const took = expedition.summary?.seconds ?? 0;
  return took > 0 ? `Took ${timeWords(took)}.` : 'No time passed.';
}

/**
 * The end of an expedition (D22), as the end card (S19, `EndCard`): how long it took, with Undo in its head; In a safe
 * place? (`safePlace`'s children); Full rest as one tap (D23; the rest prompt first where someone who went has magic or
 * a once-a-rest power, dec-8 piece D), then the full rest's lines with the setting's healing rule and Heal for each
 * character who went; Done. Escape rolls (a dungeon-exit rule, the pack's `dungeonExit`) come before it (M5 step 12).
 */
function EndSummary({
  db,
  user,
  campaign,
  expedition,
  setting,
  act,
  accent,
  onUndo,
  onAnswer,
  onDone,
  staying,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  expedition: Expedition;
  setting: CampaignSetting | null;
  act: <I, T, O>(command: Command<I, T, O>, input: I) => Promise<O | null>;
  /** The item holds the page's accent (Full rest, then Done). */
  accent: boolean;
  onUndo: () => void;
  /** In a safe place? answered (or changed): Yes or No. */
  onAnswer: (safe: boolean) => void;
  onDone: () => void;
  /** After Yes to In a safe place?: Staying a while? · Start downtime · Not yet. */
  staying: ReactNode;
}) {
  const logVersion = useLogVersion();
  const [rested, setRested] = useState(expedition.summary?.fullRest === true);
  const [went, setWent] = useState<WentCharacter[] | null>(null);
  // The rest prompt's characters while it is open (dec-8 piece D).
  const [asking, setAsking] = useState<Rester[] | null>(null);
  // Who the rest prompt left out (on ✕), named in the full rest's line (mm-8).
  const [leftOut, setLeftOut] = useState<string[]>([]);
  // ✓ casters whose spells were refused after the full rest went through, named in the same line (#790 review).
  const [notBack, setNotBack] = useState<string[]>([]);
  const show = useToast();

  useEffect(() => {
    let current = true;
    void loadWhoWent(db, expedition.whoWent).then((found) => current && setWent(found ?? []));
    return () => {
      current = false;
    };
  }, [db, expedition.whoWent, logVersion]);

  const entry = (kind: string, id: string | null) => (id ? (setting?.all.find((e) => e.kind === kind && e.packEntryId === id)?.data ?? null) : null);

  async function rest() {
    // The rest prompt (dec-8 piece D, mp-5) when someone who went has magic or a once-a-rest power; otherwise the
    // full rest at once, as before (D23).
    const resters = await loadRestCharacters(db, setting, expedition.whoWent);
    // Unread, nothing is applied: the old full rest would skip the prompt without saying why.
    if (!resters) return show({ text: REST_READ_FAILED, error: true });
    if (restListed(resters).length > 0) return setAsking(resters);
    const refills = restRefills((went ?? []).map((w) => ({ id: w.ref.id, level: w.level, klass: entry('class', w.classRef), race: entry('race', w.raceRef) })));
    const done = await act(fullRest, { campaignId: campaign.id, expedition, refills });
    if (done) setRested(true);
  }

  return (
    <EndCard
      took={tookWords(expedition)}
      accent={accent}
      rested={rested}
      onRest={() => void rest()}
      onUndo={onUndo}
      onDone={onDone}
      safePlace={
        <>
          <SafePlaceQuestion answer={expedition.endedSafe} onAnswer={onAnswer} />
          {staying}
        </>
      }
    >
      {asking && (
        <NightRestSheet
          rows={restListed(asking)}
          names={new Map(asking.map((r) => [r.rest.id, r.name]))}
          onClose={() => setAsking(null)}
          onApply={async (marks) => {
            setAsking(null);
            // Read again: a change made while the sheet was open (a player's Prepare, the GM's set) is kept (#790 review).
            const resters = await loadRestCharacters(db, setting, expedition.whoWent);
            if (!resters) return show({ text: REST_READ_FAILED, error: true });
            const result = await applyNightRest({
              resters,
              marks,
              act,
              fullRest: async (refills) => (await act(fullRest, { campaignId: campaign.id, expedition, refills })) !== null,
            });
            if (result.done) {
              setLeftOut(restLeftOut(restListed(resters), marks, new Map(resters.map((r) => [r.rest.id, r.name]))));
              setNotBack(result.notBack);
              setRested(true);
            }
          }}
        />
      )}
      {rested && <FullRestPanel db={db} user={user} campaign={campaign} setting={setting} who={went} none="No characters went." leftOut={leftOut} notBack={notBack} />}
    </EndCard>
  );
}

/**
 * A full rest's lines (D23, and Start downtime's, M5b step 6a), built once for both: `RestLines` (the rest's line, the
 * setting's healing rule with its source, a row a character, who went or everyone in play, with Heal; "Everyone is at
 * full hit points." when nobody is hurt; S19), and Heal's damage-or-heal pad.
 */
function FullRestPanel({
  db,
  user,
  campaign,
  setting,
  who,
  none,
  leftOut = [],
  notBack = [],
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  setting: CampaignSetting | null;
  who: WentCharacter[] | null;
  none: string;
  /** Who the rest prompt left out (on ✕), named in the line (mm-8); none for Start downtime's. */
  leftOut?: readonly string[];
  /** ✓ casters whose spells were refused after the full rest, named in the line too. */
  notBack?: readonly string[];
}) {
  const show = useToast();
  const [healing, setHealing] = useState<WentCharacter | null>(null);
  const card = who === null ? null : endCardRows(who);
  return (
    <>
      <RestLines
        line={restLine(leftOut, notBack)}
        healing={healingWithSource(setting)}
        rows={card?.rows ?? null}
        everyoneFull={card?.everyoneFull ?? false}
        none={none}
        onHeal={(id) => setHealing(who?.find((w) => w.ref.id === id) ?? null)}
      />
      {healing && (
        <Dialog label="Damage or heal" onClose={() => setHealing(null)}>
          <DamagePad
            target={healing.name}
            start={1}
            healing
            onConfirm={async (amount, heal) => {
              const was = healing.hpCurrent ?? healing.hpMax ?? 0;
              const hp = heal ? (healing.hpMax === null ? was + amount : Math.max(was, Math.min(healing.hpMax, was + amount))) : was - amount;
              setHealing(null);
              const saved = await runCommand(registry, db, user, setHp, { character: healing.ref, hpCurrent: hp });
              if (!saved.ok) show({ text: saved.message, error: true });
              else
                show({
                  text: heal ? `Healed ${amount}, HP ${hp}` : `Took ${amount} damage, HP ${hp}`,
                  onUndo: async () => {
                    const eventId = await latestChange(db, campaign.id, 'character.setHp', user.id);
                    if (eventId) await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
                  },
                });
            }}
          />
        </Dialog>
      )}
    </>
  );
}

/** Offers the GM's full strip's mover and the move's check to Move on (sceneMove.tsx), anew each render; draws nothing. */
function OfferMover({ mover, check }: { mover: SceneMover; check: MoveCheck | null }) {
  useSceneMoverListener(mover, check);
  return null;
}

/** The clock's moves that run the procedure: the main advance (or Next part of day) and Advance by…. */
type ClockCommand = typeof advanceTime | typeof advanceTimeBy | typeof nextPartOfDay;

/** Move on (5b-0): a move between linked places, run as the clock's advance by its turns (pt-f2). */
type MoveCommand = { moveOn: { placeId: string; turns: number; way: MoveRequest['way']; throughCheck: MoveRequest['throughCheck'] } };
