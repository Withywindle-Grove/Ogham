// Rule text set out like the book (pf-18, pf-18a; docs/design/rulings/dec-rule-text-blocks-2026-11-13.md): the one
// reader, plain words, the links inside, and the screens that read rule text as words. The ruling's own invented
// example, and invented text only.
import g07Fixture from '../../../scripts/fixtures/g07-format.fixture.json?raw';
import { describe, expect, it } from 'vitest';
import { describeEntry } from './describe.ts';
import { buildReference } from './gmReference.ts';
import { readPackJson, type PackEntry } from './packFile.ts';
import { isRuleTextBlocks, readRuleText, ruleTextLinks, ruleTextParagraphs, ruleTextWords } from './ruleText.ts';

/** The ruling's example, as written there. */
const example = () => ({
  blocks: [
    { h: 'Crossing the Mire' },
    { p: 'Each hour in the bog, the [[table:mire-hazards|Mire hazards]] table is rolled.' },
    { lead: 'Sinking', text: 'A wader who fails a check sinks to the waist.' },
    { list: ['Drop the pack', 'Grab a rope', 'Call the lantern warden'], numbered: true },
    { table: { title: 'Mire hazards', die: 'd4', columns: ['d4', 'Hazard'], rows: [['1-2', 'Leeches'], ['3-4', 'Sinkhole']] } },
    { box: [{ p: 'Optional rule: a bog lurker takes the last in line.' }], title: 'Bog lurkers' },
    { source: 'p. 12' },
  ],
});

