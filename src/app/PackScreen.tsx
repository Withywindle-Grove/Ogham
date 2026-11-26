// The Pack tab (docs/05-features.md "Inventory and encumbrance"; 06 Navigation; M4 step 4, ruled 2026-10-23; on
// creation's standard from plan m5b-players-screens-standard C). One carrier's items, grouped by where they're carried
// (A–Z in each group), with the load and its bar first (creation's Gear piece, LoadSummary), the folding groups and the
// Party stash as fold rows, the items waiting for the GM as a card with the warning sign, and the foot: the count and
// Add item, the screen's one accent button. Tap an item for its sheet: its details and what you can do with it. After
// any action on an item, or adding one, the item closes and the screen goes back to the top (ruled 2026-10-24).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { Db } from '../core/supabase.ts';
import { chargesOf, loadHiddenCharges } from '../modules/inventory/charges.ts';
import { carriedLoad, toLoadLine, wornArmour, type CarriedLoad } from '../modules/inventory/encumbrance.ts';
import { loadTreasureSwitches, nextTreasureSwitch, setCarryingTreasure, type TreasureSwitch } from '../modules/inventory/treasureSwitch.ts';
import {
  loadCarriers,
  loadInventorySettings,
  loadInventory,
  mayChangeCarrier,
  type InventoryLine,
  type NamedCarrier,
} from '../modules/inventory/inventory.ts';
import { atHandAction, atHandLines, countWords, isContainer, isSeparate } from '../modules/inventory/packView.ts';
import { AddItem } from './AddItem.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { forgetCampaignSetting, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
// The Pack's parts, each in its own file so other screens can reuse them (M5 step 3).
import { CarrierItems, type WeaponBreakdown, type WeaponLine, type WeaponRolls } from './CarrierItems.tsx';
import { ChargesDialog } from './ChargesDialog.tsx';
import { LoadSummary } from './LoadSummary.tsx';
import { tierWords } from './packHelpers.ts';
import { startsOpen, useFoldOpen } from './packOpen.ts';
import './PackScreen.css';
import './RulesBrowser.css';
import { useLogVersion } from './campaignLog.tsx';
import { useWide } from './useWide.ts';
import { ErrorToast, useToast } from '../ui/ToastHost.tsx';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { BookType, FoldedGroup } from '../ui/creation.tsx';
import { foldSummary, itemCount } from './packHelpers.ts';
import { CoinLine, PackFoot, WaitingCard } from './PackParts.tsx';
import { PurseSheet } from './PurseSheet.tsx';
import { coinLine, denominationsOf, readCost } from '../modules/inventory/coinWords.ts';
import { purchaseToast } from './purchaseToast.ts';
import { loadPurse, type Coins } from '../modules/inventory/purse.ts';
import type { CharacterLightView } from './LightSection.tsx';
import { registry } from './services.ts';
import { usePlayerView } from './playerView.ts';

// Kept here too, for the screens that already import it from the Pack (AddItem, WaitingForYou).
export { homebrewItem } from './packHelpers.ts';

interface Loaded {
  lines: InventoryLine[];
  /** The GM's hidden charge totals (empty for players: the database never sends them). */
  hidden: Map<string, { total: number | null; spent: boolean }>;
  carriers: NamedCarrier[];
  setting: CampaignSetting;
  mode: EncumbranceMode;
  /** The campaign's "Charged items can be recharged" (when neither the item nor the setting rules say). */
  rechargeDefault: boolean;
  /** Each character's Carrying treasure switch (eq-3): null follows the pack. */
  treasure: Map<string, TreasureSwitch>;
}

/** No tiny categories (a setting that marks none): only items marked `unencumbering` themselves are tiny. */
const NO_TINY: ReadonlySet<string> = new Set();

const sameCarrier = (line: InventoryLine, carrier: NamedCarrier) =>
  carrier.actorId !== null ? line.actorId === carrier.actorId : line.locationId === carrier.locationId;

