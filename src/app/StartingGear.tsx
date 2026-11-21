// The Gear step (M5b step 0c, slice 5; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-14; mockup
// creation/06-gear), on the creation step shell: the starting money (the pack's dice, rolled at the table and typed),
// the class's kits as pick rows (contents in one line, cost, weight, page; the row opens what's in it and where it
// lands), a rolled kit's rolls as range-first rows tapped one per roll (the app never rolls; when every roll is tapped
// the kit is taken), Browse the shop › (the Add item sheet's creation variant: Gold to spend, Undo last, Done
// shopping), and a tally of spent, left and the load with its tier live from the campaign's encumbrance rule. Each
// take or buy lands in the pack at once with Undo, and is saved, so nothing is lost if the app closes. Next checks
// only overspending (and that the money roll was typed). It reopens from the review with what was bought (no step
// counter there). A kit's things land where Add item would put them (ruled 2026-10-26); before approval, putting
// something back refunds its full price (ruled 2026-10-26).
// Follow-up A (cf-4, ruled 2026-11-02): the setting's `startingEquipment` is a Given group at the top (ticked, never
// put back here, in the pack and so in the load), and Browse the shop is absent when `startingGear.shop` is false.
import { packAndPage } from '../modules/library/sourceTitles.ts';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { draftRollLabel, recordRoll } from '../core/rolls.ts';
import type { Db } from '../core/supabase.ts';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { loadCreationRecord } from '../core/characterSheet.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import {
  coinsOf,
  entryMoneyOf,
  gearContextOf,
  gearHint,
  gearProblem,
  givenGearOf,
  givenPicksOf,
  kindredItems,
  kitContents,
  kitPrice,
  kitRolls,
  kitsOffered,
  kitsToPick,
  nextTakeWords,
  kitTaken,
  moneyCoin,
  noRollPicks,
  pickFull,
  pickMeta,
  pickRows,
  pickTitle,
  piecesName,
  piecesOf,
  piecesWords,
  priceOf,
  purchasesOf,
  rangeWords,
  readMoney,
  shortOf,
  showMoney,
  gearHelp,
  shopOpen,
  startingEquipment,
  startingPicks,
  weightWords,
  type GearPick,
  type KitItem,
  gearSignature,
  type Purchase,
} from '../modules/characters/startingGear.ts';
import { isKitContainer, kitGroups, placeKit, type KitPiece, type PlacedPiece } from '../modules/characters/kitPlaces.ts';
import { raceAsPlayed } from '../modules/characters/creation.ts';
import { SPECIAL_NOTE, withStepApprovals, type SpecialApproval } from '../modules/characters/creationSteps.ts';
import { diceAverage, diceRange, diceTimes, diceWithoutCoin, outsideDice } from '../modules/characters/creationRules.ts';
import { carriedLoad, toLoadLine, type CarriedLoad } from '../modules/inventory/encumbrance.ts';
import { addItem, loadInventory, loadInventorySettings, removeItem, setItemQty, type CarrierRef, type InventoryLine } from '../modules/inventory/inventory.ts';
import { isContainer, isSeparate } from '../modules/inventory/packView.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { AddItem, bundleOf, copyOf, forSale, oneOffCopy } from './AddItem.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { equipCheckWith, loadEquipContext, type EquipContext } from './EquipWarning.tsx';
import { LoadSummary } from './LoadSummary.tsx';
import { registry } from './services.ts';
import { ApprovalFold, AVERAGE_LINE, AverageStepper, CreationStep, DetailRow, EntryPanel, FoldedGroup, PickGroup, PickRow, PickTableFold, RolledPicks, RollSequence, type BookTapRow, type RolledPick, type RollSequenceRow } from '../ui/creation.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { WarningLine } from '../ui/parts.tsx';
import { fromLabel, isLong, trinketName, trinketOf, type TrinketPick } from '../modules/characters/kindredTables.ts';
import { creationTablesOf, OneTableSheet } from './KindredTables.tsx';
import { useErrorToast, useToast } from '../ui/ToastHost.tsx';
import { blurbOf } from '../modules/characters/creationGuide.ts';
import { patronGarbGiven } from './patronGarb.ts';
import { garbMissingLine } from '../modules/characters/patrons.ts';

type Picks = (number | undefined)[][];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A one-off line (rc-3: a `{ name }` line) as an entry the step can place: no library item, no data. */
const oneOffEntry = (name: string): ResolvedEntry => ({ kind: 'item', packEntryId: `one-off:${name}`, name, data: {}, packId: '', alsoIn: [], preferred: false }) as unknown as ResolvedEntry;
/** How many times a roll is made, in words: "twice", "3 times". */
const timesWords = (n: number) => (n === 2 ? 'twice' : `${n} times`);
const isOneOff = (entry: ResolvedEntry) => entry.packEntryId.startsWith('one-off:') && !entry.entryId;

/** The money roll already recorded: the record's `moneyRecorded`; a record from before the Gear step recorded its starting money when it was made. */
function recordedMoney(record: Record<string, unknown>): number | null {
  if ('moneyRecorded' in record) return typeof record.moneyRecorded === 'number' ? record.moneyRecorded : null;
  return typeof record.startingMoney === 'number' ? record.startingMoney : null;
}

