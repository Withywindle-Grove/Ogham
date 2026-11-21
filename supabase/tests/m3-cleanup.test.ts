// The M3 cleanup step (docs/09-decisions-log.md, 2026-10-22). TEST project only; invented content.
//   S1. Item fields a pack marks gmOnly never reach players' devices, in entries or in the log.
//   S2. Updating a library pack writes a line in every campaign using it; GM-only details stay the GM's.
//   S3. A campaign's homebrew couldn't be detached from its campaign (until 2026-10-24: now it can, like any homebrew).
//   S6. "Use this sheet layout" adds the layout's fields, keeps the GM's own, and is logged.
//   S8. Unknown meta keys are kept with the pack.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createField, loadFieldDefinitions, applySheetLayout } from '../../src/modules/characters/fields.ts';
import { attachPack, detachPack, loadCampaignEntries, loadCampaignPacks, startHomebrew } from '../../src/modules/library/campaignPacks.ts';
import { saveHomebrewEntry } from '../../src/modules/library/homebrew.ts';
import { importPack, loadLibrary, loadPackEntries, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
const campaignName = 'The Reedmouth Delve';
const CURSE = 'Whispers to the moon at night';

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

function readPack(version: string, extra: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  const result = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'River Rules', version, ...meta },
      items: [
        { id: 'grumbling-blade', name: 'Grumbling blade', category: 'weapon', cursed: true, fields: { Curse: CURSE }, gmOnly: ['cursed', 'fields'] },
        { id: 'rope', name: 'Rope', weightCoin: 10 },
      ],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
      fieldTemplates: [
        { id: 'river-sheet', appliesTo: 'pc', fields: [{ key: 'GRIT', label: 'Grit', type: 'number', group: 'Abilities' }, { key: 'LUCK', label: 'Luck', type: 'number', group: 'Abilities' }] },
      ],
      ...extra,
    }),
  );
  if (!result.ok) throw new Error(result.message);
  return result.pack;
}

let packId = '';
let linkId = '';

describe('S1. hidden item fields', () => {
  beforeAll(async () => {
    const made = await as(world.gm, importPack, { pack: readPack('1', {}, { author: 'Priya', built: 'by hand' }) });
    if (!made.ok) throw new Error(made.message);
    packId = made.value;
    const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    if (!attached.ok) throw new Error(attached.message);
    linkId = attached.value.id;
  });

  it("a player's device never receives the hidden fields, nor which fields are hidden", async () => {
    const [blade] = must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId).eq('pack_entry_id', 'grumbling-blade'));
    expect(blade!.data).toEqual({ id: 'grumbling-blade', name: 'Grumbling blade', category: 'weapon' });
    expect(must(await world.playerA.db.from('library_entry_secrets').select('data'))).toEqual([]);
    const seen = (await loadCampaignEntries(asDb(world.playerA), world.campaignId)) ?? [];
    expect(JSON.stringify(seen)).not.toContain(CURSE);
  });

  it('the GM and the pack owner see the whole item', async () => {
    const gmSees = ((await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? []).find((e) => e.packEntryId === 'grumbling-blade');
    expect(gmSees?.data).toMatchObject({ cursed: true, fields: { Curse: CURSE }, gmOnly: ['cursed', 'fields'] });
    const ownerSees = ((await loadPackEntries(asDb(world.gm), packId)) ?? []).find((e) => e.packEntryId === 'grumbling-blade');
    expect(ownerSees?.data).toMatchObject({ cursed: true, gmOnly: ['cursed', 'fields'] });
  });

  it("a homebrew item with hidden fields: the log never holds them, and the GM's Undo still works", async () => {
    const save = (weight: number) =>
      as(world.gm, saveHomebrewEntry, {
        campaignId: world.campaignId,
        campaignName,
        kind: 'item',
        data: { id: 'moon-ring', name: 'Moon ring', weightCoin: weight, cursed: true, fields: { Curse: CURSE }, gmOnly: ['cursed', 'fields'] },
      });
    expect(await save(1)).toMatchObject({ ok: true });
    expect(await save(2)).toMatchObject({ ok: true });
    for (const person of [world.gm, world.playerA]) {
      const log = must(await person.db.from('events').select('before, after').eq('campaign_id', world.campaignId).eq('target_table', 'library_entries'));
      expect(JSON.stringify(log)).not.toContain(CURSE);
    }
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('target_table', 'library_entry_secrets'))).toEqual([]);
    const [change] = must(
      await world.gm.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'homebrew.save').not('before', 'is', null).order('seq', { ascending: false }).limit(1),
    );
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: change!.id, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    const ring = ((await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? []).find((e) => e.packEntryId === 'moon-ring');
    expect(ring?.data).toMatchObject({ weightCoin: 1, cursed: true, fields: { Curse: CURSE } });
  });
});

