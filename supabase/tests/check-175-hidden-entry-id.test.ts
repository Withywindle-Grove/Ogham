// Ticket #175 (Ogham), as ruled at loop 5 (l5-6, Francis "A", 2026-11-28; docs/09, Standing rulings, "Named exception
// to hidden data"): an unidentified item's pack entry id STAYS on players' devices (its line, its copy of the item, the
// party's library, the events, the log); the app never shows it, and the pack gives the item an id that hints at nothing
// (`pack:check` warns on one that does; that rule's own cases are in scripts/pack-ruled-fields.test.mjs). The face is
// K22's (supabase/migrations/20261122100000_k22_unidentified_face.sql). Tests on what the database sends a player's
// device, never on what a screen draws. TEST project only; invented names (the Lantern of the bog warden, id "qz-118").
//
// Purposes, one sentence each:
// - The id reaches both players, the one who holds the item and the one who does not, in exactly the five reads the
//   ruling names: the line (source_entry_id and the face's item_data.id), the party's library (packEntryId and data.id),
//   the events (an add's after, and the copy kept in a remove's before when the line leaves play) and the log.
// - The fixture's id hints at nothing (no word of the item's true name is in it), so the reads test a well-formed pack;
//   the real guard is pack:check's rule.
// - What the ruling does not open stays closed: the face reads "Dented lantern", unidentified; a plain select on
//   library_entries and library_entry_secrets, and a pack update's line, give a player nothing of the id.
// Control: the GM reads the id on the line and in the library.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadLog } from '../../src/core/events.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, removeItem, type CarrierRef, type InventoryLine } from '../../src/modules/inventory/inventory.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
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

