// Which pack's switch governs when two attached packs carry an option of the same id (dec-required-packs-and-pack-
// choices-2026-11-13, "Not confirmed"). A test only: it states what happens today and changes nothing. Two invented
// packs, Fen Rules and Moss Rules, each with the option "lantern-light" (Bright or Dim) and a rules set whose
// `byOption` writes which choice it read. Read through settingFrom (the campaign's setting rules, as the app builds
// them), choiceInPlay and choicesInPlay (the single global reader), with the stack in both orders.
import { describe, expect, it } from 'vitest';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { choiceInPlay, choicesInPlay, settingFrom } from './campaignSetting.ts';

const option = (packId: string): CampaignEntry => ({
  packId,
  kind: 'option',
  packEntryId: 'lantern-light',
  name: 'Lantern light',
  data: { id: 'lantern-light', name: 'Lantern light', default: 'bright', choices: [{ id: 'bright', name: 'Bright' }, { id: 'dim', name: 'Dim' }] },
});
const rulesSet = (packId: string, id: string): CampaignEntry => ({
  packId,
  kind: 'rulesSet',
  packEntryId: id,
  name: id,
  data: { id, name: id, lightNote: 'none', byOption: { 'lantern-light=bright': { lightNote: 'Bright' }, 'lantern-light=dim': { lightNote: 'Dim' } } },
});
const pack = (packId: string, name: string, priority: number, choices: Record<string, string>): CampaignPack => ({
  id: `link-${packId}`,
  campaignId: 'camp-ash',
  packId,
  name,
  shortName: name,
  version: '1',
  kind: 'setting',
  optionChoices: choices,
  priority,
  overrides: {},
  campaignHomebrew: false,
});

const fenFirst = [option('pack-fen'), rulesSet('pack-fen', 'fen-rules-set'), option('pack-moss'), rulesSet('pack-moss', 'moss-rules-set')];
const mossFirst = [option('pack-moss'), rulesSet('pack-moss', 'moss-rules-set'), option('pack-fen'), rulesSet('pack-fen', 'fen-rules-set')];

/** Each rules set's lightNote, by rules set id, as the campaign's setting rules resolve it. */
const notes = (packs: CampaignPack[], entries: CampaignEntry[]) => Object.fromEntries(settingFrom(packs, entries, null).rulesSets.map((r) => [String(r.id), r.lightNote]));
/** The single global reader's choice. */
const global = (packs: CampaignPack[], entries: CampaignEntry[]) => choiceInPlay(settingFrom(packs, entries, null), 'lantern-light');

describe('two packs carry an option of the same id: what happens today', () => {
  // Fen Rules has Bright switched on, Moss Rules has Dim.
  const fenOnTop = [pack('pack-fen', 'Fen Rules', 2, { 'lantern-light': 'bright' }), pack('pack-moss', 'Moss Rules', 1, { 'lantern-light': 'dim' })];
  const mossOnTop = [pack('pack-fen', 'Fen Rules', 1, { 'lantern-light': 'bright' }), pack('pack-moss', 'Moss Rules', 2, { 'lantern-light': 'dim' })];

  // Purpose: the stack is resolved with both packs' option kept (an option is each pack's own), so the reader has two.
  it('keeps both packs’ option entries in the campaign’s setting rules', () => {
    expect(settingFrom(fenOnTop, fenFirst, null).all.filter((e) => e.kind === 'option').map((e) => e.packId).sort()).toEqual(['pack-fen', 'pack-moss']);
  });

  // Purpose: the single global reader reads the switch of whichever pack's option comes first in the entries it is
  // given, whatever the stack's order: Fen's entries first reads Bright with either pack on top; Moss's first, Dim.
  it('the global reader follows the order of the entries, not the stack', () => {
    expect(global(fenOnTop, fenFirst)).toBe('bright');
    expect(global(mossOnTop, fenFirst)).toBe('bright');
    expect(global(fenOnTop, mossFirst)).toBe('dim');
    expect(global(mossOnTop, mossFirst)).toBe('dim');
    expect(choicesInPlay({ all: fenFirst, packs: mossOnTop })['lantern-light']).toBe('bright');
  });

  // Purpose: every rules set reads that same one switch, its own pack's ignored: with Fen's entries first both read
  // Bright, though Moss Rules has Dim switched on, in either stack order.
  it('every rules set reads the global reader’s switch, the other pack’s own switch ignored', () => {
    expect(notes(fenOnTop, fenFirst)).toEqual({ 'fen-rules-set': 'Bright', 'moss-rules-set': 'Bright' });
    expect(notes(mossOnTop, fenFirst)).toEqual({ 'fen-rules-set': 'Bright', 'moss-rules-set': 'Bright' });
    expect(notes(fenOnTop, mossFirst)).toEqual({ 'fen-rules-set': 'Dim', 'moss-rules-set': 'Dim' });
  });
});
