// A class reaching the base pack's races, through the real attach and detach commands on the fake database and the
// campaign's loaded setting (pg-2, ruled 2026-11-03): the merge happens when the setting is read, so attaching the
// add-on opens its class to the races it names, and detaching it closes them again. Invented packs only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { forgetCampaignSetting, loadCampaignSetting } from '../../app/campaignSetting.ts';
import { runCommand, type Command, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { classesFor, classLevelCap } from '../characters/creation.ts';
import { attachPack, detachPack } from './campaignPacks.ts';

let world: FakeWorld;
let gm: string;
let campaignId: string;
let user: CurrentUser;
const registry = createAppRegistry();

function addPack(id: string, name: string, entries: { kind: string; id: string; name: string; data: Record<string, unknown> }[]) {
  world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: {}, updated_at: '2026-10-20T12:00:00Z' });
  for (const e of entries) world.tables.library_entries.push({ id: `${id}-${e.id}`, pack_id: id, kind: e.kind, pack_entry_id: e.id, name: e.name, data: { id: e.id, name: e.name, ...e.data } });
}

beforeEach(() => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  campaignId = world.addCampaign('The Lantern Road', gm);
  world.signInAs(gm);
  user = { id: gm, roles: { [campaignId]: 'gm' } };
  forgetCampaignSetting(campaignId);
  addPack('pack-fen', 'Fen Rules', [
    { kind: 'race', id: 'race-reedfolk', name: 'Reedfolk', data: { classMaxLevels: { 'bog-mage': 6 } } },
    { kind: 'race', id: 'race-stone-kin', name: 'Stone kin', data: { classMaxLevels: { 'bog-mage': 8 } } },
    { kind: 'class', id: 'bog-mage', name: 'Bog Mage', data: {} },
  ]);
  addPack('pack-warden', 'Lantern Warden add-on', [{ kind: 'class', id: 'lantern-warden', name: 'Lantern Warden', data: { raceMaxLevels: { 'race-reedfolk': 9 } } }]);
});

const run = <I, T, O>(command: Command<I, T, O>, input: I) => runCommand(registry, world.db, user, command, input);
const offered = async (raceId: string) => {
  forgetCampaignSetting(campaignId);
  const setting = await loadCampaignSetting(world.db, gm, campaignId);
  if (!setting) throw new Error('the setting did not load');
  const race = setting.all.find((e) => e.kind === 'race' && e.packEntryId === raceId)!;
  const open = classesFor(setting.all.filter((e) => e.kind === 'class'), null, race, {}).map((o) => o.entry);
  return { ids: open.map((c) => c.packEntryId), cap: (id: string) => classLevelCap(open.find((c) => c.packEntryId === id)!, race) };
};

describe('an add-on class in a campaign', () => {
  it('attached, its class is offered to the race it names at its limit and not to the other; detached, the offer goes', async () => {
    await run(attachPack, { campaignId, packId: 'pack-fen' });
    const addOn = await run(attachPack, { campaignId, packId: 'pack-warden' });
    expect(addOn.ok).toBe(true);
    const reedfolk = await offered('race-reedfolk');
    expect(reedfolk.ids).toEqual(['bog-mage', 'lantern-warden']);
    expect(reedfolk.cap('lantern-warden')).toBe(9);
    expect((await offered('race-stone-kin')).ids).toEqual(['bog-mage']);

    await run(detachPack, { campaignId, campaignPackId: addOn.ok ? addOn.value.id : '' });
    expect((await offered('race-reedfolk')).ids).toEqual(['bog-mage']);
  });

  it('a race’s byOption is read with the campaign’s choice, before the classes’ reach (cs-5): default, NPC-only, lifted', async () => {
    addPack('pack-kin', 'Kin limits', [
      { kind: 'option', id: 'kin-limits', name: 'Kin limits', data: { default: 'kept', choices: [{ id: 'kept', name: 'Kept' }, { id: 'npc', name: 'Mages are the GM’s' }, { id: 'lifted', name: 'Lifted' }] } },
      {
        kind: 'race',
        id: 'race-marshfolk',
        name: 'Marshfolk',
        data: { classMaxLevels: { 'bog-mage': 7 }, byOption: { 'kin-limits=npc': { npcOnlyClasses: ['bog-mage'] }, 'kin-limits=lifted': { classMaxLevels: {} } } },
      },
    ]);
    await run(attachPack, { campaignId, packId: 'pack-fen' });
    await run(attachPack, { campaignId, packId: 'pack-warden' });
    await run(attachPack, { campaignId, packId: 'pack-kin' });
    const choose = (choice: string) => (world.tables.campaign_packs.find((l) => l.pack_id === 'pack-kin')!.option_choices = { 'kin-limits': choice });
    expect((await offered('race-marshfolk')).ids).toEqual(['bog-mage']);
    choose('npc');
    expect((await offered('race-marshfolk')).ids).toEqual([]);
    choose('lifted');
    const lifted = await offered('race-marshfolk');
    expect(lifted.ids).toEqual(['bog-mage', 'lantern-warden']);
    expect(lifted.cap('lantern-warden')).toBeNull();
  });
});
