// One table of permission cases, used twice:
//   * src/testing/permissionCases.test.ts checks the app's can() against it (fast, no database);
//   * supabase/tests/commands.test.ts runs every case for real against the test project.
// So if can() and the database's access rules ever disagree, a test fails.
import type { Command, CommandResult, CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import {
  answerInvitation,
  askToJoin,
  cancelInvitation,
  clearSigil,
  createCampaign,
  createCompany,
  createInvite,
  deleteCompany,
  foundCompany,
  inviteToCompany,
  redeemInvite,
  renameCompany,
  renameProfile,
  restoreCampaign,
  retireCampaign,
  revokeInvite,
  setActiveCharacter,
  setSigil,
  updateCampaign,
} from '../core/campaignCommands.ts';
import {
  archiveCharacter,
  assignCompany,
  createCharacter,
  deleteCharacter,
  editCharacter,
  reassignCharacter,
  restoreCharacter,
  resubmitCharacter,
  reviewCharacter,
  sendCharacter,
  type Approval,
  type CharacterRef,
} from '../modules/characters/commands.ts';
import { createField, deleteField, reorderFields, updateField, applySheetLayout } from '../modules/characters/fields.ts';
import { setHp } from '../modules/characters/hp.ts';
import { clearPortrait, setPortrait } from '../modules/characters/portraits.ts';
import { undoChange } from '../core/undo.ts';
import { addNote, editNote } from '../core/notes.ts';
import { copyHomebrewToLibrary, deletePack, editPackEntry, importPack, updatePack } from '../modules/library/library.ts';
import { attachPack, detachPack, moveSettingRules, preferEntry, setPackOptions, startHomebrew } from '../modules/library/campaignPacks.ts';
import { deleteHomebrewEntry, saveHomebrewEntry } from '../modules/library/homebrew.ts';
import { readPackJson, type ReadPack } from '../modules/library/packFile.ts';
import { sendHook } from '../modules/library/callsToAdventure.ts';
import { giveRumour } from '../modules/library/rumours.ts';
import { resetStock, setStock } from '../modules/requests/shopStock.ts';
import { addItem, approveItem, declineItem, editItemLook, emptyContainer, equipAnyway, equipItem, giveAway, hideFromAtHand, moveItem, noteRuleSkipped, pinItem, removeItem, revealItemField, setBaseArmour, setItemQty, setWeaponMode, tellItem, useItem, type CarrierRef, type ItemCopy } from '../modules/inventory/inventory.ts';
import { arrangeScreen } from '../modules/characters/screenLayout.ts';
import { movePin, pinToAtHand } from '../modules/characters/pins.ts';
import { prepareSpells, setAc, setForm, useAbility } from '../modules/characters/playState.ts';
import { castSpell, chooseSpells, sameAsYesterday, setSpells, uncastSpell } from '../modules/characters/magicState.ts';
import { recordRoll } from '../core/rolls.ts';
import { DEFAULT_TIME } from '../core/campaignSettings.ts';
import { timeUnits } from '../modules/expedition/clock.ts';
import { recharge, revealCharges, revealSpent, setCharges, useCharge } from '../modules/inventory/charges.ts';
import {
  advanceTime,
  advanceTimeBy,
  endExpedition,
  endDowntime,
  nextPartOfDay,
  startDowntime,
  endSession,
  fullRest,
  leaveBySafePaths,
  answerSafePlace,
  passDowntime,
  seasonNotNow,
  setStartTime,
  setTime,
  startExpedition,
  startSession,
  type Clock,
  type Expedition,
  type Session,
} from '../modules/expedition/play.ts';
import { addReminder, editReminder, recordCheck, recordCheckAgain, recordCheckNow, revealCheck, setCheckRoll, type CheckResult, type Reminder, type ReminderFields } from '../modules/expedition/reminderPlay.ts';
import { douseLight, keepLightLit, lightLight, refillLight, type LightOption } from '../modules/expedition/lightPlay.ts';
import { pinTable, readTableByHand, unpinTable, type TablePin } from '../modules/expedition/tablePins.ts';
import { dismissEncounter, queueEncounter, setEncounterWatch, startEncounter, type WaitingEncounter } from '../modules/expedition/encounterPlay.ts';
import { applyActivity, undoActivity } from '../modules/expedition/activityPlay.ts';
import { addCampFuel, applyCamps, campSleep, campTalk, cookAtCamp, eatAtCamp, openCamp, setCampWatches } from '../modules/expedition/campPlay.ts';
import { enterLostRoll, forceMarch, resolveLost, setLost, setTravelBudget, spendTravelDay, startTravelDay, travelMove, type GroupLost, type TravelGroup } from '../modules/expedition/travelPlay.ts';
import { resetTownSwitches, setActiveNight, setOutDay } from '../modules/expedition/townPlay.ts';
import { setCarryingTreasure } from '../modules/inventory/treasureSwitch.ts';
import { correctWeather, enterWeather, type WeatherRoll, type WeatherRolledBy } from '../modules/expedition/weatherPlay.ts';

/** Today's weather for an expedition's first day, rolled on the invented table (M5b cases). */
const weatherEntry = (w: { campaignId: string; expeditionId: string; tableId: string }, rolledBy: WeatherRolledBy) => ({
  campaignId: w.campaignId,
  expeditionId: w.expeditionId,
  period: 0,
  startsAt: 0,
  tableId: w.tableId,
  roll: '2',
  rolledBy,
});
import { chooseGroup, joinUp } from '../modules/expedition/groupPlay.ts';
import {
  applyMarchingPreset,
  deleteMarchingPreset,
  lockMarchingOrder,
  saveMarchingPreset,
  setMarchingOrder,
  type MarchingOrder,
  type MarchingTarget,
} from '../modules/expedition/marchingPlay.ts';
import type { Rows } from '../core/marchingRows.ts';
import { addStatus, chooseRest, pushOn, removeStatus, setStatusTime, stepStatus, type CharacterStatus, type NewStatus } from '../modules/expedition/statusPlay.ts';
import { answerRest, callRest } from '../modules/expedition/restFlow.ts';
import { addPiece, backAtPlace, editPiece, editPlace, hideAllPieces, hidePiece, removePiece, setPlace, showPiece, type GroupPlace } from '../modules/expedition/placePlay.ts';
import { addPlacePicture, setPlacePicture } from '../modules/expedition/placePicture.ts';
import { addPlaceMap, setPlaceMap, shareMap } from '../modules/expedition/placeMap.ts';
import { placeFromPack, type PackPlaceEntry } from '../modules/expedition/placeFromPack.ts';
import { setCheckInForce, setRuleEye } from '../modules/expedition/placeRules.ts';
import { setPlaceSafety } from '../modules/expedition/placeSafety.ts';
import { moveOn } from '../modules/expedition/placeMove.ts';
import { openTownPlace, showTownPlace } from '../modules/expedition/townPlaces.ts';
import { hideTownPiece, showTownPiece } from '../modules/expedition/townParts.ts';
import { readMessages, sendMessages } from '../modules/messages/messages.ts';
import { markFindsSeen } from '../modules/characters/findsSeen.ts';
import { answerRequest, askRequests, enterRequest, sendRequest, withdrawRequest, type Request } from '../modules/requests/requests.ts';
import { approveSheetChange, HP_MAX_FIELD, refuseSheetChange, requestSheetChange, takeBackSheetChange, type SheetChange } from '../modules/characters/sheetChanges.ts';
import { chooseStay, replyRequest, undoBuy } from '../modules/requests/townRequests.ts';
import { setSpellBook } from '../modules/characters/spellBook.ts';
import { giveFind, undoFind } from '../modules/expedition/findSend.ts';
import { addCoin, giveCoin, removeCoin, spendCoin, takeCoin, type Coins, type TakeFrom } from '../modules/inventory/purse.ts';
import { redoCreation, type RedoChoice } from '../modules/characters/redo.ts';

/** An invented re-walk's end (follow-up C): the same class as before, two scores typed. */
const redoChoice: RedoChoice = { classRef: 'lantern-warden', raceRef: null, method: null, rolled: { GRT: 9, WIT: 12 }, scores: { GRT: 9, WIT: 12 } };

/** An invented reminder and check for the M5 step 6 cases. */
const reminderFields: ReminderFields = {
  label: 'Listen for bog lurkers',
  kind: 'check',
  encounterCheck: true,
  every: { value: 2, unit: 'turn' },
  isPublic: false,
  chance: { die: 'd6', on: [1] },
  tableId: null,
  note: null,
};
const checkRecord = { checkKey: 'gm:listen', name: 'Listen for bog lurkers', source: 'gm' as const, outcome: 'hit' as const, modifiers: [] };

/** A tiny invented pack for the library cases. */
function tinyPack(): ReadPack {
  const read = readPackJson(
    JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Pocket Rules' }, items: [{ id: 'rope', name: 'Rope' }] }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

/** Gather reeds for a group with Wren acting, a point off the budget and nothing found (M5b step 3). */
const gatherInput = (w: CaseWorld, group: number) => ({
  // Not in the case world's setting rules, so it reads as an activity one character does (ac-1): Wren is Player A's.
  target: { campaignId: w.campaignId, group, mine: true, who: 'one' as const, ownersNamed: [w.userId('playerA')] },
  activity: { id: 'gather-reeds', name: 'Gather reeds' },
  actorIds: [w.wren.id],
  finderId: w.wren.id,
  rolls: [],
  outcome: 'done' as const,
  spend: 1,
  yield: null,
});

/** A tiny invented picture for the portrait and sigil cases. */
const picture = () => new Blob(['an invented picture'], { type: 'image/jpeg' });

export type Who = 'gm' | 'playerA' | 'playerB' | 'outsider' | 'newcomer';

/** The invented campaign the cases run in (real rows in the database test, made-up ids in the app test). */
export interface CaseWorld {
  campaignId: string;
  companyId: string;
  userId(who: Who): string;
  wren: CharacterRef; // Player A's approved character
  ash: CharacterRef; // Player B's approved character
  freshCompany(): Promise<string>;
  freshCharacter(owner: 'playerA' | 'playerB', approval: Approval, archived?: boolean): Promise<CharacterRef>;
  freshInvite(): Promise<{ id: string; code: string }>;
  /** A new, unused text field in the campaign. */
  freshField(): Promise<{ id: string; campaignId: string; key: string }>;
  /** Two fresh trait pins on that character, its pins list replaced by them (row P2's moves): their keys, in order. */
  freshPins(on: 'wren' | 'ash'): Promise<string[]>;
  /** A logged HP change this person just made (to Player A's character; Player B's own when it's Player B). */
  freshChange(by: 'gm' | 'playerA' | 'playerB'): Promise<{ campaignId: string; eventId: string; authorUserId: string | null }>;
  /** A pack in this person's library. */
  freshPack(owner: 'gm' | 'playerA'): Promise<{ packId: string; ownerUserId: string }>;
  /** One of the GM's packs, attached to the campaign, on top of its stack. */
  freshAttachedPack(): Promise<{ campaignPackId: string; packId: string; ownerUserId: string }>;
  /** A condition in the campaign's own homebrew (its id). */
  freshHomebrewEntry(): Promise<string>;
  /** A new campaign the GM runs (retired, if asked), so retiring doesn't touch the shared one. */
  freshCampaign(retired: boolean): Promise<string>;
  /** A new campaign the GM runs, in Adventure with no expedition under way (in town, M5b step 6a). */
  freshTownCampaign(): Promise<string>;
  /** A new campaign the GM runs with Players A and B in it, its clock not moved (nothing else done in it). */
  freshPlayersCampaign(): Promise<string>;
  /** A note this person just wrote. */
  freshNote(by: 'gm' | 'playerA' | 'playerB'): Promise<{ id: string; campaignId: string; authorUserId: string | null }>;
  /** Wren's or Ash's items, or the campaign's Party stash. */
  carrier(of: 'wren' | 'ash' | 'stash'): Promise<CarrierRef>;
  /** A new line of three Sling stones on that carrier (with visible charges left, if given). */
  freshLine(on: 'wren' | 'ash' | 'stash', chargesLeft?: number): Promise<{ id: string; carrier: CarrierRef }>;
  /**
   * A new magic armour line on that carrier whose base is chosen from "reed-coat" or "bark-vest" (07,
   * armour.baseArmour), with its base already picked ("reed-coat") when asked.
   */
  freshArmour(on: 'wren' | 'ash', picked: boolean): Promise<{ id: string; carrier: CarrierRef; baseArmourId: string | null }>;
  /** A new sack on that carrier with something in it. */
  freshContainer(on: 'wren' | 'ash'): Promise<{ id: string; carrier: CarrierRef }>;
  /** A new company, and an open invitation (from the GM) for a new character of Player A's with no company. */
  freshCompanyInvitation(): Promise<string>;
  /** The campaign's clock as it is now (M5 step 5). */
  clockOf(campaignId: string): Promise<Clock>;
  /** A session running in the campaign (any other running one is ended first). */
  freshSession(campaignId: string): Promise<Session>;
  /** An expedition in the campaign, under way or (ended) just ended (any other under way is ended first). */
  freshExpedition(campaignId: string, ended?: boolean): Promise<Expedition>;
  /** A reminder the GM made in the campaign (M5 step 6): a check, the GM's own. */
  freshReminder(campaignId: string): Promise<Reminder>;
  /** Puts the campaign out on an adventure (out of Downtime). */
  onAdventure(campaignId: string): Promise<void>;
  /** A check the GM recorded in the campaign: a hit, so the roll can be entered. */
  freshCheckResult(campaignId: string): Promise<CheckResult>;
  /** A fresh campaign of the GM's whose setting rules (its homebrew) hold the table "bog-things" (M5b step g3). */
  freshTableCampaign(): Promise<string>;
  /** A pin on "bog-things" in the campaign, made for this session (M5b step g3). */
  freshTablePin(campaignId: string): Promise<TablePin>;
  /** A hit in the campaign queued as an Encounter waiting card, still waiting (M5b step 2). */
  freshWaitingEncounter(campaignId: string): Promise<WaitingEncounter>;
  /** The party's travel row (M5b step 1) in a fresh expedition under way in the campaign: day 0, 8 points, nothing spent. */
  freshTravel(group?: number): Promise<TravelGroup>;
  /**
   * A forced march this player just made with the party (fm-1): the party together, a fresh expedition with a day
   * started, 4 points added. Its log line, the group's (both players are in the party when it's written).
   */
  freshMarch(by: 'playerA' | 'playerB'): Promise<{ campaignId: string; eventId: string; authorUserId: string | null }>;
  /** An activity Player A just did for the party (M5b step 3), in a fresh expedition with a day started: its run's id. */
  freshActivityRun(): Promise<string>;
  /**
   * A camp the GM just made for the party (M5b step 4) in a fresh expedition, the party together, with a fresh line of
   * three Sling stones in Wren's pack (eaten or cooked in the cases; the database doesn't judge what's food).
   */
  freshCamp(): Promise<{ campId: string; lineId: string }>;
  /** The party is Lost (M5b step 1) in a fresh expedition, with the campaign's "Getting lost" set Open or Secret first. */
  freshLost(open: boolean): Promise<GroupLost>;
  /**
   * A new light lit on that character (M5 step 7), Keep lit off: a glow-moss that never runs out, or (`holder`) a reed
   * lamp burning fen oil for a long while, with a flask of fen oil in the pack. Gives back the light's line.
   */
  freshLight(on: 'wren' | 'ash', holder?: boolean): Promise<string>;
  /**
   * A new spell ready today on that character (dec-8 piece A): its ready list set to just that spell, at level 1, with
   * nothing chosen; one casting of it already spent when `cast`.
   */
  freshReadySpell(on: 'wren' | 'ash', cast?: boolean): Promise<{ spell: string; level: number }>;
  /**
   * A new campaign the GM runs, Players A and B in it, with invented setting rules whose weather rolls on the table
   * "fen-sky" (d6), "Weather rolled by" set as given, and an expedition under way (M5b).
   */
  freshWeather(rolledBy: WeatherRolledBy): Promise<{ campaignId: string; expeditionId: string; tableId: string }>;
  /** Today's weather, entered in such a campaign (players roll it). */
  freshWeatherRoll(): Promise<WeatherRoll>;
  /**
   * The campaign's marching order (M5 step 8), set as asked first: a lock stored or not (through the GM's old lock
   * function; since B11 a stored lock stops nobody), and "Players can reorder marching order" on or off (default: no
   * lock stored, on). Gives back its target and copy, and rows of Wren and Ash that differ from what it holds now (so
   * a move always changes something); it holds a preset named "Tunnel".
   */
  marching(state?: { locked?: boolean; playersReorder?: boolean }): Promise<{ target: MarchingTarget; order: MarchingOrder; rows: Rows }>;
  /**
   * The party's groups (M5 step 8, DG14), set as asked first (by the GM): 'together' (everyone in group 1) or 'split'
   * (Wren in a group of their own). Gives back the group Wren is in.
   */
  party(state: 'together' | 'split'): Promise<number>;
  /**
   * A new status on that character (M5 step 9), as the GM put it there: typed ("Muddy boots"), or (`levels`) the
   * invented Dazed → Reeling → Out cold at its first level; with `timed`, a typed one with 3 turns left (of 3).
   */
  freshStatus(on: 'wren' | 'ash', levels?: boolean, timed?: boolean): Promise<CharacterStatus>;
  /**
   * Where the party is (M5 step 11): a fresh expedition under way in the campaign (any other ended first), the party
   * at the invented "Moth Gallery", hidden from players or (`shown`) shown. Gives back the party's row with its place
   * and its one piece (an exit, M5b g2), hidden or (`shown`) shown to the party; with `picture`, the place has the
   * GM's picture (M5b step 1 follow-up); with `map`, a map of the GM's tied to it (dec-7 5m-2).
   */
  freshPlace(shown?: boolean, picture?: boolean, map?: boolean): Promise<GroupPlace>;
  /** A map of the GM's (dec-7 5m-3, the eye): the campaign's copy, an asset of kind `map`, hidden. Gives back its id. */
  freshMap(): Promise<string>;
  /** A find the GM just sent to Player A's character (K16b, find.give): the send's first log line, for its Undo. */
  freshFind(): Promise<string>;
  /**
   * A return visit (M5b g2b, gp-5): the party was at the Moth Gallery with its piece shown, moved on, and is back on
   * a new visit with nothing shown yet. Gives back the new visit's row (its piece hidden).
   */
  freshReturnVisit(): Promise<GroupPlace>;
  /** A location of a pack attached to the campaign (M8b slice 0): the invented Reed Inn as the library holds it. */
  freshPackPlace(): Promise<PackPlaceEntry>;
  /** A fresh campaign with no expedition under way and one typed place in it (to start an expedition at by id). */
  freshIdlePlace(): Promise<{ campaignId: string; placeId: string }>;
  /**
   * A fresh campaign with an expedition under way and one typed place in it, for Move on (December 4c): its own clock,
   * so moving it on ends nothing another case set going and leaves the shared campaign's clock where it was.
   */
  freshMovePlace(): Promise<{ campaignId: string; placeId: string }>;
  /**
   * A hook of an adventure pack attached to the campaign, never sent (dec-12 piece B): the pack's id and the hook's id
   * in it, a fresh one each time so a send is never refused as a repeat.
   */
  freshAdventureHook(): Promise<{ packId: string; hookId: string }>;
  /**
   * A row of a rumours table of an adventure pack attached to the campaign, never given (dec-12 piece E): the pack's id,
   * the table's id and the row's range, a fresh table each time so a give is never refused as a repeat.
   */
  freshRumour(): Promise<{ packId: string; tableId: string; min: number; max: number }>;
  /** A message the GM just wrote to Wren (Player A's character; M5b g4). Gives back its id. */
  freshMessage(): Promise<string>;
  /** A Describe… request Wren (Player A's character) just sent, still waiting (M5 step 12). */
  freshRequest(): Promise<Request>;
  /** A Max HP change Player A just asked the GM for, for Wren, still waiting (plan m5b-sheet-revised B). */
  freshSheetChange(): Promise<SheetChange>;
  /** A Sell… request Wren (Player A's character) sent, which the GM has answered with an offer of 3 gp (M5b step 6e). */
  freshOffer(): Promise<Request>;
  /**
   * A purchase Player A just made for Wren, untouched (W11b): a Buy… request the GM answered In stock, and Player A's
   * Buy it with its line, which came in as bought at version 1 with Player A's creating event (what undo_buy checks).
   */
  freshPurchase(): Promise<Request>;
  /**
   * A fresh expedition at a Safe town whose one lodging the GM shows, open (M5b step 6e): its key in places.town,
   * its name and the town's name.
   */
  freshInn(): Promise<{ key: string; name: string; town: string }>;
  /**
   * A piece of a place in town (W4c, ge-1): a fresh expedition with the party at a Safe town made from a pack, and a
   * place one level under it (its entry `place:<id>` in the town's list), with one piece, hidden or (`shown`) shown to
   * the party. Gives back the party's visit to the town and the piece.
   */
  freshTownPart(shown?: boolean): Promise<{ visitId: string; pieceId: string }>;
  /**
   * A secret-activity request Wren (Player A's character) just sent, still waiting, in a fresh expedition with a
   * day started for group 1 (M5b step 3): "Scout ahead", costing 2 points.
   */
  freshSecretRequest(): Promise<Request>;
  /**
   * Escape rolls the GM just asked for in a fresh expedition (M5 step 12): Wren's own request (`each`), or the one
   * for the whole party (`party`, no requester), still waiting.
   */
  freshAsked(who: 'each' | 'party'): Promise<Request>;
  /**
   * A purse holding exactly this coin (December step 6b): Wren's, Ash's, the Party stash's, or (`fallen`) a new approved
   * character of Player B's who is dead, so its purse is open to the other players (ruled 2026-10-29), or
   * (`archived`) a new archived character of Player A's, whose purse only the GM changes.
   */
  freshCoins(on: 'wren' | 'ash' | 'stash' | 'fallen' | 'archived', coins: Coins): Promise<TakeFrom>;
}

export interface PermissionCase {
  says: string;
  /** Allowed, but there's nothing to change (so nothing is logged). */
  changesNothing?: boolean;
  who: Who;
  commandName: string;
  allowed: boolean;
  prepare(world: CaseWorld): Promise<{
    target: unknown;
    run(db: Db, user: CurrentUser): Promise<CommandResult<unknown>>;
  }>;
}

/** An invented light to light from a line (one that never runs out, so the clock's cases never burn it). */
const glowMoss = (lineId: string): LightOption => ({
  line: { id: lineId, name: 'Glow-moss', qty: 1, version: 1 },
  type: { id: 'glow-moss', name: 'Glow-moss', seconds: null, warnSeconds: null, consumed: false, fuel: null },
  unit: null,
  radius: null,
});

/** Invented statuses for the M5 step 9 cases: a typed one, one with a secret timer (the GM's), and the rest condition. */
const muddyBoots: NewStatus = { name: 'Muddy boots', condition: null, timer: null, secret: false };
const fenSight: NewStatus = { name: 'Fen-sight', condition: null, timer: { seconds: 1800, unit: 'turn' }, secret: true };
const weary: NewStatus = { name: 'Weary', condition: { id: 'weary', name: 'Weary', icon: null, stacks: true, levels: null, defaultRounds: null, note: null }, timer: null, secret: false };

/** An invented item, copied onto a line. */
const slingStones: ItemCopy = { libraryEntryId: null, name: 'Sling stones', category: 'gear', weightCoin: 1, slots: null, stack: 20 };

/** A character's items as a carrier. */
const carrierOf = (character: CharacterRef): CarrierRef => ({
  campaignId: character.campaignId,
  actorId: character.id,
  locationId: null,
  ownerUserId: character.ownerUserId,
  archived: character.archived,
});

/** Marks an allowed case whose target has nothing to change, e.g. removing a portrait from a character without one. */
function quiet(c: PermissionCase): PermissionCase {
  return { ...c, changesNothing: true };
}

function rule<Input, Target, Output>(
  says: string,
  who: Who,
  command: Command<Input, Target, Output>,
  input: (world: CaseWorld) => Input | Promise<Input>,
  allowed: boolean,
): PermissionCase {
  return {
    says,
    who,
    commandName: command.name,
    allowed,
    async prepare(world) {
      const ready = await input(world);
      return { target: command.target(ready), run: (db, user) => command.run(db, user, ready) };
    },
  };
}

export const permissionCases: PermissionCase[] = [
  rule('a person can change their own display name', 'playerA', renameProfile, (w) => ({ userId: w.userId('playerA'), displayName: 'Francine' }), true),
  rule("a person can't change someone else's display name", 'playerA', renameProfile, (w) => ({ userId: w.userId('playerB'), displayName: 'Mud' }), false),

  rule('anyone signed in can create a campaign', 'outsider', createCampaign, () => ({ name: 'The Outsider’s Own Game' }), true),
  rule('the GM can rename the campaign', 'gm', updateCampaign, (w) => ({ campaignId: w.campaignId, name: 'The Drowned Marches' }), true),
  rule("a player can't rename the campaign", 'playerA', updateCampaign, (w) => ({ campaignId: w.campaignId, name: 'Wren’s Game' }), false),
  rule("an outsider can't change the campaign's settings", 'outsider', updateCampaign, (w) => ({ campaignId: w.campaignId, settings: {} }), false),
  rule('the GM can set the campaign sigil', 'gm', setSigil, (w) => ({ campaignId: w.campaignId, image: picture() }), true),
  rule("a player can't set the campaign sigil", 'playerA', setSigil, (w) => ({ campaignId: w.campaignId, image: picture() }), false),
  rule("an outsider can't set the campaign sigil", 'outsider', setSigil, (w) => ({ campaignId: w.campaignId, image: picture() }), false),
  rule('the GM can remove the campaign sigil', 'gm', clearSigil, (w) => ({ campaignId: w.campaignId }), true),
  rule("a player can't remove the campaign sigil", 'playerA', clearSigil, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can retire their campaign', 'gm', retireCampaign, async (w) => ({ campaignId: await w.freshCampaign(false) }), true),
  rule("a player can't retire the campaign", 'playerA', retireCampaign, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can bring back their retired campaign', 'gm', restoreCampaign, async (w) => ({ campaignId: await w.freshCampaign(true) }), true),
  rule("a player can't bring back a campaign", 'playerA', restoreCampaign, (w) => ({ campaignId: w.campaignId }), false),

  rule('the GM can create an invite', 'gm', createInvite, (w) => ({ campaignId: w.campaignId }), true),
  rule("a player can't create an invite", 'playerA', createInvite, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can revoke an invite', 'gm', revokeInvite, async (w) => ({ campaignId: w.campaignId, inviteId: (await w.freshInvite()).id }), true),
  rule("a player can't revoke an invite", 'playerA', revokeInvite, async (w) => ({ campaignId: w.campaignId, inviteId: (await w.freshInvite()).id }), false),
  rule('a newcomer with a valid code can join', 'newcomer', redeemInvite, async (w) => ({ code: (await w.freshInvite()).code }), true),

  rule('a player can make their own character active', 'playerA', setActiveCharacter, (w) => ({ campaignId: w.campaignId, character: w.wren }), true),
  rule("a player can't make someone else's character active", 'playerA', setActiveCharacter, (w) => ({ campaignId: w.campaignId, character: w.ash }), false),
  rule("an outsider can't pick an active character", 'outsider', setActiveCharacter, (w) => ({ campaignId: w.campaignId, character: w.wren }), false),
  rule("a player can't make their waiting character active", 'playerA', setActiveCharacter, async (w) => ({ campaignId: w.campaignId, character: await w.freshCharacter('playerA', 'pending') }), false),

  // Companies run by the players (ruled 2026-10-24).
  rule('a player founds a company for their own character', 'playerA', foundCompany, async (w) => ({ campaignId: w.campaignId, character: await w.freshCharacter('playerA', 'approved'), name: 'The Reed Cutters' }), true),
  rule("a player can't found a company for someone else's character", 'playerA', foundCompany, async (w) => ({ campaignId: w.campaignId, character: await w.freshCharacter('playerB', 'approved'), name: 'Not Mine' }), false),
  rule('a player asks for their own character to join a company', 'playerA', askToJoin, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), character: await w.freshCharacter('playerA', 'approved') }), true),
  rule("a player can't ask for someone else's character", 'playerB', askToJoin, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), character: await w.freshCharacter('playerA', 'approved') }), false),
  rule('the GM invites a character to a company', 'gm', inviteToCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), characterId: (await w.freshCharacter('playerA', 'approved')).id, member: false }), true),
  rule("a player outside the company can't invite", 'playerB', inviteToCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), characterId: (await w.freshCharacter('playerA', 'approved')).id, member: false }), false),
  rule("a player answers their own character's invitation", 'playerA', answerInvitation, async (w) => ({ campaignId: w.campaignId, invitationId: await w.freshCompanyInvitation(), accept: true, mine: true }), true),
  rule("a player can't answer someone else's invitation", 'playerB', answerInvitation, async (w) => ({ campaignId: w.campaignId, invitationId: await w.freshCompanyInvitation(), accept: true, mine: false }), false),
  rule('the GM takes back an invitation', 'gm', cancelInvitation, async (w) => ({ campaignId: w.campaignId, invitationId: await w.freshCompanyInvitation(), sent: true }), true),
  rule("a player can't take back someone else's invitation", 'playerA', cancelInvitation, async (w) => ({ campaignId: w.campaignId, invitationId: await w.freshCompanyInvitation(), sent: false }), false),
  rule('the GM can create a company', 'gm', createCompany, (w) => ({ campaignId: w.campaignId, name: 'The Reed Cutters' }), true),
  rule("a player can't create a company", 'playerA', createCompany, (w) => ({ campaignId: w.campaignId, name: 'Wren’s Own' }), false),
  rule('the GM can rename a company', 'gm', renameCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), name: 'The Reed Guild' }), true),
  rule("a player can't rename a company", 'playerA', renameCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany(), name: 'Mine now' }), false),
  rule('the GM can delete a company', 'gm', deleteCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany() }), true),
  rule("a player can't delete a company", 'playerA', deleteCompany, async (w) => ({ campaignId: w.campaignId, companyId: await w.freshCompany() }), false),

  rule('a player can create a character', 'playerA', createCharacter, (w) => ({ campaignId: w.campaignId, kind: 'pc' as const, name: 'Bram the Unready' }), true),
  rule('a player can create a companion', 'playerA', createCharacter, (w) => ({ campaignId: w.campaignId, kind: 'animal' as const, name: 'Thistledown the mule' }), true),
  rule("a player can't create a monster", 'playerA', createCharacter, (w) => ({ campaignId: w.campaignId, kind: 'monster' as const, name: 'Bog lurker' }), false),
  rule('the GM can create a monster', 'gm', createCharacter, (w) => ({ campaignId: w.campaignId, kind: 'monster' as const, name: 'Bog lurker' }), true),
  rule("an outsider can't create a character", 'outsider', createCharacter, (w) => ({ campaignId: w.campaignId, kind: 'pc' as const, name: 'Sly Cob' }), false),

  rule('a player can edit their own character', 'playerA', editCharacter, (w) => ({ character: w.wren, changes: { hpCurrent: 6 } }), true),
  rule("a player can't edit another player's character", 'playerA', editCharacter, (w) => ({ character: w.ash, changes: { hpCurrent: 1 } }), false),
  rule('the GM can edit any character', 'gm', editCharacter, (w) => ({ character: w.ash, changes: { hpCurrent: 4 } }), true),
  rule("an outsider can't edit a character", 'outsider', editCharacter, (w) => ({ character: w.wren, changes: { name: 'Mud' } }), false),
  rule("a player can't change Max HP on their own approved character (it goes to the GM as a request)", 'playerA', editCharacter, (w) => ({ character: w.wren, changes: { hpMax: 30 } }), false),
  rule("the GM changes a player's Max HP", 'gm', editCharacter, (w) => ({ character: w.ash, changes: { hpMax: 31 } }), true),
  rule('a player sets Max HP on their own character before it is approved', 'playerA', editCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), changes: { hpMax: 12 } }), true),
  // Expertise points (G-208, ex-2): the owner spends them, the GM moves them; taking one back after approval is the
  // database's to refuse (supabase/tests/g208-expertise.test.ts), as for weapon skills.
  rule('a player spends expertise points on their own character before it is approved', 'playerA', editCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), changes: { expertise: { SB: 2 } } }), true),
  rule('a player adds an expertise point on their own approved character', 'playerA', editCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), changes: { expertise: { SB: 1 } } }), true),
  rule("a player can't spend expertise points on another player's character", 'playerA', editCharacter, (w) => ({ character: w.ash, changes: { expertise: { SB: 1 } } }), false),
  rule("the GM moves expertise points on a player's character", 'gm', editCharacter, (w) => ({ character: w.ash, changes: { expertise: { WL: 1 } } }), true),

  rule('the GM can approve a pending character', 'gm', reviewCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), decision: 'approved' as const }), true),
  rule('the GM can send a pending character back with a note', 'gm', reviewCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), decision: 'rejected' as const, note: 'Try a river-town name.' }), true),
  rule('the GM can ask for a different level', 'gm', reviewCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), decision: 'level' as const, level: 2 }), true),
  rule("a player can't ask their own character for a different level", 'playerA', reviewCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), decision: 'level' as const, level: 9 }), false),
  rule("a player can't approve their own character", 'playerA', reviewCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), decision: 'approved' as const }), false),

  rule('a player can resubmit their rejected character', 'playerA', resubmitCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'rejected') }), true),
  rule("a player can't resubmit someone else's rejected character", 'playerB', resubmitCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'rejected') }), false),
  rule('a player sends their draft to the GM', 'playerA', sendCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'draft') }), true),
  rule("a player can't send someone else's draft", 'playerB', sendCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'draft') }), false),
  rule("the GM can't send a player's draft", 'gm', sendCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'draft') }), false),

  rule('a player can delete their own waiting character', 'playerA', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending') }), true),
  rule("a player can't delete another player's waiting character", 'playerB', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'pending') }), false),
  rule("a player can't delete their approved character outright", 'playerA', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), false),
  rule('the GM can delete a sent-back character', 'gm', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'rejected') }), true),
  rule("the GM can't delete an approved character that isn't archived", 'gm', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), false),
  rule('the GM can delete an archived character permanently', 'gm', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true) }), true),
  rule('a player can delete their own archived character permanently', 'playerA', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true) }), true),
  rule("a player can't delete another player's archived character", 'playerB', deleteCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true) }), false),
  rule('a player can archive their own approved character', 'playerA', archiveCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), true),
  rule("a player can't archive another player's character", 'playerB', archiveCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), false),
  rule('the GM can archive any approved character', 'gm', archiveCharacter, async (w) => ({ character: await w.freshCharacter('playerB', 'approved') }), true),
  rule('the GM can restore an archived character', 'gm', restoreCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true) }), true),
  rule("a player can't restore their archived character", 'playerA', restoreCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true) }), false),
  // December, the GM gives a character to a player (gp-1, gp-5): to a player of the campaign, or back to the GM.
  rule('the GM can give a character to a player', 'gm', reassignCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), to: { userId: w.userId('playerB'), role: 'player' as const } }), true),
  rule("the GM can take a player's character back", 'gm', reassignCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), to: { userId: null, role: null } }), true),
  rule("a player can't give their own character away", 'playerA', reassignCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), to: { userId: w.userId('playerB'), role: 'player' as const } }), false),
  rule("a player can't take another player's character", 'playerB', reassignCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), to: { userId: w.userId('playerB'), role: 'player' as const } }), false),
  // The device may think the target a player (a stale list); the database refuses whoever isn't one.
  rule("not even the GM can give a character to someone outside the campaign", 'gm', reassignCharacter, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), to: { userId: w.userId('outsider'), role: null } }), false),
  rule('the GM can add a character field', 'gm', createField, (w) => ({ campaignId: w.campaignId, label: 'Calling', type: 'text' as const }), true),
  rule("a player can't add a character field", 'playerA', createField, (w) => ({ campaignId: w.campaignId, label: 'Sneaky', type: 'text' as const }), false),
  rule('the GM can use a sheet layout from setting rules', 'gm', applySheetLayout, (w) => ({ campaignId: w.campaignId, fields: [{ label: 'Nerve', type: 'number' }] }), true),
  rule("a player can't use a sheet layout", 'playerA', applySheetLayout, (w) => ({ campaignId: w.campaignId, fields: [{ label: 'Sneaky' }] }), false),
  rule('the GM can rename or hide a field', 'gm', updateField, async (w) => ({ field: await w.freshField(), changes: { label: 'Renamed', hidden: true } }), true),
  rule("a player can't rename or hide a field", 'playerA', updateField, async (w) => ({ field: await w.freshField(), changes: { hidden: true } }), false),
  rule('the GM can reorder the fields', 'gm', reorderFields, async (w) => {
    const first = await w.freshField();
    const second = await w.freshField();
    return { campaignId: w.campaignId, ids: [second.id, first.id] };
  }, true),
  rule("a player can't reorder the fields", 'playerA', reorderFields, async (w) => ({ campaignId: w.campaignId, ids: [(await w.freshField()).id] }), false),
  rule('the GM can delete a field nobody has filled in', 'gm', deleteField, async (w) => ({ field: await w.freshField() }), true),
  rule("a player can't delete a field", 'playerA', deleteField, async (w) => ({ field: await w.freshField() }), false),
  rule("a player can set their own character's portrait", 'playerA', setPortrait, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), image: picture() }), true),
  rule("a player can't set another player's character's portrait", 'playerB', setPortrait, async (w) => ({ character: await w.freshCharacter('playerA', 'approved'), image: picture() }), false),
  rule("the GM can set any player character's portrait", 'gm', setPortrait, async (w) => ({ character: await w.freshCharacter('playerB', 'pending'), image: picture() }), true),
  quiet(rule("a player can remove their own character's portrait", 'playerA', clearPortrait, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), true)),
  rule("a player can't remove another player's character's portrait", 'playerB', clearPortrait, async (w) => ({ character: await w.freshCharacter('playerA', 'approved') }), false),
  rule('the GM can put a character in a company', 'gm', assignCompany, (w) => ({ character: w.ash, companyId: w.companyId }), true),
  rule("a player can't put their character in a company", 'playerA', assignCompany, (w) => ({ character: w.wren, companyId: w.companyId }), false),
  rule("a player can change their own character's HP", 'playerA', setHp, (w) => ({ character: w.wren, hpCurrent: 7 }), true),
  rule("the GM can change a player character's HP", 'gm', setHp, (w) => ({ character: w.ash, hpCurrent: -2 }), true),
  rule("a player can't change another player's character's HP", 'playerB', setHp, (w) => ({ character: w.wren, hpCurrent: 1 }), false),
  rule("an outsider can't change a character's HP", 'outsider', setHp, (w) => ({ character: w.wren, hpCurrent: 1 }), false),
  rule('a player can undo their own change', 'playerA', undoChange, (w) => w.freshChange('playerA'), true),
  rule("a player can't undo another player's change", 'playerB', undoChange, (w) => w.freshChange('playerA'), false),
  rule("the GM can undo a player's change", 'gm', undoChange, (w) => w.freshChange('playerA'), true),
  rule("an outsider can't undo anything", 'outsider', undoChange, (w) => w.freshChange('playerA'), false),
  rule('a player can write a note', 'playerA', addNote, (w) => ({ campaignId: w.campaignId, text: 'The bridge is out.' }), true),
  rule("an outsider can't write a note", 'outsider', addNote, (w) => ({ campaignId: w.campaignId, text: 'Let me in.' }), false),
  rule('a player can edit their own note', 'playerA', editNote, async (w) => ({ note: await w.freshNote('playerA'), text: 'The bridge is fixed.' }), true),
  rule("a player can't edit another player's note", 'playerB', editNote, async (w) => ({ note: await w.freshNote('playerA'), text: 'Mine now.' }), false),
  rule("the GM can edit a player's note", 'gm', editNote, async (w) => ({ note: await w.freshNote('playerA'), text: 'Tidied.' }), true),
  rule('anyone signed in can import setting rules into their own library', 'outsider', importPack, () => ({ pack: tinyPack() }), true),
  rule("the GM can copy the campaign's homebrew to their Rules library", 'gm', copyHomebrewToLibrary, async (w) => ({ campaignId: w.campaignId, packId: (await w.freshAttachedPack()).packId, name: 'Fen homebrew' }), true),
  // A player isn't offered it; the database doesn't stop them copying what they can already read (library.ts).
  rule("an outsider can't copy a campaign's homebrew", 'outsider', copyHomebrewToLibrary, async (w) => ({ campaignId: w.campaignId, packId: (await w.freshAttachedPack()).packId, name: 'Fen homebrew' }), false),
  rule('you can edit an entry of your own pack (Edit pack)', 'gm', editPackEntry, async (w) => ({ ...(await w.freshPack('gm')), kind: 'item' as const, packEntryId: 'rope', data: { name: 'Rope', weightCoin: 40 } }), true),
  rule("you can't edit an entry of someone else's pack", 'playerA', editPackEntry, async (w) => ({ ...(await w.freshPack('gm')), kind: 'item' as const, packEntryId: 'rope', data: { name: 'Mine' } }), false),
  rule('you can update your own setting rules', 'gm', updatePack, async (w) => ({ ...(await w.freshPack('gm')), pack: tinyPack() }), true),
  rule("you can't update someone else's setting rules", 'playerA', updatePack, async (w) => ({ ...(await w.freshPack('gm')), pack: tinyPack() }), false),
  rule('you can delete your own setting rules, even ones a campaign uses (each campaign logs it)', 'gm', deletePack, async (w) => { const { packId, ownerUserId } = await w.freshAttachedPack(); return { packId, ownerUserId }; }, true),
  rule("you can't delete someone else's setting rules", 'playerA', deletePack, async (w) => { const { packId, ownerUserId } = await w.freshAttachedPack(); return { packId, ownerUserId }; }, false),
  rule('the GM can attach their setting rules to the campaign', 'gm', attachPack, async (w) => ({ campaignId: w.campaignId, packId: (await w.freshPack('gm')).packId }), true),
  rule("a player can't attach setting rules to the campaign", 'playerA', attachPack, async (w) => ({ campaignId: w.campaignId, packId: (await w.freshPack('playerA')).packId }), false),
  rule('the GM can change optional rules', 'gm', setPackOptions, async (w) => ({ campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId, optionChoices: { x: 'y' } }), true),
  rule("a player can't change optional rules", 'playerA', setPackOptions, async (w) => ({ campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId, optionChoices: { x: 'y' } }), false),
  rule('the GM can detach setting rules', 'gm', detachPack, async (w) => ({ campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId }), true),
  rule("a player can't detach setting rules", 'playerA', detachPack, async (w) => ({ campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId }), false),
  rule('the GM can move setting rules in the stack', 'gm', moveSettingRules, async (w) => {
    // The newest is on top, with another under it, so moving it down always changes something.
    await w.freshAttachedPack();
    return { campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId, direction: 'down' as const };
  }, true),
  rule("a player can't move setting rules in the stack", 'playerA', moveSettingRules, async (w) => {
    // The newest is on top, with another under it, so moving it down always changes something.
    await w.freshAttachedPack();
    return { campaignId: w.campaignId, campaignPackId: (await w.freshAttachedPack()).campaignPackId, direction: 'down' as const };
  }, false),
  rule('the GM can pick which setting rules win for an entry', 'gm', preferEntry, async (w) => ({ campaignId: w.campaignId, key: 'class:bog-hermit', name: 'Bog hermit', campaignPackId: (await w.freshAttachedPack()).campaignPackId }), true),
  rule("a player can't pick which setting rules win for an entry", 'playerA', preferEntry, async (w) => ({ campaignId: w.campaignId, key: 'class:bog-hermit', name: 'Bog hermit', campaignPackId: (await w.freshAttachedPack()).campaignPackId }), false),
  rule("the GM can start their campaign's homebrew", 'gm', startHomebrew, async (w) => ({ campaignId: await w.freshCampaign(false), campaignName: 'The Mossy Steps' }), true),
  rule("a player can't start the campaign's homebrew", 'playerA', startHomebrew, (w) => ({ campaignId: w.campaignId, campaignName: 'The Mossy Steps' }), false),
  rule("the GM can save an entry to the campaign's homebrew", 'gm', saveHomebrewEntry, (w) => ({ campaignId: w.campaignId, campaignName: 'The Mossy Steps', kind: 'condition' as const, data: { id: `dazed-${crypto.randomUUID().slice(0, 8)}`, name: 'Dazed' } }), true),
  rule("a player can't save an entry to the campaign's homebrew", 'playerA', saveHomebrewEntry, (w) => ({ campaignId: w.campaignId, campaignName: 'The Mossy Steps', kind: 'condition' as const, data: { id: 'dazed', name: 'Dazed' } }), false),
  rule("the GM can delete an entry from the campaign's homebrew", 'gm', deleteHomebrewEntry, async (w) => ({ campaignId: w.campaignId, kind: 'condition' as const, packEntryId: await w.freshHomebrewEntry() }), true),
  rule("a player can't delete an entry from the campaign's homebrew", 'playerA', deleteHomebrewEntry, async (w) => ({ campaignId: w.campaignId, kind: 'condition' as const, packEntryId: await w.freshHomebrewEntry() }), false),
  rule('the GM can put a waiting character in a company', 'gm', assignCompany, async (w) => ({ character: await w.freshCharacter('playerB', 'pending'), companyId: w.companyId }), true),
  rule("not even the GM can move an archived character's company", 'gm', assignCompany, async (w) => ({ character: await w.freshCharacter('playerA', 'approved', true), companyId: w.companyId }), false),
  rule('a player can add an item to their own character', 'playerA', addItem, async (w) => ({ carrier: await w.carrier('wren'), item: slingStones, qty: 3, howGot: 'found' as const }), true),
  rule("a player can't add an item to someone else's character", 'playerA', addItem, async (w) => ({ carrier: await w.carrier('ash'), item: slingStones, qty: 3, howGot: 'found' as const }), false),
  rule("the GM can add an item to anyone's character", 'gm', addItem, async (w) => ({ carrier: await w.carrier('ash'), item: slingStones, qty: 1, howGot: 'bought' as const, cost: '2 sp' }), true),
  rule('any player can put an item in the Party stash', 'playerB', addItem, async (w) => ({ carrier: await w.carrier('stash'), item: slingStones, qty: 5, howGot: 'found' as const }), true),
  rule("an outsider can't put anything in the Party stash", 'outsider', addItem, async (w) => ({ carrier: await w.carrier('stash'), item: slingStones, qty: 5, howGot: 'found' as const }), false),
  rule("a player can't add items to their archived character", 'playerA', addItem, async (w) => ({ carrier: carrierOf(await w.freshCharacter('playerA', 'approved', true)), item: slingStones, qty: 1, howGot: 'found' as const }), false),
  rule('a player can put on their own item despite a warning (logged as an override)', 'playerA', equipAnyway, async (w) => ({ line: await w.freshLine('wren') }), true),
  rule("a player can't put on someone else's item", 'playerA', equipAnyway, async (w) => ({ line: await w.freshLine('ash') }), false),
  rule("a member can tell the GM a rule couldn't be checked", 'playerA', noteRuleSkipped, (w) => ({ campaignId: w.campaignId, hookId: 'warn-odd' }), true),
  rule("an outsider can't write to the campaign's log", 'outsider', noteRuleSkipped, (w) => ({ campaignId: w.campaignId, hookId: 'warn-odd' }), false),
  // December step 6b: purses (ruling pk-6; docs/03 "Adjust personal purse", and the Down or dead exception).
  rule('the GM can give coin to a character', 'gm', addCoin, async (w) => ({ to: await w.freshCoins('wren', {}), coins: { heron: 40 } }), true),
  rule('the GM can give coin to the Party stash', 'gm', addCoin, async (w) => ({ to: await w.freshCoins('stash', {}), coins: { bit: 4 } }), true),
  rule("a player can't make coin from nothing", 'playerA', addCoin, async (w) => ({ to: await w.freshCoins('wren', {}), coins: { heron: 40 } }), false),
  // K16b: the GM sends a find (pk-12), and the GM alone takes a send back (public.undo_find).
  rule('the GM can send a find to a character', 'gm', giveFind, async (w) => ({ campaignId: w.campaignId, to: w.wren.id, placeId: (await w.freshPlace()).placeId!, things: [{ name: 'A silver hook', qty: 1 }], coins: {}, rows: [] }), true),
  rule("a player can't send a find", 'playerA', giveFind, async (w) => ({ campaignId: w.campaignId, to: w.wren.id, placeId: (await w.freshPlace()).placeId!, things: [{ name: 'A silver hook', qty: 1 }], coins: {}, rows: [] }), false),
  rule("an outsider can't send a find", 'outsider', giveFind, async (w) => ({ campaignId: w.campaignId, to: w.wren.id, placeId: (await w.freshPlace()).placeId!, things: [{ name: 'A silver hook', qty: 1 }], coins: {}, rows: [] }), false),
  rule('the GM can undo a send', 'gm', undoFind, async (w) => ({ campaignId: w.campaignId, eventId: await w.freshFind() }), true),
  rule("a player can't undo a send", 'playerA', undoFind, async (w) => ({ campaignId: w.campaignId, eventId: await w.freshFind() }), false),
  rule("an outsider can't undo a send", 'outsider', undoFind, async (w) => ({ campaignId: w.campaignId, eventId: await w.freshFind() }), false),
  rule("the GM can take coin out of a character's purse", 'gm', removeCoin, async (w) => ({ from: await w.freshCoins('ash', { heron: 5 }), coins: { heron: 2 } }), true),
  rule("a player can't take coin out of play from their own purse that way", 'playerB', removeCoin, async (w) => ({ from: await w.freshCoins('ash', { heron: 5 }), coins: { heron: 2 } }), false),
  rule('a player can spend from their own purse', 'playerA', spendCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), coins: { heron: 2 }, whatFor: 'Eel pie' }), true),
  rule("a player can't spend someone else's coin", 'playerB', spendCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), coins: { heron: 2 } }), false),
  rule("the GM can't spend a player's coin (the GM takes it instead)", 'gm', spendCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), coins: { heron: 2 } }), false),
  rule("an outsider can't spend anyone's coin", 'outsider', spendCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), coins: { heron: 2 } }), false),
  rule('a player can give coin to another character', 'playerA', giveCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), to: await w.freshCoins('ash', {}), coins: { heron: 5 } }), true),
  rule('a player can put coin in the Party stash', 'playerA', giveCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), to: await w.freshCoins('stash', {}), coins: { heron: 10 } }), true),
  rule("a player can't give away someone else's coin", 'playerB', giveCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), to: await w.freshCoins('ash', {}), coins: { heron: 5 } }), false),
  rule('a player can take coin from the Party stash', 'playerA', takeCoin, async (w) => ({ from: await w.freshCoins('stash', { heron: 10 }), to: await w.freshCoins('wren', {}), coins: { heron: 10 } }), true),
  rule("a player can take coin from a dead character's purse", 'playerA', takeCoin, async (w) => ({ from: await w.freshCoins('fallen', { heron: 7 }), to: await w.freshCoins('wren', {}), coins: { heron: 7 } }), true),
  rule("a player can't take coin from a living character's purse", 'playerA', takeCoin, async (w) => ({ from: await w.freshCoins('ash', { heron: 5 }), to: await w.freshCoins('wren', {}), coins: { heron: 1 } }), false),
  rule("a player can't take stash coin into someone else's purse", 'playerA', takeCoin, async (w) => ({ from: await w.freshCoins('stash', { heron: 10 }), to: await w.freshCoins('ash', {}), coins: { heron: 1 } }), false),
  rule("an outsider can't take coin from the Party stash", 'outsider', takeCoin, async (w) => ({ from: await w.freshCoins('stash', { heron: 10 }), to: await w.freshCoins('wren', {}), coins: { heron: 1 } }), false),
  rule("the GM can move coin from one character's purse to another's", 'gm', takeCoin, async (w) => ({ from: await w.freshCoins('ash', { heron: 5 }), to: await w.freshCoins('wren', {}), coins: { heron: 5 } }), true),
  // An archived character's purse follows its pack: only the GM changes it (the lead, 2026-11-13).
  rule("a player can't spend from their archived character's purse", 'playerA', spendCoin, async (w) => ({ from: await w.freshCoins('archived', { heron: 6 }), coins: { heron: 1 } }), false),
  rule("a player can't give from their archived character's purse", 'playerA', giveCoin, async (w) => ({ from: await w.freshCoins('archived', { heron: 6 }), to: await w.freshCoins('stash', {}), coins: { heron: 1 } }), false),
  rule("a player can't give coin to an archived character", 'playerA', giveCoin, async (w) => ({ from: await w.freshCoins('wren', { heron: 30 }), to: await w.freshCoins('archived', {}), coins: { heron: 1 } }), false),
  rule("a player can't take stash coin into their archived character's purse", 'playerA', takeCoin, async (w) => ({ from: await w.freshCoins('stash', { heron: 10 }), to: await w.freshCoins('archived', {}), coins: { heron: 1 } }), false),
  rule("the GM can take coin out of an archived character's purse", 'gm', removeCoin, async (w) => ({ from: await w.freshCoins('archived', { heron: 6 }), coins: { heron: 6 } }), true),
  rule("the GM can move coin from an archived character's purse to another character's", 'gm', takeCoin, async (w) => ({ from: await w.freshCoins('archived', { heron: 6 }), to: await w.freshCoins('wren', {}), coins: { heron: 6 } }), true),

  rule('a player can use up their own items', 'playerA', removeItem, async (w) => ({ line: await w.freshLine('wren'), qty: 1, of: 3 }), true),
  rule("a player can't take items off someone else's character", 'playerA', removeItem, async (w) => ({ line: await w.freshLine('ash'), qty: 3, of: 3 }), false),
  rule('any player can take items out of the Party stash', 'playerB', removeItem, async (w) => ({ line: await w.freshLine('stash'), qty: 3, of: 3 }), true),
  rule("the GM can take items off anyone's character", 'gm', removeItem, async (w) => ({ line: await w.freshLine('ash'), qty: 3, of: 3 }), true),
  rule('a player can use one of their own items up (Drink, Fire, Eat, Use)', 'playerA', useItem, async (w) => ({ line: await w.freshLine('wren'), of: 3, verb: 'Drink' }), true),
  rule("a player can't use up someone else's items", 'playerB', useItem, async (w) => ({ line: await w.freshLine('wren'), of: 3, verb: 'Drink' }), false),
  rule("the GM can use up an item on anyone's character", 'gm', useItem, async (w) => ({ line: await w.freshLine('ash'), of: 3, verb: 'Use' }), true),
  rule("a player can choose their own weapon's mode (Quiver, Grip…)", 'playerA', setWeaponMode, async (w) => ({ line: await w.freshLine('wren'), modeId: 'reed' }), true),
  rule("a player can't choose the mode of someone else's weapon", 'playerB', setWeaponMode, async (w) => ({ line: await w.freshLine('wren'), modeId: 'reed' }), false),
  rule("the GM can choose the mode of anyone's weapon", 'gm', setWeaponMode, async (w) => ({ line: await w.freshLine('ash'), modeId: 'thrown' }), true),
  rule("an outsider can't choose a weapon's mode", 'outsider', setWeaponMode, async (w) => ({ line: await w.freshLine('wren'), modeId: 'reed' }), false),
  rule('a mode belongs to a character’s weapon: nothing in the Party stash has one', 'playerA', setWeaponMode, async (w) => ({ line: await w.freshLine('stash'), modeId: 'reed' }), false),
  rule('a player can change how many of their own items they have', 'playerA', setItemQty, async (w) => ({ line: await w.freshLine('wren'), qty: 2 }), true),
  rule("a player can't change how many items someone else has", 'playerB', setItemQty, async (w) => ({ line: await w.freshLine('wren'), qty: 2 }), false),
  rule('a player can equip their own items', 'playerA', equipItem, async (w) => ({ line: await w.freshLine('wren'), equipped: true }), true),
  rule("a player can't equip someone else's items", 'playerB', equipItem, async (w) => ({ line: await w.freshLine('wren'), equipped: true }), false),
  rule('the GM can equip anyone’s items', 'gm', equipItem, async (w) => ({ line: await w.freshLine('ash'), equipped: true }), true),
  rule('a player can give their own items to another character', 'playerA', moveItem, async (w) => ({ line: await w.freshLine('wren'), to: await w.carrier('ash'), qty: 3, of: 3 }), true),
  rule('a player can give part of a stack to another character', 'playerA', moveItem, async (w) => ({ line: await w.freshLine('wren'), to: await w.carrier('ash'), qty: 1, of: 3 }), true),
  rule("a player can't hand over someone else's items", 'playerB', moveItem, async (w) => ({ line: await w.freshLine('wren'), to: await w.carrier('ash'), qty: 3, of: 3 }), false),
  rule('a player can take items from the Party stash', 'playerA', moveItem, async (w) => ({ line: await w.freshLine('stash'), to: await w.carrier('wren'), qty: 3, of: 3 }), true),
  rule('a player can put their own items in the Party stash', 'playerA', moveItem, async (w) => ({ line: await w.freshLine('wren'), to: await w.carrier('stash'), qty: 3, of: 3 }), true),
  rule("an outsider can't move anything", 'outsider', moveItem, async (w) => ({ line: await w.freshLine('stash'), to: await w.carrier('wren'), qty: 3, of: 3 }), false),
  rule("the GM can reveal an item's hidden field to its holder", 'gm', revealItemField, async (w) => ({ line: await w.freshLine('wren'), field: 'cursed', value: true }), true),
  rule("a player can't reveal a hidden field, even on their own item", 'playerA', revealItemField, async (w) => ({ line: await w.freshLine('wren'), field: 'cursed', value: true }), false),
  // K22b: the GM tells a hidden fact and edits what players see; a player never, even on their own item. A plain line
  // has nothing hidden, so the GM's tell of everything is allowed and changes nothing (the database tests tell for real).
  quiet(rule('the GM can tell the players what is hidden on an item', 'gm', tellItem, async (w) => ({ line: await w.freshLine('wren'), fact: 'everything' as const }), true)),
  rule("a player can't tell a hidden fact, even on their own item", 'playerA', tellItem, async (w) => ({ line: await w.freshLine('wren'), fact: 'everything' as const }), false),
  rule("a player can't tell a hidden fact on someone else's item", 'playerB', tellItem, async (w) => ({ line: await w.freshLine('wren'), fact: 'cursed' as const }), false),
  rule('the GM can change what players see of an item', 'gm', editItemLook, async (w) => ({ line: await w.freshLine('ash'), appearsAs: 'Grey stones', noticed: `Warm, today ${crypto.randomUUID().slice(0, 8)}.` }), true),
  rule("a player can't change what players see of an item, even their own", 'playerA', editItemLook, async (w) => ({ line: await w.freshLine('wren'), appearsAs: 'Gold stones', noticed: '' }), false),
  rule('a player can set the visible charges of their own item, from the roll', 'playerA', setCharges, async (w) => ({ line: await w.freshLine('wren'), value: 12, hidden: false }), true),
  rule("a player can't set hidden charges, even on their own item", 'playerA', setCharges, async (w) => ({ line: await w.freshLine('wren'), value: 12, hidden: true }), false),
  rule('the GM can set hidden charges', 'gm', setCharges, async (w) => ({ line: await w.freshLine('wren'), value: 7, hidden: true }), true),
  rule('a player can use a charge of their own item, hidden or not', 'playerA', useCharge, async (w) => ({ line: await w.freshLine('wren'), hidden: true }), true),
  rule("a player can't use a charge of someone else's item", 'playerB', useCharge, async (w) => ({ line: await w.freshLine('wren'), hidden: true }), false),
  rule('the GM can recharge an item', 'gm', recharge, async (w) => ({ line: await w.freshLine('wren', 1), amount: 3, hidden: false }), true),
  rule("a player can't recharge an item", 'playerA', recharge, async (w) => ({ line: await w.freshLine('wren', 1), amount: 3, hidden: false }), false),
  rule('the GM can tell the holder an item is spent', 'gm', revealSpent, async (w) => ({ line: await w.freshLine('wren') }), true),
  rule("a player can't mark an item spent", 'playerA', revealSpent, async (w) => ({ line: await w.freshLine('wren') }), false),
  rule('a player empties a container they carry into the Party stash', 'playerA', emptyContainer, async (w) => ({ line: await w.freshContainer('wren'), to: await w.carrier('stash') }), true),
  rule("a player can't empty another player's container", 'playerA', emptyContainer, async (w) => ({ line: await w.freshContainer('ash'), to: 'carried' as const }), false),
  rule('the GM can show the holder how many charges are left', 'gm', revealCharges, async (w) => ({ line: await w.freshLine('wren'), left: 3 }), true),
  rule("a player can't reveal a hidden count", 'playerA', revealCharges, async (w) => ({ line: await w.freshLine('wren', 0), left: 3 }), false),
  rule('a player can pin their own item to At hand', 'playerA', pinItem, async (w) => ({ line: await w.freshLine('wren'), pinned: true }), true),
  // Magic armour's base (07, armour.baseArmour; ruled 2026-10-29): picked once by whoever may change the item; then the GM's.
  rule("a player can choose the base armour of their own magic armour", 'playerA', setBaseArmour, async (w) => ({ line: await w.freshArmour('wren', false), baseArmourId: 'bark-vest' }), true),
  rule("a player can't change the base armour once it's chosen", 'playerA', setBaseArmour, async (w) => ({ line: await w.freshArmour('wren', true), baseArmourId: 'bark-vest' }), false),
  rule("a player can't choose the base armour of someone else's armour", 'playerB', setBaseArmour, async (w) => ({ line: await w.freshArmour('wren', false), baseArmourId: 'bark-vest' }), false),
  rule('the GM can change the base armour after it was chosen', 'gm', setBaseArmour, async (w) => ({ line: await w.freshArmour('wren', true), baseArmourId: 'bark-vest' }), true),
  // Carrying treasure (area 3 order 12, eq-3): the GM's switch per character; players only see it.
  rule('the GM can switch Carrying treasure on for a character', 'gm', setCarryingTreasure, async (w) => ({ carrier: await w.carrier('wren'), on: true }), true),
  rule("a player can't switch Carrying treasure for their own character", 'playerA', setCarryingTreasure, async (w) => ({ carrier: await w.carrier('wren'), on: true }), false),
  rule("an outsider can't switch Carrying treasure", 'outsider', setCarryingTreasure, async (w) => ({ carrier: await w.carrier('wren'), on: true }), false),
  rule("the GM can't switch Carrying treasure on the Party stash", 'gm', setCarryingTreasure, async (w) => ({ carrier: await w.carrier('stash'), on: true }), false),
  rule("a player can't pin someone else's item", 'playerB', pinItem, async (w) => ({ line: await w.freshLine('wren'), pinned: true }), false),
  rule("nothing in the Party stash can be pinned (pins belong to a character)", 'playerA', pinItem, async (w) => ({ line: await w.freshLine('stash'), pinned: true }), false),
  rule('a player can hide their own item from At hand', 'playerA', hideFromAtHand, async (w) => ({ line: await w.freshLine('wren'), hidden: true }), true),
  rule("a player can't hide someone else's item from At hand", 'playerB', hideFromAtHand, async (w) => ({ line: await w.freshLine('wren'), hidden: true }), false),
  rule('nothing in the Party stash is in At hand to hide', 'playerA', hideFromAtHand, async (w) => ({ line: await w.freshLine('stash'), hidden: true }), false),
  rule('a player can arrange their own character’s screen', 'playerA', arrangeScreen, (w) => ({ character: w.wren, sections: [{ section: 'hp', shown: Math.random() < 2 }, { section: crypto.randomUUID(), shown: true }] }), true),
  rule("a player can't arrange someone else's character’s screen", 'playerB', arrangeScreen, (w) => ({ character: w.wren, sections: [{ section: 'hp', shown: false }] }), false),
  rule('the GM can arrange any character’s screen', 'gm', arrangeScreen, (w) => ({ character: w.ash, sections: [{ section: crypto.randomUUID(), shown: false }] }), true),
  rule('a player can prepare spells for their own character', 'playerA', prepareSpells, (w) => ({ character: w.wren, prepared: [{ spell: crypto.randomUUID(), level: 1 }], slots: [1] }), true),
  rule("a player can't prepare spells for someone else's character", 'playerB', prepareSpells, (w) => ({ character: w.wren, prepared: [{ spell: 'glimmer', level: 1 }], slots: [1] }), false),
  rule("the GM can prepare any character's spells", 'gm', prepareSpells, (w) => ({ character: w.ash, prepared: [{ spell: crypto.randomUUID(), level: 1 }], slots: [1] }), true),
  rule('a player can mark a use of their own character’s ability', 'playerA', useAbility, (w) => ({ character: w.wren, ability: crypto.randomUUID(), spent: 1, of: 2 }), true),
  rule("a player can't mark a use of someone else's ability", 'playerB', useAbility, (w) => ({ character: w.wren, ability: 'Ember ward', spent: 1, of: 2 }), false),
  rule("an outsider can't mark a use", 'outsider', useAbility, (w) => ({ character: w.wren, ability: 'Ember ward', spent: 1, of: 2 }), false),
  // The magic state (dec-8 piece A): choose for the next rest, Same as yesterday, cast, undo a cast; the GM's set is the GM's alone.
  rule('a player can choose spells for their own character’s next rest', 'playerA', chooseSpells, (w) => ({ character: w.wren, chosen: [{ spell: crypto.randomUUID(), level: 1 }], slots: [1] }), true),
  rule("a player can't choose spells for someone else's character", 'playerB', chooseSpells, (w) => ({ character: w.wren, chosen: [{ spell: 'mire-lamp', level: 1 }], slots: [1] }), false),
  rule("the GM can choose any character's spells", 'gm', chooseSpells, (w) => ({ character: w.ash, chosen: [{ spell: crypto.randomUUID(), level: 1 }], slots: [1] }), true),
  rule("an outsider can't choose a character's spells", 'outsider', chooseSpells, (w) => ({ character: w.wren, chosen: null, slots: [1] }), false),
  rule('a player can pick the same spells as yesterday for their own character', 'playerA', sameAsYesterday, async (w) => (await w.freshReadySpell('wren'), { character: w.wren }), true),
  rule("a player can't pick the same spells as yesterday for someone else's character", 'playerB', sameAsYesterday, (w) => ({ character: w.wren }), false),
  rule('a player can cast a ready spell of their own character', 'playerA', castSpell, async (w) => ({ character: w.wren, ...(await w.freshReadySpell('wren')) }), true),
  rule("a player can't cast someone else's spell", 'playerB', castSpell, async (w) => ({ character: w.wren, ...(await w.freshReadySpell('wren')) }), false),
  rule("the GM can cast any character's ready spell", 'gm', castSpell, async (w) => ({ character: w.ash, ...(await w.freshReadySpell('ash')) }), true),
  rule('a player can undo a cast of their own character', 'playerA', uncastSpell, async (w) => ({ character: w.wren, ...(await w.freshReadySpell('wren', true)) }), true),
  rule("an outsider can't undo a cast", 'outsider', uncastSpell, async (w) => ({ character: w.wren, ...(await w.freshReadySpell('wren', true)) }), false),
  rule("the GM can set any character's spells", 'gm', setSpells, (w) => ({ character: w.wren, ready: [{ spell: crypto.randomUUID(), level: 1 }], chosen: null, spellsCast: {} }), true),
  rule("a player can't set their own character's spells the GM's way", 'playerA', setSpells, (w) => ({ character: w.wren, ready: [{ spell: 'mire-lamp', level: 1 }] }), false),
  rule("a player can't set someone else's spells", 'playerB', setSpells, (w) => ({ character: w.wren, ready: [] }), false),
  // Pins for spells and traits (dec-13 C8, pin-2): the owner of an approved character or the GM, nobody else.
  rule('a player can pin a spell of their own character to At hand', 'playerA', pinToAtHand, (w) => ({ character: w.wren, kind: 'spell' as const, key: crypto.randomUUID(), pinned: true }), true),
  rule('a player can pin a trait of their own character to At hand', 'playerA', pinToAtHand, (w) => ({ character: w.wren, kind: 'trait' as const, key: crypto.randomUUID(), pinned: true }), true),
  rule("a player can't pin anything for someone else's character", 'playerB', pinToAtHand, (w) => ({ character: w.wren, kind: 'spell' as const, key: 'mire-lamp', pinned: true }), false),
  rule("the GM can pin for any character", 'gm', pinToAtHand, (w) => ({ character: w.ash, kind: 'trait' as const, key: crypto.randomUUID(), pinned: true }), true),
  rule("an outsider can't pin for a character", 'outsider', pinToAtHand, (w) => ({ character: w.wren, kind: 'spell' as const, key: 'mire-lamp', pinned: true }), false),
  // Moving a pin in the player's order (euf-4, row P2; the detailed log): the owner or the GM, nobody else.
  rule('a player can move a pin of their own character', 'playerA', movePin, async (w) => ({ character: w.wren, key: (await w.freshPins('wren'))[1]!, at: 0 }), true),
  rule("the GM can move a pin on any character", 'gm', movePin, async (w) => ({ character: w.ash, key: (await w.freshPins('ash'))[1]!, at: 0 }), true),
  rule("a player can't move a pin on someone else's character", 'playerB', movePin, async (w) => ({ character: w.wren, key: (await w.freshPins('wren'))[1]!, at: 0 }), false),
  rule("an outsider can't move a pin on a character", 'outsider', movePin, async (w) => ({ character: w.wren, key: (await w.freshPins('wren'))[1]!, at: 0 }), false),
  rule("a player can set their own character's AC by hand", 'playerA', setAc, (w) => ({ character: w.wren, ac: Math.floor(Math.random() * 900) }), true),
  rule("a player can't set someone else's character's AC", 'playerB', setAc, (w) => ({ character: w.wren, ac: 7 }), false),
  rule("the GM can set any character's AC by hand", 'gm', setAc, (w) => ({ character: w.ash, ac: -Math.floor(Math.random() * 900) }), true),
  rule("an outsider can't set a character's AC", 'outsider', setAc, (w) => ({ character: w.wren, ac: 7 }), false),
  // The class form (eq-8, ruled 2026-11-04): the owner or the GM switches it, like the rest of the play state.
  rule("a player can switch their own character's form", 'playerA', setForm, (w) => ({ character: w.wren, form: { id: 'dusk-phase', name: 'Dusk phase' } }), true),
  rule("a player can't switch someone else's character's form", 'playerB', setForm, (w) => ({ character: w.wren, form: { id: 'dusk-phase', name: 'Dusk phase' } }), false),
  // A real form, not null: the GM's AC case above has already made Ash's play row (form null), so null would change
  // nothing and log nothing.
  rule("the GM can switch any character's form", 'gm', setForm, (w) => ({ character: w.ash, form: { id: 'dawn-phase', name: 'Dawn phase' } }), true),
  rule("an outsider can't switch a character's form", 'outsider', setForm, (w) => ({ character: w.wren, form: { id: 'dusk-phase', name: 'Dusk phase' } }), false),
  // The fresh line is already approved, so approving it changes nothing (nothing to log).
  quiet(rule("the GM can approve a player's one-off", 'gm', approveItem, async (w) => ({ line: await w.freshLine('wren') }), true)),
  // (A player approving their own waiting one-off is refused too: supabase/tests/add-item.test.ts.)
  rule("a player can't approve someone else's item", 'playerB', approveItem, async (w) => ({ line: await w.freshLine('wren') }), false),
  rule("the GM can decline a player's one-off", 'gm', declineItem, async (w) => ({ line: await w.freshLine('wren') }), true),
  // (Declining is a removal: a player can always drop their own item, so the line that matters is someone else's.)
  rule("a player can't decline someone else's item", 'playerB', declineItem, async (w) => ({ line: await w.freshLine('wren') }), false),
  rule('a player can give their own item to someone outside the party', 'playerA', giveAway, async (w) => ({ line: await w.freshLine('wren'), qty: 3, of: 3, to: 'Old Marsh' }), true),
  rule("a player can't give away someone else's item", 'playerB', giveAway, async (w) => ({ line: await w.freshLine('wren'), qty: 3, of: 3, to: 'Old Marsh' }), false),
  rule('a player can enter a roll everyone may see', 'playerA', recordRoll, (w) => ({ campaignId: w.campaignId, expression: '2d10', result: 11, purpose: 'charges' as const, gmOnly: false }), true),
  rule("a player can't enter a roll only the GM may see", 'playerA', recordRoll, (w) => ({ campaignId: w.campaignId, expression: '2d10', result: 11, purpose: 'charges' as const, gmOnly: true }), false),
  rule('the GM can enter a roll only the GM may see', 'gm', recordRoll, (w) => ({ campaignId: w.campaignId, expression: '2d10', result: 7, purpose: 'charges' as const, gmOnly: true }), true),
  // The clock, sessions and expeditions (M5 step 5; 03: the GM only). The GM's cases run in a fresh campaign each, so
  // they never meet a session or an expedition left running by another case.
  rule('the GM can start a session', 'gm', startSession, async (w) => ({ campaignId: await w.freshCampaign(false) }), true),
  rule("a player can't start a session", 'playerA', startSession, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can end the session', 'gm', endSession, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, session: await w.freshSession(campaignId) };
  }, true),
  rule("a player can't end the session", 'playerA', endSession, async (w) => ({ campaignId: w.campaignId, session: await w.freshSession(w.campaignId) }), false),
  // "Not now" on "Which season?" (ruled 2026-10-30): the GM's, kept with the campaign until the next session.
  rule('the GM can leave the season unset until the next session', 'gm', seasonNotNow, async (w) => ({ campaignId: await w.freshCampaign(false) }), true),
  rule("a player can't leave the season unset", 'playerA', seasonNotNow, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can start an expedition', 'gm', startExpedition, async (w) => ({ campaignId: await w.freshCampaign(false), mode: 'dungeon' }), true),
  rule('the GM can start an expedition at a place', 'gm', startExpedition, async (w) => ({ campaignId: await w.freshCampaign(false), mode: 'dungeon', place: 'The Drowned Stair' }), true),
  rule("a player can't start an expedition", 'playerA', startExpedition, (w) => ({ campaignId: w.campaignId, mode: 'dungeon' }), false),
  rule('the GM can end the expedition', 'gm', endExpedition, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, expedition: await w.freshExpedition(campaignId) };
  }, true),
  rule("a player can't end the expedition", 'playerB', endExpedition, async (w) => ({ campaignId: w.campaignId, expedition: await w.freshExpedition(w.campaignId) }), false),
  // Start and End downtime (M5b step 6a; ST10, ST11 as split by dt-2): the GM's.
  rule('the GM can start downtime', 'gm', startDowntime, async (w) => ({ campaignId: await w.freshTownCampaign(), refills: {} }), true),
  rule("a player can't start downtime", 'playerA', startDowntime, (w) => ({ campaignId: w.campaignId, refills: {} }), false),
  rule('the GM can end downtime', 'gm', endDowntime, async (w) => ({ campaignId: await w.freshCampaign(false) }), true),
  rule("a player can't end downtime", 'playerB', endDowntime, (w) => ({ campaignId: w.campaignId }), false),
  rule('the GM can move on to the next part of the day', 'gm', nextPartOfDay, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), seconds: 28800 };
  }, true),
  rule("a player can't move on to the next part of the day", 'playerA', nextPartOfDay, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), seconds: 28800 }), false),
  rule('the GM can give the party a full rest', 'gm', fullRest, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, expedition: await w.freshExpedition(campaignId, true), refills: {} };
  }, true),
  rule("a player can't give the party a full rest", 'playerA', fullRest, async (w) => ({ campaignId: w.campaignId, expedition: await w.freshExpedition(w.campaignId, true), refills: {} }), false),
  // Use safe paths (of-5, sq-2): the GM's, on the expedition under way.
  rule('the GM can lead the party out by safe paths', 'gm', leaveBySafePaths, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, expedition: await w.freshExpedition(campaignId) };
  }, true),
  rule("a player can't lead the party out by safe paths", 'playerA', leaveBySafePaths, async (w) => ({ campaignId: w.campaignId, expedition: await w.freshExpedition(w.campaignId) }), false),
  // In a safe place? (m8b-0 delivery 5): the GM's answer on End expedition's summary, on an ended expedition.
  rule('the GM can say whether the party ended somewhere safe', 'gm', answerSafePlace, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, expedition: await w.freshExpedition(campaignId, true), safe: true };
  }, true),
  rule("a player can't say whether the party ended somewhere safe", 'playerA', answerSafePlace, async (w) => ({ campaignId: w.campaignId, expedition: await w.freshExpedition(w.campaignId, true), safe: true }), false),
  rule('the GM can take the next turn', 'gm', advanceTime, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), seconds: 600 };
  }, true),
  rule("a player can't move the clock", 'playerA', advanceTime, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), seconds: 600 }), false),
  rule("an outsider can't move the clock", 'outsider', advanceTime, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), seconds: 600 }), false),
  rule('the GM can advance the clock by an odd amount', 'gm', advanceTimeBy, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), seconds: 2400 };
  }, true),
  rule("a player can't advance the clock by an odd amount", 'playerB', advanceTimeBy, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), seconds: 2400 }), false),
  rule('the GM can let a day pass in downtime', 'gm', passDowntime, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), seconds: 86400 };
  }, true),
  rule("a player can't let time pass in downtime", 'playerA', passDowntime, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), seconds: 86400 }), false),
  rule('the GM can correct the time', 'gm', setTime, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), to: 4200 };
  }, true),
  rule("a player can't correct the time", 'playerA', setTime, async (w) => ({ campaignId: w.campaignId, clock: await w.clockOf(w.campaignId), to: 0 }), false),
  // The first day's start time (B13, ruled 2026-11-01; 03: the GM sets the campaign's rules).
  rule('the GM can set the start time while the clock has not moved', 'gm', setStartTime, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, clock: await w.clockOf(campaignId), start: { hour: 6, minute: 0 }, units: timeUnits(DEFAULT_TIME) };
  }, true),
  // A fresh campaign of the player's whose clock hasn't moved: the shared one's clock may have moved in other cases,
  // which would refuse the command for that reason before the database could refuse the player.
  rule("a player can't set the start time", 'playerA', setStartTime, async (w) => {
    const campaignId = await w.freshPlayersCampaign();
    return { campaignId, clock: await w.clockOf(campaignId), start: { hour: 6, minute: 0 }, units: timeUnits(DEFAULT_TIME) };
  }, false),
  rule("an outsider can't enter a roll", 'outsider', recordRoll, (w) => ({ campaignId: w.campaignId, expression: '1d6', result: 3, purpose: 'hp' as const, gmOnly: false }), false),
  // The GM's reminders and checks (M5 step 6; 03: the GM makes and changes reminders and records checks; players see
  // the public reminders and, from the next Downtime, the results).
  rule('the GM can make a reminder', 'gm', addReminder, async (w) => ({ campaignId: await w.freshCampaign(false), fields: reminderFields }), true),
  rule("a player can't make a reminder", 'playerA', addReminder, (w) => ({ campaignId: w.campaignId, fields: reminderFields }), false),
  rule("an outsider can't make a reminder", 'outsider', addReminder, (w) => ({ campaignId: w.campaignId, fields: reminderFields }), false),
  rule('the GM can change or stop a reminder', 'gm', editReminder, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, reminder: await w.freshReminder(campaignId), changes: { active: false } };
  }, true),
  rule("a player can't change a reminder", 'playerB', editReminder, async (w) => ({ campaignId: w.campaignId, reminder: await w.freshReminder(w.campaignId), changes: { isPublic: true } }), false),
  rule('the GM can record a check as a hit or a miss', 'gm', recordCheck, async (w) => ({ campaignId: await w.freshCampaign(false), record: checkRecord }), true),
  rule("a player can't record a check", 'playerA', recordCheck, (w) => ({ campaignId: w.campaignId, record: checkRecord }), false),
  // Check again (05, Once per period; ruled 2026-10-29): the GM's, logged Verbose.
  rule('the GM can check again', 'gm', recordCheckAgain, async (w) => ({ campaignId: await w.freshCampaign(false), record: checkRecord }), true),
  rule("a player can't check again", 'playerB', recordCheckAgain, (w) => ({ campaignId: w.campaignId, record: checkRecord }), false),
  rule('the GM can check now', 'gm', recordCheckNow, async (w) => ({ campaignId: await w.freshCampaign(false), record: checkRecord }), true),
  rule("a player can't check now", 'playerB', recordCheckNow, (w) => ({ campaignId: w.campaignId, record: checkRecord }), false),
  rule("the GM can enter what a hit's table roll read", 'gm', setCheckRoll, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, result: await w.freshCheckResult(campaignId), tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' };
  }, true),
  rule('the GM can reveal a secret check result to the players', 'gm', revealCheck, async (w) => {
    const campaignId = await w.freshCampaign(false);
    // Out on an adventure, so the result is still secret (one recorded in Downtime shows at once).
    await w.onAdventure(campaignId);
    return { campaignId, result: await w.freshCheckResult(campaignId) };
  }, true),
  rule("a player can't reveal a check result", 'playerB', revealCheck, async (w) => ({ campaignId: w.campaignId, result: await w.freshCheckResult(w.campaignId) }), false),
  rule("a player can't enter what a hit's table roll read", 'playerA', setCheckRoll, async (w) => ({ campaignId: w.campaignId, result: await w.freshCheckResult(w.campaignId), tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' }), false),
  // Encounter tables, full screen (M5b step g3; 03: tables, pins and reads are the GM's alone).
  rule('the GM can pin a table for this session', 'gm', pinTable, async (w) => ({ campaignId: await w.freshTableCampaign(), tableId: 'bog-things' }), true),
  rule("a player can't pin a table", 'playerA', pinTable, (w) => ({ campaignId: w.campaignId, tableId: 'bog-things' }), false),
  rule('the GM can unpin a table', 'gm', unpinTable, async (w) => {
    const campaignId = await w.freshTableCampaign();
    return { campaignId, pin: await w.freshTablePin(campaignId) };
  }, true),
  rule("a player can't unpin a table", 'playerB', unpinTable, async (w) => ({ campaignId: w.campaignId, pin: await w.freshTablePin(w.campaignId) }), false),
  rule('the GM can record a row read by hand', 'gm', readTableByHand, async (w) => ({ campaignId: await w.freshTableCampaign(), tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' }), true),
  rule("a player can't record a row read by hand", 'playerA', readTableByHand, (w) => ({ campaignId: w.campaignId, tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' }), false),
  // Encounter waiting (M5b step 2; 03: waiting encounters are the GM's alone).
  rule('the GM can queue a hit as an encounter waiting', 'gm', queueEncounter, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, result: await w.freshCheckResult(campaignId) };
  }, true),
  rule("a player can't queue an encounter", 'playerA', queueEncounter, async (w) => ({ campaignId: w.campaignId, result: await w.freshCheckResult(w.campaignId) }), false),
  rule('the GM can start a waiting encounter', 'gm', startEncounter, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, encounter: await w.freshWaitingEncounter(campaignId) };
  }, true),
  rule('the GM can say which watch was awake', 'gm', setEncounterWatch, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, encounter: await w.freshWaitingEncounter(campaignId), watch: '1st watch, Wren' };
  }, true),
  rule("a player can't say which watch was awake", 'playerA', setEncounterWatch, async (w) => ({ campaignId: w.campaignId, encounter: await w.freshWaitingEncounter(w.campaignId), watch: '1st watch, Wren' }), false),
  rule("a player can't start a waiting encounter", 'playerB', startEncounter, async (w) => ({ campaignId: w.campaignId, encounter: await w.freshWaitingEncounter(w.campaignId) }), false),
  rule('the GM can dismiss a waiting encounter', 'gm', dismissEncounter, async (w) => {
    const campaignId = await w.freshCampaign(false);
    return { campaignId, encounter: await w.freshWaitingEncounter(campaignId) };
  }, true),
  rule("a player can't dismiss a waiting encounter", 'playerA', dismissEncounter, async (w) => ({ campaignId: w.campaignId, encounter: await w.freshWaitingEncounter(w.campaignId) }), false),
  // Lights (M5 step 7; 03 "Light / douse a light source": the GM, or the player for their own carrier).
  rule("a player can light their own character's light", 'playerA', lightLight, async (w) => ({ character: w.wren, light: null, option: glowMoss((await w.freshLine('wren')).id) }), true),
  rule("a player can't light someone else's character's light", 'playerB', lightLight, async (w) => ({ character: w.wren, light: null, option: glowMoss((await w.freshLine('wren')).id) }), false),
  rule("the GM can light any character's light", 'gm', lightLight, async (w) => ({ character: w.ash, light: null, option: glowMoss((await w.freshLine('ash')).id) }), true),
  rule("an outsider can't light a light", 'outsider', lightLight, async (w) => ({ character: w.wren, light: null, option: glowMoss((await w.freshLine('wren')).id) }), false),
  rule("a player can put out their own character's light", 'playerA', douseLight, async (w) => {
    await w.freshLight('wren');
    return { character: w.wren, light: null };
  }, true),
  rule("a player can't put out someone else's light", 'playerB', douseLight, async (w) => {
    await w.freshLight('wren');
    return { character: w.wren, light: null };
  }, false),
  rule("the GM can put out any character's light", 'gm', douseLight, async (w) => {
    await w.freshLight('ash');
    return { character: w.ash, light: null };
  }, true),
  rule("a player can switch Keep lit on for their own light", 'playerA', keepLightLit, async (w) => {
    await w.freshLight('wren');
    return { character: w.wren, light: null, keep: true };
  }, true),
  rule("a player can't switch Keep lit for someone else's light", 'playerA', keepLightLit, async (w) => {
    await w.freshLight('ash');
    return { character: w.ash, light: null, keep: true };
  }, false),
  rule("a player can refill their own character's lamp from its pack", 'playerA', refillLight, async (w) => {
    await w.freshLight('wren', true);
    return { character: w.wren, light: null };
  }, true),
  rule("a player can't refill someone else's lamp", 'playerB', refillLight, async (w) => {
    await w.freshLight('wren', true);
    return { character: w.wren, light: null };
  }, false),
  rule("an outsider can't refill a lamp", 'outsider', refillLight, async (w) => {
    await w.freshLight('ash', true);
    return { character: w.ash, light: null };
  }, false),
  // Today's weather (M5b; 03 "Weather roll", ruled 2026-10-30, D1, A10): any player while players roll it (the
  // default), the GM always; only the GM changes it once it's in.
  rule('a player can enter the weather roll while players roll it', 'playerA', enterWeather, async (w) => weatherEntry(await w.freshWeather('players'), 'players'), true),
  rule("a player can't enter the weather roll when the GM rolls it", 'playerA', enterWeather, async (w) => weatherEntry(await w.freshWeather('gm'), 'gm'), false),
  rule('the GM can enter the weather roll instead', 'gm', enterWeather, async (w) => weatherEntry(await w.freshWeather('players'), 'players'), true),
  rule("an outsider can't enter the weather roll", 'outsider', enterWeather, async (w) => weatherEntry(await w.freshWeather('players'), 'players'), false),
  rule("the GM can change today's weather", 'gm', correctWeather, async (w) => {
    const weather = await w.freshWeatherRoll();
    return { campaignId: weather.campaignId, weather, tableId: weather.tableId, roll: '5' };
  }, true),
  rule("a player can't change today's weather", 'playerA', correctWeather, async (w) => {
    const weather = await w.freshWeatherRoll();
    return { campaignId: weather.campaignId, weather, tableId: weather.tableId, roll: '5' };
  }, false),
  // Marching order (M5 step 8; 03 "Set marching order": the GM, and players while "Players can reorder marching
  // order" is on. No lock since B11 (p2p-21 and flag 5, ruled 2026-11-18): a lock stored earlier stops nobody, in the
  // app or in the database; the old lock command stays the GM's, though no screen reaches it).
  rule('a player can move the marching order', 'playerA', setMarchingOrder, async (w) => await w.marching(), true),
  rule('the GM can move the marching order', 'gm', setMarchingOrder, async (w) => await w.marching(), true),
  rule("an outsider can't move the marching order", 'outsider', setMarchingOrder, async (w) => await w.marching(), false),
  rule('a player can still move it in a campaign locked before the lock went', 'playerB', setMarchingOrder, async (w) => await w.marching({ locked: true }), true),
  rule('the GM can move it in a campaign locked before the lock went', 'gm', setMarchingOrder, async (w) => await w.marching({ locked: true }), true),
  rule("a player can't move it when players can't reorder it", 'playerA', setMarchingOrder, async (w) => await w.marching({ playersReorder: false }), false),
  rule("a player can't move it when players can't reorder it, locked or not", 'playerB', setMarchingOrder, async (w) => await w.marching({ locked: true, playersReorder: false }), false),
  rule("the GM can move it when players can't reorder it", 'gm', setMarchingOrder, async (w) => await w.marching({ playersReorder: false }), true),
  rule('a player can save the marching order as a preset', 'playerA', saveMarchingPreset, async (w) => ({ ...(await w.marching()), name: `Ford ${crypto.randomUUID().slice(0, 4)}` }), true),
  rule("a player can't save a preset when players can't reorder it", 'playerB', saveMarchingPreset, async (w) => ({ ...(await w.marching({ playersReorder: false })), name: 'Ford' }), false),
  rule('a player can use a saved preset', 'playerB', applyMarchingPreset, async (w) => ({ ...(await w.marching()), name: 'Tunnel' }), true),
  rule("an outsider can't use a preset", 'outsider', applyMarchingPreset, async (w) => ({ ...(await w.marching()), name: 'Tunnel' }), false),
  rule('the GM can lock the marching order', 'gm', lockMarchingOrder, async (w) => ({ ...(await w.marching()), locked: true }), true),
  rule("a player can't lock the marching order", 'playerA', lockMarchingOrder, async (w) => ({ ...(await w.marching()), locked: true }), false),
  rule('a player can delete a saved order', 'playerA', deleteMarchingPreset, async (w) => {
    const made = await w.marching();
    return { ...made, name: 'Tunnel' };
  }, true),
  rule("a player can't delete a saved order when players can't reorder it", 'playerB', deleteMarchingPreset, async (w) => ({ ...(await w.marching({ playersReorder: false })), name: 'Tunnel' }), false),
  // Travel (M5b step 1; 03: Move…, the budget and Lost are the GM's; Force march is the players' button; the recovery
  // roll is a player's only while Getting lost is Open).
  // (After the marching cases: the split one leaves Wren in a group of their own, which the party cases below put back.)
  rule("the GM can start the day's budget", 'gm', startTravelDay, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, group: 1, day: 0, total: 8, pace: 'foot' as const, gmPerDay: null };
  }, true),
  rule("a player can't start the day's budget", 'playerA', startTravelDay, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, group: 1, day: 0, total: 8, pace: 'foot' as const, gmPerDay: null };
  }, false),
  rule('the GM can move the party (Move…)', 'gm', travelMove, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel(), cost: 3, terrainId: 'bog', routeId: null, placeName: 'The Sunken Causeway', placeId: null }), true),
  rule("a player can't move the party", 'playerB', travelMove, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel(), cost: 3, terrainId: 'bog', routeId: null, placeName: null, placeId: null }), false),
  rule('the GM can set the budget by hand', 'gm', setTravelBudget, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel(), total: 6, pace: 'riding' as const, gmPerDay: 6 }), true),
  rule("a player can't set the budget", 'playerA', setTravelBudget, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel(), total: 6, pace: 'foot' as const, gmPerDay: 6 }), false),
  rule('a player can force march their own group', 'playerA', forceMarch, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: true }, row: await w.freshTravel(), added: 4 }), true),
  rule('the GM can force march a group', 'gm', forceMarch, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: false }, row: await w.freshTravel(), added: 4 }), true),
  rule("a player can't force march a group they aren't in", 'playerB', forceMarch, async (w) => {
    const group = await w.party('split');
    return { target: { campaignId: w.campaignId, group, mine: false }, row: await w.freshTravel(group), added: 4 };
  }, false),
  // Activities (M5b step 3, D3): a member with a character in the group, or the GM; Undo is the author's or the GM's.
  // (Wren is in a group of their own after the force march cases: the allowed ones bring the party together, the
  // last splits it again, as the cases after it found it.)
  rule("a player can't do an activity for a group they aren't in", 'playerB', applyActivity, async (w) => {
    const group = await w.party('split');
    await w.freshTravel(group);
    return { ...gatherInput(w, group), target: { ...gatherInput(w, group).target, mine: false } };
  }, false),
  rule('a player can do an activity with their own group', 'playerA', applyActivity, async (w) => {
    await w.party('together');
    await w.freshTravel();
    return gatherInput(w, 1);
  }, true),
  rule('the GM can do an activity for a group', 'gm', applyActivity, async (w) => {
    await w.party('together');
    await w.freshTravel();
    return { ...gatherInput(w, 1), target: { ...gatherInput(w, 1).target, mine: false } };
  }, true),
  // ac-1 (2026-11-11): in an activity one character does, a player names only their own characters; the GM anyone.
  rule("a player can't name another player's character in an activity one character does", 'playerA', applyActivity, async (w) => {
    await w.party('together');
    await w.freshTravel();
    return { ...gatherInput(w, 1), actorIds: [w.ash.id], finderId: w.ash.id, target: { ...gatherInput(w, 1).target, ownersNamed: [w.userId('playerB')] } };
  }, false),
  rule("the GM can name a player's character in an activity one character does", 'gm', applyActivity, async (w) => {
    await w.party('together');
    await w.freshTravel();
    return { ...gatherInput(w, 1), actorIds: [w.ash.id], finderId: w.ash.id, target: { ...gatherInput(w, 1).target, mine: false, ownersNamed: [w.userId('playerB')] } };
  }, true),
  rule("an outsider can't do an activity", 'outsider', applyActivity, async (w) => {
    await w.freshTravel();
    return gatherInput(w, 1);
  }, false),
  rule('a player can undo their own activity', 'playerA', undoActivity, async (w) => ({ campaignId: w.campaignId, runId: await w.freshActivityRun(), authorUserId: w.userId('playerA') }), true),
  rule("the GM can undo a player's activity", 'gm', undoActivity, async (w) => ({ campaignId: w.campaignId, runId: await w.freshActivityRun(), authorUserId: w.userId('playerA') }), true),
  rule("a player can't undo another player's activity", 'playerB', undoActivity, async (w) => {
    const runId = await w.freshActivityRun();
    await w.party('split');
    return { campaignId: w.campaignId, runId, authorUserId: w.userId('playerA') };
  }, false),
  // A forced march's Undo (fm-1, ruled 2026-11-10): the player who marched, or the GM. Another player of the same
  // group reads the line (it is the group's) but can't undo it.
  rule('a player can undo their own forced march', 'playerA', undoChange, (w) => w.freshMarch('playerA'), true),
  rule("a player can't undo another player's forced march", 'playerB', undoChange, (w) => w.freshMarch('playerA'), false),
  rule("the GM can undo a player's forced march", 'gm', undoChange, (w) => w.freshMarch('playerA'), true),
  // Camp (M5b step 4, D5): a player of the group makes camp; the GM for anyone, a player for their own characters, from their own pack.
  rule('a player can make camp for their own group', 'playerA', openCamp, async (w) => {
    await w.party('together');
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, group: 1, mine: true }, day: 0 };
  }, true),
  rule("a player can't make camp for a group they aren't in", 'playerB', openCamp, async (w) => {
    const group = await w.party('split');
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, group, mine: false }, day: 0 };
  }, false),
  rule("an outsider can't make camp", 'outsider', openCamp, async (w) => {
    await w.party('together');
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, group: 1, mine: true }, day: 0 };
  }, false),
  rule('a player can eat in camp from their own pack', 'playerA', eatAtCamp, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, fromPot: false, lineId };
  }, true),
  rule('the GM can eat in camp for anyone', 'gm', eatAtCamp, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, fromPot: false, lineId };
  }, true),
  rule("a player can't eat for another player's character", 'playerB', eatAtCamp, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, fromPot: false, lineId };
  }, false),
  rule('a player can cook in camp from their own pack', 'playerA', cookAtCamp, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, ingredients: [{ lineId, qty: 1 }], portions: 2 };
  }, true),
  rule("a player can't cook from another player's pack", 'playerB', cookAtCamp, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, ingredients: [{ lineId, qty: 1 }], portions: 2 };
  }, false),
  rule("a player can't put another player's firewood on the fire", 'playerB', addCampFuel, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, lineId, qty: 1, secondsEach: 3600 };
  }, false),
  rule("an outsider can't put firewood on the fire", 'outsider', addCampFuel, async (w) => {
    const { campId, lineId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, lineId, qty: 1, secondsEach: 3600 };
  }, false),
  rule('a player can lead campfire talk for their own character', 'playerA', campTalk, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, outcome: 'worked' as const };
  }, true),
  rule("a player can't lead campfire talk for another player's character", 'playerB', campTalk, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, outcome: 'worked' as const };
  }, false),
  // Camp's night (M5b step 4, part 2): the watches are the group's; sleep a player's own (the difficulty the GM's); the apply the GM's.
  rule('a player can set their group\'s watches', 'playerA', setCampWatches, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, watches: [[w.wren.id]] };
  }, true),
  rule("an outsider can't set the watches", 'outsider', setCampWatches, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, watches: [[w.wren.id]] };
  }, false),
  rule('a player can say how their own character slept', 'playerA', campSleep, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, roll: '4', outcome: 'good' as const };
  }, true),
  rule("a player can't change how hard sleep is", 'playerA', campSleep, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, difficulty: 'easy' };
  }, false),
  rule("a player can't say how another player's character slept", 'playerB', campSleep, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, outcome: 'bad' as const };
  }, false),
  rule('the GM can change how hard sleep is', 'gm', campSleep, async (w) => {
    const { campId } = await w.freshCamp();
    return { campId, actor: { campaignId: w.campaignId, id: w.wren.id, ownerUserId: w.userId('playerA') }, difficulty: 'easy' };
  }, true),
  rule('the GM can apply the camp', 'gm', applyCamps, async (w) => {
    const { campId } = await w.freshCamp();
    return { campaignId: w.campaignId, camps: [campId] };
  }, true),
  rule("a player can't apply the camp", 'playerA', applyCamps, async (w) => {
    const { campId } = await w.freshCamp();
    return { campaignId: w.campaignId, camps: [campId] };
  }, false),
  rule("an outsider can't force march", 'outsider', forceMarch, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: true }, row: await w.freshTravel(), added: 4 }), false),
  rule('the GM can spend the day looking', 'gm', spendTravelDay, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel() }), true),
  rule("a player can't spend the day looking", 'playerA', spendTravelDay, async (w) => ({ campaignId: w.campaignId, row: await w.freshTravel() }), false),
  rule('the GM can mark a group Lost', 'gm', setLost, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, group: 1, day: 0 };
  }, true),
  rule("a player can't mark a group Lost", 'playerB', setLost, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, group: 1, day: 0 };
  }, false),
  rule('a player can enter the recovery roll while Getting lost is Open', 'playerA', enterLostRoll, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: true, gettingLost: 'open' as const }, lost: await w.freshLost(true), roll: '3' }), true),
  rule("a player can't enter the recovery roll while Getting lost is Secret", 'playerA', enterLostRoll, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: true, gettingLost: 'secret' as const }, lost: await w.freshLost(false), roll: '3' }), false),
  rule('the GM can enter the recovery roll while Secret', 'gm', enterLostRoll, async (w) => ({ target: { campaignId: w.campaignId, group: 1, mine: false, gettingLost: 'secret' as const }, lost: await w.freshLost(false), roll: '3' }), true),
  rule('the GM can say Found the way', 'gm', resolveLost, async (w) => ({ campaignId: w.campaignId, lost: await w.freshLost(false), outcome: 'found' as const, day: 1 }), true),
  rule("a player can't say Found the way, even while Open", 'playerA', resolveLost, async (w) => ({ campaignId: w.campaignId, lost: await w.freshLost(true), outcome: 'found' as const, day: 1 }), false),
  // Party groups (M5 step 8; ruled 2026-10-30, DG14): each player picks their own character's group, the GM anyone's;
  // Join up: the GM, or a player while the groups are together. The last case leaves the party together again.
  rule('a player can split their own character off', 'playerA', chooseGroup, async (w) => {
    await w.party('together');
    return { character: w.wren, group: null };
  }, true),
  rule("a player can't move another player's character", 'playerA', chooseGroup, async (w) => ({ character: w.ash, group: null }), false),
  rule("an outsider can't move a character", 'outsider', chooseGroup, async (w) => ({ character: w.wren, group: 1 }), false),
  rule("the GM can move anyone's character", 'gm', chooseGroup, async (w) => ({ character: w.ash, group: await w.party('split') }), true),
  rule("an outsider can't join up the groups", 'outsider', joinUp, async (w) => ({ campaignId: w.campaignId, together: true, from: await w.party('split'), into: 1 }), false),
  rule('a player can join up the groups while they are together', 'playerB', joinUp, async (w) => ({ campaignId: w.campaignId, together: true, from: await w.party('split'), into: 1 }), true),
  rule('the GM can join up the groups', 'gm', joinUp, async (w) => ({ campaignId: w.campaignId, together: false, from: await w.party('split'), into: 1 }), true),
  // Statuses (M5 step 9; 03: the GM adds them (M5 gate C1, 2026-11-01: never the player, not even on their own
  // character); the GM and the owner remove and step them; secret timers the GM only).
  rule("a player can't put a status on their own character", 'playerA', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: false }, status: muddyBoots }), false),
  rule("the GM can put a status on a player's character", 'gm', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: false }, status: muddyBoots }), true),
  rule("a player can't put a status on someone else's character", 'playerB', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: false }, status: muddyBoots }), false),
  rule('the GM can put a status on any character, with a secret timer', 'gm', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.ash], secret: true }, status: fenSight }), true),
  rule("a player can't keep a status's timer secret", 'playerA', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: true }, status: fenSight }), false),
  rule("an outsider can't put a status on anyone", 'outsider', addStatus, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: false }, status: muddyBoots }), false),
  rule('a player can remove a status from their own character', 'playerA', removeStatus, async (w) => ({ character: w.wren, status: await w.freshStatus('wren') }), true),
  rule("a player can't remove a status from someone else's character", 'playerB', removeStatus, async (w) => ({ character: w.wren, status: await w.freshStatus('wren') }), false),
  rule("the GM can remove any character's status", 'gm', removeStatus, async (w) => ({ character: w.ash, status: await w.freshStatus('ash') }), true),
  rule("a player can step their own character's status up a level", 'playerA', stepStatus, async (w) => ({ character: w.wren, status: await w.freshStatus('wren', true), step: 1 as const }), true),
  rule("a player can't step someone else's status", 'playerB', stepStatus, async (w) => ({ character: w.wren, status: await w.freshStatus('wren', true), step: 1 as const }), false),
  // The time left (the GM's stepper, follow-up to the status rings): the GM's only, not even the character's player.
  rule("the GM can change a status's time left", 'gm', setStatusTime, async (w) => ({ character: w.wren, status: await w.freshStatus('wren', false, true), secondsLeft: 1200 }), true),
  rule("a player can't change the time left of their own character's status", 'playerA', setStatusTime, async (w) => ({ character: w.wren, status: await w.freshStatus('wren', false, true), secondsLeft: 1200 }), false),
  rule("an outsider can't change a status's time left", 'outsider', setStatusTime, async (w) => ({ character: w.wren, status: await w.freshStatus('wren', false, true), secondsLeft: 1200 }), false),
  // Rest this turn (DG5; 03: the player for their own characters, the GM for anyone; the GM's Next turn applies it).
  rule('a player can choose Rest this turn for their own character', 'playerA', chooseRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren] }, resting: true };
  }, true),
  rule("a player can't choose rest for someone else's character", 'playerB', chooseRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren] }, resting: true };
  }, false),
  rule('the GM can mark everyone resting (Rested)', 'gm', chooseRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren, w.ash] }, resting: true };
  }, true),
  rule('the GM can push on, marking the rest condition', 'gm', pushOn, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren, w.ash], secret: false }, status: weary }), true),
  rule("a player can't push on for the party", 'playerA', pushOn, (w) => ({ target: { campaignId: w.campaignId, characters: [w.wren], secret: false }, status: weary }), false),
  // The shared rest flow (M5b g6, B5): a player answers for their own characters; the GM for anyone (a tap flips a
  // row; Everyone rests / No one rests). The Rest button calls a rest for the caller's own character's group.
  rule('a player can answer Push on for their own character', 'playerA', answerRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren] }, answer: 'push' as const };
  }, true),
  rule("a player can't answer for someone else's character", 'playerB', answerRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren] }, answer: 'rest' as const };
  }, false),
  rule('the GM can answer for everyone (Everyone rests)', 'gm', answerRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { target: { campaignId: w.campaignId, characters: [w.wren, w.ash] }, answer: 'rest' as const };
  }, true),
  rule("a player can call a rest for their own character's group", 'playerA', callRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { character: w.wren };
  }, true),
  rule("a player can't call a rest as someone else's character", 'playerB', callRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { character: w.wren };
  }, false),
  rule("an outsider can't call a rest", 'outsider', callRest, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { character: w.wren };
  }, false),
  // Places (M5 step 11; 03: the current location, Show players: the GM's). Players read a place only once shown.
  rule('the GM can move a group to another place (Where now?)', 'gm', setPlace, async (w) => {
    await w.freshPlace();
    return { campaignId: w.campaignId, group: 1, name: 'The Bone Stair' };
  }, true),
  rule("a player can't move the party to another place", 'playerA', setPlace, async (w) => {
    await w.freshPlace();
    return { campaignId: w.campaignId, group: 1, name: 'The Bone Stair' };
  }, false),
  // Move on (December step 4, piece c; pt-f2, pt-f3): the party to a linked place and the clock on by the way's turns,
  // in one request. The GM's alone, as Where now? and Advance by… are. The party whole (not split).
  rule('the GM can move the party on to a place and the clock on with it', 'gm', moveOn, async (w) => {
    // In a campaign of its own (as the clock's own cases are): moving the shared campaign's clock on ended another
    // case's status timer (a second logged line) and left later cases' expeditions starting after time 0 (CI run
    // 43038879900). A fresh campaign has no split party either (ruled 2026-11-11: a split party is refused).
    const { campaignId, placeId } = await w.freshMovePlace();
    return { campaignId, placeId, turns: 2, seconds: 1200, clock: await w.clockOf(campaignId), way: { by: 'row', name: 'Rowing' } };
  }, true),
  rule("a player can't move the party on", 'playerA', moveOn, async (w) => {
    const visit = await w.freshPlace();
    return { campaignId: w.campaignId, placeId: visit.placeId!, turns: 2, seconds: 1200, clock: await w.clockOf(w.campaignId), way: { by: 'row', name: 'Rowing' } };
  }, false),
  rule("an outsider can't move the party on", 'outsider', moveOn, async (w) => {
    const visit = await w.freshPlace();
    return { campaignId: w.campaignId, placeId: visit.placeId!, turns: 2, seconds: 1200, clock: await w.clockOf(w.campaignId) };
  }, false),
  // Coming back (M5b g2b, gp-5): the shows a return visit brings back are the GM's, like every place command.
  rule('the GM can bring back what was shown on the last visit', 'gm', backAtPlace, async (w) => ({ campaignId: w.campaignId, row: await w.freshReturnVisit() }), true),
  rule("a player can't bring back a visit's shows", 'playerB', backAtPlace, async (w) => ({ campaignId: w.campaignId, row: await w.freshReturnVisit() }), false),
  // Places from packs (M8b slice 0; ⚑ 1: the picker is the GM's alone): making one, and Start or Where now? by id.
  rule("the GM can make a place from an attached pack's location", 'gm', placeFromPack, async (w) => ({ campaignId: w.campaignId, entry: await w.freshPackPlace() }), true),
  rule("a player can't make a place from a pack", 'playerA', placeFromPack, async (w) => ({ campaignId: w.campaignId, entry: await w.freshPackPlace() }), false),
  // A place's rules (December dec-7 piece 3; mc-51, rg-5): the GM's eye on a rule and the stand-in check's toggle.
  rule("the GM can open or close a place's rule to players", 'gm', setRuleEye, async (w) => { const e = await w.freshPackPlace(); return { campaignId: w.campaignId, packId: e.packId, entryId: e.packEntryId, ruleId: 'slick-piles', open: false }; }, true),
  rule("a player can't open a place's rule", 'playerA', setRuleEye, async (w) => { const e = await w.freshPackPlace(); return { campaignId: w.campaignId, packId: e.packId, entryId: e.packEntryId, ruleId: 'slick-piles', open: true }; }, false),
  rule("an outsider can't open a place's rule", 'outsider', setRuleEye, async (w) => { const e = await w.freshPackPlace(); return { campaignId: w.campaignId, packId: e.packId, entryId: e.packEntryId, ruleId: 'slick-piles', open: true }; }, false),
  rule("the GM can switch a place's own check off", 'gm', setCheckInForce, async (w) => { const e = await w.freshPackPlace(); return { campaignId: w.campaignId, packId: e.packId, entryId: e.packEntryId, on: false }; }, true),
  rule("a player can't switch a place's own check", 'playerB', setCheckInForce, async (w) => { const e = await w.freshPackPlace(); return { campaignId: w.campaignId, packId: e.packId, entryId: e.packEntryId, on: false }; }, false),
  rule('the GM can start an expedition at a place picked by id', 'gm', startExpedition, async (w) => {
    const { campaignId, placeId } = await w.freshIdlePlace();
    return { campaignId, mode: 'dungeon', placeId };
  }, true),
  rule('the GM can move a group to a place picked by id (Where now?)', 'gm', setPlace, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, group: 1, name: '', placeId: row.placeId };
  }, true),
  rule("a player can't move the party to a place picked by id", 'playerB', setPlace, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, group: 1, name: '', placeId: row.placeId };
  }, false),
  // Pieces (M5b g2, B1; 03: Show players is the GM's). Players read only shown pieces, through scene_pieces.
  rule('the GM can add a piece to a place', 'gm', addPiece, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, placeId: row.placeId!, kind: 'clue' as const, text: 'Wet footprints by the door' };
  }, true),
  rule("a player can't add a piece to a place", 'playerA', addPiece, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, placeId: row.placeId!, kind: 'clue' as const, text: 'Sneaky words' };
  }, false),
  // After they're added (M5b g2b, gp-4): edit and remove are the GM's.
  rule("the GM can edit a piece's kind and text", 'gm', editPiece, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, piece: row.pieces[0]!, kind: 'clue' as const, text: 'An archway to the east, dark beyond' };
  }, true),
  rule("a player can't edit a piece", 'playerA', editPiece, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, piece: row.pieces[0]!, kind: 'clue' as const, text: 'Sneaky words' };
  }, false),
  rule('the GM can remove a piece', 'gm', removePiece, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, piece: row.pieces[0]! };
  }, true),
  rule("a player can't remove a piece", 'playerB', removePiece, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, piece: row.pieces[0]! };
  }, false),
  rule('the GM can show players one piece', 'gm', showPiece, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, row, piece: row.pieces[0]! };
  }, true),
  rule("a player can't show a piece", 'playerB', showPiece, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, row, piece: row.pieces[0]! };
  }, false),
  rule('the GM can hide a piece again', 'gm', hidePiece, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, row, piece: row.pieces[0]! };
  }, true),
  rule("a player can't hide a piece", 'playerA', hidePiece, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, row, piece: row.pieces[0]! };
  }, false),
  // Calls to adventure (dec-12 piece B): the GM sends a hook to the party or to a character; a player can't.
  rule('the GM can send a call to adventure to the party', 'gm', sendHook, async (w) => ({ campaignId: w.campaignId, ...(await w.freshAdventureHook()), actorId: null, body: 'A bounty on the Bog lurker, nailed to the quay post.', pays: 'Ten silver a head' }), true),
  rule('the GM can send a call to adventure to one character', 'gm', sendHook, async (w) => ({ campaignId: w.campaignId, ...(await w.freshAdventureHook()), actorId: w.wren.id, body: 'A Lantern Warden never came back from the weirs.', pays: '' }), true),
  rule("a player can't send a call to adventure", 'playerA', sendHook, async (w) => ({ campaignId: w.campaignId, ...(await w.freshAdventureHook()), actorId: null, body: 'A bounty on the Bog lurker.', pays: '' }), false),
  rule("an outsider can't send a call to adventure", 'outsider', sendHook, async (w) => ({ campaignId: w.campaignId, ...(await w.freshAdventureHook()), actorId: null, body: 'A bounty on the Bog lurker.', pays: '' }), false),
  // A rumour (dec-12 piece E): the GM gives a row's words to the party or to a character; a player can't.
  rule('the GM can give a rumour to the party', 'gm', giveRumour, async (w) => ({ campaignId: w.campaignId, ...(await w.freshRumour()), actorId: null }), true),
  rule('the GM can give a rumour to one character', 'gm', giveRumour, async (w) => ({ campaignId: w.campaignId, ...(await w.freshRumour()), actorId: w.wren.id }), true),
  rule("a player can't give a rumour", 'playerA', giveRumour, async (w) => ({ campaignId: w.campaignId, ...(await w.freshRumour()), actorId: null }), false),
  rule("an outsider can't give a rumour", 'outsider', giveRumour, async (w) => ({ campaignId: w.campaignId, ...(await w.freshRumour()), actorId: null }), false),
  // A shop's stock for the day (W12): the GM sets a thing in or out, or resets the things with a chance; a player can't.
  rule('the GM can set a thing in stock for the day', 'gm', setStock, (w) => ({ campaignId: w.campaignId, serviceId: 'perm-shop', itemId: `perm-${crypto.randomUUID()}`, day: 1, answer: 'in' as const }), true),
  rule("a player can't set a thing in stock", 'playerA', setStock, (w) => ({ campaignId: w.campaignId, serviceId: 'perm-shop', itemId: `perm-${crypto.randomUUID()}`, day: 1, answer: 'in' as const }), false),
  rule("an outsider can't set a thing in stock", 'outsider', setStock, (w) => ({ campaignId: w.campaignId, serviceId: 'perm-shop', itemId: `perm-${crypto.randomUUID()}`, day: 1, answer: 'out' as const }), false),
  // Nothing to put back on "?" in a fresh shop: allowed, and no line written.
  quiet(rule("the GM can reset a shop's stock", 'gm', resetStock, (w) => ({ campaignId: w.campaignId, serviceId: 'perm-shop', day: 1, itemIds: ['perm-rope'] }), true)),
  rule("a player can't reset a shop's stock", 'playerA', resetStock, (w) => ({ campaignId: w.campaignId, serviceId: 'perm-shop', day: 1, itemIds: ['perm-rope'] }), false),
  rule('the GM can hide every piece at once', 'gm', hideAllPieces, async (w) => ({ campaignId: w.campaignId, row: await w.freshPlace(true) }), true),
  rule("a player can't hide every piece", 'playerA', hideAllPieces, async (w) => ({ campaignId: w.campaignId, row: await w.freshPlace(true) }), false),
  rule("the GM can write the place's description and notes", 'gm', editPlace, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, description: 'Moths cover the walls.', notes: { traps: 'A tripwire by the door.' } };
  }, true),
  rule("a player can't write a place's description", 'playerA', editPlace, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, description: 'Sneaky words.' };
  }, false),
  // Safe and Hostile (M5b step 6b; ST2, 03: set by the GM). Players never read a place's safety.
  rule('the GM can mark a place safe', 'gm', setPlaceSafety, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, safety: 'safe' as const };
  }, true),
  rule("a player can't mark a place hostile", 'playerA', setPlaceSafety, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, safety: 'hostile' as const };
  }, false),
  // The town screen (M5b step 6c; ST3): Show players and Open / Closed on a place in town are the GM's.
  rule('the GM can show players a place in town', 'gm', showTownPlace, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, entry: { key: 'service:stall', name: 'A stall', group: 'shop' as const }, shown: true };
  }, true),
  rule("a player can't show a place in town", 'playerA', showTownPlace, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, entry: { key: 'service:stall', name: 'A stall', group: 'shop' as const }, shown: true };
  }, false),
  // A piece of a place in town (W4c, ge-1): the GM shows or hides it while the party is in the town; a player can't.
  rule('the GM can show players a piece of a place in town', 'gm', showTownPiece, async (w) => ({ campaignId: w.campaignId, ...(await w.freshTownPart()) }), true),
  rule("a player can't show a piece of a place in town", 'playerA', showTownPiece, async (w) => ({ campaignId: w.campaignId, ...(await w.freshTownPart()) }), false),
  rule('the GM can hide a piece of a place in town', 'gm', hideTownPiece, async (w) => ({ campaignId: w.campaignId, ...(await w.freshTownPart(true)) }), true),
  rule("a player can't hide a piece of a place in town", 'playerB', hideTownPiece, async (w) => ({ campaignId: w.campaignId, ...(await w.freshTownPart(true)) }), false),
  rule('the GM can close a place in town', 'gm', openTownPlace, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, entry: { key: 'lodging:an inn', name: 'An inn', group: 'lodging' as const }, open: false };
  }, true),
  rule("a player can't close a place in town", 'playerA', openTownPlace, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, entry: { key: 'lodging:an inn', name: 'An inn', group: 'lodging' as const }, open: false };
  }, false),
  // A place's picture (M5b step 1 follow-up, build order 7): the GM's alone, upload and link.
  rule("the GM can upload a place's picture", 'gm', addPlacePicture, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, image: new Blob(['moth'], { type: 'image/jpeg' }) };
  }, true),
  rule("a player can't upload a place's picture", 'playerA', addPlacePicture, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, image: new Blob(['moth'], { type: 'image/jpeg' }) };
  }, false),
  rule("the GM can take a place's picture off", 'gm', setPlacePicture, async (w) => {
    const row = await w.freshPlace(false, true);
    return { campaignId: w.campaignId, place: row.place!, assetId: null };
  }, true),
  rule("a player can't change a place's picture", 'playerA', setPlacePicture, async (w) => {
    const row = await w.freshPlace(true, true);
    return { campaignId: w.campaignId, place: row.place!, assetId: null };
  }, false),
  // A place's map (dec-7 5m-2): the GM's alone, the copy's upload and its tie to the place.
  rule("the GM can upload a place's map", 'gm', addPlaceMap, async (w) => {
    const row = await w.freshPlace();
    return { campaignId: w.campaignId, place: row.place!, title: 'The harbour chart', image: new Blob(['chart'], { type: 'image/png' }) };
  }, true),
  rule("a player can't upload a place's map", 'playerA', addPlaceMap, async (w) => {
    const row = await w.freshPlace(true);
    return { campaignId: w.campaignId, place: row.place!, title: 'The harbour chart', image: new Blob(['chart'], { type: 'image/png' }) };
  }, false),
  rule("the GM can take a place's map off", 'gm', setPlaceMap, async (w) => {
    const row = await w.freshPlace(false, false, true);
    return { campaignId: w.campaignId, place: row.place!, assetId: null };
  }, true),
  rule("a player can't change a place's map", 'playerA', setPlaceMap, async (w) => {
    const row = await w.freshPlace(true, false, true);
    return { campaignId: w.campaignId, place: row.place!, assetId: null };
  }, false),
  // The map's eye (dec-7 5m-3): only the GM shares a map with the players or takes it back.
  rule('the GM can share a map with the players', 'gm', shareMap, async (w) => ({ campaignId: w.campaignId, assetId: await w.freshMap(), shown: true }), true),
  rule("a player can't share a map", 'playerA', shareMap, async (w) => ({ campaignId: w.campaignId, assetId: await w.freshMap(), shown: true }), false),
  // (A GM naming another campaign of theirs, where can() rightly says yes, with this campaign's map: refused by the
  // write, which is tied to the campaign named; in placeMap.test.ts and supabase/tests/dec-7-5m-3-map-eye.test.ts.)
  rule("an outsider can't share a map", 'outsider', shareMap, async (w) => ({ campaignId: w.campaignId, assetId: await w.freshMap(), shown: true }), false),
  // Messaging (M5b g4, B3; 03: the GM writes to any character in play, a player to the GM as their own character,
  // never as another's; only the two parties read; a picture only from the GM, which the database and the bucket
  // refuse a player (supabase/tests/m5b-g4-messages.test.ts)).
  rule('the GM can write to a character', 'gm', sendMessages, (w) => ({ campaignId: w.campaignId, to: [{ id: w.wren.id, ownerUserId: w.wren.ownerUserId ?? '' }], draft: { body: 'A cold draught from the east.', disappears: false, attachment: null } }), true),
  rule('a player can write to the GM as their own character', 'playerA', sendMessages, (w) => ({ campaignId: w.campaignId, to: [{ id: w.wren.id, ownerUserId: w.wren.ownerUserId ?? '' }], draft: { body: 'Is the figure moving?', disappears: false, attachment: null } }), true),
  rule("a player can't write as another player's character", 'playerB', sendMessages, (w) => ({ campaignId: w.campaignId, to: [{ id: w.wren.id, ownerUserId: w.wren.ownerUserId ?? '' }], draft: { body: 'Sneaky words.', disappears: false, attachment: null } }), false),
  rule("an outsider can't write to anyone", 'outsider', sendMessages, (w) => ({ campaignId: w.campaignId, to: [{ id: w.wren.id, ownerUserId: w.wren.ownerUserId ?? '' }], draft: { body: 'Sneaky words.', disappears: false, attachment: null } }), false),
  // The `recipient` flag is the app's copy; the database's read_messages is the real gate (the not-allowed case runs it
  // for real as Player B, who the message wasn't written to, and is refused).
  rule('the recipient can read a message', 'playerA', readMessages, async (w) => ({ campaignId: w.campaignId, messageIds: [await w.freshMessage()], recipient: true }), true),
  rule("a player it wasn't written to can't read it", 'playerB', readMessages, async (w) => ({ campaignId: w.campaignId, messageIds: [await w.freshMessage()], recipient: false }), false),
  // Got it (K20, pk-13): only the character's own player marks its finds seen, on an approved character.
  rule("a player marks their own approved character's finds seen", 'playerA', markFindsSeen, (w) => ({ character: w.wren }), true),
  rule("a player can't mark another player's character's finds seen", 'playerA', markFindsSeen, (w) => ({ character: w.ash }), false),
  rule("a player can't mark their own unapproved character's finds seen", 'playerA', markFindsSeen, async (w) => ({ character: await w.freshCharacter('playerA', 'pending') }), false),
  rule("the GM can't mark a player's character's finds seen", 'gm', markFindsSeen, (w) => ({ character: w.wren }), false),
  rule("an outsider can't mark a character's finds seen", 'outsider', markFindsSeen, (w) => ({ character: w.wren }), false),
  // Requests (M5 step 12; 03: players send for their own characters and withdraw their own while they wait; the GM
  // answers, and asks for escape rolls; the player a roll is asked of enters it, anyone the party's).
  rule('a player can send a request for their own character', 'playerA', sendRequest, (w) => ({ character: w.wren, kind: 'describe' as const, text: 'Pry the idol loose.' }), true),
  rule("a player can't send a request for another player's character", 'playerB', sendRequest, (w) => ({ character: w.wren, kind: 'describe' as const, text: 'Sneaky words.' }), false),
  rule("the GM can't send a request (no character of theirs asks)", 'gm', sendRequest, (w) => ({ character: w.wren, kind: 'describe' as const, text: 'Sneaky words.' }), false),
  rule("an outsider can't send a request", 'outsider', sendRequest, (w) => ({ character: w.wren, kind: 'describe' as const, text: 'Sneaky words.' }), false),
  rule('a requester can cancel their request while it waits', 'playerA', withdrawRequest, async (w) => ({ request: await w.freshRequest() }), true),
  rule("another player can't cancel someone else's request", 'playerB', withdrawRequest, async (w) => ({ request: await w.freshRequest() }), false),
  rule("the GM can't cancel a player's request", 'gm', withdrawRequest, async (w) => ({ request: await w.freshRequest() }), false),
  // M5 review fixes: the GM takes back what the GM asked; the player it was asked of can't.
  rule('the GM can take back an escape roll they asked for', 'gm', withdrawRequest, async (w) => ({ request: await w.freshAsked('each') }), true),
  rule("a player can't take back what the GM asked of them", 'playerA', withdrawRequest, async (w) => ({ request: await w.freshAsked('each') }), false),
  // The full sheet revised (B): a player asks the GM for a score or Max HP on their approved character; they take it
  // back while it waits; only the GM approves or refuses it.
  rule("a player asks the GM to change their own character's Max HP", 'playerA', requestSheetChange, (w) => ({ character: w.wren, field: HP_MAX_FIELD, label: 'Max HP', to: 100 + Math.floor(Math.random() * 8000) }), true),
  rule("a player can't ask for a change to someone else's character", 'playerB', requestSheetChange, (w) => ({ character: w.wren, field: HP_MAX_FIELD, label: 'Max HP', to: 12 }), false),
  rule("the GM doesn't ask: their own edit applies at once", 'gm', requestSheetChange, (w) => ({ character: w.wren, field: HP_MAX_FIELD, label: 'Max HP', to: 12 }), false),
  rule("an outsider can't ask for a sheet change", 'outsider', requestSheetChange, (w) => ({ character: w.wren, field: HP_MAX_FIELD, label: 'Max HP', to: 12 }), false),
  rule('a player takes back their own waiting sheet change', 'playerA', takeBackSheetChange, async (w) => ({ change: await w.freshSheetChange() }), true),
  rule("another player can't take back someone else's sheet change", 'playerB', takeBackSheetChange, async (w) => ({ change: await w.freshSheetChange() }), false),
  rule("the GM can't take back a player's sheet change (they refuse it)", 'gm', takeBackSheetChange, async (w) => ({ change: await w.freshSheetChange() }), false),
  rule('the GM approves a sheet change', 'gm', approveSheetChange, async (w) => ({ change: await w.freshSheetChange() }), true),
  rule("a player can't approve their own sheet change", 'playerA', approveSheetChange, async (w) => ({ change: await w.freshSheetChange() }), false),
  rule('the GM refuses a sheet change with a reason', 'gm', refuseSheetChange, async (w) => ({ change: await w.freshSheetChange(), reason: 'Not after one night at the inn.' }), true),
  rule("a player can't refuse a sheet change", 'playerB', refuseSheetChange, async (w) => ({ change: await w.freshSheetChange(), reason: 'No.' }), false),
  rule('a player can enter their own escape roll', 'playerA', enterRequest, async (w) => ({ request: await w.freshAsked('each'), entry: { roll: 12, on: [] } }), true),
  rule("another player can't enter someone else's escape roll", 'playerB', enterRequest, async (w) => ({ request: await w.freshAsked('each'), entry: { roll: 12, on: [] } }), false),
  rule("any player can enter the party's roll", 'playerB', enterRequest, async (w) => ({ request: await w.freshAsked('party'), entry: { roll: 9, on: [] } }), true),
  // C7 (M5 gate, ruled 2026-11-01): the GM may enter a roll for a player without a device.
  rule('the GM can enter a roll for a player without a device', 'gm', enterRequest, async (w) => ({ request: await w.freshAsked('each'), entry: { roll: 12, on: [] } }), true),
  // M5b step 6e: the requester replies to a priced answer; a player picks a listed lodging for their own character.
  rule("a requester can decline the GM's offer", 'playerA', replyRequest, async (w) => ({ request: await w.freshOffer(), accept: false }), true),
  rule("another player can't reply to someone else's offer", 'playerB', replyRequest, async (w) => ({ request: await w.freshOffer(), accept: true }), false),
  rule("the GM can't reply for the player", 'gm', replyRequest, async (w) => ({ request: await w.freshOffer(), accept: true }), false),
  // W11b (bu-1): only the buyer undoes their own purchase; the GM and everyone else are refused.
  rule('the buyer can undo their own purchase', 'playerA', undoBuy, async (w) => ({ request: await w.freshPurchase() }), true),
  rule("another player can't undo someone else's purchase", 'playerB', undoBuy, async (w) => ({ request: await w.freshPurchase() }), false),
  rule("the GM can't undo a player's purchase with the buyer's Undo", 'gm', undoBuy, async (w) => ({ request: await w.freshPurchase() }), false),
  rule("an outsider can't undo a purchase", 'outsider', undoBuy, async (w) => ({ request: await w.freshPurchase() }), false),
  rule('a player can pick a lodging the GM shows for their own character', 'playerA', chooseStay, async (w) => {
    const inn = await w.freshInn();
    return { character: w.wren, stay: { listed: true, key: inn.key, name: inn.name, rate: '2 sp a night', at: 0, town: inn.town } };
  }, true),
  rule("a player can't pick a lodging for another player's character", 'playerB', chooseStay, async (w) => {
    const inn = await w.freshInn();
    return { character: w.wren, stay: { listed: true, key: inn.key, name: inn.name, rate: '2 sp a night', at: 0, town: inn.town } };
  }, false),
  rule("the GM can't pick a lodging for a player's character", 'gm', chooseStay, async (w) => {
    const inn = await w.freshInn();
    return { character: w.wren, stay: { listed: true, key: inn.key, name: inn.name, rate: '2 sp a night', at: 0, town: inn.town } };
  }, false),
  rule('the GM can answer a request', 'gm', answerRequest, async (w) => ({ request: await w.freshRequest(), answer: { kind: 'yesNo' as const, yes: true, turns: 0, note: '' } }), true),
  rule("a player can't answer their own request", 'playerA', answerRequest, async (w) => ({ request: await w.freshRequest(), answer: { kind: 'yesNo' as const, yes: true, turns: 0, note: '' } }), false),
  // M5b step 3: the GM's Yes to a secret activity takes its cost off the group's day; a player can't answer.
  rule('the GM can answer a secret activity with its cost', 'gm', answerRequest, async (w) => ({ request: await w.freshSecretRequest(), answer: { kind: 'yesNo' as const, yes: true, turns: 0, note: '' }, activity: { spend: 2 } }), true),
  rule("a player can't answer a secret activity", 'playerA', answerRequest, async (w) => ({ request: await w.freshSecretRequest(), answer: { kind: 'yesNo' as const, yes: true, turns: 0, note: '' }, activity: { spend: 2 } }), false),
  rule('the GM can ask for escape rolls (Leave the dungeon)', 'gm', askRequests, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, kind: 'escapeRoll' as const, who: 'each' as const, prompt: { roll: { save: 'breath' }, modifiers: [], depth: 0, levelsDown: 1 } };
  }, true),
  rule("a player can't ask the party for rolls", 'playerA', askRequests, async (w) => {
    await w.freshExpedition(w.campaignId);
    return { campaignId: w.campaignId, kind: 'escapeRoll' as const, who: 'each' as const, prompt: {} };
  }, false),

  // M5b step 0c, slice 1: the spell book (cr-13).
  rule('a player writes the spell book of their waiting character', 'playerA', setSpellBook, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), spellIds: ['glimmer', 'reed-whisper'] }), true),
  rule('a player writes the spell book of their draft', 'playerA', setSpellBook, async (w) => ({ character: await w.freshCharacter('playerA', 'draft'), spellIds: ['glimmer'] }), true),
  rule("a player can't write the spell book of their approved character (no First spells left to finish)", 'playerA', setSpellBook, (w) => ({ character: w.wren, spellIds: ['glimmer'] }), false),
  rule("another player can't write someone else's spell book", 'playerB', setSpellBook, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), spellIds: ['glimmer'] }), false),
  rule('the GM writes any spell book', 'gm', setSpellBook, (w) => ({ character: w.wren, spellIds: ['glimmer', 'mire-grip'] }), true),
  rule("an outsider can't write a spell book", 'outsider', setSpellBook, (w) => ({ character: w.wren, spellIds: ['glimmer'] }), false),

  // M5b step 0c, follow-up C: Change › on Scores, Race or Class after the draft exists (cf-7).
  rule('a player redoes the scores, race or class of their draft', 'playerA', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'draft'), choice: redoChoice }), true),
  // 04: before approval, so a waiting or sent-back character too (the database's party test keeps the same rule).
  rule('a player redoes their waiting character', 'playerA', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), choice: redoChoice }), true),
  rule('a player redoes their sent-back character', 'playerA', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'rejected'), choice: redoChoice }), true),
  rule("a player can't redo their approved character", 'playerA', redoCreation, (w) => ({ character: w.wren, choice: redoChoice }), false),
  rule("another player can't redo someone else's draft", 'playerB', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'draft'), choice: redoChoice }), false),
  // The GM: any character the database lets the GM change (04: after approval only the GM changes class and race); the
  // app offers it only while the character isn't approved (the refund is a draft's), so no approved case is listed.
  rule('the GM redoes a waiting character', 'gm', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'pending'), choice: redoChoice }), true),
  rule("an outsider can't redo a draft", 'outsider', redoCreation, async (w) => ({ character: await w.freshCharacter('playerA', 'draft'), choice: redoChoice }), false),

  // M5b step 6.0, the town switches (sw-1: the GM sets them; players only see their state).
  rule('the GM can switch Out and about today on', 'gm', setOutDay, async (w) => ({ campaignId: await w.freshCampaign(false), on: true }), true),
  rule("a player can't switch Out and about today on", 'playerA', setOutDay, (w) => ({ campaignId: w.campaignId, on: true }), false),
  rule("an outsider can't switch Out and about today on", 'outsider', setOutDay, (w) => ({ campaignId: w.campaignId, on: true }), false),
  rule('the GM can switch Active tonight on', 'gm', setActiveNight, async (w) => ({ campaignId: await w.freshCampaign(false), on: true }), true),
  rule("a player can't switch Active tonight on", 'playerA', setActiveNight, (w) => ({ campaignId: w.campaignId, on: true }), false),
  // A fresh campaign has both off, so the reset changes nothing (supabase/tests/m5b-6-0-town-switches.test.ts logs one).
  quiet(rule('the GM can reset the town switches at the morning', 'gm', resetTownSwitches, async (w) => ({ campaignId: await w.freshCampaign(false) }), true)),
  rule("a player can't reset the town switches", 'playerA', resetTownSwitches, (w) => ({ campaignId: w.campaignId }), false),
];
