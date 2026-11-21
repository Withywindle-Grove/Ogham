// The stat block's layout from its pack (pf-13; December 5c, mockup december/06-stat-block). Invented creatures only.
import { describe, expect, it } from 'vitest';
import { layOutStatBlock, readStatBlockLayout, type Figure } from './statBlockLayout.ts';

const lurker = {
  id: 'bog-lurker',
  name: 'Bog lurker',
  description: 'A grey shape under the duckweed.',
  hp: '2d8',
  hpAverage: 9,
  fields: { Size: 'Medium beast', Wits: 'animal wits', Level: '2', Armour: '7', Saves: 'D12 W13 S14', Attacks: 'Bite (+1, 1d6)', Speed: '60 swimming', Morale: '8', Met: '2d4', Secret: 'Fears salt' },
  abilities: [{ name: 'Drag under', note: 'A bitten character is held.' }],
  groupAbilities: [{ name: 'Dark sight', note: 'Sees without light.' }],
  tags: ['swamp'],
  source: 'p. 31',
};

const layout = {
  descriptor: ['Size', 'Wits', 'Alignment'],
  groups: [
    [['Level', 'Armour', 'hp', 'Saves'], ['Attacks'], ['Speed', 'Morale', 'Experience']],
    [['Met'], ['Speech']],
  ],
  hide: ['Secret'],
};

const words = (figures: Figure[]) => figures.map((f) => `${f.label} ${f.value}`);

describe('readStatBlockLayout', () => {
  // Purpose: a pack's meta.statBlockLayout is read as its descriptor, its groups of lines of labels and its hidden labels.
  it('reads the descriptor, groups and hidden labels from the pack meta', () => {
    expect(readStatBlockLayout({ statBlockLayout: layout })).toEqual(layout);
  });

  // Purpose: a pack with no layout reads as none, and a broken part is left out rather than failing.
  it('reads no layout as null and leaves broken parts out', () => {
    expect(readStatBlockLayout({})).toBeNull();
    expect(readStatBlockLayout(null)).toBeNull();
    expect(readStatBlockLayout({ statBlockLayout: 'groups' })).toBeNull();
    expect(readStatBlockLayout({ statBlockLayout: { descriptor: 'Size', groups: [[['Level', 3, ' Armour ']], 'Attacks', [[]]], hide: [null, 'Secret'] } })).toEqual({
      descriptor: [],
      groups: [[['Level', 'Armour']]],
      hide: ['Secret'],
    });
  });
});

