// A pack table players may read (M5b step 0c, follow-up to slice 4; design/rulings/m5b-0c-first-spells-table-2026-11-02.md
// fs-1; docs/03 permission matrix; supabase/migrations/20261102260000_m5b_0c_tables_players_read.sql). TEST project
// only; invented content.
//   A table marked `"gmOnly": false` (a class's starting-spell table) is read by every campaign member, rows and all;
//   a table without the flag stays the GM's; an outsider reads neither. Hidden means hidden: checked as a player.
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

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen Rules', version: '1' },
      spells: [{ id: 'reed-whisper', name: 'Reed whisper', lists: { 'witch-list': 1 } }],
      tables: [
        {
          id: 'first-whispers',
          name: 'First whispers',
          die: 'd2',
          gmOnly: false,
          rows: [
            { min: 1, max: 1, result: 'Reed whisper', spells: ['reed-whisper'] },
            { min: 2, max: 2, result: 'Nothing yet', spells: [] },
          ],
        },
        { id: 'bog-encounters', name: 'Bog encounters', die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurker' }] },
        { id: 'said-true', name: 'Said true', die: 'd6', gmOnly: true, rows: [] },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const tablesSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', packId).eq('kind', 'table')).sort((a, b) =>
    String(a.pack_entry_id).localeCompare(String(b.pack_entry_id)),
  );

describe('who reads a pack table marked gmOnly: false', () => {
  it('a player reads the opened table with its rows, and no other table', async () => {
    const seen = await tablesSeenBy(world.playerA);
    expect(seen.map((t) => t.pack_entry_id)).toEqual(['first-whispers']);
    const data = seen[0]!.data as { gmOnly?: unknown; rows?: { spells?: string[] }[] };
    expect(data.gmOnly).toBe(false);
    expect(data.rows?.map((r) => r.spells)).toEqual([['reed-whisper'], []]);
  });

  it('the GM reads every table; an outsider reads none', async () => {
    expect((await tablesSeenBy(world.gm)).map((t) => t.pack_entry_id)).toEqual(['bog-encounters', 'first-whispers', 'said-true']);
    expect(await tablesSeenBy(world.outsider)).toEqual([]);
  });

  it('a table with `gmOnly: true` written out stays the GM’s, like one with nothing', async () => {
    const seen = await tablesSeenBy(world.playerA);
    expect(seen.some((t) => t.pack_entry_id === 'said-true')).toBe(false);
  });
});
