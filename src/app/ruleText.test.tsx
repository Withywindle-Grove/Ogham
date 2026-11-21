// @vitest-environment jsdom
// The shared rule-text part (RuleText over ruleBlocks) never drops a block's words (fix-rule-text-box; the lead's
// ruling of 2026-11-14 under mc-34: a place's knowledge and rules carry the book's full text, nothing trimmed or
// hidden). Invented words only. What it checks, in plain words:
//   * a section set out in blocks with a paragraph, a list and a boxed aside shows every block's words, in order;
//   * a block kind the part doesn't know shows its words as paragraphs;
//   * a numbered list keeps its numbers, and a table named by id shows no raw id.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ruleBlocks } from '../modules/expedition/placeRules.ts';
import { RuleText } from '../ui/RuleText.tsx';

describe('the shared rule-text part keeps every block (mc-34)', () => {
  // Purpose: a section with a paragraph, a list and a boxed aside shows the paragraph, the list's items, the box's
  // title and every word inside the box, in the book's order.
  it('draws a paragraph, a list and a boxed aside, every word in order', () => {
    const { container } = render(
      <RuleText
        blocks={ruleBlocks({
          blocks: [
            { p: 'The manifest lists her cargo plainly.' },
            { list: ['Forty tuns of marsh salt', 'One sealed chest'] },
            { box: [{ p: 'The chest is bound in green copper.' }, { list: ['No lock a key would fit'] }], title: 'The sealed chest' },
            { p: 'The ferrymen took the rest.' },
          ],
        })}
      />,
    );
    const all = container.textContent ?? '';
    const phrases = [
      'The manifest lists her cargo plainly.',
      'Forty tuns of marsh salt',
      'One sealed chest',
      'The sealed chest',
      'The chest is bound in green copper.',
      'No lock a key would fit',
      'The ferrymen took the rest.',
    ];
    let from = 0;
    for (const phrase of phrases) {
      const at = all.indexOf(phrase, from);
      expect(at, phrase).toBeGreaterThanOrEqual(0);
      from = at + phrase.length;
    }
    expect(container.querySelector('.rule-text__box')?.textContent).toContain('The chest is bound in green copper.');
  });

  // Purpose: a block in a shape the part has no name for still shows all of its words, nested ones included, as
  // paragraphs.
  it("draws a block kind it doesn't know as paragraphs with its words", () => {
    const { container } = render(<RuleText blocks={ruleBlocks({ blocks: [{ callout: { note: 'Mind the bar at low water.', more: ['The tide turns twice a day.'] } }] })} />);
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Mind the bar at low water.', 'The tide turns twice a day.']);
  });

  // Purpose: a numbered list is drawn as a numbered list, and a table named only by its id never shows that id.
  it('keeps a numbered list numbered and shows no raw table id', () => {
    const { container } = render(<RuleText blocks={ruleBlocks({ blocks: [{ list: ['Bail', 'Row'], numbered: true }, { tableRef: 'tide-table' }] })} />);
    expect([...container.querySelectorAll('ol > li')].map((li) => li.textContent)).toEqual(['Bail', 'Row']);
    expect(container.textContent).not.toContain('tide-table');
  });
});
