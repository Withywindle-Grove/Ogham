// Patches as a player-readable kind (options-gates PR 3b; supabase/migrations/20261104150000_m5b_patches_kind.sql;
// design/rulings/m5b-options-format-2-2026-11-03.md of-13, m5b-builder-questions-3-2026-11-04.md bq3-16). TEST
// project only; invented content.
//   Purpose: a pack's patches import as entries of kind patch; a player in the campaign reads them (their byOption,
//   match and change), except one aimed at an item no pack has (hd-1), and still none of the GM-only kinds (a stat block); a player whose campaign hasn't the pack
//   reads none of it, nor does an outsider; the GM reads everything; and a pack update's "what changed" line for
//   players names a changed patch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { attachPack, loadCampaignEntries, loadCampaignPacks, setPackOptions } from '../../src/modules/library/campaignPacks.ts';
import { saveHomebrewEntry } from '../../src/modules/library/homebrew.ts';
import { applyPatches, readPatches } from '../../src/modules/library/patches.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const packFile = (version: string, delta = 1) =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Mire materials', version, kind: 'homebrew' },
    options: [{ id: 'mire-metals', name: 'Ordinary metal', default: 'steel', changeLater: 'allow', choices: [{ id: 'steel', name: 'Steel' }, { id: 'bronze', name: 'Bronze' }] }],
    items: [{ id: 'waxed-coat', name: 'Waxed coat', category: 'armour', slot: 'armour', armour: { ac: 7, aac: 12 }, value: { gp: 10 }, weightCoin: 100 }],
    patches: [
      { byOption: 'mire-metals=bronze', match: { kind: 'item', category: 'armour' }, change: { 'armour.ac': { delta }, 'armour.aac': { delta: -delta } } },
      { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['reed-shield'] }, option: null },
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
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const entriesSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId)).sort((a, b) => (a.kind as string).localeCompare(b.kind as string) || (a.pack_entry_id as string).localeCompare(b.pack_entry_id as string));

describe('who reads patches (bq3-16)', () => {
  it('a player in the campaign reads the patches whole, never the stat block; the GM reads all; a player elsewhere and an outsider read none', async () => {
    const player = await entriesSeenBy(world.playerA);
    expect(player.map((e) => `${e.kind}:${e.pack_entry_id}`)).toEqual(['item:waxed-coat', 'option:mire-metals', 'patch:patch-1']);
    const first = player.find((e) => e.pack_entry_id === 'patch-1')!;
    expect(first.name).toBe('mire-metals=bronze · item armour');
    expect(first.data).toEqual({ byOption: 'mire-metals=bronze', match: { kind: 'item', category: 'armour' }, change: { 'armour.ac': { delta: 1 }, 'armour.aac': { delta: -1 } } });
    // hd-1 (ruled 2026-11-11): the removal patch aims at an item no pack has, so it is the GM's; the player can't read it.
    expect(JSON.stringify(player)).not.toContain('reed-shield');

    const gm = await entriesSeenBy(world.gm);
    expect(gm.map((e) => e.kind)).toEqual(['item', 'option', 'patch', 'patch', 'statBlock']);

    // The newcomer is in the other campaign only (world.ts), which hasn't this pack: nothing of it.
    expect(await entriesSeenBy(world.newcomer)).toEqual([]);
    expect(await entriesSeenBy(world.outsider)).toEqual([]);
  });

  it("a pack update's line for players names a changed patch (it isn't filed as the GM's)", async () => {
    const read = readPackJson(packFile('2', 2));
    if (!read.ok) throw new Error(read.message);
    const updated = await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: read.pack });
    expect(updated).toMatchObject({ ok: true });
    const lines = must(await world.playerA.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const forPlayers = lines.find((line) => line.audience === 'all');
    expect((forPlayers?.after as { changed?: string[] } | undefined)?.changed ?? []).toContain('mire-metals=bronze · item armour');
    expect((forPlayers?.after as { gm_changed?: string[] } | undefined)?.gm_changed ?? []).not.toContain('mire-metals=bronze · item armour');
    // The player reads the new figure.
    const player = await entriesSeenBy(world.playerA);
    expect(player.find((e) => e.pack_entry_id === 'patch-1')!.data).toMatchObject({ change: { 'armour.ac': { delta: 2 } } });
  });
});

