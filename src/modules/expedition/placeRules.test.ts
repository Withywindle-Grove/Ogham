// A place's own check and its rules (December dec-7 piece 3; rg-4, rg-5, pf-12b, mc-39b, mc-51, pf-12d). Invented
// places and words only. What it checks, in plain words:
//   * a rule's text in the pack's block shape reads as the book sets it out: paragraphs with lead-ins, a sub-heading, a
//     list, a titled table, the source; a link mark shows its label; words the app doesn't know still show;
//   * a place's rules come in the pack's order; one with no id or no name is left out; `gmOnly` is kept;
//   * a rule's button is words or { icon, words } (pf-12e), read from the pack and from the players' read;
//   * the chain runs from the spot up through the places it sits in, and a loop in a pack ends;
//   * the nearest place with an encounter check decides; one that says `replacesScheduled` stands in until the GM
//     switches it off; one that says nothing doesn't stand in;
//   * a rule is open to players unless the pack marks it the GM's; the GM's eye wins either way;
//   * the words: "On every move", "Every turn", "Every 2 turns"; "1 in 6"; none with no chance;
//   * the "no camp here" mark (B18): read on the Location the party is at, only when it is plainly `true`, never from
//     the Area above, and never where no pack's place is.
// The procedure's side (a check rolled on each move) is in procedure.test.ts.
import { describe, expect, it } from 'vitest';
import { readRuleText } from '../library/ruleText.ts';
import {
  blocksOfRead,
  chainOf,
  checkChanceWords,
  checkSentenceOf,
  checkWhenWords,
  checkNameOf,
  noCampHere,
  placeCheckOf,
  placeRulesOf,
  readPlaceRules,
  rollsItsTable,
  ruleButtonFromRead,
  ruleButtonOf,
  ruleBlocks,
  wayOutHere,
  type ChainEntry,
  type RuleSwitch,
} from './placeRules.ts';

const harbourCheck = { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-encounters' };
const entry = (entryId: string, name: string, data: Record<string, unknown>): ChainEntry => ({ packId: 'pack-reed', entryId, name, data });
const island = entry('saltwick-island', 'Saltwick Island', { encounterCheck: { every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } } });
const harbour = entry('drowned-harbour', 'The Drowned Harbour', {
  parentId: 'saltwick-island',
  encounterCheck: harbourCheck,
  rules: [
    { id: 'falling-in', name: 'Falling into the harbour', button: 'Someone fell in', text: { blocks: [{ p: 'A character in the water is cold at once.' }] } },
    { id: 'tidewife-bargain', name: 'What the Tidewife’s bargain costs', gmOnly: true, text: 'A name, given freely.' },
    { name: 'No id here' },
    { id: 'no-name' },
  ],
});
const jetty = entry('the-jetty', '1 The jetty', { parentId: 'drowned-harbour', rules: [{ id: 'slick-piles', name: 'Slick piles', text: 'Footing is poor.' }] });
const ALL = [island, harbour, jetty];
const sw = (entryId: string, ruleId: string, which: RuleSwitch['which'], value: boolean): RuleSwitch => ({ packId: 'pack-reed', entryId, ruleId, which, value });

describe("a rule's text (rt-1)", () => {
  it('reads the block shape as the book sets it out, with link marks as their labels', () => {
    expect(
      ruleBlocks({
        blocks: [
          { p: 'A character in the water is cold at once.' },
          { h: 'Each turn in the water' },
          { lead: 'Swimming', p: 'A save, or the character tires. See [[rule:rowing|Rowing and swimming]].' },
          { list: ['A rope', 'A boat'] },
          { table: { title: 'Hauled out', columns: ['By', 'Takes'], rows: [['A rope from the jetty', '1 turn']] } },
          { source: 'p. 40' },
          { odd: 'Words the app has no shape for.' },
        ],
      }),
    ).toEqual([
      { kind: 'p', lead: '', text: 'A character in the water is cold at once.' },
      { kind: 'h', text: 'Each turn in the water' },
      { kind: 'p', lead: 'Swimming', text: 'A save, or the character tires. See Rowing and swimming.' },
      { kind: 'list', items: ['A rope', 'A boat'] },
      { kind: 'table', title: 'Hauled out', columns: ['By', 'Takes'], rows: [['A rope from the jetty', '1 turn']] },
      { kind: 'source', text: 'p. 40' },
      { kind: 'p', lead: '', text: 'Words the app has no shape for.' },
    ]);
  });

  it('reads plain text as paragraphs, split at blank lines', () => {
    expect(ruleBlocks('One.\n\nTwo.')).toEqual([
      { kind: 'p', lead: '', text: 'One.' },
      { kind: 'p', lead: '', text: 'Two.' },
    ]);
  });
});

