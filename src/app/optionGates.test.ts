// The shared option reader through the campaign's setting (options-gates PR 1; of-3, of-9, of-10), on the invented
// fixture pack scripts/fixtures/options-gates.fixture.json: each option on and off, and what each screen then reads.
// Always runs (no private packs).
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/options-gates.fixture.json?raw';
import overlayFixture from '../../scripts/fixtures/options-gates-overlay.fixture.json?raw';
import { classMayUse } from '../modules/characters/weaponSkills.ts';
import { equipBlocks } from '../modules/inventory/equipWarnings.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { entriesInPlay, fieldsAddedBy, fieldsInPlay, withFieldsAdded } from '../modules/library/optionGate.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { campaignEntriesInPlay, choicesInPlay, settingFrom, type CampaignSetting } from './campaignSetting.ts';

const read = readPackJson(fixture);
if (!read.ok) throw new Error(read.message);
const entries = read.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-options' }));

/** The fixture as one campaign's only pack, with these choices made (the rest at their defaults). */
function campaign(optionChoices: Record<string, string> = {}): CampaignSetting {
  const link: CampaignPack = {
    id: 'link-1',
    campaignId: 'c-1',
    packId: 'fixture-fen-options',
    name: 'Fen options',
    shortName: 'Fen options',
    version: '0.1',
    kind: 'setting',
    optionChoices,
    priority: 1,
    overrides: {},
    campaignHomebrew: false,
  };
  return settingFrom([link], entries, {});
}

const ids = (list: readonly { packEntryId: string }[]) => list.map((e) => e.packEntryId).sort();
const warden = (setting: CampaignSetting) => setting.all.find((e) => e.kind === 'class' && e.packEntryId === 'lantern-warden')!;
const item = (setting: CampaignSetting, id: string) => setting.items.find((e) => e.packEntryId === id)!;
const asItem = (setting: CampaignSetting, id: string) => ({ ...item(setting, id).data, id, name: item(setting, id).name });

describe('items behind an option (Add item, the shop)', () => {
  // Purpose: with no guns (the default), Add item and the shop offer neither gun; each era offers only its own.
  it('offers only the items whose option choice is the campaign’s', () => {
    expect(ids(entriesInPlay(campaign().items))).not.toContain('wheel-gun');
    expect(ids(entriesInPlay(campaign().items))).not.toContain('flint-gun');
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'wheel' }).items))).toContain('wheel-gun');
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'wheel' }).items))).not.toContain('flint-gun');
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'flint' }).items))).toContain('flint-gun');
  });

  // Purpose: an item switched off stays findable by id, so a character who already carries one still sees its name.
  it('keeps an item switched off findable by id, marked', () => {
    const gun = item(campaign(), 'wheel-gun');
    expect(gun.name).toBe('Wheel gun');
    expect(gun.optionOff).toBe('fen-powder=wheel');
  });

  // Purpose: an item's byOption gives its price under the choice (of-3).
  it("an item's byOption sets its fields under the choice", () => {
    expect(item(campaign({ 'fen-warden-staves': 'on' }), 'reed-staff').data.value).toEqual({ gp: 3 });
    expect(item(campaign(), 'reed-staff').data.value).toEqual({ gp: 1 });
  });
});

describe('classes and kits behind an option (creation, the rules browser)', () => {
  // Purpose: a class behind an option's choice isn't offered at creation until that choice is made.
  it('offers a class only under its choice', () => {
    expect(ids(entriesInPlay(campaign().all).filter((e) => e.kind === 'class'))).toEqual(['lantern-warden']);
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'flint' }).all).filter((e) => e.kind === 'class'))).toEqual(['lantern-warden', 'powder-bailiff']);
  });

  // Purpose: the rules browser and the GM reference, which read the entries themselves, list only those in play (X7),
  // with the pack's own words (byOption kept: they show the book).
  it('the rules browser and the GM reference keep only the entries in play', () => {
    const link = { ...campaign().packs[0]!, optionChoices: { 'fen-powder': 'flint' } };
    const listed = campaignEntriesInPlay(entries, [link]);
    expect(listed.some((e) => e.packEntryId === 'flint-gun')).toBe(true);
    expect(listed.some((e) => e.packEntryId === 'wheel-gun')).toBe(false);
    expect(listed.some((e) => e.packEntryId === 'powder-bailiff')).toBe(true);
    expect(listed.find((e) => e.packEntryId === 'reed-staff')!.data.byOption).toBeDefined();
    expect(listed.filter((e) => e.kind === 'option')).toHaveLength(7);
  });

  // Purpose: a kit behind an option isn't offered at Gear while it's off.
  it('offers a kit only while its option is on', () => {
    expect(entriesInPlay(campaign().all).some((e) => e.packEntryId === 'warden-reed-kit')).toBe(false);
    expect(entriesInPlay(campaign({ 'fen-reed-kits': 'on' }).all).some((e) => e.packEntryId === 'warden-reed-kit')).toBe(true);
  });
});

