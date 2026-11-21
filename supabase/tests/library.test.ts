// Your library of setting rules: importing a pack saves it and all its entries in one step, privately; updating
// from a newer file adds, changes and removes entries. TEST project only; invented content only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack, loadLibrary, loadPackEntries, updatePack } from '../../src/modules/library/library.ts';
import { comparePacks, readPackJson, type ReadPack } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  for (const person of [world.gm, world.playerA, world.playerB]) await world.admin.from('packs').delete().eq('owner_user_id', person.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

function packFile(items: { id: string; name: string; slots?: number }[], name = 'River Rules'): ReadPack {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name, version: '0.1', kind: 'setting' },
      items,
      conditions: [{ id: 'stunned', name: 'Stunned' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

describe('the library', () => {
  it('importing saves the pack and all its entries; only its owner sees them', async () => {
    const made = await as(world.gm, importPack, { pack: packFile([{ id: 'rope-50ft', name: 'Rope, 50 ft' }, { id: 'lantern', name: 'Lantern' }]) });
    if (!made.ok) throw new Error(made.message);
    const library = (await loadLibrary(asDb(world.gm), world.gm.id)) ?? [];
    expect(library.find((p) => p.id === made.value)).toMatchObject({
      name: 'River Rules',
      version: '0.1',
      kind: 'setting',
      formatVersion: 2,
      counts: { item: 2, condition: 1 },
    });
    expect(((await loadPackEntries(asDb(world.gm), made.value)) ?? []).map((e) => e.packEntryId).sort()).toEqual(['lantern', 'rope-50ft', 'stunned']);

    expect((await loadLibrary(asDb(world.playerA), world.playerA.id)) ?? []).not.toContainEqual(expect.objectContaining({ id: made.value }));
    expect(await loadPackEntries(asDb(world.playerA), made.value)).toEqual([]);
  });

  it('comparing a saved pack with the same file shows nothing changed (the database reorders details)', async () => {
    const file = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Round Trip Rules' },
        items: [{ id: 'lantern', name: 'Lantern', weightCoin: 30, value: { sp: 5, gp: 1 }, lightTypeId: 'lantern-light', zebra: 1, a: 2 }],
        statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', hpAverage: 13, fields: { Move: '60 ft', AC: '6' } }],
      }),
    );
    if (!file.ok) throw new Error(file.message);
    const made = await as(world.gm, importPack, { pack: file.pack });
    if (!made.ok) throw new Error(made.message);
    const saved = (await loadPackEntries(asDb(world.gm), made.value)) ?? [];
    expect(comparePacks(saved, file.pack.entries)).toEqual({ added: [], changed: [], removed: [], unchanged: 2 });
  });

  it('a pack with a broken entry saves nothing at all', async () => {
    const broken = packFile([{ id: 'rope-50ft', name: 'Rope' }], 'Broken Rules');
    broken.entries.push({ kind: 'dragon' as never, packEntryId: 'x', name: 'X', data: {} });
    expect(await as(world.gm, importPack, { pack: broken })).toMatchObject({ ok: false });
    expect(must(await world.admin.from('packs').select('id').eq('name', 'Broken Rules'))).toEqual([]);
  });

  it('updating from a newer file adds, changes and removes entries, and keeps the pack', async () => {
    const made = await as(world.gm, importPack, { pack: packFile([{ id: 'rope-50ft', name: 'Rope', slots: 1 }, { id: 'lantern', name: 'Lantern' }], 'Updated Rules') });
    if (!made.ok) throw new Error(made.message);
    const newer = packFile([{ id: 'rope-50ft', name: 'Rope', slots: 2 }, { id: 'pole-10ft', name: 'Pole, 10 ft' }], 'Updated Rules');
    newer.meta.version = '0.2';
    expect(await as(world.gm, updatePack, { packId: made.value, ownerUserId: world.gm.id, pack: newer })).toMatchObject({ ok: true });

    const entries = (await loadPackEntries(asDb(world.gm), made.value)) ?? [];
    expect(entries.map((e) => e.packEntryId).sort()).toEqual(['pole-10ft', 'rope-50ft', 'stunned']);
    expect(entries.find((e) => e.packEntryId === 'rope-50ft')?.data).toMatchObject({ slots: 2 });
    expect(((await loadLibrary(asDb(world.gm), world.gm.id)) ?? []).find((p) => p.id === made.value)?.version).toBe('0.2');
  });

  it("nobody else can update, read or delete your pack, even skipping the app's own check", async () => {
    const made = await as(world.gm, importPack, { pack: packFile([{ id: 'rope-50ft', name: 'Rope' }], 'Private Rules') });
    if (!made.ok) throw new Error(made.message);
    const other = (await loadCurrentUser(asDb(world.playerA)))!;
    expect(
      await updatePack.run(asDb(world.playerA), other, { packId: made.value, ownerUserId: world.gm.id, pack: packFile([], 'Private Rules') }),
    ).toMatchObject({ ok: false, reason: 'not-allowed' });
    const erased = await world.playerA.db.from('packs').delete().eq('id', made.value).select();
    expect(erased.data ?? []).toEqual([]);
    expect(must(await world.admin.from('library_entries').select('id').eq('pack_id', made.value)).length).toBe(2);
  });
});

describe('a big pack (more entries than the database sends in one go)', () => {
  it('everything loads: the library counts, browsing, comparing, and a campaign using it, hidden fields only for the GM', async () => {
    const items = Array.from({ length: 1100 }, (_, i) => ({ id: `pebble-${i}`, name: `Pebble ${i}` }));
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Pebble Rules', version: '1' },
        items: [...items, { id: 'humming-pebble', name: 'Humming pebble', cursed: true, gmOnly: ['cursed'] }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);

    expect(((await loadLibrary(asDb(world.gm), world.gm.id)) ?? []).find((p) => p.id === made.value)?.counts).toEqual({ item: 1101 });
    const entries = (await loadPackEntries(asDb(world.gm), made.value)) ?? [];
    expect(entries).toHaveLength(1101);
    expect(entries.find((e) => e.packEntryId === 'humming-pebble')?.data).toMatchObject({ cursed: true });
    expect(comparePacks(entries, read.pack.entries)).toMatchObject({ added: [], changed: [], removed: [] });

    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value })).toMatchObject({ ok: true });
    const gmSees = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    expect(gmSees.filter((e) => e.packId === made.value)).toHaveLength(1101);
    const playerSees = (await loadCampaignEntries(asDb(world.playerA), world.campaignId)) ?? [];
    expect(playerSees.filter((e) => e.packId === made.value)).toHaveLength(1101);
    expect(playerSees.find((e) => e.packEntryId === 'humming-pebble')?.data).toEqual({ id: 'humming-pebble', name: 'Humming pebble' });
  }, 120_000);
});
