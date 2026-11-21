// One carrier's items in the Pack (docs/06 "Pack groups"): grouped by where they're carried, A–Z in each group. Each
// group's heading carries its count ("Worn and in hand", "4 items"); the groups that fold (Gear, Tiny things) are fold
// rows with a one-line summary (plan m5b-players-screens-standard C), N19's rule saying how they start.
import { useEffect, useState } from 'react';
import type { EncumbranceMode } from '../core/campaignSettings.ts';
import { isGm, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { ChargeRules } from '../modules/inventory/charges.ts';
import type { EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import { mayChangeCarrier, type InventoryLine, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { groupPack, packGroupsWithTiny } from '../modules/inventory/packView.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { lineInPlay, type CampaignSetting } from './campaignSetting.ts';
import { asItem, equippedProblems, loadEquipContext, type EquipContext } from './EquipWarning.tsx';
import { allowedByRule, castingStoppedBy, classAllowsWeapon, equipBlocks } from '../modules/inventory/equipWarnings.ts';
import { ItemRow } from './ItemRow.tsx';
import { usePlayerView } from './playerView.ts';
import { lightFactsOf } from './AtHandSheets.tsx';
import { useFoldOpen } from './packOpen.ts';
import { foldSummary, itemCount, type Run } from './packHelpers.ts';
import { tinyCountsNothing } from '../modules/inventory/packView.ts';
import { FoldedGroup } from '../ui/creation.tsx';
import { lightState } from '../modules/expedition/lightPlay.ts';
import type { CharacterLightView } from './LightSection.tsx';
import { attackRange, attackRules, inflictedBy, modeState, weaponModesOf, withMode, type ModeState } from '../modules/inventory/weaponModes.ts';
import { conditionsOf } from '../modules/expedition/statusPlay.ts';
import { magicNoteLines, weaponMagic, type AttackPart, type AttackRoll, type WeaponMagic } from '../modules/characters/play.ts';
import './PackScreen.css';

/**
 * A weapon's parts from outside its own figure: the mode's to-hit as a named part and its die's source (ah-1, G-211),
 * the weapon's magic as the viewer may see it (mw-1, mw-3; weaponMagic), and the pack entry the line came from, for the
 * character's weapon skill (as-4: the screen that knows the character reads it).
 */
export interface ModeFigureParts {
  attack: AttackPart | null;
  damageSource: string | null;
  magic?: WeaponMagic;
  /** The line's pack entry id (a homebrew line without one: null, so no weapon skill applies). */
  entryId?: string | null;
  /** Whether the class may use it, as the equip check decides (classAllowsWeapon: the form in play, the weapon rules). */
  classOk?: boolean;
}

/**
 * Every weapon line's parts for its figures (as-4, #606 review): the mode's, the magic where it's worked out, and the
 * line's entry id and the class verdict always, so the weapon skill counts wherever the figure shows.
 */
export function lineFigureParts(state: ModeState | null, magic: WeaponMagic | undefined, entryId: string | null, classOk: boolean | undefined): ModeFigureParts {
  return { ...(modeFigureParts(state) ?? { attack: null, damageSource: null }), ...(magic ? { magic } : {}), entryId, ...(classOk === undefined ? {} : { classOk }) };
}
/**
 * The drawn ammunition as weaponMagic reads it: the stack's item as the campaign makes it now (lineInPlay: patches,
 * and the weapon keys that always follow the pack, fp-1), over its entry's data, so a stack owned before a pack
 * corrected its magic bonus or bonus against a foe counts the corrected one (review of #616).
 */
export function drawnAmmunition(
  setting: Parameters<typeof lineInPlay>[0],
  stack: Pick<InventoryLine, 'name' | 'category' | 'details' | 'sourceEntryId' | 'sourcePackId'>,
  stackEntry: { data: Record<string, unknown> } | null,
): { name: string; data: Record<string, unknown>; category: string } {
  return { name: stack.name, data: { ...(stackEntry?.data ?? {}), ...lineInPlay(setting, stack).details }, category: stack.category };
}

/** The words `weaponMagic` adds to what the player can't see (play.ts, `marked`). */
const HIDDEN_MARK = ' (hidden from the player)';

/**
 * A weapon's figures hidden from its player, in the GM's words for the view's GM line (pg32-4; M3g2): each hidden part
 * with its sign ("Old bronze sword, magic −1"), then each hidden note.
 */
export function hiddenFigures(magic: WeaponMagic): string[] {
  const parts = magic.parts.filter((p) => p.label.endsWith(HIDDEN_MARK)).map((p) => `${p.label.slice(0, -HIDDEN_MARK.length)} ${p.value < 0 ? `−${-p.value}` : `+${p.value}`}`);
  const notes = [...magic.hitNotes, ...magic.damageNotes].filter((n) => n.endsWith(HIDDEN_MARK)).map((n) => n.slice(0, -HIDDEN_MARK.length));
  return [...parts, ...notes];
}

/** A weapon's attack bonus and damage ("+2, 1d8"), from its item data, the patches' damage change and a mode's parts. */
export type WeaponLine = (item: Record<string, unknown>, damageDelta?: number, mode?: ModeFigureParts) => string | null;
/** The same figure's parts, for the breakdown and the Attack sheet. */
export type WeaponBreakdown = (item: Record<string, unknown>, damageDelta?: number, mode?: ModeFigureParts) => { label: string; value: string }[];
/** The same weapon's rolls for the Attack sheet (as-1): to hit, then damage, each with its parts. */
export type WeaponRolls = (item: Record<string, unknown>, damageDelta?: number, mode?: ModeFigureParts) => AttackRoll[];

/** A mode's parts for the figure: its to-hit, and its name as the damage's source when it has its own die. */
export function modeFigureParts(state: ModeState | null): ModeFigureParts | undefined {
  const mode = state?.engaged ? state.mode : null;
  if (!mode) return undefined;
  return { attack: mode.toHit !== null ? { label: mode.name, value: mode.toHit } : null, damageSource: mode.damage ? mode.name : null };
}

/** A group's explanation, one tap away behind an ⓘ (ruled 2026-10-24: no explanations on screen). */
function GroupNote({ title, note }: { title: string; note: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      {' '}
      <button type="button" className="pack__info" aria-expanded={shown} aria-label={`About ${title}`} onClick={() => setShown(!shown)}>
        ⓘ
      </button>
      {shown && <span className="auth__meta pack__info-text"> {note}</span>}
    </>
  );
}

export function CarrierItems({
  db,
  user,
  campaign,
  carrier,
  lines,
  allLines = lines,
  mode,
  rules,
  others,
  open,
  setOpen,
  busy,
  gearOpen,
  setGearOpen,
  run,
  items,
  charges,
  rechargeDefault,
  onNote,
  hidden,
  packs,
  flat = false,
  atHand = false,
  stackedButtons = false,
  playerAtHand = false,
  inHand = false,
  sheetOnly = null,
  sheetAlone = false,
  light = null,
  categoryName = (id: string) => id,
  weaponLine,
  weaponBreakdown,
  weaponRolls,
  setting = null,
  tinyCategories,
}: {
  /**
   * The tiny item categories (`CampaignSetting.tinyCategories`): given, the tiny things leave their groups for a folded
   * "Tiny things" section before Other (SC-5-2), as on the sheet's Pack load. Left out (At hand, the stash, waiting): no split.
   */
  tinyCategories?: ReadonlySet<string>;
  /** At hand (M5 gate C3): a weapon's attack bonus and damage from its item data, or null; with a weapon mode's parts (ah-1). */
  weaponLine?: WeaponLine;
  /** At hand (sq-4): that figure's parts, for the breakdown a tap on the weapon's row opens. */
  weaponBreakdown?: WeaponBreakdown;
  /** At hand (as-1): the weapon's rolls, for the Attack sheet. */
  weaponRolls?: WeaponRolls;
  /** The campaign's setting, for the patches in play (of-13): each line's item as the choices make it now. */
  setting?: Pick<CampaignSetting, 'patches' | 'all' | 'rulesSets'> | null;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** One plain list, without groups (At hand, waiting items). */
  flat?: boolean;
  /** At hand (the Player screen, and the Pack's At hand group): each row carries its action (plan C). */
  atHand?: boolean;
  /** The Player screen's At hand (dec-13 C6): its rows' buttons are stacked buttons with their icons. */
  stackedButtons?: boolean;
  /** The Player screen's At hand as frame P1 draws it (ItemRow's `playerAtHand`: die glyphs, the star before the name). */
  playerAtHand?: boolean;
  /** With `atHand`: each line is drawn as the weapon in hand's block (dec-13 C14, frame P1), not a row. */
  inHand?: boolean;
  /**
   * At hand on the Player screen (dec-13 C9): the line, among `lines`, drawn as its sheet only, with no row: the burning
   * light's, whose rows stand for it and whose name opens this sheet (frame P1).
   */
  sheetOnly?: string | null;
  /** The `sheetOnly` line was added only for its sheet (it isn't At hand itself): never a row, whatever its actions. */
  sheetAlone?: boolean;
  /** The character's light (the Player screen's), for a light's Light or Put out on its At hand row (Design on #552). */
  light?: CharacterLightView | null;
  /** An item category's friendly name (the "Other" section's groups). */
  categoryName?: (id: string) => string;
  rechargeDefault: boolean;
  /** A quiet line at the top of the Pack ("Nothing happens…"). */
  onNote: (text: string) => void;
  /** The campaign's items (the GM's copy holds their hidden fields). */
  items: ResolvedEntry[];
  charges: ChargeRules;
  hidden: Map<string, { total: number | null; spent: boolean }>;
  /** The campaign's setting rules (for short names). */
  packs: CampaignPack[];
  carrier: NamedCarrier;
  lines: InventoryLine[];
  /** Everything the carrier holds, when `lines` is only part of it (the Pack's At hand group): containers, room, fill. */
  allLines?: InventoryLine[];
  mode: EncumbranceMode;
  rules: EncumbranceRules;
  others: NamedCarrier[];
  open: string | null;
  setOpen: (id: string | null) => void;
  busy: boolean;
  gearOpen: boolean;
  setGearOpen: (open: boolean) => void;
  run: Run;
}) {
  // The Party stash has no groups but its containers (ruled 2026-10-28, N18).
  // Grouped from everything the carrier holds, then only `lines` kept: a container pinned to the Pack's At hand group
  // leaves its own group, but what's inside it still reads "In the <container>" (Design on #552).
  const shown = new Set(lines.map((l) => l.id));
  const groups = flat
    ? [{ key: 'pins', title: '', lines }]
    : (tinyCategories && carrier.locationId === null
        ? packGroupsWithTiny(allLines, mode, rules, tinyCategories, categoryName)
        : groupPack(allLines, mode, rules, categoryName, { stash: carrier.locationId !== null })
      )
        .map((g) => ({ ...g, lines: g.lines.filter((l) => shown.has(l.id)) }))
        .filter((g) => g.lines.length > 0);
  // The Tiny things section starts collapsed, then stays as it was left on this device (like the other folds).
  const [tinySaved, setTinyOpen] = useFoldOpen('tiny');
  const tinyOpen = tinySaved ?? false;
  // What's worn or held against the rules already (ruled 2026-10-25): marked on its row.
  const [equipContext, setEquipContext] = useState<EquipContext | null>(null);
  // The GM's view as the player (pg32-4): each weapon's hidden figures, for the GM's line on its sheet.
  const view = usePlayerView();
  const gmInView = view !== null && isGm(user, campaign.id);
  useEffect(() => {
    if (!carrier.actorId) return;
    let live = true;
    void loadEquipContext(db, user.id, campaign.id, carrier.actorId).then((context) => {
      if (live) setEquipContext(context);
    });
    return () => {
      live = false;
    };
  }, [db, user.id, campaign.id, carrier.actorId]);
  const problems = equippedProblems(equipContext, lines);
  // A weapon the class's list lacks but a rules set's weapon rule allows (eq-7, mb-4): the row names the rule.
  const ruleNotes = new Map(
    lines.flatMap((l) => {
      const rule = equipContext?.weaponRules ? allowedByRule(equipContext.character, asItem(l, equipContext), equipContext.weaponRules) : null;
      return rule ? [[l.id, `By the ${rule.category} rule`] as const] : [];
    }),
  );
  // Gear that stops casting says so on its row (words batch 1, ruled 2026-10-26).
  const castingNotes = new Map(
    lines.flatMap((l) => {
      const stop = l.equipped && equipContext ? castingStoppedBy(equipContext.character, asItem(l)) : null;
      return stop ? [[l.id, stop.note] as const] : [];
    }),
  );
  const may = mayChangeCarrier(user, carrier);
  // The setting's conditions, for what a weapon inflicts on its Attack sheet (ah-1, `applies.conditionId`).
  const conditions = atHand ? conditionsOf(setting?.all ?? []) : [];
  /** A light's row button (Design on #552): Put out when it's the light burning now, else Light when the pack can light it. */
  const lightFor = (l: InventoryLine) => {
    const row = light && light.light !== 'error' ? (light.light ?? null) : null;
    if (!light || light.light === undefined || light.light === 'error') return null;
    const state = row ? lightState(row, light.now) : 'unlit';
    if (row && row.lineId === l.id && (state === 'lit' || state === 'low')) return { label: 'Put out' as const, run: () => void light.douse() };
    const option = light.options.find((o) => o.line.id === l.id);
    return option ? { label: 'Light' as const, run: () => void light.lightIt(option) } : null;
  };
  const firstOther = groups.findIndex((g) => 'other' in g && g.other);
  // Empty (words batch 1, ruled 2026-10-26): the pack invites the first item (Add item sits above); the stash says what it's for.
  if (groups.length === 0)
    return <p className="auth__meta">{carrier.locationId ? 'Nothing in the Party stash yet. Things given to it show here.' : 'Nothing carried yet. Add what you take on the road.'}</p>;
  return (
    <>
      {groups.map((group, index) => {
        const tiny = group.key === 'tiny';
        const closed = (group.collapsible && !gearOpen) || (tiny && !tinyOpen);
        return (
          <section key={group.key} className="pack__group" aria-label={group.title || undefined}>
            {/* Things that aren't carried (animals, vehicles, boats): their own section, outside the load. */}
            {index === firstOther && (
              // The heading, then its quiet words beside it, set apart by space and type (no middle dot, plan A2).
              <div className="pack__group-head pack__other">
                <h2 className="pack__group-title">Other</h2>
                <span className="auth__meta">not carried</span>
              </div>
            )}
            {flat || !group.title || tiny || group.collapsible ? null : (
              <div className="pack__group-head">
                <h2 className="pack__group-title">
                  {group.title}
                  {group.note && <GroupNote title={group.title} note={group.note} />}
                </h2>
                <span className="auth__meta">{itemCount(group.lines.length)}</span>
              </div>
            )}
            {(tiny || group.collapsible) && !flat ? (
              // A fold row (plan C, the + at the right edge): Gear by N19's rule, Tiny things folded at first (SC-5-2);
              // the device remembers how each was left. Its summary names the first things.
              <FoldedGroup
                label={group.title}
                note={foldSummary(group.lines)}
                detail={tiny ? (tinyCountsNothing(group.lines, mode) ? "They don't count" : undefined) : 'Not counted for speed'}
                open={!closed}
                onToggle={(next) => (next === !closed ? undefined : tiny ? setTinyOpen(next) : setGearOpen(next))}
              >
                {!closed && rows(group, tiny)}
              </FoldedGroup>
            ) : (
              rows(group, tiny)
            )}
          </section>
        );
      })}
    </>
  );

  function rows(group: (typeof groups)[number], tiny: boolean) {
    return (
              <ul className="pack__rows">
                {group.lines.map((raw) => {
                  // The line's item as the campaign's patches make it (of-13, bq3-17): the copy on the line is never
                  // changed; the row, the sheet and the weapon line read the patched details, and a line a choice
                  // removes says "Off · <choice>" and can't be put on or used.
                  const now = lineInPlay(setting, raw);
                  const line = now.details === raw.details ? raw : { ...raw, details: now.details };
                  const entry = items.find((e) => e.packId === line.sourcePackId && e.packEntryId === line.sourceEntryId) ?? null;
                  const offReason = now.off ? `${line.name} is off under ${now.off.replace(/^Off: /, '')}: it can't be worn, held or used.` : null;
                  // A weapon's modes (ah-3, G-211): the one in use feeds the figure, its parts and the rules that bear; its
                  // stack is looked for in everything the character carries.
                  const item = { ...(entry?.data ?? {}), ...line.details, category: line.category };
                  const modes = atHand ? weaponModesOf(item) : null;
                  // The chosen mode is the line's own (Design on #569: shared and logged).
                  const state = modes ? modeState(modes, line.modeId ?? null, allLines, carrier.actorId) : null;
                  const inMode = withMode(item, state?.engaged ? state.mode : null);
                  // The weapon's magic and, where the setting adds it, the drawn ammunition's (mw-1, mw-3); hidden from the
                  // player while unidentified or cursed, the GM seeing it marked.
                  const stack = state?.engaged ? state.stack : null;
                  const stackEntry = stack ? (items.find((e) => e.packId === stack.sourcePackId && e.packEntryId === stack.sourceEntryId) ?? null) : null;
                  const magic = atHand
                    ? weaponMagic(
                        { name: line.name, data: item, category: line.category },
                        setting?.rulesSets ?? [],
                        isGm(user, campaign.id),
                        stack ? drawnAmmunition(setting, stack, stackEntry) : null,
                      )
                    : undefined;
                  // The class verdict the equip check reaches (the form in play, the weapon rules), for the weapon skill.
                  const classOk = equipContext ? classAllowsWeapon(equipContext.character, asItem(line, equipContext), equipContext.weaponRules ?? null) : undefined;
                  const parts = lineFigureParts(state, magic, line.sourceEntryId ?? null, classOk);
                  const weapon = weaponLine?.(inMode, now.damageDelta ?? 0, parts) ?? null;
                  const weaponRows = weapon ? (weaponBreakdown?.(inMode, now.damageDelta ?? 0, parts) ?? []) : [];
                  const rolls = weapon && atHand ? (weaponRolls?.({ ...inMode, name: line.name }, now.damageDelta ?? 0, parts) ?? []) : [];
                  const range = atHand && weapon !== null ? attackRange(item, state?.engaged ? state.mode : null) : null;
                  const bearing = atHand ? attackRules(inMode, state?.engaged ? state.mode : null, [ruleNotes.get(line.id), problems.get(line.id)]) : [];
                  const inflicts = atHand && weapon !== null ? inflictedBy(item, state?.engaged ? state.stack : null, conditions) : [];
                  const gmFacts = gmInView ? hiddenFigures(weaponMagic({ name: line.name, data: item, category: line.category }, setting?.rulesSets ?? [], true, stack ? drawnAmmunition(setting, stack, stackEntry) : null)) : [];
                  return (
                  <ItemRow
                    key={line.id}
                    db={db}
                    user={user}
                    campaign={campaign}
                    line={line}
                    carrier={carrier}
                    lines={allLines}
                    mode={mode}
                    rules={rules}
                    others={others}
                    may={may}
                    open={open === line.id}
                    onToggle={() => setOpen(open === line.id ? null : line.id)}
                    atHand={atHand}
                    stackedButtons={stackedButtons}
                    playerAtHand={playerAtHand}
                    inHand={inHand}
                    sheetOnly={line.id === sheetOnly}
                    sheetAlone={line.id === sheetOnly && sheetAlone}
                    lightAction={atHand ? lightFor(line) : null}
                    // The Player tab's At hand pop-up shows a burning light's time and refills (tfh-3; page M2, M2n).
                    lightFacts={atHand && playerAtHand ? lightFactsOf(light, line.id) : []}
                    busy={busy}
                    run={run}
                    entry={entry}
                    packShortName={packs.find((p) => p.packId === line.sourcePackId)?.shortName ?? null}
                    sourceTitles={packs.find((p) => p.packId === line.sourcePackId)?.sourceTitles ?? {}}
                    chargeRules={charges}
                    rechargeDefault={rechargeDefault}
                    onNote={onNote}
                    secret={hidden.get(line.id) ?? null}
                    gmFacts={gmFacts}
                    problem={problems.get(line.id) ?? null}
                    castingNote={castingNotes.get(line.id) ?? null}
                    blockedEquip={offReason ?? (equipContext ? (equipBlocks(equipContext.character, asItem(line, equipContext), equipContext.weaponRules ?? null)[0] ?? null) : null)}
                    ruleNote={ruleNotes.get(line.id) ?? null}
                    weapon={weapon && now.lines.length > 0 ? [weapon, ...now.lines].join(', ') : weapon}
                    off={now.off}
                    offReason={offReason}
                    patchLines={now.lines}
                    weaponRows={weaponRows}
                    weaponRolls={rolls}
                    weaponNotes={weapon !== null && magic ? magicNoteLines(magic) : []}
                    attackRange={range}
                    attackRules={bearing}
                    inflicts={inflicts}
                    modeView={state}
                    tiny={tiny}
                  />
                  );
                })}
              </ul>
    );
  }
}
