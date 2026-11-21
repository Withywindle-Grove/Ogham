// Attaching setting rules to a campaign: the GM attaches packs from their library with optional-rule choices;
// players read the player-facing parts; everything is logged in the campaign. TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, detachPack, loadCampaignEntries, loadCampaignPacks, setPackOptions } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  for (const person of [world.gm, world.playerA]) await world.admin.from('packs').delete().eq('owner_user_id', person.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function riverRules(owner: Person = world.gm): Promise<string> {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'River Rules', version: '0.2' },
      options: [{ id: 'lantern-oil', name: 'Lanterns need oil', default: 'on', changeLater: 'allow', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] }],
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden' }],
      items: [{ id: 'rope-50ft', name: 'Rope, 50 ft' }],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
      tables: [{ id: 'marsh-encounters', name: 'Marsh encounters', die: 'd6', rows: [] }],
      treasureTypes: [{ id: 'tt-k', letter: 'K', entries: [] }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(owner, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

const logged = async (type: string) => must(await world.admin.from('events').select('id, after').eq('campaign_id', world.campaignId).eq('type', type));

describe('attaching setting rules', () => {
  it("the GM attaches a pack from their library with its optional rules at their defaults, and it's logged", async () => {
    const packId = await riverRules();
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId })).toMatchObject({ ok: true });
    const attached = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    expect(attached.find((p) => p.packId === packId)).toMatchObject({ name: 'River Rules', version: '0.2', optionChoices: { 'lantern-oil': 'on' } });
    expect((await logged('rules.attach')).length).toBeGreaterThan(0);
  });

  it('players read the player-facing parts of an attached pack, never stat blocks, tables or treasure; outsiders read nothing', async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    const kinds = async (person: Person) => [...new Set(((await loadCampaignEntries(asDb(person), world.campaignId)) ?? []).filter((e) => e.packId === packId).map((e) => e.kind))].sort();
    expect(await kinds(world.playerA)).toEqual(['class', 'item', 'option']);
    expect(await kinds(world.gm)).toEqual(['class', 'item', 'option', 'statBlock', 'table', 'treasureType']);
    expect(await kinds(world.outsider)).toEqual([]);
    // The pack's own row (its name and version) is visible to members too.
    expect((await loadCampaignPacks(asDb(world.playerA), world.campaignId))?.some((p) => p.packId === packId)).toBe(true);
  });

  it('the GM changes an optional rule and detaches the pack; both are logged, and players lose access', async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === packId)!;
    expect(await as(world.gm, setPackOptions, { campaignId: world.campaignId, campaignPackId: link.id, optionChoices: { 'lantern-oil': 'off' } })).toMatchObject({ ok: true });
    expect(((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.id === link.id)?.optionChoices).toEqual({ 'lantern-oil': 'off' });
    expect(await as(world.gm, detachPack, { campaignId: world.campaignId, campaignPackId: link.id })).toMatchObject({ ok: true });
    expect((await logged('rules.setOptions')).length).toBeGreaterThan(0);
    expect((await logged('rules.detach')).length).toBeGreaterThan(0);
    expect(((await loadCampaignEntries(asDb(world.playerA), world.campaignId)) ?? []).some((e) => e.packId === packId)).toBe(false);
  });

  it("players can't attach, change or detach, and the GM can't attach someone else's pack, even skipping the app's own check", async () => {
    const theirs = await riverRules(world.playerA);
    const gm = (await loadCurrentUser(asDb(world.gm)))!;
    expect(await attachPack.run(asDb(world.gm), gm, { campaignId: world.campaignId, packId: theirs })).toMatchObject({ ok: false, reason: 'not-allowed' });

    const mine = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: mine });
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === mine)!;
    const player = (await loadCurrentUser(asDb(world.playerA)))!;
    expect(await setPackOptions.run(asDb(world.playerA), player, { campaignId: world.campaignId, campaignPackId: link.id, optionChoices: {} })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await detachPack.run(asDb(world.playerA), player, { campaignId: world.campaignId, campaignPackId: link.id })).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('the same pack attached twice to one campaign is refused in plain words', async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId })).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Those setting rules are already in this campaign.',
      requestId: expect.any(String),
    });
  });
});
