// Equip checks on the Pack and in Add item (docs/05 "Equipping against the class's rules is blocked"; ruled
// 2026-10-21, 2026-10-25): before an item goes on, the class's rules are checked (blocked, with the reason in a
// pop-up), then the setting's equip hooks; any warnings pop up with "Do it anyway" (logged as an override), the
// hook's one-tap offer (swap, or stow what's in the way), and "Keep things as they are".
import { useEffect, useMemo, useState } from 'react';
import { loadCharacterSheet } from '../core/characterSheet.ts';
import type { Db } from '../core/supabase.ts';
import type { Value } from '../modules/library/expression.ts';
import { blockWords, castingStatus, castingStoppedBy, equipBlocksApart, equipWarnings, type CastingStop, type EquipBlock, type EquipWarning } from '../modules/inventory/equipWarnings.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { StatusSymbol } from '../ui/parts.tsx';
import { StatusRing, type RingLayout } from '../ui/StatusRing.tsx';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { baseArmourChoices, wornForAc, type WornGear } from '../modules/characters/play.ts';
import { lineInPlay, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { scoresOf } from './fromSetting.ts';
import { raceDataAsPlayed } from '../modules/characters/creation.ts';
import { loadCharacterPlay } from '../modules/characters/playState.ts';

export interface EquipCheck {
  /** Why the class can't use it (A10): nothing else is offered. */
  blocked: string[];
  /** The same blocks in their parts (tfw-4): the rule, the pop-up's title; the pack's note, under it. */
  blocks: EquipBlock[];
  /** It can go on, but it stops the character's casting (B25): the toast says so, with Undo. */
  stopsCasting: CastingStop | null;
  warnings: EquipWarning[];
  skipped: string[];
  /** What's worn or held now, by where (armour, shield, hand): what an offer takes off first. */
  equipped: Record<string, InventoryLine>;
}

/**
 * A line as the equip checks read it. With the context's item lookup, magic armour whose base is picked when it's
 * found also carries its `chosenBase` (the base item) or, before one is chosen, its `baseOptions` (the bases it
 * offers), so allows() checks the class against the base (area 3 re-check, 2026-11-03).
 */
export const asItem = (line: InventoryLine, context?: EquipContext | null): Value => {
  const item: Record<string, Value> = { ...(line.details as Record<string, Value>), id: line.sourceEntryId ?? line.id, name: line.name };
  const lookup = context?.item;
  const choices = lookup ? baseArmourChoices(line.details.armour) : null;
  if (!lookup || !choices) return item;
  const chosen = line.baseArmourId ? lookup(line.baseArmourId) : null;
  return chosen ? { ...item, chosenBase: chosen } : { ...item, baseOptions: choices.map(lookup).filter((b): b is Value => b !== null) };
};

/** What's needed to check a character's gear: the setting's hooks and the character, read once. */
export interface EquipContext {
  hooks: Record<string, unknown>[];
  /** The character, with its class, kindred and current class form (`formId`, eq-8). */
  character: Value;
  /** The setting's item by its pack id (magic armour's bases), or null; without it a base isn't checked. */
  item?: (id: string) => Value | null;
  /** The rules sets' weapon rules (07 `weaponRules`, eq-7), the pack on top first; null without any. */
  weaponRules?: Value;
}

/** The rules sets' weapon rules, the pack on top first (so its rule for a category is found first). */
export function weaponRulesIn(setting: Pick<CampaignSetting, 'rulesSets'>): Value {
  const rules = [...setting.rulesSets].reverse().flatMap((r) => (Array.isArray(r.weaponRules) ? (r.weaponRules as Value[]) : []));
  return rules.length > 0 ? rules : null;
}

/** Reads what equip checks need for one character; null when the setting or the sheet can't be read. */
export async function loadEquipContext(db: Db, userId: string, campaignId: string, actorId: string): Promise<EquipContext | null> {
  const [setting, sheet, play] = await Promise.all([loadCampaignSetting(db, userId, campaignId), loadCharacterSheet(db, actorId), loadCharacterPlay(db, actorId)]);
  if (!setting || !sheet) return null;
  const entry = (kind: string, id: string | null) => {
    const found = id ? setting.all.find((e) => e.kind === kind && e.packEntryId === id) : undefined;
    return found ? ({ ...(found.data as Record<string, Value>), id: found.packEntryId, name: found.name } as Value) : null;
  };
  const klass = entry('class', sheet.classRef);
  // The kindred as the class plays it (cs-4: a kindred-class replaces its weapon limits; cs-6 reads them beside the class's).
  const race = entry('race', sheet.raceRef);
  const played = race ? raceDataAsPlayed(race as Record<string, unknown>, sheet.raceRef, klass as Record<string, unknown> | null) : null;
  const character: Value = {
    name: sheet.name,
    level: sheet.level,
    ...scoresOf(setting, sheet.fields, sheet.creation),
    class: klass,
    race: played ? ({ ...played, id: sheet.raceRef, name: (race as Record<string, unknown>).name } as Value) : null,
    // The class form the character is in (eq-8); null reads as the first form the class lists.
    formId: play?.formId ?? null,
  };
  return { hooks: setting.all.filter((e) => e.kind === 'hook').map((e) => e.data), character, item: (id) => entry('item', id), weaponRules: weaponRulesIn(setting) };
}

/** The equip checks for putting a line on, given what else the character has. */
export function equipCheckWith(context: EquipContext | null, line: InventoryLine, lines: readonly InventoryLine[]): EquipCheck {
  const equipped: Record<string, InventoryLine> = {};
  for (const other of lines) {
    const slot = other.details.slot;
    // Worn items (mb-5) are never in the way: any number may be worn, so no offer takes one off.
    if (other.equipped && other.id !== line.id && typeof slot === 'string' && slot !== 'worn' && !(slot in equipped)) equipped[slot] = other;
  }
  if (!context) return { blocked: [], blocks: [], stopsCasting: null, warnings: [], skipped: [], equipped };
  const blocks = equipBlocksApart(context.character, asItem(line, context), context.weaponRules ?? null);
  const blocked = blocks.map(blockWords);
  if (blocked.length > 0) return { blocked, blocks, stopsCasting: null, warnings: [], skipped: [], equipped };
  const stopsCasting = castingStoppedBy(context.character, asItem(line));
  const found = equipWarnings(context.hooks, {
    character: context.character,
    item: asItem(line),
    equipped: { armour: null, shield: null, hand: null, ...Object.fromEntries(Object.entries(equipped).map(([slot, l]) => [slot, asItem(l)])) },
  });
  // Class rules are checked above; a hook repeating them (allows(…)) would only say it again.
  return { blocked, blocks, stopsCasting, warnings: found.warnings.filter((w) => !hookUsesAllows(context.hooks, w.id)), skipped: found.skipped, equipped };
}

const hookUsesAllows = (hooks: readonly Record<string, unknown>[], id: string) =>
  hooks.some((h) => String(h.id ?? '') === id && typeof h.test === 'string' && /\ballows\s*\(/.test(h.test));

/** Checks putting a line on its character. */
export async function checkEquip(db: Db, userId: string, campaignId: string, actorId: string, line: InventoryLine, lines: readonly InventoryLine[]): Promise<EquipCheck> {
  return equipCheckWith(await loadEquipContext(db, userId, campaignId, actorId), line, lines);
}

/** The derived casting status from what a character wears and holds (B25), or null. */
export function castingStatusOf(context: EquipContext | null, lines: readonly InventoryLine[]): { statusName: string; reasons: string[] } | null {
  if (!context) return null;
  return castingStatus(context.character, lines.filter((l) => l.equipped).map((l) => asItem(l)));
}

/**
 * What's wrong with what a character already wears or holds (ruled 2026-10-25: a pack already in a disallowed state
 * shows it): each equipped line the class can't use, or that the setting warns about beside the rest.
 */
export function equippedProblems(context: EquipContext | null, lines: readonly InventoryLine[]): Map<string, string> {
  const problems = new Map<string, string>();
  if (!context) return problems;
  for (const line of lines.filter((l) => l.equipped)) {
    const check = equipCheckWith(context, line, lines);
    const said = [...check.blocked, ...check.warnings.map((w) => w.message || 'Your setting warns about this.')];
    if (said.length > 0) problems.set(line.id, said.join(' '));
  }
  return problems;
}

export function EquipWarningCard({
  itemName,
  check,
  busy,
  onAnyway,
  onOffer,
  onKeep,
}: {
  itemName: string;
  check: EquipCheck;
  busy: boolean;
  onAnyway: () => void;
  /** Take these off first, then put the item on. */
  onOffer: (first: InventoryLine[]) => void;
  onKeep: () => void;
}) {
  // Against the class's rules: blocked, with the reason (A10); OK is the only way on. The rule is the title, said once,
  // with the pack's note under it and nothing else (tfw-4: a weapon rule's verdict stays out). The check finds one block.
  const block = check.blocks[0];
  if (block) {
    return (
      <Dialog label={block.rule} onClose={onKeep}>
        {block.note ? <p>{block.note}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="button-primary" onClick={onKeep}>
            OK
          </button>
        </div>
      </Dialog>
    );
  }
  const offers = check.warnings.flatMap((w) => {
    const first = w.inTheWay.flatMap((slot) => (check.equipped[slot] ? [check.equipped[slot]!] : []));
    if (!w.offer || first.length === 0) return [];
    const names = first.map((l) => l.name).join(' and ');
    return [{ key: w.id, label: w.offer === 'swap' ? `Swap for the ${names}` : `Stow the ${names}`, first }];
  });
  return (
    <Dialog label={`Put on ${itemName}?`} onClose={onKeep}>
      {check.warnings.map((w) => (
        <p key={w.id}>{w.message || 'Your setting warns about this.'}</p>
      ))}
      <div className="dialog__actions">
        {offers.map((o, i) => (
          <button key={o.key} type="button" className={i === 0 ? 'button-primary' : 'button-secondary'} aria-busy={busy} onClick={() => onOffer(o.first)}>
            {o.label}
          </button>
        ))}
        <button type="button" className="button-secondary" aria-busy={busy} onClick={onAnyway}>
          Do it anyway
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onKeep}>
          Keep things as they are
        </button>
      </div>
    </Dialog>
  );
}

/**
 * The armour, shields and other AC items among a character's equipped lines, each with its pack `armour` block as
 * the campaign makes it (lineInPlay: the patches in play, of-13, with each figure changed named for the AC
 * breakdown, and what a pack update added to the block, F27). Whether a line counts for AC is read from that block
 * too, so a ring's or cloak's bonus the pack added counts (review of #596).
 */
export function wornGearOf(lines: readonly InventoryLine[], setting: Pick<CampaignSetting, 'patches' | 'all'> | null): WornGear[] {
  return lines.flatMap((l) => {
    const now = lineInPlay(setting, l);
    if (!wornForAc(now.details)) return [];
    return [
      {
        name: l.name,
        slot: l.details.slot,
        armour: now.details.armour,
        category: l.category,
        cursed: l.details.cursed === true,
        // K22a: a bonus the GM told on this line counts for the player's AC (bonusHidden).
        told: l.revealedFields ?? [],
        baseArmourId: l.baseArmourId,
        line: { id: l.id, version: l.version },
        ...(now.lines.length > 0 ? { patched: { before: l.details.armour, lines: now.lines } } : {}),
      },
    ];
  });
}

/**
 * The armour, shields and other AC items the character wears, each with its pack `armour` block, for AC (ruled
 * 2026-10-29, B9 and the armour block: the armour's AC comes from the pack). Null until the Pack is read, or when it
 * can't be.
 */
export function useWornGear(db: Db, campaignId: string, actorId: string, refresh: unknown = 0, setting: Pick<CampaignSetting, 'patches' | 'all'> | null = null): WornGear[] | null {
  const [lines, setLines] = useState<InventoryLine[] | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    let live = true;
    void loadInventory(db, campaignId).then((inventory) => {
      if (!live || !inventory) return;
      setLines(inventory.lines.filter((l) => l.actorId === actorId && l.equipped));
    });
    return () => {
      live = false;
    };
  }, [db, campaignId, actorId, refresh]);
  // Worked out from the lines read, so the setting arriving later re-reads nothing.
  return useMemo(() => lines && wornGearOf(lines, setting), [lines, setting]);
}

