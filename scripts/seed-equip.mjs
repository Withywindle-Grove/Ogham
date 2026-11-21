// Wearing and holding a seeded character's kit, with the app's own item command (inventory.equip, the Pack's "Put it"):
// its first armour and first shield are worn, its first one-handed-or-fitting weapon is held. The class rules and the
// setting's warnings are checked first, as the Pack does; anything blocked, warned about or refused is reported, never
// forced. The checks are copied from src/app/EquipWarning.tsx (a React file Node can't load); the rules they call
// (equipBlocks, equipWarnings, scoresOf) are the app's own modules. No pack content here.
import { loadCharacterSheet } from '../src/core/characterSheet.ts';
import { runCommand } from '../src/core/commands.ts';
import { scoresOf } from '../src/app/fromSetting.ts';
import { equipBlocks, equipWarnings } from '../src/modules/inventory/equipWarnings.ts';
import { equipItem, loadInventory } from '../src/modules/inventory/inventory.ts';

const asItem = (line) => ({ ...line.details, id: line.sourceEntryId ?? line.id, name: line.name });
const handsOf = (line) => (line.details.hands === 2 ? 2 : 1);

/** What equip checks need for one character: the setting's hooks, and the character with its class and race. */
export async function loadEquipContext(db, setting, actorId) {
  const sheet = await loadCharacterSheet(db, actorId);
  if (!sheet) return null;
  const entry = (kind, id) => {
    const found = id ? setting.all.find((e) => e.kind === kind && e.packEntryId === id) : undefined;
    return found ? { ...found.data, id: found.packEntryId, name: found.name } : null;
  };
  const character = { name: sheet.name, level: sheet.level, ...scoresOf(setting, sheet.fields, sheet.creation), class: entry('class', sheet.classRef), race: entry('race', sheet.raceRef) };
  return { hooks: setting.all.filter((e) => e.kind === 'hook').map((e) => e.data), character };
}

const hookUsesAllows = (hooks, id) => hooks.some((h) => String(h.id ?? '') === id && typeof h.test === 'string' && /\ballows\s*\(/.test(h.test));

/** The class rules and the setting's hooks for putting one line on, given what else is on (as the Pack checks it). */
export function equipCheckWith(context, line, lines) {
  const equipped = {};
  for (const other of lines) {
    const slot = other.details.slot;
    if (other.equipped && other.id !== line.id && typeof slot === 'string' && !(slot in equipped)) equipped[slot] = other;
  }
  if (!context) return { blocked: [], warnings: [], equipped };
  const blocked = equipBlocks(context.character, asItem(line));
  if (blocked.length > 0) return { blocked, warnings: [], equipped };
  const found = equipWarnings(context.hooks, {
    character: context.character,
    item: asItem(line),
    equipped: { armour: null, shield: null, hand: null, ...Object.fromEntries(Object.entries(equipped).map(([slot, l]) => [slot, asItem(l)])) },
  });
  return { blocked, warnings: found.warnings.filter((w) => !hookUsesAllows(context.hooks, w.id)), equipped };
}

/**
 * The lines to put on, in order, and the ones that can't be: the first armour, the first shield, then the first weapon
 * that fits the free hands (a stack of more than one is never held). `lines` are the kit's, in the order they were added.
 */
export function equipOrder(lines) {
  const slotOf = (l) => (typeof l.details.slot === 'string' ? l.details.slot : '');
  const armour = lines.find((l) => slotOf(l) === 'armour');
  const shield = lines.find((l) => slotOf(l) === 'shield' && l.qty === 1);
  const order = [];
  const left = [];
  if (armour) order.push({ line: armour, role: 'worn' });
  let hands = 0;
  if (shield) {
    order.push({ line: shield, role: 'worn' });
    hands += 1;
  }
  const weapon = lines.find((l) => slotOf(l) === 'hand' && l.qty === 1);
  if (weapon) {
    if (hands + handsOf(weapon) <= 2) order.push({ line: weapon, role: 'held' });
    else left.push(`${weapon.name}: both hands are needed and the shield is on`);
  }
  return { order, left };
}

/**
 * Puts the kit's armour, shield and first weapon on the character through inventory.equip. Returns what went on and
 * what didn't, each with the reason (the class rule, the setting's warning, or the command's own refusal).
 */
export async function wearKit({ registry, db, user, setting, draft, carrier, lineIds }) {
  const worn = [];
  const refused = [];
  const inventory = await loadInventory(db, draft.campaignId);
  if (!inventory) return { worn, refused: ["couldn't read the pack to put anything on"] };
  const mine = inventory.lines.filter((l) => l.actorId === draft.id);
  const { order, left } = equipOrder(lineIds.flatMap((id) => mine.find((l) => l.id === id) ?? []));
  refused.push(...left);
  const context = await loadEquipContext(db, setting, draft.id);
  for (const { line, role } of order) {
    const check = equipCheckWith(context, line, mine);
    if (check.blocked.length > 0) {
      refused.push(`${line.name}: ${check.blocked.join(' ')}`);
      continue;
    }
    if (check.warnings.length > 0) {
      refused.push(`${line.name}: the setting warns ${check.warnings.map((w) => w.message || 'about this').join(' ')}`);
      continue;
    }
    const done = await runCommand(registry, db, user, equipItem, { line: { id: line.id, carrier, version: line.version }, equipped: true });
    if (!done.ok) {
      refused.push(`${line.name}: ${done.message}`);
      continue;
    }
    line.equipped = true;
    worn.push(`${line.name} (${role})`);
  }
  return { worn, refused };
}