describe("a place's rules (pf-12, pf-12d)", () => {
  it("come in the pack's order, without a rule that has no id or no name, keeping gmOnly and the button", () => {
    const rules = readPlaceRules(harbour.data);
    expect(rules.map((r) => [r.id, r.gmOnly, r.button])).toEqual([
      ['falling-in', false, 'Someone fell in'],
      ['tidewife-bargain', true, null],
    ]);
  });

  it('run up the chain from the spot, nearest first, and a loop in a pack ends', () => {
    expect(chainOf(ALL, 'pack-reed', 'the-jetty').map((e) => e.entryId)).toEqual(['the-jetty', 'drowned-harbour', 'saltwick-island']);
    const loopA = entry('loop-a', 'A', { parentId: 'loop-b' });
    const loopB = entry('loop-b', 'B', { parentId: 'loop-a' });
    expect(chainOf([loopA, loopB], 'pack-reed', 'loop-a').map((e) => e.entryId)).toEqual(['loop-a', 'loop-b']);
  });

  it("are open to players unless the pack keeps them for the GM (never opened, rp-3); the GM's eye closes any other (mc-51)", () => {
    const chain = chainOf(ALL, 'pack-reed', 'the-jetty');
    const open = (switches: RuleSwitch[]) => placeRulesOf(chain, switches).map((r) => [r.rule.id, r.open]);
    expect(open([])).toEqual([
      ['slick-piles', true],
      ['falling-in', true],
      ['tidewife-bargain', false],
    ]);
    expect(open([sw('drowned-harbour', 'tidewife-bargain', 'eye', true), sw('the-jetty', 'slick-piles', 'eye', false)])).toEqual([
      ['slick-piles', false],
      ['falling-in', true],
      ['tidewife-bargain', false],
    ]);
  });
});

