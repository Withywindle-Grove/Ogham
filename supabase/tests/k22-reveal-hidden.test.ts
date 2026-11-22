// K22a and K22b, hidden means hidden for an unidentified item (docs/plans/k22-reveal.md; ruling
// docs/design/rulings/k22-reveal-2026-11-21.md; hard rule 5). Tests on what the database sends, never on what a screen
// draws. TEST project only; invented names (the Bronze ring, the Sorrow blade, the Heron bow, Ember arrows).
// Not run by the cloud session that wrote it (no Supabase there): CI's database job runs it.
//
// Purposes, each a test below:
//   K22a, as a player, not allowed: before any tell, a player's read of Wren's unidentified ring (the line, the campaign
//     library, a plain select on library_entries, every event in the campaign) holds none of its true name, bonus,
//     curse, powers, description or source; the same for a cursed sword's −1 and an unidentified bow's bonus against a foe.
//   K22a, as a player, allowed: the same reads hold the ring's face, "Bronze ring", and its "What you notice" words.
//   K22a, as the GM, allowed: the GM reads every one of those facts.
//   K22a: an emptied "appears as" reads as the category's singular name, and an emptied "What you notice" sends nothing.
//   K22a: a line given to the stash or split off keeps its face.
//   K22a: a player can't set identified, revealed_fields, appears_as or noticed on a line, nor make a line with them set.
//   K22a (⚑ 9 = b): an unidentified stack of arrows doesn't join a same-name plain stack; it joins its own kind.
//   K22b: after "That it's cursed" is told, a player's read of the line holds the curse and "magic" and nothing else new,
//     and two players both read the log's line (k22-9). After "Its true name", every player reads the true name on the
//     line and in its log line (sw-8). After "Tell them everything", the description and the source.
//   K22b, as a player, not allowed: after the GM's Undo of the curse, a player's read of the line no longer holds it, and
//     their read of the log holds neither the tell's line nor the Undo's; the GM's read holds both, nothing deleted.
//   K22b: a look edit's line is read by the GM and no player (pick 3), while the players read the new words on the line.
//   K22b: a tell on an item in the Party stash is read by every player.
//   K22b: a tell, then the player gives the ring to Ash, then the GM's Undo: done (the generic Undo takes the line's
//     change back whole), and no player's read holds the fact.
//   K22b: only the GM tells or edits; a player is refused, even on their own item.
//   The local review of #40: (1) an Undo of a tell is refused once part of the stack was split off since; (3) a patch on
//     an unidentified item's truth reaches no player; (4) a Bonus or Curse field is off the face until its fact is told;
//     (5) the old "Reveal …" button records the bonus as told; (7) a redone tell's line is the players' again.
// Not tested here: the migration's one bump of every campaign's seen stamp (the world is built after the migration ran).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addItem, editItemLook, moveItem, revealItemField, tellItem, type CarrierRef, type InventoryLine } from '../../src/modules/inventory/inventory.ts';
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

const TRUE_NAME = 'Ring of the Drowned Bell';
const NOTICED = 'Cold to the touch, even by the fire.';
const RING_SECRETS = [TRUE_NAME, '+1 to saves', 'Steady against harm', 'Cast from the bronze of a sunken bell', 'Saltwick, p. 14', 'drowned want it back'];
const ringSecret = new RegExp(RING_SECRETS.map((s) => s.replace(/[.+]/g, '\\$&')).join('|'));

let packId = '';
let entries: Record<string, string> = {};
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const ash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false });
let stashId = '';
const stash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: null, locationId: stashId, ownerUserId: null, archived: false });

const ITEMS = [
  {
    id: 'bronze-ring',
    name: TRUE_NAME,
    category: 'ring',
    slot: 'worn',
    appearsAs: 'Bronze ring',
    noticed: NOTICED,
    looks: 'A plain band of old bronze.',
    description: 'Cast from the bronze of a sunken bell.',
    source: 'Saltwick, p. 14',
    bonus: '+1 to saves',
    cursed: true,
    properties: [{ name: 'Steady against harm' }],
    notes: 'The drowned want it back.',
    gmOnly: ['bonus', 'cursed', 'notes'],
  },
  { id: 'sorrow-blade', name: 'Sorrow blade', category: 'weapon', slot: 'hand', weapon: { damage: '1d8', magicBonus: -1 }, cursed: true, gmOnly: ['cursed'] },
  { id: 'heron-bow', name: 'Heron bow', category: 'magic-bow', slot: 'hand', weapon: { damage: '1d6', bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } },
  { id: 'ember-arrows', name: 'Ember arrows', category: 'magic-arrows', stack: 20, appearsAs: 'Arrows', weapon: { magicBonus: 1 } },
  { id: 'arrows', name: 'Arrows', category: 'ammunition', stack: 20 },
  // A plain, identified magic sword: its patches reach players as before. Not for sale, so players know it only once
  // it is handed out (test 3); the reads of the first test hold no magic bonus at all.
  { id: 'fen-blade', name: 'Fenblade', category: 'weapon', forSale: false, slot: 'hand', weapon: { damage: '1d8', magicBonus: 1 } },
  // Review of #40, finding 4: visible fields that say a fact in words.
  { id: 'glass-ring', name: 'Ring of Green Glass', category: 'ring', fields: { Bonus: '+2 to saves', Curse: 'Brittle in the cold', Glass: 'Sea-green' } },
];

