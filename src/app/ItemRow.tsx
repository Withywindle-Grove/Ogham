// One item's row in the Pack (docs/06 "Pack groups"; plan m5b-players-screens-standard C): its name and one quiet line
// (what it is, its charges, its weight), then a chevron; a tap opens the item's sheet (ItemSheet.tsx), where every action
// on it lives. In At hand every row carries its action instead of the chevron (Francis, 2026-11-07, on #552): Use a
// charge, a light's Light or Put out, use one up (Fire, Drink, Eat, Use), or for a weapon with nothing to count Wield while
// it isn't in hand and Attack once it is (ruling m5b-at-hand-actions-2026-11-08, ah-1 and ah-2). A weapon with modes
// (ah-3, ah-4) carries its mode button (Quiver, Pouch, Grip, Stance) beside the action; its sheets are AtHandSheets.tsx.
import { useState } from 'react';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { chargesOf, seemsSpent, useCharge, type ChargeRules } from '../modules/inventory/charges.ts';
import type { EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { equipItem, noteRuleSkipped, setWeaponMode, useItem } from '../modules/inventory/inventory.ts';
import { drawnLines, hasModeButton, modeLine, modeVerb, MODE_BUTTON_WORDS, type InflictedCondition, type ModeState, type WeaponRange } from '../modules/inventory/weaponModes.ts';
import type { AttackRoll } from '../modules/characters/play.ts';
import { checkEquip } from './EquipWarning.tsx';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { AtHandFacts, AttackSheet, AttackView, chargeFact, ModeSheet, SpentSheet, type AtHandFact } from './AtHandSheets.tsx';
import { amountText, atHandAction, isWeapon, markerOf, shownName, stackable, wornText, type UseVerb } from '../modules/inventory/packView.ts';
import { usedWords } from '../core/useWords.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { useToast } from '../ui/ToastHost.tsx';
import type { SourceTitles } from '../modules/library/sourceTitles.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { Icon } from '../ui/icons.tsx';
import { PinnedMark, PinnedName, WarningLine } from '../ui/parts.tsx';
import { ItemSheet, useItemSheetState } from './ItemSheet.tsx';
import { ItemAction } from './ItemAction.tsx';
import { usePlayerView } from './playerView.ts';
import { RollFigures, RollLines } from './WeaponInHand.tsx';
import { registry } from './services.ts';
import { chargeWords, type Run } from './packHelpers.ts';
import './PackScreen.css';

export function ItemRow({
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
  open,
  onToggle,
  atHand = false,
  stackedButtons = false,
  playerAtHand = false,
  inHand = false,
  sheetOnly = false,
  sheetAlone = false,
  busy,
  run,
  entry,
  chargeRules,
  rechargeDefault,
  onNote,
  secret,
  gmFacts = [],
  packShortName,
  sourceTitles = {},
  problem,
  castingNote,
  ruleNote = null,
  blockedEquip,
  weapon = null,
  off = null,
  offReason = null,
  patchLines = [],
  weaponRows = [],
  weaponRolls = [],
  weaponNotes = [],
  attackRange = null,
  tiny = false,
  lightAction = null,
  attackRules = [],
  inflicts = [],
  modeView = null,
  lightFacts = [],
}: {
  /**
   * The Player tab's At hand pop-up (tfh-3; page M2, frame M2n): a burning light's facts for its pop-up ("Light", "Lit,
   * 4 turns left"; "Refills", "3 left"), from the character's light; empty for anything not burning.
   */
  lightFacts?: readonly AtHandFact[];
  /** At hand, a weapon (ah-1; Design on #569): what its attack inflicts (`applies.conditionId`), for the Attack sheet. */
  inflicts?: readonly InflictedCondition[];
  /** At hand, a weapon (ah-1): the rules that bear on its attack, for the Attack sheet. */
  attackRules?: readonly string[];
  /**
   * At hand, a weapon with modes (ah-3, G-211): the mode in use, from the line's stored choice (item.setMode; Design on
   * #569: shared and logged). The button shows only with two or more modes (ah-4).
   */
  modeView?: ModeState | null;
  /**
   * At hand, a light (Design on #552): the row's button is the Light section's own Light or Put out, the existing light
   * commands; null when the item isn't a light the character can light.
   */
  lightAction?: { label: 'Light' | 'Put out'; run: () => void } | null;
  /** In the Pack's Tiny things section (SC-5-2): weightless, it shows no weight, like other weightless rows. */
  tiny?: boolean;
  /** At hand (sq-4, 2026-11-04): the weapon figure's parts, opened from the figure's row on the item's sheet. */
  weaponRows?: { label: string; value: string }[];
  /** At hand, a weapon (as-1): its rolls for the Attack sheet, to hit first (weaponRolls). */
  weaponRolls?: readonly AttackRoll[];
  /** At hand, a weapon (mw-1): notes under its line, never in it (a bonus against a kind of foe; the GM's ammunition note). */
  weaponNotes?: readonly string[];
  /** At hand, a weapon (as-2, G-219): the range its attack uses, for the Attack sheet; null: none the pack gives. */
  attackRange?: WeaponRange | null;
  /** At hand (M5 gate C3): the weapon's attack bonus and damage. */
  weapon?: string | null;
  /** "Off: Bronze" when the campaign's choices remove the item (an option, or a patch; bq3-17 (6)). */
  off?: string | null;
  /** Why the item can't be used while it's off, for a tap on Use a charge. */
  offReason?: string | null;
  /** Each figure a patch changed ("AC −1 · Bronze, Mire zine"), on the item's sheet (of-13). */
  patchLines?: string[];
  /** Why the class can't wear or hold it (A10), for Wear or Hold. */
  blockedEquip: string | null;
  /** Worn or held against the rules (ruled 2026-10-25): the reason. */
  problem: string | null;
  /** "Stops arcane casting", on gear that does (B25). */
  castingNote: string | null;
  /** "By the Thunder-tube rule", on a weapon the class's list lacks but a rules set's weapon rule allows (eq-7). */
  ruleNote?: string | null;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  line: InventoryLine;
  rechargeDefault: boolean;
  onNote: (text: string) => void;
  /** The setting rules' entry the line came from, if it's still there. */
  entry: ResolvedEntry | null;
  chargeRules: ChargeRules;
  /** The GM's hidden charge total for this line, if any. */
  secret: { total: number | null; spent: boolean } | null;
  /** In the GM's view as the player: the weapon's hidden figures, for the sheet's GM line (pg32-4). */
  gmFacts?: readonly string[];
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
  open: boolean;
  onToggle: () => void;
  /** A row in At hand (the Player screen): it carries its action (Use a charge) instead of the chevron (plan C). */
  atHand?: boolean;
  /** The Player screen's At hand (dec-13 C6): the row's buttons are stacked buttons with their icons (sb-2, ic-3). */
  stackedButtons?: boolean;
  /**
   * The Player screen's At hand as frame P1 draws it (Francis's fix 7 of 19 Nov 2026 and the review's nits): a weapon
   * not in hand reads its rolls with their die glyphs ("d20 +0", "d6") on their own line under the name, and a pinned
   * row's star leads its name ("★ Shortbow"). The Pack tab's At hand leaves it out.
   */
  playerAtHand?: boolean;
  /**
   * With `atHand`: the weapon in hand as its own block (dec-13 C14, frame P1; "the weapon in hand", 06's inventory): the
   * name and its line ("In hand", the mode in use, no figures), the row's buttons at its right, and the two roll lines
   * under it, read from `weaponRolls`. Its buttons, sheets and commands are the row's own.
   */
  inHand?: boolean;
  /** Its sheet only, with no row (dec-13 C9): the burning light's line in At hand, opened from the light's name. */
  sheetOnly?: boolean;
  /** With `sheetOnly`: the line isn't At hand itself, only added for its sheet, so it never draws a row. */
  sheetAlone?: boolean;
  busy: boolean;
  run: Run;
}) {
  const marker = markerOf(line, rules);
  // In the GM's view as the player the row is the player's: no hidden count (pg32-3, pg32-4).
  const view = usePlayerView();
  const gmHere = isGm(user, campaign.id) && view === null;
  const charged = chargesOf(line, chargeRules, rechargeDefault);
  const chargeText = !charged ? '' : chargeWords(line, gmHere ? secret : null);
  const waiting = line.approval === 'pending';
  const state = useItemSheetState(line);
  const amount = amountText(line, mode, rules, lines, { tiny });
  // The line under the name, its parts with commas (no middle dot, plan m5b-players-screens-standard A2), the weight
  // last as the mockup's rows read ("18 arrows, 30 coins"). Not allowed leads it, with the warning sign (A3).
  // At hand (Design on #569, the mockup's order): the state first, then the figures, then the mode in use and what it
  // draws from ("In hand, +0, 1d6, Quiver: Reed arrows ×18"); no weight, which the Pack row already shows.
  const modeWords = modeView && hasModeButton(modeView.modes) ? modeLine(modeView) : '';
  // The weapon in hand's block (dec-13 C14): its roll lines carry the figures, but each figure the campaign's choices
  // changed keeps its line here ("Damage −1 · Bone, <pack>", of-13), so a lowered figure never shows without its reason.
  // On the Player screen's At hand (`playerAtHand`) a weapon not in hand reads its rolls with their die glyphs, as P1
  // draws them ("d20 +0", "d6"; Francis's fix 7 of 19 Nov 2026), on their own line under the name; the same rule keeps
  // a figure the campaign's choices changed in the line.
  const shortRolls = playerAtHand && atHand && !inHand && weaponRolls.length > 0;
  const figures = (inHand || shortRolls) && weaponRolls.length > 0 ? patchLines.join(', ') : (weapon ?? '');
  const sub = (
    atHand
      ? [off ?? '', wornText(line), figures, modeWords, castingNote ?? '', ruleNote ?? '', waiting ? 'Waiting for the GM' : '', marker === 'magic' ? 'Magic' : marker === 'treasure' ? 'Treasure' : '', chargeText]
      : [
          off ?? '',
          weapon ?? '',
          castingNote ?? '',
          ruleNote ?? '',
          waiting ? 'Waiting for the GM' : '',
          wornText(line),
          marker === 'magic' ? 'Magic' : marker === 'treasure' ? 'Treasure' : '',
          chargeText,
          amount === '—' ? '' : amount,
        ]
  )
    .filter(Boolean)
    .join(', ');
  const canUse = charged && may && (line.chargesHidden || (line.chargesLeft ?? 0) > 0);
  const ref = { id: line.id, carrier, version: line.version };
  // An At hand row carries its action (Francis, 2026-11-07, on #552): Use a charge (once the count is known), a light's
  // Light or Put out, use one up (Fire, Drink, Eat, Use), or Attack. A row off At hand ends in a chevron instead: its body
  // opens the item's sheet.
  const kind = atHand && may ? atHandAction(line, chargeRules, rechargeDefault) : null;
  const action = kind === 'charge' && (line.chargesHidden || line.chargesLeft !== null);
  // The burning light's line in At hand (sheetOnly) never carries a light button: the light's rows hold its toggle.
  const light = kind === 'light' && !sheetOnly ? lightAction : null;
  const verb: UseVerb | null = kind === 'Fire' || kind === 'Drink' || kind === 'Eat' || kind === 'Use' ? kind : null;
  const attack = kind === 'Attack';
  const wield = kind === 'Wield';
  // The Player screen's stacked buttons (dec-13 C6; sb-2): every At hand row there, the weapon in hand's block (C14)
  // with Attack and its mode button too; the Pack tab keeps its word buttons (K25 has no frame yet).
  const stack = stackedButtons;
  const toast = useToast();
  const blocked = useBlockedSheet();
  // The weapon's sheets (ah-1, ah-3): Attack's, the mode sheet, and a blocked Attack's when the mode's stack is spent.
  const [sheet, setSheet] = useState<'attack' | 'modes' | 'spent' | null>(null);
  const modes = modeView && hasModeButton(modeView.modes) ? modeView : null;
  /** Undo from a toast: the log's Undo of this person's newest change of that kind. */
  const undoLatest = (type: string) => () =>
    void run(async () => {
      const eventId = await latestChange(db, campaign.id, type, user.id);
      if (!eventId) return { ok: false as const, message: 'There was nothing to undo.' };
      return runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
    });
  /**
   * Use one up (Fire, Drink, Eat, Use): its own command, `item.use` (Design on #552), logged in the same words as the
   * toast, with Undo; the last one leaves play and the log keeps a copy (hard rule 4). A weapon mode's use (ah-3) spends
   * from its stack (`target`), the count it says being the mode's whole stack (`left`); when that was the last, the toast
   * says the mode is now disengaged.
   */
  async function spendOne(word: UseVerb, target: InventoryLine = line, left = line.qty - 1) {
    if (busy) return;
    if (offReason) return onNote(offReason);
    // The mode's last one (ah-3; Design on #569, round 3): the mode stays disengaged ("nothing chosen"). A fresh
    // weapon's default is stored in the same request so it doesn't slide on to the next kind; one Undo brings back both.
    const spentMode = target !== line && left === 0 && modeView !== null;
    const keep = spentMode && modeView && !modeView.chosen && modeView.mode ? { keepModeOf: { id: line.id, modeId: modeView.mode.id } } : {};
    const done = await run(() => runCommand(registry, db, user, useItem, { line: { id: target.id, carrier, version: target.version }, of: target.qty, verb: word, ...keep }));
    if (!done) return;
    const said = usedWords(word, target.name, target.details, left);
    const spent = spentMode && modeView ? `. ${modeLine({ ...modeView, engaged: false, why: 'spent' })}` : '';
    toast({ text: `${said.charAt(0).toUpperCase()}${said.slice(1)}${spent}`, onUndo: undoLatest('item.use') });
  }
  /**
   * Wield (ah-2): in hand at once, through the item sheet's own equip check: a class that can't hold it says why; a
   * warning opens the item's sheet with its card. Logged (inventory.equip), Undo in the toast (the log's Undo, which puts
   * it back where it was).
   */
  async function wieldIt() {
    if (busy) return;
    const cantWield = () => blocked.explain(`Can't wield the ${line.name}`, blockedEquip ?? offReason ?? '');
    // An item that is off keeps its own pop-up and line.
    if (offReason) return cantWield();
    if (!carrier.actorId) return blockedEquip ? cantWield() : undefined;
    const check = await checkEquip(db, user.id, campaign.id, carrier.actorId, line, lines);
    // Against the class's rules: the rule is the title, said once, with the pack's note under it and nothing else (tfw-4).
    const block = check.blocks[0];
    if (block) return blocked.explain(block.rule, block.note);
    if (blockedEquip) return cantWield();
    for (const hookId of check.skipped) void runCommand(registry, db, user, noteRuleSkipped, { campaignId: campaign.id, hookId });
    if (check.blocked.length > 0 || check.warnings.length > 0) {
      state.setWarned(check);
      if (!open) onToggle();
      return;
    }
    const done = await run(() => runCommand(registry, db, user, equipItem, { line: ref, equipped: true }));
    if (!done) return;
    toast({ text: [`${shownName(line.name)} in hand`, check.stopsCasting?.short].filter(Boolean).join('. '), onUndo: undoLatest('inventory.equip') });
  }
  // The Player tab's At hand (tfh-1 to tfh-5, page M2): a row's name opens the short At hand pop-up, not the item's
  // sheet with its details; a weapon's name and its Attack open the same one. The Pack tab keeps the item's sheet and
  // the Attack sheet (row K4 of plan dec-6-the-whole-pack-tab).
  const popup = playerAtHand && atHand;
  /**
   * Attack (ah-1): its sheet; on the Player tab the weapon's pop-up, the same one its name opens (tfh-2). With the mode's
   * stack spent (ah-3), the blocked tap says why and offers the mode sheet, as before.
   */
  const onAttack = () => {
    if (modeView && !modeView.engaged) return setSheet('spent');
    if (!popup) return setSheet('attack');
    if (!open) onToggle();
  };
  /** The Attack view's "Fire one, 17 left after" (ah-3): spends one of the mode's stack, closing the sheet it is on. */
  const fireOne =
    modeView?.mode?.draws && modeView.stack
      ? (close: () => void) => ({
          label: `${modeVerb(modeView.modes.button)} one, ${modeView.left - 1} left after`,
          run: () => {
            const { stack, left, modes: all } = modeView;
            close();
            void spendOne(modeVerb(all.button), stack!, left - 1);
          },
        })
      : null;
  /**
   * A mode picked on its sheet (ah-3): chosen for everyone (item.setMode, logged, Undo in the toast), unless it draws a
   * stack with none left (then why). The one already in use changes nothing.
   */
  async function pickMode(modeId: string) {
    if (!modeView || busy) return;
    const picked = modeView.modes.list.find((m) => m.id === modeId);
    if (!picked) return;
    // None of its stack in the pack: nothing to choose; the tap says so (never a disabled row).
    if (drawnLines(picked, modeView.modes, lines, carrier.actorId).length === 0 && picked.draws) {
      return blocked.explain(`No ${picked.name}`, `There are no ${picked.name} in ${carrier.name}’s pack. Add some to the pack first.`);
    }
    setSheet(null);
    if (modeView.chosen && modeView.mode?.id === modeId) return;
    const done = await run(() => runCommand(registry, db, user, setWeaponMode, { line: ref, modeId }));
    if (done) toast({ text: `${shownName(line.name)}: ${picked.name}`, onUndo: undoLatest('item.setMode') });
  }
  const pinned = line.pinned && carrier.actorId !== null;
  // The pop-up's top (tfh-1, tfh-3): a weapon's whole Attack view (page M2, frame M2l: "all of the Attack view stays"),
  // with what it does now under it when it has charges (the local review's nit 1); else what the thing does now, its
  // charges and its light (frame M2n), with its own description under it. AtHandFacts draws nothing when there are none.
  const asWeapon = weaponRolls.length > 0 || isWeapon(line);
  const facts: AtHandFact[] = [...(charged ? [{ label: 'Charges', value: chargeFact(chargeText) }] : []), ...lightFacts];
  const popupTop = !popup
    ? null
    : asWeapon
      ? {
          top: (
            <>
              <AttackView figure={weapon} rolls={weaponRolls} range={attackRange} patchLines={patchLines} rules={attackRules} inflicts={inflicts} spend={fireOne ? fireOne(() => open && onToggle()) : null} />
              <AtHandFacts facts={facts} />
            </>
          ),
          describe: false,
        }
      : { top: <AtHandFacts facts={facts} />, describe: true };

  const itemSheet = open && (
        <ItemSheet
          onClose={onToggle}
          state={state}
          db={db}
          user={user}
          campaign={campaign}
          line={line}
          carrier={carrier}
          lines={lines}
          mode={mode}
          rules={rules}
          others={others}
          may={may}
          busy={busy}
          run={run}
          entry={entry}
          chargeRules={chargeRules}
          rechargeDefault={rechargeDefault}
          secret={secret}
          gmFacts={gmFacts}
          packShortName={packShortName}
          sourceTitles={sourceTitles}
          problem={problem}
          blockedEquip={blockedEquip}
          patchLines={patchLines}
          weapon={weapon}
          weaponRows={weaponRows}
          weaponRolls={weaponRolls}
          offReason={offReason}
          onNote={onNote}
          atHand={popupTop}
        />
  );
  // The burning light's line in At hand: the sheet alone (it portals out), the light's rows standing for the row. It
  // keeps its row (without a light button) only when it is At hand itself and has Use a charge.
  if (sheetOnly && (sheetAlone || !action)) return <>{itemSheet}</>;

  // The row's body (its name and line; a tap opens the item's sheet) and its buttons, laid out as a row or, for the
  // weapon in hand, as its block (dec-13 C14).
  const nameWords = (
    <>
      {shownName(line.name)}
      {stackable(line) && <span className="pack__qty"> ×{line.qty}</span>}
    </>
  );
  const main = (
    <button type="button" className="pack__row-main" aria-haspopup="dialog" aria-expanded={open} onClick={onToggle}>
      <span className="pack__name">
        {/* On the Player screen's At hand the star leads the name, as frame P1 draws "★ Shortbow" (the review's nit); "pinned"
            is heard after the name and its count. */}
        {pinned && playerAtHand ? <PinnedName>{nameWords}</PinnedName> : nameWords}
      </span>{' '}
      {problem && (
        // Not allowed takes its own line, the sign first (WarningLine, as the language rows do); the row's line under it.
        <span className="pack__sub pack__not-allowed">
          <WarningLine>Not allowed</WarningLine>
        </span>
      )}
      {shortRolls ? (
        <>
          {/* The rolls' line under the name (P1: "d20 +0  d6"; the star is before the name), the rest of the line
              under it (the quiver's arrows). */}
          <span className="auth__meta pack__sub pack__sub--rolls">
            <RollFigures rolls={weaponRolls} />
          </span>
          {sub && <span className="auth__meta pack__sub">{sub}</span>}
        </>
      ) : (
        (sub || (pinned && !playerAtHand)) && (
          <span className="auth__meta pack__sub">
            {/* Pinned: the small filled star alone at the start of the line; a screen reader hears "pinned" (plan C). On
                the Player screen's At hand it leads the name instead (frame P1). */}
            {pinned && !playerAtHand && <PinnedMark />}
            {sub}
          </span>
        )
      )}
      {weaponNotes.map((n) => (
        // A magic weapon's notes (mw-1): each on its own line under the figure, never in it.
        <span key={n} className="auth__meta pack__sub">
          {n}
        </span>
      ))}
      {!action && !light && !verb && !attack && !wield && (
        <span className="pack__chevron" aria-hidden="true">
          <Icon name="chevron" size={20} />
        </span>
      )}
    </button>
  );
  const buttons = (
    <>
      {action && (
        <ItemAction
          word="Use"
          wordAsButton="Use a charge"
          hidden={`of ${line.name}`}
          stacked={stack}
          onClick={() =>
            // Never a disabled button: an item a choice removes (bq3-17 (6)), or with nothing left, says why instead.
            busy
              ? undefined
              : offReason
                ? onNote(offReason)
                : !canUse
                  ? onNote(`${line.name} has no charges left.`)
                  : void run(async () => {
                      const used = await runCommand(registry, db, user, useCharge, { line: ref, hidden: line.chargesHidden });
                      // With none left, nothing happens, and now the holder knows (ruled 2026-10-24).
                      if (used.ok && line.chargesHidden && !gmHere && (await seemsSpent(db, line.id))) onNote(`Nothing happens. ${line.name} seems spent.`);
                      return used;
                    })
          }
        />
      )}
      {light && <ItemAction word={light.label} hidden={line.name} stacked={stack} onClick={() => (busy ? undefined : light.run())} />}
      {verb && <ItemAction word={verb} hidden={line.name} stacked={stack} onClick={() => void spendOne(verb)} />}
      {modes && (attack || wield) && (
        // The mode button (ah-3, ah-4; md-1): the pack's word, beside the action; it opens the mode sheet.
        <ItemAction word={MODE_BUTTON_WORDS[modes.modes.button]} hidden={`of ${line.name}`} stacked={stack} opensSheet onClick={() => setSheet('modes')} />
      )}
      {wield && (
        // Wield (ah-2): a pinned weapon not in hand; once in hand the row shows Attack.
        <ItemAction word="Wield" hidden={line.name} stacked={stack} onClick={() => void wieldIt()} />
      )}
      {attack && (
        // Attack (ah-1): until M6 wires the attack, it opens the Attack sheet; never disabled (a spent mode explains).
        <ItemAction word="Attack" hidden={`with ${line.name}`} stacked={stack} opensSheet onClick={onAttack} />
      )}
    </>
  );

  return (
    <li className={inHand ? 'pack__item weapon-in-hand' : 'pack__item'}>
      {inHand ? (
        <>
          <div className="weapon-in-hand__top">
            {main}
            {/* The row's buttons at the right of the name: the place C6's stacked buttons go (frame P1). */}
            <div className="weapon-in-hand__actions">{buttons}</div>
          </div>
          <RollLines rolls={weaponRolls} />
        </>
      ) : (
        <div className="pack__row">
          {main}
          {buttons}
        </div>
      )}
      {blocked.sheet}
      {sheet === 'attack' && (
        <AttackSheet
          name={line.name}
          figure={weapon}
          rolls={weaponRolls}
          range={attackRange}
          patchLines={patchLines}
          rules={attackRules}
          inflicts={inflicts}
          spend={fireOne ? fireOne(() => setSheet(null)) : null}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'modes' && modeView && (
        <ModeSheet
          weaponName={line.name}
          state={modeView}
          lines={lines}
          actorId={carrier.actorId}
          weaponDamage={typeof (line.details.weapon as { damage?: unknown } | undefined)?.damage === 'string' ? String((line.details.weapon as { damage: string }).damage) : null}
          onPick={(id) => void pickMode(id)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'spent' && modeView && <SpentSheet weaponName={line.name} state={modeView} onOpenModes={() => setSheet('modes')} onClose={() => setSheet(null)} />}
      {itemSheet}
    </li>
  );
}
