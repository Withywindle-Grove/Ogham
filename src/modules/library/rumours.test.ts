// A rumour table's truth, the GM's alone (dec-12 piece E; ruled mc-65, tb-1, rm-1): reading a rumours table for the
// GM's sheet, what its rows say about who heard them, and the import's part in keeping the truth from players.
// Invented content only.
import { describe, expect, it } from 'vitest';
import { PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';
import {
  alreadyHeard,
  givesOf,
  heardCount,
  heardLine,
  heardWords,
  isRumoursTable,
  readRumourTable,
  rumourKey,
  truthOf,
  type RumourGive,
} from './rumours.ts';

const quay = {
  uses: ['world.rumours'],
  die: 'd4',
  rows: [
    { min: 1, max: 1, result: 'The cog went down with her captain still aboard.', truth: 'true', note: 'The captain is the Bog lurker now.' },
    { min: 2, max: 3, result: 'The [[npc:ew-tidewife|Tidewife]] drowns anyone who rows at slack water.', truth: 'partial' },
    { min: 4, max: 4, result: 'There is a light in the shed some nights.', truth: false },
  ],
};

const give = (key: string, actorId: string | null, over: Partial<RumourGive> = {}): RumourGive => ({
  id: `g-${key}-${actorId ?? 'party'}`,
  packId: 'weirs',
  key,
  actorId,
  clockSeconds: 0,
  createdAt: '2026-12-05T19:00:00Z',
  ...over,
});

describe('a rumours table read for the GM (frame 5)', () => {
  // Purpose: a table with the use world.rumours, or the older kind "rumours", is a rumours table; another table isn't.
  it('knows a rumours table by its use, or the older kind', () => {
    expect(isRumoursTable({ uses: ['world.rumours'] })).toBe(true);
    expect(isRumoursTable({ uses: 'world.rumours' })).toBe(true);
    expect(isRumoursTable({ use: 'world.rumours' })).toBe(true);
    expect(isRumoursTable({ kind: 'rumours' })).toBe(true);
    expect(isRumoursTable({ uses: ['encounters'] })).toBe(false);
    expect(isRumoursTable({})).toBe(false);
  });

  // Purpose: each row keeps its range, its players' words with each link mark as words, and its truth in the cell's word.
  it('reads each row: its range, its words with links as words, and its truth as True, False or Partly', () => {
    const table = readRumourTable('weirs', 'ew-quay-rumours', 'What they say on the quay', quay);
    expect(table?.die).toBe('d4');
    expect(table?.rows.map((r) => [r.range, r.words, r.truth])).toEqual([
      ['1', 'The cog went down with her captain still aboard.', 'True'],
      ['2–3', 'The Tidewife drowns anyone who rows at slack water.', 'Partly'],
      ['4', 'There is a light in the shed some nights.', 'False'],
    ]);
  });

  // Purpose: the truth's word is one of three, or none when the row says none (a row with no truth shows an empty cell).
  it('says the truth in one of three words, or none', () => {
    expect([truthOf('true'), truthOf(true), truthOf('false'), truthOf(false), truthOf('partial'), truthOf(undefined), truthOf('maybe')]).toEqual(['True', 'True', 'False', 'False', 'Partly', null, null]);
  });

  // Purpose: a table that isn't a rumours table, or whose rows have no whole-number range or no words, gives nothing.
  it('leaves out what the database could not give: another table, a row without a range or words', () => {
    expect(readRumourTable('weirs', 'enc', 'Encounters', { uses: ['encounters'], rows: quay.rows })).toBeNull();
    const odd = readRumourTable('weirs', 'odd', 'Odd', { uses: ['world.rumours'], rows: [{ min: '1', max: 1, result: 'A' }, { min: 2, max: 2, result: '  ' }, { min: 3, max: 3, result: 'Kept.' }] });
    expect(odd?.rows.map((r) => r.words)).toEqual(['Kept.']);
  });
});

describe('who heard a rumour (frames 2b and 5)', () => {
  const table = readRumourTable('weirs', 'ew-quay-rumours', 'What they say on the quay', quay)!;
  const first = table.rows[0]!;
  const gives = [give(rumourKey(table.id, first), null), give(rumourKey(table.id, first), 'wren', { createdAt: '2026-12-05T19:05:00Z', clockSeconds: 2 * 86400 })];

  // Purpose: a given row is kept under its table's id and its range, never meeting a hook's id (which has no "#").
  it('keys a given row by its table and its range', () => {
    expect(rumourKey('ew-quay-rumours', table.rows[1]!)).toBe('ew-quay-rumours#2-3');
  });

  // Purpose: a row counts once as heard however many hearers it reached; the list's row says the die and the count.
  it('counts each row heard at least once, and says it with the die', () => {
    expect(heardCount(table, gives)).toBe(1);
    expect(heardWords(table, gives)).toBe('d4. 1 of 3 heard so far.');
    expect(heardWords({ ...table, die: null }, [])).toBe('0 of 3 heard so far.');
  });

  // Purpose: a heard row says by whom and on which day; without the clock's units it leaves the day out.
  it('says who heard a row and when', () => {
    const lines = givesOf(gives, table, first).map((g) => heardLine(g, [{ id: 'wren', name: 'Wren' }], (s) => Math.floor(s / 86400) + 1));
    expect(lines).toEqual(['Heard by the party, day 1.', 'Heard by Wren, day 3.']);
    expect(heardLine(gives[0]!, [], null)).toBe('Heard by the party.');
  });

  // Purpose: a second give of a row to the same hearer is known before it is asked (the database refuses it too).
  it('knows a row already given to that hearer', () => {
    expect(alreadyHeard(gives, table, first, null)).toBe(true);
    expect(alreadyHeard(gives, table, first, 'ash')).toBe(false);
    expect(alreadyHeard(gives, table, table.rows[1]!, null)).toBe(false);
  });
});

describe("a rumour's truth never reaches a player (hard rule 5), at the import", () => {
  const pack = (gmOnly?: boolean) =>
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The eel weirs', version: '0.1', kind: 'adventure' },
      tables: [{ id: 'ew-quay-rumours', name: 'What they say on the quay', ...quay, ...(gmOnly === undefined ? {} : { gmOnly }) }],
      items: [{ id: 'ew-eel-knife', name: 'Eel knife' }],
    });

  // Purpose: a rumours table is stored as a table, a kind players may not read, so its truth stays in the GM's library.
  it('keeps a rumours table as a kind players may not read', () => {
    const read = readPackJson(pack());
    if (!read.ok) throw new Error(read.message);
    const stored = read.pack.entries.find((e) => e.packEntryId === 'ew-quay-rumours')!;
    expect(stored.kind).toBe('table');
    expect(PLAYER_FACING).not.toContain('table');
    expect(playerFacingEntry(stored.kind, stored.data)).toBe(false);
    // No player-facing entry of the pack carries a truth or a note.
    const players = JSON.stringify(read.pack.entries.filter((e) => playerFacingEntry(e.kind, e.data)));
    expect(players).not.toContain('Bog lurker now');
    expect(players).not.toContain('"truth"');
  });

  // Purpose: a pack that opens a rumours table to players ("gmOnly": false) has that table refused in words, so its
  // truth never reaches a player's device; the rest of the pack imports.
  it('refuses, in words, a rumours table opened to players', () => {
    const read = readPackJson(pack(false));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.entries.map((e) => e.packEntryId)).toEqual(['ew-eel-knife']);
    expect(read.pack.problems).toContain(
      'tables: "What they say on the quay" is a table of rumours marked "gmOnly": false, which would show players whether each rumour is true; skipped. Take "gmOnly": false off: a table of rumours is the GM\'s, and a rumour reaches players when the GM gives it.',
    );
  });
});