/** What a player's device can get of the campaign: every line, the campaign's library, a plain select, the log. */
async function playerReads(person: Person) {
  const [lines, library, plain, log] = await Promise.all([
    person.db.from('inventory_lines').select('*').eq('campaign_id', world.campaignId),
    loadCampaignEntries(asDb(person), world.campaignId),
    person.db.from('library_entries').select('*').eq('pack_id', packId),
    person.db.from('events').select('*').eq('campaign_id', world.campaignId),
  ]);
  return { lines: must(lines), library: library ?? [], plain: must(plain), log: must(log) };
}

const add = async (person: Person, key: string, carrier: CarrierRef = wren(), qty = 1) =>
  ok(
    as(person, addItem, {
      carrier,
      item: { libraryEntryId: entries[key]!, name: 'Whatever the device says', category: 'junk', weightCoin: null, slots: null, stack: 1 },
      qty,
      howGot: 'found',
    }),
  );
const lineRow = async (person: Person, id: string) => must(await person.db.from('inventory_lines').select('*').eq('id', id))[0];
const refOf = (line: InventoryLine, carrier: CarrierRef) => ({ id: line.id, carrier });
const tellLines = async (person: Person, lineId: string) => must(await person.db.from('events').select('id, type, reverts_event_id').eq('target_id', lineId).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Saltwick Arms' },
      rulesSets: [
        {
          id: 'salt-rules',
          name: 'Salt rules',
          itemCategories: [
            { id: 'ring', name: 'Rings', singular: 'Ring', unidentified: true },
            { id: 'magic-bow', name: 'Magic bows', singular: 'Bow', unidentified: true },
            { id: 'magic-arrows', name: 'Magic arrows', unidentified: true },
          ],
        },
      ],
      items: ITEMS,
    }),
  );
  if (!read.ok) throw new Error(read.message);
  packId = await ok(as(world.gm, importPack, { pack: read.pack }));
  await ok(as(world.gm, attachPack, { campaignId: world.campaignId, packId }));
  const rows = must(await world.gm.db.from('library_entries').select('id, pack_entry_id').eq('pack_id', packId));
  entries = Object.fromEntries(rows.map((r) => [r.pack_entry_id as string, r.id as string]));
  const place = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0];
  stashId = place ? (place.id as string) : (must(await world.admin.from('locations').insert({ campaign_id: world.campaignId, name: 'Party stash', kind: 'stash' }).select('id').single()).id as string);
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('K22a: the face, held by the database', () => {
  it("as a player, not allowed: no read of the untold ring, blade or bow holds its truth; as a player, allowed: the face", async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    const blade = await add(world.gm, 'sorrow-blade');
    const bow = await add(world.gm, 'heron-bow');
    for (const person of [world.playerA, world.playerB]) {
      const reads = await playerReads(person);
      const everything = JSON.stringify(reads);
      expect(everything).not.toMatch(ringSecret);
      // The driver's finding: the cursed sword's −1, and the bow's bonus against a foe, reach no player.
      expect(everything).not.toMatch(/magicBonus|bonusVs|bog lurkers|Sorrow blade|Heron bow|"cursed"/);
      // The face: the line's name and its "What you notice" words, and the library's face of the entry.
      const line = reads.lines.find((l) => l.id === ring.id)!;
      expect(line).toMatchObject({ name: 'Bronze ring', identified: false, appears_as: 'Bronze ring', noticed: NOTICED, revealed_fields: [] });
      expect(line.item_data).toMatchObject({ slot: 'worn', looks: 'A plain band of old bronze.' });
      expect(reads.lines.find((l) => l.id === blade.id)).toMatchObject({ name: 'Weapon', identified: false, item_data: { weapon: { damage: '1d8' } } });
      expect(reads.lines.find((l) => l.id === bow.id)).toMatchObject({ name: 'Bow', identified: false });
      const libraryRing = reads.library.find((e) => e.packEntryId === 'bronze-ring');
      expect(libraryRing).toMatchObject({ name: 'Bronze ring', data: { appearsAs: 'Bronze ring', noticed: NOTICED } });
      // A plain select gets no row of an unidentified entry at all (its face comes through the library).
      expect(reads.plain.map((r) => r.pack_entry_id)).not.toContain('bronze-ring');
    }
  });

  it('as the GM, allowed: the GM reads every fact', async () => {
    const library = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    const ring = library.find((e) => e.packEntryId === 'bronze-ring')!;
    expect(ring.name).toBe(TRUE_NAME);
    expect(ring.data).toMatchObject({ bonus: '+1 to saves', cursed: true, properties: [{ name: 'Steady against harm' }], description: 'Cast from the bronze of a sunken bell.', source: 'Saltwick, p. 14' });
    expect(library.find((e) => e.packEntryId === 'sorrow-blade')?.data).toMatchObject({ weapon: { magicBonus: -1 }, cursed: true });
    expect(library.find((e) => e.packEntryId === 'heron-bow')?.data).toMatchObject({ weapon: { bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } });
  });

  it('an emptied "appears as" reads as the category’s singular name; an emptied "What you notice" sends nothing', async () => {
    const ring = await add(world.gm, 'bronze-ring');
    await ok(as(world.gm, editItemLook, { line: refOf(ring, wren()), appearsAs: '', noticed: '' }));
    expect(await lineRow(world.playerA, ring.id)).toMatchObject({ name: 'Ring', appears_as: '', noticed: '' });
    expect(JSON.stringify(await lineRow(world.playerA, ring.id))).not.toContain(NOTICED);
  });

  it('a line given to the stash, or split off, keeps its face', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    const moved = await ok(as(world.playerA, moveItem, { line: refOf(ring, wren()), to: stash(), qty: 1, of: 1 }));
    expect(moved).toMatchObject({ name: 'Bronze ring', identified: false, noticed: NOTICED });
    const arrows = await add(world.gm, 'ember-arrows', wren(), 6);
    const part = await ok(as(world.playerA, moveItem, { line: refOf(arrows, wren()), to: ash(), qty: 2, of: 6 }));
    expect(part.id).not.toBe(arrows.id);
    expect(part).toMatchObject({ name: 'Arrows', identified: false, qty: 2 });
    expect(JSON.stringify(await lineRow(world.playerB, part.id))).not.toMatch(/magicBonus|Ember/);
  });

  it("a player can't set what players see of a line, nor make a line with it set (42501)", async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    for (const patch of [{ identified: true }, { revealed_fields: ['name'] }, { appears_as: 'Gold ring' }, { noticed: 'Warm.' }]) {
      const tried = await world.playerA.db.from('inventory_lines').update(patch).eq('id', ring.id).select('id');
      expect(tried.error?.code).toBe('42501');
    }
    const made = await world.playerA.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: world.wrenId, name: 'Odd stone', how_got: 'found', noticed: 'It whispers.' })
      .select('id');
    expect(made.error?.code).toBe('42501');
    expect(await lineRow(world.gm, ring.id)).toMatchObject({ identified: false, revealed_fields: [], appears_as: 'Bronze ring' });
  });

  it('an unidentified stack of arrows never joins a same-name plain stack, and joins its own kind (⚑ 9)', async () => {
    // In the stash, where no arrows are yet (the split above left some with Ash).
    const plain = await add(world.gm, 'arrows', stash(), 10);
    const magic = await add(world.gm, 'ember-arrows', stash(), 5);
    expect(magic.id).not.toBe(plain.id);
    expect(magic).toMatchObject({ name: 'Arrows', identified: false, qty: 5 });
    // More of the same unidentified kind, with the same facts told (none): one stack.
    const more = await add(world.gm, 'ember-arrows', stash(), 3);
    expect(more).toMatchObject({ id: magic.id, qty: 8 });
    expect(await lineRow(world.gm, plain.id)).toMatchObject({ qty: 10 });
  });
});