describe('a class as it is in play (the sheet, the equip check, Weapon skills)', () => {
  // Purpose: a class's byOption changes the armour it may wear, so the equip check follows the option (G-103).
  it('the equip check reads the armour the option allows', () => {
    const off = campaign();
    const on = campaign({ 'fen-heavy-coats': 'on' });
    expect(equipBlocks({ class: { ...warden(off).data, name: 'Lantern Warden' } }, asItem(off, 'bog-iron-coat'))).toHaveLength(1);
    expect(equipBlocks({ class: { ...warden(on).data, name: 'Lantern Warden' } }, asItem(on, 'bog-iron-coat'))).toEqual([]);
    expect(equipBlocks({ class: { ...warden(off).data, name: 'Lantern Warden' } }, asItem(off, 'waxed-coat'))).toEqual([]);
  });

  // Purpose: the optional staff is allowed only while its option is on, at the equip check and in Weapon skills (A2).
  it('the optional weapon follows its option', () => {
    const off = campaign();
    const on = campaign({ 'fen-warden-staves': 'on' });
    expect(equipBlocks({ class: { ...warden(off).data, name: 'Lantern Warden' } }, asItem(off, 'reed-staff'))).toHaveLength(1);
    expect(equipBlocks({ class: { ...warden(on).data, name: 'Lantern Warden' } }, asItem(on, 'reed-staff'))).toEqual([]);
    expect(classMayUse(warden(off).data, item(off, 'reed-staff'))).toBe(false);
    expect(classMayUse(warden(on).data, item(on, 'reed-staff'))).toBe(true);
    expect(classMayUse(warden(off).data, item(off, 'eel-knife'))).toBe(true);
  });
});

describe('sheet fields behind an option (of-9)', () => {
  const defs = [{ key: 'MUS' }, { key: 'WIT' }, { key: 'moonMark' }];

  // Purpose: with the option off the field is hidden on every screen that lists fields; on, it's back.
  it('hides the field while its option is off', () => {
    expect(fieldsInPlay(defs, campaign().fieldsOff).map((f) => f.key)).toEqual(['MUS', 'WIT']);
    expect(fieldsInPlay(defs, campaign({ 'fen-moon-marks': 'on' }).fieldsOff).map((f) => f.key)).toEqual(['MUS', 'WIT', 'moonMark']);
  });

  // Purpose: the option's row in Rules for this campaign says what it adds.
  it("the option's words say which field it adds", () => {
    const setting = campaign();
    expect(withFieldsAdded('Each character is born under a moon mark.', fieldsAddedBy(setting.all, 'fen-moon-marks'))).toBe('Each character is born under a moon mark. Adds a field: Moon mark.');
    expect(withFieldsAdded('Which powder weapons exist.', fieldsAddedBy(setting.all, 'fen-powder'))).toBe('Which powder weapons exist.');
    expect(withFieldsAdded('', ['A', 'B'])).toBe('Adds fields: A, B.');
  });
});

describe('a rules-set section a choice switches off (of-10)', () => {
  // Purpose: calm crews remove the morale section, so every screen treats it as absent; off, it's there.
  it('removes the section under the choice', () => {
    expect(campaign().rulesSets[0]!.morale).toEqual({ note: 'Frightened folk may run.' });
    expect('morale' in campaign({ 'fen-calm-crew': 'on' }).rulesSets[0]!).toBe(false);
  });
});

