// "Who they are" (M5b step 0c, slice 3; cr-12, cr-23): the hit points from the roll typed, the alignment rows, the
// Derived fields from `fill` only, and the foot's hint. Every name and number here is invented.
import { describe, expect, it } from 'vitest';
import { alignmentClosedReason, alignmentLine, alignmentOffer, alignmentOfferSet, alignmentSetBy, alignmentSetProblem, tableFields, alignmentProblem, alignmentRequirement, alignmentRows, derivedRows, diceRange, filledAt, hpAskLine, hpAverageLine, hpFromRoll, hpMinimum, hpProblem, hpReroll, hpWorkedLine, rerollOffered, whoHint, type HpRoll } from './whoTheyAre.ts';

const d8: HpRoll = { dice: 'd8', modifier: { value: 0, ability: 'GRT' }, minimum: 1 };

describe('the dice range', () => {
  it('reads a die, several dice and a plus or minus, and refuses what is not dice', () => {
    expect(diceRange('d8')).toEqual({ min: 1, max: 8, count: 1 });
    expect(diceRange('3d6+1')).toEqual({ min: 4, max: 19, count: 3 });
    expect(diceRange('2d4−1')).toEqual({ min: 1, max: 7, count: 2 });
    expect(diceRange('the GM decides')).toBeNull();
  });
});

describe('the hit points (cr-12)', () => {
  it("reads the pack's lowest starting hit points, and none when the pack gives none", () => {
    expect(hpMinimum([{ hitPoints: { startMinimum: 1 } }])).toBe(1);
    expect(hpMinimum([{ hitPoints: { startMinimum: 1 } }, { hitPoints: { startMinimum: 2 } }])).toBe(2);
    expect(hpMinimum([{ hitPoints: { notes: 'Roll the die.' } }])).toBeNull();
    expect(hpMinimum([{}])).toBeNull();
  });

  it("explains a roll outside the die's range, a missing roll and one that isn't a number", () => {
    expect(hpProblem('', d8)).toBe('Type the hit points you rolled.');
    expect(hpProblem('five', d8)).toBe('Type the roll as a whole number.');
    expect(hpProblem('9', d8)).toBe('d8 gives 1–8: type what the dice showed.');
    expect(hpProblem('0', d8)).toBe('d8 gives 1–8: type what the dice showed.');
    expect(hpProblem('8', d8)).toBeNull();
  });

  it("adds the modifier once per die and never goes under the pack's minimum", () => {
    expect(hpFromRoll('5', d8)).toBe(5);
    expect(hpFromRoll('5', { ...d8, modifier: { value: 1, ability: 'GRT' } })).toBe(6);
    expect(hpFromRoll('1', { ...d8, modifier: { value: -2, ability: 'GRT' } })).toBe(1);
    expect(hpFromRoll('12', { dice: '3d8', modifier: { value: 1, ability: 'GRT' }, minimum: null })).toBe(15);
    expect(hpFromRoll('9', d8)).toBeNull();
  });

  // Ruled 2026-11-02: the modifier is added once per level (one die per level).
  it('above level 1 the modifier is added once per level: level 3 with +1 adds +3', () => {
    const level3: HpRoll = { dice: '3d8', modifier: { value: 1, ability: 'GRT' }, minimum: 1 };
    expect(diceRange(level3.dice)).toEqual({ min: 3, max: 24, count: 3 });
    expect(hpFromRoll('10', level3)).toBe(13);
    expect(hpWorkedLine('10', { ...level3, modifier: { value: 1, ability: 'Grit', score: 13 } })).toBe('10 rolled, +3 for Grit 13 (1 a die): 13 hit points');
    expect(hpAskLine({ ...level3, modifier: { value: 1, ability: 'Grit', score: 13 } })).toBe('Roll 3d8 for hit points and enter it.');
  });

  // Final drafts C (Francis, 2026-11-07), cut by cs-8 (dec-10 D): the Roll row says only the roll; what the score adds is
  // said once, in the sum: "3 rolled, +1 for Grit 13: 4 hit points", never below 1 (the pack's minimum, else 1).
  it('says what to roll in the Roll row, and the sum in words, never below 1 (final drafts C)', () => {
    const grit = (value: number, score?: number): HpRoll => ({ dice: '1d4', modifier: { value, ability: 'Grit', ...(score === undefined ? {} : { score }) }, minimum: null });
    expect(hpAskLine(grit(1, 13))).toBe('Roll 1d4 for hit points and enter it.');
    expect(hpWorkedLine('3', grit(1, 13))).toBe('3 rolled, +1 for Grit 13: 4 hit points');
    // Entering 1 with −2 shows 1 (the plan's test), with no minimum in the pack.
    expect(hpFromRoll('1', grit(-2, 5))).toBe(1);
    expect(hpWorkedLine('1', grit(-2, 5))).toBe('1 rolled, −2 for Grit 5: 1 hit point, never below 1');
    expect(hpAskLine(grit(-2, 5))).toBe('Roll 1d4 for hit points and enter it.');
    // A 0 says nothing; no score: the ability alone.
    expect(hpAskLine(grit(0, 10))).toBe('Roll 1d4 for hit points and enter it.');
    expect(hpWorkedLine('2', grit(0, 10))).toBe('2 rolled: 2 hit points');
    expect(hpAskLine(grit(1))).toBe('Roll 1d4 for hit points and enter it.');
    expect(hpAskLine({ dice: '3d8', modifier: { value: -1, ability: 'Grit' }, minimum: null })).toBe('Roll 3d8 for hit points and enter it.');
    expect(hpAskLine({ dice: 'd6', modifier: null, minimum: null })).toBe('Roll d6 for hit points and enter it.');
    // The pack's minimum wins when it's higher.
    expect(hpWorkedLine('1', { dice: '1d4', modifier: null, minimum: 2 })).toBe('1 rolled: 2 hit points, never below 2');
    expect(hpWorkedLine('', d8)).toBe('');
  });

  // Final drafts A5, C: while the average stands, the line after it says what it gives.
  it('says what the untouched average gives with the bonus, and nothing without one', () => {
    expect(hpAverageLine(2, { dice: '1d4', modifier: { value: 1, ability: 'Grit', score: 13 }, minimum: null })).toBe('+1 for Grit 13: 3 hit points');
    expect(hpAverageLine(2, { dice: '1d4', modifier: null, minimum: null })).toBe('');
});
});

