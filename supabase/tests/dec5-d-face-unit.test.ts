// dec5-gaps piece D (#191; docs/specs/dec5-gaps.md, "Migrations" item D, Testing Decisions seam 4; ruling dg-7, hard
// rule 5): an unidentified item hides its count's unit. Tests on what the database sends, never on what a screen draws.
// TEST project only; invented names (the Draught of Salt Sleep, a Grey flask, doses).
// Not run by the cloud session that wrote it (no Supabase there): CI's database job and Home One run it.
//
// Purposes, each a test below:
//   As a player, not allowed: before any tell, neither the holder's nor another player's read of an unidentified flask
//     (its line, and the campaign library's face of its entry) carries the count's `unit` or `units`; the face keeps
//     the rest of its charges (its full count).
//   As the GM, allowed: the GM's library read of the entry carries the unit.
//   After the GM tells the true name, the holder's read of the line carries `unit` and `units` on its charges.
//   After the GM tells the charges (of a second flask, its name still untold), the holder's read carries them too.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { setCharges } from '../../src/modules/inventory/charges.ts';
import { addItem, tellItem, type CarrierRef, type InventoryLine } from '../../src/modules/inventory/inventory.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

let packId = '';
let entryId = '';
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const refOf = (line: InventoryLine) => ({ id: line.id, carrier: wren() });
const lineRow = async (person: Person, id: string) => must(await person.db.from('inventory_lines').select('*').eq('id', id))[0]!;
const add = async () =>
  ok(
    as(world.gm, addItem, {
      carrier: wren(),
      item: { libraryEntryId: entryId, name: 'Whatever the device says', category: 'junk', weightCoin: null, slots: null, stack: 1 },
      qty: 1,
      howGot: 'found',
    }),
  );

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Saltmarsh Stillroom' },
      rulesSets: [
        {
          id: 'still-rules',
          name: 'Stillroom rules',
          itemCategories: [{ id: 'draught', name: 'Draughts', singular: 'Draught', unidentified: true }],
          magicItems: { charges: { hidden: true } },
        },
      ],
      items: [
        { id: 'salt-sleep', name: 'Draught of Salt Sleep', category: 'draught', appearsAs: 'Grey flask', charges: { initial: 3, unit: 'dose', units: 'doses' } },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  packId = await ok(as(world.gm, importPack, { pack: read.pack }));
  await ok(as(world.gm, attachPack, { campaignId: world.campaignId, packId }));
  entryId = must(await world.gm.db.from('library_entries').select('id').eq('pack_id', packId).eq('pack_entry_id', 'salt-sleep'))[0]!.id as string;
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('dec5-gaps D: an unidentified face carries no unit', () => {
  it('as a player, not allowed: neither the holder nor another player reads the unit on the line or the library face', async () => {
    const flask = await add();
    for (const person of [world.playerA, world.playerB]) {
      const line = await lineRow(person, flask.id);
      expect(line).toMatchObject({ identified: false, name: 'Grey flask' });
      expect(line.item_data.charges).toEqual({ initial: 3 });
      const library = (await loadCampaignEntries(asDb(person), world.campaignId)) ?? [];
      const face = library.find((e) => e.packEntryId === 'salt-sleep');
      expect(face).toMatchObject({ name: 'Grey flask' });
      expect((face!.data as { charges?: unknown }).charges).toEqual({ initial: 3 });
      expect(JSON.stringify({ line, face })).not.toMatch(/"units?"|doses?/);
    }
  });

  it('as the GM, allowed: the GM’s library entry carries the unit', async () => {
    const library = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    expect(library.find((e) => e.packEntryId === 'salt-sleep')?.data).toMatchObject({ charges: { initial: 3, unit: 'dose', units: 'doses' } });
  });

  it('after the true name is told, the holder reads the unit', async () => {
    const flask = await add();
    await ok(as(world.gm, tellItem, { line: refOf(flask), fact: 'name' }));
    const line = await lineRow(world.playerA, flask.id);
    expect(line).toMatchObject({ identified: true, name: 'Draught of Salt Sleep' });
    expect(line.item_data.charges).toEqual({ initial: 3, unit: 'dose', units: 'doses' });
  });

  it('after the charges are told (the name still untold), the holder reads the unit', async () => {
    const flask = await add();
    await ok(as(world.gm, setCharges, { line: refOf(flask), value: 3, hidden: true }));
    expect(await lineRow(world.playerA, flask.id)).toMatchObject({ charges_hidden: true });
    await ok(as(world.gm, tellItem, { line: refOf(flask), fact: 'charges' }));
    const line = await lineRow(world.playerA, flask.id);
    expect(line).toMatchObject({ identified: false, name: 'Grey flask', charges_hidden: false, charges_left: 3 });
    expect(line.item_data.charges).toEqual({ initial: 3, unit: 'dose', units: 'doses' });
  });
});
