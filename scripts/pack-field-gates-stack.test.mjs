// Test for the note on a field's forClasses naming a class from the pack this one requires (scripts/pack-option-gates.mjs).
// Every name is made up.
import { describe, expect, it } from 'vitest';
import { fieldGateNotes } from './pack-option-gates.mjs';

const layout = { kind: 'fieldTemplate', packEntryId: 'extras', data: { fields: [{ key: 'vow', forClasses: ['knight'] }] } };
const mine = { kind: 'class', packEntryId: 'squire', data: {} };

describe("a field's forClasses naming a class from the required pack", () => {
  // Purpose: an overlay checked alone is told the class may come from the pack it requires (not that it is plainly
  // wrong); a file with no requirement keeps the plain note; the stack finds the class, or names it as missing.
  it('says the class may come from a required pack when the file has requirements', () => {
    expect(fieldGateNotes([layout, mine], false, true)).toEqual([
      'fieldTemplates: "extras": field "vow": forClasses names "knight", which isn\'t a class in this pack (fine if a required pack has it; check the packs together); the field is hidden from everyone else.',
    ]);
    expect(fieldGateNotes([layout, mine])).toEqual([
      'fieldTemplates: "extras": field "vow": forClasses names "knight", which isn\'t a class in this pack; the field is hidden from everyone else.',
    ]);
    expect(fieldGateNotes([layout, mine, { kind: 'class', packEntryId: 'knight', data: {} }], true)).toEqual([]);
    expect(fieldGateNotes([layout, mine], true)).toHaveLength(1);
  });
});
