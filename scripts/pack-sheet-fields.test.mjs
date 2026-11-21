// npm run pack:check's list of a printed sheet's fields with no home (sheetFields, ruled 2026-11-04,
// docs/design/rulings/m5b-sheet-review-2026-11-04.md sr-10; docs/plans/m5b-sheet.md, build order 6). Every name is invented.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { homelessFields, isOverlay, layoutKeys, sheetFieldNotes, ungatedHomes } from './pack-sheet-fields.mjs';

const layout = (keys) => ({ kind: 'fieldTemplate', packEntryId: 'moor-sheet', data: { fields: keys.map((key) => ({ key, label: key })) } });
const lanterns = { kind: 'option', packEntryId: 'moor-lanterns', data: { choices: [{ id: 'off' }, { id: 'on' }] } };
const pack = (sheetFields, meta = {}) => ({ meta, sheetFields });

const run = (...files) => {
  try {
    return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
  } catch (error) {
    return String(error.stdout);
  }
};

describe('printed fields with no home (sr-10)', () => {
  // Purpose: a field homed in a figure, the Pack tab or a key of the layout has a home; one with no home, or a home
  // naming nothing, is listed by name.
  it('lists a field with no home and one whose home names nothing', () => {
    const file = pack([
      { name: 'Calling', home: 'class' },
      { name: 'Satchel', home: 'pack' },
      { name: 'Grit', home: 'GRIT' },
      { name: 'Thistle marks' },
      { name: 'Bramble debt', home: 'brambleDebt' },
    ]);
    expect(homelessFields(file, layoutKeys([layout(['GRIT'])])).homeless).toEqual([
      '"Thistle marks"',
      `"Bramble debt": home "brambleDebt" isn't a figure, the Pack tab or a field in the layout`,
    ]);
  });

  // Purpose: the three homes the technical confirmation added (name, class, portrait) are figures.
  it('name, class and portrait are homes', () => {
    const file = pack([{ name: 'Name', home: 'name' }, { name: 'Calling', home: 'class' }, { name: 'Likeness', home: 'portrait' }]);
    expect(homelessFields(file, new Set()).homeless).toEqual([]);
  });

  // Purpose: a gated field with no home is still listed, saying which choice it needs.
  it('a gated field with no home says when it counts', () => {
    const file = pack([{ name: 'Wick hours', option: ['moor-lanterns=on'] }]);
    expect(homelessFields(file, new Set()).homeless).toEqual(['"Wick hours" (only with moor-lanterns=on)']);
  });

  // Purpose: checked alone, an overlay's home that isn't in its own layout waits for the stack instead of being listed;
  // a field with no home at all is listed either way.
  it("an overlay's unknown home waits for its base", () => {
    const file = pack([{ name: 'Briar scars', home: 'briarScars' }, { name: 'Thorn tally' }], { requires: [{ packId: 'bramble-moor' }] });
    expect(isOverlay(file)).toBe(true);
    expect(homelessFields(file, new Set(), true)).toEqual({ homeless: ['"Thorn tally"'], waiting: ['"Briar scars": home "briarScars"'] });
  });
});

describe('the sheetFields list itself', () => {
  // Purpose: a list that isn't a list, an item with no name and a home that isn't words are each noted.
  it('notes a malformed list', () => {
    expect(sheetFieldNotes({ sheetFields: {} }, [])).toEqual(['sheetFields should be a list of { name, home } (07, sr-10).']);
    const notes = sheetFieldNotes(pack(['Grit', { home: 'GRIT' }, { name: 'Wit', home: 3 }]), []);
    expect(notes).toHaveLength(3);
    expect(notes[2]).toMatch(/"Wit": home should be a layout field key/);
  });

  // Purpose: a field's option gate is read like any entry's (of-12): a choice its option doesn't have is noted.
  it("notes a gate naming a choice the option doesn't have", () => {
    const file = pack([{ name: 'Wick hours', home: 'pack', option: 'moor-lanterns=on' }, { name: 'Wick tally', home: 'notes', option: ['moor-lanterns=always'] }]);
    expect(sheetFieldNotes(file, [lanterns])).toEqual([`sheetFields: "Wick tally": option names choice "always", which isn't one of option "moor-lanterns"'s choices (off, on).`]);
  });

  // Purpose: a pack with no sheetFields gets no note.
  it('says nothing without sheetFields', () => {
    expect(sheetFieldNotes({ meta: {} }, [])).toEqual([]);
  });
});