describe('the alignment rows (cr-12)', () => {
  const rules = [{ alignments: ['Lantern', 'Reed'], alignmentNotes: { general: 'Which way you lean.', Lantern: 'Keeps the lights lit.' } }];

  // Design, 2026-11-05 (the gate walk: a paragraph per row was heavy on a phone): the row carries alignmentBlurbs'
  // one line, the entry the full alignmentNotes; with no blurb the row is the name alone, the entry still full.
  it('the row has the pack’s one-line blurb and the entry its full note; no blurb, no words on the row', () => {
    const withBlurbs = [{ ...rules[0], alignmentNotes: { Lantern: 'Keeps the lights lit, through every night of the long fen winter, whatever it costs.' }, alignmentBlurbs: { Lantern: 'Keeps the lights lit.' } }];
    expect(alignmentRows([], withBlurbs)).toEqual([
      { name: 'Lantern', blurb: 'Keeps the lights lit.', note: 'Keeps the lights lit, through every night of the long fen winter, whatever it costs.' },
      { name: 'Reed', blurb: '', note: '' },
    ]);
    expect(alignmentRows([], rules)[0]).toEqual({ name: 'Lantern', blurb: '', note: 'Keeps the lights lit.' });
  });

  it("lists the campaign field's choices with the pack's notes, else the setting's own list, else nothing", () => {
    expect(alignmentRows(['Lantern', 'Mire'], rules)).toEqual([
      { name: 'Lantern', blurb: '', note: 'Keeps the lights lit.' },
      { name: 'Mire', blurb: '', note: '' },
    ]);
    expect(alignmentRows([], rules).map((r) => r.name)).toEqual(['Lantern', 'Reed']);
    expect(alignmentRows([], [{}])).toEqual([]);
    expect(alignmentLine(rules)).toBe('Which way you lean.');
  });
});

