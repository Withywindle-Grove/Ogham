// A rumours table is the GM's alone, whatever its pack says (dec-12 E follow-up; rm-3, Francis's yes of 2026-11-14;
// migration 20261115002000), and a given rumour is named "A rumour" (rm-2; migration 20261115001000). TEST project or
// CI's local database; invented content. What it checks, as players and as the GM:
//   1. a rumours table its pack marks open ("gmOnly": false), imported through the database's own import (not the
//      app's check, which refuses it), reaches no player: not through campaign_library, not through a direct read;
//   2. the GM still reads it whole;
//   3. an ordinary open table (not rumours) is still read by a player;
//   4. a given rumour's words still reach its hearer through hook_sends, named "A rumour", and nothing else of the table;
//   5. a player in another campaign reads nothing;
//   (a) a player who isn't the hearer gets none of a rumour given to someone else's character;
//   (b) a rumour given to the party reaches every player;
//   (c) the hide holds for every shape private.is_rumours_table reads: `uses` a list or a string, `use` a string or a
//       list, and `"kind": "rumours"`;
//   (d) the weather die and the GM's table pins and reads, called against a rumours table, give a player nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { giveRumour } from '../../src/modules/library/rumours.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const COG = 'The cog went down with her captain still aboard';
const LIGHT = 'There is a light in the shed some nights';
const NOTE = 'The captain walks the bar as a Bog lurker now';
const TABLE_NAME = 'What they say on the quay';
const NAMES = 'Marda, Tam, Osric';
const rows = [
  { min: 1, max: 1, result: COG, truth: 'true', note: NOTE },
  { min: 2, max: 2, result: LIGHT, truth: 'partial', note: NOTE },
];
// Every shape private.is_rumours_table reads (c), each marked open by its pack.
const SHAPES: Record<string, Record<string, unknown>> = {
  'ew-rumours-uses-list': { uses: ['world.rumours'] },
  'ew-rumours-uses-string': { uses: 'world.rumours' },
  'ew-rumours-use-string': { use: 'world.rumours' },
  'ew-rumours-use-list': { use: ['world.rumours'] },
  'ew-rumours-kind': { kind: 'rumours' },
};
const RUMOURS = 'ew-rumours-uses-list';

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  // Through the database's own import, as a pack the app's check would refuse could reach it.
  const made = await world.gm.db.rpc('import_pack', {
    meta: { name: 'The eel weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
    entries: [
      ...Object.entries(SHAPES).map(([id, shape]) => ({ kind: 'table', pack_entry_id: id, name: TABLE_NAME, data: { ...shape, gmOnly: false, die: 'd4', rows } })),
      { kind: 'table', pack_entry_id: 'ew-quay-names', name: 'Quay names', data: { uses: ['people.names'], gmOnly: false, die: 'd4', rows: [{ min: 1, max: 4, result: NAMES }] } },
    ],
    replace_pack_id: null,
  });
  if (made.error) throw made.error;
  packId = made.data as string;
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority: 50 }).select());
  // The outsider is a player in another campaign (5).
  must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.outsider.id, base_role: 'player' }).select());
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const directAs = async (person: Person) => must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId));
const libraryAs = async (person: Person, campaign = world.campaignId) => {
  const { data, error } = await person.db.rpc('campaign_library', { campaign });
  if (error) return [];
  return ((data ?? []) as { pack_id: string; pack_entry_id: string; data: unknown }[]).filter((e) => e.pack_id === packId);
};
const givesAs = async (person: Person) => must(await person.db.from('hook_sends').select('*').eq('campaign_id', world.campaignId).eq('kind', 'rumour'));
const noTable = (payload: string) => {
  expect(payload).not.toContain(COG);
  expect(payload).not.toContain(NOTE);
  expect(payload).not.toContain('partial');
  expect(payload).not.toContain(TABLE_NAME);
};