describe('K22b: tell, Undo, and who reads the line', () => {
  it('only the GM tells or edits; a player is refused, even on their own item', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    expect(await as(world.playerA, tellItem, { line: refOf(ring, wren()), fact: 'cursed' })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await world.playerA.db.rpc('tell_item', { line: ring.id, facts: ['cursed'] })).toMatchObject({ error: { code: '42501' } });
    expect(await world.playerA.db.rpc('edit_item_look', { line: ring.id, appears_as: 'Gold ring', noticed: '' })).toMatchObject({ error: { code: '42501' } });
    expect(await lineRow(world.gm, ring.id)).toMatchObject({ revealed_fields: [], appears_as: 'Bronze ring' });
  });

  it('the curse told: the players read the curse and "magic", nothing else new, and both read the log’s line; Undo takes the players’ line away', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    const told = await ok(as(world.gm, tellItem, { line: refOf(ring, wren()), fact: 'cursed' }));
    expect(told).toMatchObject({ revealedFields: ['magic', 'cursed'], name: 'Bronze ring', identified: false });
    for (const person of [world.playerA, world.playerB]) {
      const seen = await lineRow(person, ring.id);
      expect(seen.item_data).toMatchObject({ cursed: true });
      expect(JSON.stringify(seen)).not.toMatch(ringSecret);
      expect((await tellLines(person, ring.id)).map((e) => e.type)).toContain('inventory.tell');
    }
    // The GM's Undo: the curse is hidden again; the players' log holds neither line; the GM's holds both.
    const tell = (await tellLines(world.gm, ring.id)).find((e) => e.type === 'inventory.tell')!;
    await ok(as(world.gm, undoChange, { campaignId: world.campaignId, eventId: tell.id as string, authorUserId: world.gm.id }));
    for (const person of [world.playerA, world.playerB]) {
      const seen = await lineRow(person, ring.id);
      expect(seen.item_data).not.toHaveProperty('cursed');
      expect(seen.revealed_fields).toEqual([]);
      const log = await tellLines(person, ring.id);
      expect(log.map((e) => e.type)).not.toContain('inventory.tell');
      expect(log.filter((e) => e.reverts_event_id !== null)).toEqual([]);
    }
    const gmLog = await tellLines(world.gm, ring.id);
    expect(gmLog.map((e) => e.type)).toEqual(expect.arrayContaining(['inventory.tell', 'event.undo']));
    // Nothing deleted: the tell's event is still there.
    expect(must(await world.admin.from('events').select('id').eq('id', tell.id))).toHaveLength(1);
  });

  it('the true name told: every player reads it on the line and in its log line; everything told: the description and source', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    await ok(as(world.gm, tellItem, { line: refOf(ring, wren()), fact: 'name' }));
    for (const person of [world.playerA, world.playerB]) {
      expect(await lineRow(person, ring.id)).toMatchObject({ name: TRUE_NAME, identified: true });
      const lines = must(await person.db.from('events').select('after').eq('target_id', ring.id).eq('type', 'inventory.tell'));
      expect(JSON.stringify(lines)).toContain(TRUE_NAME);
    }
    await ok(as(world.gm, tellItem, { line: refOf(ring, wren()), fact: 'everything' }));
    const seen = await lineRow(world.playerB, ring.id);
    expect(seen.item_data).toMatchObject({ bonus: '+1 to saves', cursed: true, properties: [{ name: 'Steady against harm' }], description: 'Cast from the bronze of a sunken bell.', source: 'Saltwick, p. 14' });
    // GM notes are never told.
    expect(JSON.stringify(seen)).not.toContain('drowned want it back');
    expect(seen.revealed_fields).toEqual(expect.arrayContaining(['magic', 'name', 'bonus', 'power:0', 'cursed']));
  });

  it('a look edit: the GM reads its line, no player does; the players read the new words on the line', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    await ok(as(world.gm, editItemLook, { line: refOf(ring, wren()), appearsAs: 'Green ring', noticed: 'Smells of the sea.' }));
    expect(await lineRow(world.playerA, ring.id)).toMatchObject({ name: 'Green ring', appears_as: 'Green ring', noticed: 'Smells of the sea.' });
    for (const person of [world.playerA, world.playerB]) {
      expect((await tellLines(person, ring.id)).map((e) => e.type)).not.toContain('inventory.editLook');
    }
    expect((await tellLines(world.gm, ring.id)).map((e) => e.type)).toContain('inventory.editLook');
  });

  it('a tell on an item in the Party stash is read by every player', async () => {
    const ring = await add(world.gm, 'bronze-ring', stash());
    await ok(as(world.gm, tellItem, { line: refOf(ring, stash()), fact: 'magic' }));
    for (const person of [world.playerA, world.playerB]) {
      expect((await tellLines(person, ring.id)).map((e) => e.type)).toContain('inventory.tell');
    }
  });

  it('a tell, then the player gives the ring to Ash, then the GM’s Undo: done, and no player read holds the fact', async () => {
    const blade = await add(world.playerA, 'sorrow-blade');
    await ok(as(world.gm, tellItem, { line: refOf(blade, wren()), fact: 'bonus' }));
    expect((await lineRow(world.playerA, blade.id)).item_data).toMatchObject({ weapon: { magicBonus: -1 } });
    await ok(as(world.playerA, moveItem, { line: refOf(blade, wren()), to: ash(), qty: 1, of: 1 }));
    const tell = (await tellLines(world.gm, blade.id)).find((e) => e.type === 'inventory.tell')!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: tell.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    for (const person of [world.playerA, world.playerB]) {
      const seen = await lineRow(person, blade.id);
      expect(seen.actor_id).toBe(world.ashId);
      expect(JSON.stringify(seen)).not.toContain('magicBonus');
      const log = must(await person.db.from('events').select('before, after').eq('target_id', blade.id));
      expect(JSON.stringify(log)).not.toContain('magicBonus');
    }
  });
});