describe('a patch on a GM-only kind reaches only the GM (fresh-session review of 2026-11-04; hard rule 5)', () => {
  // Purpose: a patch whose match.kind is GM-only (a stat block's hit dice) never reaches a player, neither its name
  // nor its data, while a patch on an item still does; the GM reads both; and a pack update's "what changed" line for
  // players names the item patch only, the GM's line the stat-block patch.
  it('a player reads an item patch but not a stat-block patch; the GM reads both; the players’ update line names only the item patch', async () => {
    const file = (version: string, delta: number) =>
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Mire monsters', version, kind: 'homebrew' },
        options: [{ id: 'mire-depth', name: 'Mire depth', default: 'shallow', changeLater: 'allow', choices: [{ id: 'shallow', name: 'Shallow' }, { id: 'deep', name: 'Deep' }] }],
        items: [{ id: 'reed-coat', name: 'Reed coat', category: 'armour', slot: 'armour', armour: { ac: 8, aac: 11 }, value: { gp: 5 }, weightCoin: 50 }],
        patches: [
          { byOption: 'mire-depth=deep', match: { kind: 'item', ids: ['reed-coat'] }, change: { 'armour.ac': { delta: -delta } } },
          { byOption: 'mire-depth=deep', match: { kind: 'statBlock', ids: ['bog-lurker'] }, change: { hp: { delta } } },
        ],
        statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
      });
    const read = readPackJson(file('1', 1));
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    const monsters = made.value;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: monsters })).toMatchObject({ ok: true });
    const seenBy = async (person: Person) =>
      must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', monsters)).sort((a, b) => (a.kind as string).localeCompare(b.kind as string) || (a.pack_entry_id as string).localeCompare(b.pack_entry_id as string));

    const gm = await seenBy(world.gm);
    expect(gm.map((e) => `${e.kind}:${e.pack_entry_id}`)).toEqual(['item:reed-coat', 'option:mire-depth', 'patch:patch-1', 'patch:patch-2', 'statBlock:bog-lurker']);
    const monsterPatch = gm.find((e) => e.pack_entry_id === 'patch-2')!.name as string;
    expect(monsterPatch).toContain('statBlock');

    const player = await seenBy(world.playerA);
    expect(player.map((e) => `${e.kind}:${e.pack_entry_id}`)).toEqual(['item:reed-coat', 'option:mire-depth', 'patch:patch-1']);
    expect(JSON.stringify(player)).not.toContain('bog-lurker');

    // A new version changes both patches: the players' line names the item patch only; the GM's names the other.
    const again = readPackJson(file('2', 2));
    if (!again.ok) throw new Error(again.message);
    expect(await as(world.gm, updatePack, { packId: monsters, ownerUserId: world.gm.id, pack: again.pack })).toMatchObject({ ok: true });
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    const forPlayers = (lines.find((line) => line.audience === 'all')?.after ?? {}) as { changed?: string[] };
    const forGm = (lines.find((line) => line.audience === 'gm')?.after ?? {}) as { changed?: string[] };
    expect(forPlayers.changed ?? []).toContain('mire-depth=deep · item reed-coat');
    expect(JSON.stringify(forPlayers)).not.toContain(monsterPatch);
    expect(forGm.changed ?? []).toContain(monsterPatch);
  });
});