describe('a gated printed field whose layout home has no gate (gate check 59)', () => {
  const sheet = (fields, extra = {}) => ({ kind: 'fieldTemplate', packEntryId: 'moor-sheet', data: { fields, ...extra } });

  // Purpose: the app hides a field only by its layout's gate (of-9), so a printed field gated by an option whose home
  // is a layout field with no option is noted (the sheet would show it with the option off); a home with its own
  // option, a `from` list, a gated layout, a figure or the Pack tab is not.
  it('notes a gated printed field homed in an ungated layout field, and nothing else', () => {
    const file = pack([
      { name: 'Wick hours', home: 'wickHours', option: ['moor-lanterns=on', 'moor-lanterns=bright'] },
      { name: 'Wick tally', home: 'wickTally', option: 'moor-lanterns=on' },
      { name: 'Reed chants', home: 'reedChants', option: 'moor-lanterns=on' },
      { name: 'Lantern pack', home: 'pack', option: 'moor-lanterns=on' },
      { name: 'Grit', home: 'GRIT' },
    ]);
    const layoutFields = [
      { key: 'wickHours', label: 'Wick hours' },
      { key: 'wickTally', label: 'Wick tally', option: 'moor-lanterns=on' },
      { key: 'reedChants', label: 'Reed chants', from: 'reed-chants' },
      { key: 'GRIT', label: 'GRIT' },
    ];
    expect(ungatedHomes(file, [sheet(layoutFields)])).toEqual([
      'sheetFields: "Wick hours" counts only with moor-lanterns=on or moor-lanterns=bright, but its home "wickHours" in the layout has no option, so the sheet shows it with that option off: give the layout field the same option (of-9).',
    ]);
    expect(ungatedHomes(file, [sheet(layoutFields, { option: 'moor-lanterns=on' })])).toEqual([]);
  });

  // Purpose: a home in no layout is homelessFields' note, not this one.
  it('leaves a home in no layout alone', () => {
    expect(ungatedHomes(pack([{ name: 'Wick hours', home: 'wickHours', option: 'moor-lanterns=on' }]), [])).toEqual([]);
  });

  // Purpose: a gated printed field sharing its home with an ungated one (a lantern note inside GRIT) isn't noted: that
  // home is meant to show always.
  it('leaves a home an ungated printed field shares alone', () => {
    const file = pack([{ name: 'Grit', home: 'GRIT' }, { name: 'Grit by lantern light', home: 'GRIT', option: 'moor-lanterns=on' }]);
    expect(ungatedHomes(file, [sheet([{ key: 'GRIT', label: 'GRIT' }])])).toEqual([]);
  });
});

describe('npm run pack:check', () => {
  // Purpose (the plan's test): pack:check lists a printed field with no home in an invented fixture, and doesn't call
  // sheetFields an unknown part.
  it('lists the fixture setting\'s printed fields with no home', () => {
    const out = run('scripts/fixtures/m5b-sheet-fields.fixture.json');
    expect(out).toMatch(/Printed sheet fields: 11, 2 with no home\./);
    expect(out).toMatch(/ {2}- "Thistle marks"\n/);
    expect(out).toMatch(/"Bramble debt": home "brambleDebt" isn't a figure/);
    expect(out).not.toMatch(/"Wick hours"/);
    expect(out).not.toMatch(/"sheetFields" isn't a part/);
  });

  // Purpose: across a stack, an overlay's field homed in its base's layout has a home, and one homed nowhere is listed.
  it("reads an overlay's sheetFields across the stack", () => {
    const alone = run('scripts/fixtures/m5b-sheet-fields-overlay.fixture.json');
    expect(alone).toMatch(/Homes this overlay's base may have \(2/);
    const stack = run('scripts/fixtures/m5b-sheet-fields.fixture.json', 'scripts/fixtures/m5b-sheet-fields-overlay.fixture.json');
    const library = stack.slice(stack.indexOf('=== The 2 packs together'));
    expect(library).toMatch(/Thorn wardens: printed field with no home: "Briar scars": home "briarScars"/);
    expect(library).not.toMatch(/Oath of the hedge/);
    expect(library).not.toMatch(/moor-lanterns/);
  });
});

describe('the real packs', () => {
  // Purpose: in the private packs (read in place, never copied), every home a printed field names exists: a figure,
  // the Pack tab or a layout key (an overlay's, across every pack there); fields with no home at all are the pack
  // session's list (coins wait for M7b) and aren't a fault here. Skipped where the packs aren't on this computer.
  it('every home a real pack names exists', ({ skip }) => {
    const here = process.cwd().replace(/\\/g, '/');
    const dir = [process.env.PACKS_DIR, `${here}/packs/_current`, `${here}/../../../packs/_current`].find((d) => !!d && existsSync(d));
    if (!dir) return skip();
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, file: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) }));
    const asEntries = (file) => (Array.isArray(file.fieldTemplates) ? file.fieldTemplates : []).map((t) => ({ kind: 'fieldTemplate', packEntryId: t.id, data: t }));
    const everyKey = layoutKeys(files.flatMap(({ file }) => asEntries(file)));
    const withFields = files.filter(({ file }) => file.sheetFields !== undefined);
    expect(withFields.length).toBeGreaterThan(0);
    const wrong = [];
    for (const { f, file } of withFields) {
      wrong.push(...sheetFieldNotes(file, []).filter((n) => !n.includes('option names')).map((n) => `${f}: ${n}`));
      const keys = isOverlay(file) ? everyKey : layoutKeys(asEntries(file));
      wrong.push(...homelessFields(file, keys).homeless.filter((h) => h.includes(': home "')).map((h) => `${f}: ${h}`));
    }
    expect(wrong).toEqual([]);
  });
});
