// A save modifier read from a kindred's field alone (pf-21, docs/design/rulings/dec-player-screen-2026-11-14.md): a rules
// set's `saveModifiers` entry may give its `value` as { "raceField": "<field>" }, the number in that field of the
// character's kindred. Shown beside the saves, never added in (07, saveModifiers). Invented names and figures.
import { describe, expect, it } from 'vitest';
import { explainFigure, type Explaining } from '../characters/explain.ts';
import { ruleFills, showFilled } from './fills.ts';

const rules = {
  saveModifiers: [
    { id: 'vs-hexes', name: 'vs hexes', value: { raceField: 'hexWard' } },
    { id: 'spell-ward', name: 'Spell ward', value: { from: 'LORE', plusRaceField: 'spellWard' } },
    { id: 'lore-magic', name: 'Lore vs magic', value: { fill: 'abilityModifiers.LORE.saveBonus' } },
  ],
};
const marshBorn = { id: 'marsh-born', name: 'Marsh-born', hexWard: 2, spellWard: 1 };
const loreRow = { 'abilityModifiers.LORE': { saveBonus: 1 } };
const fillsFor = (race: Record<string, unknown> | null, filled: Record<string, unknown> = loreRow) =>
  ruleFills([rules], { klass: null, race }, filled as Parameters<typeof ruleFills>[2]);

describe('a save modifier from a kindred’s field alone (pf-21)', () => {
  // Purpose: a character whose kindred carries the field with a number sees the modifier beside the save, with that
  // number and its sign (on the sheet a minus shows, and the breakdown says "+2 from Marsh-born").
  it('gives the kindred’s number, with its sign', () => {
    expect(fillsFor(marshBorn)['saveModifiers.vs-hexes']).toBe(2);
    expect(fillsFor({ ...marshBorn, hexWard: -1 })['saveModifiers.vs-hexes']).toBe(-1);
    expect(showFilled(fillsFor({ ...marshBorn, hexWard: -1 })['saveModifiers.vs-hexes'] as number)).toBe('−1');
    const input: Explaining = { level: 1, filled: { 'saveModifiers.vs-hexes': 2 }, klass: null, klassName: null, race: marshBorn, raceName: 'Marsh-born', xpTable: null, abilityLabel: (k) => k };
    const ctx = { rulesSets: [rules], scores: {}, classRef: null, raceRef: 'marsh-born', notes: {}, label: (n: string) => (n === 'saveModifiers.vs-hexes' ? 'vs hexes' : n) };
    expect(explainFigure('saveModifiers.vs-hexes', input, ctx)).toEqual(['+2 from Marsh-born.', 'vs hexes 2 in all.']);
  });

  // Purpose: a character whose kindred lacks the field, has nought there, or has no whole number there sees no such line.
  it('gives no line without the field, with nought, or with a figure that isn’t whole', () => {
    expect(fillsFor({ id: 'bog-folk', name: 'Bog folk' })).not.toHaveProperty(['saveModifiers.vs-hexes']);
    expect(fillsFor({ ...marshBorn, hexWard: 0 })).not.toHaveProperty(['saveModifiers.vs-hexes']);
    expect(fillsFor({ ...marshBorn, hexWard: 1.5 })).not.toHaveProperty(['saveModifiers.vs-hexes']);
    expect(fillsFor({ ...marshBorn, hexWard: 'two' })).not.toHaveProperty(['saveModifiers.vs-hexes']);
    expect(fillsFor(null)).not.toHaveProperty(['saveModifiers.vs-hexes']);
  });

  // Purpose: the save's own number is the same with and without the modifier: the reader gives no save a number.
  it('leaves the save’s own number alone', () => {
    const filled = { ...loreRow, 'saves.mire': 12 };
    const out = fillsFor(marshBorn, filled);
    expect(Object.keys(out).filter((k) => k.startsWith('saves.'))).toEqual([]);
    expect({ ...filled, ...out }['saves.mire']).toBe(12);
    const without = ruleFills([{ saveModifiers: [] }], { klass: null, race: marshBorn }, filled as Parameters<typeof ruleFills>[2]);
    expect({ ...filled, ...without }['saves.mire']).toBe(12);
  });

  // Purpose: the two shapes read today still give what they gave beside the new one.
  it('keeps the two older shapes as they were', () => {
    const out = fillsFor(marshBorn);
    expect(out['saveModifiers.spell-ward']).toBe(2);
    expect(out['saveModifiers.lore-magic']).toBe(1);
  });
});

describe('a value carrying two shapes (VB1 nit 1)', () => {
  // Purpose: the breakdown explains the shape the reader filled from: fill, then raceField, then from, so the sheet and
  // its breakdown never disagree.
  it('explains the shape the reader took', () => {
    const both = { saveModifiers: [{ id: 'vs-hexes', name: 'vs hexes', value: { from: 'LORE', raceField: 'hexWard' } }] };
    const filled = ruleFills([both], { klass: null, race: marshBorn }, loreRow as Parameters<typeof ruleFills>[2]);
    expect(filled['saveModifiers.vs-hexes']).toBe(2);
    const input: Explaining = { level: 1, filled: { ...loreRow, 'saveModifiers.vs-hexes': 2 }, klass: null, klassName: null, race: marshBorn, raceName: 'Marsh-born', xpTable: null, abilityLabel: (k) => k };
    const ctx = { rulesSets: [both], scores: { LORE: 13 }, classRef: null, raceRef: 'marsh-born', notes: {}, label: (n: string) => (n === 'saveModifiers.vs-hexes' ? 'vs hexes' : n) };
    expect(explainFigure('saveModifiers.vs-hexes', input, ctx)).toEqual(['+2 from Marsh-born.', 'vs hexes 2 in all.']);
    const fillFirst = { saveModifiers: [{ id: 'vs-hexes', name: 'vs hexes', value: { fill: 'abilityModifiers.LORE.saveBonus', raceField: 'hexWard' } }] };
    expect(ruleFills([fillFirst], { klass: null, race: marshBorn }, loreRow as Parameters<typeof ruleFills>[2])['saveModifiers.vs-hexes']).toBe(1);
    expect(explainFigure('saveModifiers.vs-hexes', { ...input, filled: { ...loreRow, 'saveModifiers.vs-hexes': 1 } }, { ...ctx, rulesSets: [fillFirst] })).toEqual(['vs hexes 1: the same as abilityModifiers.LORE.saveBonus.']);
  });
});
