// A skill's figure when it is rolled the target or higher on one die (tfs-3, 2026-11-19; plan test-feedback-2026-11-19
// row C14; page M1). Invented skills only (Hark, Forage, Climb).
import { describe, expect, it } from 'vitest';
import { skillOdds, targetFigure } from './skillOdds.ts';

describe('the target figure (tfs-3)', () => {
  // Purpose: a skill rolled the target or higher on a d6 reads "5+ on d6", in two parts around the die's glyph.
  it('reads "5+ on d6", the glyph between "5+ on" and "d6"', () => {
    const { shown } = skillOdds(5, 'd6', 'equal-or-over');
    expect(targetFigure(shown, 6)).toEqual({ words: '5+ on d6', target: '5+ on', die: 'd6', sides: 6, markAt: 6 });
    expect(targetFigure('4+', 8)?.words).toBe('4+ on d8');
  });

  // Purpose: the glyph's place in the words falls just after "N+ on ", whatever the number's length, so the row draws
  // "N+ on", the glyph, "dN".
  it('places the glyph just after "N+ on "', () => {
    for (const [shown, sides] of [['5+', 6], ['12+', 20], ['100+', 100]] as const) {
      const figure = targetFigure(shown, sides)!;
      expect(figure.words.slice(0, figure.markAt)).toBe(`${figure.target} `);
      expect(figure.words.slice(figure.markAt)).toBe(figure.die);
    }
  });

  // Purpose: a skill in the pack's other styles keeps them: "2-in-6", "35%", a value in words, or no value at all.
  it('leaves the other styles alone', () => {
    expect(targetFigure(skillOdds(2, 'd6').shown, 6)).toBeNull();
    expect(targetFigure(skillOdds(35, '%').shown, 100)).toBeNull();
    expect(targetFigure('1-2', 6)).toBeNull();
    expect(targetFigure('—', undefined)).toBeNull();
  });

  // Purpose: a target on a die the glyph can't draw (or none known) keeps its "5+" as before.
  it('keeps "5+" on a die the glyph cannot draw', () => {
    expect(targetFigure('5+', undefined)).toBeNull();
    expect(targetFigure('5+', 7)).toBeNull();
  });
});
