import { describe, expect, it } from 'vitest';
import {
  cleanChoices,
  cleanFieldValues,
  fieldInputsFrom,
  cardLine,
  sheetSections,
  fieldSummary,
  keyFromLabel,
  readFieldInput,
  readFieldInputs,
  type FieldDefinition,
} from './fields.ts';

const field = (key: string, type: FieldDefinition['type'], extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  id: key,
  campaignId: 'c1',
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  type,
  choices: [],
  group: '',
  order: 0,
  showOnCard: false,
  hidden: false,
  fill: null,
  required: false,
  from: null,
  ...extra,
});

const might = field('might', 'number', { showOnCard: true });
const path = field('path', 'list', { choices: ['Lantern Warden', 'Reedblade'], showOnCard: true });
const swims = field('swims', 'checkbox');
const motto = field('motto', 'text');
const tale = field('tale', 'longtext');
const secret = field('secret', 'text', { hidden: true });
const all = [might, path, swims, motto, tale, secret];

describe('field keys', () => {
  it('makes a key from the name, and a new one when it is taken', () => {
    expect(keyFromLabel('Hit dice (d6)', [])).toBe('hit_dice_d6');
    expect(keyFromLabel('Patron', ['patron'])).toBe('patron_2');
    expect(keyFromLabel('Patron', ['patron', 'patron_2'])).toBe('patron_3');
    expect(keyFromLabel('!!!', [])).toBe('field');
  });
});

describe('list choices', () => {
  it('takes one choice per line, dropping blanks and repeats', () => {
    expect(cleanChoices(' Lantern Warden \n\nReedblade\nLantern Warden')).toEqual(['Lantern Warden', 'Reedblade']);
  });
});

describe('what a player types', () => {
  it('a number field takes whole numbers, negatives too, and nothing else', () => {
    expect(readFieldInput(might, '13')).toEqual({ value: 13 });
    expect(readFieldInput(might, '-2')).toEqual({ value: -2 });
    expect(readFieldInput(might, '')).toEqual({});
    for (const bad of ['2.5', 'ten', '1e3', '--1']) expect(readFieldInput(might, bad), bad).toHaveProperty('error');
  });

  it('a list field takes only one of its choices', () => {
    expect(readFieldInput(path, 'Reedblade')).toEqual({ value: 'Reedblade' });
    expect(readFieldInput(path, 'Mire Witch')).toHaveProperty('error');
  });

  it('a yes/no field is either ticked or left out', () => {
    expect(readFieldInput(swims, true)).toEqual({ value: true });
    expect(readFieldInput(swims, false)).toEqual({});
  });

  it('reads a whole form, stopping at the first problem in plain words', () => {
    expect(readFieldInputs(all, { might: '3', path: '', swims: true, motto: ' Light first ' })).toEqual({
      ok: true,
      values: { might: 3, swims: true, motto: 'Light first' },
    });
    expect(readFieldInputs(all, { might: 'lots' })).toEqual({
      ok: false,
      message: 'Might must be a whole number (it can be negative).',
    });
  });

  it("turns saved values back into form inputs", () => {
    expect(fieldInputsFrom([might, swims, motto], { might: -1, swims: true })).toEqual({ might: '-1', swims: true, motto: '' });
  });
});

describe('checking values before saving', () => {
  it('refuses values for hidden or unknown fields', () => {
    expect(cleanFieldValues(all, { secret: 'x' })).toMatchObject({ ok: false });
    expect(cleanFieldValues(all, { nope: 'x' })).toMatchObject({ ok: false });
  });

  it('drops empty values and keeps good ones', () => {
    expect(cleanFieldValues(all, { might: 4, motto: '', swims: false, path: 'Reedblade' })).toEqual({
      ok: true,
      values: { might: 4, path: 'Reedblade' },
    });
  });
});

describe('the summary line', () => {
  const values = { might: 13, path: 'Reedblade', swims: true, tale: 'A long tale', secret: 'shh' };

  it('lists visible values in order, leaves out long text and hidden fields', () => {
    expect(fieldSummary(all, values)).toBe('Might 13, Path Reedblade, Swims');
  });

  it('can show only the fields marked for the card', () => {
    expect(fieldSummary(all, values, { onlyCard: true })).toBe('Might 13, Path Reedblade');
  });

  // The GM's Players list showed "THAC0 [attack bonus] 19" (M4b re-test, 2026-10-26).
  it("leaves a label's bracketed aside off, as the card line does", () => {
    const aside = { ...all[0]!, key: 'hit', label: 'Hit roll [to beat]', type: 'text' as const };
    expect(fieldSummary([aside], { hit: '19' })).toBe('Hit roll 19');
  });
});

describe("the line under a character's name on the Player screen", () => {
  it('shows on-card values (words alone, numbers with their label), then the level', () => {
    expect(cardLine(all, { might: 13, path: 'Reedblade', swims: true, motto: 'Onward' }, 3)).toBe('Might 13, Reedblade, Level 3');
  });

  // M4b gate (2026-10-25): a filled attack figure stored as text showed as a bare "19".
  it("a number stored as text gets its label, without the label's bracketed aside", () => {
    const attack = { ...all[0]!, key: 'stroke', label: 'Stroke [reach bonus]', type: 'text' as const, showOnCard: true };
    expect(cardLine([attack], { stroke: '19' }, 2)).toBe('Stroke 19, Level 2');
  });

  it('is just the level when no on-card field is filled in', () => {
    expect(cardLine(all, { motto: 'Onward' }, 1)).toBe('Level 1');
  });

  it('leaves out hidden fields even if marked for the card', () => {
    const hiddenPath = { ...path, hidden: true };
    expect(cardLine([might, hiddenPath], { might: 9, path: 'Reedblade' }, 2)).toBe('Might 9, Level 2');
  });
});

describe('the full sheet', () => {
  const grouped = [
    field('might', 'number', { group: 'Abilities' }),
    field('wits', 'number', { group: 'Abilities' }),
    field('path', 'list', { choices: ['Reedblade'] }),
    field('swims', 'checkbox'),
    field('oath', 'text', { group: 'Oaths' }),
    field('old', 'text', { hidden: true }),
  ];
  const values = { might: 13, path: 'Reedblade', swims: false, oath: 'Keep the lamps lit', old: 'Retired value' };

  it("groups visible fields by category in the GM's order, showing empty ones as a dash and boxes as Yes or No", () => {
    expect(sheetSections(grouped, values)).toEqual([
      { name: 'Abilities', rows: [{ key: 'might', label: 'Might', value: '13' }, { key: 'wits', label: 'Wits', value: '—' }] },
      { name: '', rows: [{ key: 'path', label: 'Path', value: 'Reedblade' }, { key: 'swims', label: 'Swims', value: 'No' }] },
      { name: 'Oaths', rows: [{ key: 'oath', label: 'Oath', value: 'Keep the lamps lit' }] },
    ]);
  });

  it('can add the hidden fields at the end, for the GM', () => {
    expect(sheetSections(grouped, values, { includeHidden: true }).at(-1)).toEqual({
      name: 'Hidden fields',
      rows: [{ key: 'old', label: 'Old', value: 'Retired value' }],
    });
  });

  it('is empty when the campaign has no fields', () => {
    expect(sheetSections([], values)).toEqual([]);
  });
});

