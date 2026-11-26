// @vitest-environment jsdom
// The detail row and its one pop-up (sf-6a; page 44, EN1, EN3; 06 Components "Detail row"). Invented examples only.
//   The whole row is one button named "<name>: read it", with the name, its count and its stat line inside it.
//   The short row is the name and one quiet line, with no stat line.
//   A creature the packs don't have still says "Not in your packs: <name>", by name, and is no button.
//   The pop-up has no title line: the name is its head, with the X on that line.
//   A named character shows their own words, then the block they use under its name; with none in the packs, one line.
//   An item's row shows its rule's words; its pop-up how many and its rule.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { layOutStatBlock } from '../modules/library/statBlockLayout.ts';
import { BookDetailPopUp, BookDetailRow, NO_STAT_LINE, type BookDetail } from './BookDetail.tsx';
import { CreatureRows } from './EncounterWaiting.tsx';

afterEach(cleanup);

const LAYOUT = { descriptor: ['Kind'], groups: [[['Armour', 'Attacks']]], hide: [] };
const lurker: BookDetail = {
  name: 'Bog lurker',
  count: '2',
  shown: layOutStatBlock({ name: 'Bog lurker', description: 'A grey shape under the duckweed.', fields: { Armour: '7', Attacks: 'Bite (1d6)' } }, LAYOUT),
  source: 'From your setting: Fen Rules, p. 31',
};
const harl = (uses: BookDetail['uses']): BookDetail => ({
  name: 'Old Harl',
  kind: 'a ferryman',
  shown: layOutStatBlock({ name: 'Old Harl', description: 'Works the ferry at the jetty.', fields: { Kind: 'A ferryman, wary' } }, LAYOUT),
  source: 'From your adventure: Saltwick Island, p. 13',
  uses,
});

describe('the detail row (sf-6a)', () => {
  // Purpose: the whole row is one button named "<name>: read it"; the name with its count and the stat line are inside it.
  it('is one button named "<name>: read it", the name, count and stat line inside it', () => {
    render(<BookDetailRow detail={lurker} />);
    const row = screen.getByRole('button', { name: 'Bog lurker: read it' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(row.textContent).toBe('Bog lurker ×2Armour 7 Attacks Bite (1d6)');
    expect(row.querySelector('.stat-line')).not.toBeNull();
  });

  // Purpose: the short row is the name and one quiet line, with no stat line (finding 9).
  it('the short row has no stat line', () => {
    render(<BookDetailRow detail={harl({ name: 'Ferryman', shown: lurker.shown })} short="Same stat line as the Ferryman." />);
    const row = screen.getByRole('button', { name: 'Old Harl: read it' });
    expect(row.textContent).toBe('Old Harl, a ferrymanSame stat line as the Ferryman.');
    expect(row.querySelector('.stat-line')).toBeNull();
  });

  // Purpose: a creature the packs don't have still says "Not in your packs: <name>", by name, in its place, and is not a
  // row to tap.
  it('a creature the packs don’t have says so by name, and is no button', () => {
    render(<CreatureRows blocks={[{ ...lurker, description: null, count: '2' }, { missing: 'fen-rules:salt-hag', count: '1' }]} />);
    expect(screen.getByText('Not in your packs: Salt hag (fen-rules), 1')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Bog lurker: read it']);
  });

  // Purpose: an item's row shows its rule's words, not a stat line.
  it('an item’s row shows its rule', () => {
    render(<BookDetailRow detail={{ name: 'Lamp oil', count: '8', rule: 'One flask fills a lantern once.', shown: layOutStatBlock({ name: 'Lamp oil' }, null), source: null }} />);
    expect(screen.getByRole('button', { name: 'Lamp oil: read it' }).textContent).toBe('Lamp oil ×8One flask fills a lantern once.');
  });
});

describe('the detail pop-up (sf-6a)', () => {
  // Purpose (F5 c): the pop-up has no title line: the name is its one heading, and the X sits on that line.
  it('has no title line, its X on the name’s line', async () => {
    render(<BookDetailRow detail={lurker} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bog lurker: read it' }));
    const popUp = screen.getByRole('dialog', { name: 'Bog lurker' });
    const head = popUp.querySelector<HTMLElement>('.dialog__head')!;
    expect([...popUp.querySelectorAll('h1, h2, h3')].map((h) => h.textContent)).toEqual(['Bog lurker']);
    expect(within(head).getByRole('heading', { name: 'Bog lurker' })).toBeTruthy();
    expect(within(head).getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(within(popUp).getByText('How many: 2')).toBeTruthy();
  });

  // Purpose (finding 12): "p." never parts from its page, and a die keeps its average on its line ("2d8 (9)").
  it('keeps "p." with its page and a die with its average', () => {
    render(<BookDetailPopUp detail={{ ...lurker, shown: layOutStatBlock({ name: 'Bog lurker', hp: '2d8', hpAverage: 9 }, null) }} onClose={() => undefined} />);
    const popUp = screen.getByRole('dialog', { name: 'Bog lurker' });
    expect(popUp.querySelector('.source-line')!.textContent).toBe('From your setting: Fen Rules, p.\u00a031');
    expect(popUp.querySelector('.stat-block__die')!.textContent).toBe('2d8 (9)');
  });

  // Purpose (EN3 B): a named character shows their own words, then the block they use under its name.
  it('a named character shows their words, then the block they use under its name', () => {
    render(<BookDetailPopUp detail={harl({ name: 'Ferryman', shown: lurker.shown })} onClose={() => undefined} />);
    const popUp = screen.getByRole('dialog', { name: 'Old Harl' });
    expect(within(popUp).getByRole('heading', { name: 'Ferryman' })).toBeTruthy();
    const text = popUp.textContent!;
    expect(text.indexOf('A ferryman, wary')).toBeLessThan(text.indexOf('Works the ferry'));
    expect(text.indexOf('Works the ferry')).toBeLessThan(text.indexOf('Armour 7'));
    expect(within(popUp).getByText('From your adventure: Saltwick Island, p. 13')).toBeTruthy();
  });

  // Purpose (EN3 D): a character with no stat block in the packs shows its one line, in the row and in the pop-up.
  it('a character with no stat block shows its one line', () => {
    render(<BookDetailRow detail={harl(null)} />);
    expect(screen.getByRole('button', { name: 'Old Harl: read it' }).textContent).toBe(`Old Harl, a ferryman${NO_STAT_LINE}`);
    cleanup();
    render(<BookDetailPopUp detail={harl(null)} onClose={() => undefined} />);
    const popUp = screen.getByRole('dialog', { name: 'Old Harl' });
    expect(within(popUp).getByText(NO_STAT_LINE)).toBeTruthy();
    expect(popUp.querySelector('.stat-block__line')).toBeNull();
  });
});
