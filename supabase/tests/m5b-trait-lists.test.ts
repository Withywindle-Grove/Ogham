// Trait lists as a player-readable kind (M5b step 0b part B; supabase/migrations/20261101170000_m5b_trait_lists.sql;
// design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md §4). TEST project only; invented content.
//   Purpose: a player in the campaign reads the setting's trait lists and nothing GM-only (a list's gmOnly field
//   stays with the GM; stat blocks stay hidden); an outsider reads none of it; the GM reads everything; a campaign
//   field made from a sheet layout keeps the trait list it points at (`from`), as a list field with no choices; a
//   list field with neither choices nor a trait list is refused; and the players' "what changed" line of a pack
//   update names a trait list.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { applySheetLayout, loadFieldDefinitions } from '../../src/modules/characters/fields.ts';
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

const packFile = (version: string, listName = 'Fen backgrounds') =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Fen Traits', version },
    traitLists: [
      {
        id: 'fen-backgrounds',
        name: listName,
        die: 'd6',
        notes: 'Where they come from.',
        secret: 'The eel catchers are smugglers.',
        gmOnly: ['secret'],
        entries: [
          { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.' },
          { id: 'reed-cutter', name: 'Reed cutter', min: 4, max: 6 },
        ],
      },
    ],
    statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
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
  await world.admin.from('field_definitions').delete().eq('campaign_id', world.campaignId).eq('key', 'background');
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const entriesSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('kind, pack_entry_id, data').eq('pack_id', packId)).sort((a, b) => (a.kind as string).localeCompare(b.kind as string));

describe('who reads trait lists', () => {
  it('a player reads the trait list without its GM-only field, never the stat block; the GM reads all; an outsider none', async () => {
    const player = await entriesSeenBy(world.playerA);
    expect(player.map((e) => e.kind)).toEqual(['traitList']);
    const list = player[0]!.data as Record<string, unknown>;
    expect(list.name).toBe('Fen backgrounds');
    expect(list.die).toBe('d6');
    expect((list.entries as unknown[]).length).toBe(2);
    expect(list.secret).toBeUndefined();
    expect(list.gmOnly).toBeUndefined();

    const gm = await entriesSeenBy(world.gm);
    expect(gm.map((e) => e.kind)).toEqual(['statBlock', 'traitList']);
    // The GM's copy comes back whole through the secrets table.
    const [secret] = must(await world.gm.db.from('library_entry_secrets').select('data').eq('pack_id', packId));
    expect((secret!.data as Record<string, unknown>).secret).toBe('The eel catchers are smugglers.');
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id').eq('pack_id', packId))).toEqual([]);

    expect(await entriesSeenBy(world.outsider)).toEqual([]);
  });

  it("a pack update's line for players names a changed trait list (it isn't filed as the GM's)", async () => {
    const read = readPackJson(packFile('2', 'Fen upbringings'));
    if (!read.ok) throw new Error(read.message);
    const updated = await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read.pack });
    expect(updated).toMatchObject({ ok: true });
    // The line players read (audience "all") names the list; the GM's line ("gm") is for the hidden kinds.
    const lines = must(await world.playerA.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const forPlayers = lines.find((line) => line.audience === 'all');
    expect(((forPlayers?.after as { changed?: string[] } | undefined)?.changed ?? [])).toContain('Fen upbringings');
  });
});

describe("a campaign field's trait list", () => {
  it('a sheet layout\'s list field with a `from` keeps it, as a list with no choices; the player reads it', async () => {
    const applied = await as(world.gm, applySheetLayout, {
      campaignId: world.campaignId,
      fields: [{ key: 'background', label: 'Background', type: 'list', from: 'fen-backgrounds' }],
    });
    expect(applied).toMatchObject({ ok: true, value: 1 });
    const fields = await loadFieldDefinitions(asDb(world.playerA), world.campaignId);
    expect(fields?.find((f) => f.key === 'background')).toMatchObject({ type: 'list', choices: [], from: 'fen-backgrounds' });
  });

  it('a list field with neither choices nor a trait list is refused; a bad list id too', async () => {
    const bare = await world.admin.from('field_definitions').insert({ campaign_id: world.campaignId, key: 'bare_list', label: 'Bare list', type: 'list', choices: [] }).select('id');
    expect(bare.error).not.toBeNull();
    const odd = await world.admin.from('field_definitions').insert({ campaign_id: world.campaignId, key: 'odd_list', label: 'Odd list', type: 'list', choices: [], from_list: 'Not An Id' }).select('id');
    expect(odd.error).not.toBeNull();
    const text = await world.admin.from('field_definitions').insert({ campaign_id: world.campaignId, key: 'text_from', label: 'Text from', type: 'text', choices: [], from_list: 'fen-backgrounds' }).select('id');
    expect(text.error).not.toBeNull();
  });
});
