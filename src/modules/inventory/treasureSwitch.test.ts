import { describe, expect, it } from 'vitest';
import { carryingTreasure, nextTreasureSwitch, treasureSwitchWords } from './treasureSwitch.ts';

describe('the Carrying treasure switch', () => {
  // Purpose: the GM's word wins when set; null follows the pack's suggestion.
  it('carryingTreasure takes the GM’s word, else the suggestion', () => {
    expect(carryingTreasure(true, null)).toBe(true);
    expect(carryingTreasure(false, null)).toBe(false);
    expect(carryingTreasure(true, false)).toBe(false);
    expect(carryingTreasure(false, true)).toBe(true);
  });

  // Purpose: each tap stores the opposite of what shows, going back to "follow the pack" (null) when that already matches.
  it('nextTreasureSwitch flips what shows, and stores null when that is the pack’s own answer', () => {
    expect(nextTreasureSwitch(true, null)).toBe(false);
    expect(nextTreasureSwitch(true, false)).toBeNull();
    expect(nextTreasureSwitch(false, null)).toBe(true);
    expect(nextTreasureSwitch(false, true)).toBeNull();
  });

  // Purpose: the words say why the switch reads as it does, in all four states.
  it('treasureSwitchWords names the four states', () => {
    expect(treasureSwitchWords(true, null)).toBe('treasure in the pack');
    expect(treasureSwitchWords(false, null)).toBe('nothing counts as treasure');
    expect(treasureSwitchWords(true, true)).toBe('the GM agrees with the pack');
    expect(treasureSwitchWords(true, false)).toBe("the GM's call, the pack suggests on");
    expect(treasureSwitchWords(false, true)).toBe("the GM's call, the pack suggests off");
  });
});
