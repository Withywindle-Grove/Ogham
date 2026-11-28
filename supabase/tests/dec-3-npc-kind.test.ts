// An adventure pack's people (`npcs`) are kept on import as a GM-only kind, `npc` (dec-3, town row W8; migration
// 20261115120000_dec_3_npc_kind.sql). TEST project or CI's local database; invented people. What it checks:
//   * the database takes the kind, and the GM reads each person back, leads and lines included, from the table and
//     through campaign_library;
//   * hidden means hidden: a player of the campaign and an outsider read no npc entry, from the table or through
//     campaign_library, even one whose data says "gmOnly": false;
//   * what a person carries (`holds`, dec5-gaps F, #192; dg-13) is kept on their entry, the GM reads it, and a player
//     never reads it before the GM sends a thing (seam 4).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
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

const NAME = 'Hobb the Lantern Warden';
const SECRET = 'Sold the quay bell to the Bog lurker';
const OPEN_NAME = 'Old Tansy of the reeds';
const HELD_NOTE = 'Wrapped in eel-skin under the bell rope';
const read = () => {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 3,
      meta: { name: 'Brackwater people', version: '0.1', kind: 'adventure' },
      locations: [{ id: 'bh-quay', name: 'The quay', type: 'area' }],
      npcs: [
        {
          id: 'bh-npc-hobb',
          name: NAME,
          role: 'keeper of the quay lamps',
          locationId: 'bh-quay',
          playerView: { description: 'A thin man with a pole and a smoking lamp.' },
          gm: { leads: [{ lead: 'Desires', text: SECRET }], lines: ['"Mind the third step."'] },
          holds: [{ itemId: 'bh-quay-bell-key', qty: 2, note: HELD_NOTE }],
        },
        // A pack can't open a person to players: a table's "gmOnly": false (fs-1) means nothing on a person.
        { id: 'bh-npc-tansy', name: OPEN_NAME, gmOnly: false, gm: { leads: [{ lead: 'Speech', text: 'Hums.' }] } },
      ],
    }),
  );
  if (!result.ok) throw new Error(result.message);
  return result.pack;
};

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const made = await as(world.gm, importPack, { pack: read() });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const fromTable = async (person: Person) => must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId));
const fromLibrary = async (person: Person) => {
  const { data, error } = await person.db.rpc('campaign_library', { campaign: world.campaignId, packs: [packId] });
  if (error) throw new Error(error.message);
  return (data ?? []) as { kind: string; name: string; data: Record<string, unknown> }[];
};

describe('people, a GM-only kind', () => {
  it('are kept, and the GM reads each back with their leads, from the table and the campaign’s library', async () => {
    const table = (await fromTable(world.gm)).filter((e) => e.kind === 'npc');
    expect(table.map((e) => e.name).sort()).toEqual([NAME, OPEN_NAME].sort());
    expect(JSON.stringify(table)).toContain(SECRET);
    // What he carries is kept on his entry as written (#192), for the GM's device.
    expect(table.find((e) => e.name === NAME)?.data.holds).toEqual([{ itemId: 'bh-quay-bell-key', qty: 2, note: HELD_NOTE }]);
    const library = (await fromLibrary(world.gm)).filter((e) => e.kind === 'npc');
    expect(library.map((e) => e.name).sort()).toEqual([NAME, OPEN_NAME].sort());
  });

  it('never reach a player of the campaign, nor an outsider, from the table or the campaign’s library', async () => {
    for (const person of [world.playerA, world.outsider]) {
      for (const rows of [await fromTable(person), await fromLibrary(person)]) {
        expect(rows.filter((e) => e.kind === 'npc')).toEqual([]);
        const raw = JSON.stringify(rows);
        expect(raw).not.toContain(NAME);
        expect(raw).not.toContain(OPEN_NAME);
        expect(raw).not.toContain(SECRET);
        // Nothing of what he carries, before the GM sends it (dg-13).
        expect(raw).not.toContain(HELD_NOTE);
        expect(raw).not.toContain('bh-quay-bell-key');
      }
    }
  });
});
