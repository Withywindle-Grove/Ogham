// Marching order worked out (M5 step 8; ruled M5-6): rows of 1–3, front to back. Invented characters.
//   Stored rows are read leniently: no id twice, no empty row, at most 3 in a row.
//   The order shows the party as it is: who left goes, who's new joins at the back in a row of their own.
//   Hold to drag moves a row; a character joins the row ahead (or behind, from the front) unless it holds 3, or steps
//   into a row of their own just behind.
//   The log and the toast say what one change did: "moved Ash to the front", "put Ash beside Wren", "gave Ash a row
//   of their own", else "changed the marching order".
import { describe, expect, it } from 'vitest';
import { arrange, joinRow, moveRow, moveWords, namesWords, ownRow, readRows, rowOf } from './marchingRows.ts';

const names: Record<string, string> = { ash: 'Ash', wren: 'Wren', moss: 'Moss', reed: 'Reed' };
const name = (id: string) => names[id] ?? 'someone';

describe('reading and arranging', () => {
  it('reads stored rows leniently: no id twice, no empty rows, at most 3 side by side', () => {
    expect(readRows([['ash', 'ash'], [], ['wren', 7, 'moss', 'reed', 'fern'], 'odd'])).toEqual([['ash'], ['wren', 'moss', 'reed']]);
    expect(readRows(null)).toEqual([]);
  });

  it('who left goes (and an emptied row with them); who is new joins at the back, each in a row of their own', () => {
    expect(arrange([['ash', 'gone'], ['gone-too'], ['wren']], ['wren', 'ash', 'moss', 'reed'])).toEqual([['ash'], ['wren'], ['moss'], ['reed']]);
    expect(arrange([], ['ash', 'wren'])).toEqual([['ash'], ['wren']]);
  });
});

describe('moving', () => {
  const rows = [['ash'], ['wren', 'moss'], ['reed']];

  it('hold to drag moves a whole row', () => {
    expect(moveRow(rows, 2, 0)).toEqual([['reed'], ['ash'], ['wren', 'moss']]);
    expect(moveRow(rows, 0, 9)).toEqual(rows);
  });

  it('a character joins the row ahead, or from the front the row behind; a full row says so', () => {
    expect(joinRow(rows, 'reed', 'ahead')).toEqual([['ash'], ['wren', 'moss', 'reed']]);
    expect(joinRow(rows, 'ash', 'behind')).toEqual([['wren', 'moss', 'ash'], ['reed']]);
    expect(joinRow(rows, 'ash', 'ahead')).toBeNull();
    expect(joinRow([['ash', 'wren', 'moss'], ['reed']], 'reed', 'ahead')).toBe('full');
    expect(rowOf(rows, 'moss')).toBe(1);
  });

  it('a row of their own goes just behind the row they shared; alone already, nothing to do', () => {
    expect(ownRow(rows, 'wren')).toEqual([['ash'], ['moss'], ['wren'], ['reed']]);
    expect(ownRow(rows, 'ash')).toBeNull();
  });
});

describe('what a change did, in words', () => {
  it('names one move plainly, and anything bigger as a change', () => {
    const rows = [['ash'], ['wren', 'moss'], ['reed']];
    expect(moveWords(rows, moveRow(rows, 2, 0), name)).toBe('moved Reed to the front');
    expect(moveWords(rows, moveRow(rows, 0, 2), name)).toBe('moved Ash to the back');
    expect(moveWords(rows, moveRow(rows, 0, 1), name)).toBe('moved Wren and Moss to the front');
    expect(moveWords(rows, joinRow(rows, 'reed', 'ahead') as string[][], name)).toBe('put Reed beside Wren and Moss');
    expect(moveWords(rows, ownRow(rows, 'moss')!, name)).toBe('gave Moss a row of their own');
    expect(moveWords(rows, [['reed', 'ash'], ['moss'], ['wren']], name)).toBe('changed the marching order');
  });

  it('counts someone new as already at the back of the old order', () => {
    expect(moveWords([['ash'], ['wren']], [['reed'], ['ash'], ['wren']], name)).toBe('moved Reed to the front');
  });

  it('lists names as people say them', () => {
    expect([namesWords([]), namesWords(['Ash']), namesWords(['Ash', 'Wren']), namesWords(['Ash', 'Wren', 'Moss'])]).toEqual(['someone', 'Ash', 'Ash and Wren', 'Ash, Wren and Moss']);
  });
});
