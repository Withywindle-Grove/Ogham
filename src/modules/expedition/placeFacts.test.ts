// What the place panel and the town page read from a pack's location (December piece 2c; pf-3 … pf-5). Invented
// places only.
import { describe, expect, it } from 'vitest';
import { hasPlaceFacts, leadWords, noteLines, readPlaceFacts } from './placeFacts.ts';

/** An invented river town written the way pf-5 says. */
const town = {
  identity: 'A river town of reed-cutters, held by the [[npc:wardens|Heron Wardens]].',
  facts: [
    { lead: 'Inhabitants', text: '1,100 (a small town).' },
    { lead: 'Rumours', text: '[[table:reed-rumours|Reedmere rumours]], d20.' },
  ],
  tableIds: ['town-day', 'reed-rumours'],
  gm: {
    notes: 'Older notes.',
    sections: [
      { heading: 'The town', text: 'A hundred tarred roofs on stilts.' },
      { heading: "The Wardens' grip", text: 'They take a toll at the quay.\nAnd at the [[table:quay-tolls|tolls]].' },
    ],
  },
  settlement: { size: 'town', watch: { text: 'Six Wardens with poles and nets.', leads: [{ lead: 'Arrival on the scene', text: '2d6 rounds after a cry.' }], statBlockId: 'heron-warden' } },
};

describe("a location's facts (readPlaceFacts)", () => {
  // Purpose: identity, facts in the pack's order, headed prose, tables and the watch are read, marks as labels.
  it('reads every part, links as their labels', () => {
    const facts = readPlaceFacts(town);
    expect(facts.identity).toBe('A river town of reed-cutters, held by the Heron Wardens.');
    expect(facts.facts).toEqual([
      { lead: 'Inhabitants', text: '1,100 (a small town).' },
      { lead: 'Rumours', text: 'Reedmere rumours, d20.' },
    ]);
    expect(facts.sections.map((s) => s.heading)).toEqual(['The town', "The Wardens' grip"]);
    expect(facts.sections[1]!.text).toBe('They take a toll at the quay.\nAnd at the tolls.');
    expect(facts.sections[1]!.blocks).toBeNull();
    expect(facts.watch).toEqual({ text: 'Six Wardens with poles and nets.', leads: [{ lead: 'Arrival on the scene', text: '2d6 rounds after a cry.' }], statBlockId: 'heron-warden' });
  });

  // Purpose: the place's own tables come first in page order, then a table its GM text links to, each once.
  it('lists its tables, then the tables its text links to, each once', () => {
    expect(readPlaceFacts(town).tableIds).toEqual(['town-day', 'reed-rumours', 'quay-tolls']);
  });

  // Purpose (frame 13): a hamlet with two facts has nothing else; a place with no facts has nothing to draw.
  it('reads a hamlet with two facts, and a flat place as empty', () => {
    const hamlet = readPlaceFacts({ facts: [{ lead: 'Inhabitants', text: '30 (a hamlet).' }, { lead: 'Rumours', text: 'd20.' }] });
    expect(hamlet.facts).toHaveLength(2);
    expect(hamlet.sections).toEqual([]);
    expect(hamlet.watch).toBeNull();
    expect(hasPlaceFacts(hamlet)).toBe(true);
    expect(hasPlaceFacts(readPlaceFacts({ gm: { notes: 'Only notes.' }, playerView: { text: 'A hut.' } }))).toBe(false);
  });
});

describe('notes read with their lead-ins (frame 10)', () => {
  // Purpose: a line that starts with a short label and a colon gets a bold lead-in; other lines stay plain; a colon
  // later in a sentence isn't a label; marks show as labels; blank lines go.
  it('sets a label-and-colon line as a lead-in', () => {
    expect(noteLines('Ruler: Warden Halewyn (p. 64).\n\nThe quay floods each spring. Then: mud.\nSecret: [[place:upper-room|the upper room]] is kept locked.')).toEqual([
      { lead: 'Ruler', text: 'Warden Halewyn (p. 64).' },
      { lead: '', text: 'The quay floods each spring. Then: mud.' },
      { lead: 'Secret', text: 'the upper room is kept locked.' },
    ]);
  });

  // Purpose: a lead-in ends with a full stop unless it has its own punctuation.
  it('ends a lead-in with a full stop', () => {
    expect(leadWords('Sign')).toBe('Sign.');
    expect(leadWords('Who goes there?')).toBe('Who goes there?');
  });
});

