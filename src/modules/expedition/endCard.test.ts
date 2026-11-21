// S19's logic half (docs/plans/dec-9-the-whole-scene.md, row S19; ap-11, mm-8, ic-2, ft-1): the card after an
// expedition ends, as data. No screen here; invented names only.
//   Purposes:
//   1. A party with some hurt and some at full gives one row each, with the hit-points line, the bar's fills and a
//      hurt flag; and "everyone is at full hit points" is false while anyone is hurt.
//   2. The all-full flag is true when nobody is hurt, and false for a party of nobody (no row to be full).
//   3. The bar's fills are exactly hpSegments' for the hit points the line shows.
//   4. A character whose hit points are unset reads "—", never "0 of N", and is not counted hurt.
//   5. The healing rule comes with its source, the first setting pack that isn't homebrew, with or without a homebrew
//      pack in the stack; no rule, no source.
//   6. Who the rest left out is computed from the rest prompt's rows and marks (an ✕), in the prompt's order.
//   7. Nothing in this module imports a component (the screen reads it; it draws nothing).
//   8. The rest's line is "Full rest." as a label, then fullRestWords' own sentence.
import { describe, expect, it } from 'vitest';
import { hpSegments } from '../characters/play.ts';
import { fullRestWords } from '../characters/nightRest.ts';
import { endCardFor, endCardRows, healingWithSource, restLeftOut, restLine } from './endCard.ts';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };

const went = (id: string, name: string, hpCurrent: number | null, hpMax: number | null) => ({ ref: { id }, name, hpCurrent, hpMax });

describe("the end card's rows", () => {
  it('gives a row a character, with the hit points, the bar and who is hurt', () => {
    const card = endCardRows([went('wren', 'Wren', 4, 9), went('ash', 'Ash', 7, 7)]);
    expect(card.rows).toEqual([
      { id: 'wren', name: 'Wren', hpLine: '4 of 9', hp: { now: 4, max: 9 }, fills: hpSegments(4, 9).fills, hurt: true },
      { id: 'ash', name: 'Ash', hpLine: '7 of 7', hp: { now: 7, max: 7 }, fills: hpSegments(7, 7).fills, hurt: false },
    ]);
    expect(card.everyoneFull).toBe(false);
  });

  it('says everyone is at full hit points only when nobody is hurt, and never for nobody', () => {
    expect(endCardRows([went('wren', 'Wren', 9, 9), went('ash', 'Ash', 7, 7)]).everyoneFull).toBe(true);
    expect(endCardRows([]).everyoneFull).toBe(false);
    expect(endCardRows([]).rows).toEqual([]);
  });

  it("draws the bar exactly as hpSegments does, a big maximum included", () => {
    for (const [now, most] of [[0, 5], [3, 12], [14, 30], [61, 250]] as const) {
      expect(endCardRows([went('moss', 'Moss', now, most)]).rows[0]!.fills).toEqual(hpSegments(now, most).fills);
    }
  });

  it('reads "—" for hit points that are unset, never "0 of N", and counts that character as not hurt', () => {
    const card = endCardRows([went('reed', 'Lantern Warden', null, null), went('fen', 'Fen', 5, null)]);
    expect(card.rows.map((r) => r.hpLine)).toEqual(['—', '—']);
    expect(card.rows.every((r) => r.fills.length === 0 && !r.hurt)).toBe(true);
    expect(card.rows.some((r) => /^0 of/.test(r.hpLine))).toBe(false);
    // A maximum with no current number reads full, as today's panel shows it (current ?? maximum).
    const full = endCardRows([went('wren', 'Wren', null, 8)]).rows[0]!;
    expect(full).toMatchObject({ hpLine: '8 of 8', hurt: false, fills: hpSegments(8, 8).fills });
  });
});

// Purpose: the card reads the hit points as numbers (the figure set bold), never by splitting its own words; a
// maximum of 0 reads "0 of 0" with no bar and counts as not hurt (the messy-data case, as today's panel shows it).
describe("the end card's hit points as numbers", () => {
  it('gives the numbers beside the line, none while unset, and keeps a 0 maximum as 0 of 0, not hurt', () => {
    const card = endCardRows([went('wren', 'Wren', 4, 9), went('ash', 'Ash', null, null), went('moss', 'Moss', 0, 0)]);
    expect(card.rows[0]).toMatchObject({ hpLine: '4 of 9', hp: { now: 4, max: 9 } });
    expect(card.rows[1]).toMatchObject({ hpLine: '—', hp: null });
    expect(card.rows[2]).toMatchObject({ hpLine: '0 of 0', hp: { now: 0, max: 0 }, fills: [], hurt: false });
  });
});

