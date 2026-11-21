// The head's words (dec-13 C2; ps-3, ps-5; frames P1 and P2). Purposes:
//   "the" and the kindred, then the title; either alone; nothing with neither (the title is hidden when there is none).
//   The tablet's bar: the name, then "the" kindred and the title; with no kindred a comma before the title.
import { describe, expect, it } from 'vitest';
import { kindredAndTitle, nameKindredTitle } from './PlayerHead.tsx';

describe("the head's words", () => {
  it('reads "the" kindred, then the title, and drops what is missing', () => {
    expect(kindredAndTitle('Hornkin', 'Shieldbearer')).toBe('the Hornkin, Shieldbearer');
    expect(kindredAndTitle('Hornkin', '')).toBe('the Hornkin');
    expect(kindredAndTitle(null, 'Shieldbearer')).toBe('Shieldbearer');
    expect(kindredAndTitle(null, '  ')).toBe('');
  });

  it("the tablet's bar puts the name first", () => {
    expect(nameKindredTitle('Brannoch', 'Hornkin', 'Shieldbearer')).toBe('Brannoch the Hornkin, Shieldbearer');
    expect(nameKindredTitle('Brannoch', null, 'Shieldbearer')).toBe('Brannoch, Shieldbearer');
    expect(nameKindredTitle('Brannoch', undefined, undefined)).toBe('Brannoch');
  });
});