describe("a town's GM sections in blocks (pf-18b)", () => {
  /** A town whose GM sections are written four ways: in blocks, as a plain string, unreadable, and blocks with only a table by id. */
  const reedmouth = {
    tableIds: ['town-day'],
    gm: {
      sections: [
        {
          heading: 'The Eel and Lantern',
          text: {
            blocks: [
              { h: 'What the house offers' },
              { list: ['Hot eel stew all day.', 'A dry loft over the stables.'] },
              { lead: 'The keeper', text: 'Old Marrow, who keeps the [[table:keeper-moods|moods]].' },
              { box: [{ p: 'Anyone asking after the Wardens is pointed to the quay.' }, { tableRef: 'quay-tolls' }] },
            ],
          },
        },
        { heading: 'A brewing trouble', text: 'Halewyn owes the ferrymen.\nSee the [[npc:halewyn|Warden]].' },
        { heading: 'Older notes', text: { blocks: [{ words: 'not a block' }] } },
        { heading: 'The rolls', text: { blocks: [{ tableRef: 'reed-rumours' }] } },
      ],
    },
  };

  // Purpose: a section in blocks is read with the shared reader and drawn as RuleText's blocks, its links as their
  // labels; its `text` is its plain words (pf-18a), for the folded first line.
  it('reads a section in blocks as the blocks to draw', () => {
    const [eel] = readPlaceFacts(reedmouth).sections;
    expect(eel).toEqual({
      heading: 'The Eel and Lantern',
      text: 'What the house offers\nHot eel stew all day.\nA dry loft over the stables.\nThe keeper. Old Marrow, who keeps the moods.\nAnyone asking after the Wardens is pointed to the quay.',
      blocks: [
        { kind: 'h', text: 'What the house offers' },
        { kind: 'list', items: ['Hot eel stew all day.', 'A dry loft over the stables.'] },
        { kind: 'p', lead: 'The keeper', text: 'Old Marrow, who keeps the moods.' },
        { kind: 'box', title: '', blocks: [{ kind: 'p', lead: '', text: 'Anyone asking after the Wardens is pointed to the quay.' }] },
      ],
    });
  });

  // Purpose: a plain-string section reads as it does today: its words with link marks as labels, and no blocks.
  it('keeps a plain-string section as it is today', () => {
    expect(readPlaceFacts(reedmouth).sections[1]).toEqual({ heading: 'A brewing trouble', text: 'Halewyn owes the ferrymen.\nSee the Warden.', blocks: null });
  });

  // Purpose: a section with nothing to draw keeps its heading; only one the app can't read is marked so (blocks []),
  // for the muted line, while an empty one (only a table by id, no blocks, no words, no text) reads as empty (blocks
  // null, no words), Francis's ruling of 2026-11-18.
  it('keeps the heading of a section with nothing to draw, unreadable apart from empty', () => {
    const [, , older, rolls] = readPlaceFacts(reedmouth).sections;
    expect(older).toEqual({ heading: 'Older notes', text: '', blocks: [] });
    expect(rolls).toEqual({ heading: 'The rolls', text: '', blocks: null });
    const empty = readPlaceFacts({ gm: { sections: [{ heading: 'No blocks', text: { blocks: [] } }, { heading: 'No words', text: '' }, { heading: 'No text' }, { heading: 'A number', text: 7 }] } });
    expect(empty.sections).toEqual([
      { heading: 'No blocks', text: '', blocks: null },
      { heading: 'No words', text: '', blocks: null },
      { heading: 'No text', text: '', blocks: null },
      { heading: 'A number', text: '', blocks: [] },
    ]);
  });

  // Purpose (the review's nit 1, #978): a box with no title whose blocks draw nothing (only a table by id) is not drawn
  // as an empty bordered box: a section holding only such a box is an empty section, its table still joins the place's
  // tables, and a box with a title is kept.
  it('drops a box that would open empty', () => {
    const facts = readPlaceFacts({
      gm: {
        sections: [
          { heading: 'A box of rolls', text: { blocks: [{ box: [{ tableRef: 'eel-rolls' }] }] } },
          { heading: 'A titled box', text: { blocks: [{ box: [{ tableRef: 'quay-rolls' }], title: 'On the quay' }] } },
        ],
      },
    });
    expect(facts.sections).toEqual([
      { heading: 'A box of rolls', text: '', blocks: null },
      { heading: 'A titled box', text: 'On the quay', blocks: [{ kind: 'box', title: 'On the quay', blocks: [] }] },
    ]);
    expect(facts.tableIds).toEqual(['eel-rolls', 'quay-rolls']);
  });

  // Purpose: a table a section in blocks links to, or names by id (a tableRef, in a box too), joins the place's tables after its own, each once.
  it('adds the tables a section in blocks links to or names by id', () => {
    expect(readPlaceFacts(reedmouth).tableIds).toEqual(['town-day', 'keeper-moods', 'quay-tolls', 'reed-rumours']);
  });

  // Purpose: a section with neither a heading nor anything to draw is left out, in blocks as in plain words.
  it('leaves out a section with no heading and nothing to draw', () => {
    const facts = readPlaceFacts({ gm: { sections: [{ text: { blocks: [] } }, { text: '' }, { text: { blocks: [{ p: 'Reeds.' }] } }] } });
    expect(facts.sections).toEqual([{ heading: '', text: 'Reeds.', blocks: [{ kind: 'p', lead: '', text: 'Reeds.' }] }]);
  });
});

