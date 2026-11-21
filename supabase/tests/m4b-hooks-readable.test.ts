// Hooks run on the player's device (M4b step 1; ruled 2026-10-23; docs/07 "Who sees what";
// supabase/migrations/20261025160000_m4b_hooks_readable.sql). TEST project only; invented content.
//   Campaign members read XP tables and hooks now; stat blocks, tables and treasure types stay the GM's, and
//   outsiders read none of it. A GM's exception for a hook sits where players read.
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
      xpTables: [{ id: 'lantern-warden', '2': 2000 }],
      hooks: [{ id: 'warn-heavy', kind: 'warn', when: 'equip', test: 'item.slot == "armour"', message: '{item.name} is heavy.' }],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
      tables: [{ id: 'bog-encounters', name: 'Bog encounters', die: 'd6', rows: [] }],
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

const kindsSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('kind').eq('pack_id', packId))
    .map((row) => row.kind as string)
    .sort();

describe('who reads hooks and XP tables', () => {
  it('a player reads hooks and XP tables, never stat blocks or tables; the GM reads all; an outsider none', async () => {
    expect(await kindsSeenBy(world.playerA)).toEqual(['hook', 'xpTable']);
    expect(await kindsSeenBy(world.gm)).toEqual(['hook', 'statBlock', 'table', 'xpTable']);
    expect(await kindsSeenBy(world.outsider)).toEqual([]);
  });

  // Ruled 2026-10-29 (A4): every exception is the GM's, a hook's too; one written where players read is filed there.
  it("a GM's exception for a hook sits in the GM-only part, not where players read", async () => {
    const [link] = must(await world.admin.from('campaign_packs').select('id').eq('campaign_id', world.campaignId).eq('pack_id', packId));
    const readable = await world.admin.from('campaign_packs').update({ overrides: { 'hook:warn-heavy': 'Warn heavy' } }).eq('id', link!.id).select('id');
    expect(readable.error).toBeNull();
    expect(must(await world.admin.from('campaign_packs').select('overrides').eq('id', link!.id).single()).overrides).toEqual({});
    expect(must(await world.admin.from('campaign_pack_secrets').select('overrides').eq('id', link!.id).single()).overrides).toEqual({ 'hook:warn-heavy': 'Warn heavy' });
    await world.admin.from('campaign_pack_secrets').update({ overrides: {} }).eq('id', link!.id);
  });
});