describe('the reader (pf-18a, one reader)', () => {
  // Purpose: every kind of block in the ruling's example is read into its typed form, in order, with nothing left out.
  it('reads every block kind of the example', () => {
    expect(readRuleText(example())).toEqual({
      value: {
        blocks: [
          { kind: 'h', text: 'Crossing the Mire' },
          { kind: 'p', text: 'Each hour in the bog, the [[table:mire-hazards|Mire hazards]] table is rolled.' },
          { kind: 'lead', lead: 'Sinking', text: 'A wader who fails a check sinks to the waist.' },
          { kind: 'list', items: ['Drop the pack', 'Grab a rope', 'Call the lantern warden'], numbered: true },
          { kind: 'table', title: 'Mire hazards', die: 'd4', columns: ['d4', 'Hazard'], rows: [['1-2', 'Leeches'], ['3-4', 'Sinkhole']] },
          { kind: 'box', title: 'Bog lurkers', blocks: [{ kind: 'p', text: 'Optional rule: a bog lurker takes the last in line.' }] },
          { kind: 'source', text: 'p. 12' },
        ],
      },
      leftOut: [],
    });
  });

  // Purpose: the kinds the example doesn't use are read too: a table by id, an unnumbered list, a box with no title,
  // a table with no die and an empty column header (as printed).
  it('reads a table by id, an unnumbered list, an untitled box and a table without a die', () => {
    expect(
      readRuleText({
        blocks: [
          { tableRef: 'mire-hazards' },
          { list: ['Leeches', 'Sinkhole'] },
          { box: [{ h: 'Lantern Warden' }, { lead: 'Duty', text: 'Lights the causeway.' }] },
          { table: { title: 'Depths', columns: ['', 'Depth'], rows: [['1', 'Ankle']] } },
        ],
      }).value,
    ).toEqual({
      blocks: [
        { kind: 'tableRef', tableId: 'mire-hazards' },
        { kind: 'list', items: ['Leeches', 'Sinkhole'], numbered: false },
        { kind: 'box', title: null, blocks: [{ kind: 'h', text: 'Lantern Warden' }, { kind: 'lead', lead: 'Duty', text: 'Lights the causeway.' }] },
        { kind: 'table', title: 'Depths', die: null, columns: ['', 'Depth'], rows: [['1', 'Ankle']] },
      ],
    });
  });

  // Purpose: a plain string stays exactly the string it was, marks and spaces included; no text (absent or null, as
  // before this reader) reads as none with nothing said; no blocks reads as none too.
  it('keeps a plain string as it is, and reads no text, null and no blocks as none', () => {
    const plain = '  Each hour, roll on [[table:mire-hazards|Mire hazards]].  ';
    expect(readRuleText(plain)).toEqual({ value: plain, leftOut: [] });
    expect(readRuleText(undefined)).toEqual({ value: null, leftOut: [] });
    expect(readRuleText(null)).toEqual({ value: null, leftOut: [] });
    expect(readRuleText({ blocks: [] })).toEqual({ value: null, leftOut: [] });
  });

  // Purpose: blocks with another key beside them are read, and the other key is named as left out.
  it('reads { blocks, note } as blocks and names the note', () => {
    expect(readRuleText({ blocks: [{ p: 'Wade slowly.' }], note: 'x' })).toEqual({
      value: { blocks: [{ kind: 'p', text: 'Wade slowly.' }] },
      leftOut: ['The text has keys besides blocks (note); they were left out.'],
    });
  });

  // Purpose: a value that is neither words nor { blocks } is left out and named, never thrown: a bare list, a number,
  // an object without blocks, null, and blocks that aren't a list.
  it('leaves out a value that is neither words nor { blocks }, and names it', () => {
    for (const [raw, said] of [
      [[{ p: 'A bare list' }], 'The text ([{"p":"A bare list"}]) is neither words nor { "blocks": [ … ] }; left out.'],
      [7, 'The text (7) is neither words nor { "blocks": [ … ] }; left out.'],
      [{ p: 'No blocks' }, 'The text ({"p":"No blocks"}) is neither words nor { "blocks": [ … ] }; left out.'],
      [{ blocks: 'Sinking' }, "The text's blocks should be a list of blocks; left out."],
    ] as const) {
      expect(readRuleText(raw)).toEqual({ value: null, leftOut: [said] });
    }
  });

  // Purpose: each block the reader can't use is left out and named, and the rest are kept: no marker, two markers,
  // what each kind requires, a box inside a box, a list item that isn't words, and odd optional parts.
  it('leaves out each broken block and names it, keeping the rest', () => {
    const read = readRuleText({
      blocks: [
        'Loose words',
        { kind: 'p', words: 'No marker' },
        { p: 'Two', h: 'markers' },
        { p: '' },
        { h: 3 },
        { lead: 'Sinking' },
        { lead: '', text: 'No term' },
        { list: 'Drop the pack' },
        { list: ['Drop the pack', 4, ''], numbered: 'yes' },
        { list: [] },
        { table: 'Mire hazards' },
        { table: { columns: ['d4'], rows: [] } },
        { table: { title: 'Mire hazards', columns: 'd4', rows: [] } },
        { table: { title: 'Mire hazards', columns: ['d4'], rows: ['1-2'] } },
        { table: { title: 'Mire hazards', die: 4, columns: ['d4', 'Hazard'], rows: [[1, 'Leeches']] } },
        { tableRef: '' },
        { box: [{ box: [{ p: 'Inside' }] }, { p: 'Kept in the box' }], title: 9 },
        { box: [] },
        { box: 'Bog lurkers' },
        { source: '' },
        { p: 'Kept' },
      ],
    });
    expect(read.leftOut).toEqual([
      'block 1 ("Loose words") isn\'t a block; left out.',
      'block 2 ({"kind":"p","words":"No marker"}) has no known marker (p, h, lead, list, table, tableRef, box, source); left out.',
      'block 3 has two markers (p, h); a block has one; left out.',
      'block 4 (p) has no words; left out.',
      'block 5 (h) has no words; left out.',
      'block 6 (lead "Sinking") has no text; left out.',
      'block 7 (lead) has no term; left out.',
      'block 8 (list) should be a list of words; left out.',
      'block 9 (list), item 2 (4) isn\'t words; left out.',
      'block 9 (list), item 3 ("") isn\'t words; left out.',
      'block 9 (list): numbered should be true or false; read as not numbered.',
      'block 10 (list) has no items; left out.',
      'block 11 (table) should be { title, die?, columns, rows }; left out.',
      'block 12 (table) has no title; left out.',
      'block 13 (table "Mire hazards") columns should be a list of headers; left out.',
      'block 14 (table "Mire hazards") rows should be a list of rows, each a list of cells; left out.',
      'block 15 (table "Mire hazards"): die should be words like "d6"; left out of the table.',
      'block 16 (tableRef) names no table; left out.',
      'block 17 (box): title should be words; read as no title.',
      'block 17 (box), block 1 (box) is inside a box; a box holds blocks, never another box; left out.',
      'block 18 (box) has no blocks; left out.',
      'block 19 (box) should be a list of blocks; left out.',
      'block 20 (source) has no words; left out.',
    ]);
    expect(read.value).toEqual({
      blocks: [
        { kind: 'list', items: ['Drop the pack'], numbered: false },
        { kind: 'table', title: 'Mire hazards', die: null, columns: ['d4', 'Hazard'], rows: [['1', 'Leeches']] },
        { kind: 'box', title: null, blocks: [{ kind: 'p', text: 'Kept in the box' }] },
        { kind: 'p', text: 'Kept' },
      ],
    });
  });

  // Purpose: blocks with nothing usable read as no text, with each block named.
  it('reads blocks with nothing usable as no text', () => {
    expect(readRuleText({ blocks: [{ p: '' }] })).toEqual({ value: null, leftOut: ['block 1 (p) has no words; left out.'] });
    expect(readRuleText({ blocks: [] })).toEqual({ value: null, leftOut: [] });
  });

  // Purpose: the one test of rule text in blocks: an object whose blocks is a list (other keys beside it or not); other
  // data with a `blocks` key that isn't a list (a trouble table's row, `blocks: true`) is never rule text.
  it('tells rule text from other data with a blocks key', () => {
    expect(isRuleTextBlocks(example())).toBe(true);
    expect(isRuleTextBlocks({ blocks: [] })).toBe(true);
    expect(isRuleTextBlocks({ blocks: [{ p: 'x' }], note: 'More' })).toBe(true);
    expect(isRuleTextBlocks({ blocks: true, clock: { amount: 1, unit: 'day' } })).toBe(false);
    expect(isRuleTextBlocks([{ p: 'x' }])).toBe(false);
    expect(isRuleTextBlocks('Words')).toBe(false);
  });
});