describe('the Derived fields (cr-12, cr-23)', () => {
  const fields = [
    { key: 'name', label: 'Motto', fill: null, hidden: false },
    { key: 'attack', label: 'Attack', fill: 'attack', hidden: false },
    { key: 'literacy', label: 'Literacy', fill: 'abilityModifiers.WIT.literacy', hidden: false },
    { key: 'title', label: 'Title', fill: 'title', hidden: false },
    { key: 'secret', label: 'Secret', fill: 'attack', hidden: true },
  ];
  const filled = { attack: 19, 'abilityModifiers.WIT': { extraLanguages: 1, literacy: 'Reads' } };

  it('lists only the visible fields with a fill, their value live, empty where the rules give none yet (never "—", ct-5), and a part note by fill name', () => {
    expect(derivedRows(fields, filled)).toEqual([
      { key: 'attack', label: 'Attack', value: '19' },
      { key: 'literacy', label: 'Literacy', value: 'Reads' },
      { key: 'title', label: 'Title', value: '' },
    ]);
    expect(derivedRows(fields, filled, { attack: 'unarmoured, NIM +0', title: 'not shown without a value' })[0]).toEqual({ key: 'attack', label: 'Attack', value: '19', note: 'unarmoured, NIM +0' });
    expect(derivedRows(fields, filled, { title: 'not shown without a value' })[2]).toEqual({ key: 'title', label: 'Title', value: '' });
  });

  it('reaches into a filled row by the fill name', () => {
    expect(filledAt(filled, 'abilityModifiers.WIT.literacy')).toBe('Reads');
    expect(filledAt(filled, 'abilityModifiers.WIT.nothing')).toBeUndefined();
    expect(filledAt(filled, 'saves.mire')).toBeUndefined();
  });
});

describe("the foot's hint and Next's check (cr-2)", () => {
  const leaning = (set: boolean, required = true) => ({ set, required, label: 'Leaning' });

  it('names what is missing, explains a roll out of range in full, and says what is set', () => {
    expect(whoHint({ name: '', hp: { typed: false, problem: 'Type the hit points you rolled.' }, alignment: null })).toEqual({ problem: 'Name and hp missing.', hint: 'Name and hp missing' });
    expect(whoHint({ name: '', hp: null, alignment: null })).toEqual({ problem: 'Give your character a name.', hint: 'Name missing' });
    expect(whoHint({ name: 'Tam', hp: { typed: false, problem: 'Type the hit points you rolled.' }, alignment: null })).toEqual({ problem: 'Type the hit points you rolled.', hint: 'hp missing' });
    expect(whoHint({ name: 'Tam', hp: { typed: true, problem: 'd8 gives 1–8: type what the dice showed.' }, alignment: null })).toEqual({ problem: 'd8 gives 1–8: type what the dice showed.', hint: 'd8 gives 1–8: type what the dice showed.' });
    expect(whoHint({ name: 'Tam', hp: { typed: true, problem: null }, alignment: leaning(true) })).toEqual({ problem: null, hint: 'Name, hp and leaning set' });
    expect(whoHint({ name: 'Tam', hp: null, alignment: null }).hint).toBe('Name set');
  });

  it('counts the alignment as missing only when the campaign requires it', () => {
    expect(whoHint({ name: 'Tam', hp: null, alignment: leaning(false) })).toEqual({ problem: 'Pick your leaning.', hint: 'Leaning missing' });
    expect(whoHint({ name: '', hp: null, alignment: leaning(false) }).hint).toBe('Name and leaning missing');
    expect(whoHint({ name: 'Tam', hp: null, alignment: leaning(false, false) })).toEqual({ problem: null, hint: 'Name set' });
  });
});

