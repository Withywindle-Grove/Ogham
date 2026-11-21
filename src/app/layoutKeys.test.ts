// Gate check 59 (of-9): a sheet field whose option is off is hidden, its value kept. Followed the way a real campaign
// goes: the invented pack scripts/fixtures/layout-keys.fixture.json (mixed-case layout keys, as packs write them) is
// attached, "Use this sheet layout" makes the campaign's fields (field.useLayout, which writes each key in lower
// case), and the setting is read as campaignSetting.ts reads it. The gate found every such field still showing:
// the gates were keyed by the layout's own keys ("swordDrills"), the campaign's fields by theirs ("sworddrills").
import { beforeEach, describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/layout-keys.fixture.json?raw';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { applySheetLayout, loadFieldDefinitions, type FieldDefinition } from '../modules/characters/fields.ts';
import { combatFields } from '../modules/characters/play.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { fieldsInPlay, fieldsOffFor } from '../modules/library/optionGate.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { layoutFields } from '../modules/library/sheetLayout.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { settingFrom, type CampaignSetting } from './campaignSetting.ts';

const read = readPackJson(fixture);
if (!read.ok) throw new Error(read.message);
const entries = read.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-layout-keys' }));

const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;

/** The campaign's setting with these choices stored (the rest at their defaults), read as the app reads it. */
function setting(optionChoices: Record<string, string> = {}): CampaignSetting {
  const link: CampaignPack = {
    id: 'link-1',
    campaignId: campaign,
    packId: 'fixture-fen-layout-keys',
    name: 'Fen keys',
    shortName: 'Fen keys',
    version: '0.1',
    kind: 'setting',
    optionChoices,
    priority: 1,
    overrides: {},
    campaignHomebrew: false,
  };
  return settingFrom([link], entries, {});
}

/** The campaign's fields as "Use this sheet layout" makes them from the pack's layout. */
async function campaignFields(): Promise<FieldDefinition[]> {
  expect(await runCommand(registry, world.db, gm, applySheetLayout, { campaignId: campaign, fields: layoutFields(entries) })).toMatchObject({ ok: true });
  return (await loadFieldDefinitions(world.db, campaign)) ?? [];
}

const labels = (fields: readonly FieldDefinition[]) => fields.map((f) => f.label);
const warden = { classRef: 'lantern-warden', raceRef: null };
const witch = { classRef: 'reed-witch', raceRef: null };

beforeEach(() => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.signInAs(gmId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
});

describe('sheet fields behind an option, in a campaign made from a layout (gate check 59)', () => {
  // Purpose: with the drills option at its default (off), the campaign's Sword drills field is hidden on the sheet.
  it('hides a field whose option is at its default off', async () => {
    const fields = await campaignFields();
    expect(labels(fieldsInPlay(fields, fieldsOffFor(setting(), warden)))).not.toContain('Sword drills');
    expect(labels(fieldsInPlay(fields, fieldsOffFor(setting({ 'fen-sword-drill': 'on-master' }), warden)))).toContain('Sword drills');
  });

  // Purpose: under a low guard only the ward number shows, under a high guard only the strike bonus; the attack tile
  // reads the one in play.
  it('shows only the attack field of the guard style in play', async () => {
    const fields = await campaignFields();
    const low = fieldsInPlay(fields, fieldsOffFor(setting(), warden));
    expect(labels(low)).toContain('Ward number [strike bonus]');
    expect(labels(low)).not.toContain('Strike bonus');
    expect(combatFields(low).attack?.label).toBe('Ward number [strike bonus]');
    const high = fieldsInPlay(fields, fieldsOffFor(setting({ 'fen-guard-style': 'high' }), warden));
    expect(labels(high)).toContain('Strike bonus');
    expect(labels(high)).not.toContain('Ward number [strike bonus]');
    expect(combatFields(high).attack?.label).toBe('Strike bonus');
  });

  // Purpose: a field the layout gives one class only (cs-3) is hidden for another class, through the same keys.
  it('hides a field that is for another class', async () => {
    const fields = await campaignFields();
    expect(labels(fieldsInPlay(fields, fieldsOffFor(setting(), warden)))).toContain("Warden's oath");
    expect(labels(fieldsInPlay(fields, fieldsOffFor(setting(), witch)))).not.toContain("Warden's oath");
  });
});