describe('layOutStatBlock', () => {
  // Purpose: with its pack's layout, a block shows its descriptor on one line, then each group's lines in order; "hp" is
  // its hit points with the average; a label the block lacks is skipped, and a line or group left empty isn't drawn.
  it('lays a block out by its pack layout, skipping what it lacks', () => {
    const shown = layOutStatBlock(lurker, layout);
    expect(shown.descriptor).toBe('Medium beast, animal wits');
    expect(shown.groups.map((g) => g.map(words))).toEqual([
      [['Level 2', 'Armour 7', 'Hit points 2d8 (9)', 'Saves D12 W13 S14'], ['Attacks Bite (+1, 1d6)'], ['Speed 60 swimming', 'Morale 8']],
      [['Met 2d4']],
    ]);
    expect(shown.notes).toEqual(['A grey shape under the duckweed.']);
  });

  // Purpose: a hidden label is never shown, anywhere in the block.
  it('never shows a hidden label', () => {
    const shown = layOutStatBlock(lurker, layout);
    expect(JSON.stringify(shown)).not.toContain('Fears salt');
  });

  // Purpose (pf-13b, 2026-11-13): a layout's name matches a field exactly, case included; a name in another case places
  // nothing, and the field still shows after the groups, as the pack wrote it.
  it('matches labels exactly, case included', () => {
    const shown = layOutStatBlock(lurker, { descriptor: [], groups: [[['level', 'ARMOUR'], ['Level', 'Armour']]], hide: [] });
    expect(words(shown.groups[0]![0]!)).toEqual(['Level 2', 'Armour 7']);
    expect(shown.groups[0]).toHaveLength(1);
    const wrongCase = layOutStatBlock(lurker, { descriptor: [], groups: [[['level']]], hide: ['secret'] });
    expect(wrongCase.groups.flat(2).map((f) => f.label)).toContain('Level');
    expect(JSON.stringify(wrongCase)).toContain('Fears salt');
  });

  // Purpose (pf-13b): "hp" in lower case is the reserved name for hit points; a field spelt "HP" is an ordinary field,
  // placed by its own name, and hiding one never hides the other.
  it('keeps "hp" (hit points) and a field spelt "HP" apart', () => {
    const block = { ...lurker, fields: { ...lurker.fields, HP: 'Hunger points 3' } };
    const placed = layOutStatBlock(block, { descriptor: [], groups: [[['hp'], ['HP']]], hide: [] });
    expect(placed.groups[0]!.map(words)).toEqual([['Hit points 2d8 (9)'], ['HP Hunger points 3']]);
    const hideHp = JSON.stringify(layOutStatBlock(block, { descriptor: [], groups: [], hide: ['hp'] }));
    expect(hideHp).not.toContain('2d8 (9)');
    expect(hideHp).toContain('Hunger points 3');
    const hideHP = JSON.stringify(layOutStatBlock(block, { descriptor: [], groups: [], hide: ['HP'] }));
    expect(hideHP).toContain('2d8 (9)');
    expect(hideHP).not.toContain('Hunger points 3');
  });

  // Purpose: a figure the layout neither places nor hides still shows, after the layout's groups, so nothing is lost.
  it('puts figures the layout names nowhere in a last group', () => {
    const shown = layOutStatBlock({ ...lurker, fields: { ...lurker.fields, Lair: 'Under the jetty' } }, layout);
    expect(shown.groups.map((g) => g.map(words))).toHaveLength(3);
    expect(words(shown.groups[2]![0]!)).toEqual(['Lair Under the jetty']);
  });

  // Purpose: with no layout, the figures are one compact group in the pack's own order, with no descriptor (frame 6).
  it('falls back to one group in the pack order', () => {
    const shown = layOutStatBlock(lurker, null);
    expect(shown.descriptor).toBeNull();
    expect(shown.groups).toHaveLength(1);
    expect(shown.groups[0]).toHaveLength(1);
    expect(words(shown.groups[0]![0]!).slice(0, 4)).toEqual(['Hit points 2d8 (9)', 'Size Medium beast', 'Wits animal wits', 'Level 2']);
  });

  // Purpose: abilities are the block's own, then its family's, each a name and its words; none gives an empty list.
  it('lists the abilities, its own then its family’s', () => {
    expect(layOutStatBlock(lurker, layout).abilities).toEqual([
      { name: 'Drag under', note: 'A bitten character is held.' },
      { name: 'Dark sight', note: 'Sees without light.' },
    ]);
    expect(layOutStatBlock({ name: 'Reed hag', fields: { Armour: '5' } }, null).abilities).toEqual([]);
  });

  // Purpose: a block with three figures only draws one short line, with no descriptor, no second group and no abilities.
  it('draws three figures only as one line and nothing empty', () => {
    const shown = layOutStatBlock({ name: 'Reed wisp', fields: { Armour: '9', 'Hit points': '1', Speed: '10' } }, layout);
    expect(shown.descriptor).toBeNull();
    expect(shown.groups.map((g) => g.map(words))).toEqual([[['Armour 9'], ['Speed 10']], [['Hit points 1']]]);
    expect(shown.abilities).toEqual([]);
    expect(shown.rest).toEqual([]);
  });

  // Purpose: the waiting card's stat line is the layout's first group run on as one line; with no layout, the first six figures.
  it('gives the stat line: the first group, or the first six figures', () => {
    expect(words(layOutStatBlock(lurker, layout).line)).toEqual(['Level 2', 'Armour 7', 'Hit points 2d8 (9)', 'Saves D12 W13 S14', 'Attacks Bite (+1, 1d6)', 'Speed 60 swimming', 'Morale 8']);
    expect(layOutStatBlock(lurker, null).line).toHaveLength(6);
  });

  // Purpose: the rest of what a block holds (its sizes, say) still shows as lines; the app's own bookkeeping doesn't.
  it('keeps other parts as lines and leaves the bookkeeping out', () => {
    const shown = layOutStatBlock({ ...lurker, variants: [{ name: 'Large', hp: '4d8' }], profile: 'skulker', saves: { D: 12 } }, layout);
    expect(shown.rest.map((l) => l.label)).toEqual(['Variants']);
  });

  // Purpose: saves the pack gives only as a structure still show, as one figure ("D12 W13").
  it('shows structured saves as one figure when no Saves label exists', () => {
    const shown = layOutStatBlock({ name: 'Reed hag', fields: { Armour: '5' }, saves: { D: 10, W: 11, Spell: 12 } }, { descriptor: [], groups: [[['Armour', 'Saves']]], hide: [] });
    expect(words(shown.groups[0]![0]!)).toEqual(['Armour 5', 'Saves D10 W11 Spell 12']);
  });

  // Purpose: 999 and 2,300 and very long values come through as written.
  it('keeps messy values as written', () => {
    const shown = layOutStatBlock({ name: 'Mire titan', fields: { Experience: '2,300', Met: 999, Attacks: 'two claws, a bite, a tail lash and a hurled stone once every third round' } }, null);
    expect(words(shown.line)).toEqual(['Experience 2,300', 'Met 999', 'Attacks two claws, a bite, a tail lash and a hurled stone once every third round']);
  });
});
