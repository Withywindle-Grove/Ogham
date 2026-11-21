// Leaving the dungeon and check chances (docs/07 "Exploration"; ruled 2026-10-29, D24). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { addFaces } from './checks.ts';
import { depthModifier, depthWords, exitPrompt, hasRoll, readDungeonExit } from './dungeonExit.ts';
import { resolveRules } from '../library/options.ts';
import { fenRules, plainRules } from './fixtures.ts';

describe('the dungeon-exit rule', () => {
  const rule = readDungeonExit([plainRules, fenRules])!;

  it('reads the shape; a modifier with no value is left out', () => {
    expect(rule).toEqual({
      roll: { save: 'nerve' },
      modifiers: [
        { id: 'map', name: 'Has a map', value: 2 },
        { id: 'known-way', name: 'Knows a safe way out', value: 3 },
      ],
      depth: { per: 2, value: -1 },
      onFailTable: 'lost-below',
      safePaths: 'Short note on using safe paths.',
      who: 'each',
    });
  });

  it('`who` (DG18) is "each" unless the rule says "party"', () => {
    expect(readDungeonExit([{ dungeonExit: { roll: { save: 'nerve' }, who: 'party' } }])?.who).toBe('party');
    expect(readDungeonExit([{ dungeonExit: { roll: { save: 'nerve' }, who: 'everyone' } }])?.who).toBe('each');
  });

  it('depth is "value for every per levels down": {per 2, value −1} gives 0 on level 1, −1 on 2–3, −2 on 4–5', () => {
    expect([1, 2, 3, 4, 5].map((level) => depthModifier(rule, level))).toEqual([0, -1, -1, -2, -2]);
    expect(depthModifier({ ...rule, depth: { per: 1, value: -1 } }, 3)).toBe(-3);
    expect(depthModifier({ ...rule, depth: null }, 9)).toBe(0);
  });

  it('the escape prompt counts the switched-on modifiers and the depth together', () => {
    expect(exitPrompt(rule, 4, ['map', 'unknown'])).toMatchObject({ lines: [{ id: 'map', value: 2 }], depth: -2, total: 0, onFailTable: 'lost-below' });
  });

  it('no rule, an unreadable roll, or its option off: no escape rolls', () => {
    expect(readDungeonExit([plainRules])).toBeNull();
    expect(readDungeonExit([{ dungeonExit: { roll: {} } }])).toBeNull();
    const optional = { dungeonExit: { roll: { check: 'wits' }, onlyWithOption: 'exit:escape' } };
    expect(readDungeonExit([optional], { exit: 'off' })).toBeNull();
    expect(readDungeonExit([optional], { exit: 'escape' })).toMatchObject({ roll: { check: 'wits' }, modifiers: [], depth: null, onFailTable: null });
  });
});

describe('safe paths without a roll (of-5, G-104)', () => {
  // Purpose: a rule with no roll but a safe-paths note still turns Leave the dungeon on, offering safe paths only.
  it("reads a rule with no roll as safe paths only, with the pack's note", () => {
    const rule = readDungeonExit([{ dungeonExit: { safePaths: 'Follow the chalk marks back.' } }])!;
    expect(rule).toEqual({ roll: null, modifiers: [], depth: null, onFailTable: null, safePaths: 'Follow the chalk marks back.', who: 'each' });
    expect(hasRoll(rule)).toBe(false);
  });

  // Purpose: with neither a roll nor a note the rule offers nothing, so there is no button.
  it('a rule with no roll and no note is off', () => {
    expect(readDungeonExit([{ dungeonExit: {} }])).toBeNull();
    expect(readDungeonExit([{ dungeonExit: { roll: null, safePaths: '  ' } }])).toBeNull();
  });

  // Purpose: through the shared reader, a choice can turn the escape roll into safe paths (byOption, `null` fields off).
  it('a byOption choice that removes the roll gives safe paths only; the other choice keeps the roll', () => {
    const rules = {
      dungeonExit: { roll: { save: 'nerve' }, onFail: { table: 'lost-below' }, safePaths: 'Follow the chalk marks back.' },
      byOption: { 'fen-ways-out=safe': { dungeonExit: { roll: null, onFail: null } } },
    };
    const safe = readDungeonExit([resolveRules(rules, { 'fen-ways-out': 'safe' })], { 'fen-ways-out': 'safe' })!;
    expect(safe).toMatchObject({ roll: null, onFailTable: null, safePaths: 'Follow the chalk marks back.' });
    expect(readDungeonExit([resolveRules(rules, { 'fen-ways-out': 'escape' })], { 'fen-ways-out': 'escape' })).toMatchObject({ roll: { save: 'nerve' } });
  });

  // Purpose: the stepper's words count the levels below the first (T3).
  it('says the depth as levels below the first', () => {
    expect(depthWords(0)).toBe('0 levels below the first');
    expect(depthWords(1)).toBe('1 level below the first');
    expect(depthWords(999)).toBe('999 levels below the first');
  });
});

describe('adding faces to a chance', () => {
  it('adds the next faces up, never past the die; takes the highest away; works from nothing', () => {
    expect(addFaces({ die: 'd6', on: [1] }, 2)).toEqual({ die: 'd6', on: [1, 2, 3] });
    expect(addFaces({ die: 'd6', on: [5, 6] }, 1)).toEqual({ die: 'd6', on: [5, 6] });
    expect(addFaces({ die: 'd6', on: [1, 2, 3] }, -2)).toEqual({ die: 'd6', on: [1] });
    expect(addFaces({ die: null, on: [] }, 1)).toEqual({ die: null, on: [1] });
  });
});