describe('plain words (pf-18a)', () => {
  // Purpose: the ruling's example reads in plain words in reading order: the heading, the paragraph with its link's
  // label, the lead-in as "Term. text", the numbered items, the table's title, the box's title and words, the source.
  it("puts the ruling's example into plain words in reading order", () => {
    expect(ruleTextParagraphs(readRuleText(example()).value)).toEqual([
      'Crossing the Mire',
      'Each hour in the bog, the Mire hazards table is rolled.',
      'Sinking. A wader who fails a check sinks to the waist.',
      '1. Drop the pack',
      '2. Grab a rope',
      '3. Call the lantern warden',
      'Mire hazards',
      'Bog lurkers',
      'Optional rule: a bog lurker takes the last in line.',
      'p. 12',
    ]);
    expect(ruleTextWords(readRuleText(example()).value)).toBe(
      'Crossing the Mire\nEach hour in the bog, the Mire hazards table is rolled.\nSinking. A wader who fails a check sinks to the waist.\n1. Drop the pack\n2. Grab a rope\n3. Call the lantern warden\nMire hazards\nBog lurkers\nOptional rule: a bog lurker takes the last in line.\np. 12',
    );
  });

  // Purpose: the source reads last even where a pack put it earlier; a term with its own mark gets no second full
  // stop; a table by id adds no words; an unnumbered list's items read without numbers.
  it('reads the source last, keeps a term\'s own mark, and adds nothing for a table by id', () => {
    const value = readRuleText({ blocks: [{ source: 'p. 3' }, { lead: 'Beware:', text: 'The bog.' }, { tableRef: 'mire-hazards' }, { list: ['Leeches'] }] }).value;
    expect(ruleTextParagraphs(value)).toEqual(['Beware: The bog.', 'Leeches', 'p. 3']);
  });

  // Purpose: a plain string is one paragraph, its link marks shown as their labels; no text is no words.
  it('reads a plain string as one paragraph with its labels', () => {
    expect(ruleTextParagraphs(readRuleText('Roll on [[table:mire-hazards|Mire hazards]] each hour.').value)).toEqual(['Roll on Mire hazards each hour.']);
    expect(ruleTextWords(null)).toBe('');
  });
});

