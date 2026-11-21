// Patrons, the pure part (December step 1a; plans/dec-1-creation.md 1a, plans/m5b-patrons.md A–C). Every name and
// number is invented.
import { describe, expect, it } from 'vitest';
import { withStepApprovals } from './creationSteps.ts';
import { firstSpellsPlan } from './firstSpells.ts';
import {
  garbItemIds,
  marksReached,
  NOT_ATTACHED,
  patronAlignmentChange,
  patronAlignmentOffer,
  patronAlignmentProblem,
  patronApproval,
  patronEntry,
  patronFirstLine,
  patronNeeded,
  patronLadder,
  patronLines,
  patronNameOf,
  patronOf,
  patronPickToast,
  patronRowLine,
  patronsFor,
  readPatron,
  topSpellLevel,
  withPatron,
  withSwaps,
  type PatronEntry,
} from './patrons.ts';
import { redoRecord } from './redo.ts';

const WARDEN: PatronEntry = {
  packEntryId: 'ex-patron-lantern-warden',
  name: 'The Lantern Warden',
  packId: 'pack-road',
  data: {
    title: 'Keeper of the Last Light',
    option: 'ex-opt-patrons',
    blurb: 'Keeper of the Last Light: the god of lost travellers',
    description: 'Guides the lost home and burns those who lead them astray.',
    depiction: 'A tall figure with a lantern for a head.',
    alignment: 'Lantern',
    followers: { classes: ['marsh-chaplain'], alignments: ['Lantern', 'Reed'] },
    holySymbol: 'A lantern with an open shutter.',
    holyGarb: [
      { atSpellLevel: 1, text: 'A brass hand-lantern', itemIds: ['ex-garb-warden-1'], costGp: 20 },
      { atSpellLevel: 0, text: 'A grey travelling cloak', itemIds: ['ex-garb-warden-0'], costGp: 5 },
      { atSpellLevel: 3, text: 'A lamp-chain stole', itemIds: ['ex-garb-warden-3'], costGp: 90 },
    ],
    prayer: 'Prays for spells only beside a lit flame.',
    strictures: 'Must never leave a traveller lost on the road.',
    spells: { extends: 'marsh-chaplain', swap: [{ level: 1, replaces: 'ex-spell-mend-cup', with: 'ex-spell-guiding-glow' }, { level: 3, replaces: 'ex-spell-calm-beasts', with: 'ex-spell-road-home' }] },
    marks: [{ atSpellLevel: 1, text: "Eyes catch the light like a cat's." }, { atSpellLevel: 3, text: 'Casts no shadow by lamplight.' }],
    realm: 'The Long Road.',
    approval: 'gm',
    approvalNote: 'Ask your GM: the Warden takes few servants.',
    source: 'Road pack, homebrew',
  },
};
const HERON: PatronEntry = { packEntryId: 'ex-patron-heron', name: 'The Still Heron', packId: 'pack-road', data: { blurb: 'Patience in the reeds.', followers: { classes: ['marsh-chaplain', 'reed-witch'], alignments: ['Mire'] } } };
const ROWS = [{ name: 'Lantern' }, { name: 'Reed' }, { name: 'Mire' }];
const PACKS = [{ packId: 'pack-road', name: 'Road pack' }, { packId: 'pack-fen', name: 'Fen zine' }];