describe('the hit-points re-roll (follow-up A, cf-1)', () => {
  const sets = [{ hitPoints: { startMinimum: 1, minimumPerDie: 1, reroll: { atMost: 2, option: 'second-wind', note: 'Roll a 1 or 2 again.' } } }];

  it("reads the pack's reroll block, the top rules set first, and nothing without one", () => {
    expect(hpReroll(sets)).toEqual({ atMost: 2, option: 'second-wind', note: 'Roll a 1 or 2 again.' });
    expect(hpReroll([{ hitPoints: { reroll: { atMost: 1 } } }])).toEqual({ atMost: 1, option: null, note: '' });
    expect(hpReroll([...sets, { hitPoints: { startMinimum: 2 } }])).toBeNull();
    expect(hpReroll([{ hitPoints: { reroll: { atMost: 0 } } }, { hitPoints: 'Roll your hit die.' }])).toBeNull();
    expect(hpReroll([])).toBeNull();
    expect(hpMinimum(sets)).toBe(1);
  });

  it('offers Roll again only for a good roll at or under atMost, before the modifier, with its option on', () => {
    const reroll = hpReroll(sets);
    const minus = { ...d8, modifier: { value: -1, ability: 'GRT' } };
    expect(rerollOffered('2', d8, reroll)).toBe(true);
    expect(rerollOffered('1', minus, reroll)).toBe(true);
    expect(rerollOffered('3', d8, reroll)).toBe(false);
    expect(rerollOffered('9', d8, reroll)).toBe(false);
    expect(rerollOffered('', d8, reroll)).toBe(false);
    expect(rerollOffered('2', d8, reroll, () => false)).toBe(false);
    expect(rerollOffered('2', d8, reroll, (id) => id === 'second-wind')).toBe(true);
    expect(rerollOffered('2', d8, null)).toBe(false);
    // No die to roll (the GM gives the number): nothing to roll again.
    expect(rerollOffered('2', { ...d8, dice: '' }, reroll)).toBe(false);
  });
});

describe('the alignments a class may take (cs-3, rc-5)', () => {
  const rows = [
    { name: 'Lantern', blurb: '', note: 'Keeps the lamps lit.' },
    { name: 'Reed', blurb: '', note: 'Bends with the wind.' },
    { name: 'Mire', blurb: '', note: 'Takes what sinks.' },
  ];

  // Purpose: under a hard limit the closed alignments stay in the list as not-allowed rows (cw-8), never hidden, and the line still says what's open.
  it('a hard limit keeps every alignment, the closed ones marked closed, with a line saying what is open', () => {
    const offer = alignmentOffer(rows, { names: ['Lantern', 'Reed'], soft: false }, 'marsh chaplain');
    expect(offer.rows.map((r) => [r.name, !!r.closed])).toEqual([['Lantern', false], ['Reed', false], ['Mire', true]]);
    expect(offer.line).toBe('A marsh chaplain may only be Lantern or Reed.');
    expect(alignmentClosedReason('marsh chaplain', 'Mire')).toBe("A marsh chaplain can't be Mire.");
  });

  it('a soft limit offers every alignment, the others marked for the GM’s special approval', () => {
    const offer = alignmentOffer(rows, { names: ['Reed', 'Mire'], soft: true }, 'reed witch');
    expect(offer.rows.map((r) => [r.name, r.special])).toEqual([['Lantern', true], ['Reed', false], ['Mire', false]]);
    expect(offer.line).toBe("A reed witch is usually Reed or Mire; another needs the GM's special approval.");
    expect(alignmentRequirement({ names: ['Reed', 'Mire'], soft: true }, 'reed witch')).toBe('A reed witch is usually Reed or Mire');
  });

  it('no limit, or a limit naming none of the rows, hides nothing and says nothing', () => {
    expect(alignmentOffer(rows, null, 'fen cantor')).toEqual({ rows: rows.map((r) => ({ ...r, special: false })), line: '' });
    expect(alignmentOffer(rows, { names: ['Starlit'], soft: false }, 'fen cantor').rows).toHaveLength(3);
  });

  it('an alignment picked that the class can’t take is a problem for Next, said in full; "An" before a vowel', () => {
    const limit = { names: ['Lantern'], soft: false };
    expect(alignmentProblem(limit, 'Mire', 'ash tender', 'leaning')).toBe("An ash tender can't be Mire. Pick another leaning.");
    expect(alignmentProblem(limit, 'Lantern', 'ash tender', 'leaning')).toBeNull();
    expect(alignmentProblem({ names: ['Lantern'], soft: true }, 'Mire', 'ash tender', 'leaning')).toBeNull();
    const problem = "An ash tender can't be Mire. Pick another leaning.";
    expect(whoHint({ name: 'Wren', hp: null, alignment: { set: true, required: true, label: 'Leaning', problem } })).toEqual({ problem, hint: problem });
  });
});