describe('the links inside (rp-5 later)', () => {
  // Purpose: every link in blocks is listed in reading order, in the two-part and the three-part form, from every
  // place a string sits (a paragraph, a lead-in, a list, a table, a box).
  it('lists the links in blocks, both forms', () => {
    const value = readRuleText({
      blocks: [
        { p: 'Roll [[table:mire-hazards|Mire hazards]].' },
        { lead: 'Sinking', text: 'Ask the [[npc:fen-keeper:marda|weir-keeper]].' },
        { list: ['Grab [[item:reed-rope]]'] },
        { table: { title: 'Depths', columns: ['d4', '[[place:causeway|Causeway]]'], rows: [['1', '[[statBlock:bog-lurker|Bog lurker]]']] } },
        { box: [{ p: 'See [[adventureHook:ew-lost-lantern|the lost lantern]].' }] },
      ],
    }).value;
    expect(ruleTextLinks(value)).toEqual([
      { kind: 'table', packId: '', id: 'mire-hazards', label: 'Mire hazards' },
      { kind: 'npc', packId: 'fen-keeper', id: 'marda', label: 'weir-keeper' },
      { kind: 'item', packId: '', id: 'reed-rope', label: 'reed rope' },
      { kind: 'place', packId: '', id: 'causeway', label: 'Causeway' },
      { kind: 'statBlock', packId: '', id: 'bog-lurker', label: 'Bog lurker' },
      { kind: 'adventureHook', packId: '', id: 'ew-lost-lantern', label: 'the lost lantern' },
    ]);
  });

  // Purpose: the links in a plain string are listed the same way, both forms; no text has no links.
  it('lists the links in a plain string, both forms', () => {
    expect(ruleTextLinks(readRuleText('Roll [[table:mire-hazards|Mire hazards]] or ask [[npc:fen-keeper:marda|Marda]].').value)).toEqual([
      { kind: 'table', packId: '', id: 'mire-hazards', label: 'Mire hazards' },
      { kind: 'npc', packId: 'fen-keeper', id: 'marda', label: 'Marda' },
    ]);
    expect(ruleTextLinks(null)).toEqual([]);
  });
});

