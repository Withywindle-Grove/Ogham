// Overlay patches through the campaign's setting (options-gates PR 3b; of-13, bq3-17 "of-14"): the invented Fen
// options pack with the invented Mire materials overlay on top (scripts/fixtures/options-gates-3b-materials.fixture.json).
// Each choice of "Ordinary metal", and what the entries, a carried line and the AC breakdown then read. Always runs
// (no private packs).
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/options-gates.fixture.json?raw';
import materialsFixture from '../../scripts/fixtures/options-gates-3b-materials.fixture.json?raw';
import { workOutAc } from '../modules/characters/play.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { choiceWords, lineInPlay, settingFrom, type CampaignSetting } from './campaignSetting.ts';

const base = readPackJson(fixture);
const materials = readPackJson(materialsFixture);
if (!base.ok || !materials.ok) throw new Error('fixture');
const entries = [...base.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-options' })), ...materials.pack.entries.map((e) => ({ ...e, packId: 'fixture-mire-materials' }))];

/** Both packs, the overlay on top, with the metal chosen (its default, steel, when none). */
function campaign(metal?: string, fenChoices: Record<string, string> = {}): CampaignSetting {
  const link = (packId: string, name: string, kind: CampaignPack['kind'], priority: number, optionChoices: Record<string, string>): CampaignPack => ({
    id: `link-${packId}`,
    campaignId: 'c-1',
    packId,
    name,
    shortName: name,
    version: '0.1',
    kind,
    optionChoices,
    priority,
    overrides: {},
    campaignHomebrew: false,
  });
  return settingFrom([link('fixture-fen-options', 'Fen options', 'setting', 1, fenChoices), link('fixture-mire-materials', 'Mire materials', 'homebrew', 2, metal ? { 'mire-metals': metal } : {})], entries, {});
}

const item = (setting: CampaignSetting, id: string) => setting.items.find((e) => e.packEntryId === id)!;
const lines = (setting: CampaignSetting, id: string) => (item(setting, id).patched ?? []).map((l) => l.text);

describe('patches through the setting (of-13)', () => {
  // Purpose: the overlay's patches import as entries of their own kind and are read; under the default nothing changes.
  it('imports patches as entries, and changes nothing under the default choice', () => {
    expect(materials.pack.counts.patch).toBe(8);
    expect(materials.pack.warnings.some((w) => w.includes("isn't a part"))).toBe(false);
    const setting = campaign();
    expect(setting.patches).toEqual([]);
    expect(setting.all.filter((e) => e.kind === 'patch')).toHaveLength(8);
    expect(item(setting, 'waxed-coat').data.armour).toEqual({ base: 7, ac: 7, aac: 12 });
    expect(item(setting, 'waxed-coat').patched).toBeUndefined();
    expect(item(setting, 'eel-knife').data.value).toEqual({ gp: 2 });
  });

  // Purpose: under bronze, the matched armour's AC moves by the delta (the overlay's winning copy of a base item, bq3-17 (5)),
  // the named knife's price is multiplied, and every changed figure names the choice and the pack (7).
  it('applies deltas and multipliers under bronze, naming each figure', () => {
    const setting = campaign('bronze');
    expect(setting.patches.map((p) => p.packEntryId)).toEqual(['patch-1', 'patch-5']);
    expect(item(setting, 'waxed-coat').packId).toBe('fixture-mire-materials');
    expect(item(setting, 'waxed-coat').data.armour).toEqual({ base: 7, ac: 8, aac: 11 });
    expect(lines(setting, 'waxed-coat')).toEqual(['AC +1: Bronze, Mire materials', 'AC −1: Bronze, Mire materials']);
    expect(item(setting, 'eel-knife').data.value).toEqual({ gp: 20 });
    expect(lines(setting, 'eel-knife')).toEqual(['Price ×10: Bronze, Mire materials']);
    // A weapon's damage is untouched under bronze; the shield stays in play.
    expect(item(setting, 'eel-knife').data.weapon).toEqual({ damage: '1d4' });
    expect(item(setting, 'reed-shield').optionOff).toBeUndefined();
  });

  // Purpose: under bone, two patches on one field add (3); dice lose a point of modifier (2); a set value replaces (3);
  // a patch reaches the base pack's own entries (5); a field the entry lacks changes nothing (2).
  it('adds two patches on one field, adjusts dice, sets a value, and skips a field the entry lacks under bone', () => {
    const setting = campaign('bone');
    expect(item(setting, 'waxed-coat').data.armour).toEqual({ base: 7, ac: 9, aac: 10 });
    expect(item(setting, 'waxed-coat').data.armourType).toBe('hide');
    expect(lines(setting, 'waxed-coat')).toEqual([
      'AC +1: Bone, Mire materials',
      'AC +1: Bone, Mire materials',
      'AC −1: Bone, Mire materials',
      'AC −1: Bone, Mire materials',
      'ArmourType hide: Bone, Mire materials',
    ]);
    expect(item(setting, 'eel-knife').data.weapon).toEqual({ damage: '1d4−1' });
    expect(item(setting, 'reed-staff').data.weapon).toEqual({ damage: '1d6−1' });
    expect(lines(setting, 'eel-knife')).toEqual(['Damage −1: Bone, Mire materials']);
    // The knife has no armour block: patch #8 changes nothing and says nothing.
    expect('armour' in item(setting, 'eel-knife').data).toBe(false);
  });

  // Purpose: a patch applies after the entry's own byOption (4): the staff's price under its option, then ×2.
  it("applies after the entry's own byOption", () => {
    expect(item(campaign('bone'), 'reed-staff').data.value).toEqual({ gp: 2 });
    expect(item(campaign('bone', { 'fen-warden-staves': 'on' }), 'reed-staff').data.value).toEqual({ gp: 6 });
    expect(lines(campaign('bone', { 'fen-warden-staves': 'on' }), 'reed-staff')).toEqual(['Damage −1: Bone, Mire materials', 'Price ×2: Bone, Mire materials']);
  });

  // Purpose: under stone, a removed entry stays in the setting by name, marked "Off · Stone", and leaves every list (6).
  it('marks a removed entry off, and keeps it by name', () => {
    const setting = campaign('stone');
    const shield = item(setting, 'reed-shield');
    expect(shield.name).toBe('Reed shield');
    expect(shield.optionOff).toBe('mire-metals=stone');
    expect(shield.offLabel).toBe('Off: Stone');
    expect(entriesInPlay(setting.items).some((e) => e.packEntryId === 'reed-shield')).toBe(false);
    expect(entriesInPlay(setting.items).some((e) => e.packEntryId === 'waxed-coat')).toBe(true);
  });

  // Purpose: an entry an option switches off gets the same "Off · <choice>" words as a patch's removal.
  it('words an option-gated entry the same way', () => {
    expect(item(campaign(), 'wheel-gun').offLabel).toBe('Off: Wheel guns');
    expect(choiceWords(campaign().all, 'mire-metals=bone,fen-powder=flint')).toBe('Bone, Flint guns');
    expect(choiceWords(campaign().all, 'nobody=knows')).toBe('nobody=knows');
  });
});

describe('a carried line as the choices make it (bq3-17 (5)–(7))', () => {
  const coat = { category: 'armour', details: { slot: 'armour', armourType: 'light', armour: { base: 7, ac: 7, aac: 12 } }, sourceEntryId: 'waxed-coat' };
  const shield = { category: 'shield', details: { slot: 'shield', armour: { acBonus: 1 } }, sourceEntryId: 'reed-shield' };

  // Purpose: the line's own copy of its item gets the patches in play, with its lines, and is left alone otherwise.
  it('patches the line’s copy and names each figure', () => {
    const now = lineInPlay(campaign('bronze'), coat);
    expect(now.details.armour).toEqual({ base: 7, ac: 8, aac: 11 });
    expect(now.lines).toEqual(['AC +1: Bronze, Mire materials', 'AC −1: Bronze, Mire materials']);
    expect(now.off).toBeNull();
    const same = lineInPlay(campaign(), coat);
    expect(same.details).toBe(coat.details);
    expect(same.lines).toEqual([]);
    expect(lineInPlay(null, coat).details).toBe(coat.details);
    expect(lineInPlay(campaign('bronze'), { ...coat, sourceEntryId: null }).details).toBe(coat.details);
  });

  // Purpose: a line whose entry a choice removes says "Off · <choice>", nothing deleted.
  it('says Off with the choice for a removed item', () => {
    expect(lineInPlay(campaign('stone'), shield).off).toBe('Off: Stone');
    expect(lineInPlay(campaign('bronze'), shield).off).toBeNull();
    expect(lineInPlay(campaign(), { category: 'weapon', details: {}, sourceEntryId: 'wheel-gun' }).off).toBe('Off: Wheel guns');
  });

  // Purpose: the AC breakdown shows the pack's figure on the armour's line, then the patch's line, and the total follows the patch.
  it('names the patch in the AC breakdown', () => {
    const setting = campaign('bronze');
    const now = lineInPlay(setting, coat);
    const worn = [{ name: 'Waxed coat', slot: 'armour', armour: now.details.armour, patched: { before: coat.details.armour, lines: now.lines } }];
    const worked = workOutAc({ rulesSets: setting.rulesSets, chosenStyle: null, worn, filled: {}, abilityName: (k) => k });
    // The Fen options' AC ascends: the coat's 12 reads 11 under bronze (the aac delta).
    expect(worked.value).toBe(11);
    expect(worked.lines.slice(0, 3)).toEqual(['Waxed coat: 12', 'AC +1: Bronze, Mire materials', 'AC −1: Bronze, Mire materials']);
    // Without a patch, the line is as before.
    const plain = workOutAc({ rulesSets: setting.rulesSets, chosenStyle: null, worn: [{ name: 'Waxed coat', slot: 'armour', armour: coat.details.armour }], filled: {}, abilityName: (k) => k });
    expect(plain.value).toBe(12);
    expect(plain.lines[0]).toBe('Waxed coat: 12');
  });
});