describe('which patrons a character is offered', () => {
  // Purpose: the step lists every patron in play whose followers name the character's class, and none for a class
  // nobody takes; a patron its option switches off is left out.
  it('lists the patrons whose followers name the class, never one switched off', () => {
    const all = [WARDEN, HERON, { ...HERON, packEntryId: 'ex-patron-off', name: 'The Drowned Bell', optionOff: 'ex-opt-patrons' }];
    expect(patronsFor(all, 'marsh-chaplain', PACKS).map((o) => o.label)).toEqual(['The Lantern Warden', 'The Still Heron']);
    expect(patronsFor(all, 'reed-witch', PACKS).map((o) => o.label)).toEqual(['The Still Heron']);
    expect(patronsFor(all, 'lantern-warden', PACKS)).toEqual([]);
    expect(patronsFor(all, '', PACKS)).toEqual([]);
  });

  // Purpose (standing rule sn-1): two patrons with the same name each show their pack; one with no namesake shows none.
  it('shows the pack after the name only when two patrons share it', () => {
    const twin: PatronEntry = { ...HERON, packEntryId: 'ex-patron-heron-fen', packId: 'pack-fen' };
    const offered = patronsFor([WARDEN, HERON, twin], 'marsh-chaplain', PACKS);
    expect(offered.map((o) => o.label)).toEqual(['The Lantern Warden', 'The Still Heron, Road pack', 'The Still Heron, Fen zine']);
  });

  // Purpose: a misshapen patron reads as empty parts and is never offered; nothing throws.
  it('reads a patron with nothing in it as empty, and offers it to nobody', () => {
    const bare = readPatron({ packEntryId: 'ex-bare', name: 'Bare', data: { followers: 'everyone', holyGarb: 'robes', spells: [], marks: [{ text: 'no tier' }] } });
    expect(bare).toMatchObject({ classes: [], alignments: [], garb: [], swaps: [], marks: [], needsGm: false });
    expect(patronsFor([{ packEntryId: 'ex-bare', name: 'Bare', data: {} }], 'marsh-chaplain')).toEqual([]);
  });

  it('the row says the blurb and who may follow', () => {
    expect(patronRowLine(readPatron(WARDEN))).toBe('Keeper of the Last Light: the god of lost travellers. Lantern or Reed followers');
    expect(patronRowLine(readPatron(HERON))).toBe('Patience in the reeds. Mire followers');
  });
});

describe('what a pick does to the alignment (pt-3)', () => {
  const warden = readPatron(WARDEN);
  const heron = readPatron(HERON);

  // Purpose: a patron whose followers have one alignment sets it; one with several leaves only those rows open and
  // clears a pick outside them; a patron naming none changes nothing (plan m5b-patrons ⚑2).
  it('sets the one allowed alignment, clears a pick outside several, and leaves the rest alone', () => {
    expect(patronAlignmentChange(heron, '', ROWS)).toEqual({ set: 'Mire' });
    expect(patronAlignmentChange(heron, 'Mire', ROWS)).toBeNull();
    expect(patronAlignmentChange(warden, 'Mire', ROWS)).toEqual({ clear: true });
    expect(patronAlignmentChange(warden, 'Reed', ROWS)).toBeNull();
    expect(patronAlignmentChange(warden, '', ROWS)).toBeNull();
    expect(patronAlignmentChange(readPatron({ ...HERON, data: { followers: { classes: ['marsh-chaplain'] } } }), 'Mire', ROWS)).toBeNull();
  });

  it('leaves only the allowed rows open, with a line saying why; a patron naming no alignment the campaign has hides nothing', () => {
    const offer = { rows: ROWS, line: '' };
    expect(patronAlignmentOffer(offer, warden, 'leaning')).toEqual({ rows: [{ name: 'Lantern' }, { name: 'Reed' }], line: 'A follower of The Lantern Warden is Lantern or Reed: their leaning follows their patron.' });
    expect(patronAlignmentOffer(offer, null, 'leaning')).toBe(offer);
    expect(patronAlignmentOffer(offer, readPatron({ ...HERON, data: { followers: { classes: ['x'], alignments: ['Elsewhere'] } } }), 'leaning')).toBe(offer);
  });

  it("Next says so when the alignment picked isn't one the patron's followers may have", () => {
    expect(patronAlignmentProblem(warden, 'Mire', ROWS, 'leaning')).toBe('A follower of The Lantern Warden is Lantern or Reed: pick another leaning, or another patron.');
    expect(patronAlignmentProblem(warden, 'reed', ROWS, 'leaning')).toBeNull();
    expect(patronAlignmentProblem(warden, '', ROWS, 'leaning')).toBeNull();
    expect(patronAlignmentProblem(null, 'Mire', ROWS, 'leaning')).toBeNull();
  });

  it('the toast says what the pick set', () => {
    expect(patronPickToast({ name: 'The Still Heron', alignment: { word: 'leaning', name: 'Mire' }, also: 'Affiliation' })).toBe('Patron: The Still Heron. Your leaning is now Mire, as their followers are, and your affiliation is The Still Heron.');
    expect(patronPickToast({ name: 'The Lantern Warden', cleared: { word: 'leaning', name: 'Mire' } })).toBe("Patron: The Lantern Warden. Their followers can't be Mire: pick your leaning again.");
    expect(patronPickToast({ name: 'The Lantern Warden', also: 'Affiliation' })).toBe('Patron: The Lantern Warden. Your affiliation is The Lantern Warden.');
    expect(patronPickToast({ name: 'The Lantern Warden' })).toBe('Patron: The Lantern Warden.');
  });
});

