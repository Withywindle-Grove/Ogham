// pt-9 (patrons exist only under their option; the #636 rework, 2026-11-12): a patron is gated by its own `option`
// field (07 of-3), read by the shared option reader when the campaign's setting is read (campaignSetting.ts
// settingFrom → optionGate). These tests check the case the port pack needs: the patron's pack names an option that
// another attached pack carries. Every name is invented.
import { describe, expect, it } from 'vitest';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { patronOf, patronsFor } from '../modules/characters/patrons.ts';
import { settingFrom } from './campaignSetting.ts';
import { patronGarbFor, patronInSetting } from './patronGarb.ts';

const link = (packId: string, priority: number, optionChoices: Record<string, string> = {}): CampaignPack => ({
  id: `link-${packId}`,
  campaignId: 'camp-1',
  packId,
  name: packId,
  shortName: packId,
  version: '0.1',
  kind: 'setting',
  optionChoices,
  priority,
  overrides: {},
  campaignHomebrew: false,
});

// Pack B (the rules) carries the option; pack A (the region) carries the patron and names B's option by its id.
const OPTION: CampaignEntry = { kind: 'option', packEntryId: 'ex-opt-gods', name: 'Gods of the fen', packId: 'pack-b', data: { id: 'ex-opt-gods', name: 'Gods of the fen', default: 'off', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] } };
const KEEPER: CampaignEntry = {
  kind: 'patron',
  packEntryId: 'ex-patron-keeper',
  name: 'The Lamp Keeper',
  packId: 'pack-a',
  data: { id: 'ex-patron-keeper', name: 'The Lamp Keeper', option: 'ex-opt-gods', followers: { classes: ['marsh-chaplain'] }, holyGarb: [{ atSpellLevel: 0, text: 'A grey hood', itemIds: ['ex-hood'] }] },
};

const setting = (choices: Record<string, string>) => settingFrom([link('pack-a', 2), link('pack-b', 1, choices)], [OPTION, KEEPER], {});
const patrons = (s: ReturnType<typeof setting>) => s.all.filter((e) => e.kind === 'patron');

describe('a patron gated by an option from another attached pack (pt-9)', () => {
  // Purpose: off by default, the patron is marked off by the option reader and no class is offered it.
  it('is off while the other pack leaves its option at the default', () => {
    const off = setting({});
    expect(patrons(off)[0]!.optionOff).toBe('ex-opt-gods');
    expect(patronsFor(patrons(off), 'marsh-chaplain')).toEqual([]);
  });

  // Purpose: the GM's choice in the option's own pack turns it on: the patron is in play and offered to its class.
  it("is in play once the GM's choice turns the option on", () => {
    const on = setting({ 'ex-opt-gods': 'on' });
    expect(patrons(on)[0]!.optionOff).toBeUndefined();
    expect(patronsFor(patrons(on), 'marsh-chaplain').map((o) => o.patron.name)).toEqual(['The Lamp Keeper']);
  });
});

describe('hide and keep: a picked patron while its option is off (ruling of 2026-11-12)', () => {
  const creation = { patron: { id: 'ex-patron-keeper', name: 'The Lamp Keeper' } };

  // Purpose: with the option off, the character's patron reads as none everywhere that reads it; the record is unchanged.
  it('is hidden while off, and back when switched on again, the record untouched', () => {
    const record = structuredClone(creation);
    expect(patronOf(record, patrons(setting({})))).toBeNull();
    expect(patronInSetting(setting({}), record)).toBeNull();
    expect(patronInSetting(setting({ 'ex-opt-gods': 'on' }), record)?.name).toBe('The Lamp Keeper');
    expect(record).toEqual(creation);
  });

  // Purpose: the Gear step's garb, while the patron is hidden, gives nothing more and keeps what was given (the same
  // patron's id, no items): the garb already in the pack stays there.
  it('gives no garb while off, and keeps the patron named so the garb already given stays', () => {
    const garb = patronGarbFor(setting({}), creation, { level: 1, classRef: 'marsh-chaplain', raceRef: null }, []);
    expect(garb).toMatchObject({ id: 'ex-patron-keeper', itemIds: [], kept: true });
    const on = patronGarbFor(setting({ 'ex-opt-gods': 'on' }), creation, { level: 1, classRef: 'marsh-chaplain', raceRef: null }, []);
    expect(on?.itemIds).toEqual(['ex-hood']);
    expect(on?.kept).toBeUndefined();
  });
});