// of-1 (options-gates PR 2): the invented overlay scripts/fixtures/options-gates-overlay.fixture.json extends the
// fixture's Carrying option with a fourth way, Reed slots; the choice is stored with the base pack's choices.
describe('an overlay extending a base option (of-1)', () => {
  const overlayRead = readPackJson(overlayFixture);
  if (!overlayRead.ok) throw new Error(overlayRead.message);
  const overlayEntries = overlayRead.pack.entries.map((e) => ({ ...e, packId: 'fixture-reed-overlay' }));
  const link = (id: string, packId: string, name: string, kind: CampaignPack['kind'], priority: number, optionChoices: Record<string, string>): CampaignPack => ({
    id,
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
  const both = (baseChoices: Record<string, string>) =>
    settingFrom([link('link-1', 'fixture-fen-options', 'Fen options', 'setting', 1, baseChoices), link('link-2', 'fixture-reed-overlay', 'Reed zine', 'homebrew', 2, {})], [...entries, ...overlayEntries], {});

  // Purpose: with the overlay's choice stored on the base option, the overlay's rules set (keyed on the base option)
  // gives the campaign its carrying method: slots, with the overlay's numbers.
  it("the overlay's choice, stored on the base option, sets the campaign's carrying through the overlay's rules", () => {
    const setting = both({ 'fen-carrying': 'slot' });
    expect(choicesInPlay(setting)['fen-carrying']).toBe('slot');
    expect(setting.encumbrance.mode).toBe('slot');
    expect(setting.encumbrance.slot?.baseSlots).toBe(12);
    expect(both({ 'fen-carrying': 'coin' }).encumbrance.mode).toBe('coin');
  });

  // Purpose: the extending option has no choice of its own, so nothing can read it as a separate switch.
  it('gives the extending option no choice of its own', () => {
    expect('reed-slots' in choicesInPlay(both({}))).toBe(false);
  });

  // Purpose: the base's ruleKey group answers with the overlay's choice, by its name.
  it("the base's ruleKey group reads the overlay's choice", () => {
    const group = both({ 'fen-carrying': 'slot' }).ruleGroups.find((g) => g.ruleKey === 'encumbrance')!;
    expect([group.winner.choiceId, group.winner.choiceName]).toEqual(['slot', 'Reed slots']);
  });

  // Purpose: once the overlay is detached, a stored Reed slots choice falls back to the base's default, as its row shows.
  it("falls back to the base's default once the overlay that brought the choice is gone", () => {
    const alone = settingFrom([link('link-1', 'fixture-fen-options', 'Fen options', 'setting', 1, { 'fen-carrying': 'slot' })], entries, {});
    expect(choicesInPlay(alone)['fen-carrying']).toBe('none');
    expect(alone.encumbrance.mode).toBeNull();
  });
});

describe('gates on several choices (of-12)', () => {
  // Purpose: an item gated on a list of choices is offered under each listed choice and not without one.
  it('offers an item under any choice its list names', () => {
    expect(ids(entriesInPlay(campaign().items))).not.toContain('powder-horn');
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'wheel' }).items))).toContain('powder-horn');
    expect(ids(entriesInPlay(campaign({ 'fen-powder': 'flint' }).items))).toContain('powder-horn');
    expect(item(campaign(), 'powder-horn').optionOff).toBe('fen-powder=wheel,fen-powder=flint');
  });

  // Purpose: a byOption key listing several choices gives its fields under any of them (a null price removed).
  it('applies a comma byOption key under any of its choices', () => {
    for (const era of ['wheel', 'flint']) {
      const lamp = item(campaign({ 'fen-powder': era }), 'bog-lamp').data;
      expect('value' in lamp).toBe(false);
      expect(lamp.notes).toBe('Found, never sold.');
    }
    expect(item(campaign(), 'bog-lamp').data.value).toEqual({ gp: 2 });
    expect(item(campaign({ 'fen-powder': 'flint' }), 'powder-horn').data.value).toEqual({ gp: 3 });
  });
});
