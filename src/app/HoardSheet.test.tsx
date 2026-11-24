// @vitest-environment jsdom
// B15 (page 30, HM1 to HM5; the Pack page's PK5 and PK5b): the hoard's sheet and the words around it. Invented things.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hoard, HoardRow } from '../modules/expedition/hoard.ts';
import type { Piece } from '../modules/expedition/placePlay.ts';
import { PieceRow } from './PlaceCard.tsx';
import { HoardSheetView, hoardLine, sendListWords, SendSheet, truthToastWords } from './HoardSheet.tsx';

afterEach(cleanup);

const coin: HoardRow = { kind: 'coin', entry: 0, text: '240 herons', amounts: [{ key: 'heron', amount: 240, words: '240 herons' }], coins: { heron: 240 }, readAs: null, notCoins: [] };
const thing = (entry: number, text: string, qty = 1, magic: string | null = null): HoardRow => ({ kind: 'thing', entry, text, itemId: null, worth: null, qty, magic, noticed: null });
const ROWS = [coin, thing(1, 'Moon opals', 2), thing(2, 'Swords', 4), thing(3, 'Hooded lantern', 1, 'Lantern of the Drowned')];
const HOARD: Hoard = { name: 'Strongbox', words: '240 herons, two moon opals, four swords and a hooded lantern.', rows: ROWS };
const names: Record<string, string> = { wren: 'Wren', ash: 'Ash' };
const nameOf = (id: string) => names[id] ?? 'someone';

describe("the line under a hoard's piece (HM1, HM3, HM5)", () => {
  // Purpose: nothing sent says nothing; part sent counts; all to one names them; all to several names each once.
  it('says where the hoard went', () => {
    expect(hoardLine(ROWS, new Map(), nameOf)).toBeNull();
    expect(hoardLine(ROWS, new Map([['0:coin', { to: 'wren' }]]), nameOf)).toEqual({ text: '1 of 4 sent', tick: false });
    const toWren = new Map(ROWS.map((r) => [`${r.entry}:${r.kind}`, { to: 'wren' }]));
    expect(hoardLine(ROWS, toWren, nameOf)).toEqual({ text: 'Sent to Wren', tick: true });
    const stash = new Map(ROWS.map((r) => [`${r.entry}:${r.kind}`, { to: null as string | null }]));
    expect(hoardLine(ROWS, stash, nameOf)).toEqual({ text: 'In the party stash', tick: true });
    const mixed = new Map<string, { to: string | null }>([['0:coin', { to: 'wren' }], ['1:thing', { to: 'ash' }], ['2:thing', { to: null }], ['3:thing', { to: 'wren' }]]);
    expect(hoardLine(ROWS, mixed, nameOf)).toEqual({ text: 'All sent: Wren, Ash, the party stash', tick: true });
  });

  // Purpose: what a send carries is said once, with counts, coin in its words (PK5b's toast).
  it('says what a send carries', () => {
    expect(sendListWords(ROWS)).toBe('240 herons, 2 moon opals, 4 swords, hooded lantern');
  });

  // Purpose: the eye's toast names what was shown and the item where it is held (HM3), the stash its own way, and
  // says the first sentence alone while the thing is still in the hoard; it never names a group, since a revealed name
  // is every player's (Francis, 2026-11-21).
  it("words the eye's toast", () => {
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Wren'])).toBe('Shown to the players: Lantern of the Drowned. Wren\'s hooded lantern now carries its name.');
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [null])).toBe('Shown to the players: Lantern of the Drowned. The hooded lantern in the party stash now carries its name.');
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [])).toBe('Shown to the players: Lantern of the Drowned.');
  });

  // Purpose (impeccable audit 3, Francis picked 2026-11-24): after a name ending in s the possessive is the apostrophe
  // alone ("Wardens' hooded lantern"); after any other name, "'s".
  it("puts the apostrophe alone after a name ending in s", () => {
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Wren of the Lantern Wardens'])).toBe("Shown to the players: Lantern of the Drowned. Wren of the Lantern Wardens' hooded lantern now carries its name.");
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Ash'])).toBe("Shown to the players: Lantern of the Drowned. Ash's hooded lantern now carries its name.");
  });
});

describe("the hoard's sheet (HM2, HM5)", () => {
  // Purpose: the book's line once, one row a thing with its count, "Send all" and "Edit the piece's words"; a tap on a
  // row and on Send all reach their handlers.
  it('lists the things with counts and sends', async () => {
    const onRow = vi.fn();
    const onSendAll = vi.fn();
    const onEdit = vi.fn();
    render(<HoardSheetView hoard={HOARD} over="2. The Wreck" sent={new Map()} nameOf={nameOf} onRow={onRow} onSendAll={onSendAll} onEdit={onEdit} onClose={() => undefined} />);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText(HOARD.words!)).toBeTruthy();
    for (const words of ['240 herons', 'Moon opals ×2', 'Swords ×4', 'Hooded lantern']) expect(within(sheet).getByText(words)).toBeTruthy();
    expect(within(sheet).queryByText('Lantern of the Drowned')).toBeNull();
    await userEvent.click(within(sheet).getByText('Swords ×4'));
    expect(onRow).toHaveBeenCalledWith(ROWS[2]);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send all' }));
    expect(onSendAll).toHaveBeenCalled();
    await userEvent.click(within(sheet).getByText("Edit the piece's words"));
    expect(onEdit).toHaveBeenCalled();
  });

  // Purpose: once everything is sent "Send all" is gone (never a disabled button) and each row says where it went.
  it('after everything was sent', () => {
    const sent = new Map(ROWS.map((r) => [`${r.entry}:${r.kind}`, { to: r.entry === 2 ? null : 'wren' }]));
    render(<HoardSheetView hoard={HOARD} over="2. The Wreck" sent={sent} nameOf={nameOf} onRow={() => undefined} onSendAll={null} onEdit={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Send all' })).toBeNull();
    expect(screen.getAllByText('Sent to Wren')).toHaveLength(3);
    expect(screen.getByText('In the party stash')).toBeTruthy();
  });

  // Purpose: the Send sheet says what is sent once and offers the two equal answers (PK5).
  it('offers the two answers', async () => {
    const onStash = vi.fn();
    render(<SendSheet back="Strongbox" words={sendListWords(ROWS)} onBack={() => undefined} onCharacter={() => undefined} onStash={onStash} onClose={() => undefined} />);
    expect(screen.getByText('240 herons, 2 moon opals, 4 swords, hooded lantern.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'To a character' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'To the party stash' }));
    expect(onStash).toHaveBeenCalled();
  });
});

describe("the hoard's piece on the GM's card (HM1)", () => {
  // Purpose (impeccable audit 2, Francis picked 2026-11-24): the Strongbox piece's accessible name is its visible
  // words, not a hidden "Open Strongbox" a screen reader alone would hear.
  it('is named by its visible words', () => {
    const piece: Piece = { id: 'p-box', kind: 'other', lead: 'Strongbox', text: '240 herons and a hooded lantern.', shown: false, shownAt: null, gm: { value: '', trigger: '', statLine: '' }, version: 1 };
    render(
      <ul>
        <PieceRow page piece={piece} onToggle={() => undefined} onEdit={() => undefined} onOpen={() => undefined} />
      </ul>,
    );
    const words = document.querySelector('.place-page__piece-words') as HTMLElement;
    expect(words.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('button', { name: 'Strongbox. 240 herons and a hooded lantern.' })).toBe(words);
  });
});