describe("a patron the GM must approve (approval: 'gm')", () => {
  // Purpose: picking a patron marked for the GM flags the character with the special-approval value "patron" and the
  // pack's note as its reason; a free patron flags nothing; the flag sits on the creation record with the others.
  it('flags the pick with the pack’s note; a free patron flags nothing', () => {
    expect(patronApproval(readPatron(WARDEN))).toEqual({ step: 'patron', entryId: 'ex-patron-lantern-warden', name: 'The Lantern Warden', requirement: 'Ask your GM: the Warden takes few servants.' });
    expect(patronApproval(readPatron(HERON))).toBeNull();
    expect(patronApproval(null)).toBeNull();
    const noNote = readPatron({ ...HERON, data: { ...HERON.data, approval: 'gm' } });
    expect(patronApproval(noNote)?.requirement).toBe("Following The Still Heron needs the GM's approval");
    const record = withStepApprovals({ specialApprovals: [{ step: 'class', entryId: 'c', name: 'C', requirement: 'r' }] }, 'patron', [patronApproval(readPatron(WARDEN))!]);
    expect((record.specialApprovals as { step: string }[]).map((s) => s.step)).toEqual(['class', 'patron']);
  });

  // Purpose: a redo of the scores (or of the class) never drops the patron's flag or the patron: they are Who they
  // are's, kept until that step is saved again, so the GM's approval can't be walked around.
  it('a redo of the earlier steps keeps the patron and its flag', () => {
    const was = { patron: { id: 'ex-patron-lantern-warden', name: 'The Lantern Warden' }, specialApprovals: [patronApproval(readPatron(WARDEN))] };
    for (const changed of [false, true]) {
      const { creation } = redoRecord(was, { method: null, rolled: {}, scores: {}, classRef: 'marsh-chaplain', raceRef: null } as never, changed);
      expect(creation.patron).toEqual(was.patron);
      expect(creation.specialApprovals).toEqual(was.specialApprovals);
    }
  });

  // Purpose (pt-10): a redo that carries the patron (the Patron step is a guided step now) writes it: a new patron and
  // its flag from the choice, none taking it and its flag off, Decide later putting "patron" on the To finish list.
  it('a redo that carries the patron writes it, takes it off, or puts it off', () => {
    const was = { patron: { id: 'ex-patron-lantern-warden', name: 'The Lantern Warden' }, specialApprovals: [patronApproval(readPatron(WARDEN))], toFinish: ['gear'] };
    const base = { method: null, rolled: {}, scores: {}, classRef: 'marsh-chaplain', raceRef: null };
    const heron = redoRecord(was, { ...base, patron: { id: 'ex-patron-heron', name: 'The Still Heron' } }, false).creation;
    expect(heron.patron).toEqual({ id: 'ex-patron-heron', name: 'The Still Heron' });
    expect(heron.specialApprovals).toBeUndefined();
    expect(heron.toFinish).toEqual(['gear']);
    const later = redoRecord(was, { ...base, patron: null, patronLater: true }, false).creation;
    expect(later.patron).toBeUndefined();
    expect(later.toFinish).toEqual(['gear', 'patron']);
    // A class change clears the later steps' list, and the put-off patron goes back on it.
    expect(redoRecord(was, { ...base, patron: null, patronLater: true }, true).creation.toFinish).toEqual(['patron']);
  });

  // Purpose (the lead's ruling, 2026-11-11): a character needs a patron while its class is offered any and its
  // record names none of them; a class nobody offers a patron to never does.
  it('says when a character still needs a patron', () => {
    expect(patronNeeded([WARDEN, HERON], 'marsh-chaplain', { toFinish: ['patron'] })).toBe(true);
    expect(patronNeeded([WARDEN, HERON], 'marsh-chaplain', { patron: { id: 'ex-patron-gone', name: 'Gone' } })).toBe(true);
    expect(patronNeeded([WARDEN, HERON], 'marsh-chaplain', { patron: { id: 'ex-patron-heron', name: 'The Still Heron' } })).toBe(false);
    expect(patronNeeded([WARDEN, HERON], 'lantern-warden', {})).toBe(false);
    expect(patronNeeded([{ ...WARDEN, optionOff: 'ex-opt-patrons' }], 'marsh-chaplain', {})).toBe(false);
    expect(patronNeeded([WARDEN], null, {})).toBe(false);
    expect(patronFirstLine('Acolyte')).toBe('Choose a patron first: an acolyte needs one before your GM can approve.');
  });

  it('the creation record keeps the patron by id and name, and reads it back', () => {
    const record = withPatron({ method: 'm' }, readPatron(WARDEN));
    expect(record).toEqual({ method: 'm', patron: { id: 'ex-patron-lantern-warden', name: 'The Lantern Warden' } });
    expect(patronNameOf(record)).toBe('The Lantern Warden');
    expect(patronOf(record, [HERON, WARDEN])?.id).toBe('ex-patron-lantern-warden');
    // A patron no attached pack has any more reads as none; its name is still on the record.
    expect(patronOf(record, [HERON])).toBeNull();
    expect(withPatron(record, null)).toEqual({ method: 'm' });
    expect(patronNameOf({})).toBe('');
  });
});

