// Tests for the pack checker's description checks (scripts/pack-descriptions.mjs; docs/07, tables and conditions;
// M5 gate B2 and B6, 2026-11-01), on invented snippets.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conditionLookNotes, conditionNoteNotes, descriptionNotes, entryDescriptionNotes, tableDescriptionNotes } from './pack-descriptions.mjs';
import { formatNotes } from './pack-format.mjs';

const goodTable = {
  id: 'reed-marsh', name: 'Reed marsh', die: 'd6', description: 'Who wanders the reeds by day',
  rows: [
    { min: 1, max: 2, result: 'Bog lurker', statBlockId: 'bog-lurker', count: '1d4' },
    { min: 3, max: 6, result: 'Lantern pilgrims', note: 'Lost, and glad of company' },
  ],
};
const lurker = { id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', description: 'Hides under still water' };

describe('the description checks (B2 tables, B6 conditions)', () => {
  it('finds nothing wrong with a table whose description, row notes and named stat block description are text', () => {
    expect(descriptionNotes({ tables: [goodTable], statBlocks: [lurker] })).toEqual([]);
  });

  it('accepts a table with no description and rows with no note: 07 only asks that they be text when given', () => {
    const bare = { id: 'bare', name: 'Bare', die: 'd6', rows: [{ min: 1, max: 6, result: 'Nothing', note: null }] };
    expect(tableDescriptionNotes({ tables: [bare], statBlocks: [{ id: 'x', name: 'X' }] })).toEqual([]);
  });

  it('says when a table description is not text', () => {
    expect(tableDescriptionNotes({ tables: [{ ...goodTable, description: 7 }] })).toEqual([
      'tables: "reed-marsh": description should be one line of words (what the table covers).',
    ]);
  });

  it('says which row has a note that is not text, by its range, its key, or its place', () => {
    const table = { id: 'odd', name: 'Odd', rows: [
      { min: 2, max: 4, result: 'A', note: ['list'] },
      { key: 'fog', value: 'B', note: { text: 'x' } },
      { result: 'C', note: '   ' },
    ] };
    expect(tableDescriptionNotes({ tables: [table] })).toEqual([
      'tables: "odd", row 2–4: note should be one line of words.',
      'tables: "odd", row fog: note should be one line of words.',
      'tables: "odd", row #3: note should be one line of words.',
    ]);
  });

  it('says when a stat block that a table row names has a description that is not text, and leaves other blocks alone', () => {
    const notes = tableDescriptionNotes({
      tables: [goodTable],
      statBlocks: [{ ...lurker, description: 13 }, { id: 'unnamed', name: 'Unnamed', description: 13 }],
    });
    expect(notes).toEqual(['statBlocks: "bog-lurker": description should be one line of words; table rows that name it show it.']);
  });

  it('says when a condition has no notes, blank notes or notes that are not text (its brief effect would be blank)', () => {
    const notes = conditionNoteNotes([
      { id: 'dazed', name: 'Dazed', notes: 'Acts last' },
      { id: 'soggy', name: 'Soggy' },
      { id: 'mired', name: 'Mired', notes: '' },
      { name: 'Hushed', notes: 4 },
    ]);
    expect(notes).toEqual([
      'conditions: "soggy": no notes; the brief effect shown under the status\'s name would be blank.',
      'conditions: "mired": no notes; the brief effect shown under the status\'s name would be blank.',
      'conditions: "Hushed": no notes; the brief effect shown under the status\'s name would be blank.',
    ]);
  });

  it('does not check a condition family: 07 says nothing to warn on', () => {
    const notes = conditionNoteNotes([{ id: 'fen-sting', name: 'Fen sting', notes: 'Slow for a turn', family: 42 }]);
    expect(notes).toEqual([]);
  });

  // R3-6 (2026-11-08): a condition's `tone` gives its Status ring's colour, its `icon` one of the app's status symbols.
  it('accepts each of the four tones and an icon from the status symbols, or neither', () => {
    const notes = conditionLookNotes([
      { id: 'torch-lit', name: 'Torch-lit', notes: 'Lights the way', tone: 'light', icon: 'flame' },
      { id: 'fen-sting', name: 'Fen sting', notes: 'Slow for a turn', tone: 'harm', icon: 'drop' },
      { id: 'reed-ward', name: 'Reed ward', notes: 'Turns one blow', tone: 'boon', icon: 'shield' },
      { id: 'wading', name: 'Wading', notes: 'Half speed', tone: 'neutral' },
      { id: 'muddy', name: 'Muddy', notes: 'Squelches' },
    ]);
    expect(notes).toEqual([]);
    expect(descriptionNotes({ conditions: [{ id: 'wading', name: 'Wading', notes: 'Half speed', tone: 'neutral', icon: 'arrow-forward' }] })).toEqual([]);
  });

  it('says when a tone is not one of the four, or an icon names no status symbol (the ring falls back to ink, or the letter)', () => {
    const notes = conditionLookNotes([
      { id: 'spooked', name: 'Spooked', notes: 'Jumps at shadows', tone: 'spooky' },
      { id: 'harmed', name: 'Harmed', notes: 'Hurts', tone: 'Harm' },
      { id: 'listening', name: 'Listening', notes: 'Hears more', icon: 'listen' },
    ]);
    expect(notes).toEqual([
      'conditions: "spooked": tone "spooky" isn\'t one of light, harm, boon, neutral; its ring would be ink.',
      'conditions: "harmed": tone "Harm" isn\'t one of light, harm, boon, neutral; its ring would be ink.',
      'conditions: "listening": icon "listen" isn\'t one of the app\'s status symbols; its ring would show its first letter.',
    ]);
    expect(descriptionNotes({ conditions: [{ id: 'spooked', name: 'Spooked', notes: 'Jumps', tone: 4 }] })).toEqual(['conditions: "spooked": tone "4" isn\'t one of light, harm, boon, neutral; its ring would be ink.']);
  });

  it('never throws on odd input', () => {
    for (const odd of [null, 3, 'x', [], { tables: 'no', conditions: 5 }, { tables: [null, { rows: [null, 4] }] }]) {
      expect(() => descriptionNotes(odd)).not.toThrow();
    }
  });

  it('is part of the format notes the checker prints for a JSON pack', () => {
    expect(formatNotes({ conditions: [{ id: 'soggy', name: 'Soggy' }] })).toContain(
      'conditions: "soggy": no notes; the brief effect shown under the status\'s name would be blank.',
    );
  });

  it('checks a Markdown pack\'s conditions too, end to end through npm run pack:check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-descriptions-'));
    try {
      const file = join(dir, 'fen.pack.md');
      writeFileSync(file, '# Pack: Fen statuses\nversion: 1\n\n## condition: Soggy\nrounds: 2\n\n## condition: Dazed\nActs last.\n');
      const out = execFileSync(process.execPath, ['scripts/check-pack.mjs', file], { encoding: 'utf8' });
      expect(out).toMatch(/conditions: "soggy": no notes/);
      expect(out).not.toMatch(/"dazed": no notes/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a class or race description (ruled 2026-11-07)', () => {
  it('accepts a text description, or none; warns when one is not text, also from the format checks', () => {
    // Purpose: pack:check says when a description could not show, and is quiet when it can.
    const pack = {
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden', description: 'Walks the causeways.\n\nPaid in oil.' }, { id: 'reed-cutter', name: 'Reed cutter' }],
      races: [{ id: 'stone-kin', name: 'Stone kin', description: ['Slow.', 'Sure.'] }],
    };
    expect(entryDescriptionNotes(pack)).toEqual([`races: "stone-kin": description should be text (the book's paragraphs); it won't show.`]);
    expect(entryDescriptionNotes({ classes: [{ id: 'x', description: 3 }] })).toEqual([`classes: "x": description should be text (the book's paragraphs); it won't show.`]);
    expect(formatNotes(pack)).toContain(`races: "stone-kin": description should be text (the book's paragraphs); it won't show.`);
    expect(entryDescriptionNotes(null)).toEqual([]);
  });
});
