// Tests for the pack checker's shape check of overlays and modifications (scripts/pack-monster-overlay.mjs; fi-5,
// 07 "New kinds"). Every name and number is made up.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { monsterOverlayLibrary, monsterOverlayNotes } from './pack-monster-overlay.mjs';

const behaviour = (extra = {}) => ({ id: 'lurker-ways', name: 'Lurker ways', profile: { wants: 'Warm things' }, nudges: [{ text: 'Waits', when: 'start' }], ...extra });
const overlay = (extra = {}) => ({ id: 'fen-overlay', name: 'Fen overlay', keepNumbers: true, links: [{ packId: 'fen-rules', statBlockId: 'bog-lurker', behaviourId: 'lurker-ways' }], behaviours: [behaviour()], ...extra });
const file = (extra = {}) => ({ meta: { id: 'fen-overlay-pack', requires: [{ packId: 'fen-rules' }] }, overlays: [overlay()], ...extra });

describe('the shape of overlays', () => {
  // Purpose: an overlay written the way 07 says, with the required pack named, gives no note.
  it('finds nothing wrong with a well-formed overlay', () => {
    expect(monsterOverlayNotes(file())).toEqual([]);
  });

  // Purpose: an overlay in a file with no meta.requires is named, since it has no pack to lay its behaviours on.
  it('wants meta.requires when there are overlays', () => {
    expect(monsterOverlayNotes(file({ meta: { id: 'x' } }))[0]).toMatch(/has overlays but no meta.requires/);
  });

  // Purpose: the checks on the overlay itself: id, name, keepNumbers, links that point at a behaviour that isn't there
  // or a pack that isn't required.
  it('notes a bad keepNumbers, a link to a missing behaviour and a link to a pack not in meta.requires', () => {
    const bad = file({ overlays: [overlay({ keepNumbers: 'yes', links: [{ packId: 'fen-rules', statBlockId: 'bog-lurker', behaviourId: 'gone' }, { packId: 'elsewhere', statBlockId: 'x', behaviourId: 'lurker-ways' }, { statBlockId: 'y' }] })] });
    expect(monsterOverlayNotes(bad)).toEqual([
      'overlays: "fen-overlay": keepNumbers is true or false.',
      'overlays: "fen-overlay", link 1: behaviourId "gone" isn\'t one of this overlay\'s behaviours.',
      'overlays: "fen-overlay", link 2: packId "elsewhere" isn\'t in meta.requires.',
      'overlays: "fen-overlay", link 3: should be { packId?, statBlockId, behaviourId }.',
    ]);
  });

  // Purpose: a behaviour's profile takes the named lines and `other`; a typo'd key, a bad nudge tag or trigger event is noted.
  it('notes an unknown profile key, a bad nudge tag and a bad trigger event', () => {
    const bad = file({ overlays: [overlay({ behaviours: [behaviour({ profile: { wants: 'x', mood: 'y', other: [{ label: 'Habit', text: 'z' }] }, nudges: [{ text: 'a', when: 'sometimes' }], triggers: [{ event: 'dawn', text: 'b' }] })] })] });
    expect(monsterOverlayNotes(bad)).toEqual([
      'overlays: "fen-overlay", behaviour "lurker-ways": profile has "mood", which isn\'t one of wants, appearance, voice, intelligence, morality, other; a further book line goes in other: [{ label, text }].',
      'overlays: "fen-overlay", behaviour "lurker-ways", nudges 1: when "sometimes" isn\'t one of start, winning, losing, belowHalf, alone, leaderDown, any.',
      'overlays: "fen-overlay", behaviour "lurker-ways", triggers 1: event "dawn" isn\'t one of firstSight, death, belowFraction, eachRound, round, firstWound.',
    ]);
  });

  // Purpose: the shapes no ruling has settled (G-131 … G-133) are one note each, never an error, however many carry them.
  it('lists reactionColumn, words as stat changes and a column-per-creature reaction table as unruled notes', () => {
    const f = file({
      overlays: [overlay({ behaviours: [behaviour({ reactionColumn: 'wary' }), behaviour({ id: 'other-ways', reactionColumn: 'bold' })] })],
      modifications: [{ id: 'winged', name: 'Winged', statChanges: { move: 'flies at normal pace', hd: 1 }, adds: { triggers: [] }, notes: 'x' }],
      tables: [{ id: 'reactions', uses: ['encounters.reaction'], columns: ['wary', 'bold'], rows: [{ min: 2, max: 6, results: { wary: 'Flees', bold: 'Waits' } }] }],
    });
    const text = monsterOverlayNotes(f).join('\n');
    expect(text).toMatch(/2 behaviours carry reactionColumn, which isn't ruled yet \(G-132\)/);
    expect(text).toMatch(/1 modification has a statChanges value in words, not a figure; not ruled yet \(G-133\)/);
    expect(text).toMatch(/1 modification add triggers, which isn't ruled yet \(G-133\)/);
    expect(text).toMatch(/a reaction table with a column per creature isn't ruled yet \(G-131\)/);
  });

  // Purpose: a reaction table row with no result is named; a table that isn't a reaction table is left alone.
  it('wants a result on every reaction row', () => {
    const f = file({ tables: [{ id: 'reactions', uses: ['encounters.reaction'], rows: [{ min: 2, max: 6, result: 'Flees' }, { min: 7, max: 12 }] }, { id: 'other', rows: [{ min: 1, max: 6 }] }] });
    expect(monsterOverlayNotes(f)).toEqual(['tables: "reactions": 1 reaction row has no result.']);
  });
});

describe('the shape of modifications', () => {
  // Purpose: a modification written as 07 says gives no note.
  it('finds nothing wrong with a well-formed modification', () => {
    expect(monsterOverlayNotes({ modifications: [{ id: 'elite', name: 'Elite', statChanges: { hd: 1, ac: -1 }, adds: { abilities: [{ name: 'Tough', text: 'x' }], nudges: [] }, notes: 'Bigger.' }] })).toEqual([]);
  });

  // Purpose: a repeated id, no name, a statChanges that isn't an object or has an empty value, and adds that isn't lists are noted.
  it('notes the slips in a modification', () => {
    const bad = { modifications: [{ id: 'elite', name: 'Elite' }, { id: 'elite', statChanges: { hd: true }, adds: { abilities: 'x', scent: [] } }, { name: 'No id', statChanges: 3 }] };
    expect(monsterOverlayNotes(bad)).toEqual([
      'modifications: "elite" appears twice.',
      'modifications: "elite": needs a name.',
      'modifications: "elite": statChanges.hd should be a number or words.',
      'modifications: "elite": adds.abilities should be a list.',
      'modifications: "elite": adds.scent isn\'t a field in 07 (abilities, nudges); it is kept and not read.',
      'modifications: entry 3 needs an id.',
      'modifications: "No id": statChanges should be { hd?, ac?, morale?, hp?, … }.',
    ]);
  });

  // Purpose: the formatNotes the checker prints includes these notes, so a pack run alone shows them.
  it('reaches the notes the checker prints for one file', () => {
    expect(formatNotes(file({ meta: { id: 'x' } })).some((n) => /no meta.requires/.test(n))).toBe(true);
  });
});

describe('links against the required pack', () => {
  const rules = { name: 'Fen rules', id: 'fen-rules', requires: [], file: { statBlocks: [{ id: 'bog-lurker' }] } };
  const over = (links) => ({ name: 'Fen overlay', id: 'fen-overlay-pack', requires: ['fen-rules'], file: file({ overlays: [overlay({ links })] }) });

  // Purpose: every link whose stat block is in the required pack resolves, and the summary says so.
  it('counts the links that resolve, and names the ones that do not', () => {
    const { notes, summary } = monsterOverlayLibrary([rules, over([{ packId: 'fen-rules', statBlockId: 'bog-lurker', behaviourId: 'lurker-ways' }, { statBlockId: 'reed-hound', behaviourId: 'lurker-ways' }])]);
    expect(summary).toEqual(['Fen overlay: overlay "fen-overlay": 1 of 2 links resolve to a stat block.']);
    expect(notes).toEqual(['Fen overlay: overlays: "fen-overlay": link to stat block "reed-hound", which Fen rules doesn\'t have.']);
  });

  // Purpose: with the required pack's file missing from the run, the link waits (a note), it is not called wrong.
  it('says a link waits when the required pack is not among the files', () => {
    const { notes } = monsterOverlayLibrary([over([{ packId: 'fen-rules', statBlockId: 'bog-lurker', behaviourId: 'lurker-ways' }])]);
    expect(notes).toEqual(['Fen overlay: overlays: "fen-overlay": link to "bog-lurker" waits for pack "fen-rules", which isn\'t among the files checked together.']);
  });

  // Purpose: pack:check on two small invented files prints the overlay links line and keeps exit code 0.
  it('runs end to end on two files in stack order', () => {
    const out = execFileSync('node', ['scripts/check-pack.mjs', 'scripts/fixtures/pack-check-shapes-rules.fixture.json', 'scripts/fixtures/pack-check-shapes-overlay.fixture.json'], { encoding: 'utf8' });
    expect(out).toMatch(/Overlay links:\n {2}- Fen overlay[^\n]*: 1 of 2 links resolve/);
    expect(out).toMatch(/link to stat block "reed-hound"/);
    expect(out).toMatch(/conjures names stat block "ghost-crab"/);
    expect(out).toMatch(/encounterCheck.tableRef names table "gone"/);
    expect(out).toMatch(/settlement.size "town"/);
  });
});