describe('S8. the pack keeps what its file says about itself', () => {
  it('unknown meta keys are kept and shown with the pack', async () => {
    const pack = ((await loadLibrary(asDb(world.gm), world.gm.id)) ?? []).find((p) => p.id === packId);
    expect(pack?.extraMeta).toEqual({ author: 'Priya', built: 'by hand' });
  });
});

describe('S2. updating setting rules is logged in each campaign using them', () => {
  const updates = async (person: Person) =>
    must(await person.db.from('events').select('id, type, before, after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));

  it('the same file again: nothing changed, no line', async () => {
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: readPack('1', {}, { author: 'Priya', built: 'by hand' }) })).toMatchObject({ ok: true });
    expect(await updates(world.gm)).toEqual([]);
  });

  it('a newer file: players see what changed in their kinds, the GM sees everything, nobody can undo it', async () => {
    const newer = readPack('2', {
      items: [{ id: 'grumbling-blade', name: 'Grumbling blade', category: 'weapon', cursed: true, fields: { Curse: 'Hums all day' }, gmOnly: ['cursed', 'fields'] }],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '4d8' }],
    });
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: newer })).toMatchObject({ ok: true });

    const players = await updates(world.playerA);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ before: null, audience: 'all', after: { pack_name: 'River Rules', from_version: '1', to_version: '2', added: [], changed: [], removed: ['Rope'] } });
    expect(JSON.stringify(players)).not.toContain('Bog lurker');
    expect(JSON.stringify(players)).not.toContain('Grumbling blade');

    const gm = await updates(world.gm);
    expect(gm).toHaveLength(2);
    expect(gm.find((e) => e.audience === 'gm')?.after).toMatchObject({ changed: ['Grumbling blade', 'Bog lurker'] });
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: gm[0]!.id, authorUserId: world.gm.id })).toMatchObject({ ok: false });
  });
});

describe('S3. a campaign homebrew is removed like any other (ruled 2026-10-24)', () => {
  it('the GM detaches it; starting homebrew again attaches the same pack again', async () => {
    const home = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName });
    if (!home.ok) throw new Error(home.message);
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.campaignHomebrew)!;
    expect(await as(world.gm, detachPack, { campaignId: world.campaignId, campaignPackId: link.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('campaign_packs').select('id').eq('id', link.id))).toHaveLength(0);
    const again = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName });
    expect(again.ok && again.value).toBe(home.value);
  });

  it('other setting rules still detach', async () => {
    expect(await as(world.gm, detachPack, { campaignId: world.campaignId, campaignPackId: linkId })).toMatchObject({ ok: true });
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  });
});

describe('S6. use a sheet layout from setting rules', () => {
  it("adds the layout's fields, keeps the GM's own, logs one line, and only the GM can", async () => {
    await as(world.gm, createField, { campaignId: world.campaignId, label: 'Grit', type: 'text' });
    const layout = [
      { key: 'GRIT', label: 'Grit', type: 'number', group: 'Abilities' },
      { key: 'LUCK', label: 'Luck', type: 'number', group: 'Abilities' },
    ];
    expect(await as(world.playerA, applySheetLayout, { campaignId: world.campaignId, fields: layout })).toMatchObject({ ok: false });
    expect(await as(world.gm, applySheetLayout, { campaignId: world.campaignId, fields: layout })).toMatchObject({ ok: true, value: 1 });
    const fields = (await loadFieldDefinitions(asDb(world.gm), world.campaignId)) ?? [];
    expect(fields.filter((f) => f.label === 'Grit')).toEqual([expect.objectContaining({ type: 'text' })]);
    expect(fields.find((f) => f.label === 'Luck')).toMatchObject({ type: 'number', group: 'Abilities' });
    const logged = must(await world.gm.db.from('events').select('request_id').eq('campaign_id', world.campaignId).eq('type', 'field.useLayout'));
    expect(logged).toHaveLength(1);
  });
});