export function StartingGear({
  db,
  user,
  setting,
  character,
  name,
  classRef,
  raceRef = null,
  patronGarb = null,
  moneyRoll,
  money,
  onMoney,
  creation,
  title,
  counter,
  why,
  help,
  onBack,
  onDone,
  onUndone,
  onLater,
}: {
  db: Db;
  user: CurrentUser;
  setting: CampaignSetting;
  character: CharacterRef;
  name: string;
  classRef: string;
  /** The character's kindred, whose `startingItems` join the Given group (cs-2); null or left out without one. */
  raceRef?: string | null;
  /** The setting's roll ("3d6 × 10 gp"), for its prompt and its coin; '' when the setting has none. */
  moneyRoll: string;
  /** The money as typed (kept by the caller, so Back keeps it). */
  money: string;
  onMoney: (text: string) => void;
  /**
   * The holy garb the character's patron gives free at this level (December 1a; pt-6: every tier reached), from
   * patronGarb.ts; null or left out without a patron. Given once, as the Given group is; a changed patron's garb is
   * taken back out and the new one's put in when the step next opens.
   */
  patronGarb?: { id: string; name: string; itemIds: string[]; words: Map<string, string> } | null;
  /** The character's creation record; what's spent and bought is saved into it. */
  creation: Record<string, unknown>;
  title: string;
  /** "Step N of M" in creation; left out when it reopens from the review. */
  counter?: { at: number; of: number };
  why: string;
  /** The pack's own help for the step; null falls back to the app's (cw-4), by what the step offers. */
  help: string | null;
  /** Back, with the record as saved. */
  onBack: (creation: Record<string, unknown>) => void;
  /** Next (after its check), with the record as saved. */
  onDone: (creation: Record<string, unknown>) => void;
  /**
   * The Undo of Next's take (cs-42) runs after the step has gone on: the record it saved, so the caller keeps it and
   * Back to Gear reads what is in the pack (#786's review).
   */
  onUndone?: (creation: Record<string, unknown>) => void;
  /** Decide later: the record as saved; left out when the step is required or it reopens from the review. */
  onLater?: (creation: Record<string, unknown>) => Promise<void>;
}) {
  const id = useId();
  const coins = coinsOf(setting.rulesSets);
  const unit = moneyCoin(moneyRoll, coins);
  const show = (base: number) => showMoney(base, coins, unit);
  const [record, setRecord] = useState<Record<string, unknown>>(creation);
  const [spent, setSpent] = useState(typeof creation.spentBase === 'number' ? creation.spentBase : 0);
  const [bought, setBought] = useState<Purchase[]>(() => purchasesOf(creation.bought));
  // A rolled kit's tapped rows, per kit (Back keeps them through the record's purchases).
  const [rollPicks, setRollPicks] = useState<Record<string, Picks>>(() => Object.fromEntries(purchasesOf(creation.bought).flatMap((p) => (p.kitId && p.picks ? [[p.kitId, p.picks]] : []))));
  // A kit's rolls open as a Roll sequence (cw-11, Design's answer 3): the kit, the step it's on, the taps so far, and
  // what the status line says when Next or a closed row needs explaining. Nothing is kept until Done.
  // `only`: Change on one roll in the kit's entry (Francis, retest 2): the sequence opens at that roll alone, and Done keeps it.
  const [rolling, setRolling] = useState<{ kitId: string; at: number; picks: Picks; said: string | null; only?: boolean } | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [shopping, setShopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();
  const toast = useToast();

  // Starting coin (cw-11, Design's answer 2): the stepper starts at the setting's usual (the money dice's average,
  // rounded down, times its "× N") until the player steps or types it. Untouched, the record says so (`moneyTouched: false`, read by slice D's `coinRolled`), so
  // the review and the GM's card read "100, the usual (not rolled)", and no roll is recorded; touched, it was rolled.
  // A record from before this kept a typed number: rolled.
  const usual = moneyRoll ? diceAverage(moneyRoll) : null;
  const [touched, setTouched] = useState(() => money.trim() !== '' && !(creation.moneyTouched === false && readMoney(money) === creation.startingMoney));
  const moneyShown = !touched && usual !== null && money.trim() === '' ? String(usual) : money;
  const isUsual = !touched && usual !== null && readMoney(moneyShown) === usual;

  // The latest spent and bought, for the async takes and the toasts' Undo (which run after a render or two).
  const live = useRef({ spent, bought, record, isUsual });
  const moneyText = useRef(moneyShown);
  useEffect(() => {
    live.current = { spent, bought, record, isUsual };
    moneyText.current = moneyShown;
  });

  const moneyNow = readMoney(moneyShown);
  // As the step opened, for From the review's Back to review while nothing changed (P22; the creation follow-up).
  const [openedWith] = useState(() => gearSignature(creation, { shown: moneyShown, usual: isUsual }));
  /**
   * A coin the dice can't give (final drafts D, Francis 2026-11-06: "I put 19 gold when the max is 18"): the row says so
   * with the sign and the limit, Next explains and goes on, and the GM's card shows it as an exception. Never clamped.
   */
  const outside = (value: number | null, isUsualNow: boolean) => (moneyRoll && !isUsualNow ? outsideDice(moneyRoll, value) : null);
  const coinOutside = outside(moneyNow, isUsual);
  /** The coin's exception for the GM (the existing flagged-pick path, step `gear`): one while it's outside the dice. */
  const coinApproval = (value: number | null, isUsualNow: boolean): SpecialApproval[] => {
    const range = diceRange(moneyRoll);
    return outside(value, isUsualNow) && range && value !== null
      ? [{ step: 'gear' as const, entryId: 'starting-coin', name: `Starting coin ${value}`, requirement: `${diceWithoutCoin(moneyRoll)} gives ${range.min} to ${range.max}` }]
      : [];
  };
  /** The coin typed or stepped (touched: it was rolled). The step is the roll's "× N"; never below 0, and 0 says why. */
  const setCoin = (text: string) => {
    setTouched(true);
    onMoney(text);
  };
  const stepCoin = (by: 1 | -1) => {
    const now = moneyNow ?? usual ?? 0;
    const step = diceTimes(moneyRoll);
    if (by < 0 && now <= 0) return void toast({ text: 'Starting coin can’t go below 0.' });
    const next = Math.min(999999, Math.max(0, now + by * step));
    if (next === now) return void toast({ text: 'That’s as high as starting coin goes here: type it if you rolled more.' });
    setCoin(String(next));
  };
  // Coins a trait-list entry adds (rc-2 `money`, kept on the record by list), in the money's coin.
  const extraMoney = entryMoneyOf(record);
  const left = ((moneyNow ?? 0) + extraMoney) * unit.valueInBase - spent;
  const carrier: CarrierRef = { campaignId: character.campaignId, actorId: character.id, locationId: null, ownerUserId: character.ownerUserId, archived: false };
  // Refunds only before approval; after, gear changes go through the Pack (ruled 2026-10-26).
  const refunds = character.approval !== 'approved';
  // Only items in play: a kit, given or picked line naming one an option switches off is left out (of-3), like one the setting lacks.
  const item = (itemId: string) => entriesInPlay(setting.items).find((e) => e.packEntryId === itemId);
  // A kit gated by an optional rule that's off isn't offered (a quick-equipment kit; ct-10; the shared reader, of-3).
  const kitEntries = entriesInPlay(setting.all).filter((e) => e.kind === 'startingKit');
  // A class with no kit of its own is offered every kit, each needing the GM's special approval (after-test A4).
  const { kits, special: specialKits } = kitsOffered(kitEntries, classRef);
  const className = setting.all.find((e) => e.kind === 'class' && e.packEntryId === classRef)?.name ?? 'your class';
  /** The special approvals the kits taken need (after-test A4): one per kit taken that isn't the class's own. */
  const kitApprovals = (taken: readonly Purchase[]): SpecialApproval[] =>
    specialKits
      ? taken.flatMap((p) => {
          const kit = kits.find((k) => k.packEntryId === p.kitId || (!p.kitId && p.label === k.name));
          return kit ? [{ step: 'gear' as const, entryId: kit.packEntryId, name: kit.name, requirement: `${className} has no kit of its own` }] : [];
        })
      : [];
  const raceEntry = raceRef ? (setting.all.find((e) => e.kind === 'race' && e.packEntryId === raceRef) ?? null) : null;
  const classEntry = setting.all.find((e) => e.kind === 'class' && e.packEntryId === classRef) ?? null;
  // What a kit line depends on (cs-6, G-88): the size and armour substitutes of the kindred as the class plays it,
  // and the class (eq-9: a kit roll with `forClasses` shows only to those classes).
  const ctx = gearContextOf(
    raceAsPlayed(raceEntry, classEntry)?.data,
    (id) => item(id)?.name,
    classRef,
    (id) => {
      const found = item(id);
      return found ? (piecesName(found.data) ?? undefined) : undefined;
    },
  );
  // A line the setting has (a one-off by name, rc-3, has no library item: it waits for the GM like any player one-off).
  const entriesOf = (lines: KitItem[]) =>
    lines.flatMap((l) => {
      if (!l.itemId) return l.name ? [{ entry: oneOffEntry(l.name), qty: l.qty }] : [];
      const found = item(l.itemId);
      return found ? [{ entry: found, qty: l.qty, ...(l.units !== undefined ? { units: l.units } : {}) }] : [];
    });
  const words = (lines: KitItem[]) =>
    entriesOf(lines)
      // Single pieces by their own name (a kit's `units` line: "4 iron rations", not "Rations · 4", which reads as 4 bundles).
      .map((l) => (l.units !== undefined ? piecesWords(l.entry.name, l.entry.data, l.units) : l.qty > 1 ? `${l.entry.name} ×${l.qty}` : l.entry.name))
      .join(', ');
  const priced = (entry: ResolvedEntry) => priceOf(entry.data.value, coins, unit);
  // No shop when the setting says so (cf-4: `startingGear.shop` false, resolved for the campaign's options).
  const shop = moneyRoll && shopOpen(setting.rulesSets) ? entriesInPlay(setting.items).filter((e) => forSale(e) && priced(e) !== null) : [];
  // What everyone starts with (cf-4, 07 `startingEquipment`): the Given group, put in the pack once, never taken back here.
  // The kindred's starting items join them (cs-2), as the class plays the kindred (a kindred-class replaces them, cs-4).
  const fromSetting = entriesOf(startingEquipment(setting.rulesSets, ctx));
  const fromKindred = entriesOf(kindredItems(raceAsPlayed(raceEntry, classEntry)?.data));
  const given = [...fromSetting, ...fromKindred];
  // The patron's garb (December 1a): the items of every tier reached, free, in their own group. An id no attached
  // pack has is left out, like any given line the setting lacks.
  const fromPatron = patronGarb ? entriesOf(startingEquipment([{ startingEquipment: patronGarb.itemIds }], ctx)) : [];
  // A garb item this device can't find is named on the step, never dropped silently (the review of #636): the pack
  // that holds it isn't attached, or an option switches it off.
  const garbMissing = patronGarb ? [...new Set(patronGarb.itemIds)].filter((itemId) => !item(itemId)) : [];
  // The setting's given picks (of-11, G-83: "up to 4 from the adventuring items"): rows of a table players can read.
  const tablesInPlay = entriesInPlay(setting.all).filter((e) => e.kind === 'table');
  const gearPicks = startingPicks(setting.rulesSets).flatMap((pick) => {
    const table = tablesInPlay.find((t) => t.packEntryId === pick.tableId);
    const rows = table ? pickRows(table.data, ctx) : [];
    return table && rows.length > 0 ? [{ pick, table, rows }] : [];
  });
  const kitOf = (p: Purchase) => kits.find((k) => k.packEntryId === p.kitId || (!p.kitId && p.label === k.name));
  const kitsTaken = bought.filter((p) => kitOf(p)).length;
  /**
   * How many kits may be taken (07 `creation.kits.pick`, 1 when absent). Past it (Design, 2026-11-07): never blocked,
   * but said: the footer carries the sign ("2 kits, 1 allowed"), Next explains and goes on, and the GM sees it as an
   * exception through the flagged-pick path (step `gear`), like a coin outside the dice.
   */
  const kitsAllowed = kitsToPick(setting.rulesSets);
  const kitsOverWords = (n: number) => `${n} kits, ${kitsAllowed} allowed`;
  const kitsOverApproval = (taken: readonly Purchase[]): SpecialApproval[] => {
    const n = taken.filter((p) => kitOf(p)).length;
    return n > kitsAllowed ? [{ step: 'gear' as const, entryId: 'kits-over', name: `${n} kits`, requirement: `Your setting allows ${kitsAllowed}` }] : [];
  };
  const kitsOver = kitsTaken > kitsAllowed;
  /** What a taken kit gave (final drafts D): "9 items: leather, spear (rolled), lantern", the rolled parts marked. */
  const gaveWords = (kit: ResolvedEntry, picks: number[][]) => {
    const fixed = entriesOf(kitContents(kit.data, ctx)).map((l) => (l.units !== undefined ? piecesWords(l.entry.name, l.entry.data, l.units) : l.qty > 1 ? `${l.entry.name} ×${l.qty}` : l.entry.name));
    const rolledLines = kitTaken(kit.data, picks, ctx).slice(kitContents(kit.data, ctx).length);
    const rolled = entriesOf(rolledLines).map((l) => `${l.units !== undefined ? piecesWords(l.entry.name, l.entry.data, l.units) : l.qty > 1 ? `${l.entry.name} ×${l.qty}` : l.entry.name} (rolled)`);
    const all = [...fixed, ...rolled];
    const count = entriesOf(kitTaken(kit.data, picks, ctx)).reduce((n, l) => n + l.qty, 0);
    return all.length === 0 ? '' : `${count} ${count === 1 ? 'item' : 'items'}: ${all.join(', ')}`;
  };
  const takenOf = (kit: ResolvedEntry) => bought.find((p) => p.kitId === kit.packEntryId || (!p.kitId && p.label === kit.name));
  const itemsBought = bought.filter((p) => !kitOf(p));
  const sourceOf = (entry: ResolvedEntry) => {
    const pack = setting.packs.find((p) => p.packId === entry.packId);
    const page = typeof entry.data.source === 'string' ? entry.data.source.trim() : '';
    // The page alone when it names its book already (07 meta.sourceTitles, retest 4 T6).
    return packAndPage(pack?.shortName ?? pack?.name ?? '', page, pack?.sourceTitles);
  };

  // What the character already has, the class checks, and the campaign's encumbrance mode: read again after each change.
  // With them, the given gear as saved (gate walk 2026-11-06): a record handed in from before the gear was given must
  // never give it again.
  const [pack, setPack] = useState<{ context: EquipContext | null; lines: InventoryLine[]; mode: EncumbranceMode; savedGiven: { id: string; qty: number }[] | null; savedGarb: ReturnType<typeof patronGarbGiven> } | null>(null);
  const [packVersion, setPackVersion] = useState(0);
  useEffect(() => {
    let current = true;
    void Promise.all([loadEquipContext(db, user.id, character.campaignId, character.id), loadInventory(db, character.campaignId), loadInventorySettings(db, character.campaignId), loadCreationRecord(db, character.id)]).then(([context, inventory, settings, saved]) => {
      if (!current) return;
      const savedGiven = saved && isRecord(saved.creation) ? givenGearOf(saved.creation) : null;
      setPack({ context, lines: (inventory?.lines ?? []).filter((l) => l.actorId === character.id), mode: settings?.mode ?? 'none', savedGiven, savedGarb: saved ? patronGarbGiven(saved.creation) : null });
    });
    return () => {
      current = false;
    };
  }, [db, user.id, character.campaignId, character.id, packVersion]);
  const mine = pack?.lines ?? [];
  const mode = pack?.mode ?? 'none';
  const rules = setting.encumbrance;
  // The load tier, live (cr-14): what the pack holds now, in the campaign's mode, as the Pack screen counts it.
  const load: CarriedLoad = carriedLoad(
    mine.filter((l) => l.approval === 'approved' && !isSeparate(l, rules)).map(toLoadLine),
    rules,
    mode,
  );
  const hasBackpack = mine.find(isContainer) ?? null;
  const asLine = (piece: KitPiece<ResolvedEntry>, n: number) =>
    ({ id: `kit-${n}`, name: piece.name, details: piece.data, sourceEntryId: piece.item.packEntryId, equipped: true }) as unknown as InventoryLine;
  const handsOn = mine.filter((l) => l.equipped && (l.details.slot === 'hand' || l.details.slot === 'shield')).reduce((n, l) => n + (l.details.hands === 2 ? 2 : 1), 0);

  /** Where a kit's things land: the class checks (A10) and the setting's equip warnings decide what goes on. */
  function placed(entries: { entry: ResolvedEntry; qty: number; units?: number }[]) {
    // `units` counts single pieces (G-92: 10 arrows from a quiver of 20), else whole items or bundles.
    const pieces = entries.map(({ entry, qty, units }) => ({ item: entry, name: entry.name, qty: piecesOf({ itemId: entry.packEntryId, qty, ...(units !== undefined ? { units } : {}) }, bundleOf(entry)), data: entry.data }));
    return placeKit(
      pieces,
      (piece, on) => {
        const check = equipCheckWith(pack?.context ?? null, asLine(piece, -1), [...mine, ...on.map(asLine)]);
        const said = [...check.blocked, ...check.warnings.map((w) => w.message || 'Your setting warns about this.'), ...(check.stopsCasting ? [check.stopsCasting.reason] : [])];
        return said.length > 0 ? said.join(' ') : null;
      },
      { armour: mine.some((l) => l.equipped && l.details.slot === 'armour'), hands: handsOn, container: hasBackpack !== null },
    );
  }
  /**
   * A kit's things the class (or kindred) can't use (si-2): taken all the same, carried, never worn or held; the kit row
   * says so at the Take (mockup creation/13: "▲ Ring coat: a Reed Witch can't wear it; carried").
   */
  const cantUse = (pieces: PlacedPiece<ResolvedEntry>[]) =>
    pieces.filter((p) => (typeof p.data.slot === 'string' || !!p.data.weapon) && equipCheckWith(pack?.context ?? null, asLine(p, -1), []).blocked.length > 0);
  /** What a piece the class can't use says (si-2; mockup creation/13): "Ring coat: a Reed Witch can't wear it; carried". */
  const cantUseWords = (p: PlacedPiece<ResolvedEntry>) => `${p.name}: ${classEntry ? `${/^[aeiou]/i.test(classEntry.name) ? 'an' : 'a'} ${classEntry.name}` : 'your class'} can't ${p.data.slot === 'armour' || p.data.slot === 'shield' ? 'wear' : 'use'} it; carried`;
  /** The backpack's name: the kit's first container, else the one the character has. */
  const backpackOf = (pieces: PlacedPiece<ResolvedEntry>[]) => pieces.find((p) => p.place === 'carried' && isKitContainer(p.data))?.name ?? hasBackpack?.name ?? null;

  // What was spent and bought is saved as it changes (with the money typed), so nothing is lost if the app closes.
  async function save(nextSpent: number, nextBought: Purchase[], extra: Record<string, unknown> = {}) {
    const money = readMoney(moneyText.current);
    const base = live.current.record;
    const next: Record<string, unknown> = {
      // The kits taken that need the GM's special approval (after-test A4) go on the record with the purchases.
      ...withStepApprovals(base, 'gear', [...kitApprovals(nextBought), ...kitsOverApproval(nextBought), ...coinApproval(money, live.current.isUsual)]),
      // Which money roll was recorded (null: none yet). An older record recorded its money when it was made.
      moneyRecorded: recordedMoney(base),
      ...(money !== null ? { startingMoney: money } : {}),
      // cw-11: false while the coin is the setting's usual, never stepped or typed ("the usual, not rolled"); true once
      // stepped or typed (rolled). A record without it was typed: rolled.
      moneyTouched: !(money !== null && live.current.isUsual),
      moneyCoin: { key: unit.key, valueInBase: unit.valueInBase },
      spentBase: nextSpent,
      bought: nextBought,
      ...extra,
    };
    // The coin cleared: no starting money (the purse starts at 0, ruled 2026-11-02), not the number saved before.
    if (money === null) delete next.startingMoney;
    const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { creation: next } });
    if (!saved.ok) {
      setProblem(saved.message);
      return null;
    }
    live.current = { ...live.current, record: next };
    setRecord(next);
    return next;
  }
  /** Takes or buys: each piece into the pack (containers first, the rest into the first one), then saved with Undo. */
  async function buy(pieces: PlacedPiece<ResolvedEntry>[], price: number, cost: string, label: string, kit?: { kitId: string; picks: number[][] }, quiet = false, said: string[] = []): Promise<boolean> {
    setProblem(null);
    const lines: Purchase['lines'] = [];
    let backpack = hasBackpack?.id ?? null;
    let kitBackpack = false;
    for (const piece of pieces) {
      const added = await runCommand(registry, db, user, addItem, {
        carrier,
        item: isOneOff(piece.item) ? oneOffCopy(piece.name) : copyOf(piece.item),
        qty: piece.qty,
        howGot: 'bought',
        cost,
        containerLineId: piece.place === 'container' ? backpack : null,
        equipped: piece.place === 'worn' || piece.place === 'hand',
      });
      if (!added.ok) {
        setPackVersion((v) => v + 1);
        setProblem(added.message);
        return false;
      }
      if (piece.place === 'carried' && isKitContainer(piece.data) && !kitBackpack) {
        backpack = added.value.id;
        kitBackpack = true;
      }
      lines.push({ id: added.value.id, qty: piece.qty });
    }
    return recordBuy({ label, price, lines, ...(kit ?? {}) }, cost, quiet, said);
  }

  async function recordBuy(purchase: Purchase, cost: string, quiet = false, said: string[] = []): Promise<boolean> {
    const now = live.current;
    const nextBought = [...now.bought, purchase];
    const nextSpent = now.spent + purchase.price;
    live.current = { ...now, spent: nextSpent, bought: nextBought };
    setSpent(nextSpent);
    setBought(nextBought);
    await save(nextSpent, nextBought);
    setPackVersion((v) => v + 1);
    // Each take or buy is at once, with Undo (06, Add item sheet, creation variant).
    const took = `${purchase.kitId ? 'Took' : 'Bought'} ${purchase.label}${cost === purchase.label ? (purchase.price > 0 ? ` for ${show(purchase.price)}` : ', free') : ` for ${cost}`}`;
    if (!quiet) toast({ text: [took, ...said].join('. '), ...(refunds ? { onUndo: () => void remove(purchase) } : {}) });
    return true;
  }

  // Takes what one purchase put in the pack back out (only as many as it added), and refunds its full price. A given
  // pick's lines (not bought) only come out (`bought` false).
  async function remove(purchase: Purchase, bought = true): Promise<boolean> {
    setProblem(null);
    const inventory = await loadInventory(db, character.campaignId);
    if (!inventory) {
      setProblem("Couldn't put it back. Check your connection and try again.");
      return false;
    }
    for (const line of purchase.lines) {
      const now = inventory.lines.find((l) => l.id === line.id);
      // Already gone (dropped from the pack): nothing to take out.
      if (!now) continue;
      const removed = await runCommand(registry, db, user, removeItem, { line: { id: line.id, carrier, version: now.version }, qty: Math.min(line.qty, now.qty), of: now.qty });
      if (!removed.ok) {
        setProblem(removed.message);
        return false;
      }
    }
    if (!bought) return true;
    const same = (p: Purchase) => p === purchase || (p.label === purchase.label && p.lines[0]?.id === purchase.lines[0]?.id);
    const now = live.current;
    const nextBought = now.bought.filter((p) => !same(p));
    const nextSpent = Math.max(0, now.spent - purchase.price);
    live.current = { ...now, spent: nextSpent, bought: nextBought };
    setSpent(nextSpent);
    setBought(nextBought);
    await save(nextSpent, nextBought);
    setPackVersion((v) => v + 1);
    return true;
  }

  // Busy as a ref too: an Undo's closure would read a stale `busy` while Next is still saving (#786's review).
  const working = useRef(false);
  async function run(work: () => Promise<unknown>) {
    if (busy || working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  // The given gear goes into the pack once, when the step first opens with the pack read (where Add item would put
  // each thing, ruled 2026-10-26), as No cost; the record keeps its lines (`givenGear`) so it's never given twice.
  const giving = useRef(false);
  const givenDone = givenGearOf(record) !== null;
  // An effect event (lint, cleanup-lookback-nits): the giving reads this render's helpers and lists, which are new on
  // every render, so the effect below runs only when one of the four things that can start the giving changes,
  // instead of after every render with no dependency list.
  const giveOnce = useEffectEvent(() => {
    // Given already, by the record as saved: kept on this record too, so the next save doesn't drop it.
    if (!givenDone && pack?.savedGiven && !giving.current) {
      giving.current = true;
      const next = { ...live.current.record, givenGear: pack.savedGiven };
      live.current = { ...live.current, record: next };
      setRecord(next);
      return;
    }
    if (given.length === 0 || givenDone || !pack || busy || giving.current) return;
    giving.current = true;
    void run(async () => {
      const lines: { id: string; qty: number }[] = [];
      let backpack = hasBackpack?.id ?? null;
      for (const piece of placed(given)) {
        const added = await runCommand(registry, db, user, addItem, {
          carrier,
          item: isOneOff(piece.item) ? oneOffCopy(piece.name) : copyOf(piece.item),
          qty: piece.qty,
          howGot: 'found',
          containerLineId: piece.place === 'container' ? backpack : null,
          equipped: piece.place === 'worn' || piece.place === 'hand',
        });
        if (!added.ok) {
          setProblem(added.message);
          break;
        }
        if (piece.place === 'carried' && isKitContainer(piece.data) && backpack === null) backpack = added.value.id;
        lines.push({ id: added.value.id, qty: piece.qty });
      }
      await save(live.current.spent, live.current.bought, { givenGear: lines });
      setPackVersion((v) => v + 1);
    });
  });
  useEffect(() => giveOnce(), [givenDone, pack, busy, given.length]);

  // The patron's garb goes into the pack once per patron (December 1a; pt-6), after the given gear, as No cost; the
  // record keeps whose it is and its lines (`patronGarb`). A patron changed since (from the review) has its garb
  // taken back out first; a patron taken off leaves none.
  const garbing = useRef(false);
  const garbStuck = useRef(false);
  // The garb's record saved on this opening of the step: from then on the record says what garb is given, and the
  // copy read when the step opened (`pack.savedGarb`) is never read again, so a patron taken off can't have its garb
  // taken out a second time from a line the player raised. Reset when the step opens again.
  const garbSaved = useRef(false);
  const garbKey = patronGarb?.id ?? '';
  useEffect(() => {
    if (!pack || busy || garbing.current || garbStuck.current || (given.length > 0 && !givenDone)) return;
    const had = patronGarbGiven(live.current.record) ?? (garbSaved.current ? null : pack.savedGarb);
    // Another patron's garb is still in the pack: it comes out first. This patron's: only what isn't given yet goes in
    // (an item this device couldn't read before is given once it can, never one twice).
    const stale = !!had && had.patron !== garbKey;
    const givenIds = had && !stale ? had.items : [];
    const toGive = garbKey ? fromPatron.filter(({ entry }) => !givenIds.includes(entry.packEntryId)) : [];
    if (!stale && toGive.length === 0) {
      // Given already, by the record as saved: kept on this record too, so the next save doesn't drop it.
      if (had && !patronGarbGiven(live.current.record)) {
        const next = { ...live.current.record, patronGarb: had };
        live.current = { ...live.current, record: next };
        setRecord(next);
      }
      return;
    }
    garbing.current = true;
    void run(async () => {
      try {
        // Another patron's garb out: the record is saved without it first (the lead's ruling, as in patronGarbSwap.ts),
        // so a failure from here on can only leave garb in the pack that no record lists (a free extra), never have the
        // next opening take a second one from a line the player raised. A save or take-out that didn't go is said in
        // the step's problem line, and not tried again until the step reopens.
        if (stale) {
          const was = live.current.record;
          const cleared = { ...was };
          delete cleared.patronGarb;
          live.current = { ...live.current, record: cleared };
          if (!(await save(live.current.spent, live.current.bought))) {
            live.current = { ...live.current, record: was };
            return void (garbStuck.current = true);
          }
          if (!(await remove({ label: '', price: 0, lines: had.lines }, false))) return void (garbStuck.current = true);
        }
        const lines: { id: string; qty: number }[] = had && !stale ? [...had.lines] : [];
        const items = [...givenIds];
        const added: { id: string; qty: number }[] = [];
        for (const piece of placed(toGive)) {
          const put = await runCommand(registry, db, user, addItem, {
            carrier,
            item: isOneOff(piece.item) ? oneOffCopy(piece.name) : copyOf(piece.item),
            qty: piece.qty,
            howGot: 'found',
            containerLineId: null,
            equipped: piece.place === 'worn' || piece.place === 'hand',
          });
          if (!put.ok) {
            // Said in the problem line; what did go in is saved below, and the rest waits for the step to reopen.
            setProblem(put.message);
            garbStuck.current = true;
            break;
          }
          lines.push({ id: put.value.id, qty: piece.qty });
          added.push({ id: put.value.id, qty: piece.qty });
          if (!items.includes(piece.item.packEntryId)) items.push(piece.item.packEntryId);
        }
        const base = { ...live.current.record };
        delete base.patronGarb;
        live.current = { ...live.current, record: base };
        // A save that didn't go is said in the problem line; what was just put in comes back out, so reopening the
        // step can never double the garb (the review of #636), and it isn't tried again here.
        if (!(await save(live.current.spent, live.current.bought, garbKey ? { patronGarb: { patron: garbKey, lines, items } } : {}))) {
          garbStuck.current = true;
          if (added.length > 0) await remove({ label: '', price: 0, lines: added }, false);
        } else garbSaved.current = true;
        setPackVersion((v) => v + 1);
      } finally {
        garbing.current = false;
      }
    });
  });

  /** A kit taken with its rolled rows: its price checked against what's left first (answered, never greyed). */
  async function takeKit(kit: ResolvedEntry, picks: number[][]) {
    const price = kitPrice(kit.data, coins, unit) ?? 0;
    const short = shortOf(price, (moneyNow ?? 0) * unit.valueInBase - live.current.spent, moneyNow !== null, show);
    if (short) return void toast({ text: short });
    const pieces = placed(entriesOf(kitTaken(kit.data, picks, ctx)));
    const carried = cantUse(pieces);
    // si-2: the toast says what the class can't use, and that it's carried.
    await buy(pieces, price, kit.name, kit.name, { kitId: kit.packEntryId, picks }, false, carried.map(cantUseWords));
  }

  /** The kit's Pick: a kit without rolls is taken at once; one with rolls opens its Roll sequence (cw-11). Picked ✓ puts it back (refunded). */
  function tapKit(kit: ResolvedEntry) {
    const taken = takenOf(kit);
    if (taken) return takeOff(kit);
    if (kitRolls(kit.data, ctx).length > 0) return openRolls(kit);
    void run(() => takeKit(kit, []));
  }

  /** Take it off (and Picked ✓): the kit's things back out of the pack, its price refunded; only before approval. */
  function takeOff(kit: ResolvedEntry) {
    const taken = takenOf(kit);
    if (!taken) return;
    if (!refunds || taken.lines.length === 0) return toast({ text: `${kit.name} is in the pack: change it from the Pack screen.` });
    void run(async () => {
      if (await remove(taken)) toast({ text: `Put ${kit.name} back${taken.price > 0 ? `, ${show(taken.price)} returned` : ''}.` });
    });
  }

  /**
   * The Roll sequence opens at its first step (Design's answer 3). `only`, a roll's own Change in the kit's entry
   * (Francis, retest 2, 2026-11-07): the sequence opens at that roll alone, the other taps kept as they were.
   */
  function openRolls(kit: ResolvedEntry, only?: number) {
    const taken = takenOf(kit);
    if (taken && (!refunds || taken.lines.length === 0)) return toast({ text: `${kit.name} is in the pack: change it from the Pack screen.` });
    const fresh = noRollPicks(kit.data, ctx);
    const was = taken ? (rollPicks[kit.packEntryId] ?? taken.picks ?? fresh) : fresh;
    setOpened(null);
    setRolling({ kitId: kit.packEntryId, at: only ?? 0, picks: fresh.map((times, i) => times.map((p, t) => was[i]?.[t] ?? p)), said: null, ...(only !== undefined ? { only: true } : {}) });
  }

  /** Done on the last step: the kit taken with what was tapped (a change puts the old one back first, refunded). */
  function finishRolls(kit: ResolvedEntry, picks: number[][]) {
    setRolling(null);
    setRollPicks({ ...rollPicks, [kit.packEntryId]: picks });
    const taken = takenOf(kit);
    void run(async () => {
      if (taken && !(await remove(taken))) return;
      await takeKit(kit, picks);
    });
  }

  /**
   * ✕ (or Back on the first step) keeps nothing; a first pick says "<kit> put back" (Francis, retest 2: "not taken"
   * read oddly), with Undo opening the sequence again where it was; a change leaves the kit as it was.
   */
  function closeRolls(kit: ResolvedEntry) {
    const was = rolling;
    setRolling(null);
    // One roll's Change, closed: back to the kit's entry it came from.
    if (was?.only) setOpened(kit.packEntryId);
    if (!takenOf(kit)) toast({ text: `${kit.name.trim() || 'Kit'} put back`, onUndo: was ? () => setRolling(was) : undefined });
  }

  // The kindred's trinket (cs-1; mockup creation/11): rolled with the kit rolls, the row tapped (or the number typed on
  // a long table) becomes a one-off item in the pack, kept on the record (`trinket`) so Change swaps it.
  const trinketTable = creationTablesOf(setting, raceAsPlayed(raceEntry, classEntry)).trinket;
  const trinket = trinketOf(record);
  const [trinketOpen, setTrinketOpen] = useState(false);
  // A pick table's marked rows, by its table, until Take these (cs-15); none: what is taken.
  const [marks, setMarks] = useState<Record<string, number[] | undefined>>({});
  /** The old trinket's line out of the pack (a gone line is fine), then the new one in; null clears it. */
  async function takeTrinket(words: string | null, rolled?: number): Promise<boolean> {
    if (!trinketTable) return false;
    const was = trinketOf(live.current.record);
    if (was) {
      const inventory = await loadInventory(db, character.campaignId);
      const now = inventory?.lines.find((l) => l.id === was.lineId);
      if (now) {
        const removed = await runCommand(registry, db, user, removeItem, { line: { id: now.id, carrier, version: now.version }, qty: now.qty, of: now.qty });
        if (!removed.ok) {
          setProblem(removed.message);
          return false;
        }
      }
    }
    let next: TrinketPick | null = null;
    if (words) {
      const added = await runCommand(registry, db, user, addItem, {
        carrier,
        item: oneOffCopy(trinketName(words)),
        qty: 1,
        howGot: 'found',
        note: `${trinketTable.name}${rolled !== undefined ? `, rolled ${rolled}` : ''}`,
      });
      if (!added.ok) {
        setProblem(added.message);
        setPackVersion((v) => v + 1);
        return false;
      }
      next = { tableId: trinketTable.id, text: words, lineId: added.value.id, ...(rolled !== undefined ? { rolled } : {}) };
    }
    await save(live.current.spent, live.current.bought, { trinket: next ?? undefined });
    setPackVersion((v) => v + 1);
    return true;
  }
  function pickTrinket(words: string | null, rolled?: number) {
    const was = trinket;
    void run(async () => {
      if (!(await takeTrinket(words, rolled))) return;
      if (words) toast({ text: `${trinketName(words)}: in the pack`, onUndo: () => void run(() => takeTrinket(was?.text ?? null, was?.rolled)) });
    });
  }

  /**
   * A given pick's row tapped (of-11): its things go into the pack at once (no cost, like the given gear); a full count
   * says so. The same row can be picked more than once (R3-8, 2026-11-08: two rolls landing on one row give two): each
   * pick is its own entry on the record (`givenPicks[<table id>]`), and `on` false puts the row's last one back. A
   * second pick of a thing that stacks by its own rule (`stack` over 1) joins the first pick's line; anything else is a
   * line of its own. Undo per pick.
   */
  async function setPickRow(pick: GearPick, rows: ReturnType<typeof pickRows>, row: number, on: boolean): Promise<boolean> {
    const was = givenPicksOf(live.current.record, pick.tableId);
    let next = was;
    if (!on) {
      const at = was.map((p) => p.row).lastIndexOf(row);
      const out = was[at];
      // The record is saved without the pick first (the lead's ruling, as in #754 and patronGarbSwap.ts): a stacking
      // pick shares its line with the row's earlier ones (and the player's own), so taking out before a save that then
      // failed would leave the record listing a pick whose things were gone, and the next − would take another. A save
      // that doesn't go changes nothing here (`save` keeps the record it had and says so in the problem line); a
      // take-out that doesn't go after it leaves the things in the pack with no pick listing them, a free extra.
      next = was.filter((_, n) => n !== at);
      if (out) {
        const all = isRecord(live.current.record.givenPicks) ? { ...live.current.record.givenPicks } : {};
        all[pick.tableId] = next;
        if (!(await save(live.current.spent, live.current.bought, { givenPicks: all }))) return false;
        const removed = await remove({ label: '', price: 0, lines: out.lines }, false);
        setPackVersion((v) => v + 1);
        return removed;
      }
    } else {
      const lines: { id: string; qty: number }[] = [];
      let backpack = hasBackpack?.id ?? null;
      // The row's first pick still in the pack: a stacking thing joins its line.
      const earlier = was.find((p) => p.row === row);
      const inventory = earlier ? await loadInventory(db, character.campaignId) : null;
      for (const [k, piece] of placed(entriesOf(rows[row]?.items ?? [])).entries()) {
        const join = earlier && !isOneOff(piece.item) && copyOf(piece.item).stack > 1 ? inventory?.lines.find((l) => l.id === earlier.lines[k]?.id) : undefined;
        if (join) {
          const more = await runCommand(registry, db, user, setItemQty, { line: { id: join.id, carrier, version: join.version }, qty: join.qty + piece.qty });
          if (!more.ok) {
            setProblem(more.message);
            setPackVersion((v) => v + 1);
            return false;
          }
          lines.push({ id: join.id, qty: piece.qty });
          continue;
        }
        const added = await runCommand(registry, db, user, addItem, {
          carrier,
          item: isOneOff(piece.item) ? oneOffCopy(piece.name) : copyOf(piece.item),
          qty: piece.qty,
          howGot: 'found',
          containerLineId: piece.place === 'container' ? backpack : null,
          equipped: piece.place === 'worn' || piece.place === 'hand',
        });
        if (!added.ok) {
          setProblem(added.message);
          setPackVersion((v) => v + 1);
          return false;
        }
        if (piece.place === 'carried' && isKitContainer(piece.data) && backpack === null) backpack = added.value.id;
        lines.push({ id: added.value.id, qty: piece.qty });
      }
      next = [...next, { row, lines }];
    }
    const all = isRecord(live.current.record.givenPicks) ? { ...live.current.record.givenPicks } : {};
    all[pick.tableId] = next;
    await save(live.current.spent, live.current.bought, { givenPicks: all });
    setPackVersion((v) => v + 1);
    return true;
  }
  /** Pick adds one (a picked row too, R3-8); `on` false is the − square, putting the row's last one back. */
  /** The marked rows of a pick table in words, a row marked twice once with ×2: "Reed rope ×2, eel hooks". */
  const pickWords = (rows: ReturnType<typeof pickRows>, marked: readonly number[]) =>
    [...new Set(marked)]
      .map((r) => {
        const what = words(rows[r]?.items ?? []) || rows[r]?.result || 'nothing';
        const times = marked.filter((p) => p === r).length;
        return times > 1 ? `${what} ×${times}` : what;
      })
      .join(', ');

  /** The pick tables whose marks differ from what is taken (cs-15, cs-42): what is marked, what is taken. */
  const waitingPicks = (from: Record<string, unknown> = record) =>
    gearPicks.flatMap(({ pick, table, rows }) => {
      const taken = givenPicksOf(from, pick.tableId).map((p) => p.row);
      const want = marks[pick.tableId];
      return want && !sameRows(want, taken) ? [{ pick, rows, want, taken, name: table.name }] : [];
    });

  /**
   * Takes a pick table's marked rows (cs-15): from what is taken to what is marked, a row at a time, those put back
   * first; false when a save didn't go (what went stays, and the problem line says why).
   */
  async function takePicks(pick: GearPick, rows: ReturnType<typeof pickRows>, want: readonly number[]): Promise<boolean> {
    const had = givenPicksOf(live.current.record, pick.tableId).map((p) => p.row);
    const count = (list: readonly number[], r: number) => list.filter((p) => p === r).length;
    for (const r of new Set(had)) for (let k = count(want, r); k < count(had, r); k++) if (!(await setPickRow(pick, rows, r, false))) return false;
    for (const r of new Set(want)) for (let k = count(had, r); k < count(want, r); k++) if (!(await setPickRow(pick, rows, r, true))) return false;
    return true;
  }

  function undoLast() {
    const last = [...bought].reverse().find((p) => p.lines.length > 0);
    if (!last || !refunds) return toast({ text: 'Nothing to undo.' });
    void run(async () => {
      if (await remove(last)) toast({ text: `Put ${last.label} back.` });
    });
  }

  /**
   * Leaves the step: saved as done, and the money roll recorded when it's new (every roll typed in is kept, docs/05
   * Dice entry; a draft's carries its name for the GM, ruled 2026-10-26).
   */
  async function finish(): Promise<Record<string, unknown> | null> {
    const recorded = recordedMoney(live.current.record);
    // Only a coin the player stepped or typed was rolled (cw-11): the usual, untouched, records no roll.
    const fresh = !!moneyRoll && moneyNow !== null && !live.current.isUsual && moneyNow !== recorded;
    const saved = await save(live.current.spent, live.current.bought, { gearDone: true, ...(fresh ? { moneyRecorded: moneyNow } : {}) });
    if (saved && fresh) {
      await runCommand(registry, db, user, recordRoll, { campaignId: character.campaignId, expression: moneyRoll.slice(0, 60), result: moneyNow!, purpose: 'money', gmOnly: false, label: character.approval === 'approved' ? '' : draftRollLabel(name) });
    }
    return saved;
  }

  async function next() {
    const problem = gearProblem({ moneyRoll, money: moneyNow, left, show });
    if (problem) return void toast({ text: onLater ? `${problem.replace(/\.$/, '')}, or Decide later.` : problem });
    // Marks not yet taken (cs-42, the lead on #786): Next takes them as Take these does, says so with Undo, then goes
    // on. Back and folding take nothing; only Next and Take these do.
    const waiting = waitingPicks(live.current.record);
    // Outside the dice: said in words, then on (never blocked); the GM sees it as an exception.
    if (coinOutside) toast({ text: `${coinOutside}. Your GM sees it when you send.` });
    if (kitsOver) toast({ text: `${kitsOverWords(kitsTaken)}. Your GM sees it when you send.` });
    await run(async () => {
      for (const w of waiting) if (!(await takePicks(w.pick, w.rows, w.want))) return;
      // One sentence a table, in one toast (the app shows one toast at a time, a new one replacing the last, so a toast
      // a table would lose the first one's Undo): how many this Next took and put back, in the lead's words (cs-42). Its
      // Undo puts every table back.
      if (waiting.length > 0) {
        setMarks({});
        toast({
          text: waiting.map((w) => nextTakeWords(w.name, changedRows(w.taken, w.want), changedRows(w.want, w.taken))).join(' '),
          onUndo: () =>
            void run(async () => {
              // The walk has gone on and may have saved since (#786's review): start from the record as it is now, so
              // the Undo changes only the tables' picks and the pack, never the newer work.
              const now = await loadCreationRecord(db, character.id);
              // The record can't be read (offline, an error): stop, in the app's own words, rather than undo from an
              // older copy (#786's review).
              if (!now || !isRecord(now.creation)) return toast({ text: "Couldn't save that. Check your connection and try again.", error: true });
              live.current = { ...live.current, record: now.creation };
              for (const w of waiting) if (!(await takePicks(w.pick, w.rows, w.taken))) return;
              onUndone?.(live.current.record);
            }),
        });
      }
      const saved = await finish();
      if (saved) onDone(saved);
    });
  }

  async function later() {
    if (!onLater) return;
    await run(async () => {
      const saved = await finish();
      if (saved) await onLater(saved);
    });
  }

  // The money left (cr-14): on the shop's top; on Gear the coin's own line says it (cs-22, picture 21-F1), so the step
  // shows this line only without a coin roll ("Spent: …").
  const moneyLine = (
    // Named for the pack's own coin ("Silver to spend"; #789's review), not a coin the pack may not have.
    <p className="gear-tally__money" role="status" aria-label={`${unit.label.charAt(0).toUpperCase()}${unit.label.slice(1)} to spend`}>
      <span>{!moneyRoll ? `Spent: ${show(spent)}` : moneyNow === null ? 'Type your starting money to see what’s left.' : left >= 0 ? `${show(left)} to spend` : `Short by ${show(-left)}`}</span>
    </p>
  );
  // The tally (cr-14): the money (on Gear only without a coin roll), Undo last, and the load with its tier, live.
  const tallyOf = (withMoney: boolean) => (
    <div className="gear-tally">
      {withMoney && moneyLine}
      {refunds && bought.some((p) => p.lines.length > 0) && (
        <button type="button" className="button-secondary button-secondary--small" onClick={undoLast}>
          Undo last
        </button>
      )}
      {load.mode !== 'none' && (
        <div className="gear-tally__load">
          {/* A tap on the burden opens its levels in a pop-up, in creation's Gear step too (d5-19, 2026-11-20; frame M2h). */}
          <LoadSummary load={load} rules={rules} from={setting.encumbranceFrom} levelsPopUp />
        </div>
      )}
    </div>
  );
  const tally = tallyOf(!moneyRoll);

  // Browse the shop: the Add item sheet, creation variant (06; mockup creation/06 §2).
  if (shopping) {
    return (
      <AddItem
        db={db}
        user={user}
        campaign={{ id: character.campaignId, name: '' }}
        carrier={{ ...carrier, name }}
        setting={setting}
        mode={mode}
        containers={mine.filter(isContainer)}
        lines={mine}
        onBack={() => setShopping(false)}
        onAdded={() => undefined}
        shop={{
          // The top says the coin to spend and nothing else (cs-21, 21-F5): no load line.
          top: moneyLine,
          price: (entry) => {
            const price = priced(entry);
            return price === null ? null : show(price);
          },
          short: (entry, qty) => shortOf((priced(entry) ?? 0) * qty, left, moneyNow !== null, show),
          cost: (entry, qty) => show((priced(entry) ?? 0) * qty),
          note: (entry) => {
            // A thing the class may not use is listed and says so, and Buy still works (cr-14): "A Reed Witch can't use
            // it." then the pack's reason (cs-21, 21-F5).
            const check = typeof entry.data.slot === 'string' ? equipCheckWith(pack?.context ?? null, asLine({ item: entry, name: entry.name, qty: 1, data: entry.data }, -1), mine) : null;
            const why = check?.blocked[0] ?? '';
            if (!why) return '';
            const said = classEntry ? `${classEntry.name} can't use ${entry.name}` : '';
            return said && why.startsWith(said) ? `${/^[aeiou]/i.test(classEntry!.name) ? 'An' : 'A'} ${classEntry!.name} can't use it${why.slice(said.length)}` : why;
          },
          onBought: (entry, line, qty) => {
            const price = (priced(entry) ?? 0) * qty;
            void recordBuy({ label: qty > 1 ? `${entry.name} ×${qty}` : entry.name, price, lines: [{ id: line.id, qty: line.qty }] }, show(price));
          },
          onDone: () => setShopping(false),
        }}
      />
    );
  }

  const openKit = kits.find((k) => k.packEntryId === opened) ?? null;
  const panel = openKit ? kitPanel(openKit) : null;
  function kitPanel(kit: ResolvedEntry) {
    const picks = (rollPicks[kit.packEntryId] ?? []).map((times) => times.filter((p): p is number => p !== undefined));
    const pieces = placed(entriesOf(kitTaken(kit.data, picks, ctx)));
    const backpack = backpackOf(pieces);
    const price = kitPrice(kit.data, coins, unit);
    const rolls = kitRolls(kit.data, ctx).filter((r) => !r.choice);
    const notes = pieces.filter((p) => p.why).map((p) => `${p.name} goes ${backpack ? `in the ${backpack.toLowerCase()}` : 'in the pack'}: ${p.why}`);
    const weight = weightWords(pieces.map((p) => ({ weightCoin: copyOf(p.item).weightCoin, slots: copyOf(p.item).slots, qty: p.qty })), mode);
    const headings = [
      ...(blurbOf(kit.data) ? [{ label: 'About', text: blurbOf(kit.data) }] : []),
      ...kitGroups(pieces, backpack).map((g) => ({ label: g.name, text: g.pieces.map((p) => (p.qty > 1 ? `${p.name} ×${p.qty}` : p.name)).join(', ') })),
      ...(notes.length > 0 ? [{ label: 'Why', text: notes.join(' ') }] : []),
      ...(typeof kit.data.classItems === 'string' && kit.data.classItems.trim() ? [{ label: 'Also', text: kit.data.classItems.trim() }] : []),
      { label: 'Cost', text: price ? show(price) : 'Free' },
      ...(weight ? [{ label: 'Weight', text: weight }] : []),
    ];
    // Each roll with what it gave and its own Change (Francis, retest 2, 2026-11-07): Change reopens the sequence at
    // that roll only. Before the kit is taken, each roll with its die, nothing to change.
    const taken = takenOf(kit);
    const changeable = !!taken && refunds && taken.lines.length > 0;
    const all = kitRolls(kit.data, ctx);
    const kept = rollPicks[kit.packEntryId] ?? taken?.picks ?? [];
    const pickWords = (n: number) => (kept[n] ?? []).filter((p): p is number => p !== undefined).map((p) => words(all[n]?.rows[p]?.items ?? []) || 'nothing').join(', ');
    const rolledPicks: RolledPick[] = all.map((roll, n) => ({
      key: String(n),
      name: roll.name,
      ...(roll.choice ? {} : { die: roll.die }),
      title: roll.choice ? `You choose: ${roll.name}` : `${roll.name}: ${roll.die}${roll.times > 1 ? `, ${timesWords(roll.times)}` : ''}`,
      ...(taken ? { result: pickWords(n) || 'Not rolled' } : {}),
      ...(changeable ? { onChange: () => openRolls(kit, n) } : {}),
    }));
    return (
      <EntryPanel
        name={kit.name}
        meta={sourceOf(kit)}
        headings={headings}
        extra={<RolledPicks label={rolls.length > 0 ? 'Rolled at the table' : 'You choose'} picks={rolledPicks} />}
        picked={!!taken}
        onPick={() => {
          tapKit(kit);
          setOpened(null);
        }}
        onClose={() => setOpened(null)}
        asSheet
      />
    );
  }

  const kitRow = (kit: ResolvedEntry) => {
    const price = kitPrice(kit.data, coins, unit);
    const contents = entriesOf(kitContents(kit.data, ctx)).map((l) => ({ weightCoin: copyOf(l.entry).weightCoin, slots: copyOf(l.entry).slots, qty: piecesOf({ itemId: l.entry.packEntryId, qty: l.qty, ...(l.units !== undefined ? { units: l.units } : {}) }, bundleOf(l.entry)) }));
    const weight = weightWords(contents, mode);
    const rolls = kitRolls(kit.data, ctx);
    const taken = takenOf(kit);
    const picks = (rollPicks[kit.packEntryId] ?? taken?.picks ?? []).map((times) => times.filter((p): p is number => p !== undefined));
    // Its one line (cw-11): the pack's blurb (else what it always holds), then "· 3 rolls" from its rolls and any choice.
    const rollCount = rolls.filter((r) => !r.choice).reduce((n, r) => n + r.times, 0);
    const chooseCount = rolls.filter((r) => r.choice).length;
    // No middle dot (final drafts A9): the rolls and choices as a sentence after the line.
    const extras = [rollCount > 0 ? `${rollCount} ${rollCount === 1 ? 'roll' : 'rolls'}` : '', chooseCount > 0 ? `${chooseCount} to choose` : ''].filter(Boolean).join(', ');
    const base = blurbOf(kit.data) || words(kitContents(kit.data, ctx));
    const line = extras ? (base ? `${base.replace(/\.$/, '')}. ${extras.charAt(0).toUpperCase()}${extras.slice(1)}` : extras) : base;
    // Taken: what it gave, in place of the line (Design's answer 3), the rolled parts marked "(rolled)" (final drafts D).
    const gave = taken ? gaveWords(kit, picks) : '';
    // si-2: once taken, what the class can't use, carried.
    const carried = taken ? cantUse(placed(entriesOf(kitTaken(kit.data, picks, ctx)))) : [];
    return (
      <div key={kit.packEntryId} className="gear-kit">
        <PickRow
          name={kit.name}
          blurb={gave || line}
          // Its price at the right of the blurb's first line (cs-22, 21-F1); none, never "Free", when it has no price (follow-up E, nit 3).
          price={price ? show(price) : undefined}
          fit={[...(weight ? [{ text: weight }] : []), ...carried.map((p) => ({ text: cantUseWords(p), warn: true })), ...(specialKits ? [{ text: SPECIAL_NOTE, warn: true }] : [])]}
          source={sourceOf(kit)}
          picked={!!taken}
          // The accent follows the ask (final drafts D): the first kit's Pick until a kit is taken.
          onPick={() => tapKit(kit)}
          onOpen={() => setOpened(opened === kit.packEntryId ? null : kit.packEntryId)}
        />
        {taken && rolls.length > 0 && (
          // Change opens the kit's entry, where each roll has its own Change (Francis, retest 2: one roll at a time, never
          // a start over); Picked ✓ still puts the kit back.
          <div className="gear-kit__actions">
            <button type="button" className="button-secondary button-secondary--small" aria-label={`Change ${kit.name}`} onClick={() => setOpened(kit.packEntryId)}>
              Change
            </button>
          </div>
        )}
      </div>
    );
  };

  // The kit's Roll sequence (cw-11, Design's answer 3): one step per roll, then each choice, in the kit's order. A roll
  // made twice is one step with two taps (ct3-6; Francis, retest 2): each tap fills the next time, a taken row tapped
  // again comes off; with `distinct`, a taken row says "Already rolled" (plain words, no sign: it's information).
  const rollingKit = rolling ? (kits.find((k) => k.packEntryId === rolling.kitId) ?? null) : null;
  const sequence = (() => {
    if (!rolling || !rollingKit) return null;
    const rolls = kitRolls(rollingKit.data, ctx);
    const i = Math.min(rolling.at, rolls.length - 1);
    const roll = rolls[i];
    if (!roll) return null;
    const mine = rolling.picks[i] ?? [];
    const filled = mine.filter((p): p is number => p !== undefined);
    const many = roll.times > 1;
    const name = many ? `${roll.name}, ${timesWords(roll.times)}` : roll.name;
    // The count, then the die in its own Roll row (creation follow-up, 2026-11-07; final draft 5's roll sequence). A roll
    // reads "Roll 2 of 3" (21-F3: "Step" is the creation steps' own word), its name on the table's bar; "twice" is said
    // once, in the Roll row.
    const line = roll.choice ? (rolling.only ? 'Choose one' : `${i + 1} of ${rolls.length}: choose one`) : rolling.only ? name : `Roll ${i + 1} of ${rolls.length}`;
    const say = (said: string) => setRolling({ ...rolling, said });
    const setMine = (next: (number | undefined)[]) => setRolling({ ...rolling, said: null, picks: rolling.picks.map((times, n) => (n === i ? next : times)) });
    const rows: RollSequenceRow[] = roll.rows.map((row, r) => {
      const what = words(row.items) || 'nothing';
      const text = what;
      const count = filled.filter((p) => p === r).length;
      const tap = () => {
        if (!many) return setMine([mine[0] === r ? undefined : r]);
        const empty = mine.findIndex((p) => p === undefined);
        // Taken and nothing more to add here (distinct, or every time tapped): it comes off.
        if (count > 0 && (roll.distinct === true || empty < 0)) {
          const at = mine.lastIndexOf(r);
          return setMine(mine.map((p, m) => (m === at ? undefined : p)));
        }
        if (empty >= 0) return setMine(mine.map((p, m) => (m === empty ? r : p)));
        say(`${roll.times === 2 ? 'Both' : `All ${roll.times}`} tapped: tap one to take it off first.`);
      };
      // A row rolled twice (R3-8, retest 4 T3; phone test 2026-11-09): ✓✓ on the row, − puts the last of them back.
      const putBack = () => {
        const at = mine.lastIndexOf(r);
        if (at >= 0) setMine(mine.map((p, m) => (m === at ? undefined : p)));
      };
      return {
        key: String(r),
        text,
        ...(roll.choice ? {} : { range: rangeWords(row) }),
        picked: count > 0,
        ...(many && roll.distinct === true && count > 0 ? { taken: 'Already rolled' } : {}),
        ...(count > 1 ? { times: count, onPutBack: putBack } : {}),
        onPick: tap,
      };
    });
    const tappedWords = filled.map((p) => words(roll.rows[p]?.items ?? []) || 'nothing').join(', ');
    const last = rolling.only || i >= rolls.length - 1;
    const done = filled.length >= roll.times;
    const rollWords = many ? `Roll ${roll.die} ${timesWords(roll.times)}, then tap each result.` : `Roll ${roll.die}, then tap what you rolled.`;
    const status = rolling.said ?? (tappedWords ? (many && !done ? `${tappedWords}: ${filled.length} of ${roll.times} tapped` : tappedWords) : roll.choice ? 'Tap the one you want' : 'Tap what you rolled');
    return (
      <RollSequence
        label={rollingKit.name}
        line={line}
        roll={roll.choice ? undefined : { die: roll.die, words: rollWords }}
        // The pack's kit rolls name no column: "Result" (the lead, as in batch E; nothing invented).
        table={roll.choice ? undefined : { title: roll.name, column: 'Result' }}
        rows={rows}
        choice={!!roll.choice}
        status={status}
        last={last}
        onBack={() => (rolling.at === 0 || rolling.only ? closeRolls(rollingKit) : setRolling({ ...rolling, at: rolling.at - 1, said: null }))}
        onNext={() => {
          if (filled.length === 0) return say(roll.choice ? 'Tap the one you want first.' : `Roll ${roll.die} at the table, then tap what you rolled.`);
          if (!done) return say(`Roll ${roll.die} again at the table, then tap what you rolled: ${filled.length} of ${roll.times} tapped.`);
          if (last) {
            finishRolls(rollingKit, rolling.picks.map((times) => times.filter((p): p is number => p !== undefined)));
            // One roll changed: back to the kit's entry, to review the rest.
            if (rolling.only) setOpened(rollingKit.packEntryId);
            return;
          }
          setRolling({ ...rolling, at: rolling.at + 1, said: null });
        }}
        onClose={() => closeRolls(rollingKit)}
      />
    );
  })();

  const problem = gearProblem({ moneyRoll, money: moneyNow, left, show });
  const somethingToChoose = kits.length > 0 || gearPicks.length > 0 || !!trinketTable || shop.length > 0;
  // Yours already, folded by group (final drafts D): what everyone gets, then the kindred's.
  const foldNote = (list: typeof given) => {
    const names = list.map(({ entry, qty }) => (qty > 1 ? `${entry.name} ×${qty}` : entry.name));
    const count = list.reduce((n, g) => n + g.qty, 0);
    return `${count} ${count === 1 ? 'item' : 'items'}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
  };
  const trinketNote = trinketTable ? (trinketTable.from ? fromLabel(trinketTable) : (raceAsPlayed(raceEntry, classEntry)?.name ?? fromLabel(trinketTable))) : '';
  // What is given, folded by group (cw-11, final drafts D): ticked rows, never put back here.
  const yoursAlready =
    given.length > 0 || fromPatron.length > 0 || garbMissing.length > 0 ? (
      <PickGroup title="Yours already">
        {patronGarb && garbMissing.map((itemId) => (
          <p key={`missing:${itemId}`} className="creation-group__line">
            <WarningLine>{garbMissingLine(patronGarb.name, patronGarb.words.get(itemId) ?? itemId)}</WarningLine>
          </p>
        ))}
        {fromSetting.length > 0 && (
        <FoldedGroup label="Given to every character" note={foldNote(fromSetting)}>
          {fromSetting.map(({ entry, qty }) => (
            <PickRow
              key={entry.packEntryId}
              name={qty > 1 ? `${entry.name} ×${qty}` : entry.name}
              blurb={blurbOf(entry.data)}
              source={sourceOf(entry)}
              picked
              given
              onPick={() => toast({ text: `${entry.name} is given to everyone in your setting: it stays in the pack.` })}
            />
          ))}
        </FoldedGroup>
        )}
        {fromKindred.length > 0 && (
        <FoldedGroup label="From your kindred" note={foldNote(fromKindred)}>
          {fromKindred.map(({ entry, qty }) => (
            <PickRow
              key={`kindred:${entry.packEntryId}`}
              name={qty > 1 ? `${entry.name} ×${qty}` : entry.name}
              blurb={blurbOf(entry.data)}
              fit={[{ text: 'from your kindred' }]}
              source={sourceOf(entry)}
              picked
              given
              onPick={() => toast({ text: `${entry.name} comes with your kindred: it stays in the pack.` })}
            />
          ))}
        </FoldedGroup>
        )}
        {patronGarb && fromPatron.length > 0 && (
        <FoldedGroup label={`From ${patronGarb.name}`} note={foldNote(fromPatron)}>
          {fromPatron.map(({ entry, qty }) => (
            <PickRow
              key={`patron:${entry.packEntryId}`}
              name={qty > 1 ? `${entry.name} ×${qty}` : entry.name}
              blurb={blurbOf(entry.data)}
              fit={[{ text: `from ${patronGarb.name}` }]}
              source={sourceOf(entry)}
              picked
              given
              onPick={() => toast({ text: `${entry.name} is your patron's holy garb, given free: it stays in the pack.` })}
            />
          ))}
        </FoldedGroup>
        )}
      </PickGroup>
    ) : null;
  // The coin's sum after what is spent (cs-22, cs-44): ", 22 gp spent: 78 gp left"; over the coin, ", 22 gp spent: 2 gp
  // over." (never "0 left", never a negative); nothing spent, nothing more.
  const spentWords = spent === 0 || moneyNow === null ? '' : left >= 0 ? `, ${show(spent)} spent: ${show(left)} left` : `, ${show(spent)} spent: ${show(-left)} over.`;
  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help ?? gearHelp({ kits: kits.length > 0, shop: shop.length > 0 })}
      helpChoices={kits.map((k) => ({ name: k.name, blurb: blurbOf(k.data) || words(kitContents(k.data, ctx)) }))}
      onBack={() => onBack({ ...live.current.record, moneyTouched: !isUsual })}
      decideLater={onLater ? { onPick: () => void later() } : undefined}
      // Over what there is (mockup creation/13): "▲ 30 silver over: take something off, or raise your coin". A coin
      // outside the dice says so (final drafts D); Next is plain then, and explains.
      // A coin outside the dice is said once, under the stepper (23-H4): the foot keeps its own line.
      hint={problem && moneyNow !== null ? `${show(-left)} over: take something off, or raise your coin` : kitsOver ? kitsOverWords(kitsTaken) : gearHint(kitsTaken, itemsBought.length, gearPicks.map(({ pick }) => ({ taken: givenPicksOf(record, pick.tableId).length, upTo: pick.upTo })))}
      waitsOnline
      stop={(!!problem && moneyNow !== null) || kitsOver}
      // The accent follows the ask (final drafts D): the first kit's Pick until a kit is taken, then Next.
      // Next is the one accent (R3-9: no row's Pick is), plain only while something stops it.
      // While marks wait to be taken, Take these is the one accent (cs-42; #786's review).
      nextAccent={!coinOutside && !kitsOver && !(problem && moneyNow !== null) && waitingPicks().length === 0}
      busy={busy}
      nextLabel={counter ? 'Next' : 'Done'}
      unchanged={gearSignature(record, { shown: moneyShown, usual: isUsual }) === openedWith}
      onNext={() => void next()}
    >
      {moneyRoll && (
        // Starting coin first (final drafts D, mockup creation/final/05): the Roll row (the pack's dice and multiplier,
        // "Roll 3d6 × 10 for starting coin at the table, then enter it."; Design, gallery review of #555), then the
        // average stepper at a value the dice can make, stepping by the roll's multiplier: untouched, "Average" (A3,
        // dec-10 A), as hit points; touched, the line reads as a sentence.
        // Under its own sub-heading, the Roll row only the act (cs-22, picture 21-F1); the sum under the stepper says
        // what is left once something is spent ("120 rolled, 14 spent: 106 left"), the step's one place for it.
        <PickGroup title="Starting coin">
        <div className="gear-coin-block">
          <RollRow die={dieOf(moneyRoll)}>{`Roll ${diceWithoutCoin(moneyRoll)}, then enter it.`}</RollRow>
          <div className={`gear-coin${coinOutside ? ' gear-coin--warn' : ''}${problem && moneyNow !== null ? ' gear-coin--over' : ''}`}>
            <AverageStepper
              id={`${id}-money`}
              label="Starting coin"
              text={moneyShown}
              touched={!isUsual || usual === null}
              untouchedLine={spent > 0 && moneyNow !== null ? `${AVERAGE_LINE}${spentWords}` : AVERAGE_LINE}
              caption={moneyNow === null ? 'Type what you rolled.' : `${moneyNow} rolled${spentWords}`}
              onChange={setCoin}
              onStep={stepCoin}
              wide
            />
            <span className="gear-coin__unit">{unit.label}</span>
          </div>
          {coinOutside && (
            <p className="gear-coin__warn">
              {/* What is wrong and the two ways on (23-H4); nothing is blocked, and the GM sees it on the review. */}
              <WarningLine>{`${coinOutside}. Roll again, or send it and the GM decides.`}</WarningLine>
            </p>
          )}
          {extraMoney > 0 && <p className="creation-group__line">{`Your picks add ${extraMoney} ${unit.key}.`}</p>}
        </div>
        </PickGroup>
      )}
      {somethingToChoose && (
        // How many kits may be taken (07 `creation.kits.pick`, 1 when the pack doesn't say), only with kits to take.
        <PickGroup title={kits.length > 0 ? `To choose (pick ${kitsAllowed})` : 'To choose'}>
          {/* A class with no kit of its own: every kit needs the GM's approval, so all fold (Francis, retest 2). */}
          {specialKits ? (
            <ApprovalFold count={kits.length} more={false} holdsPick={kitsTaken > 0}>
              {kits.map(kitRow)}
            </ApprovalFold>
          ) : (
            kits.map(kitRow)
          )}
          {gearPicks.map(({ pick, table, rows }) => {
            const firstWaiting = waitingPicks()[0]?.pick.tableId;
            // of-11 (G-83): pick up to N rows, fewer allowed; rolled at the table or chosen. A tap MARKS a row (cs-15, the
            // lead's ruling (a) on batch F): nothing is taken until Take these at the fold's end; folding it again takes
            // nothing. A row can be marked more than once (R3-8); − puts one back. The fold's line says what is taken.
            const taken = givenPicksOf(record, pick.tableId).map((p) => p.row);
            const mk = marks[pick.tableId] ?? taken;
            const timesOf = (r: number) => mk.filter((p) => p === r).length;
            const die = typeof table.data.die === 'string' ? table.data.die : '';
            const setMk = (next: number[]) => setMarks((m) => ({ ...m, [pick.tableId]: next }));
            const tableRows: BookTapRow[] = rows.map((row, r) => {
              // Price and weight, as the shop shows them (P27, 2026-11-06); a price the coins can't read is left out.
              const things = entriesOf(row.items);
              const prices = things.map((l) => (priced(l.entry) === null ? null : priced(l.entry)! * l.qty));
              const price = prices.some((p) => p !== null) ? prices.reduce<number>((sum, p) => sum + (p ?? 0), 0) : null;
              const weight = weightWords(things.map((l) => ({ weightCoin: copyOf(l.entry).weightCoin, slots: copyOf(l.entry).slots, qty: piecesOf({ itemId: l.entry.packEntryId, qty: l.qty, ...(l.units !== undefined ? { units: l.units } : {}) }, bundleOf(l.entry)) })), mode);
              const times = timesOf(r);
              return {
                key: String(r),
                range: die ? rangeWords(row) : '',
                name: words(row.items) || row.result || 'nothing',
                line: [price !== null ? show(price) : '', weight].filter(Boolean).join(', '),
                picked: times > 0,
                times,
                onPick: () => (mk.length >= pick.upTo ? toast({ text: pickFull(pick) }) : setMk([...mk, r])),
                onPutBack: () => setMk(mk.filter((_, n) => n !== mk.lastIndexOf(r))),
              };
            });
            const take = () => {
              // Nothing marked and nothing taken: say so. Marks the same as what is taken: nothing to do (cs-43: no line
              // for it; the fold's state line says what is taken, and each taken row shows its −).
              if (sameRows(mk, taken)) return mk.length === 0 ? toast({ text: 'Tap a row first.' }) : undefined;
              const want = mk;
              void run(async () => {
                if (!(await takePicks(pick, rows, want))) return;
                setMarks((m) => ({ ...m, [pick.tableId]: undefined }));
                toast({ text: want.length > 0 ? `In the pack: ${pickWords(rows, want)}` : 'Back out of the pack', onUndo: () => void run(() => takePicks(pick, rows, taken)) });
              });
            };
            return (
              <PickTableFold
                key={`pick:${pick.tableId}`}
                label={pickTitle(pick, table.name)}
                note={`${pickMeta(pick, taken.length)}. ${rows.length} to choose from`}
                open={taken.length > 0}
                onFold={() => setMarks((m) => ({ ...m, [pick.tableId]: undefined }))}
                die={die}
                title={table.name}
                rows={tableRows}
                multiple={pick.upTo > 1}
                // The one accent while marks wait (cs-42): the first table with marks not yet taken.
                takeAccent={pick.tableId === firstWaiting}
                onTake={take}
              />
            );
          })}
          {trinketTable && (
            // The trinket (cs-1): the row's words become an item in the pack. Another pack's trinkets (ct-6) aren't the
            // kindred's: the row's note says where they're from. The Roll row above it (final drafts D); before the pick,
            // the table's row with Open; after it, the result with Change, which reopens the table with it marked.
            <>
              {/* No Roll row over it (cs-22): the row names whose table it is and its die; the sheet says to roll. */}
              {trinket ? (
                <DetailRow picked label="Trinket" note={trinketNote} value={trinket.rolled !== undefined ? `Rolled ${trinket.rolled}: ${trinket.text}` : trinket.text} onOpen={() => setTrinketOpen(true)} />
              ) : (
                <DetailRow label="Trinket" note={[trinketNote, trinketTable.die].filter(Boolean).join(', ') + '. Not rolled yet'} action="Open" onOpen={() => setTrinketOpen(true)} />
              )}
            </>
          )}
          {shop.length > 0 && (
            <>
              {/* The shop as a row (final drafts D): its own screen, opened from here. */}
              <DetailRow label="The shop" action="Open" onOpen={() => setShopping(true)} />
              {itemsBought.length > 0 && (
                <ul className="starting-gear__bought" aria-label={`Bought for ${name}`}>
                  {itemsBought.map((purchase, index) => (
                    <li key={`${purchase.label}-${index}`} className="starting-gear__line">
                      <span>
                        {purchase.label}, {show(purchase.price)}
                      </span>
                      {refunds && purchase.lines.length > 0 && (
                        <button
                          type="button"
                          className="button-secondary button-secondary--small"
                          aria-label={`Put back ${purchase.label}, ${show(purchase.price)} back`}
                          onClick={() =>
                            void run(async () => {
                              if (await remove(purchase)) toast({ text: `Put ${purchase.label} back.` });
                            })
                          }
                        >
                          Put back for {show(purchase.price)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </PickGroup>
      )}
      {yoursAlready}
      {trinketOpen && trinketTable && (
        <OneTableSheet
          table={trinketTable}
          title="Trinket"
          picked={trinket?.text}
          onPick={(words, rolled) => {
            pickTrinket(words, rolled);
            if (words && !isLong(trinketTable)) setTrinketOpen(false);
          }}
          onClose={() => setTrinketOpen(false)}
        />
      )}
      {!somethingToChoose && given.length === 0 && <p className="creation-group__line">Your setting has no kits or shop for {className}. Next goes on with nothing to carry yet.</p>}
      {tally}
      {panel}
      {sequence}
    </CreationStep>
  );
}

/** Whether two lists of a pick table's rows hold the same rows as often, in any order. */
function sameRows(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && [...a].sort((x, y) => x - y).every((r, n) => r === [...b].sort((x, y) => x - y)[n]);
}

/** How many rows `to` holds beyond `from`, row by row (a row marked twice counts twice). */
function changedRows(from: readonly number[], to: readonly number[]): number {
  return [...new Set(to)].reduce((n, r) => n + Math.max(0, to.filter((p) => p === r).length - from.filter((p) => p === r).length), 0);
}