export function PackScreen({
  db,
  user,
  campaign,
  carrierId,
  onChanged,
  view = 'pack',
  side = null,
  weaponLine,
  weaponBreakdown,
  weaponRolls,
  light = null,
  litLight = null,
  onRead,
  inBar = false,
  extra = null,
}: {
  /**
   * At hand on the Player screen (dec-13 C9, ps-9; lt-4, page 35): the light's rows, lit, not lit or burnt out, drawn
   * after At hand's items and before `extra`, with no heading of their own, and the pack line they stand for (null for
   * several lights), whose item row is then left out (each thing shows once). `rows` is given the way to open that
   * line's item sheet (the light's name opens it, frame P1), or null when the line isn't in the pack as loaded. With
   * nothing else at hand, the light alone makes the section.
   */
  litLight?: { lineId: string | null; rows: (onOpenItem: (() => void) | null) => ReactNode } | null;
  /**
   * At hand only (dec-13 C8): rows that join At hand's section (the Player screen's pinned traits), after the items and
   * the light; null or nothing when there are none. The section shows whenever there are items, the light or these.
   */
  extra?: ReactNode;
  /** Told once the pack's read has answered (read or failed): the Player screen's one loading state waits for it (C11). */
  onRead?: (() => void) | undefined;
  /**
   * The screen's bar already shows the title (the Player screen's standard bar, plan A1): the Pack's own heading is then
   * kept for screen readers only, as the Player screen keeps the name's (A+B), so the title isn't drawn twice.
   */
  inBar?: boolean;
  /** The character's light (the Player screen's `useCharacterLight`): a light's Light or Put out on its At hand row. */
  light?: CharacterLightView | null;
  /** At hand (M5 gate C3): a weapon's attack bonus and damage from its item data ("+2, 1d8"), or null. */
  weaponLine?: WeaponLine;
  /** At hand (sq-4): that figure's parts, for the breakdown and the Attack sheet (ah-1). */
  weaponBreakdown?: WeaponBreakdown;
  /** At hand (as-1): a weapon's rolls, for the Attack sheet. */
  weaponRolls?: WeaponRolls;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The character whose pack this is, or null for the Party stash (the GM's view from the console). */
  carrierId: string | null;
  /** The whole Pack tab, or only the character's pinned items (At hand, on the Player screen). */
  view?: 'pack' | 'atHand';
  /** On a landscape tablet, the right-hand column: Add item opens there, beside the pack (M4 gate run). */
  side?: HTMLElement | null;
  /** Something was saved (so the log and sheet can refresh). */
  onChanged?: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null | 'error'>(null);
  const answered = loaded !== null;
  useEffect(() => {
    if (answered) onRead?.();
  }, [answered, onRead]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<NamedCarrier | null>(null);
  // How each folding group was left on this device (undefined until toggled here); until then they start as N19
  // says, from what's At hand (below, once the pack is loaded). The stash on its own screen is always open.
  const [gearSaved, setGearOpen] = useFoldOpen('gear');
  const [stashSaved, setStashOpen] = useFoldOpen('stash');
  // The items waiting for the GM: a card that opens their list as a sheet (plan C).
  const [waitingShown, setWaitingShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; warn: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // The charges prompt for the GM, popped up when a charged item is first handed out (ruled 2026-10-24).
  const [askCharges, setAskCharges] = useState<InventoryLine | null>(null);
  // The GM's console opens the stash, and can switch to any character's pack (to reveal or set charges).
  const [showing, setShowing] = useState<string | null>(carrierId);
  // The coin's sheets (K10), opened from the coin line.
  const [coinOpen, setCoinOpen] = useState(false);
  // Opened from a purchase's toast (K7): Spend with the cost filled in.
  const [spendFor, setSpendFor] = useState<Coins | null>(null);
  // The character's purse (K9, K15): read for its own player and for the GM; null until read, or when nothing came back.
  const [read, setRead] = useState<{ of: string; coins: Coins } | null>(null);
  const [purseVersion, setPurseVersion] = useState(0);
  const lastTier = useRef<string | null>(null);
  const show = useToast();
  // Landscape tablet (ruled 2026-10-24): a list on the left, the load summary (or the chosen pack) on the right,
  // never an empty side; item details open as a centred card.
  const wide = useWide();
  // An undo from the log reloads the pack in place.
  const logVersion = useLogVersion();

  const load = useCallback(async () => {
    const [inventory, carriers, setting, settings, hidden, treasure] = await Promise.all([
      loadInventory(db, campaign.id),
      loadCarriers(db, campaign.id),
      loadCampaignSetting(db, user.id, campaign.id),
      loadInventorySettings(db, campaign.id),
      loadHiddenCharges(db, campaign.id),
      loadTreasureSwitches(db, campaign.id),
    ]);
    if (!inventory || !carriers || !setting || !settings) return null;
    return { lines: inventory.lines, carriers, setting, mode: settings.mode, rechargeDefault: settings.rechargeDefault, hidden, treasure: treasure ?? new Map() };
  }, [db, user.id, campaign.id]);

  useEffect(() => {
    let current = true;
    load().then(
      (found) => current && setLoaded(found ?? 'error'),
      () => current && setLoaded('error'),
    );
    return () => {
      current = false;
    };
  }, [load, logVersion]);

  const carriers = loaded && loaded !== 'error' ? loaded.carriers : [];
  const mine = showing === null ? null : (carriers.find((c) => c.actorId === showing) ?? null);
  const stash = carriers.find((c) => c.locationId !== null) ?? null;
  const main = mine ?? stash;
  const linesOf = (carrier: NamedCarrier | null) => (loaded && loaded !== 'error' && carrier ? loaded.lines.filter((l) => sameCarrier(l, carrier)) : []);
  const rules = loaded && loaded !== 'error' ? loaded.setting.encumbrance : null;
  const mode = loaded && loaded !== 'error' ? loaded.mode : 'none';
  // A one-off waiting for the GM counts for nothing until approved; what isn't carried ("Other") never counts.
  const counting = linesOf(main).filter((l) => l.approval === 'approved' && !(rules && isSeparate(l, rules)));
  // The GM's Carrying treasure switch (eq-3) rides along with the armour worn; null follows the pack.
  const treasureSwitch: TreasureSwitch = loaded && loaded !== 'error' && main?.actorId ? (loaded.treasure.get(main.actorId) ?? null) : null;
  const countingLines = counting.map(toLoadLine);
  const carried = rules && main && main.actorId ? carriedLoad(countingLines, rules, mode, { armour: wornArmour(countingLines, rules), carryingTreasure: treasureSwitch }) : ({ mode: 'none' } as CarriedLoad);
  const treasureSuggested = carried.mode === 'armour' ? (carried.treasureSuggested ?? carried.carriesTreasure) : false;
  // N19 (ruled 2026-10-28): with something At hand the folding groups start collapsed; with nothing, Gear starts open.
  const atHand = loaded && loaded !== 'error' && mine ? atHandLines(linesOf(mine), loaded.setting.charges).length > 0 : false;
  const gearOpen = gearSaved ?? startsOpen('gear', atHand);
  const stashOpen = carrierId === null || (stashSaved ?? startsOpen('stash', atHand));

  // A brief note when the load crosses into another tier. The log line "<name> is now <tier>" is the database's:
  // it works the tier out and writes it once, whichever devices have the pack open (M5 step 4, health M4 item 11).
  const tier = tierWords(carried);
  const tierKey = `${main?.actorId ?? 'stash'}:${tier}`;
  // How slow the tier is (0 is the lightest; over the max is slowest): the banner is in the warning colour only
  // when it gets slower (ruled 2026-10-23), neutral when lighter.
  const ladder = carried.mode === 'coin' ? (rules?.coin?.tiers ?? []) : carried.mode === 'slot' ? (rules?.slot?.tiers ?? []) : [];
  const rank = carried.mode === 'armour' ? (carried.carriesTreasure ? 1 : 0) : carried.mode === 'none' ? 0 : carried.over ? ladder.length : ladder.findIndex((t) => t.label === tier);
  // Only the player whose pack it is sees the banner (the log line is for everyone).
  const own = main?.ownerUserId === user.id;
  // The coin line is its own player's (K9; hard rule 5) and the GM's, who reads every purse (K15, PC7): a player's
  // Pack asks for no other purse, and the database's read rule sends nothing of another living character's.
  const coinAsGm = isGm(user, campaign.id) && mine?.ownerUserId !== user.id;
  // The GM's own tools on the Pack, not in the GM's view as the player (pg32-3, pg32-4): the charges prompt after
  // handing something out, and the treasure switch.
  const playerView = usePlayerView();
  const gmTools = isGm(user, campaign.id) && playerView === null;
  const purseOf = view === 'pack' && mine && mine.actorId && (mine.ownerUserId === user.id || coinAsGm) ? mine.actorId : null;
  useEffect(() => {
    if (!purseOf) return;
    let current = true;
    loadPurse(db, campaign.id, purseOf).then(
      (found) => current && setRead({ of: purseOf, coins: found ?? {} }),
      () => current && setRead(null),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, purseOf, logVersion, purseVersion]);
  // Only the purse read for the pack on screen (a switch of character never shows the last one's coin).
  const purse = purseOf !== null && read?.of === purseOf ? read.coins : null;
  useEffect(() => {
    if (!loaded || loaded === 'error' || !main) return;
    const [was, wasRank, wasTier] = (lastTier.current ?? '').split('|');
    lastTier.current = `${main.actorId ?? 'stash'}|${rank}|${tier}`;
    if (was !== (main.actorId ?? 'stash') || wasTier === tier || !tier || !main.actorId) return;
    if (!own) return;
    setToast({ text: `${main.name} is now ${tier}`, warn: rank > Number(wasRank) });
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [tierKey, tier, rank, own, loaded, main]);

  /** The GM flips Carrying treasure for this character (eq-3): one tap, a toast with Undo. */
  async function flipTreasure() {
    if (!main?.actorId || carried.mode !== 'armour') return;
    const on = nextTreasureSwitch(treasureSuggested, treasureSwitch);
    const done = await runCommand(registry, db, user, setCarryingTreasure, { carrier: main, on });
    if (!done.ok) return show({ text: done.message, error: true });
    const fresh = await load();
    if (fresh) setLoaded(fresh);
    onChanged?.();
    show({
      text: `${main.name}: ${(on ?? treasureSuggested) ? 'Carrying treasure' : 'Not carrying treasure'}`,
      onUndo: () => void undoTreasure(),
    });
  }

  async function undoTreasure() {
    const eventId = await latestChange(db, campaign.id, setCarryingTreasure.name, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    const again = await load();
    if (again) setLoaded(again);
    onChanged?.();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  }

  /** Undo from the toast after Add item (K7): the generic Undo of the newest add, as the log's (a joined add today). */
  async function undoAdd() {
    const eventId = await latestChange(db, campaign.id, 'inventory.add', user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    const again = await load();
    if (again) setLoaded(again);
    onChanged?.();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  }

  /** Back to the top of the Pack: after an action on an item, or adding one (ruled 2026-10-24). */
  const toTop = () => window.scrollTo?.({ top: 0 });
  // Add item takes the screen (not beside the pack): it opens at its top, with "‹ Pack" and its search in view,
  // wherever the Pack was scrolled to (M4b re-test, 2026-10-26).
  const takesScreen = adding !== null && !side;
  useEffect(() => {
    if (takesScreen) window.scrollTo?.({ top: 0 });
  }, [takesScreen]);

  async function run<T>(write: () => Promise<{ ok: true; value: T } | { ok: false; message: string; reason?: string }>, close = false) {
    setBusy(true);
    setProblem(null);
    const result = await write();
    if (result.ok) {
      const fresh = await load();
      if (fresh) setLoaded(fresh);
      onChanged?.();
      if (close) {
        setOpen(null);
        toTop();
      }
    } else {
      // Saved from an old copy (someone changed it on another device): say so and show the latest, so the person
      // can try again on what's there now.
      if (result.reason === 'stale') {
        const fresh = await load();
        if (fresh) setLoaded(fresh);
      }
      setProblem(result.message);
    }
    setBusy(false);
    return result.ok;
  }

  if (view === 'atHand') {
    // At hand: what fills itself (in hand; worn or held with charges) and what's pinned, each once; nothing at all
    // when there's none (no hint). Ruled 2026-10-23.
    // Nothing while the pack opens, so nothing jumps under a finger when the items arrive (the light is read on its
    // own); if the pack can't be read, the light and the pinned traits still show.
    if (!loaded) return null;
    const ready = loaded !== 'error' && mine && rules ? { loaded, mine, rules } : null;
    // The light's pack line: its row is left out (the light's rows stand for it), but its sheet is kept, opened from the
    // light's name (dec-13 C9; frame P1; lt-4: lit or not).
    const litLine = ready && litLight?.lineId ? (linesOf(ready.mine).find((l) => l.id === litLight.lineId) ?? null) : null;
    // The lit line keeps its place in At hand's order (a row stays when it has Use a charge); when it isn't At hand
    // itself (not pinned, not in hand, or hidden) it's added last, for its sheet only, and never draws a row.
    const pins = ready ? atHandLines(linesOf(ready.mine), ready.loaded.setting.charges) : [];
    // The weapon in hand (dec-13 C14, frame P1): each weapon whose At hand action is Attack leaves At hand's rows for its
    // own block, above At hand.
    const inHand = ready ? pins.filter((l) => atHandAction(l, ready.loaded.setting.charges, ready.loaded.rechargeDefault) === 'Attack') : [];
    const rest = pins.filter((l) => !inHand.includes(l));
    // Against every At hand line, the weapon in hand's too: a lit line drawn as the block already has its sheet there,
    // so At hand never adds a second one for it (dec-13 C6).
    const litAlone = !!litLine && !pins.some((l) => l.id === litLine.id);
    const atHandShown = rest.length > 0 || !!litLight || !!extra;
    if (inHand.length === 0 && !atHandShown) return null;
    const items = (lines: InventoryLine[], only: { inHand?: boolean; sheetOnly?: string | null; sheetAlone?: boolean }) =>
      ready && (
        <CarrierItems
          carrier={ready.mine}
          lines={lines}
          {...only}
          // Everything the character carries: a weapon mode's stack (ah-3) needn't be At hand itself.
          allLines={linesOf(ready.mine).filter((l) => l.approval !== 'pending')}
          mode="none"
          rules={ready.rules}
          user={user}
          campaign={campaign}
          others={carriers.filter((c) => c !== ready.mine)}
          open={open}
          setOpen={setOpen}
          busy={busy}
          gearOpen
          setGearOpen={() => undefined}
          run={run}
          db={db}
          items={ready.loaded.setting.items}
          charges={ready.loaded.setting.charges}
          rechargeDefault={ready.loaded.rechargeDefault}
          onNote={setNote}
          hidden={ready.loaded.hidden}
          packs={ready.loaded.setting.packs}
          setting={ready.loaded.setting}
          flat
          atHand
          // The Player screen's buttons are stacked, with their icons (dec-13 C6, sb-2).
          stackedButtons
          // And its rows read as frame P1 draws them: die glyphs on a weapon not in hand, the star before the name.
          playerAtHand
          light={light}
          weaponLine={weaponLine}
          weaponBreakdown={weaponBreakdown}
          weaponRolls={weaponRolls}
        />
      );
    return (
      // Every pop-up here is a Sheet (plan m5b-players-screens-standard A4): the item's sheet slides up on a phone.
      <SheetScope.Provider value>
      <ErrorToast message={problem} />
      {inHand.length > 0 && (
        <section className="pack pack--in-hand" aria-label="Weapon in hand">
          {items(inHand, { inHand: true })}
        </section>
      )}
      {atHandShown && (
        <section className="pack pack--at-hand" aria-label="At hand">
          <h2 className="pack__group-title">At hand</h2>
          {/* No item list when nothing is left for it: the lit line drawn as the weapon in hand has its sheet there. */}
          {(rest.length > 0 || (litLine && litAlone)) &&
            items(litLine && litAlone ? [...rest, litLine] : rest, {
              // The lit light's line: its sheet only, no row (the light's rows stand for it), unless it is At hand
              // itself and has Use a charge.
              sheetOnly: litLine?.id ?? null,
              sheetAlone: litAlone,
            })}
          {litLight?.rows(litLine ? () => setOpen(litLine.id) : null)}
          {extra}
        </section>
      )}
      </SheetScope.Provider>
    );
  }
  if (loaded === null) return <p role="status">Opening…</p>;
  if (loaded === 'error' || !main || !rules) {
    return (
      <p className="form-error" role="alert">
        Couldn’t open the pack. Check your connection and try again.
      </p>
    );
  }
  const addItem = adding && (
      <AddItem
        db={db}
        user={user}
        campaign={campaign}
        carrier={adding}
        setting={loaded.setting}
        mode={mode}
        containers={linesOf(adding).filter(isContainer)}
        lines={linesOf(adding)}
        onBack={() => setAdding(null)}
        onAdded={async (bought, added, made) => {
          forgetCampaignSetting(campaign.id);
          const fresh = await load();
          if (fresh) setLoaded(fresh);
          onChanged?.();
          setAdding(null);
          setOpen(null);
          toTop();
          // After Add (K7, PK10b; tn-1): what was added, and a purchase's cost not spent yet with "Spend N", which opens
          // Spend filled in; nothing is charged by itself. Undo where the generic Undo can take it back (a joined add).
          if (added && made && added.approval !== 'pending') {
            const coinNames = denominationsOf(loaded.setting.rulesSets);
            const cost = bought ? made.cost : '';
            show(
              purchaseToast({
                who: adding.actorId ? adding.name : null,
                what: countWords(added, made.qty),
                cost,
                denominations: coinNames,
                coins: purse && cost ? readCost(coinNames, cost) : null,
                onSpend: (coins) => {
                  setSpendFor(coins);
                  setCoinOpen(true);
                },
                onUndo: made.joined ? () => void undoAdd() : undefined,
              }),
            );
          }
          // A player's one-off waits for the GM, and says so where the screen lands.
          if (added?.approval === 'pending') setNote('Sent to the GM for approval.');
          // Handed out by the GM with charges not set yet: ask for them now.
          if (added && gmTools && chargesOf(added, loaded.setting.charges) && added.chargesLeft === null) setAskCharges(added);
        }}
      />
  );
  if (addItem && !side) return addItem;

  const others = (from: NamedCarrier) => carriers.filter((c) => c !== from);
  const categoryName = (id: string) => loaded.setting.itemCategories.get(id)?.name ?? (id ? `${id.charAt(0).toUpperCase()}${id.slice(1).replace(/[-_]+/g, ' ')}` : 'Other');
  const waitingLines = linesOf(main).filter((l) => l.approval === 'pending');
  const stashLines = mine ? linesOf(stash) : [];
  // The Pack's At hand group (Design on #552, scope check 1 (a)): the pinned items, first and always open, each listed
  // only there and not again in its own group (its line keeps where it is, "Worn", "In hand").
  const carriedLines = linesOf(main).filter((l) => l.approval !== 'pending');
  // Only what has an action (Francis, 2026-11-07, on #552): a pinned thing with nothing to do stays in its own group.
  const pinnedLines = mine ? carriedLines.filter((l) => l.pinned && !isSeparate(l, rules) && atHandAction(l, loaded.setting.charges, loaded.rechargeDefault) !== null).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) : [];
  const restLines = carriedLines.filter((l) => !pinnedLines.includes(l));

  // The foot's count (plan C: "20 items"): everything carried, a stack counting each of its things.
  const carriedCount = linesOf(main).filter((l) => l.approval === 'approved').reduce((sum, l) => sum + l.qty, 0);
  // The setting's coins (its own names, pu-10); with none named and nothing held there is no coin to show.
  const denominations = denominationsOf(loaded.setting.rulesSets);
  const coinShown = purseOf !== null && purse !== null && (denominations.length > 0 || Object.keys(purse).length > 0);
  // The load and its notes: at the top on narrow screens; on the right on a landscape tablet.
  const summary = (
    <div className="pack__summary">
      {toast && (
        <p className={toast.warn ? 'pack__banner pack__banner--warn' : 'pack__banner'} role="status">
          {toast.text}
        </p>
      )}
      {note && (
        <p className="pack__note" role="status">
          {note}
        </p>
      )}
      {mine && (
        <LoadSummary
          load={carried}
          rules={rules}
          from={loaded.setting.encumbranceFrom}
          treasure={carried.mode === 'armour' ? { gmSwitch: treasureSwitch, onSwitch: gmTools ? () => void flipTreasure() : null } : undefined}
          // A tap on the burden opens its levels in a pop-up (tfb-4, frame M2h).
          levelsPopUp
        />
      )}
      {coinShown && (
        // The book's type (dec-10 S2) on the Pack's own coin surfaces: the line and the sheets it opens. The load above
        // and the lists below belong to other rows of the plan and keep today's faces.
        <BookType>
          <CoinLine words={coinLine(denominations, purse)} onOpen={() => setCoinOpen(true)} />
          {coinOpen && mine && purse && (
            <PurseSheet
              db={db}
              user={user}
              carrier={mine}
              recipients={carriers.filter((c) => c !== mine)}
              denominations={denominations}
              coins={purse}
              gm={coinAsGm}
              key={spendFor ? 'spend' : 'coin'}
              spend={spendFor ?? undefined}
              onClose={() => {
                setCoinOpen(false);
                setSpendFor(null);
              }}
              onChanged={() => {
                setPurseVersion((v) => v + 1);
                onChanged?.();
              }}
            />
          )}
        </BookType>
      )}
    </div>
  );
  const layout = !wide ? 'pack' : carrierId === null ? 'pack pack--wide pack--inventory' : side ? 'pack pack--wide pack--beside' : 'pack pack--wide pack--two';

  return (
    // Every pop-up on the Pack is a Sheet (plan m5b-players-screens-standard A4): up from the bottom on a phone.
    <SheetScope.Provider value>
    <section className={layout} aria-label={mine ? `${mine.name}’s pack` : 'Party stash'}>
      {carrierId === null && (
        <div className="pack__actions pack__whose" role="group" aria-label="Whose pack">
          {/* The Party stash first, then each character (ruled 2026-10-24: "Inventory"). */}
          {[...carriers.filter((c) => c.locationId !== null), ...carriers.filter((c) => c.locationId === null)].map((c) => (
            <button
              key={c.actorId ?? c.locationId}
              type="button"
              className="button-secondary"
              aria-pressed={(c.actorId ?? null) === showing}
              onClick={() => {
                setShowing(c.actorId);
                setOpen(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <h1 className={inBar ? 'visually-hidden' : 'pack__title'}>{mine ? `${mine.name}’s pack` : 'Party stash'}</h1>
      {!side && summary}
      <div className="pack__list">
      <ErrorToast message={problem} />

      {pinnedLines.length > 0 && (
        <section className="pack__group pack__group--at-hand" aria-label="At hand">
          <div className="pack__group-head">
            <h2 className="pack__group-title">At hand</h2>
            <span className="auth__meta">{itemCount(pinnedLines.length)}</span>
          </div>
          <CarrierItems
            carrier={main}
            lines={pinnedLines}
            allLines={carriedLines}
            mode={mode}
            rules={rules}
            user={user}
            campaign={campaign}
            others={others(main)}
            open={open}
            setOpen={setOpen}
            busy={busy}
            gearOpen
            setGearOpen={() => undefined}
            run={run}
            db={db}
            items={loaded.setting.items}
            charges={loaded.setting.charges}
            rechargeDefault={loaded.rechargeDefault}
            onNote={setNote}
            hidden={loaded.hidden}
            packs={loaded.setting.packs}
            setting={loaded.setting}
            flat
            atHand
            light={light}
            weaponLine={weaponLine}
            weaponBreakdown={weaponBreakdown}
            weaponRolls={weaponRolls}
          />
        </section>
      )}
      {(restLines.length > 0 || pinnedLines.length === 0) && (
      <CarrierItems
        carrier={main}
        lines={restLines}
        allLines={carriedLines}
        mode={mode}
        rules={rules}
        user={user}
        campaign={campaign}
        others={others(main)}
        open={open}
        setOpen={setOpen}
        busy={busy}
        gearOpen={gearOpen}
        setGearOpen={setGearOpen}
        run={run}
        db={db}
        items={loaded.setting.items}
        charges={loaded.setting.charges}
        rechargeDefault={loaded.rechargeDefault}
        onNote={setNote}
        hidden={loaded.hidden}
        packs={loaded.setting.packs}
          setting={loaded.setting}
        categoryName={categoryName}
        tinyCategories={loaded.setting.tinyCategories ?? NO_TINY}
        // Only for the GM's line in the GM's view (a weapon's true figure, pg32-4): a row here draws no rolls.
        weaponRolls={playerView ? weaponRolls : undefined}
      />
      )}
      {waitingLines.length > 0 && (
        // One-offs waiting for the GM (ruled 2026-10-24): not in the pack, and counting for nothing until approved. A
        // card with the warning sign (plan C) that opens their list as a sheet.
        <WaitingCard names={waitingLines.map((l) => l.name)} onOpen={() => setWaitingShown(true)} />
      )}
      {waitingShown && waitingLines.length > 0 && (
        <Dialog label="Waiting for the GM" onClose={() => setWaitingShown(false)}>
          <section aria-label="Waiting for the GM">
            <CarrierItems
              carrier={main}
              lines={waitingLines}
              mode={mode}
              rules={rules}
              user={user}
              campaign={campaign}
              others={[]}
              open={open}
              setOpen={setOpen}
              busy={busy}
              gearOpen
              setGearOpen={() => undefined}
              run={run}
              db={db}
              items={loaded.setting.items}
              charges={loaded.setting.charges}
              rechargeDefault={loaded.rechargeDefault}
              onNote={setNote}
              hidden={loaded.hidden}
              packs={loaded.setting.packs}
          setting={loaded.setting}
              flat
            />
          </section>
        </Dialog>
      )}

      {mine && stash && carrierId !== null && (
        // The Party stash below a pack: a fold row with its summary (plan C), N19's rule saying how it starts.
        <section className="pack__stash" aria-label="Party stash">
          <FoldedGroup label="Party stash" note={foldSummary(stashLines)} open={stashOpen} onToggle={(next) => (next === stashOpen ? undefined : setStashOpen(next))}>
            {stashOpen && (
              <>
                <CarrierItems
                  carrier={stash}
                  lines={stashLines}
                  mode={mode}
                  rules={rules}
                  user={user}
                  campaign={campaign}
                  others={others(stash)}
                  open={open}
                  setOpen={setOpen}
                  busy={busy}
                  gearOpen
                  setGearOpen={() => undefined}
                  run={run}
                  db={db}
                  items={loaded.setting.items}
                  charges={loaded.setting.charges}
                  rechargeDefault={loaded.rechargeDefault}
                  onNote={setNote}
                  hidden={loaded.hidden}
                  packs={loaded.setting.packs}
                  setting={loaded.setting}
                  categoryName={categoryName}
                />
                <button type="button" className="button-secondary button-secondary--small" onClick={() => setAdding(stash)}>
                  Add to the Party stash
                </button>
              </>
            )}
          </FoldedGroup>
        </section>
      )}
      {/* The foot (plan C): the count, then Add item, the screen's one accent button. */}
      <PackFoot count={carriedCount} onAdd={mayChangeCarrier(user, main) ? () => setAdding(main) : null} />
      </div>
      {addItem && side && createPortal(addItem, side)}
      {!addItem && side && createPortal(summary, side)}
      {askCharges && (
        <ChargesDialog
          line={askCharges}
          rules={loaded.setting.charges}
          campaignId={campaign.id}
          busy={busy}
          onDone={() => setAskCharges(null)}
          run={run}
          db={db}
          user={user}
          carrier={carriers.find((c) => (askCharges.actorId ? c.actorId === askCharges.actorId : c.locationId === askCharges.locationId)) ?? main}
        />
      )}
    </section>
    </SheetScope.Provider>
  );
}
