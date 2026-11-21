// Copy the set-up (cs-set-1, ruled 2026-11-10): the summary's words and order.
import { describe, expect, it } from 'vitest';
import type { OptionalRule } from '../modules/library/options.ts';
import { ruleClashes, type RuleSource } from '../modules/library/ruleGroups.ts';
import type { RuleGroup } from '../ui/organisms.tsx';
import { setupText } from './setupText.ts';

const rule = (id: string, name: string, choices: string[], defaultChoice: string): OptionalRule => ({
  id,
  name,
  choices: choices.map((c) => ({ id: c.toLowerCase().replace(/ /g, '-'), name: c, notes: '' })),
  defaultChoice,
  changeLater: 'allow',
  notes: '',
  category: '',
  source: '',
  ruleKey: '',
  extends: '',
});

const source = (shortName: string, rules: OptionalRule[], choices: Record<string, string> = {}): RuleSource => ({
  packId: `pack-${shortName}`,
  name: shortName,
  shortName,
  kind: 'setting',
  rules,
  choices,
});

const appGroups = (startLevel: string): RuleGroup[] => [
  {
    id: 'characters',
    name: 'Characters',
    rules: [
      { id: 'characterApproval', name: 'New characters need approval', source: 'App', choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], value: 'yes', defaultValue: 'yes' },
      {
        id: 'startLevel',
        name: 'New characters start at',
        source: 'App',
        choices: [
          { value: 'one', label: 'Level 1' },
          { value: 'fixed', label: 'Fixed level' },
        ],
        value: startLevel,
        defaultValue: 'one',
      },
    ],
  },
  { id: 'time', name: 'Time and calendar', rules: [], summary: 'Starts at 8:00 (the default)' },
];

const lanternLimits = rule('lantern-limits', 'Lantern limits', ['Off', 'Lifted'], 'off');
const reedSlots = rule('reed-slots', 'Reed slots', ['Ten', 'Twelve'], 'ten');

describe('setupText', () => {
  it('lists the name, the packs with their versions, the start level, the app settings, then the changed rules before the rest', () => {
    const text = setupText({
      campaignName: 'The Mire Road',
      packs: [{ name: 'Mire Rules', version: '0.4.2' }],
      appGroups: appGroups('one'),
      fixedLevel: 3,
      sources: [source('Mire', [reedSlots, lanternLimits], { 'lantern-limits': 'lifted' })],
    });
    expect(text).toBe(
      [
        'The Mire Road',
        '',
        'Setting rules',
        '- Mire Rules, version 0.4.2',
        '',
        'New characters start at: Level 1',
        '',
        'App settings',
        '- New characters need approval: Yes',
        '- Starts at 8:00 (the default)',
        '',
        'Optional rules changed from the book',
        '- Lantern limits: Lifted',
        '',
        'Optional rules as the book has them',
        '- Reed slots: Ten',
        '',
      ].join('\n'),
    );
  });

  it('says which level a fixed start level is', () => {
    const text = setupText({ campaignName: 'Fen', packs: [], appGroups: appGroups('fixed'), fixedLevel: 3, sources: [] });
    expect(text).toContain('New characters start at: Fixed level (level 3)');
  });

  it('names each rule\'s pack only when more than one pack has optional rules', () => {
    const two = setupText({
      campaignName: 'Fen',
      packs: [],
      appGroups: [],
      fixedLevel: 1,
      sources: [source('Mire', [lanternLimits]), source('Reed zine', [reedSlots])],
    });
    expect(two).toContain('- Lantern limits (Mire): Off');
    expect(two).toContain('- Reed slots (Reed zine): Ten');
    const one = setupText({ campaignName: 'Fen', packs: [], appGroups: [], fixedLevel: 1, sources: [source('Mire', [lanternLimits]), source('Reed zine', [])] });
    expect(one).toContain('- Lantern limits: Off');
  });

  it('marks a rule another pack decides with the pack and choice that count', () => {
    const zineCounts = { ...rule('item-counts', 'Item counts', ['Off', 'On'], 'off'), ruleKey: 'item-counts' };
    const mireCounts = { ...rule('item-counts', 'Item counts', ['Off', 'On'], 'off'), ruleKey: 'item-counts' };
    const sources = [source('Zine', [zineCounts], { 'item-counts': 'on' }), source('Mire', [mireCounts])];
    const text = setupText({ campaignName: 'Fen', packs: [], appGroups: [], fixedLevel: 1, sources, clashes: ruleClashes(sources) });
    expect(text).toContain('- Item counts (Mire): Off (decided above: Zine, On)');
    expect(text).toContain('- Item counts (Zine): On\n');
  });

  it('leaves out the version for a pack that has none', () => {
    const text = setupText({ campaignName: 'Fen', packs: [{ name: 'Fen homebrew', version: '' }], appGroups: [], fixedLevel: 1, sources: [] });
    expect(text).toContain('Setting rules\n- Fen homebrew\n');
  });

  it('says "None" where a campaign has no packs, no optional rules, or nothing changed', () => {
    const bare = setupText({ campaignName: 'Fen', packs: [], appGroups: [], fixedLevel: 1, sources: [] });
    expect(bare).toContain('Setting rules\n- None attached');
    expect(bare).toContain('Optional rules\n- None');
    const unchanged = setupText({ campaignName: 'Fen', packs: [], appGroups: [], fixedLevel: 1, sources: [source('Mire', [lanternLimits])] });
    expect(unchanged).toContain('Optional rules changed from the book\n- None');
    expect(unchanged).toContain('Optional rules as the book has them\n- Lantern limits: Off');
  });
});
