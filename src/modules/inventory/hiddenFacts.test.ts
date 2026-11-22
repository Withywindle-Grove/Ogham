// The fact list (K22b; ruling k22-4, picks 6 and 9). Invented items: Wren's Bronze ring, the Hooded lantern, an Ash wand.
import { describe, expect, it } from 'vitest';
import { hiddenFacts, type LineFacts } from './hiddenFacts.ts';

const RING = {
  category: 'ring',
  slot: 'worn',
  appearsAs: 'Bronze ring',
  bonus: '+1 to saves',
  cursed: true,
  notes: 'The drowned want it back.',
  gmOnly: ['bonus', 'cursed', 'notes'],
};
const LAMP = {
  category: 'magic-light',
  bonus: '+1 to saves against fear',
  properties: [
    { name: 'Burns without oil' },
    { name: 'Shows what lies under water', note: 'within ten paces' },
    { name: 'The drowned can see its bearer' },
  ],
  cursed: true,
  charges: { initial: '2d6' },
  fields: { 'Maker’s mark': 'Three waves under a bell', Glass: 'Sea-green' },
  gmOnly: ['bonus', 'cursed', 'fields.Maker’s mark'],
};
const face = (over: Partial<LineFacts> = {}): LineFacts => ({ identified: false, revealedFields: [], details: { slot: 'worn' }, chargesHidden: false, category: 'ring', ...over });

describe('the facts still hidden on an item', () => {
  // Purpose: the untold ring lists "That it's magic", "Its true name", "Its bonus" and "That it's cursed", in that
  // order, and its GM notes are never a fact.
  it('lists the ring’s four facts in order, and never its GM notes', () => {
    const facts = hiddenFacts(face(), RING, 'Ring of the Drowned Bell');
    expect(facts.map((f) => f.label)).toEqual(['That it’s magic', 'Its true name', 'Its bonus', 'That it’s cursed']);
    expect(facts.map((f) => f.id)).toEqual(['magic', 'name', 'bonus', 'cursed']);
    expect(facts[1]!.detail).toBe('Ring of the Drowned Bell');
    expect(facts[2]!.detail).toBe('+1 to saves');
    expect(JSON.stringify(facts)).not.toContain('drowned want');
  });

  // Purpose: the lantern gives nine rows: one per power, its hidden charges, and its labelled hidden field under its own
  // label (a field the setting leaves visible is no fact).
  it('lists the lantern’s nine facts: one per power, and the labelled field under its own label', () => {
    const facts = hiddenFacts(face({ chargesHidden: true, category: 'magic-light', details: { fields: { Glass: 'Sea-green' } } }), LAMP, 'The Old Lantern');
    expect(facts.map((f) => f.label)).toEqual([
      'That it’s magic',
      'Its true name',
      'Its bonus',
      'A power',
      'A power',
      'A power',
      'That it’s cursed',
      'Its charges',
      'Maker’s mark',
    ]);
    expect(facts.map((f) => f.id).slice(3, 6)).toEqual(['power:0', 'power:1', 'power:2']);
    expect(facts[4]!.detail).toBe('Shows what lies under water: within ten paces');
    expect(facts[8]).toEqual({ id: 'fields.Maker’s mark', label: 'Maker’s mark', detail: 'Three waves under a bell' });
  });

  // Purpose: a gmOnly bonus and a weapon's magic bonus are one fact, "Its bonus", not two.
  it('merges a gmOnly bonus and a weapon’s magic bonus into one "Its bonus"', () => {
    const blade = { category: 'weapon', bonus: '+1, +3 against bog lurkers', weapon: { damage: '1d8', magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }] }, gmOnly: ['bonus'] };
    const facts = hiddenFacts(face({ category: 'weapon', details: { weapon: { damage: '1d8' } } }), blade, 'Fenblade');
    expect(facts.filter((f) => f.label === 'Its bonus')).toEqual([{ id: 'bonus', label: 'Its bonus', detail: '+1, +3 against bog lurkers' }]);
  });

  // Purpose: a plain wand whose setting hides its charges lists "Its charges" alone, with no "That it's magic" (⚑ 6:
  // only a magic category, or an item with a bonus or powers, is magic).
  it('gives a plain wand with hidden charges "Its charges" alone', () => {
    const wand = { category: 'wand', charges: { initial: '1d6' } };
    expect(hiddenFacts({ identified: true, revealedFields: [], details: { charges: { initial: '1d6' } }, chargesHidden: true, category: 'wand' }, wand, 'Ash wand')).toEqual([
      { id: 'charges', label: 'Its charges', detail: '' },
    ]);
  });

  // Purpose: a fact told is no longer listed: the curse on the line, "magic" in what was told, the name once identified.
  it('leaves out what was told', () => {
    const told = face({ details: { slot: 'worn', cursed: true }, revealedFields: ['magic', 'cursed'] });
    expect(hiddenFacts(told, RING, 'Ring of the Drowned Bell').map((f) => f.id)).toEqual(['name', 'bonus']);
    const named = face({ identified: true, details: { slot: 'worn', cursed: true, bonus: '+1 to saves' }, revealedFields: ['magic', 'name', 'cursed', 'bonus'] });
    expect(hiddenFacts(named, RING, 'Ring of the Drowned Bell')).toEqual([]);
  });

  // Purpose: with its entry gone, only the line's own hidden charges can be told.
  it('with the entry gone, lists only the line’s hidden charges', () => {
    expect(hiddenFacts({ identified: true, revealedFields: [], details: {}, chargesHidden: true, category: 'wand' }, null).map((f) => f.id)).toEqual(['charges']);
  });
});