describe("a place's own check (rg-4, pf-12b, rg-5)", () => {
  it('is the nearest place with one; it stands in when it says replacesScheduled, until the GM switches it off', () => {
    const chain = chainOf(ALL, 'pack-reed', 'the-jetty');
    const found = placeCheckOf(chain, []);
    expect(found?.owner.entryId).toBe('drowned-harbour');
    expect([found?.eachMove, found?.replaces, found?.inForce, found?.name]).toEqual([true, true, true, 'Encounter check']);
    expect(found?.check.chance).toEqual({ die: 'd6', on: [1] });
    expect(placeCheckOf(chain, [sw('drowned-harbour', 'encounterCheck', 'inForce', false)])?.inForce).toBe(false);
    expect(placeCheckOf(chain, [sw('drowned-harbour', 'encounterCheck', 'inForce', true)])?.inForce).toBe(true);
  });

  // Purpose (review of #726): the nearest place's check decides, so a spot with its own plain check under a region
  // whose check stands in has no stand-in check (the place card's Rules button reads this).
  it("is decided by the nearest check: a spot's own plain check hides a region's stand-in", () => {
    const spot = entry('wreck', '2 The wreck', { parentId: 'drowned-harbour', encounterCheck: { chance: { die: 'd6', on: [1] } } });
    expect(placeCheckOf(chainOf([...ALL, spot], 'pack-reed', 'wreck'), [])?.replaces).toBe(false);
    expect(placeCheckOf(chainOf(ALL, 'pack-reed', 'the-jetty'), [])?.replaces).toBe(true);
  });

  // Purpose (p2p-14, plan scene-point-to-point B3): the check's card gives the pack's own sentence, its `note` word for
  // word (`notes` read as its alias, link marks as their labels), and none at all when the pack gives none: the app
  // writes no sentence of its own.
  it("carries the pack's own sentence, word for word, and none when the pack gives none", () => {
    const said = (check: Record<string, unknown>) => placeCheckOf([entry('jetty', '1 The jetty', { encounterCheck: check })], [])?.sentence;
    expect(said({ ...harbourCheck, note: 'Roll d20 for an encounter each time the party rows to a new [[location:spots|Location]].' })).toBe('Roll d20 for an encounter each time the party rows to a new Location.');
    expect(said({ ...harbourCheck, notes: 'Also roll when the party is noisy.' })).toBe('Also roll when the party is noisy.');
    expect(said(harbourCheck)).toBe('');
    expect(said({ ...harbourCheck, note: '   ' })).toBe('');
    expect(checkSentenceOf({ note: 42 })).toBe('42');
  });

  it("doesn't stand in when the pack doesn't say so (it sits beside the setting's)", () => {
    const found = placeCheckOf(chainOf(ALL, 'pack-reed', 'saltwick-island'), []);
    expect([found?.replaces, found?.inForce]).toEqual([false, false]);
    expect(placeCheckOf([entry('bare', 'Bare', {})], [])).toBeNull();
  });

  // Purpose (B9; p2p-18): a check never shows a machine name. Its own name first; else its table's name, where the
  // caller knows the setting's tables; else "Encounter check". The id ("the-anchorage-check") is never its name, on the
  // place's check or on the check the engine runs.
  it('is named by its own name, else its table’s, else "Encounter check"; never its id', () => {
    const at = (check: Record<string, unknown>, names?: (id: string) => string | null) => placeCheckOf([entry('the-anchorage', 'The Anchorage', { encounterCheck: check })], [], names);
    const names = (id: string) => (id === 'harbour-encounters' ? 'Encounters in the harbour' : null);
    const own = at({ name: 'Harbour watch', tableId: 'harbour-encounters' }, names)!;
    expect([own.name, own.check.name]).toEqual(['Harbour watch', 'Harbour watch']);
    const tabled = at({ tableId: 'harbour-encounters' }, names)!;
    expect([tabled.name, tabled.check.name, tabled.check.id]).toEqual(['Encounters in the harbour', 'Encounters in the harbour', 'the-anchorage-check']);
    expect(at({ tableId: 'harbour-encounters' })!.check.name).toBe('Encounter check');
    expect(at({ tableId: 'not-in-the-setting' }, names)!.check.name).toBe('Encounter check');
    expect(at({ name: '  ', chance: { die: 'd6', on: [1] } })!.check.name).toBe('Encounter check');
    expect([checkNameOf('', '  '), checkNameOf(' Gulls ', 'Encounters'), checkNameOf('', 'Encounters ')]).toEqual(['Encounter check', 'Gulls', 'Encounters']);
  });

  // Purpose (B9; p2p-19): a check with a table and no chance is a roll on the table; one with a chance, one with no
  // table, and one whose chance comes from the terrain are not.
  it('is a roll on its table when it names a table and has no chance', () => {
    const at = (check: Record<string, unknown>) => rollsItsTable(placeCheckOf([entry('x', 'X', { encounterCheck: check })], [])!.check);
    expect(at({ tableId: 'harbour-encounters' })).toBe(true);
    expect(at({ tableId: 'harbour-encounters', chance: { die: 'd6', on: [1] } })).toBe(false);
    expect(at({})).toBe(false);
    expect(at({ tableId: 'harbour-encounters', byTerrain: true })).toBe(false);
  });

  it('is said as when it is rolled and its chance (mc-39b)', () => {
    expect(checkWhenWords({ eachMove: true, every: null })).toBe('On every move');
    expect(checkWhenWords({ every: { value: 1, unit: 'turn' } })).toBe('Every turn');
    expect(checkWhenWords({ every: { value: 2, unit: 'turns' } })).toBe('Every 2 turns');
    expect(checkWhenWords({ every: null })).toBe('Every turn');
    expect(checkChanceWords({ die: 'd6', on: [1] })).toBe('1 in 6');
    expect(checkChanceWords({ die: 'd6', on: [1, 2] })).toBe('2 in 6');
    expect(checkChanceWords({ die: null, on: [1, 2] })).toBe('on 1–2');
    expect(checkChanceWords(null)).toBeNull();
  });
});