describe('the local review of #40', () => {
  // Purpose (finding 1): a tell, then part of the stack is split off and handed on, then the GM's Undo: the part (and
  // its own log line) carries the told fact, which the Undo can't reach, so the Undo is refused with its reason, and no
  // player's read holds a fact the line no longer has.
  it('1. an Undo of a tell is refused once part of the stack was split off since', async () => {
    const arrows = await add(world.gm, 'ember-arrows', wren(), 6);
    await ok(as(world.gm, tellItem, { line: refOf(arrows, wren()), fact: 'bonus' }));
    const part = await ok(as(world.playerA, moveItem, { line: refOf(arrows, wren()), to: ash(), qty: 2, of: 6 }));
    expect(part.id).not.toBe(arrows.id);
    const tell = (await tellLines(world.gm, arrows.id)).find((e) => e.type === 'inventory.tell')!;
    const undone = await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: tell.id as string, authorUserId: world.gm.id });
    expect(undone).toMatchObject({ ok: false });
    expect(undone.ok ? '' : undone.message).toMatch(/split off/);
    // As a player: what each line says is what was told, and both still say it.
    for (const person of [world.playerA, world.playerB]) {
      expect((await lineRow(person, arrows.id)).revealed_fields).toEqual(expect.arrayContaining(['bonus']));
      expect((await lineRow(person, part.id)).revealed_fields).toEqual(expect.arrayContaining(['bonus']));
    }
  });

  // Purpose (finding 3, as the driver narrowed it): a patch that targets an unidentified item and changes a fact of it
  // not yet told (its magic bonus) is the GM's, by any read, until that fact is told on a line of it; one that changes
  // something players see of it (its damage) still reaches them; and a bonus patch on a plain, identified item, or on
  // every item, reaches them as before (their numbers use it).
  it('3. a patch on an unidentified item’s untold truth reaches no player; a plain item’s bonus patch does', async () => {
    const sorrow = await add(world.gm, 'sorrow-blade');
    await add(world.gm, 'fen-blade');
    must(
      await world.admin
        .from('library_entries')
        .insert([
          { pack_id: packId, kind: 'patch', pack_entry_id: 'sharper-sorrow', name: 'Sharper sorrow', data: { match: { kind: 'item', ids: ['sorrow-blade'] }, change: { 'weapon.magicBonus': { delta: -1 } } } },
          { pack_id: packId, kind: 'patch', pack_entry_id: 'heavier-sorrow', name: 'Heavier sorrow', data: { match: { kind: 'item', ids: ['sorrow-blade'] }, change: { 'weapon.damage': { delta: 1 } } } },
          { pack_id: packId, kind: 'patch', pack_entry_id: 'sharper-fen', name: 'Sharper fen', data: { match: { kind: 'item', ids: ['fen-blade'] }, change: { 'weapon.magicBonus': { delta: 1 } } } },
          { pack_id: packId, kind: 'patch', pack_entry_id: 'sharper-all', name: 'Sharper all', data: { match: { kind: 'item' }, change: { 'weapon.magicBonus': { delta: 1 } } } },
        ])
        .select('id'),
    );
    const patchesFor = async (person: Person) => {
      const library = must(await person.db.rpc('campaign_library', { campaign: world.campaignId, packs: [packId] })) as { kind: string; pack_entry_id: string }[];
      const plain = must(await person.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'patch')).map((e) => e.pack_entry_id as string);
      return { library: library.filter((e) => e.kind === 'patch').map((e) => e.pack_entry_id), plain };
    };
    for (const person of [world.playerA, world.playerB]) {
      const { library, plain } = await patchesFor(person);
      expect(library).toEqual(expect.arrayContaining(['heavier-sorrow', 'sharper-fen', 'sharper-all']));
      expect(library).not.toContain('sharper-sorrow');
      expect(plain).toEqual(expect.arrayContaining(['sharper-fen', 'sharper-all']));
      expect(plain).not.toContain('sharper-sorrow');
    }
    const gmLibrary = must(await world.gm.db.rpc('campaign_library', { campaign: world.campaignId, packs: [packId] })) as { pack_entry_id: string }[];
    expect(gmLibrary.map((e) => e.pack_entry_id)).toEqual(expect.arrayContaining(['sharper-sorrow', 'heavier-sorrow', 'sharper-fen', 'sharper-all']));
    // The bonus told on a line of it: the patch on that bonus is the players' too (their numbers use it).
    await ok(as(world.gm, tellItem, { line: refOf(sorrow, wren()), fact: 'bonus' }));
    for (const person of [world.playerA, world.playerB]) expect((await patchesFor(person)).library).toContain('sharper-sorrow');
  });

  // Purpose (finding 4): a visible field that says a fact in words (Bonus, Curse) is off the face, for every player
  // read, and comes back with its fact; a field that says none (Glass) stays.
  it('4. a Bonus or Curse field is off the face until its fact is told', async () => {
    const ring = await add(world.playerA, 'glass-ring');
    for (const person of [world.playerA, world.playerB]) {
      const reads = JSON.stringify(await playerReads(person));
      expect(reads).not.toMatch(/\+2 to saves|Brittle in the cold|Green Glass/);
      expect((await lineRow(person, ring.id)).item_data).toMatchObject({ fields: { Glass: 'Sea-green' } });
    }
    await ok(as(world.gm, tellItem, { line: refOf(ring, wren()), fact: 'bonus' }));
    const seen = await lineRow(world.playerB, ring.id);
    expect(seen.item_data).toMatchObject({ fields: { Glass: 'Sea-green', Bonus: '+2 to saves' } });
    expect(JSON.stringify(seen)).not.toContain('Brittle');
  });

  // Purpose (finding 5): the old per-field "Reveal …" button, still on main until K2, tells through the database, so
  // the line records what was told (the player's numbers read it) and copies it from the entry, not the device.
  it('5. the old Reveal of the bonus records it as told', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    await ok(as(world.gm, revealItemField, { line: refOf(ring, wren()), field: 'bonus', value: 'whatever the device says' }));
    const seen = await lineRow(world.playerA, ring.id);
    expect(seen.revealed_fields).toEqual(expect.arrayContaining(['magic', 'bonus']));
    expect(seen.item_data).toMatchObject({ bonus: '+1 to saves' });
  });

  // Purpose (finding 7): the GM undoes a tell, then undoes that Undo: the fact is told again, and the tell's own line is
  // the players' again; both Undo lines stay the GM's.
  it('7. a redone tell’s line is read by the players again', async () => {
    const ring = await add(world.playerA, 'bronze-ring');
    await ok(as(world.gm, tellItem, { line: refOf(ring, wren()), fact: 'cursed' }));
    const tell = (await tellLines(world.gm, ring.id)).find((e) => e.type === 'inventory.tell')!;
    await ok(as(world.gm, undoChange, { campaignId: world.campaignId, eventId: tell.id as string, authorUserId: world.gm.id }));
    const undo = (await tellLines(world.gm, ring.id)).find((e) => e.reverts_event_id === tell.id)!;
    await ok(as(world.gm, undoChange, { campaignId: world.campaignId, eventId: undo.id as string, authorUserId: world.gm.id }));
    for (const person of [world.playerA, world.playerB]) {
      expect((await lineRow(person, ring.id)).item_data).toMatchObject({ cursed: true });
      const log = await tellLines(person, ring.id);
      expect(log.map((e) => e.type)).toContain('inventory.tell');
      expect(log.filter((e) => e.reverts_event_id !== null)).toEqual([]);
    }
    expect((await tellLines(world.gm, ring.id)).filter((e) => e.reverts_event_id !== null)).toHaveLength(2);
  });
});
