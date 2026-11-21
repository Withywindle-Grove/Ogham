// C16 (⚑ 9, Francis 2026-11-20: "Yes to grip"): with a grip chosen, a weapon shows that grip's roll lines alone, in the
// weapon in hand's line, its breakdown and the Attack rolls. His note (item 30): "grip "melee" still shows thrown values.
// thrown grip shows correct values." The fault was a quality written with its range ("Missile 5-10/11-20/21-30"), which
// left the weapon's "Missile" tag in place under the grip "Melee". Invented weapons, classes and scores only.
import { describe, expect, it } from 'vitest';
import { weaponBreakdown, weaponFigures, weaponRolls } from '../characters/play.ts';
import { weaponModesOf, withMode } from './weaponModes.ts';

// A thrown-capable weapon as packs write it: the tags Melee and Missile, the missile quality with its range in it.
const FEN_JAVELIN = {
  name: 'Fen javelin',
  weaponTags: ['Melee', 'Missile'],
  weapon: {
    damage: '1d6',
    qualities: ['Brace', 'Melee', 'Missile 5-20/21-40/41-60'],
    modes: {
      button: 'grip',
      list: [
        { id: 'melee', name: 'Melee', qualities: ['Melee'] },
        { id: 'thrown', name: 'Thrown', qualities: ['Missile 5-20/21-40/41-60'] },
        { id: 'braced', name: 'Braced', qualities: ['Brace', 'Melee'] },
      ],
    },
  },
};
// A weapon with one way of use: no modes block.
const BOG_AXE = { name: 'Bog axe', weaponTags: ['Melee'], weapon: { damage: '1d8', qualities: ['Melee'] } };
const WARDEN = { progression: [{ level: 2, attackBonus: 1 }] };
// Might adds in melee, Grace as a missile, so each kind's line has its own figure.
const SCORES = { 'abilityModifiers.MIG': { melee: 1 }, 'abilityModifiers.GRA': { missile: -1 } };

const grip = (id: string) => weaponModesOf(FEN_JAVELIN)!.list.find((m) => m.id === id)!;
const lines = (item: Record<string, unknown>) => weaponRolls(item, SCORES, WARDEN, 2).map((r) => r.line);

