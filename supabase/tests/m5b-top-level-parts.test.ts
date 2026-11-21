// A pack's top-level `gmReference` (07 G-55) and its `locations` (07 G-58) are kept on import as two GM-only kinds
// (ruled A by Francis, 2026-11-03; migration 20261103150000). TEST project only; invented content. What it checks:
//   * the database takes both kinds, and the GM reads them back whole;
//   * a player in the campaign never receives either (neither kind is player-facing), while the pack's class still
//     reaches them;
//   * an Update with the same file keeps both.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { buildReference } from '../../src/modules/library/gmReference.ts';
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

const PANEL_SECRET = 'A warden’s wick burns blue near bog lurkers';
const PLACE_SECRET = 'The keeper fences stolen lanterns';
const read = () => {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Lantern Wardens', version: '0.1', kind: 'homebrew', requires: [{ packId: 'fen-rules' }] },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6' }],
      gmReference: [{ id: 'lantern-lore', title: 'Lantern lore', entries: [{ heading: 'Wick of the Warden', text: PANEL_SECRET }] }],
      locations: [{ id: 'the-reed-inn', name: 'The Reed Inn', type: 'building', playerView: { text: 'Smoke and eel stew.' }, gm: { notes: PLACE_SECRET } }],
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

const kindsOf = async (person: Person) => ((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).filter((e) => e.packId === packId).map((e) => e.kind).sort();

describe('top-level GM reference panels and locations', () => {
  it('are kept, and the GM reads them back whole; the panel shows in GM reference under the pack', async () => {
    expect(await kindsOf(world.gm)).toEqual(['class', 'gmReferencePanel', 'location']);
    const entries = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    const [book] = buildReference([{ packId, name: 'Lantern Wardens', shortName: 'Wardens', kind: 'homebrew' }], entries.filter((e) => e.packId === packId));
    expect(book?.panels.find((p) => p.id === 'ref:lantern-lore')).toMatchObject({ title: 'Lantern lore', entries: [expect.objectContaining({ paragraphs: [PANEL_SECRET] })] });
    expect(entries.find((e) => e.kind === 'location')?.data).toMatchObject({ gm: { notes: PLACE_SECRET } });
  });

  it('never reach a player in the campaign: neither kind is readable, the class still is', async () => {
    expect(await kindsOf(world.playerA)).toEqual(['class']);
    const raw = JSON.stringify(must(await world.playerA.db.from('library_entries').select('kind, data').eq('pack_id', packId)));
    expect(raw).not.toContain(PANEL_SECRET);
    expect(raw).not.toContain(PLACE_SECRET);
  });

  it('are kept by an Update with the same file', async () => {
    const updated = await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read() });
    expect(updated.ok).toBe(true);
    expect(await kindsOf(world.gm)).toEqual(['class', 'gmReferencePanel', 'location']);
  });
});
