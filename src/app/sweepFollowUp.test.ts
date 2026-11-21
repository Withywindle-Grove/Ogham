// The sweep's review round (#561): words saved or shaped before the sweep still read right after it.
import { describe, expect, it } from 'vitest';
import { draftRollLabel, shownRollLabel } from '../core/rolls.ts';
import { shownEntryName, shownWords } from '../core/storedWords.ts';
import { shownWatch, watchChipWords } from './EncounterWaiting.tsx';
import { groupOfCheckName } from '../modules/expedition/card.ts';
import { stepOfLine } from '../modules/expedition/play.ts';

const DOT = String.fromCharCode(0xb7);

describe('after the sweep', () => {
  // Purpose: "Resumed: <place>, <step>" takes the step after the mode's own name, so a mode named with a comma stays whole.
  it('the Resumed line cuts the step by the mode name, a name with a comma included', () => {
    expect(stepOfLine('Dungeon, deep, turn 2', 'Dungeon, deep')).toBe('turn 2');
    expect(stepOfLine('Dungeon, turn 3', 'Dungeon')).toBe('turn 3');
    expect(stepOfLine('Dungeon, deep', 'Dungeon, deep')).toBe('Dungeon, deep');
  });

  // Purpose: a camp check's encounter finds its group from the name written now ("…, Group 2, now") and the one saved
  // before the sweep ("… · Group 2 · now"); no group is group 1.
  it("a camp check's group reads from new and old names", () => {
    expect(groupOfCheckName('Wandering things, Group 2, now')).toBe(2);
    expect(groupOfCheckName(`Wandering things ${DOT} Group 3 ${DOT} now`)).toBe(3);
    expect(groupOfCheckName('Wandering things, Group 4')).toBe(4);
    expect(groupOfCheckName('Wandering things, now')).toBe(1);
  });

  // Purpose: a draft roll's label is saved as before ("draft · Wren": the database and its tests match it) and shows
  // with a comma.
  it("a draft roll's label keeps its stored form and shows without the middle dot", () => {
    expect(draftRollLabel(' Wren ')).toBe(`draft ${DOT} Wren`);
    expect(shownRollLabel(draftRollLabel('Wren'))).toBe('draft, Wren');
    expect(shownRollLabel('draft, Wren')).toBe('draft, Wren');
  });

  // Purpose: a patch's name is stored as before ("mire-metals=bronze · item armour", the entry's name and the update
  // event's list) and reads with a comma wherever it's shown; a pack's own names show as written.
  it("a patch's name keeps its stored form and shows without the middle dot", () => {
    const stored = `mire-metals=bronze ${DOT} item armour`;
    expect(shownEntryName({ kind: 'patch', name: stored })).toBe('mire-metals=bronze, item armour');
    expect(shownEntryName({ kind: 'item', name: 'Reed coat' })).toBe('Reed coat');
    expect(shownWords(stored)).not.toContain(DOT);
  });

  // Purpose: a watch choice is saved as before ("2nd watch · Reed, Moss") and reads "2nd watch: Reed, Moss" on the
  // card and the toast, "2nd: Reed, Moss" on its chip.
  it('a watch choice keeps its stored form and shows without the middle dot', () => {
    const stored = `2nd watch ${DOT} Reed, Moss`;
    expect(shownWatch(stored)).toBe('2nd watch: Reed, Moss');
    expect(watchChipWords(stored)).toBe('2nd: Reed, Moss');
    expect(watchChipWords('2nd watch')).toBe('2nd');
  });
});
