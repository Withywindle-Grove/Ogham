// Sheet layouts as a player-readable kind (M5b step 0c, follow-up B; supabase/migrations/20261102300000_m5b_0c_layouts_players_read.sql;
// design/rulings/m5b-0c-creation-followups-2026-11-02.md, cf-5). TEST project only; invented content.
//   Purpose: a player in the campaign reads the setting's sheet layouts, with their per-race `from` patterns and
//   field option gates, and still none of the GM-only kinds (a stat block, a table); an outsider reads none of it;
//   the GM reads everything; and the players' "what changed" line of a pack update names a changed layout.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
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

const packFile = (version: string, layoutName = 'Fen sheet') =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Fen Sheet', version },
    fieldTemplates: [
      {
        id: 'fen-sheet',
        name: layoutName,
        appliesTo: 'pc',
        fields: [
          { key: 'MUS', label: 'MUS', type: 'number', group: 'Abilities', showOnCard: true },
          { key: 'background', label: 'Background', type: 'list', group: 'Who they are', from: 'fen-backgrounds-{race}' },
          { key: 'omen', label: 'Omen', type: 'list', group: 'Who they are', from: 'fen-omens', option: 'fen-omens' },
        ],
      },
    ],
    statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
    tables: [{ id: 'bog-finds', name: 'Bog finds', die: 'd6', rows: [{ min: 1, max: 6, result: 'A rusted lantern' }] }],
  });

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(packFile('1'));
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

const entriesSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('kind, pack_entry_id, data').eq('pack_id', packId)).sort((a, b) => (a.kind as string).localeCompare(b.kind as string));

describe('who reads sheet layouts (cf-5)', () => {
  it('a player reads the layout with its per-race pattern and field option gate, never the stat block or the table; the GM reads all; an outsider none', async () => {
    const player = await entriesSeenBy(world.playerA);
    expect(player.map((e) => e.kind)).toEqual(['fieldTemplate']);
    const layout = player[0]!.data as { name?: string; fields?: { key: string; from?: string; option?: string }[] };
    expect(layout.name).toBe('Fen sheet');
    expect(layout.fields?.find((f) => f.key === 'background')?.from).toBe('fen-backgrounds-{race}');
    expect(layout.fields?.find((f) => f.key === 'omen')?.option).toBe('fen-omens');

    const gm = await entriesSeenBy(world.gm);
    expect(gm.map((e) => e.kind)).toEqual(['fieldTemplate', 'statBlock', 'table']);

    expect(await entriesSeenBy(world.outsider)).toEqual([]);
  });

  it("a pack update's line for players names a changed layout (it isn't filed as the GM's)", async () => {
    const read = readPackJson(packFile('2', 'Fen sheet, revised'));
    if (!read.ok) throw new Error(read.message);
    const updated = await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read.pack });
    expect(updated).toMatchObject({ ok: true });
    // The line players read (audience "all") names the layout; the GM's line ("gm") is for the hidden kinds.
    const lines = must(await world.playerA.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const forPlayers = lines.find((line) => line.audience === 'all');
    expect((forPlayers?.after as { changed?: string[] } | undefined)?.changed ?? []).toContain('Fen sheet, revised');
    expect((forPlayers?.after as { gm_changed?: string[] } | undefined)?.gm_changed ?? []).not.toContain('Fen sheet, revised');
  });
});
