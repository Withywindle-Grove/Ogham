// How packs sharing a ruleKey are resolved for a campaign, through the real commands on the fake database
// (docs/07 "ruleKey"; built 2026-11-02). Invented packs only. What it checks:
//   * attaching the first pack brings no new choice; attaching a rival on top returns the topic and pins the pack
//     that was deciding (the choice in use doesn't change);
//   * the loaded setting names the pinned pack as winner (picked), and the loser's rule reads the winner's choice
//     (when it has one of that id);
//   * the engine's reading of a group (acStyleOf) follows the winner, and follows a new GM pick;
//   * removing the pinned pack clears the pick and the next pack's choice counts.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { choicesInPlay, forgetCampaignSetting, groupChoice, loadCampaignSetting } from '../../app/campaignSetting.ts';
import { acStyleOf } from '../../app/fromSetting.ts';
import { updateCampaign } from '../../core/campaignCommands.ts';
import type { Json } from '../../core/database.types.ts';
import { runCommand, type Command, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { attachPack, detachPack } from './campaignPacks.ts';

let world: FakeWorld;
let gm: string;
let campaignId: string;
let user: CurrentUser;
let fenId: string;
let zineId: string;
const registry = createAppRegistry();

/** A pack in the GM's library with option entries. */
function addPack(id: string, name: string, kind: 'setting' | 'homebrew', shortName: string, options: Record<string, unknown>[]) {
  world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind, format_version: 2, source: '', notes: '', extra_meta: { shortName }, updated_at: '2026-10-20T12:00:00Z' });
  for (const option of options) {
    world.tables.library_entries.push({ id: `${id}-${String(option.id)}`, pack_id: id, kind: 'option', pack_entry_id: String(option.id), name: String(option.name), data: option });
  }
  return id;
}

const pair = (a: string, b: string) => [{ id: a, name: a }, { id: b, name: b }];

beforeEach(() => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  campaignId = world.addCampaign('The Lantern Road', gm);
  world.signInAs(gm);
  user = { id: gm, roles: { [campaignId]: 'gm' } };
  forgetCampaignSetting(campaignId);
  fenId = addPack('pack-fen', 'Fen Rules, Advanced', 'setting', 'Fen Rules', [
    { id: 'fen-load', name: 'Item load', default: 'weight', ruleKey: 'item-load', choices: pair('weight', 'count') },
    { id: 'fen-ac', name: 'Armour style', default: 'ascending', ruleKey: 'ac-style', choices: pair('ascending', 'descending') },
  ]);
  zineId = addPack('pack-zine', 'Zine Compendium', 'homebrew', 'Zine', [
    { id: 'zine-load', name: 'Item counts', default: 'counts', ruleKey: 'item-load', choices: pair('counts', 'weight') },
    { id: 'zine-ac', name: 'Armour numbers', default: 'descending', ruleKey: 'ac-style', choices: pair('descending', 'ascending') },
  ]);
});

const run = <I, T, O>(command: Command<I, T, O>, input: I) => runCommand(registry, world.db, user, command, input);
const settingsNow = () => (world.tables.campaigns.find((c) => c.id === campaignId)?.settings ?? {}) as Record<string, unknown>;
const load = async () => {
  forgetCampaignSetting(campaignId);
  const setting = await loadCampaignSetting(world.db, gm, campaignId);
  if (!setting) throw new Error('the setting did not load');
  return setting;
};

describe('attaching a rival rule', () => {
  it('the first pack brings no new choice; a rival on top returns the topics and pins the pack that was deciding', async () => {
    const first = await run(attachPack, { campaignId, packId: fenId });
    expect(first).toMatchObject({ ok: true });
    expect(first.ok && first.value.newChoices).toEqual([]);

    const second = await run(attachPack, { campaignId, packId: zineId });
    expect(second.ok && second.value.newChoices).toEqual([
      { ruleKey: 'item-load', topic: 'item load' },
      { ruleKey: 'ac-style', topic: 'ac style' },
    ]);
    // The homebrew is on top, yet the setting pack keeps deciding until the GM chooses.
    expect(settingsNow().ruleGroups).toEqual({ 'item-load': fenId, 'ac-style': fenId });
  });
});

