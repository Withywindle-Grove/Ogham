// The load method the setting rules set (A3, bq3-13) and the shared reader's add-ons (A1). Invented packs only.
import { describe, expect, it } from 'vitest';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import type { PackEntry } from '../modules/library/packFile.ts';
import { choicesInPlay } from './campaignSetting.ts';
import { loadMethodOf, loadSwitchesOf, modesOfferedBy } from './loadMethod.ts';

const rulesSet: PackEntry = {
  kind: 'rulesSet',
  packEntryId: 'fen-rules',
  name: 'Fen rules',
  data: { encumbrance: { coin: { maxLoadCoin: 500 }, byOption: { 'carry=coin': { mode: 'coin' }, 'carry=slot': { mode: 'slot' } } } },
};

describe('the load method (A3)', () => {
  // Purpose: the method follows the choice the rule has now, as at set-up.
  it('follows the encumbrance choice', () => {
    expect(loadMethodOf([{ entries: [rulesSet], choices: { carry: 'coin' } }])).toBe('coin');
    expect(loadMethodOf([{ entries: [rulesSet], choices: {} }])).toBe('none');
  });

  // Purpose: a method the packs give no data for (slots here) isn't set: the campaign reads "Not tracked".
  it('sets only a method the packs give data for', () => {
    expect(modesOfferedBy([{ entries: [rulesSet], choices: {} }])).toEqual(['none', 'coin']);
    expect(loadMethodOf([{ entries: [rulesSet], choices: { carry: 'slot' } }])).toBe('none');
  });
});

describe('the shared reader and requires (A1)', () => {
  // Purpose: an add-on stored on reads its default while its parent is off, and its stored choice once the parent is on.
  it('reads a hidden add-on at its default', () => {
    const option = (packId: string, data: Record<string, unknown>): CampaignEntry => ({ kind: 'option', packEntryId: String(data.id), name: String(data.id), data, packId });
    const all = [
      option('fen', { id: 'songs', default: 'off', choices: [{ id: 'off' }, { id: 'on' }] }),
      option('reed', { id: 'chorus', default: 'off', requires: { songs: 'on' }, choices: [{ id: 'off' }, { id: 'on' }] }),
    ];
    const link = (packId: string, optionChoices: Record<string, string>) => ({ id: `link-${packId}`, packId, optionChoices }) as unknown as CampaignPack;
    expect(choicesInPlay({ all, packs: [link('fen', {}), link('reed', { chorus: 'on' })] })).toEqual({ songs: 'off', chorus: 'off' });
    expect(choicesInPlay({ all, packs: [link('fen', { songs: 'on' }), link('reed', { chorus: 'on' })] })).toEqual({ songs: 'on', chorus: 'on' });
  });
});

describe('the one switch for how load is carried (2026-10-24; gate check 4)', () => {
  const carry = { id: 'carry', choices: [{ id: 'none' }, { id: 'coin' }, { id: 'slot' }] };
  const songs = { id: 'songs', choices: [{ id: 'off' }, { id: 'on' }] };

  // Purpose: an option whose choice moves the load method is found by what the rules set does, not by its id; one
  // that moves nothing isn't.
  it('finds the option that moves the method, whatever its id', () => {
    expect(loadSwitchesOf([{ entries: [rulesSet], choices: {}, rules: [carry, songs] }])).toEqual(['carry']);
    expect(loadSwitchesOf([{ entries: [rulesSet], choices: {}, rules: [songs] }])).toEqual([]);
  });

  // Purpose: an overlay's rules set may set the method from the base's option (of-1, `extends`): with the base's
  // option holding the overlay's choice, the base's option is the switch even when the base alone moves nothing.
  it("finds a base option an overlay's rules set reads", () => {
    const bare: PackEntry = { kind: 'rulesSet', packEntryId: 'moor', name: 'Moor', data: { encumbrance: { mode: 'none' } } };
    const zine: PackEntry = { kind: 'rulesSet', packEntryId: 'zine', name: 'Zine', data: { encumbrance: { coin: { maxLoadCoin: 300 } }, byOption: { 'carry=coin': { encumbrance: { mode: 'coin' } } } } };
    const joined = { id: 'carry', choices: [{ id: 'none' }, { id: 'coin' }] };
    expect(loadSwitchesOf([{ entries: [bare], choices: {}, rules: [joined] }])).toEqual([]);
    expect(loadSwitchesOf([{ entries: [bare], choices: {}, rules: [joined] }, { entries: [zine], choices: {}, rules: [] }])).toEqual(['carry']);
  });
});
