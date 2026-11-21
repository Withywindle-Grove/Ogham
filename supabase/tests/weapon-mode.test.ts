// A weapon's chosen mode (ruling m5b-at-hand-actions-2026-11-08, ah-3; Design on #569, 2026-11-09; supabase/migrations/
// 20261109120000_m5b_at_hand_weapon_mode.sql). TEST project only; invented content. Purposes:
//   item.setMode stores the mode on the line, logged as item.setMode (Simple), and Undo puts the old one back.
//   A player can't set the mode of someone else's weapon; the GM can set anyone's; the Party stash's items have none.
//   The last of a fresh weapon's default stack used up stores that mode in the same request (Design on #569, round 3:
//   it stays disengaged rather than sliding on to the next kind): one log line, and one Undo brings back both.
//   Only a character's weapons have a mode (20261109130000): setting one on a Party stash line is refused, and a weapon
//   put in the Party stash loses its mode (the move isn't refused).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addItem, moveItem, setWeaponMode, useItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const bow: ItemCopy = {
  libraryEntryId: null,
  name: 'Reed bow',
  category: 'weapon',
  weightCoin: 30,
  slots: 1,
  stack: 1,
  details: { weapon: { damage: '1d6', modes: { button: 'quiver', list: [{ id: 'reed', name: 'Reed arrows' }, { id: 'bone', name: 'Bone-tipped arrows' }] } } },
};
const boneArrows: ItemCopy = { libraryEntryId: null, name: 'Bone-tipped arrows', category: 'ammunition', weightCoin: 1, slots: 1, stack: 20 };

async function add(item: ItemCopy, qty: number) {
  const added = await as(world.gm, addItem, { carrier: wren(), item, qty, howGot: 'found' });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, carrier: wren() };
}
const modeOf = async (id: string) => must(await world.admin.from('inventory_lines').select('mode_id').eq('id', id))[0]?.mode_id ?? null;
const latest = async (type: string) =>
  must(await world.playerA.db.from('events').select('id, type, level, request_id, target_id, after').eq('type', type).order('seq', { ascending: false }).limit(5));
const undo = (eventId: string) => as(world.playerA, undoChange, { campaignId: world.campaignId, eventId, authorUserId: world.playerA.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('item.setMode (a weapon’s chosen mode)', () => {
  it('refuses a mode on a Party stash line, and a weapon put in the stash loses its mode', async () => {
    const [row] = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'));
    const stash: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: row!.id as string, ownerUserId: null, archived: false };
    const weapon = await add(bow, 1);
    expect(await as(world.playerA, setWeaponMode, { line: weapon, modeId: 'bone' })).toMatchObject({ ok: true });
    expect(await as(world.playerA, moveItem, { line: weapon, to: stash, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await modeOf(weapon.id)).toBeNull();
    // Straight at the database (the app's own rule refuses it first): the row rules refuse it too.
    const direct = await world.playerA.db.from('inventory_lines').update({ mode_id: 'reed' }).eq('id', weapon.id).select('id');
    expect(direct.error?.code).toBe('42501');
    expect(await modeOf(weapon.id)).toBeNull();
  });

  it('stores the mode, logged as item.setMode, and Undo puts the old one back', async () => {
    const weapon = await add(bow, 1);
    expect(await modeOf(weapon.id)).toBeNull();
    expect(await as(world.playerA, setWeaponMode, { line: weapon, modeId: 'bone' })).toMatchObject({ ok: true, value: 'bone' });
    expect(await modeOf(weapon.id)).toBe('bone');
    const [set] = await latest('item.setMode');
    expect(set).toMatchObject({ type: 'item.setMode', level: 'simple', target_id: weapon.id });
    expect(await undo(set!.id as string)).toMatchObject({ ok: true });
    expect(await modeOf(weapon.id)).toBeNull();
  });

  it("a player can't set the mode of someone else's weapon; the GM can", async () => {
    const weapon = await add(bow, 1);
    expect(await as(world.playerB, setWeaponMode, { line: weapon, modeId: 'reed' })).toMatchObject({ ok: false });
    expect(await modeOf(weapon.id)).toBeNull();
    expect(await as(world.gm, setWeaponMode, { line: weapon, modeId: 'reed' })).toMatchObject({ ok: true });
    expect(await modeOf(weapon.id)).toBe('reed');
  });

  it('the last of a fresh weapon’s stack keeps its mode in the same request, and one Undo brings back both', async () => {
    const weapon = await add(bow, 1);
    const arrows = await add(boneArrows, 1);
    expect(await modeOf(weapon.id)).toBeNull();
    expect(await as(world.playerA, useItem, { line: arrows, of: 1, verb: 'Fire', keepModeOf: { id: weapon.id, modeId: 'bone' } })).toMatchObject({ ok: true, value: 0 });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', arrows.id))).toEqual([]);
    expect(await modeOf(weapon.id)).toBe('bone');
    const uses = (await latest('item.use')).filter((e) => e.target_id === arrows.id || e.target_id === weapon.id);
    expect(new Set(uses.map((e) => e.request_id)).size).toBe(1);
    const gone = uses.find((e) => e.target_id === arrows.id)!;
    expect(await undo(gone.id as string)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('id, qty').eq('id', arrows.id))).toEqual([{ id: arrows.id, qty: 1 }]);
    expect(await modeOf(weapon.id)).toBeNull();
  });
});