describe('the loaded setting', () => {
  it('names the pinned pack as winner (picked); each pack\'s own rule keeps reading its own choice (ruled 2026-11-02)', async () => {
    await run(attachPack, { campaignId, packId: fenId });
    await run(attachPack, { campaignId, packId: zineId });
    const setting = await load();
    const group = setting.ruleGroups.find((g) => g.ruleKey === 'item-load')!;
    expect(group.winner.source.packId).toBe(fenId);
    expect(group.picked).toBe(true);
    // The group's effective choice is Fen's "weight"; Zine's own rule still reads its own choice ("counts").
    expect(groupChoice(setting, 'item-load')?.choiceId).toBe('weight');
    expect(choicesInPlay(setting)['zine-load']).toBe('counts');
    expect(choicesInPlay(setting)['fen-load']).toBe('weight');
  });

  it('with no pick (never pinned) the pack on top decides', async () => {
    // Both attached by hand, as an older campaign would be: no stored pick.
    world.tables.campaign_packs.push(
      { id: 'cp-fen', campaign_id: campaignId, pack_id: fenId, option_choices: {}, priority: 1, pack_name: 'Fen Rules, Advanced' },
      { id: 'cp-zine', campaign_id: campaignId, pack_id: zineId, option_choices: {}, priority: 2, pack_name: 'Zine Compendium' },
    );
    const setting = await load();
    const group = setting.ruleGroups.find((g) => g.ruleKey === 'item-load')!;
    expect(group.winner.source.packId).toBe(zineId);
    expect(group.picked).toBe(false);
    // Zine (on top) decides the topic ("counts"); Fen's own rule still reads its own default.
    expect(groupChoice(setting, 'item-load')?.choiceId).toBe('counts');
    expect(choicesInPlay(setting)['fen-load']).toBe('weight');
  });

  it("a losing pack's byOption gate follows its own stored choice while the group's effective choice is the other pack's", async () => {
    // Fen's rules set changes a figure when its own item-load rule says "count".
    world.tables.library_entries.push({
      id: 'pack-fen-rules', pack_id: fenId, kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules',
      data: { id: 'fen-rules', name: 'Fen rules', carry: { limit: 10, byOption: { 'fen-load=count': { limit: 12 } } } },
    });
    await run(attachPack, { campaignId, packId: fenId, optionChoices: { 'fen-load': 'count' } });
    await run(attachPack, { campaignId, packId: zineId });
    // Zine's rule now decides the topic.
    await run(updateCampaign, { campaignId, settings: { ...settingsNow(), ruleGroups: { 'item-load': zineId } } as Json });
    const setting = await load();
    expect(groupChoice(setting, 'item-load')?.packId).toBe(zineId);
    expect(groupChoice(setting, 'item-load')?.choiceId).toBe('counts');
    const fenRules = setting.rulesSets.find((r) => r.id === 'fen-rules') as { carry?: { limit?: number } } | undefined;
    expect(fenRules?.carry?.limit).toBe(12);
  });
});

describe('the engine reads the resolved value', () => {
  it('acStyleOf follows the pinned winner, then a new GM pick', async () => {
    await run(attachPack, { campaignId, packId: fenId });
    await run(attachPack, { campaignId, packId: zineId });
    expect(acStyleOf(await load())).toBe('ascending');

    const pick = await run(updateCampaign, { campaignId, settings: { ...settingsNow(), ruleGroups: { ...(settingsNow().ruleGroups as object), 'ac-style': zineId } } });
    expect(pick).toMatchObject({ ok: true });
    expect(acStyleOf(await load())).toBe('descending');
  });
});

describe('removing the pack that decides', () => {
  it('clears its pick, and the remaining pack\'s choice counts', async () => {
    await run(attachPack, { campaignId, packId: fenId });
    await run(attachPack, { campaignId, packId: zineId });
    const link = world.tables.campaign_packs.find((row) => row.pack_id === fenId)!;
    const removed = await run(detachPack, { campaignId, campaignPackId: String(link.id) });
    expect(removed).toMatchObject({ ok: true });
    expect(settingsNow().ruleGroups).toEqual({});
    const setting = await load();
    expect(setting.ruleGroups.find((g) => g.ruleKey === 'item-load')?.winner.source.packId).toBe(zineId);
    expect(acStyleOf(setting)).toBe('descending');
  });

  it('removing a pack that did not decide leaves the picks alone', async () => {
    await run(attachPack, { campaignId, packId: fenId });
    await run(attachPack, { campaignId, packId: zineId });
    const link = world.tables.campaign_packs.find((row) => row.pack_id === zineId)!;
    await run(detachPack, { campaignId, campaignPackId: String(link.id) });
    expect(settingsNow().ruleGroups).toEqual({ 'item-load': fenId, 'ac-style': fenId });
  });
});