describe('tiers: garb and marks by the spell level reached', () => {
  const warden = readPatron(WARDEN);

  it('the highest spell level cast now comes from the spells a day', () => {
    expect(topSpellLevel([])).toBe(0);
    expect(topSpellLevel([0, 0])).toBe(0);
    expect(topSpellLevel([1])).toBe(1);
    expect(topSpellLevel([3, 2, 0])).toBe(2);
  });

  // Purpose: tier 0 is given at creation; each later tier only once the cleric casts spells of that level; a level-2
  // cleric casting level-1 spells has tiers 0 and 1, never tier 3.
  it('gives the garb of every tier reached and no higher', () => {
    expect(garbItemIds(warden, 0)).toEqual(['ex-garb-warden-0']);
    expect(garbItemIds(warden, 1)).toEqual(['ex-garb-warden-0', 'ex-garb-warden-1']);
    expect(garbItemIds(warden, 2)).toEqual(['ex-garb-warden-0', 'ex-garb-warden-1']);
    expect(garbItemIds(warden, 3)).toHaveLength(3);
  });

  it('a mark shows only from its tier', () => {
    expect(marksReached(warden, 0)).toEqual([]);
    expect(marksReached(warden, 1).map((m) => m.text)).toEqual(["Eyes catch the light like a cat's."]);
    expect(marksReached(warden, 3)).toHaveLength(2);
  });
});

