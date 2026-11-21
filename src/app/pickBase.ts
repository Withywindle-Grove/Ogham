// Picking the base of "chosen" magic armour (07 `armour.baseArmour: { choose }`; ruled 2026-10-29), with the
// follow-up of bq3-8 (ruled 2026-11-04, `docs/design/rulings/m5b-builder-questions-3-2026-11-04.md`): such armour
// goes on while some base fits the class; when the base picked later is one the wearer's class can't wear, the
// armour comes off in the same logged change, carried, and the words say why. Used by the GM's "Pick the base"
// card in Waiting for you and by "Choose base armour" on the Player screen.
// The pick is kept on the line's base armour (inventory_lines.base_armour_id), where it lived before eq-1's
// `baseId`; see the plan's Departures (docs/plans/m5b-review-area-3.md, Follow-up).
import { runCommand, type CommandResult, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { baseArmourChoices } from '../modules/characters/play.ts';
import { equipBlocks } from '../modules/inventory/equipWarnings.ts';
import { loadInventory, setBaseArmour, type CarrierRef, type InventoryLine } from '../modules/inventory/inventory.ts';
import { asItem, loadEquipContext, type EquipContext } from './EquipWarning.tsx';
import { registry } from './services.ts';

const textOf = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

/**
 * Worn magic armour waiting for its base (bq3-8): equipped on a character, offering bases, none picked yet.
 * What the GM's Waiting for you lists as "Pick the base for <armour> (worn by <name>)".
 */
export function waitingForBase(line: InventoryLine): boolean {
  return line.actorId !== null && line.equipped && line.approval === 'approved' && line.baseArmourId === null && baseArmourChoices(line.details.armour) !== null;
}

/**
 * Why the wearer couldn't keep the armour on with this base, or null when it fits (or isn't worn, or the class
 * can't be read: then nothing comes off, as the equip check lets it pass).
 */
export function cameOffWords(context: EquipContext | null, line: InventoryLine, baseId: string): string | null {
  if (!context || !line.equipped) return null;
  const blocked = equipBlocks(context.character, asItem({ ...line, baseArmourId: baseId }, context), context.weaponRules ?? null);
  if (blocked.length === 0) return null;
  const character = context.character as Record<string, unknown> | null;
  const klass = character && typeof character.class === 'object' && character.class ? (character.class as Record<string, unknown>) : {};
  const base = context.item?.(baseId) as Record<string, unknown> | null | undefined;
  return `${line.name} came off and is carried: ${textOf(klass.name, 'the class')} can't wear ${textOf(base?.name, 'that base')}.`;
}

/**
 * Picks the base (logged): the line as the caller saw it (its version, so a change made meanwhile is refused),
 * checked against the wearer's class; a base that doesn't fit takes the armour off in the same change. Returns the
 * words to show when it came off, or null.
 */
export async function pickBaseArmour(
  db: Db,
  user: CurrentUser,
  input: { line: InventoryLine; carrier: CarrierRef; baseId: string },
): Promise<CommandResult<{ cameOff: string | null }>> {
  const { line, carrier, baseId } = input;
  const context = line.actorId ? await loadEquipContext(db, user.id, line.campaignId, line.actorId) : null;
  const cameOff = cameOffWords(context, line, baseId);
  const result = await runCommand(registry, db, user, setBaseArmour, {
    line: { id: line.id, version: line.version, carrier, baseArmourId: line.baseArmourId },
    baseArmourId: baseId,
    takeOff: cameOff !== null,
  });
  return result.ok ? { ok: true, value: { cameOff } } : result;
}

/** The line as it is now (the Player screen keeps only what AC needs), or null when it's gone or can't be read. */
export async function lineNow(db: Db, campaignId: string, lineId: string): Promise<InventoryLine | null> {
  const found = await loadInventory(db, campaignId);
  return found?.lines.find((l) => l.id === lineId) ?? null;
}
