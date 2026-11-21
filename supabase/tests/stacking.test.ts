// Stacking setting rules (docs/07-content-packs.md, Homebrew): one order per campaign, homebrew on top by
// default, the GM's per-entry exceptions, and each campaign's own homebrew pack. TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack, loadCampaignPacks, moveSettingRules, preferEntry, startHomebrew } from '../../src/modules/library/campaignPacks.ts';
import { importPack, loadLibrary } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function pack(name: string, kind: 'setting' | 'homebrew'): Promise<string> {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name, version: '1', kind },
      classes: [{ id: 'lantern-warden', name: `Lantern Warden (${name})` }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

const stack = async () => ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).map((p) => p.name);
const logged = async (type: string) =>
  must(await world.admin.from('events').select('id, actor_user_id, request_id').eq('campaign_id', world.campaignId).eq('type', type));

describe('stacking setting rules', () => {
  let fen = '';

  beforeAll(async () => {
    const brew = await pack('Priya’s Brew', 'homebrew');
    const attachedBrew = await as(world.gm, attachPack, { campaignId: world.campaignId, packId: brew });
    if (!attachedBrew.ok) throw new Error(attachedBrew.message);
    const river = await pack('River Rules', 'setting');
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: river });
    fen = await pack('Fen Rules', 'setting');
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: fen });
  });

  it('newer setting rules go on top, but homebrew stays above them', async () => {
    expect(await stack()).toEqual(['Priya’s Brew', 'Fen Rules', 'River Rules']);
  });

  it('the GM moves setting rules up: one log line, and Undo puts the order back; nothing crosses the homebrew layer', async () => {
    const links = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    const fenLink = links.find((p) => p.packId === fen)!;
    const riverLink = links.find((p) => p.name === 'River Rules')!;
    // Homebrew stays above every setting pack (ruled 2026-10-24): moving Fen Rules above it changes nothing.
    await as(world.gm, moveSettingRules, { campaignId: world.campaignId, campaignPackId: fenLink.id, direction: 'up' });
    expect(await stack()).toEqual(['Priya’s Brew', 'Fen Rules', 'River Rules']);
    expect(await as(world.gm, moveSettingRules, { campaignId: world.campaignId, campaignPackId: riverLink.id, direction: 'up' })).toMatchObject({ ok: true });
    expect(await stack()).toEqual(['Priya’s Brew', 'River Rules', 'Fen Rules']);
    const moves = await logged('rules.reorder');
    expect(new Set(moves.map((m) => m.request_id)).size).toBe(1);
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: moves[0]!.id, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await stack()).toEqual(['Priya’s Brew', 'Fen Rules', 'River Rules']);
  });

  it('a player can’t change the order or the exceptions, even going straight to the database', async () => {
    const links = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    expect(await as(world.playerA, moveSettingRules, { campaignId: world.campaignId, campaignPackId: links[1]!.id, direction: 'up' })).toMatchObject({ ok: false });
    await world.playerA.db.from('campaign_packs').update({ priority: 99, overrides: { 'class:x': 'X' } }).eq('id', links[2]!.id);
    expect(must(await world.admin.from('campaign_packs').select('priority, overrides').eq('id', links[2]!.id).single())).toEqual({
      priority: links[2]!.priority,
      overrides: {},
    });
  });

  it('the GM makes an exception for one entry, then goes back to the order; both logged', async () => {
    const links = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    const river = links.find((p) => p.name === 'River Rules')!;
    const key = 'class:lantern-warden';
    expect(await as(world.gm, preferEntry, { campaignId: world.campaignId, key, name: 'Lantern Warden', campaignPackId: river.id })).toMatchObject({ ok: true });
    const after = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    expect(after.find((p) => p.id === river.id)?.overrides).toEqual({ [key]: 'Lantern Warden' });
    expect(after.filter((p) => p.id !== river.id).every((p) => !(key in p.overrides))).toBe(true);

    expect(await as(world.gm, preferEntry, { campaignId: world.campaignId, key, name: 'Lantern Warden', campaignPackId: null })).toMatchObject({ ok: true });
    expect(((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).every((p) => !(key in p.overrides))).toBe(true);
    expect(new Set((await logged('rules.prefer')).map((e) => e.request_id)).size).toBe(2);
  });
});

describe("a campaign's own homebrew", () => {
  it('the GM starts it: on top, one per campaign, logged, and not in their Rules library', async () => {
    const made = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve' });
    if (!made.ok) throw new Error(made.message);
    const again = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve' });
    expect(again).toMatchObject({ ok: true, value: made.value });
    const links = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    expect(links[0]).toMatchObject({ packId: made.value, name: 'The Reedmouth Delve homebrew', kind: 'homebrew', campaignHomebrew: true });
    expect(links.filter((p) => p.campaignHomebrew)).toHaveLength(1);
    expect(await logged('rules.homebrew')).toHaveLength(1);
    expect(((await loadLibrary(asDb(world.gm), world.gm.id)) ?? []).some((p) => p.id === made.value)).toBe(false);
  });

  it('players read its player-facing entries like any other setting rules', async () => {
    const [home] = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId));
    must(
      await world.gm.db
        .from('library_entries')
        .insert({ pack_id: home!.id, kind: 'item', pack_entry_id: 'lucky-reed', name: 'Lucky reed', data: { id: 'lucky-reed', name: 'Lucky reed' } })
        .select('id'),
    );
    const seen = must(await world.playerA.db.from('library_entries').select('name').eq('pack_id', home!.id));
    expect(seen).toEqual([{ name: 'Lucky reed' }]);
  });

  it('nobody but the GM can make a homebrew pack for a campaign', async () => {
    for (const person of [world.playerA, world.outsider]) {
      const attempt = await person.db
        .from('packs')
        .insert({ owner_user_id: person.id, campaign_id: world.otherCampaignId, name: 'Sneaky brew', kind: 'homebrew' })
        .select('id');
      expect(attempt.error).not.toBeNull();
    }
    const notHomebrew = await world.gm.db
      .from('packs')
      .insert({ owner_user_id: world.gm.id, campaign_id: world.otherCampaignId, name: 'Not homebrew', kind: 'setting' })
      .select('id');
    expect(notHomebrew.error).not.toBeNull();
  });
});