describe("a rule's button (pf-12e: words, or an icon with its words)", () => {
  // Purpose: words stay words, trimmed and with a link mark put into words; an empty string, a number or a list is no button.
  it('reads words, and nothing else as words', () => {
    expect(ruleButtonOf('  Someone fell in ')).toBe('Someone fell in');
    expect(ruleButtonOf('Ask [[npc:old-ferris|Old Ferris]]')).toBe('Ask Old Ferris');
    expect([ruleButtonOf(''), ruleButtonOf('   '), ruleButtonOf(null), ruleButtonOf(undefined), ruleButtonOf(['a'])]).toEqual([null, null, null, null, null]);
  });

  // Purpose: an object with an icon name keeps the icon and its words ('' when it gives none); without an icon it is no button.
  it('reads { icon, words }, and an object with no icon as no button', () => {
    expect(ruleButtonOf({ icon: ' water-splash ', words: 'Someone fell in' })).toEqual({ icon: 'water-splash', words: 'Someone fell in' });
    expect(ruleButtonOf({ icon: 'hourglass' })).toEqual({ icon: 'hourglass', words: '' });
    expect([ruleButtonOf({ words: 'Someone fell in' }), ruleButtonOf({ icon: '' }), ruleButtonOf({ icon: 7 })]).toEqual([null, null, null]);
  });

  // Purpose: the players' read sends an object button as its JSON text; it reads back as the object, and plain words stay words.
  it("reads the players' read: words, or an object's JSON text", () => {
    expect(ruleButtonFromRead('Someone fell in')).toBe('Someone fell in');
    expect(ruleButtonFromRead('{"icon": "water-splash", "words": "Someone fell in"}')).toEqual({ icon: 'water-splash', words: 'Someone fell in' });
    expect([ruleButtonFromRead(''), ruleButtonFromRead(null), ruleButtonFromRead(3)]).toEqual([null, null, null]);
  });

  // Purpose: object text starting {"icon" that the strip broke, or an object with no icon, gives no button, never raw JSON on screen.
  it('gives no button for broken or iconless object text', () => {
    expect(ruleButtonFromRead('{"icon": "water-splash", "words": "Ask "Old" Ferris"}')).toBeNull();
    expect(ruleButtonFromRead('{"words": "Someone fell in"}')).toBeNull();
    expect(ruleButtonFromRead('["water-splash"]')).toBe('["water-splash"]');
  });

  // Purpose: words that merely start with a brace ("{Tide} bell") aren't JSON and stay words; only text starting
  // {"icon" that fails to read back is a broken object and gives no button.
  it('keeps words that start with a brace as words', () => {
    expect(ruleButtonFromRead('{Tide} bell')).toBe('{Tide} bell');
    expect(ruleButtonFromRead('{"icon": "hourglass", "words": "Ring for ')).toBeNull();
  });
});

// The blocks to draw for a text the shared reader read (dec-8 B: a spell's whole description, mm-12). In plain words:
//   * a lead-in is a paragraph with its lead, a heading stays a heading, a numbered list keeps its numbers;
//   * a box keeps its title and its blocks; a table keeps its title, columns and rows; a table named only by id adds
//     nothing; the source stays the source;
//   * plain words are paragraphs, split at blank lines; a link mark shows its label; no text draws nothing.
describe('the blocks to draw for a read text', () => {
  it('every block the reader kept is drawn, in order', () => {
    const read = readRuleText({
      blocks: [
        { h: 'Snuffing it' },
        { lead: 'Water', text: 'puts the [[spell:glimmer|glimmer]] out.' },
        { list: ['Wet it', 'Wait'], numbered: true },
        { box: [{ p: 'It drifts with the caster.' }], title: 'Drift' },
        { table: { title: 'Glow', columns: ['Roll', 'Colour'], rows: [['1', 'green'], [2, 'gold']] } },
        { tableRef: 'glow-table' },
        { source: 'Fen rules p. 7' },
      ],
    }).value;
    expect(blocksOfRead(read)).toEqual([
      { kind: 'h', text: 'Snuffing it' },
      { kind: 'p', lead: 'Water', text: 'puts the glimmer out.' },
      { kind: 'list', items: ['Wet it', 'Wait'], numbered: true },
      { kind: 'box', title: 'Drift', blocks: [{ kind: 'p', lead: '', text: 'It drifts with the caster.' }] },
      { kind: 'table', title: 'Glow', columns: ['Roll', 'Colour'], rows: [['1', 'green'], ['2', 'gold']] },
      { kind: 'source', text: 'Fen rules p. 7' },
    ]);
  });

  it('plain words are paragraphs split at blank lines; a list not numbered says nothing of numbers; no text draws nothing', () => {
    expect(blocksOfRead('A green light.\n\nIt drifts.')).toEqual([
      { kind: 'p', lead: '', text: 'A green light.' },
      { kind: 'p', lead: '', text: 'It drifts.' },
    ]);
    expect(blocksOfRead({ blocks: [{ kind: 'list', items: ['Wet it'], numbered: false }] })).toEqual([{ kind: 'list', items: ['Wet it'] }]);
    expect(blocksOfRead(null)).toEqual([]);
  });
});

