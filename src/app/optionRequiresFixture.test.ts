// Options-gates build order 5 (bq3-13) on the invented fixtures scripts/fixtures/options-gates-5-requires.fixture.json
// (Lantern fen: an add-on chain, a carrying rule, a preset) and options-gates-5-overlay.fixture.json (Reed hymnal: an
// add-on to the base's option). The manual checks in docs/testing.md use the same files. Always runs.
import { describe, expect, it } from 'vitest';
import baseFixture from '../../scripts/fixtures/options-gates-5-requires.fixture.json?raw';
import overlayFixture from '../../scripts/fixtures/options-gates-5-overlay.fixture.json?raw';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { readOptions, readPresets } from '../modules/library/options.ts';
import { readPackJson, type PackEntry } from '../modules/library/packFile.ts';
import { offeredSources, presetChanges, withExtends, type RuleSource } from '../modules/library/ruleGroups.ts';
import { choicesInPlay, settingFrom } from './campaignSetting.ts';
import { loadMethodOf } from './loadMethod.ts';

const entriesOf = (raw: string): PackEntry[] => {
  const read = readPackJson(raw);
  if (!read.ok) throw new Error(read.message);
  return read.pack.entries;
};
const base = entriesOf(baseFixture);
const overlay = entriesOf(overlayFixture);

const link = (packId: string, kind: 'setting' | 'homebrew', priority: number, optionChoices: Record<string, string>): CampaignPack => ({
  id: `link-${packId}`,
  campaignId: 'c-1',
  packId,
  name: packId,
  shortName: packId,
  version: '0.1',
  kind,
  optionChoices,
  priority,
  overrides: {},
  campaignHomebrew: false,
});

/** Both packs attached (the overlay on top), with these choices. */
function sources(fen: Record<string, string> = {}, reed: Record<string, string> = {}): RuleSource[] {
  return withExtends([
    { packId: 'reed', name: 'Reed hymnal', shortName: 'Reed hymnal', kind: 'homebrew', rules: readOptions(overlay), choices: reed },
    { packId: 'fen', name: 'Lantern fen', shortName: 'Lantern fen', kind: 'setting', rules: readOptions(base), choices: fen, presets: readPresets(base) },
  ]);
}
const offeredIds = (all: RuleSource[]) => offeredSources(all).flatMap((s) => s.rules.map((r) => r.id));

describe('the Lantern fen fixtures (A1, A3, A8)', () => {
  // Purpose: with Lantern songs off, neither its add-on nor the overlay's is offered; on, both are; the add-on to the add-on waits for it.
  it('offers each add-on only once its parent is on', () => {
    expect(offeredIds(sources())).toEqual(['lantern-carrying', 'lantern-songs', 'lantern-oaths']);
    expect(offeredIds(sources({ 'lantern-songs': 'on' }))).toEqual(['reed-hymnal-night', 'lantern-carrying', 'lantern-songs', 'lantern-chorus', 'lantern-oaths']);
    expect(offeredIds(sources({ 'lantern-songs': 'on', 'lantern-chorus': 'on' }))).toContain('lantern-echo');
  });

  // Purpose: through the campaign's setting, stored add-ons read their default while Lantern songs is off.
  it('reads the add-ons at their defaults while their parent is off', () => {
    const entries = [...base.map((e) => ({ ...e, packId: 'fen' })), ...overlay.map((e) => ({ ...e, packId: 'reed' }))];
    const stored = { 'lantern-chorus': 'on', 'lantern-echo': 'on' };
    const off = choicesInPlay(settingFrom([link('fen', 'setting', 1, stored), link('reed', 'homebrew', 2, { 'reed-hymnal-night': 'on' })], entries, {}));
    expect(off).toMatchObject({ 'lantern-songs': 'off', 'lantern-chorus': 'off', 'lantern-echo': 'off', 'reed-hymnal-night': 'off' });
    const on = choicesInPlay(settingFrom([link('fen', 'setting', 1, { ...stored, 'lantern-songs': 'on' }), link('reed', 'homebrew', 2, { 'reed-hymnal-night': 'on' })], entries, {}));
    expect(on).toMatchObject({ 'lantern-chorus': 'on', 'lantern-echo': 'on', 'reed-hymnal-night': 'on' });
  });

  // Purpose: the carrying rule's choice sets the load method.
  it('moves the load method with the carrying rule', () => {
    expect(loadMethodOf([{ entries: base, choices: {} }])).toBe('none');
    expect(loadMethodOf([{ entries: base, choices: { 'lantern-carrying': 'coin' } }])).toBe('coin');
  });

  // Purpose: the preset sets carrying and songs, and leaves the locked oaths once the campaign has started.
  it('plans First night in the fen', () => {
    const plan = presetChanges(sources(), 'fen', 'first-night', { attaching: false })!;
    expect(plan.moves.map((m) => `${m.name}: ${m.from} → ${m.to}`)).toEqual(['Carrying: Not tracked → By coin weight', 'Lantern songs: Off → On']);
    expect(plan.kept.map((k) => k.name)).toEqual(['Bog oaths']);
  });
});
