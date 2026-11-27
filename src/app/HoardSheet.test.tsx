// @vitest-environment jsdom
// B15 (page 30, HM1 to HM5; the Pack page's PK5 and PK5b): the hoard's sheet and the words around it. Invented things.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hoard, HoardRow } from '../modules/expedition/hoard.ts';
import type { Piece } from '../modules/expedition/placePlay.ts';
import { PieceRow } from './PlaceCard.tsx';
import { oneThing } from '../modules/expedition/hoard.ts';
import { HoardSheetView, hoardLine, sendListWords, SendSheet, sentPieceWords, sheetHoard, takenBackWords, truthToastWords } from './HoardSheet.tsx';

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
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Wren'])).toBe('Shown to the players: Lantern of the Drowned. The hooded lantern Wren holds now carries its name.');
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [null])).toBe('Shown to the players: Lantern of the Drowned. The hooded lantern in the party stash now carries its name.');
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [])).toBe('Shown to the players: Lantern of the Drowned.');
  });


  // Purpose (Home Two's alternative, Francis picked B, 24 Nov): the toast names the item, then its holder by their full
  // name with no possessive ("The hooded lantern Wren of the Lantern Wardens holds now carries its name."), the same way
  // for a character and a hireling; the party stash its own way; and with the holder unknown, the item alone.
  it("words the eye's toast as the item its holder holds", () => {
    const shown = 'Shown to the players: Lantern of the Drowned.';
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Wren of the Lantern Wardens'])).toBe(`${shown} The hooded lantern Wren of the Lantern Wardens holds now carries its name.`);
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', ['Brask the Torchbearer'])).toBe(`${shown} The hooded lantern Brask the Torchbearer holds now carries its name.`);
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [null])).toBe(`${shown} The hooded lantern in the party stash now carries its name.`);
    expect(truthToastWords('Lantern of the Drowned', 'Hooded lantern', [''])).toBe(`${shown} The hooded lantern now carries its name.`);
  });

  // Purpose (words rule 13, Francis, 26 Nov): a thing whose name starts with "The" keeps its own article at the
  // sentence's start, never "The the Drowned Crown", for the stash, a holder and an unknown holder alike.
  it("words the eye's toast for a thing named \"The …\"", () => {
    const shown = 'Shown to the players: Crown of Reeds.';
    expect(truthToastWords('Crown of Reeds', 'The Drowned Crown', [null])).toBe(`${shown} The Drowned Crown in the party stash now carries its name.`);
    expect(truthToastWords('Crown of Reeds', 'The Drowned Crown', ['Wren'])).toBe(`${shown} The Drowned Crown Wren holds now carries its name.`);
    expect(truthToastWords('Crown of Reeds', 'The Drowned Crown', [''])).toBe(`${shown} The Drowned Crown now carries its name.`);
  });

  // Purpose (words rule 13): sent to several holders, "Each" takes the thing's bare name, never "Each the Drowned
  // Crown sent"; a plain thing reads as before.
  it("words the eye's toast for a thing sent to several holders", () => {
    const shown = 'Shown to the players: Crown of Reeds.';
    expect(truthToastWords('Crown of Reeds', 'The Drowned Crown', ['Wren', null])).toBe(`${shown} Each Drowned Crown sent now carries its name.`);
    expect(truthToastWords('Crown of Reeds', 'Hooded lantern', ['Wren', 'Ash'])).toBe(`${shown} Each hooded lantern sent now carries its name.`);
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

describe("a Treasure piece's find sheet (sf-8; page 44, TR1)", () => {
  // Purpose: one thing is a single thing row of one; several rows, a count over 1, or coin make a count.
  it('tells one thing from a count', () => {
    expect(oneThing({ rows: [thing(4, 'Bronze ring')] })).toEqual(thing(4, 'Bronze ring'));
    expect(oneThing({ rows: [thing(4, 'Lamp oil', 8)] })).toBeNull();
    expect(oneThing({ rows: [coin] })).toBeNull();
    expect(oneThing({ rows: ROWS })).toBeNull();
    expect(oneThing({ rows: [] })).toBeNull();
  });

  // Purpose: the sheet is headed by the hoard's name, else the piece's lead word, else its one row's words; under it
  // the hoard's words, else the piece's, never the head said twice.
  it("heads the sheet by the hoard's name, the piece's lead or its one thing", () => {
    expect(sheetHoard(HOARD, { text: HOARD.words!, lead: 'Strongbox' })).toEqual(HOARD);
    const ring = { name: null, words: null, rows: [thing(4, 'Bronze ring')] };
    expect(sheetHoard(ring, { text: 'Bronze ring', lead: '' })).toMatchObject({ name: 'Bronze ring', words: null });
    expect(sheetHoard(ring, { text: 'A plain band of old bronze.', lead: 'Bronze ring' })).toMatchObject({ name: 'Bronze ring', words: 'A plain band of old bronze.' });
    expect(sheetHoard({ name: null, words: null, rows: [thing(5, 'Lamp oil', 8)] }, { text: 'Lamp oil' })).toMatchObject({ name: 'Lamp oil ×8', words: 'Lamp oil' });
  });

  // Purpose: a sent piece's line and "Take it back"'s toast name where it went, a character or the party stash; the
  // line names the turn of the send when it is known (TR1, "Sent to Wren, turn 3.").
  it("words a sent piece's line and Take it back's toast", () => {
    expect(sentPieceWords('wren', nameOf)).toBe('Sent to Wren.');
    expect(sentPieceWords(null, nameOf)).toBe('In the party stash.');
    expect(sentPieceWords('wren', nameOf, 'turn 3')).toBe('Sent to Wren, turn 3.');
    expect(sentPieceWords(null, nameOf, 'turn 3')).toBe('In the party stash, turn 3.');
    expect(takenBackWords('wren', nameOf, [thing(4, 'Bronze ring')])).toBe('Taken back from Wren: bronze ring.');
    expect(takenBackWords(null, nameOf, [thing(4, 'Lamp oil', 8)])).toBe('Taken back from the party stash: 8 lamp oil.');
  });

  // Purpose: the arrow is a 44 px pointer target that opens the sheet as the words do, left out of the keyboard's and
  // a screen reader's way (the words' button already says it), and a piece's GM line still shows beside it.
  it("the arrow opens what the words open, and the piece's value line stays", async () => {
    const onOpen = vi.fn();
    const piece: Piece = { id: 'p-ring', kind: 'treasure', text: 'Bronze ring', shown: false, shownAt: null, gm: { value: '40 herons', trigger: '', statLine: '' }, version: 1 };
    render(
      <ul>
        <PieceRow page piece={piece} onToggle={() => undefined} onEdit={() => undefined} onOpen={onOpen} />
      </ul>,
    );
    const arrow = document.querySelector('.place-page__opens') as HTMLButtonElement;
    expect(arrow.tagName).toBe('BUTTON');
    expect(arrow.getAttribute('aria-hidden')).toBe('true');
    expect(arrow.tabIndex).toBe(-1);
    await userEvent.click(arrow);
    await userEvent.click(screen.getByRole('button', { name: /^Bronze ring/ }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Value stays yours (40 herons).')).toBeTruthy();
  });
});
