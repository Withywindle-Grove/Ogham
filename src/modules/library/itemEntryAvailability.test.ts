// A thing's entry gains "Rarity" and "Sold in" (town row TC11, the stack's W9c; tn-5, tn-6; page 19 frame TW8b's second
// entry card, ap-13). Invented things only. In plain words:
//   * a pack's rarity word shows as its own labelled line, "Rarity";
//   * where a thing is sold shows as "Sold in", the settlement sizes as the pack names them, a note in words riding on
//     the same line;
//   * the two lines show only where the pack gives them: nothing for a thing with neither;
//   * the entry never shows the chance ("x-in-y" or "always"), for a player or for the GM: the chance lives in the GM's
//     stock table, never in the entry (TW8b, TW8j);
//   * an availability the pack keeps GM-only still shows nothing to a player.
import { describe, expect, it } from 'vitest';
import { describeEntry, type Line } from './describe.ts';
import type { PackEntry } from './packFile.ts';

const item = (availability: unknown, extra: Record<string, unknown> = {}): PackEntry => ({
  kind: 'item',
  packEntryId: 'spyglass',
  name: 'Spyglass',
  data: { id: 'spyglass', name: 'Spyglass', value: { crowns: 40 }, slots: 1, availability, ...extra },
});

const nameOf = () => undefined;
const labelled = (lines: readonly Line[]) => lines.map((l) => [l.label, l.value ?? '']);
const words = (lines: readonly Line[]) => JSON.stringify(lines);

describe("a thing's entry: Rarity and Sold in (TC11, TW8b)", () => {
  it.fails('shows the rarity and where it is sold as two labelled lines, the note riding on "Sold in"', () => {
    // Purpose (TW8b, ap-13): the second entry card's two lines, "Rarity" and "Sold in", in the entry's own format.
    const { lines } = describeEntry(item({ where: ['Town', 'city'], rarity: 'rare', note: 'Waterside settlements only.' }), nameOf);
    expect(labelled(lines)).toContainEqual(['Rarity', 'Rare']);
    expect(labelled(lines)).toContainEqual(['Sold in', 'Town and city. Waterside settlements only.']);
    expect(lines.some((l) => l.label === 'Availability')).toBe(false);
  });

  it.fails('shows each line only where the pack gives it', () => {
    // Purpose (TC11's test): with and without each; a thing with neither has neither line.
    const rarityOnly = labelled(describeEntry(item({ rarity: 'Uncommon' }), nameOf).lines);
    expect(rarityOnly).toContainEqual(['Rarity', 'Uncommon']);
    expect(rarityOnly.some(([label]) => label === 'Sold in')).toBe(false);
    const noteOnly = labelled(describeEntry(item({ note: 'Only from the lock-keepers' }), nameOf).lines);
    expect(noteOnly).toContainEqual(['Sold in', 'Only from the lock-keepers']);
    expect(noteOnly.some(([label]) => label === 'Rarity')).toBe(false);
    const sizesOnly = labelled(describeEntry(item({ where: ['Hamlet', 'Village', 'Town'] }), nameOf).lines);
    expect(sizesOnly).toContainEqual(['Sold in', 'Hamlet, Village and Town.']);
    const neither = describeEntry(item(undefined), nameOf).lines;
    expect(neither.some((l) => ['Rarity', 'Sold in', 'Availability'].includes(l.label))).toBe(false);
  });

  it.fails('never shows the chance, to a player or to the GM', () => {
    // Purpose (TC11: "A player's entry never shows a chance"; TW8b draws the entry the same for the GM and a player).
    for (const gm of [false, true]) {
      const chanceOnly = describeEntry(item({ chance: '3-in-6' }), nameOf, { gm }).lines;
      expect(words(chanceOnly)).not.toContain('3-in-6');
      expect(chanceOnly.some((l) => ['Rarity', 'Sold in', 'Availability'].includes(l.label))).toBe(false);
      const always = describeEntry(item({ where: ['Town'], chance: 'always', rarity: 'common' }), nameOf, { gm }).lines;
      expect(words(always)).not.toMatch(/always/i);
      expect(labelled(always)).toContainEqual(['Sold in', 'Town.']);
    }
  });

  it.fails('keeps an availability the pack marks GM-only from a player', () => {
    // Purpose (hard rule 5): a field the pack hides stays hidden; the GM still reads its two lines.
    const hidden = item({ rarity: 'rare', where: ['City'] }, { gmOnly: ['availability'] });
    expect(describeEntry(hidden, nameOf).lines.some((l) => ['Rarity', 'Sold in'].includes(l.label))).toBe(false);
    expect(labelled(describeEntry(hidden, nameOf, { gm: true }).lines)).toContainEqual(['Rarity', 'Rare']);
  });
});