describe('patches players may not read (look-back review of #437, 2026-11-10; hard rule 5)', () => {
  // Purpose: a patch naming an item a player may not read (not for sale, not revealed, in no kit) never reaches that
  // player, neither its name (which carries the item's id) nor its figures, nor a pack update's line for players;
  // once the GM reveals the item it does; a patch naming an item for sale reaches them all along; the GM reads both.
  it('a patch naming an item players may not read reaches them only once the item is revealed', async () => {
    const file = (version: string, delta: number) =>
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Mire curses', version, kind: 'homebrew' },
        options: [{ id: 'mire-moon', name: 'Mire moon', default: 'new', changeLater: 'allow', choices: [{ id: 'new', name: 'New' }, { id: 'full', name: 'Full' }] }],
        items: [
          { id: 'cursed-blade', name: 'Cursed blade', category: 'weapon', forSale: false, damage: '1d6', value: { gp: 50 }, weightCoin: 60 },
          { id: 'bog-lantern', name: 'Bog lantern', category: 'gear', value: { gp: 3 }, weightCoin: 30 },
        ],
        patches: [
          { byOption: 'mire-moon=full', match: { kind: 'item', ids: ['cursed-blade'] }, change: { damage: { delta } } },
          { byOption: 'mire-moon=full', match: { kind: 'item', ids: ['bog-lantern'] }, change: { weightCoin: { delta } } },
        ],
      });
    const read = readPackJson(file('1', 1));
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    const curses = made.value;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: curses })).toMatchObject({ ok: true });
    const patchesSeenBy = async (person: Person) =>
      must(await person.db.from('library_entries').select('pack_entry_id, name, data').eq('pack_id', curses).eq('kind', 'patch')).sort((a, b) => (a.pack_entry_id as string).localeCompare(b.pack_entry_id as string));

    expect((await patchesSeenBy(world.gm)).map((e) => e.pack_entry_id)).toEqual(['patch-1', 'patch-2']);
    const player = await patchesSeenBy(world.playerA);
    expect(player.map((e) => e.pack_entry_id)).toEqual(['patch-2']);
    expect(JSON.stringify(player)).not.toContain('cursed-blade');

    // The GM shows the party the blade: the patch on it now reaches them too.
    must(await world.admin.from('known_items').insert({ campaign_id: world.campaignId, item_id: 'cursed-blade' }).select('item_id'));
    expect((await patchesSeenBy(world.playerA)).map((e) => e.pack_entry_id)).toEqual(['patch-1', 'patch-2']);
    await world.admin.from('known_items').delete().eq('campaign_id', world.campaignId).eq('item_id', 'cursed-blade');

    // A new version changes both: the players' line names the lantern's patch only, the GM's line the blade's.
    const again = readPackJson(file('2', 2));
    if (!again.ok) throw new Error(again.message);
    expect(await as(world.gm, updatePack, { packId: curses, ownerUserId: world.gm.id, pack: again.pack })).toMatchObject({ ok: true });
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    const forPlayers = (lines.find((line) => line.audience === 'all')?.after ?? {}) as { changed?: string[] };
    const forGm = (lines.find((line) => line.audience === 'gm')?.after ?? {}) as { changed?: string[] };
    expect(forPlayers.changed ?? []).toContain('mire-moon=full · item bog-lantern');
    expect(JSON.stringify(forPlayers)).not.toContain('cursed-blade');
    expect(forGm.changed ?? []).toContain('mire-moon=full · item cursed-blade');
  });

  // Purpose: a patch that changes a rules set's GM-only section (its monsters), or a field an item keeps GM-only
  // (named by id, or through its category), never reaches a player nor the players' update line; a patch on an open
  // field of the same item still does; the GM reads them all.
  it('a patch on a hidden field reaches only the GM', async () => {
    const file = (version: string, delta: number) =>
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Mire secrets', version, kind: 'homebrew' },
        options: [{ id: 'mire-fog', name: 'Mire fog', default: 'thin', changeLater: 'allow', choices: [{ id: 'thin', name: 'Thin' }, { id: 'thick', name: 'Thick' }] }],
        rulesSets: [{ id: 'mire-rules', name: 'Mire rules', healing: { perDay: 1 }, monsters: { note: 'The lurkers sleep by day' } }],
        items: [{ id: 'eel-lamp', name: 'Eel lamp', category: 'eel-gear', value: { gp: 5 }, weightCoin: 20, curse: 'Smells of eels', gmOnly: ['curse'] }],
        patches: [
          { byOption: 'mire-fog=thick', match: { kind: 'rulesSet' }, change: { 'monsters.bog-lurker.hd': { delta } } },
          { byOption: 'mire-fog=thick', match: { kind: 'item', ids: ['eel-lamp'] }, change: { curse: `Smells of mud ${delta}` } },
          { byOption: 'mire-fog=thick', match: { kind: 'item', category: 'eel-gear' }, change: { curse: `Smells of reeds ${delta}` } },
          { byOption: 'mire-fog=thick', match: { kind: 'item', ids: ['eel-lamp'] }, change: { weightCoin: { delta } } },
        ],
      });
    const read = readPackJson(file('1', 1));
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    const secrets = made.value;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: secrets })).toMatchObject({ ok: true });
    const patchesSeenBy = async (person: Person) =>
      must(await person.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', secrets).eq('kind', 'patch')).map((e) => e.pack_entry_id as string).sort();

    expect(await patchesSeenBy(world.gm)).toEqual(['patch-1', 'patch-2', 'patch-3', 'patch-4']);
    expect(await patchesSeenBy(world.playerA)).toEqual(['patch-4']);

    const again = readPackJson(file('2', 2));
    if (!again.ok) throw new Error(again.message);
    expect(await as(world.gm, updatePack, { packId: secrets, ownerUserId: world.gm.id, pack: again.pack })).toMatchObject({ ok: true });
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    const forPlayers = (lines.find((line) => line.audience === 'all')?.after ?? {}) as { changed?: string[] };
    const forGm = (lines.find((line) => line.audience === 'gm')?.after ?? {}) as { changed?: string[] };
    expect(forPlayers.changed ?? []).toEqual(['mire-fog=thick · item eel-lamp']);
    expect(forGm.changed ?? []).toEqual(expect.arrayContaining(['mire-fog=thick · rulesSet', 'mire-fog=thick · item eel-lamp', 'mire-fog=thick · item eel-gear']));
  });

  // Purpose (pf-19, 2026-11-13): a patch that creates a field the target entry names in its GM-only list stays the
  // GM's, though the entry lacks that field; a player's read of the pack's patches doesn't include it; a patch that
  // creates an open field still reaches the player; the GM reads both. (Written in a cloud session, not run there.)
  it('a patch that creates a GM-only field reaches only the GM', async () => {
    const file = JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Mire hollows', version: '1', kind: 'homebrew' },
      options: [{ id: 'mire-reeds', name: 'Mire reeds', default: 'short', changeLater: 'allow', choices: [{ id: 'short', name: 'Short' }, { id: 'tall', name: 'Tall' }] }],
      items: [{ id: 'reed-flute', name: 'Reed flute', category: 'reed-gear', value: { gp: 2 }, weightCoin: 5, gmOnly: ['notes'] }],
      patches: [
        { byOption: 'mire-reeds=tall', match: { kind: 'item', ids: ['reed-flute'] }, change: { notes: 'It hums at night' } },
        { byOption: 'mire-reeds=tall', match: { kind: 'item', ids: ['reed-flute'] }, change: { 'figures.length': 12 } },
      ],
    });
    const read = readPackJson(file);
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    const hollows = made.value;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: hollows })).toMatchObject({ ok: true });
    const patchesSeenBy = async (person: Person) =>
      must(await person.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', hollows).eq('kind', 'patch'));

    expect((await patchesSeenBy(world.gm)).map((e) => e.pack_entry_id as string).sort()).toEqual(['patch-1', 'patch-2']);
    const player = await patchesSeenBy(world.playerA);
    expect(player.map((e) => e.pack_entry_id)).toEqual(['patch-2']);
    expect(JSON.stringify(player)).not.toContain('notes');
    expect(JSON.stringify(player)).not.toContain('It hums at night');
  });

  // Purpose: a patch with no match kind matches nothing players read, so it is the GM's: a pack update lists its
  // change on the GM's line (before this fix it fell off both lines).
  it('a patch with no match kind is listed on the GM’s update line', async () => {
    const entries = (delta: number) => [
      { kind: 'item', pack_entry_id: 'reed-pole', name: 'Reed pole', data: { id: 'reed-pole', name: 'Reed pole', category: 'pole', weightCoin: 40 } },
      { kind: 'patch', pack_entry_id: 'patch-1', name: 'mire-tide=high', data: { byOption: 'mire-tide=high', change: { weightCoin: { delta } } } },
    ];
    const made = await world.gm.db.rpc('import_pack', { meta: { name: 'Mire tides', version: '1', kind: 'homebrew', format_version: 2 }, entries: entries(1) });
    expect(made.error).toBeNull();
    const tides = made.data as string;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: tides })).toMatchObject({ ok: true });
    const updated = await world.gm.db.rpc('import_pack', { meta: { name: 'Mire tides', version: '2', kind: 'homebrew', format_version: 2 }, entries: entries(2), replace_pack_id: tides });
    expect(updated.error).toBeNull();
    const lines = must(await world.admin.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update').order('seq', { ascending: false }).limit(2));
    const forGm = (lines.find((line) => line.audience === 'gm')?.after ?? {}) as { changed?: string[] };
    expect(forGm.changed ?? []).toContain('mire-tide=high');
    for (const line of lines.filter((l) => l.audience !== 'gm')) expect(JSON.stringify(line.after)).not.toContain('mire-tide=high');
  });

  // Purpose: in the campaign's own homebrew (whose changes are logged in the campaign), the log line of a patch
  // players may not read (no match kind, a rules set's monsters, an item not for sale) is the GM's; the line of a
  // patch on an open field of a category is everyone's.
  it('a homebrew patch players may not read is logged for the GM only', async () => {
    expect(
      await as(world.gm, saveHomebrewEntry, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve', kind: 'item', data: { id: 'peat-brick', name: 'Peat brick', category: 'gear', cost: 1, forSale: false } }),
    ).toMatchObject({ ok: true });
    const home = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId).single()).id as string;
    const add = async (id: string, data: Record<string, unknown>) =>
      must(await world.gm.db.from('library_entries').insert({ pack_id: home, kind: 'patch', pack_entry_id: id, name: id, data: { byOption: 'mire-tide=high', ...data } }).select('id').single()).id as string;
    const ids = {
      noKind: await add('patch-no-kind', { change: { cost: { delta: 1 } } }),
      monsters: await add('patch-monsters', { match: { kind: 'rulesSet' }, change: { 'monsters.bog-lurker.hd': { delta: 1 } } }),
      unsold: await add('patch-unsold', { match: { kind: 'item', ids: ['peat-brick'] }, change: { cost: { delta: 1 } } }),
      open: await add('patch-open', { match: { kind: 'item', category: 'gear' }, change: { cost: { delta: 1 } } }),
    };
    const audience = async (id: string) =>
      must(await world.admin.from('events').select('audience').eq('target_table', 'library_entries').eq('target_id', id)).map((e) => e.audience);
    expect(await audience(ids.noKind)).toEqual(['gm']);
    expect(await audience(ids.monsters)).toEqual(['gm']);
    expect(await audience(ids.unsold)).toEqual(['gm']);
    expect(await audience(ids.open)).toEqual(['all']);
  });

  // Purpose (local review of #629): when the GM edits a homebrew patch players may not read into one they may, the
  // edit's line is still the GM's, because its `before` carries the old targets (an unsold item's id); a later edit of
  // the open patch is everyone's again.
  it('a homebrew patch edited from GM-only to open is logged for the GM only', async () => {
    expect(
      await as(world.gm, saveHomebrewEntry, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve', kind: 'item', data: { id: 'sod-block', name: 'Sod block', category: 'gear', cost: 1, forSale: false } }),
    ).toMatchObject({ ok: true });
    const home = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId).single()).id as string;
    const id = must(
      await world.gm.db.from('library_entries').insert({ pack_id: home, kind: 'patch', pack_entry_id: 'patch-sod', name: 'patch-sod', data: { byOption: 'mire-tide=high', match: { kind: 'item', ids: ['sod-block'] }, change: { cost: { delta: 1 } } } }).select('id').single(),
    ).id as string;
    must(await world.gm.db.from('library_entries').update({ data: { byOption: 'mire-tide=high', match: { kind: 'item', category: 'gear' }, change: { cost: { delta: 1 } } } }).eq('id', id).select('id'));
    must(await world.gm.db.from('library_entries').update({ data: { byOption: 'mire-tide=high', match: { kind: 'item', category: 'gear' }, change: { cost: { delta: 2 } } } }).eq('id', id).select('id'));
    const lines = must(await world.admin.from('events').select('audience, before').eq('target_table', 'library_entries').eq('target_id', id).order('seq', { ascending: true }));
    expect(lines.map((e) => e.audience)).toEqual(['gm', 'gm', 'all']);
    const playerLines = must(await world.playerA.db.from('events').select('before, after').eq('target_table', 'library_entries').eq('target_id', id));
    expect(JSON.stringify(playerLines)).not.toContain('sod-block');
  });

  // Purpose (F of the look-back brief, the Pack Creator's suspicion): with an option chosen whose patch puts items on
  // sale, a player reads those items, as the app's settingFrom reads them (the access rule decides "for sale" on the
  // item as the campaign has it, patches applied). Real, and NOT fixed here (a larger change, see
  // docs/status/2026-11-11-m5b-hidden-data-cache-and-patches.md): this stays marked `.fails` until it is.
  it.fails('with the option chosen, a player reads an item a patch puts on sale', async () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Mire potions', version: '1', kind: 'homebrew' },
        options: [{ id: 'zine-potions', name: 'Buying potions', default: 'off', changeLater: 'allow', choices: [{ id: 'off', name: 'No' }, { id: 'buy', name: 'Yes' }] }],
        items: [{ id: 'mire-draught', name: 'Mire draught', category: 'potion', forSale: false, value: { gp: 40 }, weightCoin: 5 }],
        patches: [{ byOption: 'zine-potions=buy', match: { kind: 'item', category: 'potion' }, change: { forSale: true } }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value })).toMatchObject({ ok: true });
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === made.value)!;
    expect(await as(world.gm, setPackOptions, { campaignId: world.campaignId, campaignPackId: link.id, optionChoices: { 'zine-potions': 'buy' } })).toMatchObject({ ok: true });
    const seen = (await loadCampaignEntries(asDb(world.playerA), world.campaignId)) ?? [];
    expect(seen.map((e) => e.packEntryId)).toContain('mire-draught');
  });
});