describe('the healing rule with its source', () => {
  const rules = [{ healing: 'Rest a night in a safe place and heal a little.' }];
  it('names the first setting pack that is not homebrew, with a homebrew pack in the stack or without', () => {
    const plain = [{ kind: 'setting', shortName: 'Reed rules' }];
    const withHomebrew = [{ kind: 'homebrew', shortName: 'Our table' }, { kind: 'setting', shortName: 'Reed rules' }];
    for (const packs of [plain, withHomebrew]) {
      expect(healingWithSource({ rulesSets: rules, packs })).toEqual({ rule: 'Rest a night in a safe place and heal a little.', source: 'From your setting: Reed rules' });
    }
  });

  it('gives the rule without a source when only homebrew is attached, and nothing when no rule says', () => {
    expect(healingWithSource({ rulesSets: rules, packs: [{ kind: 'homebrew', shortName: 'Our table' }] })).toEqual({ rule: 'Rest a night in a safe place and heal a little.', source: null });
    expect(healingWithSource({ rulesSets: [{}], packs: [{ kind: 'setting', shortName: 'Reed rules' }] })).toBeNull();
    expect(healingWithSource(null)).toBeNull();
  });
});

describe('who the rest left out', () => {
  it("is every row the prompt marked ✕, by name, in the prompt's order, and is never stored", () => {
    const rows = [{ characterId: 'wren' }, { characterId: 'ash' }, { characterId: 'moss' }];
    const names = new Map([['wren', 'Wren'], ['ash', 'Ash'], ['moss', 'Moss']]);
    expect(restLeftOut(rows, { wren: false, ash: true, moss: false }, names)).toEqual(['Wren', 'Moss']);
    expect(restLeftOut(rows, { wren: true }, names)).toEqual([]);
  });

  // Purpose: a left-out character whose name isn't known is dropped from the list, so the line never shows a gap.
  it('leaves out a marked row whose name is not known', () => {
    const rows = [{ characterId: 'wren' }, { characterId: 'ghost' }, { characterId: 'moss' }];
    const names = new Map([['wren', 'Wren'], ['moss', 'Moss']]);
    expect(restLeftOut(rows, { wren: false, ghost: false, moss: false }, names)).toEqual(['Wren', 'Moss']);
  });
});

// Purpose 8 (the screen half): the rest's line is a labelled line, "Full rest." then fullRestWords' own sentence, so
// the card and Start downtime's panel say the same words.
describe("the rest's line", () => {
  it('labels the line "Full rest." and keeps fullRestWords\' words after it', () => {
    expect(restLine([])).toEqual({ label: 'Full rest.', words: 'Rest and day abilities are back.' });
    expect(restLine(['Tam'])).toEqual({ label: 'Full rest.', words: 'Rest and day abilities are back, except for Tam.' });
    expect(restLine(['Tam'], ['Moss'])).toEqual({ label: 'Full rest.', words: "Rest and day abilities are back, except for Tam. Spells didn't come back for Moss." });
    for (const [out, notBack] of [[[], []], [['Tam', 'Ash'], ['Moss']]] as const) {
      const { label, words } = restLine(out, notBack);
      expect(`${label.slice(0, -1)}: ${words.charAt(0).toLowerCase()}${words.slice(1)}`).toBe(fullRestWords(out, notBack));
    }
  });
});

describe("who gets the card", () => {
  // Purpose (S19 follow-up): the card is the GM's alone. A player gets none even with an ended expedition in hand (which
  // no player screen can hold today, so the screen test can't reach it): without the gate this fails.
  it('gives the ended expedition to the GM and nothing to a player, whatever is in hand', () => {
    const ended = { id: 'exp-1' };
    expect(endCardFor(true, ended)).toBe(ended);
    expect(endCardFor(false, ended)).toBeNull();
    expect(endCardFor(true, null)).toBeNull();
    expect(endCardFor(false, null)).toBeNull();
  });
});

describe('SceneTime uses the gate', () => {
  // Purpose (S19 follow-up): the screen draws the end card only for what endCardFor(gm, …) returns; nothing else may
  // build its id, items or props from `ended` (a player screen can't hold one, so no screen test reaches this).
  it('builds the end card only through endCardFor(gm, ended)', () => {
    const source = fs.readFileSync('./src/app/SceneTime.tsx', 'utf8');
    expect(source).toMatch(/const endShown = endCardFor\(gm, ended\);/);
    const start = source.indexOf('const endShown = endCardFor(gm, ended);');
    const end = source.indexOf('// Depart (S5;', start);
    const block = source.slice(start, end);
    expect(block.length).toBeGreaterThan(0);
    // Inside the card's block `ended` is never read again: it all goes through endShown.
    expect(block.replace('endCardFor(gm, ended)', '')).not.toMatch(/\bended\b(?!\s*[:'])/);
  });
});

describe('the module', () => {
  it('imports no component', () => {
    const source = fs.readFileSync('./src/modules/expedition/endCard.ts', 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) {
      expect(path).not.toMatch(/\.tsx$|\/app\/|\/ui\/|^react/);
    }
  });
});
