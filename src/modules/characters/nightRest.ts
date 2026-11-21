// The GM's rest prompt, "A night's rest", as data (December step 8, piece D; docs/plans/dec-8-magic-first-cut.md;
// mp-5, M7-5; mockup magic/06-prepare-and-rest, the rest prompt, approved 2026-11-10). Pure: built on the view-models'
// restRows (who is listed, what a ✓ does) and piece A's afterRest, never a second copy of them. No database here: the
// app's NightRest.tsx loads the characters and applies what `restApply` returns through the commands.
//   restMarksStart  every mark starts on ✓ (the lead's answer 6, 2026-11-14)
//   restRowPowers   the line under a row's switch: its once-a-rest powers
//   restApply       what Apply rest changes: each ✓ caster's spells, and the uses that come back
//   fullRestWords   the summary's line after it, naming who was left out (mm-8, the lead, 2026-11-14)
import { afterRest } from './magicState.ts';
import { restRows, type RestCharacter, type RestRow } from './magicView.ts';
import type { PreparedSpell } from './playState.ts';

/** ✓ (true: magic or uses back) or ✕ (false), by character id. */
export type RestMarks = Record<string, boolean>;

/** Every listed character starts on ✓; the GM taps to switch (answer 6: a broken night needs the night's events). */
export function restMarksStart(rows: readonly RestRow[]): RestMarks {
  return Object.fromEntries(rows.map((r) => [r.characterId, true]));
}

/** How a power's uses read on its line: "once a rest", "2 a rest" (as the level line's "2 a day"). */
const usesWords = (uses: number) => (uses === 1 ? 'once a rest' : `${uses} a rest`);

/**
 * The line under a row's switch: its once-a-rest powers ("Bird friend, once a rest. Lantern ward, 2 a rest"), empty for
 * a caster with none. The switch itself carries the state (ds-1c, the lead on #790): no "Magic back" or "Slept the
 * night" words.
 */
export function restRowPowers(row: RestRow): string {
  return row.usesBack.map((p) => `${p.name}, ${usesWords(p.uses)}`).join('. ');
}

/** One caster's spells after the rest: the chosen set (or today's) ready, nothing chosen anew, no casts. */
export interface SpellsBack {
  characterId: string;
  ready: PreparedSpell[];
}

/** What Apply rest changes. */
export interface RestApplied {
  /** Each caster on ✓ whose spells change (one with nothing ready, chosen or cast is left out: nothing to log). */
  spells: SpellsBack[];
  /**
   * The abilities whose uses come back, by character (the full rest's `refills`): `per: rest` for those on ✓ only;
   * `per: day` for everyone when `newDay` (End expedition's full rest, D23). Characters with none are left out.
   */
  refills: Record<string, string[]>;
}

const perOf = (refill: string) => refill.trim().toLowerCase();

/**
 * What Apply rest does (mp-5): each caster on ✓ gets the chosen spells ready and the casts cleared (afterRest); each
 * character on ✓ gets its once-a-rest uses back; with `newDay`, everyone's once-a-day uses come back too. A character
 * the prompt doesn't list (no magic, no once-a-rest power) still gets its day uses with `newDay`.
 */
export function restApply(characters: readonly RestCharacter[], marks: RestMarks, newDay: boolean): RestApplied {
  const rows = new Map(restRows(characters).map((r) => [r.characterId, r]));
  const spells: SpellsBack[] = [];
  const refills: Record<string, string[]> = {};
  for (const c of characters) {
    const row = rows.get(c.id);
    const on = row !== undefined && marks[c.id] !== false;
    if (row?.caster && on) {
      const after = afterRest(c.play);
      const changes = c.play.chosen !== null || Object.keys(c.play.spellsCast).length > 0;
      if (changes) spells.push({ characterId: c.id, ready: after.prepared });
    }
    const names = c.powers.filter((p) => (perOf(p.refill) === 'rest' && on) || (perOf(p.refill) === 'day' && newDay)).map((p) => p.name);
    if (names.length > 0) refills[c.id] = [...new Set(names)];
  }
  return { spells, refills };
}

/** Names as a list in words: "Wren", "Wren and Ash", "Wren, Ash and Tam". */
const namesWords = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * The full rest's line in the summary (mm-8): "Full rest: rest and day abilities are back." with everyone on ✓;
 * otherwise it names who was left out: "…, except for Wren and Ash." A caster whose spells couldn't be set (the full
 * rest went through, their own change was refused) is named after it: "Spells didn't come back for Ash."
 */
export function fullRestWords(leftOut: readonly string[], notBack: readonly string[] = []): string {
  const rest = leftOut.length === 0 ? 'Full rest: rest and day abilities are back.' : `Full rest: rest and day abilities are back, except for ${namesWords(leftOut)}.`;
  return notBack.length === 0 ? rest : `${rest} Spells didn't come back for ${namesWords(notBack)}.`;
}
