// @vitest-environment jsdom
// The full sheet's small pure helpers (plan m5b-sheet-revised): when a note or change was made, the notes line, who
// wrote a note, Edit's foot count, the first sentence of a rule, and the literacy line. Invented words and figures.
import { describe, expect, it } from 'vitest';
import { firstSentence, literacyLine } from './CharacterSheet.tsx';
import { changesLine } from './SheetEdit.tsx';
import { noteAuthor, notesLine, whenWords } from './SheetParts.tsx';

// A fixed "now" in the afternoon of 8 November 2026 (local time, as the helper reads days).
const now = new Date(2026, 10, 8, 15, 0, 0);
const at = (day: number, hour = 9) => new Date(2026, 10, day, hour, 0, 0).toISOString();

describe('whenWords', () => {
  // Purpose: the same day reads "today", the day before "yesterday", older ones the day and month.
  it('says today, yesterday, then the date', () => {
    expect(whenWords(at(8), now)).toBe('today');
    expect(whenWords(at(7, 23), now)).toBe('yesterday');
    expect(whenWords(at(2), now)).toBe('2 Nov');
  });

  // Purpose: a time that cannot be read gives no words, never "Invalid Date".
  it('gives nothing for a bad time', () => {
    expect(whenWords('not a time', now)).toBe('');
  });

  // Purpose: a time ahead of now (clock drift) still reads "today" rather than a negative count.
  it('reads a time ahead of now as today', () => {
    expect(whenWords(at(9), now)).toBe('today');
  });
});

describe('notesLine', () => {
  // Purpose: with no notes the line says so.
  it('says there are none yet', () => {
    expect(notesLine([], now)).toBe('No notes yet');
  });

  // Purpose: one note is singular, and the last one is the newest whatever the order given.
  it('counts one note and names when the last was', () => {
    expect(notesLine([{ createdAt: at(7) }], now)).toBe('1 note, last one yesterday');
  });

  // Purpose: several notes are counted and the newest sets the "last one".
  it('counts several and uses the newest', () => {
    expect(notesLine([{ createdAt: at(2) }, { createdAt: at(8) }, { createdAt: at(5) }], now)).toBe('3 notes, last one today');
  });
});

describe('noteAuthor', () => {
  const names = new Map([['user-jo', 'Jo']]);
  const gms = new Set(['user-priya']);

  // Purpose: your own note reads "by you".
  it('says by you for your own', () => {
    expect(noteAuthor({ authorUserId: 'user-sam' }, 'user-sam', gms, names)).toBe('by you');
  });

  // Purpose: the GM's note to a player reads "from your GM".
  it('says from your GM for the GM', () => {
    expect(noteAuthor({ authorUserId: 'user-priya' }, 'user-sam', gms, names)).toBe('from your GM');
  });

  // Purpose: another player is named; one unknown (or no author) reads "someone".
  it('names another player, or says someone', () => {
    expect(noteAuthor({ authorUserId: 'user-jo' }, 'user-sam', gms, names)).toBe('by Jo');
    expect(noteAuthor({ authorUserId: 'user-lost' }, 'user-sam', gms, names)).toBe('by someone');
    expect(noteAuthor({ authorUserId: null }, 'user-sam', gms, names)).toBe('by someone');
  });
});

describe('changesLine', () => {
  // Purpose: Edit's foot counts the changes made and how many need the GM's approval.
  it('counts changes and those needing approval', () => {
    expect(changesLine(0, 0)).toBe('No changes yet');
    expect(changesLine(1, 0)).toBe('1 change');
    expect(changesLine(3, 0)).toBe('3 changes');
    expect(changesLine(2, 1)).toBe('2 changes, 1 needs approval');
    expect(changesLine(3, 2)).toBe('3 changes, 2 need approval');
  });
});

describe('firstSentence', () => {
  // Purpose: the saves' rule line is the pack's text up to its first full stop.
  it('cuts at the first full stop', () => {
    expect(firstSentence('Roll d20, equal or over the number. Add the kindred bonus.')).toBe('Roll d20, equal or over the number.');
  });

  // Purpose: a text with no stop ends with one, and an empty text gives nothing (no line is drawn).
  it('closes a text with no stop, and gives nothing for no text', () => {
    expect(firstSentence('Roll high')).toBe('Roll high.');
    expect(firstSentence('   ')).toBe('');
  });

  // Purpose: a number with a decimal point or a dotted abbreviation inside a sentence does not end it.
  it('keeps a point inside a word or a number', () => {
    expect(firstSentence('Roll 1.5 times the die. Then stop.')).toBe('Roll 1.5 times the die.');
  });

  // Purpose: a question or an exclamation also ends the sentence.
  it('ends at a question mark or an exclamation', () => {
    expect(firstSentence('Did it hold? Roll again.')).toBe('Did it hold?');
  });
});

describe('literacyLine', () => {
  const byLevel = { literacyNote: { Literate: 'Reads and writes the languages above. Needs no help.', Illiterate: 'Cannot read or write.' } };

  // Purpose: the line follows the pack's note for the character's level, in the pack's words.
  it("uses the pack's note for the level the character has", () => {
    expect(literacyLine([byLevel], 'Literate')).toBe('Literacy: Literate, reads and writes the languages above.');
    expect(literacyLine([byLevel], 'illiterate')).toBe('Literacy: illiterate, cannot read or write.');
  });

  // Purpose: a pack whose note is one text uses it for every level.
  it('uses a single text for any level', () => {
    expect(literacyLine([{ literacyNote: 'Everyone here reads.' }], 'Yes')).toBe('Literacy: Yes, everyone here reads.');
  });

  // Purpose: a pack with no literacy rule draws no line (no app wording).
  it('draws no line without a rule, a level, or a note for that level', () => {
    expect(literacyLine([{}], 'Literate')).toBe('');
    expect(literacyLine([], 'Literate')).toBe('');
    expect(literacyLine([byLevel], '—')).toBe('');
    expect(literacyLine([byLevel], '')).toBe('');
    expect(literacyLine([byLevel], 'Scribe')).toBe('');
  });

  // Purpose: the rules set added last wins when two have a note.
  it('takes the last rules set that has a note', () => {
    expect(literacyLine([{ literacyNote: 'Old words.' }, { literacyNote: 'New words.' }], 'Yes')).toBe('Literacy: Yes, new words.');
  });
});