describe('a patch on a patron’s hidden fields (pf-19a, 2026-11-13; hard rule 5)', () => {
  // Purpose: as a player, nothing new is readable. A patron's cult and stat block id are hidden by name, so a player
  // never receives them; an overlay's patch that adds to a cult figure and sets the cult, run by the app over what the
  // player received, gives the patron no cult. The patch row itself is still readable by players (the older, known gap).
  it('a player reads no cult on a patron, and a patch on it adds none; the patch row itself is the known gap', async () => {
    const CULT = 'Herons stand in the shallows and say nothing.';
    const base = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Reed shrines', version: '1', kind: 'homebrew' },
        patrons: [{ id: 'reed-mother', name: 'The Reed Mother', blurb: 'Keeper of the still water.', followers: { classes: ['reed-chaplain'] }, holySymbol: 'A bent reed.', cult: { name: 'Heron’s Hush', size: 12, note: CULT }, statBlockId: 'reed-lord', approval: 'gm' }],
        statBlocks: [{ id: 'reed-lord', name: 'Reed lord', hp: '8d8' }],
      }),
    );
    if (!base.ok) throw new Error(base.message);
    const madeBase = await as(world.gm, importPack, { pack: base.pack });
    if (!madeBase.ok) throw new Error(madeBase.message);
    const overlay = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Reed shrines overlay', version: '1', kind: 'homebrew' },
        options: [{ id: 'reed-rites', name: 'Reed rites', default: 'quiet', changeLater: 'allow', choices: [{ id: 'quiet', name: 'Quiet' }, { id: 'loud', name: 'Loud' }] }],
        patches: [
          { byOption: 'reed-rites=loud', match: { kind: 'patron', ids: ['reed-mother'] }, change: { 'cult.size': { delta: 5 } } },
          { byOption: 'reed-rites=loud', match: { kind: 'patron', ids: ['reed-mother'] }, change: { cult: 'Herons sing at dusk.' } },
        ],
      }),
    );
    if (!overlay.ok) throw new Error(overlay.message);
    const madeOverlay = await as(world.gm, importPack, { pack: overlay.pack });
    if (!madeOverlay.ok) throw new Error(madeOverlay.message);
    for (const id of [madeBase.value, madeOverlay.value]) expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: id })).toMatchObject({ ok: true });

    // The player's normal read (as the app loads a campaign's entries): the patron, with no cult and no stat block id.
    const seen = (await loadCampaignEntries(asDb(world.playerA), world.campaignId, [madeBase.value, madeOverlay.value])) ?? [];
    const patron = seen.find((e) => e.kind === 'patron' && e.packEntryId === 'reed-mother');
    expect(patron).toBeDefined();
    expect(patron!.data).toMatchObject({ name: 'The Reed Mother', holySymbol: 'A bent reed.' });
    expect(patron!.data).not.toHaveProperty('cult');
    expect(patron!.data).not.toHaveProperty('statBlockId');
    expect(JSON.stringify(seen.filter((e) => e.kind !== 'patch'))).not.toContain('Heron’s Hush');
    expect(JSON.stringify(seen.filter((e) => e.kind !== 'patch'))).not.toContain(CULT);
    expect(seen.some((e) => e.kind === 'statBlock')).toBe(false);

    // The app's patch application over what the player received: nothing new appears.
    const patches = readPatches(
      seen.map((e) => ({ kind: e.kind, packId: e.packId, packEntryId: e.packEntryId, data: e.data })),
      [{ packId: madeOverlay.value, name: 'Reed shrines overlay' }, { packId: madeBase.value, name: 'Reed shrines' }],
    );
    expect(patches).toHaveLength(2);
    const done = applyPatches({ kind: 'patron', packEntryId: 'reed-mother', data: patron!.data }, patches);
    expect(done.data).not.toHaveProperty('cult');
    expect(done.data).toEqual(patron!.data);
    expect(done.lines).toEqual([]);

    // The older, known gap, recorded and not hidden: the patch ROW is a player-readable entry (a patron is a
    // player-facing kind, and the row's hidden-field test looks only at gmOnly lists), so its own data carries the
    // value a pack author wrote in it. pf-19a closes this for new packs through `pack:check`; no current pack has such a patch.
    const rows = must(await world.playerA.db.from('library_entries').select('pack_entry_id, data').eq('pack_id', madeOverlay.value).eq('kind', 'patch'));
    expect(rows.length).toBe(2);
    expect(JSON.stringify(rows)).toContain('Herons sing at dusk.');
  });
});