describe('a field from a table that sets the alignment (cs-3, G-89: the knight’s liege)', () => {
  const lodges = {
    packEntryId: 'fen-lodges',
    name: 'Warden lodges',
    data: {
      die: 'd4',
      rows: [
        { min: 1, max: 1, result: 'The Lantern Court (Lantern)', alignment: 'Lantern' },
        { min: 2, max: 4, result: 'The Reed Moot', alignment: 'reed' },
      ],
    },
  };
  const fields = [
    { key: 'oath', label: 'Oath', type: 'text', hidden: false },
    { key: 'omen', label: 'Omen', type: 'list', hidden: false },
    { key: 'motto', label: 'Motto', type: 'text', hidden: false },
  ];
  const from = new Map([
    ['oath', 'fen-lodges'],
    ['omen', 'fen-lodges'],
    ['motto', 'no-such-table'],
  ]);
  const asked = tableFields(fields, from, [lodges]);
  const rows = [
    { name: 'Lantern', note: '', special: false },
    { name: 'Reed', note: '', special: false },
    { name: 'Mire', note: '', special: false },
  ];

  // Purpose: only a text field whose layout `from` names a table with rows is asked from the table, the row's alignment read.
  it('finds the fields fed by a table', () => {
    expect(asked.map((f) => f.key)).toEqual(['oath']);
    expect(asked[0]!.table.rows.map((r) => r.alignment)).toEqual(['Lantern', 'reed']);
  });

  // Purpose: a picked row with an alignment offers only that alignment (any case), with a line saying why; nothing picked changes nothing.
  it('offers only the alignment the row sets, and says why', () => {
    const set = alignmentSetBy(asked, { oath: 'The Reed Moot' });
    expect(set).toEqual({ by: 'Oath', row: 'The Reed Moot', alignment: 'reed' });
    const offer = alignmentOfferSet({ rows, line: '' }, set, 'lantern warden', 'leaning');
    expect(offer.rows.map((r) => r.name)).toEqual(['Reed']);
    expect(offer.line).toBe("A lantern warden's leaning is their oath's: The Reed Moot.");
    expect(alignmentOfferSet({ rows, line: '' }, alignmentSetBy(asked, {}), 'lantern warden', 'leaning').rows).toHaveLength(3);
    // A row naming an alignment the setting doesn't have hides nothing.
    expect(alignmentOfferSet({ rows, line: '' }, { by: 'Oath', row: 'x', alignment: 'Ember' }, 'lantern warden', 'leaning').rows).toHaveLength(3);
  });

  // Purpose: Next refuses an alignment that isn't the one the row sets, and names both ways out.
  it("refuses an alignment that isn't the row's", () => {
    const set = alignmentSetBy(asked, { oath: 'The Lantern Court (Lantern)' });
    expect(alignmentSetProblem(set, 'Mire', rows, 'lantern warden', 'leaning')).toBe("A lantern warden's leaning is their oath's: pick Lantern, or another oath.");
    expect(alignmentSetProblem(set, '', rows, 'lantern warden', 'leaning')).not.toBeNull();
    expect(alignmentSetProblem(set, 'lantern', rows, 'lantern warden', 'leaning')).toBeNull();
    expect(alignmentSetProblem(null, 'Mire', rows, 'lantern warden', 'leaning')).toBeNull();
  });
});
