// Ticket #175 (Ogham): a player never receives an unidentified item's pack entry id (hard rule 5, hidden means hidden,
// held by the database; the face is K22's, supabase/migrations/20261122100000_k22_unidentified_face.sql). Tests on what
// the database sends a player's device, never on what a screen draws. TEST project only; invented names (the Lantern of
// the bog warden, whose pack entry id "qz-118" carries no hint of it).
//
// Purpose, one sentence: a player who holds an unidentified item, and a player in the same campaign who does not, can
// read no pack entry id of that item through any table, function or event a player may read: the inventory line (its
// source_entry_id and its item_data), the campaign's library, a plain select on library_entries, library_entry_secrets,
// the events and the log (a line's copy kept when it leaves play included), and a pack update's line.
// Control: the GM reads the id in the same places, so a search that finds nothing for a player really looked.
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
/** Every path in a read that holds the id (so a failure says where): [] when nothing names it. */
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
  if (dropped.id !== held.id) await ok(as(world.playerA, removeItem, { line: { id: dropped.id, carrier: wren() }, qty: 1, of: 1 }));
  // A pack update that changes the lantern writes the update's line in the campaign's log.
  await ok(as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: packFile('2', 40) }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe('#175: an unidentified item’s pack entry id never reaches a player', () => {
  it('control: the GM reads the id on the line and in the library', async () => {
    const line = must(await world.gm.db.from('inventory_lines').select('*').eq('id', held.id).single());
    expect(line.source_entry_id).toBe(ENTRY_ID);
    const library = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    expect(library.some((e) => e.packEntryId === ENTRY_ID)).toBe(true);
  });

  it('the face holds: both players read the line as "Dented lantern", unidentified', async () => {
    for (const { person } of players()) {
      const line = must(await person.db.from('inventory_lines').select('name, identified').eq('id', held.id).single());
      expect(line).toEqual({ name: 'Dented lantern', identified: false });
    }
  });

  // The five `it.fails` below are what this test found on 27 Nov; each LEAKS to both players (the holder and the other).
  // They are not fixed here: the fix needs a design ruling on hidden data (docs/09, Standing rulings), then a migration.
  // Each turns red, to be made a plain `it`, once the leak it names is closed.

  // LEAKS: inventory_lines.source_entry_id is the pack entry id ("qz-118"). private.copy_item_details() sets it from the
  // entry for every line, unidentified or not, and a member's read of inventory_lines returns the column.
  it.fails('inventory_lines: no source_entry_id (or anything else of a line) names it', async () => {
    for (const { who, person } of players()) {
      const lines = must(await person.db.from('inventory_lines').select('*').eq('campaign_id', world.campaignId));
      expect(lines.length, who).toBeGreaterThan(0);
      expect(lines.map((l) => l.source_entry_id).filter((id) => id === ENTRY_ID), who).toEqual([]);
      expect(leaks(lines), who).toEqual([]);
    }
  });

  // LEAKS: inventory_lines.item_data.id. The face (private.item_face_data) keeps the entry's own "id" key.
  it.fails('inventory_lines: the face’s item_data does not name it', async () => {
    for (const { who, person } of players()) {
      const lines = must(await person.db.from('inventory_lines').select('item_data').eq('campaign_id', world.campaignId));
      expect(leaks(lines), who).toEqual([]);
    }
  });

  // LEAKS: public.campaign_library returns the entry's face, but its pack_entry_id column (packEntryId in the app)
  // unchanged, and the face's data keeps the "id" key (data.id). Player B gets the entry too: the party knows the item.
  it.fails('campaign_library: the campaign’s library does not name it', async () => {
    for (const { who, person } of players()) {
      const library = (await loadCampaignEntries(asDb(person), world.campaignId)) ?? [];
      expect(library.some((e) => e.name === 'Dented lantern'), who).toBe(true);
      expect(leaks(library), who).toEqual([]);
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

  // LEAKS: events.after (the add's lines) and events.before (the copy the log keeps of the line that left play) carry the
  // whole line: its source_entry_id and item_data.id.
  it.fails('events: no event a player reads (a kept copy of a line that left play included) names it', async () => {
    for (const { who, person } of players()) {
      const events = must(await person.db.from('events').select('*').eq('campaign_id', world.campaignId));
      expect(events.length, who).toBeGreaterThan(0);
      expect(leaks(events), who).toEqual([]);
    }
  });

  // LEAKS: the same events, through the app's own log read (loadLog, verbose): after/before.source_entry_id and item_data.id.
  it.fails('the log: the log pages a player loads do not name it', async () => {
    for (const { who, person } of players()) {
      expect(leaks(await loadLog(asDb(person), world.campaignId, { verbose: true })), who).toEqual([]);
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
