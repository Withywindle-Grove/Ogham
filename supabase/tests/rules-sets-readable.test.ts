// Rules sets readable by campaign members (ruled 2026-10-23, pulled forward from M4b into M4 step 4; docs/07).
// TEST project only; invented content. Players' devices get a rules set without its GM-only sections (monsters,
// magicItems, procedures, and any section marked gmOnly: true); the GM gets the whole of it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
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

const SECRET = 'The mire goblins nest under the mill';
const rulesSet = (monsterNote: string) => ({
  id: 'fen-rules',
  name: 'Fen rules',
  encumbrance: { mode: 'coin', coin: { maxLoadCoin: 900, tiers: [{ label: 'Easy', max: 300 }] } },
  monsters: { note: monsterNote },
  magicItems: { charges: { hidden: true }, cursedList: [SECRET] },
  procedures: { ambush: SECRET },
  rumours: { gmOnly: true, list: [SECRET] },
  healing: { perDay: 1 },
});
function readPack(version: string, monsterNote = SECRET) {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Fen Rules', version }, rulesSets: [rulesSet(monsterNote)] }));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const made = await as(world.gm, importPack, { pack: readPack('1') });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const rulesOf = async (person: Person) => ((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).find((e) => e.kind === 'rulesSet');

describe('a rules set in a campaign', () => {
  it('reaches players without its GM-only sections, and the GM whole', async () => {
    const seen = await rulesOf(world.playerA);
    expect(seen?.data).toMatchObject({ encumbrance: { mode: 'coin' }, healing: { perDay: 1 } });
    for (const section of ['monsters', 'procedures', 'rumours']) expect(seen?.data).not.toHaveProperty(section);
    // Only magicItems.charges reaches players (2026-10-23: the switch, the dice, the rechargeable default).
    expect(seen?.data.magicItems).toEqual({ charges: { hidden: true } });
    expect(JSON.stringify(must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId)))).not.toContain(SECRET);
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id').eq('pack_id', packId))).toEqual([]);

    const whole = await rulesOf(world.gm);
    expect(whole?.data).toMatchObject({ monsters: { note: SECRET }, magicItems: { charges: { hidden: true }, cursedList: [SECRET] }, procedures: { ambush: SECRET }, rumours: { gmOnly: true } });
  });

  it("isn't seen by someone outside the campaign", async () => {
    expect(must(await world.outsider.db.from('library_entries').select('id').eq('pack_id', packId))).toEqual([]);
  });

  it("an update that changes only a GM-only section tells players nothing, and tells the GM", async () => {
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: readPack('2', 'Fewer goblins now') })).toMatchObject({ ok: true });
    const lines = must(await world.gm.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const changed = (audience: string) => (lines.find((l) => l.audience === audience)?.after as { changed?: string[] } | undefined)?.changed ?? [];
    expect(changed('all')).toEqual([]);
    expect(changed('gm')).toEqual(['Fen rules']);
    expect(JSON.stringify(await rulesOf(world.playerA))).not.toContain('Fewer goblins');
  });
});
