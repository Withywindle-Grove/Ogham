// options-gates build order 4 (design/rulings/m5b-options-format-2026-11-03.md; plans/options-gates.md): the small
// ones read through the campaign's setting and the shared option reader. Here of-11 (a pick line in the setting's
// given gear) under an option, of-5 (safe paths only under a choice) and of-6 with bq3-15 (known spells at list level
// 2, fewer than the count). On the invented fixture scripts/fixtures/options-gates-4.fixture.json; always runs.
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/options-gates-4.fixture.json?raw';
import { readDungeonExit } from '../modules/expedition/dungeonExit.ts';
import { firstSpellsPlan } from '../modules/characters/firstSpells.ts';
import { startingEquipment, startingPicks } from '../modules/characters/startingGear.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { settingFrom, type CampaignSetting } from './campaignSetting.ts';

const read = readPackJson(fixture);
if (!read.ok) throw new Error(read.message);
const entries = read.pack.entries.map((e) => ({ ...e, packId: 'fen-small' }));

function campaign(optionChoices: Record<string, string> = {}): CampaignSetting {
  const link: CampaignPack = { id: 'link-1', campaignId: 'c-1', packId: 'fen-small', name: 'Fen small options', shortName: 'Fen small', version: '0.1', kind: 'setting', optionChoices, priority: 1, overrides: {}, campaignHomebrew: false };
  return settingFrom([link], entries, {});
}

/** The Gear step's pick groups, as StartingGear.tsx finds them: the rules set's picks whose table is in play. */
const pickGroups = (setting: CampaignSetting) => {
  const tables = entriesInPlay(setting.all).filter((e) => e.kind === 'table');
  return startingPicks(setting.rulesSets).filter((p) => tables.some((t) => t.packEntryId === p.tableId));
};

describe('of-11: a pick line in the given gear, through the shared reader', () => {
  // Purpose: the rules set's byOption decides the given gear, so the pick exists only under its choice.
  it('offers the pick only while its choice is made', () => {
    expect(startingPicks(campaign().rulesSets)).toEqual([]);
    expect(startingPicks(campaign({ 'fen-odds-and-ends': 'on' }).rulesSets)).toEqual([{ tableId: 'fen-odds', upTo: 2 }]);
    // The plain lines stay given either way, the pick line never counted as an item.
    expect(startingEquipment(campaign({ 'fen-odds-and-ends': 'on' }).rulesSets)).toEqual([{ itemId: 'reed-rope', qty: 1 }]);
  });

  // Purpose: a pick whose table an option switches off makes no group (the table doesn't exist, of-3).
  it('makes no group when the pick table is switched off', () => {
    expect(pickGroups(campaign({ 'fen-odds-and-ends': 'on' }))).toEqual([{ tableId: 'fen-odds', upTo: 2 }]);
    expect(pickGroups(campaign({ 'fen-odds-and-ends': 'on', 'fen-odd-table': 'off' }))).toEqual([]);
  });
});

describe('of-6 and bq3-15: known spells at list level 2, fewer than the count', () => {
  // Purpose: a class naming list level 2 is offered that level's spells; with one there and two asked, it asks for one.
  it('reads listLevel 2 and asks for no more than the level has', () => {
    const setting = campaign();
    const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === 'bog-singer')!;
    // As the creation flow passes it (Characters.tsx): every spell (marked when off), the lists and tables in play.
    const plan = firstSpellsPlan(klass, 1, { spells: setting.all.filter((e) => e.kind === 'spell'), lists: entriesInPlay(setting.all).filter((e) => e.kind === 'spellList'), tables: entriesInPlay(setting.all).filter((e) => e.kind === 'table'), choices: {} })!;
    expect(plan.cantrips).toMatchObject({ count: 1, wanted: 2 });
    expect(plan.cantrips!.options.map((o) => o.id)).toEqual(['frog-hum']);
  });
});

describe('of-5: a choice that leaves only safe paths, through the setting', () => {
  // Purpose: the rules set's byOption removes the roll under one choice, so Leave the dungeon offers safe paths only.
  it('the escape roll under one choice, safe paths only under the other', () => {
    const escape = campaign();
    expect(readDungeonExit(escape.rulesSets, { 'fen-ways-out': 'escape' })).toMatchObject({ roll: { save: 'nerve' }, onFailTable: 'fen-lost-below' });
    const safe = campaign({ 'fen-ways-out': 'safe' });
    expect(readDungeonExit(safe.rulesSets, { 'fen-ways-out': 'safe' })).toEqual({ roll: null, modifiers: [], depth: null, onFailTable: null, safePaths: 'Follow the chalk marks back; it takes an extra turn.', who: 'each' });
  });
});
