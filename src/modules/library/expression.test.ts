// The rule-hook expression language (docs/07, "The test language"). Invented names throughout.
import { describe, expect, it } from 'vitest';
import { checkExpression, Dice, evaluate, namesIn, parseExpression, testHolds, type Scope } from './expression.ts';

const scope: Scope = {
  names: {
    item: { name: 'Reed shield', slot: 'shield', hands: 1, material: ['wood'] },
    character: { name: 'Wren', level: 3, STR: 13, class: { id: 'lantern-warden', name: 'Lantern Warden' }, race: { classMaxLevels: { 'lantern-warden': 8 } } },
    equipped: { shield: null, hand: { name: 'Fen spear', hands: 2 } },
    campaign: { flags: { flooding: true } },
  },
};
const holds = (text: string) => testHolds(text, scope);
const value = (text: string, extra: Partial<Scope> = {}) => evaluate(parseExpression(text), { ...scope, ...extra });

describe('reading and working out tests', () => {
  it('compares names from the event with text, numbers and lists', () => {
    expect(holds('item.slot == "shield"')).toBe(true);
    expect(holds('item.slot != "shield"')).toBe(false);
    expect(holds('character.STR >= 13 and character.level < 4')).toBe(true);
    expect(holds('item.slot in ["armour", "shield"]')).toBe(true);
    expect(holds('"wood" in item.material')).toBe(true);
    expect(holds('not (character.level > 5) or false')).toBe(true);
    expect(holds('campaign.flags.flooding == true')).toBe(true);
  });

  it('[ ] looks a key up, and a missing name is null: only == null and != null are true of it', () => {
    expect(value('character.race.classMaxLevels[character.class.id]')).toBe(8);
    expect(holds('equipped.shield == null')).toBe(true);
    expect(holds('equipped.shield != null')).toBe(false);
    expect(holds('character.wisdom > 3')).toBe(false);
    expect(holds('character.wisdom < 3')).toBe(false);
    expect(holds('nothing.at.all == null')).toBe(true);
  });

  it('works out maths, the fixed functions, and dice (shown, never rolled)', () => {
    expect(value('floor(7 / 2) + ceil(1 / 3) + min(4, 2) + max(1, 5)')).toBe(11);
    expect(value('count(item.material)')).toBe(1);
    expect(value('has(character.race.classMaxLevels, "lantern-warden")')).toBe(true);
    const dice = value('character.level d6 + 1');
    expect(dice).toBeInstanceOf(Dice);
    expect([...(dice as Dice).dice]).toEqual([[6, 3]]);
    expect((dice as Dice).constant).toBe(1);
  });

  it('lookup, allows and primeXp come from whoever runs the hook; without them the hook can’t run', () => {
    expect(holds('allows(character.class.armourAllowed, item)')).toBeNull();
    const allows = { functions: { allows: () => false } };
    expect(testHolds('not allows(character.class.armourAllowed, item)', { ...scope, ...allows })).toBe(true);
  });

  it("a value that doesn't fit means it can't run (skipped, never guessed)", () => {
    expect(holds('item.name + 1 > 2')).toBeNull();
    expect(holds('item.slot and true')).toBeNull();
    expect(holds('1 / 0 > 1')).toBeNull();
    expect(holds('character.level')).toBeNull();
  });
});

describe('finding mistakes when the pack is read', () => {
  it('says what is wrong in plain words', () => {
    expect(checkExpression('item.slot == "shield"')).toBeNull();
    expect(checkExpression('item.slot == "shield')).toMatch(/closing quote/);
    expect(checkExpression('item.slot ==')).toMatch(/ends too soon/);
    expect(checkExpression('(1 + 2')).toMatch(/missing/);
    expect(checkExpression('item.slot = "shield"')).toMatch(/isn't something a rule can use/);
    expect(checkExpression('and true')).toMatch(/needs something before it/);
    expect(checkExpression('1 2')).toMatch(/after the end/);
  });

  it('lists the names and functions an expression uses', () => {
    expect(namesIn(parseExpression('item.slot == "armour" and not allows(character.class.armourAllowed, item)'))).toEqual({
      paths: ['item.slot', 'character.class.armourAllowed', 'item'],
      functions: ['allows'],
    });
    expect(namesIn(parseExpression('character.race.classMaxLevels[character.class.id] > 3')).paths).toEqual([
      'character.race.classMaxLevels',
      'character.class.id',
    ]);
  });

  it('caps size and nesting', () => {
    expect(checkExpression('1 + '.repeat(400) + '1')).toMatch(/too long/);
    expect(checkExpression('('.repeat(60) + '1' + ')'.repeat(60))).toMatch(/nested too deeply/);
  });
});
