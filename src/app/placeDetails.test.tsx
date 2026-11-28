// @vitest-environment jsdom
// Spec scene-pack, piece B (#205; sf-6b, sf-24, l4-2, sb4-4; page 44, DT1, DT2, TR1, approved 2026-11-26 as redrawn;
// page 50, approved 2026-11-28): the place card's detail rows and the book's fold. Seam 2, the parts drawn in a test.
// Invented names only (the Ferryman, Old Harl, Lamp oil, Mother Sedge). In plain words:
//   1. A piece that carries a row says "Only you see these details." when shown and "Only you see this." when hidden;
//      its stat line or item no longer stands in the small line, a value does; a piece with no row is as before.
//   2. A tap on any row, full or short, opens its one pop-up.
//   3. A person's Carries line: under her name inside her row on a phone, after her row on a tablet.
//   4. The fold ends with the rows left for it, under "Stat line" (one) or "Stat lines" (two or more) and "Items", then
//      the quiet line where pieces carry lines; with nothing left, the quiet line alone. It keeps no eye.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { HandRow } from '../modules/expedition/pieceNames.ts';
import type { Piece } from '../modules/expedition/placePlay.ts';
import type { BookDetail } from './BookDetail.tsx';
import { PieceRow } from './PlaceCard.tsx';
import { BookTextFold } from './PlaceFacts.tsx';

afterEach(cleanup);

const block = (line: { label: string; value: string }[]) => ({ notes: [], descriptor: null, groups: [[line]], abilities: [], rest: [], line });
const ferryman: BookDetail = { name: 'Ferryman', shown: block([{ label: 'Level', value: '1' }, { label: 'Armour', value: '9' }]), source: null };
const harl: BookDetail = { name: 'Old Harl', kind: 'a ferryman', shown: block([]), source: null, uses: { name: 'Ferryman', shown: ferryman.shown } };
const oil: BookDetail = { name: 'Lamp oil', rule: 'One flask fills a lantern once.', shown: block([]), source: null };
const full = (detail: BookDetail, count: string | null = null): HandRow<BookDetail> => ({ form: 'full', kind: detail.uses !== undefined ? 'npc' : detail.rule ? 'item' : 'statBlock', name: detail.name, count, detail });
const piece = (kind: Piece['kind'], text: string, gm: Partial<Piece['gm']>, shown: boolean): Piece => ({ id: `p-${text}`, kind, text, shown, shownAt: null, gm: { value: '', trigger: '', statLine: '', ...gm }, version: 1 });
const sailcloth = (shown: boolean) => piece('person', 'Three men sleep under a sailcloth.', { statLine: 'reed-ferryman ×3' }, shown);
const draw = (p: Piece, details: HandRow<BookDetail>[] | null, extra: Partial<Parameters<typeof PieceRow>[0]> = {}) =>
  render(
    <ul>
      <PieceRow page piece={p} details={details} onToggle={() => {}} onEdit={() => {}} {...extra} />
    </ul>,
  );

describe('1. the label under a piece (l4-2)', () => {
  // Purpose: a shown piece that carries a row says "Only you see these details.": the players see its words, not the row.
  it('says "these details" under a shown piece', () => {
    draw(sailcloth(true), [full(ferryman, '3')]);
    expect(screen.getByText('Only you see these details.')).toBeTruthy();
    expect(screen.queryByText('Only you see this.')).toBeNull();
  });

  // Purpose: a hidden piece says "Only you see this.": none of it has reached the players.
  it('says "this" under a hidden piece', () => {
    draw(sailcloth(false), [full(ferryman, '3')]);
    expect(screen.getByText('Only you see this.')).toBeTruthy();
  });

  // Purpose: the stat line moves to its row, so the small line no longer repeats it; a treasure's value stays.
  it('drops the repeated stat line and keeps a value', () => {
    draw(sailcloth(false), [full(ferryman, '3')]);
    expect(screen.queryByText(/stat line never shows/)).toBeNull();
    cleanup();
    draw(piece('treasure', 'Eight flasks of lamp oil.', { value: '40 gp, Item: reed-lamp-oil' }, false), [full(oil)]);
    expect(screen.getByText('Value stays yours (40 gp).')).toBeTruthy();
  });

  // Purpose: a creature's note ("asleep") is kept: a piece whose stored line carries one keeps its small line, so the
  // note is never lost from the card.
  it("keeps the small line where it carries a creature's note", () => {
    draw(piece('person', 'Three men sleep under a sailcloth.', { statLine: 'reed-ferryman ×3 (asleep)' }, false), [full(ferryman, '3')]);
    expect(screen.getByText(/stat line never shows .*\(asleep\)/)).toBeTruthy();
  });

  // Purpose: a piece with no row is drawn as before: no label, its small line as it was.
  it('leaves a piece with no row as before', () => {
    draw(piece('hazard', 'A loose plank.', { trigger: 'Step on it' }, false), []);
    expect(screen.queryByText(/Only you see/)).toBeNull();
    expect(screen.getByText('Look only; trigger stays yours (Step on it).')).toBeTruthy();
  });
});