describe("the class's spell list with the patron's swaps (pt-5)", () => {
  const warden = readPatron(WARDEN);
  const list = new Map([
    [1, ['ex-spell-mend-cup', 'lantern-blessing']],
    [3, ['ex-spell-calm-beasts']],
  ]);
  const known = (attached: string[]) => (id: string) => attached.includes(id);

  // Purpose: a swapped-in spell takes the replaced spell's place at the swap's level and is marked as the patron's.
  it('puts each swapped-in spell in place of the one it replaces', () => {
    const swapped = withSwaps(list, warden, 'marsh-chaplain', known(['ex-spell-guiding-glow', 'ex-spell-road-home']));
    expect(swapped.list.get(1)).toEqual(['ex-spell-guiding-glow', 'lantern-blessing']);
    expect(swapped.list.get(3)).toEqual(['ex-spell-road-home']);
    expect([...swapped.from]).toEqual([['ex-spell-guiding-glow', 'The Lantern Warden'], ['ex-spell-road-home', 'The Lantern Warden']]);
    // The class's own list is never changed in place.
    expect(list.get(1)).toEqual(['ex-spell-mend-cup', 'lantern-blessing']);
  });

  // Purpose (the lead's ruling, 2026-11-11): the swapped-in spell may live on another class's list in another attached
  // pack; it is cast as the class's own at the swap's level, and need not be on the class's list at all.
  it("casts a spell from another pack's list at the swap's level, though the class's list never had it", () => {
    const swapped = withSwaps(new Map([[1, ['lantern-blessing']]]), readPatron({ ...WARDEN, data: { ...WARDEN.data, spells: { extends: 'marsh-chaplain', swap: [{ level: 2, replaces: 'ex-spell-not-on-list', with: 'frog-chorus' }] } } }), 'marsh-chaplain', known(['frog-chorus']));
    expect(swapped.list.get(1)).toEqual(['lantern-blessing']);
    expect(swapped.list.get(2)).toEqual(['frog-chorus']);
  });

  // Purpose (the review of #636): a swapped-in spell the class already lists at another level is cast at the swap's
  // level only, never at two.
  it('never leaves the swapped-in spell at two levels', () => {
    const twice = new Map([
      [1, ['ex-spell-mend-cup', 'ex-spell-road-home']],
      [2, ['ex-spell-guiding-glow']],
      [3, ['ex-spell-calm-beasts']],
    ]);
    const swapped = withSwaps(twice, warden, 'marsh-chaplain', () => true).list;
    expect(swapped.get(1)).toEqual(['ex-spell-guiding-glow']);
    expect(swapped.get(2)).toEqual([]);
    expect(swapped.get(3)).toEqual(['ex-spell-road-home']);
  });

  // Purpose (the lead's ruling): a swap whose spell no attached pack has is skipped, never a failure: the class's
  // spell stays castable, and the swap is shown as text with "pack not attached".
  it('skips a swap whose spell no attached pack has, and says so in words', () => {
    const swapped = withSwaps(list, warden, 'marsh-chaplain', known(['ex-spell-road-home']));
    expect(swapped.list.get(1)).toEqual(['ex-spell-mend-cup', 'lantern-blessing']);
    expect(swapped.list.get(3)).toEqual(['ex-spell-road-home']);
    expect(swapped.from.has('ex-spell-guiding-glow')).toBe(false);
    const names = { spell: (id: string) => ({ 'ex-spell-mend-cup': 'Mend Cup', 'ex-spell-road-home': 'Road Home', 'ex-spell-calm-beasts': 'Calm Beasts' })[id] };
    const lines = patronLines(warden, 3, 'marsh-chaplain', names);
    expect(lines.find((l) => l.key === 'spells')?.value).toBe(`Level 1: ex-spell-guiding-glow (${NOT_ATTACHED}) in place of Mend Cup; Level 3: Road Home in place of Calm Beasts`);
  });

  // Purpose (the lead's ruling B, 2026-11-11): the swaps reach a follower class that casts from the list the
  // extended class casts from (an acolyte on the chaplain's list); a follower class with a list of its own is not
  // swapped, nor is one whose list can't be told (the extended class isn't attached).
  it('applies the swaps to a follower class on the same list, never to one with its own list', () => {
    const both = readPatron({ ...WARDEN, data: { ...WARDEN.data, followers: { classes: ['marsh-chaplain', 'fen-acolyte', 'bog-seer'] } } });
    const listOf = (classId: string) => ({ 'marsh-chaplain': 'chaplain-list', 'fen-acolyte': 'chaplain-list', 'bog-seer': 'seer-list' })[classId];
    expect(withSwaps(list, both, 'fen-acolyte', () => true, listOf).list.get(1)).toEqual(['ex-spell-guiding-glow', 'lantern-blessing']);
    expect(withSwaps(list, both, 'bog-seer', () => true, listOf).list).toEqual(list);
    expect(withSwaps(list, both, 'fen-acolyte', () => true).list).toEqual(list);
    expect(patronLines(both, 1, 'bog-seer', { spell: () => undefined }, listOf).some((l) => l.key === 'spells')).toBe(false);
    expect(patronLines(both, 1, 'fen-acolyte', { spell: () => undefined }, listOf).some((l) => l.key === 'spells')).toBe(true);
    expect(withSwaps(list, warden, 'reed-witch', () => true).list).toEqual(list);
    expect(withSwaps(list, null, 'marsh-chaplain', () => true).list).toEqual(list);
  });

  // Purpose: a caster who picks first spells is offered the swapped list (the patron's spell in, the replaced one out).
  it('the first-spells picks are offered from the swapped list', () => {
    const klass = { packEntryId: 'reed-witch', name: 'Reed Witch', data: { spellcasting: { listId: 'witch-list', type: 'book', fromLevel: 1, firstSpells: { choose: 1 } } } };
    const spells = ['glimmer', 'mire-grip', 'heron-hush'].map((id) => ({ packEntryId: id, name: id, data: {} }));
    const lists = [{ packEntryId: 'witch-list', name: 'Witch list', data: { levels: [{ level: 1, spells: ['glimmer', 'mire-grip'] }] } }];
    const patron = readPatron({ ...HERON, data: { ...HERON.data, spells: { extends: 'reed-witch', swap: [{ level: 1, replaces: 'mire-grip', with: 'heron-hush' }] } } });
    const setting = { spells, lists, tables: [], choices: {} };
    expect(firstSpellsPlan(klass, 1, setting)?.choose?.options.map((o) => o.id)).toEqual(['glimmer', 'mire-grip']);
    expect(firstSpellsPlan(klass, 1, setting, null, patron)?.choose?.options.map((o) => o.id)).toEqual(['glimmer', 'heron-hush']);
  });
});