describe('the screens read rule text in blocks as words', () => {
  const place = (text: unknown): PackEntry => ({ kind: 'location', packEntryId: 'mire-causeway', name: 'The causeway', data: { id: 'mire-causeway', name: 'The causeway', gm: { text }, rules: [{ id: 'sinking', name: 'Sinking', text }] } });
  const flat = (lines: ReturnType<typeof describeEntry>['lines']): string => JSON.stringify(lines);

  // Purpose: the rules browser shows an area's gm.text and a place rule's text in blocks as their plain words, and
  // never the blocks' raw parts.
  it('shows blocks as plain words in the rules browser, never raw', () => {
    const lines = flat(describeEntry(place(example()), () => undefined, { gm: true }).lines);
    expect(lines).toContain('Crossing the Mire\\nEach hour in the bog, the Mire hazards table is rolled.');
    expect(lines).not.toContain('"Blocks"');
    expect(lines).not.toContain('[[table:');
    expect(lines).not.toContain('"lead"');
  });

  // Purpose: the screens use the same test as the reader: { blocks, note } shows its blocks' words (the note is the
  // checker's to name), and { blocks: [] } shows no line at all, not a blank one.
  it('shows { blocks, note } as words, and no line for no blocks, in the rules browser', () => {
    const noted = flat(describeEntry(place({ blocks: [{ p: 'Wade slowly.' }], note: 'x' }), () => undefined, { gm: true }).lines);
    expect(noted).toContain('Wade slowly.');
    expect(noted).not.toContain('"Blocks"');
    const empty = flat(describeEntry(place({ blocks: [] }), () => undefined, { gm: true }).lines);
    expect(empty).not.toContain('"label":"Text"');
    expect(empty).not.toContain('"value":""');
  });

  // Purpose: a plain string reads exactly as it did: unchanged, marks and all, in the rules browser.
  it('leaves a plain string as it is in the rules browser', () => {
    const plain = 'Each hour, roll on [[table:mire-hazards|Mire hazards]].';
    const lines = flat(describeEntry(place(plain), () => undefined, { gm: true }).lines);
    // Twice: the area's gm.text and the place rule's text, each verbatim, its mark untouched.
    expect(lines.split(JSON.stringify(plain).slice(1, -1)).length - 1).toBe(2);
  });

  // Purpose: a mode's procedure step whose text is in blocks reads as words on the GM reference's Dungeons panel.
  it("reads a procedure step's text in blocks as words on the GM reference", () => {
    const rules: PackEntry & { packId: string } = {
      packId: 'reed-marsh',
      kind: 'rulesSet',
      packEntryId: 'reed-rules',
      name: 'Reed rules',
      data: { id: 'reed-rules', name: 'Reed rules', exploration: { modes: [{ id: 'wading', name: 'Wading', step: { value: 1, unit: 'turn' }, procedure: [{ id: 'describe', name: 'Describe', text: example() }] }] } },
    };
    const reference = JSON.stringify(buildReference([{ packId: 'reed-marsh', name: 'Reed marsh', shortName: 'Reed', kind: 'setting' }], [rules]));
    expect(reference).toContain('Sinking. A wader who fails a check sinks to the waist.');
    expect(reference).not.toContain('"lead"');
  });

  // Purpose: a GM reference panel entry whose text is in blocks reads as its words; one in words reads as before.
  it('reads a reference panel entry in blocks as words, and one in words as before', () => {
    const panel = (text: unknown): PackEntry & { packId: string } => ({ packId: 'reed-marsh', kind: 'gmReferencePanel', packEntryId: 'mire', name: 'The mire', data: { id: 'mire', title: 'The mire', entries: [{ heading: 'Crossing', text }] } });
    const pack = [{ packId: 'reed-marsh', name: 'Reed marsh', shortName: 'Reed', kind: 'setting' as const }];
    const blocks = buildReference(pack, [panel(example())])[0]!.panels[0]!.entries[0]!;
    expect(blocks.paragraphs).toEqual([ruleTextWords(readRuleText(example()).value)]);
    expect(buildReference(pack, [panel('Wade slowly.')])[0]!.panels[0]!.entries[0]!.paragraphs).toEqual(['Wade slowly.']);
    // The same test as the reader: { blocks, note } reads as its words; no blocks is no words (the entry keeps its heading).
    expect(buildReference(pack, [panel({ blocks: [{ p: 'Wade slowly.' }], note: 'x' })])[0]!.panels[0]!.entries[0]!.paragraphs).toEqual(['Wade slowly.']);
    expect(buildReference(pack, [panel({ blocks: [] })])[0]!.panels[0]!.entries[0]!.paragraphs).toEqual([]);
  });

  // Purpose: a pack that carries plain strings reads exactly as before, end to end: an existing fixture's every entry
  // described, and its GM reference, match the pictures taken before this change (the snapshot was written from the
  // code on main).
  it('reads an existing plain-string fixture exactly as before', () => {
    const read = readPackJson(g07Fixture);
    if (!read.ok) throw new Error(read.message);
    const entries = read.pack.entries.map((e) => ({ ...e, packId: 'g07' }));
    const described = entries.map((e) => describeEntry(e, () => undefined, { gm: true }));
    const reference = buildReference([{ packId: 'g07', name: read.pack.meta.name, shortName: 'G07', kind: read.pack.meta.kind }], entries);
    expect({ described, reference }).toMatchSnapshot();
  });
});