describe('the "no camp here" mark on a Location (B18; p2p-23, p2p-31)', () => {
  const wreck = entry('the-wreck', 'The Wreck', { parentId: 'drowned-harbour', noCamp: true });
  const places = [...ALL, wreck];

  // Purpose: a Location the pack marks `noCamp: true` is no place to camp, and the app can name it in its pop-up.
  it('reads the mark on the Location the party is at, with its name', () => {
    expect(noCampHere(chainOf(places, 'pack-reed', 'the-wreck'))).toEqual({ name: 'The Wreck' });
  });

  // Purpose: a Location with no mark is a place to camp, as every place was before the mark existed.
  it('a Location without the mark is a place to camp', () => {
    expect(noCampHere(chainOf(places, 'pack-reed', 'the-jetty'))).toBeNull();
  });

  // Purpose: only the pack's plain `true` is the mark: `false`, words or a number never stop a camp, so a pack written
  // loosely can't block the tent by accident.
  it('only true is the mark', () => {
    for (const value of [false, 'yes', 'true', 1, null, {}]) {
      expect(noCampHere([entry('odd', 'The Odd Stair', { noCamp: value })])).toBeNull();
    }
  });

  // Purpose: the mark is the Location's own. A mark on the Area it sits in does not reach it (the ruling names a
  // Location; nothing is ruled for a mark higher up), and the party's own place decides.
  it('a mark on the Area above does not reach the Location', () => {
    const noCampHarbour = entry('drowned-harbour', 'The Drowned Harbour', { parentId: 'saltwick-island', noCamp: true });
    expect(noCampHere(chainOf([island, noCampHarbour, jetty], 'pack-reed', 'the-jetty'))).toBeNull();
    expect(noCampHere(chainOf([island, noCampHarbour, jetty], 'pack-reed', 'drowned-harbour'))).toEqual({ name: 'The Drowned Harbour' });
  });

  // Purpose: with no place from a pack (a place made by hand, or none yet) there is no mark to read: camp as today.
  it('no place from a pack: nothing stops a camp', () => {
    expect(noCampHere([])).toBeNull();
  });
});

describe('the "way out" mark on a Location (B10; p2p-22, p2p-31)', () => {
  // Purpose: only a plain `true` on the Location the party is at marks it a way out; a mark on the Area above it, or
  // written as words, is not read there; a place made by hand has none.
  it('reads the Location’s own mark, a plain true only', () => {
    const anchorage = entry('the-anchorage', 'The Anchorage', { parentId: 'drowned-harbour', wayOut: true });
    expect(wayOutHere(chainOf([island, harbour, anchorage], 'pack-reed', 'the-anchorage'))).toBe(true);
    const markedHarbour = entry('drowned-harbour', 'The Drowned Harbour', { parentId: 'saltwick-island', wayOut: true });
    expect(wayOutHere(chainOf([island, markedHarbour, jetty], 'pack-reed', 'the-jetty'))).toBe(false);
    expect(wayOutHere([entry('odd', 'The Odd Stair', { wayOut: 'yes' })])).toBe(false);
    expect(wayOutHere([])).toBe(false);
  });
});