describe('a grip shows its own roll lines alone (C16, ⚑ 9)', () => {
  // Purpose: with the grip "Melee" chosen, a thrown-capable weapon shows no missile line anywhere it is figured.
  it('with "Melee" chosen, shows no missile line', () => {
    const melee = withMode(FEN_JAVELIN, grip('melee'));
    expect(lines(melee)).toEqual(['Roll 1d20 + 2 to hit', 'Roll 1d6 for damage']);
    expect(weaponFigures(melee, SCORES, WARDEN, 2)).toBe('+2, 1d6');
    expect(weaponBreakdown(melee, SCORES, WARDEN, 2).map((r) => r.label)).not.toContain('Missile, GRA −1');
    expect(weaponBreakdown(melee, SCORES, WARDEN, 2).map((r) => r.label).join(' ')).not.toMatch(/missile/i);
    // A grip that is melee by another name ("Braced") is the same.
    expect(lines(withMode(FEN_JAVELIN, grip('braced')))).toEqual(['Roll 1d20 + 2 to hit', 'Roll 1d6 for damage']);
  });

  // Purpose: with the grip "Thrown" chosen, the weapon shows the thrown line(s) only, as it did before (his "correct values").
  it('with "Thrown" chosen, shows the thrown lines only', () => {
    const thrown = withMode(FEN_JAVELIN, grip('thrown'));
    expect(lines(thrown)).toEqual(['Roll 1d20 to hit', 'Roll 1d6 for damage']);
    expect(weaponFigures(thrown, SCORES, WARDEN, 2)).toBe('+0, 1d6');
  });

  // Purpose: with no grip chosen (the weapon as the pack writes it, as on the Pack's row), every line shows, as today.
  it('with no grip chosen, shows every line, as today', () => {
    expect(withMode(FEN_JAVELIN, null)).toBe(FEN_JAVELIN);
    expect(lines(FEN_JAVELIN)).toEqual(['Roll 1d20 + 2 to hit, in melee', 'Roll 1d20 to hit, as a missile', 'Roll 1d6 for damage']);
    expect(weaponFigures(FEN_JAVELIN, SCORES, WARDEN, 2)).toBe('Melee +2, Missile +0, 1d6');
  });

  // Purpose: a grip that leaves every quality (no `qualities` on it) keeps every line: the grip's lines are all of them.
  it('a grip that names no qualities keeps every line', () => {
    const hooked = { weaponTags: ['Melee', 'Missile'], weapon: { damage: '2d4', qualities: ['Melee', 'Missile 5-10/11-20/21-30'], modes: { button: 'grip', list: [{ id: 'one-hand', name: 'One hand' }, { id: 'two-hands', name: 'Two hands', damage: '1d10' }] } } };
    const oneHand = withMode(hooked, weaponModesOf(hooked)!.list[0]!);
    expect(lines(oneHand)).toEqual(['Roll 1d20 + 2 to hit, in melee', 'Roll 1d20 to hit, as a missile', 'Roll 2d4 for damage']);
  });

  // Purpose: a tag that a quality the grip keeps still names stays, even when the weapon writes that quality differently.
  it('keeps a tag a kept quality still names', () => {
    const reach = { weaponTags: ['Melee', 'Missile'], weapon: { damage: '1d6', qualities: ['Melee', 'Missile (5-20)'], modes: { button: 'grip', list: [{ id: 'held', name: 'Held', qualities: ['Melee', 'Missile 5-20'] }, { id: 'thrown', name: 'Thrown', qualities: ['Missile 5-20'] }] } } };
    expect(withMode(reach, weaponModesOf(reach)!.list[0]!).weaponTags).toEqual(['Melee', 'Missile']);
    expect(withMode(reach, weaponModesOf(reach)!.list[1]!).weaponTags).toEqual(['Missile']);
  });

  // Purpose: a tag that only shares a first word with a dropped quality stays ("Cold iron" dropped, the tag "Cold" kept).
  it('keeps a tag that only shares a first word with a dropped quality', () => {
    const blade = { weaponTags: ['Melee', 'Cold', 'Charge'], weapon: { damage: '1d6', qualities: ['Melee', 'Cold iron', 'Charge (mounted)'], modes: { button: 'grip', list: [{ id: 'melee', name: 'Melee', qualities: ['Melee'] }, { id: 'other', name: 'Other', qualities: ['Cold iron'] }] } } };
    expect(withMode(blade, weaponModesOf(blade)!.list[0]!).weaponTags).toEqual(['Melee', 'Cold', 'Charge']);
  });

  // Purpose: only a grip reads a quality's first word; a stance (or a quiver, a pouch) matches whole names, as before.
  it('leaves other modes as before', () => {
    const hookstaff = { weaponTags: ['Melee', 'Missile'], weapon: { damage: '1d6', qualities: ['Melee', 'Missile 5-20/21-40/41-60'], modes: { button: 'stance', list: [{ id: 'normal', name: 'Normal', qualities: ['Melee'] }, { id: 'braced', name: 'Braced', qualities: ['Melee'] }] } } };
    expect(withMode(hookstaff, weaponModesOf(hookstaff)!.list[0]!).weaponTags).toEqual(['Melee', 'Missile']);
  });

  // Purpose: a weapon with one mode (no modes block) is unchanged.
  it('a weapon with one way of use is unchanged', () => {
    expect(weaponModesOf(BOG_AXE)).toBeNull();
    expect(withMode(BOG_AXE, null)).toBe(BOG_AXE);
    expect(lines(BOG_AXE)).toEqual(['Roll 1d20 + 2 to hit', 'Roll 1d8 for damage']);
  });
});
