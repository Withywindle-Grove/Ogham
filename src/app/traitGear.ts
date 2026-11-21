// Gear a trait-list entry grants (M5b step 0c, slice 6; cr-17; 07 `traitLists[].entries[].items`, the starting-kit
// shape): when a background that "starts with a trap and a knife" is picked, its things go into the character's pack,
// with Undo. What a list put in the pack is kept on the creation record (`traitGear.<list id>`: the lines and how many),
// so changing the pick, or Undo, takes exactly those back out (only as many as it added; one already gone is left).
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCreationRecord } from '../core/characterSheet.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { traitValues, type TraitEntry, type TraitPick, type TraitStep } from '../modules/characters/traitLists.ts';
import { addItem, loadInventory, removeItem, type CarrierRef } from '../modules/inventory/inventory.ts';
import { piecesOf } from '../modules/characters/startingGear.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { bundleOf, copyOf, oneOffCopy } from './AddItem.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';
import { sameRolledSpell, withRolledSpell, type RolledSpell } from '../modules/characters/traitSpellRoll.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

type Granted = { id: string; qty: number }[];
type Outcome = { ok: true; added: string[]; money: number } | { ok: false; message: string };

const carrierOf = (character: CharacterRef): CarrierRef => ({ campaignId: character.campaignId, actorId: character.id, locationId: null, ownerUserId: character.ownerUserId, archived: false });

/** The lines a list put in the pack, as the creation record keeps them. */
function grantedOf(creation: unknown, listId: string): Granted {
  const all = isRecord(creation) && isRecord(creation.traitGear) ? creation.traitGear[listId] : undefined;
  return Array.isArray(all) ? all.filter(isRecord).flatMap((l) => (typeof l.id === 'string' && typeof l.qty === 'number' ? [{ id: l.id, qty: l.qty }] : [])) : [];
}

/** Takes out what the list put in (only as many as it added), and forgets it on the record. */
async function takeBack(db: Db, user: CurrentUser, character: CharacterRef, granted: Granted): Promise<{ ok: true } | { ok: false; message: string }> {
  if (granted.length === 0) return { ok: true };
  const inventory = await loadInventory(db, character.campaignId);
  if (!inventory) return { ok: false, message: "Couldn't take the old gear back. Check your connection and try again." };
  for (const line of granted) {
    const now = inventory.lines.find((l) => l.id === line.id);
    if (!now) continue;
    const removed = await runCommand(registry, db, user, removeItem, { line: { id: line.id, carrier: carrierOf(character), version: now.version }, qty: Math.min(line.qty, now.qty), of: now.qty });
    if (!removed.ok) return { ok: false, message: removed.message };
  }
  return { ok: true };
}

/** `spell`: the spell rolled for the pick (bq3-18), null to take it off, left out to leave it as it is. */
async function keep(db: Db, user: CurrentUser, character: CharacterRef, listId: string, granted: Granted, money = 0, spell?: RolledSpell | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await loadCreationRecord(db, character.id);
  if (!found) return { ok: false, message: "Couldn't save that. Check your connection and try again." };
  const creation = spell === undefined ? (isRecord(found.creation) ? { ...found.creation } : {}) : withRolledSpell(isRecord(found.creation) ? found.creation : {}, listId, spell);
  const gear = isRecord(creation.traitGear) ? { ...creation.traitGear } : {};
  if (granted.length > 0) gear[listId] = granted;
  else delete gear[listId];
  if (Object.keys(gear).length > 0) creation.traitGear = gear;
  else delete creation.traitGear;
  // The entry's coins (rc-2 `money`), by list, added to starting money wherever it's read (startingGear.ts entryMoneyOf).
  const coins = isRecord(creation.traitMoney) ? { ...creation.traitMoney } : {};
  if (money > 0) coins[listId] = money;
  else delete coins[listId];
  if (Object.keys(coins).length > 0) creation.traitMoney = coins;
  else delete creation.traitMoney;
  const saved = await runCommand(registry, db, user, editCharacter, { character, changes: { creation } });
  return saved.ok ? { ok: true } : { ok: false, message: saved.message };
}