describe('the entry and the sheet lines', () => {
  const warden = readPatron(WARDEN);
  const names = {
    spell: (id: string) => ({ 'ex-spell-mend-cup': 'Mend Cup', 'ex-spell-guiding-glow': 'Guiding Glow', 'ex-spell-road-home': 'Road Home', 'ex-spell-calm-beasts': 'Calm Beasts' })[id],
    klass: (id: string) => ({ 'marsh-chaplain': 'Marsh Chaplain' })[id],
  };

  // Purpose (Francis, 2026-11-12: the sheet shows the book's whole ladder): the sheet's Patron section lists every
  // tier of holy garb in order, every swapped spell and one mark per spell level, each told "reached" or "to come" in
  // words for this character; the symbol, prayer and strictures are the pack's words as they stand.
  it('the sheet ladder lists every tier of garb, spells and marks, each reached or to come', () => {
    const ladder = patronLadder(warden, 1, 'marsh-chaplain', names);
    expect(ladder.lines).toEqual([
      { key: 'symbol', label: 'Holy symbol', value: 'A lantern with an open shutter.' },
      { key: 'prayer', label: 'Prayer', value: 'Prays for spells only beside a lit flame.' },
      { key: 'strictures', label: 'Strictures', value: 'Must never leave a traveller lost on the road.' },
    ]);
    expect(ladder.garb).toEqual([
      { atSpellLevel: 0, words: 'At creation', text: 'A grey travelling cloak', reached: true },
      { atSpellLevel: 1, words: 'From level-1 spells', text: 'A brass hand-lantern', reached: true },
      { atSpellLevel: 3, words: 'From level-3 spells', text: 'A lamp-chain stole', reached: false },
    ]);
    expect(ladder.spells).toEqual([
      { level: 1, text: 'Level 1: Guiding Glow in place of Mend Cup', reached: true },
      { level: 3, text: 'Level 3: Road Home in place of Calm Beasts', reached: false },
    ]);
    expect(ladder.marks).toEqual([
      { atSpellLevel: 1, words: 'From level-1 spells', text: "Eyes catch the light like a cat's.", reached: true },
      { atSpellLevel: 3, words: 'From level-3 spells', text: 'Casts no shadow by lamplight.', reached: false },
    ]);
    // Before any spell is cast only the creation tier is reached; a class the swaps don't reach lists none.
    expect(patronLadder(warden, 0, 'marsh-chaplain', names).garb.map((t) => t.reached)).toEqual([true, false, false]);
    expect(patronLadder(warden, 1, 'reed-witch', names).spells).toEqual([]);
  });

  // Purpose: the entry shows the whole ladder (pt-4) and the GM's-approval note in the patron's description; the cult
  // shows only where the device has it.
  it('the entry carries the approval note, who follows, the whole ladder of garb and marks, and the swaps', () => {
    const entry = patronEntry(warden, names, 'Road pack');
    expect(entry.name).toBe('The Lantern Warden');
    expect(entry.meta).toBe('Keeper of the Last Light, Lantern, Road pack, homebrew');
    expect(entry.headings[0]).toEqual({ label: "Needs the GM's special approval", text: 'Ask your GM: the Warden takes few servants.', warn: true });
    const by = (label: string) => entry.headings.find((h) => h.label === label);
    expect(by('Who follows')?.text).toBe('Marsh Chaplain, Lantern or Reed in alignment');
    expect(by('Holy garb')?.bullets).toEqual([
      { name: 'At creation', effect: 'A grey travelling cloak (worth 5 gp, given free)' },
      { name: 'From level-1 spells', effect: 'A brass hand-lantern (worth 20 gp, given free)' },
      { name: 'From level-3 spells', effect: 'A lamp-chain stole (worth 90 gp, given free)' },
    ]);
    expect(by('Spells')?.bullets).toEqual([{ name: 'Level 1', effect: 'Guiding Glow in place of Mend Cup' }, { name: 'Level 3', effect: 'Road Home in place of Calm Beasts' }]);
    expect(by('Marks')?.bullets).toHaveLength(2);
    expect(by('Cult')).toBeUndefined();
    expect(patronEntry(readPatron({ ...WARDEN, data: { ...WARDEN.data, cult: 'Wayside shrines.' } }), names).headings.at(-1)).toEqual({ label: 'Cult', text: 'Wayside shrines.' });
  });

  // Purpose (dec-10 S3, C3): in the book format the patron's title is its small-capitals line, the book its last line,
  // and its garb, spells and marks are ladders of labelled lines, a tier a line.
  it('gives the book format its title line, its source, and its ladders as lines', () => {
    const entry = patronEntry(warden, names, 'Road pack');
    expect(entry.tagline).toBe('Keeper of the Last Light');
    expect(entry.source).toBe('Road pack, homebrew');
    for (const label of ['Holy garb', 'Spells', 'Marks']) expect(entry.headings.find((h) => h.label === label)?.lines, label).toBe(true);
  });

  // Purpose (the lead's ruling): a follower class no attached pack has is shown as text, "pack not attached".
  it('names a follower class no attached pack has by its id, "pack not attached"', () => {
    const entry = patronEntry(readPatron(HERON), names);
    expect(entry.headings.find((h) => h.label === 'Who follows')?.text).toBe(`Marsh Chaplain and reed-witch (${NOT_ATTACHED}), Mire in alignment`);
  });

  // Purpose ("done properly"): the sheet shows what the patron gives this character now: symbol, garb of the tiers
  // reached, prayer, strictures, the swaps cast so far and a line per mark reached; nothing of a tier still to come.
  it('the sheet lines at a level-2 cleric’s spell level show tiers 0 and 1 only', () => {
    const lines = patronLines(warden, 1, 'marsh-chaplain', names);
    expect(lines).toEqual([
      { key: 'symbol', label: 'Holy symbol', value: 'A lantern with an open shutter.' },
      { key: 'garb', label: 'Holy garb', value: 'A grey travelling cloak; A brass hand-lantern' },
      { key: 'prayer', label: 'Prayer', value: 'Prays for spells only beside a lit flame.' },
      { key: 'strictures', label: 'Strictures', value: 'Must never leave a traveller lost on the road.' },
      { key: 'spells', label: 'Spells', value: 'Level 1: Guiding Glow in place of Mend Cup' },
      { key: 'mark:0', label: 'Mark', value: "Eyes catch the light like a cat's." },
    ]);
    // Before any spell is cast: no mark, tier-0 garb only.
    const early = patronLines(warden, 0, 'marsh-chaplain', names);
    expect(early.find((l) => l.key === 'garb')?.value).toBe('A grey travelling cloak');
    expect(early.some((l) => l.label === 'Mark')).toBe(false);
    // The swaps aren't a line for a class they don't extend.
    expect(patronLines(warden, 1, 'reed-witch', names).some((l) => l.key === 'spells')).toBe(false);
  });
});