describe('a rumours table marked open is still the GM\'s (rm-3)', () => {
  // Purpose (1, c): no player reads a rumours table its pack marks open, in any shape, by either read: no row, no
  // words, no truth, no note.
  it('reaches no player through campaign_library or a direct read, in every shape', async () => {
    for (const person of [world.playerA, world.playerB]) {
      const direct = await directAs(person);
      const library = await libraryAs(person);
      for (const id of Object.keys(SHAPES)) {
        expect(direct.map((e) => e.pack_entry_id)).not.toContain(id);
        expect(library.map((e) => e.pack_entry_id)).not.toContain(id);
      }
      noTable(JSON.stringify(direct));
      noTable(JSON.stringify(library));
    }
  });

  // Purpose (2): the GM still reads every one of them whole, truth and note included.
  it('is read whole by the GM', async () => {
    const library = await libraryAs(world.gm);
    for (const id of Object.keys(SHAPES)) expect(library.map((e) => e.pack_entry_id)).toContain(id);
    const one = library.find((e) => e.pack_entry_id === RUMOURS)!;
    expect(JSON.stringify(one.data)).toContain(NOTE);
    expect(JSON.stringify(one.data)).toContain('partial');
  });

  // Purpose (3): an ordinary table its pack marks open is still every player's, by both reads, as today.
  it('leaves an ordinary open table readable by players', async () => {
    for (const person of [world.playerA, world.playerB]) {
      expect((await directAs(person)).map((e) => e.pack_entry_id)).toEqual(['ew-quay-names']);
      expect((await libraryAs(person)).map((e) => e.pack_entry_id)).toEqual(['ew-quay-names']);
    }
  });

  // Purpose (5): a player in another campaign reads nothing of the pack.
  it('gives a player in another campaign nothing', async () => {
    expect(await directAs(world.outsider)).toEqual([]);
    expect(await libraryAs(world.outsider)).toEqual([]);
    expect(await libraryAs(world.outsider, world.otherCampaignId)).toEqual([]);
  });
});

describe('a given rumour, as its words only and named "A rumour" (rm-1, rm-2)', () => {
  // Purpose (b, 4): a rumour given to the party reaches every player as "A rumour" and its words, and nothing else
  // of the table (not its name, truth or note).
  it('given to the party, reaches every player as "A rumour" and its words only', async () => {
    expect(await as(world.gm, giveRumour, { campaignId: world.campaignId, packId, tableId: RUMOURS, min: 2, max: 2, actorId: null })).toMatchObject({ ok: true });
    for (const person of [world.playerA, world.playerB]) {
      const rows = await givesAs(person);
      expect(rows.map((r) => [r.name, r.body])).toEqual([['A rumour', LIGHT]]);
      expect(JSON.stringify(rows)).not.toContain(TABLE_NAME);
      expect(JSON.stringify(rows)).not.toContain(NOTE);
      expect(JSON.stringify(rows)).not.toContain('partial');
    }
  });

  // Purpose (4, a): a rumour given to one character reaches that character's player, its words only; the other
  // player gets none of it, not its row nor its log line.
  it("given to one character, reaches that player alone; the other player gets none of it", async () => {
    expect(await as(world.gm, giveRumour, { campaignId: world.campaignId, packId, tableId: RUMOURS, min: 1, max: 1, actorId: world.ashId })).toMatchObject({ ok: true });
    const hearer = (await givesAs(world.playerB)).filter((r) => r.actor_id === world.ashId);
    expect(hearer.map((r) => [r.name, r.body])).toEqual([['A rumour', COG]]);
    const other = await givesAs(world.playerA);
    expect(JSON.stringify(other)).not.toContain(COG);
    const lines = JSON.stringify(must(await world.playerA.db.from('events').select('before, after').eq('campaign_id', world.campaignId).eq('target_table', 'hook_sends')));
    expect(lines).not.toContain(COG);
    expect(lines).not.toContain(TABLE_NAME);
  });
});

describe('the other paths that read a table, called against a rumours table (d)', () => {
  // Purpose (d): the weather die names nothing for a rumours table (it isn't one of the setting's weather tables), and
  // a player can neither pin a rumours table nor read one of its rows by hand (the GM's alone).
  it('give a player nothing', async () => {
    const die = await world.playerA.db.rpc('weather_die', { campaign: world.campaignId, table_id: RUMOURS });
    expect(die.error).toBeNull();
    expect(die.data).toBeNull();
    const pin = await world.playerA.db.rpc('pin_table', { campaign: world.campaignId, table_id: RUMOURS });
    expect(pin.error?.code).toBe('42501');
    const read = await world.playerA.db.rpc('read_table_by_hand', { campaign: world.campaignId, table_id: RUMOURS, roll: '1', row_text: COG });
    expect(read.error).not.toBeNull();
    noTable(JSON.stringify([die, pin, read].map((r) => r.data)));
  });
});
