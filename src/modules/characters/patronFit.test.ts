// The patron crossed with a class's alignment limit, in pure functions (fix-patron-class-alignment; cp-1 and the
// review nits of #665, 2026-11-13): how each patron fits, the row's words, the GM's soft reason, the closed entry's
// words, and the line that holds a closed patron kept from before. Invented names only.
import { describe, expect, it } from 'vitest';
import { offeredPatronApproval, patronAskedIn, patronClosedEntry, patronFit, patronProblemIn, patronRowLine, patronsFor, readPatron, type PatronEntry, type PatronFitTo } from './patrons.ts';

const HARD = { names: ['Lantern', 'Reed'], soft: false };
const SOFT = { names: ['Lantern', 'Reed'], soft: true };
const ALIGNMENTS = ['Lantern', 'Reed', 'Mire'];

describe('patronFit', () => {
  // Purpose: a patron whose followers share a name with the class's limit is open; one outside a soft limit goes to
  // the GM; one outside a hard limit is closed.
  it('is ok, soft or closed by the limit', () => {
    expect(patronFit({ alignments: ['Reed'] }, HARD, ALIGNMENTS)).toBe('ok');
    expect(patronFit({ alignments: ['Mire'] }, SOFT, ALIGNMENTS)).toBe('soft');
    expect(patronFit({ alignments: ['Mire'] }, HARD, ALIGNMENTS)).toBe('closed');
  });

  // Purpose: names are matched whatever their case, on every side.
  it('matches names whatever their case', () => {
    expect(patronFit({ alignments: ['reed'] }, HARD, ALIGNMENTS)).toBe('ok');
    expect(patronFit({ alignments: ['MIRE'] }, HARD, ['lantern', 'reed', 'mire'])).toBe('closed');
  });

  // Purpose: the safety net: a limit whose names match none of the campaign's alignments (a pack mismatch) closes nothing.
  it('closes nothing when the limit matches no campaign alignment', () => {
    expect(patronFit({ alignments: ['Mire'] }, { names: ['Dawn', 'Dusk'], soft: false }, ALIGNMENTS)).toBe('ok');
  });

  // Purpose: with no limit, no follower alignments, or no campaign alignments, every patron is open.
  it('is ok without a limit, follower alignments or campaign alignments', () => {
    expect(patronFit({ alignments: ['Mire'] }, null, ALIGNMENTS)).toBe('ok');
    expect(patronFit({ alignments: [] }, HARD, ALIGNMENTS)).toBe('ok');
    expect(patronFit({ alignments: ['Mire'] }, HARD, [])).toBe('ok');
  });
});

describe('the words of a closed patron (cp-1)', () => {
  const chaplain = 'marsh chaplain';
  const bell = readPatron({ packEntryId: 'ex-bell', name: 'The Sunken Bell', data: { blurb: 'Rings under the water', followers: { classes: ['ex-chaplain'], alignments: ['Mire'] } } });

  // Purpose (cp-1 b): the entry's warning line says exactly the row's words, and the why under it is the plain sentence.
  it('the entry says the row words, then why', () => {
    expect(patronClosedEntry(bell, HARD, chaplain)).toEqual({ why: 'Not open to marsh chaplain', note: 'Mire followers. A marsh chaplain may only be Lantern or Reed.' });
  });

  // Purpose (cp-1 d): a blurb with no end punctuation gets a full stop before the followers line; one that ends in
  // punctuation (a closing quote after it included) is left as it is.
  it('puts a full stop between an unpunctuated blurb and the followers', () => {
    expect(patronRowLine(bell)).toBe('Rings under the water. Mire followers');
    const said = (blurb: string) => patronRowLine(readPatron({ packEntryId: 'ex-x', name: 'X', data: { blurb, followers: { alignments: ['Reed'] } } }));
    expect(said('Keep the lamp lit!')).toBe('Keep the lamp lit! Reed followers');
    expect(said('“Keep the lamp lit.”')).toBe('“Keep the lamp lit.” Reed followers');
    expect(said('"Who calls?"')).toBe('"Who calls?" Reed followers');
    expect(said('Wait…')).toBe('Wait… Reed followers');
  });

  // Purpose (cp-1 c): the GM's soft reason ends with a full stop.
  it("the GM's soft reason ends with a full stop", () => {
    const entry: PatronEntry = { packEntryId: 'ex-lamp', name: 'The Sunk Lamp', data: { followers: { classes: ['ex-chaplain'], alignments: ['Mire'] } } };
    const fitTo: PatronFitTo = { limit: SOFT, alignments: ALIGNMENTS };
    const offered = patronsFor([entry], 'ex-chaplain', [], fitTo)[0]!;
    expect(offeredPatronApproval(offered, fitTo, chaplain)?.requirement).toBe('Mire followers; a marsh chaplain is usually Lantern or Reed.');
  });
});

describe('a closed patron is never asked for, and one kept from before is held', () => {
  const all = (patrons: PatronEntry[]) => [
    { packEntryId: 'ex-chaplain', name: 'Marsh Chaplain', kind: 'class', data: { alignments: ['Lantern', 'Reed'] } },
    ...patrons.map((p) => ({ ...p, kind: 'patron' })),
  ];
  const BELL: PatronEntry = { packEntryId: 'ex-bell', name: 'The Sunken Bell', data: { followers: { classes: ['ex-chaplain'], alignments: ['Mire'] } } };
  const HERON: PatronEntry = { packEntryId: 'ex-heron', name: 'The Still Heron', data: { followers: { classes: ['ex-chaplain'], alignments: ['Reed'] } } };

  // Purpose (nit 2): the review asks for a patron only when the class has one it may follow.
  it('asks for a patron only when one is open', () => {
    expect(patronAskedIn(all([BELL]), 'ex-chaplain', ALIGNMENTS)).toBe(false);
    expect(patronAskedIn(all([BELL, HERON]), 'ex-chaplain', ALIGNMENTS)).toBe(true);
    // No alignment names known: nothing is closed, so the Bell is asked for.
    expect(patronAskedIn(all([BELL]), 'ex-chaplain', [])).toBe(true);
  });

  // Purpose (nit 1): a closed patron kept from before holds Send with a clear line; with no open patron the line says
  // to take it off; an open pick, or none for a class whose patrons are all closed, holds nothing.
  it('holds a kept closed patron, and nothing else', () => {
    const kept = { patron: { id: 'ex-bell', name: 'The Sunken Bell' } };
    expect(patronProblemIn(all([BELL, HERON]), 'ex-chaplain', kept, ALIGNMENTS)).toBe("A marsh chaplain can't follow The Sunken Bell. Pick another patron.");
    expect(patronProblemIn(all([BELL]), 'ex-chaplain', kept, ALIGNMENTS)).toBe("A marsh chaplain can't follow The Sunken Bell. Take it off.");
    expect(patronProblemIn(all([BELL, HERON]), 'ex-chaplain', { patron: { id: 'ex-heron', name: 'The Still Heron' } }, ALIGNMENTS)).toBeNull();
    expect(patronProblemIn(all([BELL]), 'ex-chaplain', {}, ALIGNMENTS)).toBeNull();
    // Some open, none picked: the patron is still to choose.
    expect(patronProblemIn(all([BELL, HERON]), 'ex-chaplain', {}, ALIGNMENTS)).toBe('Choose a patron first: a marsh chaplain needs one before your GM can approve.');
  });
});
