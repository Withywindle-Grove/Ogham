// Equip warnings' log lines (M4b step 6; ruled 2026-10-21; docs/05, 07;
// supabase/migrations/20261025220000_m4b_equip_warnings.sql). TEST project only; invented content.
//   Putting something on despite a warning is logged under its own name; "A rule couldn't be checked" is the GM's
//   alone, at most once a minute for the same rule, and only members can write it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, equipAnyway, noteRuleSkipped, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('equip warnings in the log', () => {
  it('"Do it anyway" wears the item and the log names it as an override', async () => {
    const added = await as(world.gm, addItem, { carrier: wren(), item: { libraryEntryId: null, name: 'Fen plate', category: 'armour', weightCoin: 400, slots: 3, stack: 1 }, qty: 1, howGot: 'found' });
    if (!added.ok) throw new Error(added.message);
    expect(await as(world.playerA, equipAnyway, { line: { id: added.value.id, carrier: wren() } })).toMatchObject({ ok: true, value: true });
    expect(must(await world.playerB.db.from('events').select('type').eq('target_id', added.value.id).eq('type', 'inventory.equipAnyway'))).toHaveLength(1);
  });

  it("a rule that couldn't be checked: the GM sees it, players don't; once a minute per rule; outsiders can't write it", async () => {
    expect(await as(world.playerA, noteRuleSkipped, { campaignId: world.campaignId, hookId: 'warn-odd' })).toMatchObject({ ok: true });
    expect(await as(world.playerA, noteRuleSkipped, { campaignId: world.campaignId, hookId: 'warn-odd' })).toMatchObject({ ok: true });
    const seen = async (person: Person) => must(await person.db.from('events').select('after').eq('campaign_id', world.campaignId).eq('type', 'rule.skipped'));
    expect(await seen(world.gm)).toEqual([{ after: { hook: 'warn-odd' } }]);
    expect(await seen(world.playerA)).toEqual([]);
    expect(await as(world.outsider, noteRuleSkipped, { campaignId: world.campaignId, hookId: 'warn-odd' })).toMatchObject({ ok: false });
  });
});
