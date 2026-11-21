// @vitest-environment jsdom
// A place's Knowledge sheet (dec-7 piece 6a; mc-33, mc-34, mc-40; mockup december/01 frames 7 and 7b), drawn and
// tapped. Read-only and the GM's alone; wired to no screen until 5b. Invented words only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { knowledgeSourceLine, readPlaceFacts } from '../modules/expedition/placeFacts.ts';
import { KnowledgeSheet } from './KnowledgeSheet.tsx';

afterEach(cleanup);

const harbour = readPlaceFacts({
  facts: [
    { lead: 'Tides', text: 'Two a day.' },
    { lead: 'Owed to', text: '[[npc:heron-wardens|The Heron Wardens]], in name.' },
  ],
  tableIds: ['harbour-days'],
  settlement: { watch: { text: 'Six Wardens with poles.' } },
  gm: {
    sections: [
      { heading: 'What everyone knows', text: 'The harbour silted in a single winter. The old men say the river changed its mind; the ledger says the dredger was sold.\nNobody crosses at slack water.' },
      { heading: 'The wreck’s cargo', text: { blocks: [{ p: 'The manifest lists her cargo:' }, { list: ['Marsh salt', 'One sealed chest'] }] } },
    ],
  },
});
const source = knowledgeSourceLine('adventure', 'The Reed Marches', 'p. 38');

function open(facts = harbour) {
  render(<KnowledgeSheet placeName="The Drowned Harbour" facts={facts} source={source} onClose={() => undefined} />);
  return screen.getByRole('dialog', { name: 'The Drowned Harbour: Knowledge' });
}

describe('the Knowledge sheet', () => {
  // Purpose: the sheet opens with the place's facts showing, each section folded with its first line, and the source
  // line last; links read as their labels.
  it('opens with the facts showing and the sections folded with their first lines', () => {
    const sheet = open();
    expect(within(sheet).getByRole('group', { name: 'Facts' }).textContent).toContain('Owed to. The Heron Wardens, in name.');
    const folds = sheet.querySelectorAll('details');
    expect(folds).toHaveLength(2);
    expect([...folds].every((d) => !d.open)).toBe(true);
    expect(within(sheet).getByText('The harbour silted in a single winter. The old men say the river changed its mind…')).toBeTruthy();
    expect(within(sheet).getByText('The manifest lists her cargo…')).toBeTruthy();
    expect(sheet.textContent).toContain('From your adventure: The Reed Marches, p. 38.');
  });

  // Purpose: a tap on a heading opens that section in place at full length, and opening a second leaves the first
  // open (several may be open at once).
  it('opens a section in place, and two may be open at once', async () => {
    const user = userEvent.setup();
    const sheet = open();
    await user.click(within(sheet).getByText('What everyone knows'));
    await user.click(within(sheet).getByText('The wreck’s cargo'));
    const folds = [...sheet.querySelectorAll('details')];
    expect(folds.map((d) => d.open)).toEqual([true, true]);
    expect(within(sheet).getByText('Nobody crosses at slack water.')).toBeTruthy();
    // A section in blocks keeps its list, drawn by the shared rule-text part.
    const list = within(sheet).getByRole('list');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Marsh salt', 'One sealed chest']);
  });

  // Purpose: a place with a lone section shows it open from the start.
  it('opens a lone section from the start', () => {
    const sheet = open(readPlaceFacts({ gm: { sections: [{ heading: 'Alone', text: 'Only this.' }] } }));
    expect(sheet.querySelector('details')!.open).toBe(true);
  });

  // Purpose: Knowledge carries no tables, no town watch and no eye or sharing line (the lead's rulings); it is read-only.
  it('shows no tables, no watch, and nothing to share', () => {
    const sheet = open();
    expect(sheet.textContent).not.toContain('Tables');
    expect(sheet.textContent).not.toContain('Six Wardens');
    expect(sheet.textContent).not.toMatch(/shared/i);
    // The only button is the ✕.
    expect(within(sheet).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
  });

  // Purpose: a place with nothing written says so in one line, rather than an empty sheet.
  it('says so when the place has no knowledge', () => {
    const sheet = open(readPlaceFacts({}));
    expect(sheet.textContent).toContain('The pack gives no knowledge for this place.');
  });
});
