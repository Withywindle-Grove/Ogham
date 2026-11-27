import { describe, expect, it } from 'vitest';
import { limitedAbilities, powersWithUses, preparedByLevel, preparedProblem, readPlay, shownAbove, slotsOf, spellLine, spellListOf, traitsWithUsesOf } from './playState.ts';

// Invented content only (hard rule 2).
describe('what a character has prepared and spent (Player screen redesign, ruled 2026-10-26)', () => {
  it('reads the stored row, dropping anything malformed; nothing stored reads as empty', () => {
    expect(readPlay(null)).toEqual({ pins: [], prepared: [], usesSpent: {}, acOverride: null, formId: null, chosen: null, spellsCast: {}, restedOnce: false });
    expect(
      readPlay({
        prepared: [{ spell: 'glimmer', level: 1 }, { spell: 3, level: 1 }, { spell: 'mist', level: 1.5 }],
        uses_spent: { 'Ember ward': 2, Broken: 'x', Zero: 0 },
        ac_override: 7,
        form_id: 'dusk-phase',
      }),
    ).toEqual({ pins: [], prepared: [{ spell: 'glimmer', level: 1 }], usesSpent: { 'Ember ward': 2 }, acOverride: 7, formId: 'dusk-phase', chosen: null, spellsCast: {}, restedOnce: true });
    // The class form (eq-8): blank or odd reads as not switched.
    expect(readPlay({ form_id: ' ' }).formId).toBeNull();
    expect(readPlay({ form_id: 4 }).formId).toBeNull();
    // An AC set by hand that isn't a whole number reads as not set.
    expect(readPlay({ ac_override: 7.5 }).acOverride).toBeNull();
    expect(readPlay({ ac_override: -3 }).acOverride).toBe(-3);
    // Rested once (fsr-4): only a row that says false, or no row at all, reads as not rested; a row read without the
    // column counts as rested, as every row made before it did (fsr-13).
    expect(readPlay({ rested_once: false }).restedOnce).toBe(false);
    expect(readPlay({ rested_once: true }).restedOnce).toBe(true);
    expect(readPlay({}).restedOnce).toBe(true);
  });

  it('slots come from the class progression; the class list by spell level', () => {
    expect(slotsOf({ spellSlots: [2, 1, 0] })).toEqual([2, 1, 0]);
    expect(slotsOf({})).toEqual([]);
    const lists = [{ packEntryId: 'warden-list', data: { levels: [{ level: 1, spells: ['glimmer', 'mist'] }, { level: 2, spells: ['beacon'] }] } }];
    expect(spellListOf({ spellcasting: { listId: 'warden-list' } }, lists)).toEqual(
      new Map([
        [1, ['glimmer', 'mist']],
        [2, ['beacon']],
      ]),
    );
    expect(spellListOf({}, lists).size).toBe(0);
  });

  it('prepared spells must fit the slots, a spell prepared twice taking two', () => {
    expect(preparedProblem([{ spell: 'glimmer', level: 1 }, { spell: 'glimmer', level: 1 }], [2])).toBeNull();
    expect(preparedProblem([{ spell: 'glimmer', level: 1 }, { spell: 'mist', level: 1 }], [1])).toBe('Level 1 has 1 slot; take one off first.');
    expect(preparedProblem([{ spell: 'beacon', level: 2 }], [2])).toBe('There are no level 2 slots yet.');
  });

  it("a spell's line: name, duration worked out at this level, range", () => {
    expect(spellLine('Glimmer', { duration: { formula: '2 + level', unit: 'turn' }, range: '30 ft' }, 3)).toBe('Glimmer, 5 turns, 30 ft');
    expect(spellLine('Mist', { duration: { formula: '1', unit: 'round' } }, 3)).toBe('Mist, 1 round');
    expect(spellLine('Beacon', { duration: 'Until dawn', range: 'Touch' }, 1)).toBe('Beacon, Until dawn, Touch');
    expect(spellLine('Hush', {}, 1)).toBe('Hush');
  });

  it('prepared spells by level, highest first', () => {
    expect(preparedByLevel([{ spell: 'glimmer', level: 1 }, { spell: 'beacon', level: 2 }, { spell: 'mist', level: 1 }])).toEqual([
      { level: 2, spells: ['beacon'] },
      { level: 1, spells: ['glimmer', 'mist'] },
    ]);
  });

  it('limited-use powers: the class and race abilities that give uses, from their level', () => {
    const klass = {
      abilities: [
        { name: 'Ember ward', uses: 2, refill: 'day', note: 'Keeps a flame alight in the rain.' },
        { name: 'Lantern lore', note: 'No uses: always on.' },
        { name: 'Beacon call', fromLevel: 5, uses: 1 },
        { name: 'Long watch', uses: { byLevel: [{ level: 1, count: 1 }, { level: 3, count: 2 }], per: 'rest' } },
      ],
    };
    const race = { abilities: [{ name: 'Reed step', uses: { count: 1, per: 'adventure' } }] };
    expect(limitedAbilities(klass, race, 3)).toEqual([
      { name: 'Ember ward', uses: 2, refill: 'day', note: 'Keeps a flame alight in the rain.', from: 'class' },
      { name: 'Long watch', uses: 2, refill: 'rest', note: '', from: 'class' },
      { name: 'Reed step', uses: 1, refill: 'adventure', note: '', from: 'race' },
    ]);
    expect(limitedAbilities(null, null, 3)).toEqual([]);
  });
});

describe('the foot leaves out only what the Traits rows show (dec-13 C12; the automatic review of #1021)', () => {
  // Invented names (hard rule 2).
  const klass = { abilities: [{ name: 'Steady flame', uses: 1, per: 'day' }, { name: 'Late lamp', uses: 2, per: 'day', fromLevel: 5 }] };
  const above = traitsWithUsesOf(klass, null, 3, powersWithUses([{ name: 'Reed whistle', note: '', uses: { count: 2, per: 'rest' } }, { name: 'Bog sense', note: '' }]));

  // Purpose: the rows the foot leaves out are always a subset of the Traits rows with uses, so a trait never vanishes
  // from both; a row with uses whose name has no Traits row (a later level's, here) stays in the foot.
  it('leaves out a row with uses only when a Traits row of its name is above', () => {
    const rows = [
      { key: 'trait:steady', name: 'Steady flame', uses: 1 },
      { key: 'trait:late', name: 'Late lamp', uses: 2 },
      { key: 'trait-power:reed', name: 'Reed whistle', uses: 2 },
      { key: 'trait-power:sense', name: 'Bog sense', uses: 0 },
      { key: 'xp-bonus', name: 'Experience bonus', uses: 0 },
    ];
    const hidden = shownAbove(rows, above);
    expect([...hidden]).toEqual(['trait:steady', 'trait-power:reed']);
    const aboveNames = new Set(above.map((a) => a.name));
    for (const key of hidden) expect(aboveNames.has(rows.find((r) => r.key === key)!.name)).toBe(true);
  });

  // Purpose: the picked entries' powers with uses read as Traits rows (from "trait"); one without uses is no row.
  it('reads the picked powers with uses as Traits rows', () => {
    expect(above.map((a) => [a.name, a.from])).toEqual([
      ['Steady flame', 'class'],
      ['Reed whistle', 'trait'],
    ]);
  });
});
