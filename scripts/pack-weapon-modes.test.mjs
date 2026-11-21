// npm run pack:check on an item's weapon.modes (G-211; scripts/pack-weapon-modes.mjs). Warnings only; the ruled
// shapes pass. Every name is made up.
import { describe, expect, it } from 'vitest';
import { equipmentNotes } from './pack-equipment.mjs';
import { formatNotes } from './pack-format.mjs';
import { weaponModeDrawsNotes, weaponModeNotes } from './pack-weapon-modes.mjs';

const bow = {
  id: 'reed-bow',
  name: 'Reed bow',
  hands: 2,
  weapon: {
    damage: '1d6',
    qualities: ['Missile (40/80/120)', 'Two-handed'],
    modes: {
      button: 'quiver',
      list: [
        { id: 'reed-arrows', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
        { id: 'silver-reed-arrows', name: 'Silver reed arrows', draws: { itemId: 'silver-reed-arrows' }, note: 'counts as silver' },
      ],
    },
  },
};
const arrows = [
  { id: 'reed-arrows', name: 'Reed arrows' },
  { id: 'silver-reed-arrows', name: 'Silver reed arrows' },
];
const spear = {
  id: 'fen-spear',
  name: 'Fen spear',
  weapon: {
    damage: '1d6',
    qualities: ['Melee', 'Missile (20/40/60)', 'Brace'],
    modes: {
      button: 'grip',
      list: [
        { id: 'melee', name: 'Melee', qualities: ['Melee'] },
        { id: 'thrown', name: 'Thrown', qualities: ['Missile (20/40/60)'] },
        { id: 'braced', name: 'Braced', qualities: ['Brace', 'Melee'] },
      ],
    },
  },
};
const packOf = (items) => ({ items });
const withModes = (modes, extra = {}) => packOf([{ id: 'w', name: 'W', weapon: { qualities: ['Melee', 'Missile'], ...extra, modes } }]);
const draws = (...files) => weaponModeDrawsNotes(files.map((file, i) => ({ name: `pack ${i + 1}`, file })));

describe('weapon.modes (G-211)', () => {
  // Purpose: the Pack Creator's bow (with its two arrow items) and a grip spear pass without a word, in every check.
  it('passes the ruled shapes', () => {
    const file = packOf([bow, ...arrows, spear]);
    expect(weaponModeNotes(file)).toEqual([]);
    expect(equipmentNotes(file)).toEqual([]);
    expect(draws(file)).toEqual([]);
  });

  // Purpose: the file-level format check no longer calls modes an unknown field.
  it('is not an unknown field in the format check', () => {
    expect(formatNotes(packOf([bow, ...arrows, spear])).filter((n) => /modes/.test(n))).toEqual([]);
  });

  // Purpose: a button word outside the four is noted, since the app then reads no modes at all.
  it('notes a button outside the four words', () => {
    expect(weaponModeNotes(withModes({ button: 'mode', list: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }))).toEqual([
      'items: "w": weapon.modes: button should be one of quiver, pouch, grip, stance; the app reads no modes without it.',
    ]);
    expect(weaponModeNotes(withModes({ list: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }))).toHaveLength(1);
  });

  // Purpose: a mode with no id or no name, and two modes with one id, are noted.
  it('notes a mode with no id or name, and a repeated id', () => {
    const notes = weaponModeNotes(withModes({ button: 'grip', list: [{ name: 'A' }, { id: 'b' }, { id: 'c', name: 'C' }, { id: 'c', name: 'C again' }] }));
    expect(notes).toEqual([
      'items: "w": weapon.modes: mode 1 has no id; the app leaves it out.',
      'items: "w": weapon.modes: mode "b" has no name; the app leaves it out.',
      'items: "w": weapon.modes: mode "c": the id is used by another mode of this weapon; give each its own.',
    ]);
  });

  // Purpose: a draws.itemId that no item has is noted, in the same file and across the files given together; an item
  // with that id as its baseId counts, as the app matches it.
  it('notes a draws.itemId no item has, looking across files and baseIds', () => {
    expect(draws(packOf([bow, arrows[0]]))).toEqual([
      'items: "reed-bow": weapon.modes mode "silver-reed-arrows" draws "silver-reed-arrows", which no item has as its id or baseId; the mode would find nothing to spend.',
    ]);
    expect(draws(packOf([bow, arrows[0]]), packOf([arrows[1]]))).toEqual([]);
    expect(draws(packOf([bow, arrows[0], { id: 'bone-arrows', name: 'Bone arrows', baseId: 'silver-reed-arrows' }]))).toEqual([]);
  });

  // Purpose: a mode quality the weapon's own qualities don't carry is noted; case and spaces don't matter.
  it('notes a mode quality the weapon does not carry', () => {
    const modes = { button: 'grip', list: [{ id: 'a', name: 'A', qualities: ['  melee '] }, { id: 'b', name: 'B', qualities: ['Reach'] }] };
    expect(weaponModeNotes(withModes(modes))).toEqual([
      'items: "w": weapon.modes: mode "b": quality "Reach" isn\'t one of the weapon\'s own qualities, so it won\'t match the weapon\'s tags.',
    ]);
  });

  // Purpose: a toHit that isn't a whole number and a damage that isn't dice are noted; +1 and 1d8+1 pass.
  it('notes a toHit that is not whole and a damage that is not dice', () => {
    const modes = { button: 'stance', list: [{ id: 'a', name: 'A', toHit: 1.5, damage: 'lots' }, { id: 'b', name: 'B', toHit: -1, damage: '1d8+1' }] };
    expect(weaponModeNotes(withModes(modes))).toEqual([
      'items: "w": weapon.modes: mode "a": toHit should be a whole number; the app ignores it.',
      'items: "w": weapon.modes: mode "a": damage should be dice like "1d6" or "1d8+1"; the app shows it as written and can\'t roll it.',
    ]);
  });

  // Purpose: fewer than two modes is noted, since the app shows no button for one.
  it('notes fewer than two modes', () => {
    expect(weaponModeNotes(withModes({ button: 'grip', list: [{ id: 'a', name: 'A' }] }))).toEqual([
      'items: "w": weapon.modes has one mode; the app shows no button for fewer than two.',
    ]);
    expect(weaponModeNotes(withModes({ button: 'grip', list: [] }))).toEqual(['items: "w": weapon.modes has no mode; the app shows no button for fewer than two.']);
  });
});
