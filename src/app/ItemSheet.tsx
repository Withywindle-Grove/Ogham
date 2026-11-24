// The item sheet (docs/06 "Item sheet"; plan m5b-players-screens-standard C): an item's details and what can be done
// with it, a Sheet opened from its row in the Pack or At hand. The description and its source line, then the actions as
// rows (a chevron where one asks more), Drop last and set apart (no confirm, Undo in the toast), and the star beside ✕
// that pins the item to the top. Give to…, Put in… and Drop on a stack open the MoveSheet (ItemMoves.tsx). After an
// action the item closes and the screen goes back to the top of the Pack (ruled 2026-10-24).
import { useId, useState, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { diceRange, recordRoll } from '../core/rolls.ts';
import { chargesOf, recharge, revealCharges, seemsSpent, setCharges, useCharge, type ChargeRules } from '../modules/inventory/charges.ts';
import type { EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import {
  emptyContainer,
  equipAnyway,
  equipItem,
  noteRuleSkipped,
  approveItem,
  declineItem,
  moveItem,
  giveAway,
  hideFromAtHand,
  pinItem,
  removeItem,
  revealItemField,
  setItemQty,
  type InventoryLine,
  type NamedCarrier,
} from '../modules/inventory/inventory.ts';
import { amountText, EQUIP_SLOTS, isContainer, isWornSlot, showsAtHandByItself, stackable } from '../modules/inventory/packView.ts';
import { describeEntry, sourceLine } from '../modules/library/describe.ts';
import { saveHomebrewEntry } from '../modules/library/homebrew.ts';
import type { SourceTitles } from '../modules/library/sourceTitles.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { checkEquip, EquipWarningCard, type EquipCheck } from './EquipWarning.tsx';
import { countWords, shownName } from '../modules/inventory/packView.ts';
import { cameBackText, latestChange, undoChange, type CameBack } from '../core/undo.ts';
import { MoveSheet, type Placement } from './ItemMoves.tsx';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Breakdown, ListRow, PinStar, RowList, WarningSign } from '../ui/parts.tsx';
import { RollPrompt } from '../ui/RollPrompt.tsx';
import { RollCard } from '../ui/dice.tsx';
import { Icon } from '../ui/icons.tsx';
import type { AttackRoll } from '../modules/characters/play.ts';
import { Lines } from './RulesBrowser.tsx';
import { registry } from './services.ts';
import { chargeWords, homebrewItem, type Run } from './packHelpers.ts';
import './PackScreen.css';
import './RulesBrowser.css';
import { useToast } from '../ui/ToastHost.tsx';
import { GmLine } from '../ui/GmLine.tsx';
import type { Line } from '../modules/library/describe.ts';
import { PlayerViewContext, usePlayerView } from './playerView.ts';

/**
 * The sheet's own state (which pop-up is open, what's typed). It lives with the item's row, not the sheet, so it
 * stays as it was when the item is closed and opened again.
 */
export function useItemSheetState(line: InventoryLine) {
  const [recharging, setRecharging] = useState(false);
  const [alsoHomebrew, setAlsoHomebrew] = useState(false);
  // Give, Put it and Drop each open one sheet with how many and where (B19, B24, ruled 2026-10-25).
  const [moving, setMoving] = useState<'give' | 'put' | 'drop' | null>(null);
  // The weapon figure's breakdown (sq-4), opened from its row on the sheet.
  const [figure, setFigure] = useState(false);
  // Empty… on a container (ruled 2026-10-24): the popup's state.
  const [emptying, setEmptying] = useState<'choose' | 'drop' | null>(null);
  // Putting something on checks the class's rules (blocked) and the setting's equip warnings first (ruled 2026-10-21, 2026-10-25).
  const [warned, setWarned] = useState<EquipCheck | null>(null);
  const [emptyTo, setEmptyTo] = useState<string>('');
  // The item's own recharge dice, if it has them (recharge {amount, every}); the GM can type others.
  const ownRecharge = line.details.recharge && typeof line.details.recharge === 'object' ? (line.details.recharge as { amount?: unknown }).amount : undefined;
  const [rechargeBy, setRechargeBy] = useState(typeof ownRecharge === 'string' || typeof ownRecharge === 'number' ? String(ownRecharge) : '');
  return { figure, setFigure, recharging, setRecharging, alsoHomebrew, setAlsoHomebrew, moving, setMoving, emptying, setEmptying, warned, setWarned, emptyTo, setEmptyTo, rechargeBy, setRechargeBy };
}

export type ItemSheetState = ReturnType<typeof useItemSheetState>;

/**
 * The GM's line in the view (pg32-4), in the form M3g and M3g2 draw ("Only you see this: the true figure is d20 −1,
 * cursed."; "…: Ring of the Drowned Bell, +1 to saves, cursed."), or null when nothing is hidden: the weapon's true
 * figure and hidden notes first, then each hidden field not yet revealed by its value (a yes-or-no field by its name,
 * "cursed"; a "no" left out), then the hidden charge count ("3 charges left"), joined by commas.
 */
export function gmLineWords(hidden: readonly Line[], charges: { total: number | null; spent: boolean; used: number } | null, figures: readonly string[]): string | null {
  const leaves = (all: readonly Line[]): string[] =>
    all.flatMap((l) => (l.lines ? leaves(l.lines) : l.value === 'No' ? [] : l.value === 'Yes' ? [l.label.toLowerCase()] : [l.value ?? l.label]));
  const left = charges && charges.total !== null ? Math.max(0, charges.total - charges.used) : null;
  const count = !charges ? [] : [left === null ? 'charges not set' : charges.spent || left === 0 ? 'spent' : left === 1 ? '1 charge left' : `${left} charges left`];
  const facts = [...new Set([...figures, ...leaves(hidden), ...count].map((f) => f.trim().replace(/\.$/, '')).filter((f) => f !== ''))];
  return facts.length === 0 ? null : `Only you see this: ${facts.join(', ')}.`;
}

/**
 * "Reveal…" in the view (⚑ 40, ruled 2026-11-21): the GM's own item sheet for the item, as built, with its own state,
 * over the player's sheet under its own title, "Your sheet: Mooring ring", so the one in front is plain; its ✕ closes
 * it alone (audit fix 5, 2026-11-24: a title of its own, the smaller change than replacing the player's sheet).
 */
function GmItemSheet(props: ItemSheetProps) {
  const state = useItemSheetState(props.line);
  // Opened from inside the item's sheet: its own form, not the outer sheet's (CLAUDE.md; checked by gm-view-pack.spec.ts).
  return (
    <SheetScope.Provider value={false}>
      <PlayerViewContext.Provider value={null}>
        <ItemSheet {...props} state={state} atHand={null} title={`Your sheet: ${shownName(props.line.name)}`} />
      </PlayerViewContext.Provider>
    </SheetScope.Provider>
  );
}

interface ItemSheetProps {
  /** The sheet's title, when not the item's name ("Your sheet: Mooring ring", the GM's own sheet over the view's). */
  title?: string;
  /**
   * The GM's view as the player (pg32-4): the weapon's figures hidden from its player, in the GM's words, for the GM's
   * line ("Old bronze sword, magic −1"). From `CarrierItems`; empty outside the view.
   */
  gmFacts?: readonly string[];
  /**
   * The **At hand pop-up** variant (tfh-1 to tfh-5, 2026-11-19; page M2, frames M2l to M2n): what a thing At hand opens
   * on the Player tab. `top` (a weapon's Attack view, or a thing's facts) stands where the details were; no slot, hands,
   * value or weight, no Attack row, no charges block; `describe` adds the thing's own description and its source under
   * it (a wand, a lantern; not a weapon). Then Give to…, Put in…, Hide from At hand (not when pinned) and Drop, as rows
   * with their icons (frame PK8). The Pin star shows on everything At hand (tfh-4).
   */
  atHand?: { top: ReactNode; describe: boolean } | null;
  /** The gallery's picture: the sheet drawn in the page, not over it. */
  preview?: boolean;
  /** ✕, Escape or a tap outside closes the sheet. */
  onClose: () => void;
  /** At hand (M5 gate C3): the weapon's figure, and its parts for the breakdown its row on the sheet opens (sq-4). */
  weapon?: string | null;
  weaponRows?: { label: string; value: string }[];
  /** The same figure as the Attack sheet's rolls (as-1): the breakdown shows them, so the two never disagree. */
  weaponRolls?: readonly AttackRoll[];
  /** Why the item can't be used while a choice removes it (bq3-17 (6)), for Use a charge. */
  offReason?: string | null;
  /** A quiet line at the top of the Pack ("Nothing happens…"). */
  onNote: (text: string) => void;
  /** Each figure an attached pack's patch changed ("AC −1 · Bronze, Mire zine"; of-13, bq3-17 (7)). */
  patchLines?: string[];
  /** From useItemSheetState, called by the row. */
  state: ItemSheetState;
  /** Why the class can't wear or hold it (A10), for Wear or Hold. */
  blockedEquip: string | null;
  /** Worn or held against the rules (ruled 2026-10-25): the reason. */
  problem: string | null;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  line: InventoryLine;
  rechargeDefault: boolean;
  /** The setting rules' entry the line came from, if it's still there. */
  entry: ResolvedEntry | null;
  chargeRules: ChargeRules;
  /** The GM's hidden charge total for this line, if any. */
  secret: { total: number | null; spent: boolean } | null;
  /** The short name of the setting rules it came from, for the page reference. */
  packShortName: string | null;
  /** That pack's book titles by code (07 meta.sourceTitles): the page reference names the book, never its code. */
  sourceTitles?: SourceTitles;
  carrier: NamedCarrier;
  lines: InventoryLine[];
  mode: EncumbranceMode;
  rules: EncumbranceRules;
  others: NamedCarrier[];
  may: boolean;
  busy: boolean;
  run: Run;
}

export function ItemSheet(props: ItemSheetProps) {
  const {
    onClose,
    state,
    db,
    user,
    campaign,
    line,
    carrier,
    lines,
    mode,
    rules,
    others,
    may,
    busy,
    run,
    entry,
    chargeRules,
    rechargeDefault,
    secret,
    packShortName,
    sourceTitles = {},
    problem,
    blockedEquip,
    patchLines = [],
    weapon = null,
    weaponRows = [],
    weaponRolls = [],
    offReason = null,
    onNote,
    preview = false,
    atHand = null,
    gmFacts = [],
    title,
  } = props;
  const id = useId();
  const blocked = useBlockedSheet();
  const { figure, setFigure, recharging, setRecharging, alsoHomebrew, setAlsoHomebrew, moving, setMoving, emptying, setEmptying, warned, setWarned, emptyTo, setEmptyTo, rechargeBy, setRechargeBy } = state;
  // The GM's view as the player (pg32-3, pg32-4; M3g, M3g2): the sheet is the player's, with no GM tool and no hidden
  // figure, plus the GM's line and "Reveal…" on an item with something hidden. "Reveal…" opens the GM's own sheet, as
  // built (⚑ 40, ruled 2026-11-21), where "Reveal the count" and "Hidden from players" sit.
  const view = usePlayerView();
  const gmTruth = isGm(user, campaign.id);
  const gmHere = gmTruth && view === null;
  const [revealing, setRevealing] = useState(false);
  const charged = chargesOf(line, chargeRules, rechargeDefault);
  const chargeText = !charged ? '' : chargeWords(line, gmHere ? secret : null);
  const waiting = line.approval === 'pending';
  // Give to: the Party stash first (the default), then the other characters.
  const recipients = [...others.filter((o) => o.locationId !== null), ...others.filter((o) => o.locationId === null)];
  // Wear (armour) or Hold (a shield or something for the hand); Move to… only where there's somewhere to move it.
  const slot = typeof line.details.slot === 'string' ? line.details.slot : '';
  const wearable = (EQUIP_SLOTS as readonly string[]).includes(slot);
  const movable = line.equipped || line.containerLineId !== null || lines.some((l) => isContainer(l) && l.id !== line.id && l.id !== line.containerLineId);
  // Empty… on a container (ruled 2026-10-24): what's inside.
  const inside = isContainer(line) ? lines.filter((l) => l.containerLineId === line.id) : [];
  const toast = useToast();
  const hasCount = line.chargesLeft !== null || secret?.total != null;
  const left = secret?.total != null ? Math.max(0, secret.total - line.chargesUsed) : null;
  const amount = amountText(line, mode, rules, lines);
  // The version this copy shows: a change made from it is refused if someone changed the item since.
  const ref = { id: line.id, carrier, version: line.version };
  // What the line says about its item, in the same plain words as the setting rules browser.
  const shown = describeEntry({ kind: 'item', packEntryId: line.sourceEntryId ?? line.id, name: line.name, data: line.details }, () => undefined);
  const lineNotes = line.notes && !shown.notes.includes(line.notes) ? [line.notes] : [];
  // For the GM: the entry's hidden fields this line doesn't show yet, each with Reveal (in the view, behind "Reveal…").
  const gm = gmHere;
  const unrevealed = gmTruth && entry && Array.isArray(entry.data.gmOnly) ? entry.data.gmOnly.map(String).filter((key) => key in entry.data && !(key in line.details)) : [];
  const hiddenNames = gm ? unrevealed : [];
  const hiddenLines = entry ? describeEntry({ ...entry, data: { ...Object.fromEntries(unrevealed.map((key) => [key, entry.data[key]])) } }, () => undefined, { gm: true }).lines : [];
  const gmLine = view && gmTruth ? gmLineWords(hiddenLines, line.chargesHidden && secret ? { ...secret, used: line.chargesUsed } : null, gmFacts) : null;
  // "Reveal…" above the player's own rows (M3g): only where the GM's own sheet has something to reveal, a hidden field or
  // a hidden count (the driver's call under ⚑ 40); a weapon whose only hidden thing is its figure keeps the line alone.
  const revealable = unrevealed.length > 0 || (line.chargesHidden && secret?.total != null);
  const revealRow = gmLine && revealable && <ListRow icon={<Icon name="eye" size={24} />} title="Reveal…" onOpen={() => (busy ? undefined : setRevealing(true))} />;
  const oneOff = line.libraryEntryId === null && line.sourcePackId === null;
  /**
   * Runs a change that makes something leave your view, then the toast (B23; words batch 1): Undo is the log's
   * Undo of that change. Giving part of a stack inside the party splits it; Undo merges the part back (ruled
   * 2026-10-26). If the receiver used some, what's left comes back and a toast says how much was used (5b).
   */
  async function leaving(type: string, write: () => Promise<{ ok: true; value: unknown } | { ok: false; message: string }>, text: string) {
    const done = await run(write, true);
    if (!done) return;
    toast({
      text,
      onUndo: () =>
        void (async () => {
          let back = null as CameBack | null;
          const undone = await run(async () => {
            const eventId = await latestChange(db, campaign.id, type, user.id);
            if (!eventId) return { ok: false as const, message: 'There was nothing to undo.' };
            const result = await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
            if (result.ok) back = result.value;
            return result;
          });
          const said = undone ? cameBackText(back) : null;
          if (said) toast({ text: said });
        })(),
    });
  }
  function onMove(qty: number, place: Placement | null, action = moving) {
    const all = qty === line.qty;
    const words = stackable(line) && line.qty > 1 ? (all ? `all ${countWords(line, qty)}` : countWords(line, qty)) : line.name;
    setMoving(null);
    if (action === 'drop') return void leaving('inventory.remove', () => runCommand(registry, db, user, removeItem, { line: ref, qty, of: line.qty }), `Dropped ${words}`);
    if (!place) return;
    if (place.kind === 'away') return void leaving('inventory.giveAway', () => runCommand(registry, db, user, giveAway, { line: ref, qty, of: line.qty, to: place.to }), `Gave ${words} away to ${place.to}`);
    if (place.kind === 'give') return void leaving('inventory.move', () => runCommand(registry, db, user, moveItem, { line: ref, to: place.to, qty, of: line.qty }), `Gave ${words} to ${place.to.name}`);
    if (place.kind === 'equip') return void putOnOrOff();
    if (place.kind === 'carried') return void run(() => runCommand(registry, db, user, moveItem, { line: ref, to: carrier, qty, of: line.qty }), true);
    return void run(() => runCommand(registry, db, user, moveItem, { line: ref, to: carrier, containerLineId: place.containerId, qty, of: line.qty }), true);
  }
  /** Once it's on: gear that stops casting says so in a toast, with Undo (takes it off again; B25). */
  function afterOn(check: EquipCheck, done: boolean) {
    if (!done || !check.stopsCasting) return;
    // Undo takes it off again, whatever the copy says now (the put-on just changed it).
    toast({ text: check.stopsCasting.short, onUndo: () => void run(() => runCommand(registry, db, user, equipItem, { line: { id: line.id, carrier }, equipped: false })) });
  }
  async function putOnOrOff() {
    if (line.equipped || !carrier.actorId) return run(() => runCommand(registry, db, user, equipItem, { line: ref, equipped: !line.equipped }), true);
    const check = await checkEquip(db, user.id, campaign.id, carrier.actorId, line, lines);
    for (const hookId of check.skipped) void runCommand(registry, db, user, noteRuleSkipped, { campaignId: campaign.id, hookId });
    if (check.blocked.length === 0 && check.warnings.length === 0) {
      return afterOn(check, await run(() => runCommand(registry, db, user, equipItem, { line: ref, equipped: true }), true));
    }
    setWarned(check);
  }
  /** Pin or unpin (plan C): the star beside ✕; the sheet closes and a toast says so, with Undo. */
  function togglePin() {
    if (busy) return;
    const pinned = !line.pinned;
    void run(() => runCommand(registry, db, user, pinItem, { line: ref, pinned }), true).then((done) => {
      if (!done) return;
      toast({
        text: pinned ? `${line.name} pinned to the top` : `${line.name} unpinned`,
        onUndo: () => void run(() => runCommand(registry, db, user, pinItem, { line: { id: line.id, carrier }, pinned: !pinned })),
      });
    });
  }
  /** Use a charge (today's action, reached from the sheet on the Pack; At hand's row carries it too). */
  function spendCharge() {
    if (busy) return;
    if (offReason) return onNote(offReason);
    if (!line.chargesHidden && (line.chargesLeft ?? 0) <= 0) return onNote(`${line.name} has no charges left.`);
    void run(async () => {
      const used = await runCommand(registry, db, user, useCharge, { line: ref, hidden: line.chargesHidden });
      // With none left, nothing happens, and now the holder knows (ruled 2026-10-24).
      if (used.ok && line.chargesHidden && !gmHere && (await seemsSpent(db, line.id))) onNote(`Nothing happens. ${line.name} seems spent.`);
      return used;
    });
  }
  // The star in the head (plan C): where today's sheet offered Pin or Unpin. An item that shows At hand by itself keeps
  // Hide from At hand / Show in At hand as a row instead. In the At hand pop-up the star shows on everything, a weapon
  // in hand too (tfh-4; page M2's pick, "the star on everything At hand"): pinned, it stays At hand when put away.
  const pinnable = !!carrier.actorId && may && !waiting && (atHand !== null || line.pinned || !showsAtHandByItself(line, chargeRules));
  // The At hand pop-up's Hide from At hand: only for a thing that shows there by itself and is not pinned (a pinned one
  // leaves by its star; page M2, frame M2m).
  const hideable = !!carrier.actorId && !line.pinned && !line.atHandHidden && showsAtHandByItself(line, chargeRules);
  const star = pinnable ? <PinStar pinned={line.pinned} onToggle={togglePin} /> : undefined;
  const source = packShortName ? sourceLine(line.details.source, packShortName, () => undefined, undefined, sourceTitles) : null;
  const counted = charged && may && (line.chargesHidden || line.chargesLeft !== null);
  const moveSheet = moving && <MoveSheet action={moving} line={line} lines={lines} recipients={recipients} mode={mode} busy={busy} onClose={() => setMoving(null)} onConfirm={onMove} />;

  if (atHand && !waiting) {
    // The At hand pop-up (tfh-1, tfh-3): the top, the thing's own words where it has them, then its four quick rows,
    // each with its icon (frame PK8); Drop with the others, as PK8 draws it. A thing waiting for the GM keeps the full
    // sheet, where its Cancel and the GM's Approve are.
    return (
      <Dialog label={shownName(line.name)} onClose={onClose} headAction={star} preview={preview}>
        <div id={id} className="at-hand-popup" role="region" aria-label={shownName(line.name)}>
          {problem && (
            <p className="pack__problem" role="note">
              <WarningSign /> {problem}
            </p>
          )}
          {atHand.top}
          {atHand.describe && (
            <>
              {[...shown.notes, ...lineNotes].map((note) => (
                <p key={note}>{note}</p>
              ))}
              {patchLines.length > 0 && <p className="auth__meta">Changed by your rules: {patchLines.join('; ')}.</p>}
              {source && <p className="auth__meta">{source}</p>}
            </>
          )}
          {may && (
            <RowList label="Item actions">
              <ListRow icon={<Icon name="open-palm" size={24} />} title="Give to…" onOpen={() => (busy ? undefined : setMoving('give'))} />
              {carrier.actorId && movable && <ListRow icon={<Icon name="swap-bag" size={24} />} title="Put in…" onOpen={() => (busy ? undefined : setMoving('put'))} />}
              {hideable && (
                <ListRow
                  icon={<Icon name="cancel" size={24} />}
                  title="Hide from At hand"
                  chevron={false}
                  onOpen={() => (busy ? undefined : void run(() => runCommand(registry, db, user, hideFromAtHand, { line: ref, hidden: true }), true))}
                />
              )}
              <ListRow
                icon={<Icon name="drop-weapon" size={24} />}
                title="Drop"
                onOpen={() => (busy ? undefined : stackable(line) && line.qty > 1 ? setMoving('drop') : onMove(line.qty, null, 'drop'))}
              />
            </RowList>
          )}
          {moveSheet}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog label={title ?? shownName(line.name)} onClose={onClose} headAction={star} preview={preview}>
      <div id={id} className="pack__sheet" role="region" aria-label={shownName(line.name)}>
        {problem && (
          <p className="pack__problem" role="note">
            <WarningSign /> {problem}
          </p>
        )}
        {[...shown.notes, ...lineNotes].map((note) => (
          <p key={note}>{note}</p>
        ))}
        {amount && amount !== '—' && <p>{mode === 'slot' ? 'Takes' : 'Weight'}: {amount}{stackable(line) && mode !== 'armour' ? ` for ${line.qty}` : ''}.</p>}
        {shown.lines.length > 0 && <Lines lines={shown.lines} kv />}
        {/* The GM's line under the item's figures, after its details (M3g2; audit fix 7, 2026-11-24). */}
        {gmLine && <GmLine>{gmLine}</GmLine>}
        {patchLines.length > 0 && <p className="auth__meta">Changed by your rules: {patchLines.join('; ')}.</p>}
        {source && <p className="auth__meta">{source}</p>}
        {weapon && (weaponRolls.length > 0 || weaponRows.length > 0) && (
          // The weapon's figure (C3) opens where it comes from (sq-4), as every figure does.
          <RowList>
            <ListRow title="Attack" sub={weapon} onOpen={() => setFigure(true)} />
          </RowList>
        )}
        {figure && (
          <Dialog label={`Attack with ${line.name}`} onClose={() => setFigure(false)}>
            {weaponRolls.length > 0 ? (
              <div className="at-hand-sheet">
                {weaponRolls.map((r) => (
                  <RollCard key={r.line} dice={r.dice} line={r.line} lineNote={r.lineNote} notes={r.notes} parts={r.parts} />
                ))}
                {patchLines.map((l, i) => (
                  <p key={`${i}:${l}`} className="reading">
                    {l}
                  </p>
                ))}
              </div>
            ) : (
              <Breakdown rows={weaponRows} lines={patchLines} />
            )}
            <div className="dialog__actions">
              <button type="button" className="button-primary" onClick={() => setFigure(false)}>
                Got it
              </button>
            </div>
          </Dialog>
        )}
        {charged && (
          <div className="pack__charges" role="group" aria-label="Charges">
            <p>
              <strong>Charges:</strong> {chargeText}
              {charged.rechargeable ? ', rechargeable' : ''}
            </p>
            {/* Starting charges, from the roll: the holder for visible ones, the GM for hidden ones. */}
            {((!line.chargesHidden && line.chargesLeft === null && may && !(chargeRules.hidden && !gmHere)) ||
              (gmHere && (line.chargesHidden || chargeRules.hidden) && (secret?.total ?? null) === null && line.chargesLeft === null)) && (
              <RollPrompt
                label="Charges"
                expression={charged.dice}
                busy={busy}
                onRolled={(value) => {
                  const hiddenOnes = line.chargesHidden || chargeRules.hidden;
                  void run(async () => {
                    const rolled = await runCommand(registry, db, user, recordRoll, { campaignId: campaign.id, expression: charged.dice, result: value, purpose: 'charges', gmOnly: hiddenOnes });
                    if (!rolled.ok) return rolled;
                    return runCommand(registry, db, user, setCharges, { line: ref, value, hidden: hiddenOnes, roll: `${charged.dice} → ${value}` });
                  });
                }}
              />
            )}
            {gmHere && hasCount && (
              // Recharge is a button that opens a prompt (ruled 2026-10-24); where the item can't be recharged,
              // the GM still can, by fiat, from a quiet "Recharge (fiat)".
              <div className="pack__actions">
                <button type="button" className={charged.rechargeable ? 'button-secondary' : 'button-secondary button-secondary--small'} aria-busy={busy} onClick={() => setRecharging(true)}>
                  {charged.rechargeable ? 'Recharge' : 'Recharge (fiat)'}
                </button>
                {line.chargesHidden && left !== null && (
                  // The GM's Reveal: the holder sees the count from now on, like visible charges.
                  <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => void run(() => runCommand(registry, db, user, revealCharges, { line: ref, left }), true)}>
                    Reveal the count
                  </button>
                )}
              </div>
            )}
            {recharging && (
              <Dialog label={`Recharge ${line.name}`} onClose={() => setRecharging(false)}>
                <div className="field">
                  <label className="label" htmlFor={`${id}-recharge`}>
                    Dice or a number
                  </label>
                  <input
                    id={`${id}-recharge`}
                    className="field__input field__input--short"
                    autoComplete="off"
                    value={rechargeBy}
                    onChange={(event) => setRechargeBy(event.target.value)}
                  />
                </div>
                {diceRange(rechargeBy) && (
                  <RollPrompt
                    label="Recharge"
                    expression={rechargeBy.trim()}
                    busy={busy}
                    onCancel={() => setRecharging(false)}
                    onRolled={(value) => {
                      const hiddenOnes = line.chargesHidden;
                      const roll = `${rechargeBy.trim()} → ${value}`;
                      void run(async () => {
                        const rolled = await runCommand(registry, db, user, recordRoll, { campaignId: campaign.id, expression: rechargeBy.trim(), result: value, purpose: 'charges', gmOnly: hiddenOnes });
                        if (!rolled.ok) return rolled;
                        return runCommand(registry, db, user, recharge, { line: ref, amount: value, hidden: hiddenOnes, roll });
                      }, true).then((done) => {
                        if (done) {
                          setRechargeBy('');
                          setRecharging(false);
                        }
                      });
                    }}
                  />
                )}
                {!diceRange(rechargeBy) && (
                  <button type="button" className="button-secondary button-secondary--small" onClick={() => setRecharging(false)}>
                    Cancel
                  </button>
                )}
              </Dialog>
            )}
          </div>
        )}
        {hiddenNames.length > 0 && (
          <div className="pack__hidden" role="group" aria-label="Hidden from players">
            <span className="label">Hidden from players</span>
            <Lines lines={hiddenLines} kv />
            <div className="pack__actions">
              {hiddenNames.map((key, index) => (
                <button
                  key={key}
                  type="button"
                  className="button-secondary"
                  aria-busy={busy}
                  onClick={() => void run(() => runCommand(registry, db, user, revealItemField, { line: ref, field: key, value: entry!.data[key] }), true)}
                >
                  Reveal {hiddenLines[index]?.label ?? key}
                </button>
              ))}
            </div>
          </div>
        )}
        {revealRow && (!may || waiting) && <RowList label="Item actions">{revealRow}</RowList>}
        {revealing && <GmItemSheet {...props} onClose={() => setRevealing(false)} />}
        {waiting && (
          // A player's one-off waits for the GM (ruled 2026-10-23): it counts for nothing until approved.
          <div className="pack__actions" role="group" aria-label="Waiting for the GM">
            {gm ? (
              <>
                <label className="pack__check">
                  <input type="checkbox" checked={alsoHomebrew} onChange={(event) => setAlsoHomebrew(event.target.checked)} />
                  Also add to the campaign homebrew
                </label>
                <button
                  type="button"
                  className="button-secondary"
                  aria-busy={busy}
                  onClick={() =>
                    void run(async () => {
                      if (alsoHomebrew) {
                        const saved = await runCommand(registry, db, user, saveHomebrewEntry, { campaignId: campaign.id, campaignName: campaign.name, kind: 'item', data: homebrewItem(line) });
                        if (!saved.ok) return saved;
                      }
                      return runCommand(registry, db, user, approveItem, { line: ref });
                    }, true)
                  }
                >
                  Approve
                </button>
                <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => void run(() => runCommand(registry, db, user, declineItem, { line: ref }), true)}>
                  Decline
                </button>
              </>
            ) : (
              <>
                <p className="auth__meta">Sent to the GM for approval. It counts for nothing until then.</p>
                {may && (
                  <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => void run(() => runCommand(registry, db, user, removeItem, { line: ref, qty: line.qty, of: line.qty }), true)}>
                    Cancel it
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {may && !waiting && (
          <>
            {/* The actions as rows (plan C): those that ask more (who, where, how many) end in a chevron. Wear or Hold
                (whichever fits the item) puts it on at once; Give to… and Put in… each open one sheet with how many
                (for a stack) and where (B19, B24). */}
            <RowList label="Item actions">
              {revealRow}
              {counted && <ListRow title="Use a charge" onOpen={spendCharge} chevron={false} />}
              {stackable(line) && (
                // How many (today's − and +, moved from the row to the sheet): one fewer stops at one, never greyed.
                <div className="pack__count-row" role="group" aria-label="How many">
                  <span>How many: {line.qty}</span>
                  <span className="pack__stepper">
                    <button
                      type="button"
                      className="button-quiet"
                      aria-label={`One fewer ${line.name}`}
                      onClick={() => (busy ? undefined : line.qty <= 1 ? toast({ text: `One is the fewest. To be rid of it, Drop it.` }) : void run(() => runCommand(registry, db, user, setItemQty, { line: ref, qty: line.qty - 1 })))}
                    >
                      −
                    </button>
                    <button type="button" className="button-quiet" aria-label={`One more ${line.name}`} onClick={() => (busy ? undefined : void run(() => runCommand(registry, db, user, setItemQty, { line: ref, qty: line.qty + 1 })))}>
                      +
                    </button>
                  </span>
                </div>
              )}
              {carrier.actorId && wearable && !line.equipped && (
                <ListRow
                  title={isWornSlot(slot) ? 'Wear' : 'Hold'}
                  onOpen={() => (busy ? undefined : blockedEquip ? toast({ text: blockedEquip }) : onMove(line.qty, { kind: 'equip' }, 'put'))}
                  chevron={false}
                />
              )}
              <ListRow title="Give to…" onOpen={() => (busy ? undefined : setMoving('give'))} />
              {carrier.actorId && movable && <ListRow title="Put in…" onOpen={() => (busy ? undefined : setMoving('put'))} />}
              {/* What shows At hand by itself can be hidden and shown again (ruled 2026-10-23); a pin is the star above. */}
              {carrier.actorId && !pinnable && (
                <ListRow
                  title={line.atHandHidden ? 'Show in At hand' : 'Hide from At hand'}
                  onOpen={() => (busy ? undefined : void run(() => runCommand(registry, db, user, hideFromAtHand, { line: ref, hidden: !line.atHandHidden }), true))}
                  chevron={false}
                />
              )}
              {inside.length > 0 && <ListRow title="Empty…" onOpen={() => setEmptying('choose')} />}
              {oneOff && gm && (
                <ListRow
                  title="Add to campaign homebrew"
                  onOpen={() =>
                    busy
                      ? undefined
                      : void run(
                          () =>
                            runCommand(registry, db, user, saveHomebrewEntry, {
                              campaignId: campaign.id,
                              campaignName: campaign.name,
                              kind: 'item',
                              data: homebrewItem(line),
                            }),
                          true,
                        )
                  }
                  chevron={false}
                />
              )}
            </RowList>
            {/* Drop last and set apart (plan C): no confirm, Undo in the toast; a stack asks how many first. */}
            <ListRow
              apart
              title="Drop"
              openLabel="Drop"
              sub="Leaves it where you stand. Undo from the toast"
              chevron={stackable(line) && line.qty > 1}
              onOpen={() => (busy ? undefined : stackable(line) && line.qty > 1 ? setMoving('drop') : onMove(line.qty, null, 'drop'))} />
            {moveSheet}
            {warned && (
              <EquipWarningCard
                itemName={line.name}
                check={warned}
                busy={busy}
                onKeep={() => setWarned(null)}
                onAnyway={() =>
                  void run(() => runCommand(registry, db, user, equipAnyway, { line: ref }), true).then((done) => {
                    afterOn(warned, done);
                    setWarned(null);
                  })
                }
                onOffer={(first) =>
                  void run(async () => {
                    for (const other of first) {
                      const off = await runCommand(registry, db, user, equipItem, { line: { id: other.id, carrier }, equipped: false });
                      if (!off.ok) return off;
                    }
                    return runCommand(registry, db, user, equipItem, { line: ref, equipped: true });
                  }, true).then((done) => {
                    afterOn(warned, done);
                    setWarned(null);
                  })
                }
              />
            )}
            {emptying && (
              <Dialog label={`Empty the ${line.name}`} onClose={() => setEmptying(null)}>
                <p>{inside.length === 1 ? '1 item inside.' : `${inside.length} items inside.`}</p>
                {emptying === 'drop' ? (
                  <div className="pack__actions">
                    <p>Drop everything in the {line.name}?</p>
                    <button
                      type="button"
                      className="button-secondary"
                      aria-busy={busy}
                      onClick={() => {
                        setEmptying(null);
                        const things = inside.length === 1 ? '1 thing' : `${inside.length} things`;
                        void leaving('inventory.empty', () => runCommand(registry, db, user, emptyContainer, { line: ref, to: 'drop' }), `Emptied ${line.name}: ${things} dropped`);
                      }}
                    >
                      Drop all
                    </button>
                    <button type="button" className="button-secondary button-secondary--small" onClick={() => setEmptying('choose')}>
                      Keep them
                    </button>
                  </div>
                ) : (
                  <div className="pack__actions">
                    {others
                      .filter((o) => o.locationId !== null)
                      .map((stash) => (
                        <button
                          key={stash.locationId}
                          type="button"
                          className="button-secondary"
                          aria-busy={busy}
                          onClick={() => void run(() => runCommand(registry, db, user, emptyContainer, { line: ref, to: stash }), true).then((done) => done && setEmptying(null))}
                        >
                          {stash.name}
                        </button>
                      ))}
                    {carrier.actorId && (
                      <button
                        type="button"
                        className="button-secondary"
                        aria-busy={busy}
                        onClick={() => void run(() => runCommand(registry, db, user, emptyContainer, { line: ref, to: 'carried' }), true).then((done) => done && setEmptying(null))}
                      >
                        Carried
                      </button>
                    )}
                    {others.some((o) => o.actorId !== null) && (
                      <form
                        className="pack__actions"
                        role="group"
                        aria-label="Give everything to"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const to = others.find((o) => o.actorId === emptyTo);
                          if (to) void run(() => runCommand(registry, db, user, emptyContainer, { line: ref, to }), true).then((done) => done && setEmptying(null));
                        }}
                      >
                        <label className="label" htmlFor={`${id}-empty-to`}>
                          Give to…
                        </label>
                        <select id={`${id}-empty-to`} className="field__input pack__select" value={emptyTo} onChange={(event) => setEmptyTo(event.target.value)}>
                          <option value="">Choose…</option>
                          {others
                            .filter((o) => o.actorId !== null)
                            .map((o) => (
                              <option key={o.actorId} value={o.actorId!}>
                                {o.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="submit"
                          className="button-secondary"
                          aria-busy={busy}
                          onClick={(event) => {
                            if (emptyTo) return;
                            event.preventDefault();
                            blocked.explain('Give to whom?', 'Choose who gets everything in it, then Give.');
                          }}
                        >
                          Give
                        </button>
                        {blocked.sheet}
                      </form>
                    )}
                    <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => setEmptying('drop')}>
                      Drop all…
                    </button>
                    <button type="button" className="button-secondary button-secondary--small" onClick={() => setEmptying(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </Dialog>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