/** Why casting is stopped now (B25): the pack's name for it and the reasons; null while it's free (or loading). */
export type CastingNow = { statusName: string; reasons: string[] } | null;

/** The derived casting status of one character, reloaded with `refresh` (B25). */
export function useCastingStatus(db: Db, userId: string, campaignId: string, actorId: string, refresh = 0): CastingNow {
  const [status, setStatus] = useState<CastingNow>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadEquipContext(db, userId, campaignId, actorId), loadInventory(db, campaignId)]).then(([context, inventory]) => {
      if (live) setStatus(castingStatusOf(context, (inventory?.lines ?? []).filter((l) => l.actorId === actorId)));
    });
    return () => {
      live = false;
    };
  }, [db, userId, campaignId, actorId, refresh]);
  return status;
}

/**
 * The derived casting status (B25, ruled 2026-10-25): the pack's name for it ("Can't kindle") as a status symbol
 * with its words, while gear that stops casting is worn or held. No timer and no Remove: it ends with the gear.
 * Tap for why. Shows nothing when casting is free.
 */
export function CastingStatus({ db, userId, campaignId, actorId, refresh = 0 }: { db: Db; userId: string; campaignId: string; actorId: string; refresh?: number }) {
  const status = useCastingStatus(db, userId, campaignId, actorId, refresh);
  return status ? <CastingStatusView status={status} /> : null;
}

/**
 * The casting status drawn: its symbol and words, or (`ring`, the Player screen's Statuses row, plan
 * m5b-creation-retest-3 F) a Status ring with no end (dashed, ink, its first letter: the pack names no symbol for it),
 * "while worn" under its name. The tap opens why.
 */
export function CastingStatusView({ status, ring = false, layout = 'tile' }: { status: NonNullable<CastingNow>; ring?: boolean; layout?: RingLayout }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {ring ? (
        <StatusRing layout={layout} name={status.statusName} fraction={null} endless words="while worn" label={`${status.statusName}, while worn. Details`} onOpen={() => setOpen(true)} />
      ) : (
        <button type="button" className="casting-status" onClick={() => setOpen(true)}>
          <StatusSymbol name={status.statusName} symbol="⊘" />
          <span>{status.statusName}</span>
        </button>
      )}
      {open && (
        <Dialog label={status.statusName} onClose={() => setOpen(false)}>
          {status.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          <p>It ends when that comes off.</p>
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