/**
 * After a trait-list pick is saved: what an earlier pick of the same list granted goes back out, and what this entry
 * grants (none for a typed Other…) goes in. Nothing is written when neither has gear. `added` names what went in.
 * `spell`: the spell rolled under the pick (rc-2 `spells.roll`, bq3-18), kept on the record with the entry it was
 * rolled for (`traitSpells.<list id>`); a pick without one takes an earlier one off.
 */
export async function grantTraitGear(db: Db, user: CurrentUser, setting: CampaignSetting, character: CharacterRef, listId: string, entry: TraitEntry | null, spell: RolledSpell | null = null): Promise<Outcome> {
  const found = await loadCreationRecord(db, character.id);
  if (!found) return { ok: false, message: "Couldn't save that. Check your connection and try again." };
  const before = grantedOf(found.creation, listId);
  const items = entry?.items ?? [];
  const money = entry?.money ?? 0;
  const hadMoney = isRecord(found.creation) && isRecord(found.creation.traitMoney) && listId in found.creation.traitMoney;
  const hadSpell = isRecord(found.creation) && isRecord(found.creation.traitSpells) && listId in found.creation.traitSpells;
  if (before.length === 0 && items.length === 0 && money === 0 && !hadMoney && !spell && !hadSpell) return { ok: true, added: [], money: 0 };
  const back = await takeBack(db, user, character, before);
  if (!back.ok) return back;
  const granted: Granted = [];
  const added: string[] = [];
  for (const piece of items) {
    // A `{ name }` line is a one-off (rc-3): no weight or price; it waits for the GM like any player's one-off.
    const item = piece.itemId ? entriesInPlay(setting.items).find((i) => i.packEntryId === piece.itemId) : null;
    // One the setting doesn't have, or an option switches off (of-3), is left out (like a kit's).
    if (piece.itemId && !item) continue;
    const qty = item ? piecesOf(piece, bundleOf(item)) : piece.qty;
    const name = item?.name ?? piece.name ?? '';
    // "No cost" (found): "given" is the GM's alone (M4); a background's things cost nothing.
    const line = await runCommand(registry, db, user, addItem, { carrier: carrierOf(character), item: item ? copyOf(item) : oneOffCopy(name), qty, howGot: 'found' });
    if (!line.ok) return { ok: false, message: line.message };
    granted.push({ id: line.value.id, qty });
    added.push(qty > 1 ? `${name} ×${qty}` : name);
  }
  const kept = await keep(db, user, character, listId, granted, money, spell);
  return kept.ok ? { ok: true, added, money } : kept;
}

/**
 * Decide later again (look-back review of #663): true when the picks and the spell rolled under one are what the
 * field and the creation record already keep, so nothing is saved (no gear taken back and given again, no toast, no
 * log lines). The same picks in another order count as unchanged (#668's review): each pick's value is compared,
 * sorted, not the joined field.
 */
export function traitUnchanged(step: TraitStep, saved: readonly TraitPick[], picks: readonly TraitPick[], creation: unknown, rolled: RolledSpell | null): boolean {
  const values = (all: readonly TraitPick[]) => JSON.stringify(all.map((p) => traitValues(step, [p])).sort());
  return values(picks) === values(saved) && sameRolledSpell(creation, step.id, rolled);
}

/** Undo: what the list put in goes back out, and the record forgets it (the pick itself stays). */
export async function undoTraitGear(db: Db, user: CurrentUser, character: CharacterRef, listId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await loadCreationRecord(db, character.id);
  if (!found) return { ok: false, message: "Couldn't take it back. Check your connection and try again." };
  const back = await takeBack(db, user, character, grantedOf(found.creation, listId));
  // The pick stays, and so do its coins (rc-2): only the gear goes back out.
  const coins = isRecord(found.creation) && isRecord(found.creation.traitMoney) ? found.creation.traitMoney[listId] : undefined;
  return back.ok ? keep(db, user, character, listId, [], typeof coins === 'number' ? coins : 0) : back;
}

/** The toast after a pick that grants something: "Rope added to your pack. 50 added to your starting money."; '' for nothing. */
export function grantedWords(gear: { added: readonly string[]; money: number }): string {
  return [gear.added.length > 0 ? `${gear.added.join(', ')} added to your pack.` : '', gear.money > 0 ? `${gear.money} added to your starting money.` : ''].filter(Boolean).join(' ');
}
