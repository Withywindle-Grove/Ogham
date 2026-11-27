import { describe, expect, it } from 'vitest';
import { prepareView } from '../modules/characters/magicView.ts';
import { CHOOSE_AT_ONCE, castToastText, readyAtOnceLine } from './MagicTab.tsx';
import { countedNames, footLine, forLine, fullLevelWhy, levelLine, noneChosenTitle, noneChosenWhy, nothingToChoose, OPEN_LINE, openFootLine, slotsToFill } from './PrepareScreen.tsx';

// Prepare's words (dec-8 C; mockup magic/06). Purposes, in plain words:
//   * a counted list reads "Mire lamp ×2, Reed whisper", in the order given, with no "×1";
//   * the level line says the slots a day and how many are chosen, "None" for nought;
//   * the full level's pop-up says how many a day and that they're all chosen, in words for one, two and more;
//   * the foot says it saves as you go, and how many slots are still empty only when some are;
//   * the first line names whose next rest it is, with the apostrophe alone after a name ending in s;
//   * − on a spell not chosen says, by name, that it isn't chosen and so there's none to take out;
//   * a level with nothing to choose says so in one short sentence that names the level (fix 2, 2026-11-18).
describe("Prepare's words", () => {
  it('says a level has nothing to choose, in one short sentence', () => {
    expect(nothingToChoose(2)).toBe('Nothing to choose at level 2.');
  });

  it('counts a list in words, in the order given', () => {
    const names: Record<string, string> = { lamp: 'Mire lamp', whisper: 'Reed whisper' };
    expect(countedNames([{ spell: 'lamp', level: 1, count: 2 }, { spell: 'whisper', level: 2, count: 1 }], (c) => names[c.spell]!)).toBe('Mire lamp ×2, Reed whisper');
    expect(countedNames([], () => '')).toBe('');
  });

  it('says the level line with "None" for nothing chosen', () => {
    expect(levelLine({ level: 1, slots: 2, chosen: 2 })).toBe('Level 1, 2 a day. 2 chosen');
    expect(levelLine({ level: 2, slots: 1, chosen: 0 })).toBe('Level 2, 1 a day. None chosen');
  });

  it("says why a full level can't take one more, for one, two and more slots", () => {
    expect(fullLevelWhy('Wren', { level: 1, slots: 2 })).toBe('Wren has 2 a day at level 1 and both are chosen. Take one out first.');
    expect(fullLevelWhy('Wren', { level: 3, slots: 1 })).toBe('Wren has 1 a day at level 3 and it is chosen. Take one out first.');
    expect(fullLevelWhy('Brother Alder', { level: 1, slots: 4 })).toBe('Brother Alder has 4 a day at level 1 and all 4 are chosen. Take one out first.');
  });

  it('says the foot, with the empty slots only when there are some', () => {
    expect(footLine(0)).toBe('Saved as you go');
    expect(footLine(1)).toBe('Saved as you go. 1 slot still empty');
    expect(footLine(3)).toBe('Saved as you go. 3 slots still empty');
  });

  it("says why − can't take out a spell that isn't chosen, by name", () => {
    expect(noneChosenTitle('Thorn dart')).toBe("Thorn dart isn't chosen");
    expect(noneChosenWhy('Wren', 'Thorn dart')).toBe("Wren hasn't chosen Thorn dart for the next rest, so there's none to take out.");
  });

  it("names whose next rest it is, with the apostrophe alone after a name ending in s", () => {
    expect(forLine('Wren', 'Nothing is ready today.')).toBe("For Wren's next rest. Nothing is ready today.");
    expect(forLine('Wren of the Lantern Wardens', 'Nothing is ready today.')).toBe("For Wren of the Lantern Wardens' next rest. Nothing is ready today.");
  });
});

// The first spells' words (fsr-8 to fsr-10; page 46). Purposes, in plain words:
//   * while open, Prepare's first line and foot, the tab's Prepare line, the empty row's line and the closing cast's
//     toast read as page 46 has them; none has a middle dot, and the new lines never name the character;
//   * − on a spell not chosen drops "for the next rest" while open, and keeps it once closed;
//   * the one count of empty slots, shared by the tab's line and Prepare's foot, leaves out a level with nothing to
//     choose and an empty book's.
describe("the first spells' words", () => {
  it('reads as page 46 has them, with no middle dot and no name', () => {
    expect(OPEN_LINE).toBe('Until your first cast or rest, what you choose is ready at once.');
    expect([openFootLine(0), openFootLine(1), openFootLine(2)]).toEqual([
      'Ready as you choose',
      'Ready as you choose. 1 slot still empty: fill it before you cast.',
      'Ready as you choose. 2 slots still empty: fill them before you cast.',
    ]);
    expect([readyAtOnceLine(0), readyAtOnceLine(1), readyAtOnceLine(2)]).toEqual(['Ready at once', 'Ready at once. 1 slot empty', 'Ready at once. 2 slots empty']);
    expect(CHOOSE_AT_ONCE).toBe('Choose in Prepare. What you choose is ready at once.');
    expect(castToastText('Mire lamp', true)).toBe('Mire lamp cast. From now, what you choose is ready after you rest.');
    expect(castToastText('Mire lamp', false)).toBe('Mire lamp cast');
    const all = [OPEN_LINE, openFootLine(0), openFootLine(1), openFootLine(2), readyAtOnceLine(0), readyAtOnceLine(2), CHOOSE_AT_ONCE, castToastText('Mire lamp', true)];
    expect(all.filter((line) => line.includes('·'))).toEqual([]);
    expect(all.filter((line) => line.includes('Wren'))).toEqual([]);
  });

  it("drops \"for the next rest\" from −'s line while open", () => {
    expect(noneChosenWhy('Wren', 'Thorn dart', true)).toBe("Wren hasn't chosen Thorn dart, so there's none to take out.");
    expect(noneChosenWhy('Wren', 'Thorn dart', false)).toBe("Wren hasn't chosen Thorn dart for the next rest, so there's none to take out.");
  });

  it('counts the empty slots a choice could fill, not those of a level with nothing to choose', () => {
    const levels = new Map([[1, ['lamp']], [2, []]]);
    expect(slotsToFill(prepareView({ prepared: [], chosen: null }, [2, 1], levels))).toBe(2);
    expect(slotsToFill(prepareView({ prepared: [{ spell: 'lamp', level: 1 }], chosen: null }, [2, 1], levels))).toBe(1);
    expect(slotsToFill(prepareView({ prepared: [], chosen: null }, [1], new Map([[1, []]])))).toBe(0);
  });
});
