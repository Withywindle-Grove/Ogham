import { BRAND } from '../../brand.ts';
import { describe, expect, it } from 'vitest';
import { readPackFile, readPackMarkdown } from './packMarkdown.ts';

// The spec's own example (docs/07-content-packs.md), invented content.
const example = `# Pack: My table's gear
source: Personal conversion
version: 1.0

## item: Rope, 50 ft
category: gear
weight: 50
slots: 1
value: 1 gp

## light: Torch
duration: 6 turns
radius: 30 ft

## statblock: Bog lurker
hp: 3d8 (13)
AC: 6
Move: 60 ft
Attacks: 1 bite (1d6)
Morale: 8
Hides under still water.

## xp: Lantern Warden
2: 1800
3: 3600

## table: Surprise
die: d6
1-2: Surprised
3-6: Not surprised
`;

const read = (text: string) => {
  const result = readPackMarkdown(text);
  if (!result.ok) throw new Error(result.message);
  return result.pack;
};
const entry = (text: string, kind: string, id: string) => read(text).entries.find((e) => e.kind === kind && e.packEntryId === id)?.data;

describe('reading a Markdown pack', () => {
  it("reads the spec's example into the same entries a JSON pack would have", () => {
    const pack = read(example);
    expect(pack.meta).toMatchObject({ name: "My table's gear", version: '1.0', source: 'Personal conversion', kind: 'setting', formatVersion: 1 });
    expect(pack.counts).toEqual({ item: 1, lightType: 1, statBlock: 1, xpTable: 1, table: 1 });
    expect(entry(example, 'item', 'rope-50-ft')).toEqual({ id: 'rope-50-ft', name: 'Rope, 50 ft', category: 'gear', weightCoin: 50, slots: 1, value: { gp: 1 } });
    expect(entry(example, 'lightType', 'torch')).toEqual({ id: 'torch', name: 'Torch', duration: 6, unit: 'turn', radius: '30 ft' });
    expect(entry(example, 'statBlock', 'bog-lurker')).toEqual({
      id: 'bog-lurker',
      name: 'Bog lurker',
      hp: '3d8',
      hpAverage: 13,
      fields: { AC: '6', Move: '60 ft', Attacks: '1 bite (1d6)', Morale: '8' },
      notes: 'Hides under still water.',
    });
    expect(entry(example, 'xpTable', 'lantern-warden')).toEqual({
      id: 'lantern-warden',
      name: 'Lantern Warden',
      levels: [{ level: 2, xp: 1800 }, { level: 3, xp: 3600 }],
    });
    expect(entry(example, 'table', 'surprise')).toEqual({
      id: 'surprise',
      name: 'Surprise',
      die: 'd6',
      rows: [{ min: 1, max: 2, result: 'Surprised' }, { min: 3, max: 6, result: 'Not surprised' }],
    });
    expect(pack.warnings).toEqual([]);
    expect(pack.problems).toEqual([]);
  });

  it('is lenient on format: key case, extra spaces and trailing punctuation, and units after numbers', () => {
    const text = `# Pack: Loose notes
## Item:   Lantern
  WEIGHT :  30 coins.
Slots: 1
Value: 10 gp.

## condition: Stunned
rounds: 1 round
`;
    expect(entry(text, 'item', 'lantern')).toMatchObject({ weightCoin: 30, slots: 1, value: { gp: 10 } });
    expect(entry(text, 'condition', 'stunned')).toMatchObject({ defaultRounds: 1 });
  });

  it("is strict on meaning: it doesn't guess, and lists what it didn't understand instead of dropping it", () => {
    const text = `# Pack: Loose notes
## item: Lantern
wt: 30
weight: 3 lb
Swings on a hook.
`;
    const pack = read(text);
    expect(entry(text, 'item', 'lantern')).toEqual({ id: 'lantern', name: 'Lantern', notes: 'Swings on a hook.' });
    expect(pack.warnings).toEqual([
      `item "Lantern": "wt" isn't a key ${BRAND.appName} knows; it was left out.`,
      'item "Lantern": weight "3 lb" isn\'t in coins; it was left out.',
    ]);
  });

  it('an unknown kind, or the same name twice, is listed and skipped', () => {
    const pack = read(`# Pack: Mixed
## dragon: Grumblewyrm
## item: Rope
## item: Rope
`);
    expect(pack.counts).toEqual({ item: 1 });
    expect(pack.warnings).toContain(`"dragon" isn't a kind of entry ${BRAND.appName} knows; "Grumblewyrm" was left out.`);
    expect(pack.problems).toContain('items: "rope" appears twice; the second was skipped.');
  });

  it("refuses files that aren't Markdown packs, in plain words", () => {
    expect(readPackMarkdown('Just some text')).toEqual({ ok: false, message: 'A Markdown pack starts with a "# Pack: name" line.' });
    expect(readPackMarkdown('# Pack: Empty\nsource: me\n')).toEqual({ ok: false, message: 'The pack has no entries to import.' });
  });
});

describe('choosing the reader', () => {
  it('reads .md files and files starting with "#" as Markdown, everything else as JSON', () => {
    expect(readPackFile('gear.md', example)).toMatchObject({ ok: true });
    expect(readPackFile('gear.txt', example)).toMatchObject({ ok: true });
    expect(readPackFile('gear.json', '{"format": "tabletop-pack", "meta": {"name": "J"}, "items": [{"id": "a"}]}')).toMatchObject({ ok: true });
  });
});

