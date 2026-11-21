// A place's Knowledge, its words (dec-7 piece 6a; mc-40; mockup december/01 frames 7 and 7b; the lead's rulings of
// 2026-11-14): a folded section's first line, the source line, and a section the pack sets out in blocks (pf-18).
// Invented places and words only.
import { describe, expect, it } from 'vitest';
import { knowledgeSourceLine, readPlaceFacts, sectionFirstLine } from './placeFacts.ts';

describe("a folded section's first line (sectionFirstLine)", () => {
  // Purpose: a long first paragraph is cut at the last sentence or clause break within about two lines, and ends "…".
  it('cuts a long first paragraph at a break and ends it "…"', () => {
    const text =
      'The harbour silted in a single winter. The old men say the river changed its mind; the harbourmaster’s ledger says only that the dredger was sold.';
    expect(sectionFirstLine(text)).toBe('The harbour silted in a single winter. The old men say the river changed its mind…');
  });

  // Purpose: a short first paragraph with more after it shows whole, its last stop or colon traded for "…".
  it('ends a short first paragraph "…" when more follows', () => {
    expect(sectionFirstLine('The manifest lists her cargo plainly, as far as it goes:\nForty tuns of marsh salt.')).toBe('The manifest lists her cargo plainly, as far as it goes…');
  });

  // Purpose: a section that is one short line shows whole, with nothing added.
  it('shows a one-line section whole', () => {
    expect(sectionFirstLine('Nothing.')).toBe('Nothing.');
    expect(sectionFirstLine('')).toBe('');
  });

  // Purpose: a long first paragraph with no break in reach is cut at a space, never mid-word.
  it('cuts at a space when no break is in reach', () => {
    const line = sectionFirstLine(`${'reed '.repeat(40)}end.`);
    expect(line.endsWith('reed…')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(102);
  });
});

describe("Knowledge's source line (knowledgeSourceLine)", () => {
  // Purpose: the line names the pack and gives the page only where the entry carries one (ruling 3).
  it('names the pack, with the page only where the entry has one', () => {
    expect(knowledgeSourceLine('adventure', 'The Reed Marches', 'p. 38')).toBe('From your adventure: The Reed Marches, p. 38.');
    expect(knowledgeSourceLine('adventure', 'The Reed Marches', 'p38')).toBe('From your adventure: The Reed Marches, p. 38.');
    expect(knowledgeSourceLine('adventure', 'The Reed Marches', undefined)).toBe('From your adventure: The Reed Marches.');
    expect(knowledgeSourceLine('setting', 'Fen Lore', '  ')).toBe('From your setting: Fen Lore.');
  });

  // Purpose: with no pack name there is no source line at all, rather than a line naming nothing.
  it('gives no line without a pack name', () => {
    expect(knowledgeSourceLine('adventure', '', 'p. 38')).toBeNull();
  });
});

describe('a section set out in blocks (pf-18)', () => {
  // Purpose: a section whose text is in the rule-text block shape keeps its blocks for the shared part, and its plain
  // words for the first line; a plain section has no blocks (ruling 4: nothing invented for unmarked text).
  it('keeps the blocks of a section in the block shape, and none for plain text', () => {
    const facts = readPlaceFacts({
      gm: {
        sections: [
          { heading: 'The wreck’s cargo', text: { blocks: [{ p: 'Her cargo, as far as it goes:' }, { list: ['Marsh salt', 'Reed-cloth'] }] } },
          { heading: 'Plain', text: '- not a list\n- just lines' },
        ],
      },
    });
    const [cargo, plain] = facts.sections;
    expect(cargo!.blocks).toEqual([
      { kind: 'p', lead: '', text: 'Her cargo, as far as it goes:' },
      { kind: 'list', items: ['Marsh salt', 'Reed-cloth'] },
    ]);
    expect(cargo!.text).toBe('Her cargo, as far as it goes:\nMarsh salt\nReed-cloth');
    expect(sectionFirstLine(cargo!.text)).toBe('Her cargo, as far as it goes…');
    expect(plain!.blocks).toBeNull();
    expect(plain!.text).toBe('- not a list\n- just lines');
  });
});
