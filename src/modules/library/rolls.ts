// What a roll takes to pass, from the pack (docs/design/rulings/dec-player-screen-2026-11-14.md, pf-20, sv-1, sv-3):
// a rules set may carry `rolls`, beside `naturals` and keyed the same way by roll type (`save`, `abilityCheck` and,
// since tfs-2 of 2026-11-19, `skill`), each `{ "die": "d20", "pass": "atOrOver" | "atOrUnder" }`. The app builds the
// Saves line, the scores' line and the Skills line from it and from nothing else: a rules set without the key for a
// roll type gives no line. Optional and additive: a pack without it reads exactly as before.
//
// Pure, shared by the app and the pack checker (scripts/pack-rolls.mjs). The ruled words live here and only here; a
// screen gets the parts (the die's name and sides for the glyph, the words), never a string glued to a glyph.
/** The roll types `rolls` is keyed by today (pf-20; `skill` by tfs-2, 2026-11-19; others later). */
export const ROLL_TYPES = ['save', 'abilityCheck', 'skill'] as const;
export type RollType = (typeof ROLL_TYPES)[number];

/** What passes: the die's result at or over the number (a save), or at or under it (a score). */
export const ROLL_PASS = ['atOrOver', 'atOrUnder'] as const;
export type RollPass = (typeof ROLL_PASS)[number];

/**
 * The dice the Die glyph can draw (`DieSize` in src/ui/dice.tsx, kept here too so the pack checker and the library
 * don't reach into the UI; a test keeps the two lists the same).
 */
export const ROLL_DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export type RollSides = (typeof ROLL_DICE)[number];

/** One roll type's roll as the pack gives it, read. */
export interface Roll {
  /** The die as the words say it: "d20". */
  die: string;
  /** Its sides, for the glyph. */
  sides: RollSides;
  pass: RollPass;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A die written "d20" (any case, spaces around): its sides when the glyph can draw it, else null. */
export function rollDie(value: unknown): RollSides | null {
  const found = typeof value === 'string' ? /^d(\d+)$/i.exec(value.trim()) : null;
  const sides = found ? Number(found[1]) : NaN;
  return (ROLL_DICE as readonly number[]).includes(sides) ? (sides as RollSides) : null;
}

/** One roll as written (`{ die, pass }`), read; null when either part is one the app doesn't know. */
export function readRoll(value: unknown): Roll | null {
  if (!isRecord(value)) return null;
  const sides = rollDie(value.die);
  const pass = typeof value.pass === 'string' && (ROLL_PASS as readonly string[]).includes(value.pass) ? (value.pass as RollPass) : null;
  return sides && pass ? { die: `d${sides}`, sides, pass } : null;
}

/**
 * The roll in force for a roll type, from the campaign's rules sets as the options leave them (`setting.rulesSets`,
 * lowest first, in the campaign's pack order: `campaign_packs.priority`, the highest on top). Read one roll type at a
 * time (rl-1, Francis 2026-11-15: by loaded-pack priority, per roll type): the highest rules set that carries this
 * roll type decides it, whatever the sets above carry for other types. A form the reader doesn't know (a die it can't
 * draw, a `pass` it doesn't know; pf-28's own forms until they come) gives no line, and never falls through to a set
 * below. Null when no set carries the roll type.
 */
export function rollInForce(rulesSets: readonly Record<string, unknown>[], type: RollType): Roll | null {
  const top = [...rulesSets].reverse().find((rules) => isRecord(rules.rolls) && rules.rolls[type] !== undefined);
  return top && isRecord(top.rolls) ? readRoll(top.rolls[type]) : null;
}

/** A line's parts: the die (its name for the words, its sides for the glyph) and the words. */
export interface RollLine {
  die: string;
  sides: RollSides;
  words: string;
}

/** The ruled words (sv-1, sv-3, pf-20, tfs-2). Nowhere else. */
const passWords = (pass: RollPass) => (pass === 'atOrOver' ? 'or higher succeeds.' : 'or lower succeeds.');
const lineWords = (die: string, what: string, pass: RollPass) => `Roll ${die}: ${what} ${passWords(pass)}`;

const lineOf = (roll: Roll | null, what: string): RollLine | null => (roll ? { die: roll.die, sides: roll.sides, words: lineWords(roll.die, what, roll.pass) } : null);

/** The Saves line (sv-1): "Roll d20: your save's number or higher succeeds."; null when the rules carry no roll for saves. */
export const savesLine = (rulesSets: readonly Record<string, unknown>[]): RollLine | null => lineOf(rollInForce(rulesSets, 'save'), "your save's number");

/** The scores' line (sv-3): "Roll d20: your score or lower succeeds."; null when the rules carry no check against a score. */
export const scoresLine = (rulesSets: readonly Record<string, unknown>[]): RollLine | null => lineOf(rollInForce(rulesSets, 'abilityCheck'), 'your score');

/**
 * The Skills line (tfs-2, 2026-11-19): "Roll d6: target or higher succeeds."; null when the rules carry no roll for
 * skills. Apart from a skill's own `rollMode`, which gives that skill's figure (tfs-3): a pack may carry one without the
 * other.
 */
export const skillsLine = (rulesSets: readonly Record<string, unknown>[]): RollLine | null => lineOf(rollInForce(rulesSets, 'skill'), 'target');

/**
 * A single save's own sheet (sv-1): "Roll d20: 16 or higher succeeds.", carrying that save's number; null when the rules
 * carry no roll for saves, or the number isn't a whole number (a save not worked out, "—").
 */
export function saveOwnLine(rulesSets: readonly Record<string, unknown>[], value: number | string): RollLine | null {
  const n = typeof value === 'number' ? value : /^\s*-?\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) ? lineOf(rollInForce(rulesSets, 'save'), String(n)) : null;
}
