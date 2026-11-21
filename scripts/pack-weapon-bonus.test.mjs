// npm run pack:check's notes on a weapon's magic bonus (mw-1, mw-2, ruled 2026-11-05; scripts/pack-weapon-bonus.mjs).
// Warnings only; the ruled shapes pass. Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { bonusInText, weaponBonusNotes } from './pack-weapon-bonus.mjs';

const weapon = (id, block, more = {}) => ({ id, name: id, slot: 'hand', weapon: { damage: 'd6', ...block }, ...more });
const bonusText = (Bonus) => ({ fields: { Bonus } });

describe('the bonus a text gives', () => {
  // Purpose: the text's bonus is its first signed whole number, a plus or a minus (the book's dash too), never one
  // against a kind of foe; text with no such number gives none.
  it('reads the first signed number that is not against a kind', () => {
    expect(bonusInText('+1 to hit and damage; +3 vs bog lurkers')).toBe(1);
    expect(bonusInText('−2 to hit and damage (cursed)')).toBe(-2);
    expect(bonusInText('-1')).toBe(-1);
    expect(bonusInText('+3 against reed hags')).toBe(null);
    expect(bonusInText('Hums near water')).toBe(null);
    expect(bonusInText('Damage d6-1')).toBe(null);
    expect(bonusInText(undefined)).toBe(null);
  });
});

describe('the bonus text and weapon.magicBonus (mw-1)', () => {
  // Purpose: text and number that agree pass, including a weapon with an against-a-kind bonus and one with no text.
  it('passes when they agree', () => {
    const items = [
      weapon('Fenblade', { magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }] }, bonusText('+1 to hit and damage; +3 vs bog lurkers')),
      weapon('Sulk knife', { magicBonus: -1 }, bonusText('−1 to hit and damage')),
      weapon('Mire spear', { magicBonus: 2 }),
      weapon('Reed staff', {}, bonusText('Glows in the dark')),
    ];
    expect(weaponBonusNotes({ items })).toEqual([]);
  });

  // Purpose: text and number that disagree are warned, and text with a bonus but no number asks for the number.
  it('warns when they disagree or the number is missing', () => {
    const items = [weapon('Mirebrand', { magicBonus: 1 }, bonusText('+2 to hit and damage')), weapon('Grudge hook', {}, bonusText('-1 (cursed)'))];
    expect(weaponBonusNotes({ items })).toEqual([
      'items: "Mirebrand": the bonus text says +2 ("+2 to hit and damage") but weapon.magicBonus is +1; make them agree (mw-1).',
      'items: "Grudge hook": the bonus text says -1 ("-1 (cursed)") but there is no weapon.magicBonus; give "magicBonus": -1 in its weapon block (mw-1).',
    ]);
  });

  // Purpose: a magicBonus that isn't a whole number is warned (mw-1 says whole, negative when cursed).
  it('warns on a magicBonus that is not whole', () => {
    expect(weaponBonusNotes({ items: [weapon('Wobble blade', { magicBonus: '+1' })] })).toEqual(['items: "Wobble blade": weapon.magicBonus should be a whole number (negative when cursed), not "+1".']);
  });

  // Purpose: only weapons are compared: armour's "+1 AC" text is armour's business.
  it('leaves armour text alone', () => {
    expect(weaponBonusNotes({ items: [{ id: 'gleam-shield', slot: 'shield', armour: { acBonus: 1, magicBonus: 1 }, fields: { Bonus: '+1 AC' } }] })).toEqual([]);
  });
});

describe('a top-level bonus (mw-1)', () => {
  // Purpose: a stray top-level bonus key on an item is warned, whatever its value.
  it('warns on a stray bonus key', () => {
    expect(weaponBonusNotes({ items: [weapon('Heron spear', { magicBonus: 2 }, { bonus: 2 }), { id: 'luck-pebble', bonus: '+1' }] })).toEqual([
      `items: "Heron spear" has a top-level bonus (2), which the app doesn't read: a weapon's magic bonus is weapon.magicBonus (and weapon.bonusVs against a kind of foe), armour's is armour.magicBonus (mw-1).`,
      `items: "luck-pebble" has a top-level bonus ("+1"), which the app doesn't read: a weapon's magic bonus is weapon.magicBonus (and weapon.bonusVs against a kind of foe), armour's is armour.magicBonus (mw-1).`,
    ]);
  });
});

describe('weapon.bonusVs entries (mw-2)', () => {
  // Purpose: an entry with bonus or with damage passes; one with both, or neither, is warned; a bonusVs that isn't a
  // list, or an entry that isn't an object, says the shape.
  it('wants bonus or damage, never both', () => {
    const vs = (bonusVs) => weaponBonusNotes({ items: [weapon('Lurker bane', { magicBonus: 2, bonusVs })] });
    expect(vs([{ against: 'bog lurkers', bonus: 3 }, { against: 'reed hags', damage: 4 }])).toEqual([]);
    expect(vs([{ against: 'reed hags', bonus: 3, damage: 5 }, { against: 'marsh wisps' }])).toEqual([
      'items: "Lurker bane", weapon.bonusVs 1 ("reed hags") has both bonus and damage; keep one: bonus is the total bonus against that kind, damage the total damage bonus with the attack bonus unchanged (mw-2).',
      'items: "Lurker bane", weapon.bonusVs 2 ("marsh wisps") has neither bonus nor damage; give the total bonus against that kind as bonus, or the total damage bonus as damage (mw-2).',
    ]);
    expect(vs({ against: 'bog lurkers', bonus: 3 })).toEqual(['items: "Lurker bane", weapon.bonusVs should be a list of { against, bonus } or { against, damage } (mw-1, mw-2).']);
    expect(vs(['bog lurkers'])).toEqual(['items: "Lurker bane", weapon.bonusVs 1 should be { against, bonus } or { against, damage } (mw-1, mw-2).']);
  });
});

describe('in the format notes and on the fixture', () => {
  // Purpose: the notes reach pack:check through the format notes, and odd input never throws.
  it('is part of formatNotes', () => {
    expect(formatNotes({ items: [weapon('Heron spear', {}, { bonus: 1 })] }).some((n) => n.includes('top-level bonus'))).toBe(true);
    expect(weaponBonusNotes(null)).toEqual([]);
    expect(weaponBonusNotes({ items: 'nope' })).toEqual([]);
  });

  // Purpose: on the Gleam fen fixture, pack:check warns on the four weapons made wrong on purpose and not on Fenblade.
  it('warns on the fixture', () => {
    let out;
    try {
      out = execFileSync(process.execPath, ['scripts/check-pack.mjs', 'scripts/fixtures/pack-check-after-gate.fixture.json'], { encoding: 'utf8' });
    } catch (error) {
      out = String(error.stdout);
    }
    expect(out).toMatch(/"mirebrand": the bonus text says \+2/);
    expect(out).toMatch(/"sulk-knife": the bonus text says -1 .*no weapon\.magicBonus/);
    expect(out).toMatch(/"heron-spear" has a top-level bonus/);
    expect(out).toMatch(/"lurker-bane", weapon\.bonusVs 2 \("reed hags"\) has both/);
    expect(out).toMatch(/"lurker-bane", weapon\.bonusVs 3 \("marsh wisps"\) has neither/);
    expect(out).not.toMatch(/"fenblade"/);
  });
});
