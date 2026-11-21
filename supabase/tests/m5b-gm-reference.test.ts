// The GM reference panels are the GM's (ruled 2026-11-01, M5 gate B4; docs/07 `gmReference`, G-45). TEST project
// only; invented content. A rules set's `gmReference` (and one inside an optional rule's override) never reaches a
// player's device; the GM gets it whole; the rest of the rules set still reaches players.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
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

const SECRET = 'The heron feast hides the smugglers';
const OVERRIDE_SECRET = 'At high tide the crypt door opens';
const panel = (text: string) => [{ id: 'saints', title: "Saints' days", entries: [{ heading: 'Feast of the Heron', text }] }];

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Heron Rules', version: '1' },
      rulesSets: [
        {
          id: 'heron-rules',
          name: 'Heron rules',
          initiative: { note: 'Each side rolls.' },
          gmReference: panel(SECRET),
          byOption: { 'tides=on': { gmReference: panel(OVERRIDE_SECRET), initiative: { note: 'Tides first.' } } },
        },
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

const rulesOf = async (person: Person) => ((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).find((e) => e.kind === 'rulesSet');

describe('a rules set’s GM reference panels', () => {
  it('never reach a player’s device, in the rules set or in an optional rule’s override; the rest still does', async () => {
    const seen = await rulesOf(world.playerA);
    expect(seen?.data).toMatchObject({ initiative: { note: 'Each side rolls.' } });
    expect(seen?.data).not.toHaveProperty('gmReference');
    expect(seen?.data.byOption).toEqual({ 'tides=on': { initiative: { note: 'Tides first.' } } });
    const raw = JSON.stringify(must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId)));
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain(OVERRIDE_SECRET);
  });

  it('reach the GM whole', async () => {
    const whole = await rulesOf(world.gm);
    expect(whole?.data.gmReference).toEqual(panel(SECRET));
    expect(whole?.data.byOption).toMatchObject({ 'tides=on': { gmReference: panel(OVERRIDE_SECRET) } });
  });
});