const ENTRY_ID = 'qz-118';
const LANTERN = {
  id: ENTRY_ID,
  name: 'Lantern of the bog warden',
  category: 'odd-lamp',
  appearsAs: 'Dented lantern',
  noticed: 'The glass fogs when no one breathes on it.',
  weightCoin: 30,
};
function packFile(version: string, weightCoin: number) {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fenreach Oddments', version },
      rulesSets: [{ id: 'fen-rules', name: 'Fen rules', itemCategories: [{ id: 'odd-lamp', name: 'Odd lamps', singular: 'Lamp', unidentified: true }] }],
      items: [{ ...LANTERN, weightCoin }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

let packId = '';
let entryUuid = '';
let held: InventoryLine;
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
/** Player A holds the lantern (Wren); player B (Ash) does not. */
const players = () => [
  { who: 'player A, who holds it', person: world.playerA },
  { who: 'player B, who does not', person: world.playerB },
];
/** Every path in a read that holds the id (so a failure names the place): [] when nothing names it. */
function leaks(value: unknown, at = '$'): string[] {
  if (typeof value === 'string') return value.includes(ENTRY_ID) ? [at] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaks(v, `${at}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(k.includes(ENTRY_ID) ? [`${at} (key ${k})`] : []), ...leaks(v, `${at}.${k}`)]);
  }
  return [];
}

beforeAll(async () => {
  world = await buildWorld();
  packId = await ok(as(world.gm, importPack, { pack: packFile('1', 30) }));
  await ok(as(world.gm, attachPack, { campaignId: world.campaignId, packId }));
  entryUuid = must(await world.gm.db.from('library_entries').select('id').eq('pack_id', packId).eq('pack_entry_id', ENTRY_ID).single()).id as string;
  const item = { libraryEntryId: entryUuid, name: 'Whatever the device says', category: 'junk', weightCoin: null, slots: null, stack: 1 };
  held = await ok(as(world.gm, addItem, { carrier: wren(), item, qty: 1, howGot: 'found' }));
  // A second lantern leaves play, so the log keeps a copy of its line.
  const dropped = await ok(as(world.gm, addItem, { carrier: wren(), item, qty: 1, howGot: 'found' }));
  if (dropped.id === held.id) throw new Error('The second lantern stacked onto the first line, so no line can leave play.');
  await ok(as(world.playerA, removeItem, { line: { id: dropped.id, carrier: wren() }, qty: 1, of: 1 }));
  // A pack update that changes the lantern writes the update's line in the campaign's log.
  await ok(as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: packFile('2', 40) }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('#175: an unidentified item’s pack entry id reaches players and hints at nothing (l5-6)', () => {
  it('control: the GM reads the id on the line and in the library', async () => {
    const line = must(await world.gm.db.from('inventory_lines').select('*').eq('id', held.id).single());
    expect(line.source_entry_id).toBe(ENTRY_ID);
    const library = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    expect(library.some((e) => e.packEntryId === ENTRY_ID)).toBe(true);
  });

  it('the fixture’s id hints at nothing, so the reads below test a well-formed pack (the guard is pack:check)', () => {
    const id = ENTRY_ID.toLowerCase();
    const words = LANTERN.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
    expect(words.length).toBeGreaterThan(0);
    expect(words.filter((word) => id.includes(word))).toEqual([]);
  });

  it('the face holds: both players read the line as "Dented lantern", unidentified', async () => {
    for (const { person } of players()) {
      const line = must(await person.db.from('inventory_lines').select('name, identified').eq('id', held.id).single());
      expect(line).toEqual({ name: 'Dented lantern', identified: false });
    }
  });

  // Under l5-6 each of the five reads below is where the id is meant to be, for both players. A test here turning red means the id has gone from a place the app may rely on (stacking, knowledge).

  // private.copy_item_details() sets source_entry_id from the entry for every line, unidentified or not.
  it('inventory_lines: the line’s source_entry_id is the id', async () => {
    for (const { who, person } of players()) {
      const line = must(await person.db.from('inventory_lines').select('*').eq('id', held.id).single());
      expect(line.source_entry_id, who).toBe(ENTRY_ID);
      expect(leaks(line).sort(), who).toEqual(['$.item_data.id', '$.source_entry_id']);
    }
  });

  // The face (private.item_face_data) keeps the entry's own "id" key.
  it('inventory_lines: the face’s item_data.id is the id', async () => {
    for (const { who, person } of players()) {
      const line = must(await person.db.from('inventory_lines').select('item_data').eq('id', held.id).single());
      expect((line.item_data as { id?: unknown } | null)?.id, who).toBe(ENTRY_ID);
      expect(leaks(line.item_data), who).toEqual(['$.id']);
    }
  });

  // public.campaign_library returns the entry's face with its pack_entry_id (packEntryId in the app) and data.id. Player B
  // gets the entry too: the party knows the item.
  it('campaign_library: the party’s library entry carries the id, under its face', async () => {
    for (const { who, person } of players()) {
      const library = (await loadCampaignEntries(asDb(person), world.campaignId)) ?? [];
      const lantern = library.find((e) => e.name === 'Dented lantern');
      expect(lantern?.packEntryId, who).toBe(ENTRY_ID);
      expect(leaks(lantern), who).toEqual(['$.packEntryId', '$.data.id']);
    }
  });

  // An add's after holds the whole line, and so does the copy the log keeps in a remove's before when a line leaves play.
  it('events: the adds and the kept copy of a line that left play carry the id', async () => {
    for (const { who, person } of players()) {
      const events = must(await person.db.from('events').select('*').eq('campaign_id', world.campaignId));
      const adds = events.filter((e) => e.type === 'inventory.add');
      const removes = events.filter((e) => e.type === 'inventory.remove');
      expect(adds.length, who).toBe(2);
      expect(removes.length, who).toBe(1);
      for (const add of adds) expect(leaks(add.after), who).toEqual(['$.item_data.id', '$.source_entry_id']);
      expect(leaks(removes[0].before), who).toEqual(['$.item_data.id', '$.source_entry_id']);
      // Nothing else in the events names it.
      expect(leaks(events.filter((e) => e.type !== 'inventory.add' && e.type !== 'inventory.remove')), who).toEqual([]);
    }
  });

  it('the log: the log pages a player loads carry the id in the same events', async () => {
    for (const { who, person } of players()) {
      const page = await loadLog(asDb(person), world.campaignId, { verbose: true });
      const found = leaks(page);
      expect(found.length, who).toBe(6);
      expect(found.every((at) => /^\$\.events\[\d+\]\.(after|before)\.(item_data\.id|source_entry_id)$/.test(at)), `${who}: ${found.join(', ')}`).toBe(true);
    }
  });

  it('library_entries and library_entry_secrets: a plain select gets nothing of it', async () => {
    for (const { who, person } of players()) {
      const plain = must(await person.db.from('library_entries').select('*').eq('pack_id', packId));
      expect(leaks(plain), who).toEqual([]);
      const secrets = must(await person.db.from('library_entry_secrets').select('*').eq('pack_id', packId));
      expect(leaks(secrets), who).toEqual([]);
    }
  });

  it('a pack update’s line: the line a player reads does not name it', async () => {
    // The update did write its line (the GM reads it), so the players' search below looked at something real.
    expect(must(await world.gm.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'library.update')).length).toBeGreaterThan(0);
    for (const { who, person } of players()) {
      const lines = must(await person.db.from('events').select('*').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
      expect(leaks(lines), who).toEqual([]);
    }
  });
});
