// An adventure pack's maps (`images` of type `map`) are kept on import as a GM-only kind, `map` (dec-7 piece 5m-1;
// docs/plans/dec-7-5-place-page-and-map.md; 07 Adventure packs §9; migration 20261114200000). TEST project or CI's
// local database; invented content. What it checks:
//   * the database takes the kind, and the GM reads each map entry back: its file, title, alt and places;
//   * a player in the campaign never receives a map entry, nor an outsider (maps aren't player-facing);
//   * the pack's update line for players doesn't name a changed map; the GM's does.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { readStoredMap } from '../../src/modules/library/packMaps.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const SECRET_ALT = 'Plan of the eel cellar with the hidden sluice door';
const read = (title = 'Mire Tower, cellar') => {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Mire Tower Maps', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'mt-tower', name: 'Mire Tower', type: 'site' },
        { id: 'mt-cellar', name: 'The eel cellar', type: 'floor', parentId: 'mt-tower' },
      ],
      images: [
        { id: 'mt-map-cellar', file: 'maps/mt-cellar.webp', type: 'map', title, alt: SECRET_ALT, visibility: 'gm', playerVersionId: null, locationIds: ['mt-cellar'], source: 'p. 4' },
        { id: 'mt-art-heron', file: 'art/heron.webp', type: 'art', title: 'A heron', alt: 'A grey heron on a post', locationIds: [] },
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

const mapsOf = async (person: Person) => ((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).filter((e) => e.packId === packId && e.kind === 'map');

describe('maps, a GM-only kind', () => {
  it('are kept (maps only), and the GM reads each back: file, title, alt and places', async () => {
    const maps = await mapsOf(world.gm);
    expect(maps.map((e) => readStoredMap(e))).toEqual([
      { id: 'mt-map-cellar', file: 'maps/mt-cellar.webp', title: 'Mire Tower, cellar', alt: SECRET_ALT, locationIds: ['mt-cellar'], source: 'p. 4' },
    ]);
  });

  it('never reach a player in the campaign, nor an outsider', async () => {
    expect(await mapsOf(world.playerA)).toEqual([]);
    for (const person of [world.playerA, world.outsider]) {
      const raw = JSON.stringify(must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId)));
      expect(raw).not.toContain('mt-map-');
      expect(raw).not.toContain(SECRET_ALT);
    }
  });

  it('a changed map is on the GM’s update line, not the players’', async () => {
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read('Mire Tower, flooded cellar') })).toMatchObject({ ok: true });
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    expect(JSON.stringify(lines.find((line) => line.audience === 'all')?.after ?? {})).not.toContain('flooded cellar');
    expect(JSON.stringify(lines.find((line) => line.audience === 'gm')?.after ?? {})).toContain('flooded cellar');
  });
});