describe("a place's own book text for the GM (gt-1, gm.text)", () => {
  // Purpose: the book's text for the GM is read as its blocks (lists and boxed asides kept), its first line the book's
  // own first words; a place without it has none, and an empty one counts as none.
  it('reads the blocks and the first line; none when absent or empty', () => {
    const jetty = {
      gm: {
        text: {
          blocks: [
            { p: 'The ferrymen moor here and nowhere else, and they notice who does not.' },
            { list: ['The fourth mooring ring is new iron.', 'The planks are nailed, not pegged.'] },
            { box: [{ p: 'They say the old ring went into the water with a boat on it.' }], title: 'If the party asks about the ring' },
            { source: 'p. 39' },
          ],
        },
      },
    };
    const text = readPlaceFacts(jetty).text!;
    expect(text.blocks.map((b) => b.kind)).toEqual(['p', 'list', 'box', 'source']);
    // More follows, so it ends "…" as a folded section's first line does (mc-40).
    expect(text.firstLine).toBe('The ferrymen moor here and nowhere else, and they notice who does not…');
    expect(readPlaceFacts({ gm: { text: 'A [[npc:ferry|ferryman]] waits.\n\nHe charges double.' } }).text?.firstLine).toBe('A ferryman waits…');
    expect(readPlaceFacts({ gm: { notes: 'Only notes.' } }).text).toBeNull();
    expect(readPlaceFacts({ gm: { text: { blocks: [] } } }).text).toBeNull();
    expect(readPlaceFacts({ gm: { text: '   ' } }).text).toBeNull();
  });

  // Purpose (the lead, S14): a text that opens with a list or a box folds to that block's first words, cut the same
  // way, so the row is never a bare heading.
  it('a text opening with a list or a box folds to its first words', () => {
    const list = readPlaceFacts({ gm: { text: { blocks: [{ list: ['A ring of new iron.', 'Nailed planks.'] }, { p: 'More.' }] } } }).text!;
    expect(list.firstLine).toBe('A ring of new iron…');
    const box = readPlaceFacts({ gm: { text: { blocks: [{ box: [{ p: 'They say the old ring sank with a boat.' }], title: 'If asked' }, { p: 'More.' }] } } }).text!;
    expect(box.firstLine).not.toBe('');
    expect(box.firstLine.endsWith('…')).toBe(true);
    expect(box.firstLine.startsWith('If asked')).toBe(true);
  });

  // Purpose (the lead, S14; one rule for a place's text wherever it sits): the tables the book's text names, by a link or
  // by id, join the place's tables after its own, each once, as the headed sections' links do; a section set out in
  // blocks counts too.
  it("tables the book's text and block sections name join the place's tables, each once", () => {
    const facts = readPlaceFacts({
      tableIds: ['own'],
      gm: {
        text: { blocks: [{ p: 'Roll on [[table:mud-finds|What the mud gives]].' }, { tableRef: 'tide-left' }, { list: ['Or [[table:own|the own table]].'] }] },
        sections: [{ heading: 'The bar', text: { blocks: [{ lead: 'Wading', text: 'See [[table:bar-wading|Wading the bar]].' }] } }],
      },
    });
    expect(facts.tableIds).toEqual(['own', 'bar-wading', 'mud-finds', 'tide-left']);
  });
});
