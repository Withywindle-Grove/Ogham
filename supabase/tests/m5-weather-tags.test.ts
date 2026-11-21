// Players see weather effects; the weather table stays the GM's (ruled 2026-10-30, D1;
// supabase/migrations/20261030220000_m5_weather_tags_readable.sql, which reverses 20261030160000_m5_weather_tags.sql).
// TEST project only; invented content.
//   A player reads a rules set's weather with its tags (names, budget changes, notes, warnings); a mode's own weather
//   and an optional rule's override the same. A player never reads the weather tables themselves. The GM reads all.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack, loadPackEntries } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const tags = { mired: { name: 'Mired', budget: -2 }, fog: { name: 'Fog', warn: 'Hard to keep your bearings' } };

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen weather', version: '1' },
      rulesSets: [
        {
          id: 'fen-weather',
          name: 'Fen weather',
          seasons: [{ id: 'spring', name: 'Spring' }],
          weather: { tables: { spring: 'spring-weather' }, tags },
          exploration: {
            modes: [
              { id: 'delve', name: 'Delve', step: { value: 1, unit: 'turn' } },
              { id: 'reedway', name: 'Reedway', step: { value: 1, unit: 'day' }, weather: { tables: { any: 'reed-weather' }, tags: { squall: { name: 'Squall', budget: -1 } } } },
            ],
          },
          byOption: { 'wet-fens': { weather: { tables: { any: 'wet-weather' }, tags: { drench: { name: 'Drench', note: 'Fires go out' } } } } },
        },
      ],
      tables: [
        { id: 'spring-weather', name: 'Spring weather', die: 'd6', rows: [] },
        { id: 'reed-weather', name: 'Reed weather', die: 'd6', rows: [] },
        { id: 'wet-weather', name: 'Wet weather', die: 'd6', rows: [] },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  if (!attached.ok) throw new Error(attached.message);
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

describe("players see weather effects; the weather table stays the GM's (D1)", () => {
  it("a player reads the rules set's weather, a mode's weather and an override's weather with their tags", async () => {
    const [row] = must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId).eq('kind', 'rulesSet'));
    const data = row!.data as Record<string, unknown>;
    expect(data.weather).toEqual({ tables: { spring: 'spring-weather' }, tags });
    const modes = (data.exploration as { modes: Record<string, unknown>[] }).modes;
    expect(modes.map((m) => m.id)).toEqual(['delve', 'reedway']);
    expect(modes[1]!.weather).toEqual({ tables: { any: 'reed-weather' }, tags: { squall: { name: 'Squall', budget: -1 } } });
    expect((data.byOption as Record<string, Record<string, unknown>>)['wet-fens']!.weather).toEqual({
      tables: { any: 'wet-weather' },
      tags: { drench: { name: 'Drench', note: 'Fires go out' } },
    });
  });

  it('a player never reads the weather tables themselves', async () => {
    const tablesSeen = must(await world.playerA.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'table'));
    expect(tablesSeen).toEqual([]);
    const kinds = must(await world.playerA.db.from('library_entries').select('kind').eq('pack_id', packId)).map((r) => r.kind as string);
    expect(kinds).toEqual(['rulesSet']);
  });

  it('the GM reads every weather tag and every weather table', async () => {
    const whole = await loadPackEntries(asDb(world.gm), packId);
    const data = whole?.find((e) => e.kind === 'rulesSet')?.data as Record<string, unknown>;
    expect(data.weather).toEqual({ tables: { spring: 'spring-weather' }, tags });
    expect((data.exploration as { modes: Record<string, unknown>[] }).modes[1]!.weather).toMatchObject({ tags: { squall: { name: 'Squall', budget: -1 } } });
    expect((data.byOption as Record<string, Record<string, unknown>>)['wet-fens']!.weather).toMatchObject({ tags: { drench: { name: 'Drench' } } });
    const gmTables = must(await world.gm.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'table'));
    expect(gmTables.map((t) => t.pack_entry_id as string).sort()).toEqual(['reed-weather', 'spring-weather', 'wet-weather']);
  });
});