describe('2. a tap on a row', () => {
  // Purpose: a full row and a short row each open their one pop-up, named by the row's name.
  it('opens the pop-up from a full row and from a short row', async () => {
    const user = userEvent.setup();
    const short: HandRow<BookDetail> = { form: 'short', kind: 'npc', name: 'Old Harl', count: null, detail: harl, words: 'Same stat line as the Ferryman.' };
    draw(sailcloth(false), [full(ferryman, '3'), short]);
    expect(screen.getByText('Same stat line as the Ferryman.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ferryman: read it' }));
    expect(within(screen.getByRole('dialog')).getByText('How many: 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Old Harl: read it' }));
    expect(screen.getByRole('dialog', { name: 'Old Harl' })).toBeTruthy();
  });

  // Purpose: a line the packs lack says so by its words, with the piece's count, and is no tap.
  it('says a missing line in its place', () => {
    draw(sailcloth(false), [{ form: 'missing', kind: 'statBlock', count: '2', words: 'Not in your packs: a creature' }]);
    expect(screen.getByText('Not in your packs: a creature ×2')).toBeTruthy();
  });
});

describe('3. her Carries line (page 50, finding 5; sb4-4)', () => {
  const sedge = (shown: boolean) => piece('person', 'A tall woman in a salt-stiff coat.', { statLine: 'NPC: reed-mother-sedge' }, shown);
  const sedgeRow = full({ name: 'Mother Sedge', kind: 'the customs warden', shown: block([{ label: 'Level', value: '2' }]), source: null, uses: { name: 'Warden', shown: block([{ label: 'Level', value: '2' }]) } });
  const line = <span className="person-carries">Carries: Warden’s lantern, iron key.</span>;

  // Purpose: on a phone her Carries line sits inside her row, under her name and above her stat line.
  it('puts it under her name on a phone', () => {
    draw(sedge(true), [sedgeRow], { carries: { line, first: true } });
    const row = screen.getByRole('button', { name: 'Mother Sedge: read it' });
    const text = row.textContent ?? '';
    expect(text.indexOf('Carries:')).toBeGreaterThan(text.indexOf('Mother Sedge'));
    expect(text.indexOf('Carries:')).toBeLessThan(text.indexOf('Level'));
    // A shown person: her row and her line under "Only you see these details." (sb4-4).
    expect(screen.getByText('Only you see these details.')).toBeTruthy();
  });

  // Purpose: on a tablet it follows her row, as its own line.
  it('puts it after her row on a tablet', () => {
    draw(sedge(false), [sedgeRow], { carries: { line, first: false } });
    const items = screen.getAllByRole('listitem');
    expect(items.at(-1)!.textContent).toBe('Carries: Warden’s lantern, iron key.');
    expect(screen.getByRole('button', { name: 'Mother Sedge: read it' }).textContent).not.toContain('Carries:');
  });
});

describe('4. the fold (sf-24, F17, F18)', () => {
  const text = { blocks: [{ kind: 'p' as const, lead: '', text: 'A cog on her side on the bar.' }], firstLine: 'A cog on her side on the bar.' };

  // Purpose: the fold ends with its rows under "Stat line" over one, "Items", then the quiet line; it has no eye.
  it('ends with its rows and the quiet line', async () => {
    const user = userEvent.setup();
    render(<BookTextFold text={text} atHand={{ statLines: [{ form: 'short', kind: 'npc', name: 'Old Harl', count: null, detail: harl, words: 'Same stat line as the Ferryman.' }], items: [full(oil)], onPieces: true }} />);
    await user.click(screen.getByRole('button', { name: /From the book, for the GM/ }));
    expect(screen.getByRole('heading', { name: 'Stat line' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Items' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Old Harl: read it' })).toBeTruthy();
    expect(screen.getByText('The other stat lines and the items are on their own rows.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Show players|Hide from players/ })).toBeNull();
  });

  // Purpose: "Stat lines" over two or more rows.
  it('says "Stat lines" over two rows', async () => {
    const user = userEvent.setup();
    render(<BookTextFold text={text} atHand={{ statLines: [full(ferryman), full(harl)], items: [], onPieces: false }} />);
    await user.click(screen.getByRole('button', { name: /From the book, for the GM/ }));
    expect(screen.getByRole('heading', { name: 'Stat lines' })).toBeTruthy();
    expect(screen.queryByText(/on their own rows/)).toBeNull();
  });

  // Purpose: a fold whose every line is on a piece shows no group, only its quiet line.
  it('shows the quiet line alone when nothing is left', async () => {
    const user = userEvent.setup();
    render(<BookTextFold text={text} atHand={{ statLines: [], items: [], onPieces: true }} />);
    await user.click(screen.getByRole('button', { name: /From the book, for the GM/ }));
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('The other stat lines and the items are on their own rows.')).toBeTruthy();
  });

  // Purpose: a place with rows for the fold but no book text still has its fold, so no row is lost.
  it('stands with rows and no book text', async () => {
    const user = userEvent.setup();
    render(<BookTextFold text={null} atHand={{ statLines: [full(ferryman)], items: [], onPieces: false }} />);
    await user.click(screen.getByRole('button', { name: /From the book, for the GM/ }));
    expect(screen.getByRole('button', { name: 'Ferryman: read it' })).toBeTruthy();
  });
});
