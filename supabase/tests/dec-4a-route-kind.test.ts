// An adventure pack's `routes` are kept on import as a GM-only kind, `route` (December step 4, piece a;
// docs/plans/dec-4-point-travel.md; ruled pt-f1 and pt-f3, 2026-11-11; migration 20261111140000). TEST project or CI's
// local database; invented content. What it checks:
//   * the database takes the kind, and the GM reads every route back whole, both shapes of `travel`, hidden ones too;
//   * a player in the campaign never receives a route, hidden or not (routes aren't player-facing), nor an outsider;
//   * the pack's update line for players doesn't name a changed route; an Update with the same file keeps them.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { readRoute } from '../../src/modules/library/routes.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const SECRET_NOTE = 'The eel-way floods at the turn of the tide';
const read = (swimTurns = 3) => {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Mire Tower', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'mt-jetty', name: 'The jetty', type: 'area' },
        { id: 'mt-islet', name: 'The reed islet', type: 'area' },
        { id: 'mt-sluice', name: 'The sluice', type: 'room' },
      ],
      routes: [
        {
          id: 'mt-route-jetty-islet', from: 'mt-jetty', to: 'mt-islet', type: 'river', hidden: false, oneWay: false,
          travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: swimTurns, unit: 'turn' }],
        },
        { id: 'mt-route-islet-sluice', from: 'mt-islet', to: 'mt-sluice', type: 'secret', hidden: true, oneWay: true, travel: { value: 2, unit: 'turn' }, notes: SECRET_NOTE },
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

const routesOf = async (person: Person) => ((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).filter((e) => e.packId === packId && e.kind === 'route');

describe('routes, a GM-only kind', () => {
  it('are kept, and the GM reads them back whole: both shapes of travel, the hidden one too', async () => {
    const routes = (await routesOf(world.gm)).sort((a, b) => a.packEntryId.localeCompare(b.packEntryId));
    expect(routes.map((e) => readRoute(e.packEntryId, e.data))).toEqual([
      { id: 'mt-route-islet-sluice', from: 'mt-islet', to: 'mt-sluice', hidden: true, oneWay: true, ways: [{ by: '', name: '', value: 2, unit: 'turn' }] },
      { id: 'mt-route-jetty-islet', from: 'mt-jetty', to: 'mt-islet', hidden: false, oneWay: false, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }] },
    ]);
  });

  it('never reach a player in the campaign, hidden or not, nor an outsider', async () => {
    expect(await routesOf(world.playerA)).toEqual([]);
    for (const person of [world.playerA, world.outsider]) {
      const raw = JSON.stringify(must(await person.db.from('library_entries').select('kind, pack_entry_id, data').eq('pack_id', packId)));
      expect(raw).not.toContain('mt-route-');
      expect(raw).not.toContain(SECRET_NOTE);
    }
  });

  it('a changed route is on the GM’s update line, not the players’; an Update with the same file keeps them all', async () => {
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read(4) })).toMatchObject({ ok: true });
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    const forPlayers = JSON.stringify(lines.find((line) => line.audience === 'all')?.after ?? {});
    expect(forPlayers).not.toContain('mt-route-jetty-islet');
    expect(JSON.stringify(lines.find((line) => line.audience === 'gm')?.after ?? {})).toContain('mt-route-jetty-islet');

    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read(4) })).toMatchObject({ ok: true });
    expect((await routesOf(world.gm)).map((e) => e.packEntryId).sort()).toEqual(['mt-route-islet-sluice', 'mt-route-jetty-islet']);
  });
});
