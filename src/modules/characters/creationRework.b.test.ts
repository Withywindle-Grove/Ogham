// The creation rework, slice B (cw-11, cw-12; Design's answers 2026-11-06), pure: a kindred's usual age, height and
// weight read from `usual` (never from its words), the box's words and what typing reads; a table row's plain name;
// the alsoFills reader and its rule; and the toast after a table pick. Every name and number is invented.
import { describe, expect, it } from 'vitest';
import { detailLines, feetAndInches, kindredTables, physicalOf, physicalWords, readUsual, rowOf, rowWords, tableOf, usualFormula, usualOf } from './kindredTables.ts';
import { alsoFillsField, alignmentSetBy, mayAlsoFill, tableAlsoFills, tablePickToast } from './whoTheyAre.ts';

const reedling = {
  data: {
    age: '15 + 2d10 years',
    usual: {
      age: { base: 15, dice: '2d10', unit: 'years' },
      height: { variants: [{ label: 'Tall', base: 64, dice: '2d6' }, { label: 'Short', base: 60, dice: '2d6' }], unit: 'in' },
      weight: { base: 120, dice: '6d10', unit: 'lb' },
    },
  },
};

describe("a kindred's usual age, height and weight", () => {
  // Purpose: the stepper starts at the base plus the dice's average, rounded to its step, and steps by the ruled step.
  it('starts at base plus the dice average rounded to the step; a variant kindred starts at the first variant', () => {
    expect(usualOf(reedling, 'age')).toMatchObject({ start: 26, step: 1, unit: 'years' });
    expect(usualOf(reedling, 'height')).toMatchObject({ start: 71, step: 1 });
    expect(usualOf(reedling, 'weight')).toMatchObject({ start: 155, step: 5 });
    // "1d100 × 10 years": the step is the times.
    expect(usualOf({ data: { usual: { age: { base: 0, dice: '1d100', times: 10, unit: 'years' } } } }, 'age')).toMatchObject({ start: 510, step: 10 });
    // A base alone (no dice): the base.
    expect(usualOf({ data: { usual: { height: { base: 63, unit: 'in' } } } }, 'height')).toMatchObject({ start: 63 });
  });

  // Purpose: no usual, or one the app can't read, gives no stepper (the typed field stays); never a guess from words.
  it('has none without usual, with the wrong unit, odd dice or a base that is not a whole number', () => {
    expect(usualOf({ data: { age: '15 + 2d10 years' } }, 'age')).toBeNull();
    expect(usualOf({ data: { usual: { age: { base: 15, unit: 'in' } } } }, 'age')).toBeNull();
    expect(usualOf({ data: { usual: { age: { base: 15, dice: '2d10+3', unit: 'years' } } } }, 'age')).toBeNull();
    expect(usualOf({ data: { usual: { weight: { base: 12.5, unit: 'lb' } } } }, 'weight')).toBeNull();
  });

  // Purpose: the caption is the pack's words when it has them, else the formula naming every variant.
  it('captions with the pack words, else the formula with each variant', () => {
    const fields = physicalOf(reedling);
    expect(fields.map((f) => [f.key, f.dice])).toEqual([
      ['age', '15 + 2d10 years'],
      ['height', 'Tall 5 ft 4 in + 2d6 in; Short 5 ft + 2d6 in'],
      ['weight', '120 + 6d10 lb'],
    ]);
    expect(usualFormula('age', usualOf({ data: { usual: { age: { base: 0, dice: '1d100', times: 10, unit: 'years' } } } }, 'age')!)).toBe('1d100 × 10 years');
  });

  // Purpose: a height typed as "5 7", "5'7", "5 ft 7 in" or inches reads as inches; words that aren't a number don't.
  it('reads what is typed in the unit', () => {
    for (const typed of ['67', '67 in', '5 7', "5'7", '5′7″', '5 ft 7 in']) expect(readUsual('height', typed)).toBe(67);
    expect(readUsual('height', '5 ft')).toBe(60);
    expect(readUsual('height', 'tall-ish')).toBeNull();
    expect(readUsual('age', '140 years')).toBe(140);
    expect(readUsual('weight', '150 lbs')).toBe(150);
    expect(readUsual('weight', 'about 150')).toBeNull();
    expect(feetAndInches(67)).toBe('5 ft 7 in');
  });

  // Purpose: the review and sheet show a kept number in words; older free text that isn't a number shows unchanged.
  it('shows a kept number in its unit and older free text unchanged', () => {
    const [age, height, weight] = physicalOf(reedling);
    expect(physicalWords(height!, '67')).toBe('5 ft 7 in');
    expect(physicalWords(weight!, '155')).toBe('155 lb');
    expect(physicalWords(age!, 'old as the reeds')).toBe('old as the reeds');
    expect(detailLines({ tables: {}, age: '26' }, kindredTables(null, []), physicalOf(reedling))).toEqual([{ key: 'age', label: 'Age', value: '26 years' }]);
  });
});

