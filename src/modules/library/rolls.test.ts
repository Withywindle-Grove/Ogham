// What a roll takes to pass, from a rules set's `rolls` (pf-20, sv-1, sv-3). Invented rules sets and saves only
// ("Save vs river", the Reed rules), invented numbers.
import { describe, expect, it } from 'vitest';
import { isDieSize } from '../../ui/dice.tsx';
import { ROLL_DICE, readRoll, rollDie, rollInForce, saveOwnLine, savesLine, scoresLine } from './rolls.ts';
import { ROLL_TYPES, skillsLine } from './rolls.ts';

/** An invented rules set, with `rolls` when given. */
const reed = (rolls?: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ id: 'reed-rules', name: 'Reed rules', ...(rolls !== undefined ? { rolls } : {}), ...extra });
const over = { die: 'd20', pass: 'atOrOver' };
const under = { die: 'd20', pass: 'atOrUnder' };

describe('the Saves line (sv-1)', () => {
  // Purpose: a rules set with rolls.save of d20, at or over, gives the saves line "…or higher succeeds." with the d20.
  it('d20 at or over: "…your save\'s number or higher succeeds." with the d20', () => {
    expect(savesLine([reed({ save: over })])).toEqual({ die: 'd20', sides: 20, words: "Roll d20: your save's number or higher succeeds." });
  });

  // Purpose: at or under gives "…or lower succeeds.".
  it('at or under: "…or lower succeeds."', () => {
    expect(savesLine([reed({ save: under })])).toEqual({ die: 'd20', sides: 20, words: "Roll d20: your save's number or lower succeeds." });
  });

  // Purpose: a save's own sheet line carries that save's number, as a number or as the sheet's text.
  it("a save's own sheet carries its number", () => {
    expect(saveOwnLine([reed({ save: over })], 16)).toEqual({ die: 'd20', sides: 20, words: 'Roll d20: 16 or higher succeeds.' });
    expect(saveOwnLine([reed({ save: under })], '12')?.words).toBe('Roll d20: 12 or lower succeeds.');
    // A save not worked out ("—") or no roll for saves: no line.
    expect(saveOwnLine([reed({ save: over })], '—')).toBeNull();
    expect(saveOwnLine([reed()], 16)).toBeNull();
  });
});

describe("the scores' line (sv-3)", () => {
  // Purpose: the score's line follows rolls.abilityCheck the same way, and is absent when the key is.
  it('follows rolls.abilityCheck, and is absent without it', () => {
    expect(scoresLine([reed({ abilityCheck: under })])).toEqual({ die: 'd20', sides: 20, words: 'Roll d20: your score or lower succeeds.' });
    expect(scoresLine([reed({ abilityCheck: over })])?.words).toBe('Roll d20: your score or higher succeeds.');
    expect(scoresLine([reed({ save: over })])).toBeNull();
  });
});

describe('no rolls, and the stack', () => {
  // Purpose: a rules set with no rolls gives no line for either; nor do no rules sets at all.
  it('no rolls: no line for either', () => {
    expect([savesLine([reed()]), scoresLine([reed()])]).toEqual([null, null]);
    expect([savesLine([]), scoresLine([])]).toEqual([null, null]);
  });

  // Purpose (rl-1, Francis 2026-11-15: by loaded-pack priority, per roll type): each roll type is read from the highest
  // rules set that carries that roll type (setting.rulesSets is lowest first), whatever the sets above carry for other
  // types. A higher rules set without rolls doesn't hide a lower one's.
  it('each roll type comes from the highest rules set that carries it', () => {
    const lower = reed({ save: under, abilityCheck: under });
    const higher = { id: 'fen-rules', rolls: { save: over } };
    expect(savesLine([lower, higher])?.words).toBe("Roll d20: your save's number or higher succeeds.");
    expect(savesLine([higher, lower])?.words).toBe("Roll d20: your save's number or lower succeeds.");
    // The higher one gives no abilityCheck, so the lower one's check stands.
    expect(scoresLine([lower, higher])?.words).toBe('Roll d20: your score or lower succeeds.');
    expect(scoresLine([higher, lower])?.words).toBe('Roll d20: your score or lower succeeds.');
    // A higher rules set without rolls leaves the lower one's.
    expect(savesLine([lower, { id: 'moss-rules' }])?.words).toBe("Roll d20: your save's number or lower succeeds.");
  });

  // Purpose: a set alone that carries only the save roll shows no scores line (the heading stands alone).
  it('a rules set with only the save roll gives no scores line', () => {
    expect(scoresLine([{ id: 'fen-rules', rolls: { save: over } }])).toBeNull();
  });

  // Purpose: a roll type in a form the reader doesn't know, on the highest set that carries it, gives no line; it never
  // falls through to a lower set's form (pf-28's own forms, until the reader learns them).
  it('an unknown form on top gives no line and does not fall through', () => {
    const lower = reed({ abilityCheck: under });
    const higher = { id: 'fen-rules', rolls: { abilityCheck: { die: 'd6', pass: 'plusModifierAgainst4' } } };
    expect(scoresLine([lower, higher])).toBeNull();
    expect(rollInForce([lower, higher], 'abilityCheck')).toBeNull();
  });
});