describe('a table row and the field it also fills (cw-5, cw-12)', () => {
  const houses = tableOf({
    packEntryId: 'houses',
    name: 'Fen houses',
    data: { die: 'd4', rows: [{ min: 1, max: 2, result: 'House Saltreach (Mire)', name: 'House Saltreach', alignment: 'Mire', note: 'Tollkeepers of the eel weirs.' }, { min: 3, max: 4, result: 'House Marrow (Reed)', alignment: 'Reed' }] },
  })!;

  // Purpose: a pick writes the row's plain name when it has one, and a saved name or saved words find the row again.
  it("writes the row's plain name, else its words, and finds it either way", () => {
    expect(rowWords(houses.rows[0]!)).toBe('House Saltreach');
    expect(rowWords(houses.rows[1]!)).toBe('House Marrow (Reed)');
    expect(houses.rows[0]!.note).toBe('Tollkeepers of the eel weirs.');
    expect(rowOf(houses, 'House Saltreach')).toBe(0);
    expect(rowOf(houses, 'House Saltreach (Mire)')).toBe(0);
    expect(alignmentSetBy([{ key: 'liege', label: 'Liege', table: houses }], { liege: 'House Saltreach' })).toMatchObject({ alignment: 'Mire' });
  });

  // Purpose: alsoFills is read from the sheet layout, matched to the campaign's field, and never overwrites typed words.
  it('reads alsoFills, finds its field, and writes it only while empty or still the previous pick', () => {
    const also = tableAlsoFills([{ kind: 'fieldTemplate', data: { fields: [{ key: 'liege', from: 'houses', alsoFills: 'affiliation' }] } }]);
    expect(also.get('liege')).toBe('affiliation');
    expect(alsoFillsField([{ key: 'Affiliation', hidden: false }], also.get('liege'))?.key).toBe('Affiliation');
    expect(alsoFillsField([{ key: 'affiliation', hidden: true }], also.get('liege'))).toBeUndefined();
    expect(mayAlsoFill('', 'House Marrow')).toBe(true);
    expect(mayAlsoFill('House Marrow', 'House Marrow')).toBe(true);
    expect(mayAlsoFill('The Eel Guild', 'House Marrow')).toBe(false);
    expect(mayAlsoFill('The Eel Guild', '')).toBe(false);
  });

  // Purpose: the toast says what the pick changed, in Design's words, for each case.
  it("says what changed, in Design's words", () => {
    const a = { word: 'alignment', name: 'Mire' };
    expect(tablePickToast({ label: 'Liege', picked: 'House Saltreach', alignment: a, also: 'Affiliation' })).toBe('Liege: House Saltreach. Your alignment is now Mire, as theirs is, and your affiliation is House Saltreach.');
    expect(tablePickToast({ label: 'Liege', picked: 'House Saltreach', alignment: a })).toBe('Liege: House Saltreach. Your alignment is now Mire, as theirs is.');
    expect(tablePickToast({ label: 'Liege', picked: 'House Saltreach', also: 'Affiliation' })).toBe('Liege: House Saltreach. Your affiliation is House Saltreach.');
    expect(tablePickToast({ label: 'Liege', picked: 'House Saltreach' })).toBe('Liege: House Saltreach.');
  });
});