describe('reading a roll', () => {
  // Purpose: a die the app can't draw, a pass it doesn't know, or a shape that isn't a roll reads as no roll, never thrown.
  it('reads nothing it cannot draw or does not know', () => {
    expect(readRoll({ die: 'd7', pass: 'atOrOver' })).toBeNull();
    expect(readRoll({ die: '2d6', pass: 'atOrOver' })).toBeNull();
    expect(readRoll({ die: 'd20', pass: 'over' })).toBeNull();
    expect(readRoll('d20')).toBeNull();
    expect(rollInForce([reed('d20')], 'save')).toBeNull();
    expect(readRoll({ die: ' D100 ', pass: 'atOrUnder' })).toEqual({ die: 'd100', sides: 100, pass: 'atOrUnder' });
  });

  // Purpose: the dice the reader accepts are exactly the dice the Die glyph can draw.
  it('accepts exactly the dice the Die glyph draws', () => {
    for (let n = 0; n <= 200; n += 1) expect(rollDie(`d${n}`) !== null).toBe(isDieSize(n));
    expect(ROLL_DICE.every((n) => isDieSize(n))).toBe(true);
  });
});

// The Skills line (tfs-2, 2026-11-19; plan test-feedback-2026-11-19 rows C13a and C13): a third roll type, `skill`, in
// pf-20's shape, read by the same rule as the others (rl-1). Invented rules sets only: no pack carries it yet (E6).
describe('the Skills line (tfs-2)', () => {
  const d6Over = { die: 'd6', pass: 'atOrOver' };

  // Purpose: a rules set with `rolls.skill` gives the Skills heading its line, "Roll d6: target or higher succeeds.",
  // with the d6 for the glyph; at or under reads "or lower".
  it('reads rolls.skill: "Roll d6: target or higher succeeds." with the d6', () => {
    expect(skillsLine([reed({ skill: d6Over })])).toEqual({ die: 'd6', sides: 6, words: 'Roll d6: target or higher succeeds.' });
    expect(skillsLine([reed({ skill: { die: 'd100', pass: 'atOrUnder' } })])?.words).toBe('Roll d100: target or lower succeeds.');
  });

  // Purpose: a rules set without `rolls.skill` (none, or only the other roll types) gives no line: the heading alone.
  it('no rolls.skill: no line', () => {
    expect(skillsLine([reed()])).toBeNull();
    expect(skillsLine([reed({ save: over, abilityCheck: under })])).toBeNull();
    expect(skillsLine([])).toBeNull();
  });

  // Purpose (rl-1): a higher rules set's `save` does not hide a lower set's `skill`; a higher set's own `skill` wins;
  // a form the reader doesn't know on top gives no line and doesn't fall through.
  it("a higher set's save does not hide a lower set's skill", () => {
    const lower = reed({ skill: d6Over });
    const higher = { id: 'fen-rules', rolls: { save: over } };
    expect(skillsLine([lower, higher])?.words).toBe('Roll d6: target or higher succeeds.');
    expect(skillsLine([lower, { id: 'fen-rules', rolls: { skill: { die: 'd8', pass: 'atOrUnder' } } }])?.words).toBe('Roll d8: target or lower succeeds.');
    expect(skillsLine([lower, { id: 'fen-rules', rolls: { skill: { die: 'd6', pass: 'sideways' } } }])).toBeNull();
  });

  // Purpose: the pack checker checks `skill` as it checks the others (it walks ROLL_TYPES).
  it('is one of the roll types the checker walks', () => {
    expect(ROLL_TYPES).toEqual(['save', 'abilityCheck', 'skill']);
  });
});
