// The Attack sheet's rolls (ruling m5b-attack-sheet-clarity-2026-11-10, as-1; plan m5b-attack-sheet-clarity) and a
// weapon's magic in them (mw-1 … mw-3, rulings m6-weapon-magic-bonus-2026-11-05 and -2). Invented names and numbers.
import { describe, expect, it } from 'vitest';
import type { Filled } from '../library/fills.ts';
import { magicNoteLines, weaponBreakdown, weaponFigures, weaponMagic, weaponRolls } from './play.ts';
import { weaponPenalty } from './weaponSkills.ts';

const WARDEN = { progression: [{ level: 1, attackBonus: 1 }, { level: 2, attackBonus: 1 }] };
const BY_MIGHT = [{ attack: { damageScore: 'MIG' } }];
const NAMES: Record<string, string> = { NIM: 'Nimbleness', MIG: 'Might' };
const SCORES: Record<string, number> = { NIM: 13, MIG: 16 };
const named = { klassName: 'Fen warden', longName: (k: string) => NAMES[k] ?? k, scoreOf: (k: string) => SCORES[k] ?? null };
const strong: Filled = { 'abilityModifiers.MIG': { melee: 1 }, 'abilityModifiers.NIM': { missile: 1 } };
const SPEAR = { name: 'Eel spear', weapon: { damage: '1d6', qualities: ['Melee'] } };
const BOW = { name: 'Reed bow', weapon: { damage: '1d6', qualities: ['Missile'] } };

describe('the Attack sheet’s rolls (as-1)', () => {
  it('opens with the to-hit roll, its line the sum of its rows, each row its own figure and never a running total', () => {
    // Purpose: as-1: "Roll 1d20 + 2 to hit" over the class (+1) and the score (+1); the score's row says +1, not +2.
    const [hit, damage] = weaponRolls(SPEAR, strong, WARDEN, 2, BY_MIGHT, named);
    expect(hit).toEqual({
      roll: 'hit',
      dice: '1d20',
      line: 'Roll 1d20 + 2 to hit',
      adds: 2,
      which: null,
      againstTarget: false,
      lineNote: null,
      notes: [],
      parts: [
        { label: 'Fen warden, level 2', value: '+1' },
        { label: 'Might 16', value: '+1' },
      ],
    });
    expect(damage).toMatchObject({ roll: 'damage', dice: '1d6', line: 'Roll 1d6 + 1 for damage', parts: [{ label: 'Eel spear', value: '1d6' }, { label: 'Might 16', value: '+1' }] });
  });

  it('drops a sum of zero from the line while the rows still show their zeros', () => {
    // Purpose: as-1: "Roll 1d20 to hit", never "+ 0", and the +1 and −1 that make it still show.
    const [hit] = weaponRolls(SPEAR, { 'abilityModifiers.MIG': { melee: -1 } }, WARDEN, 1, [], named);
    expect(hit!.line).toBe('Roll 1d20 to hit');
    expect(hit!.parts.map((p) => p.value)).toEqual(['+1', '−1']);
  });

  it('reads a damage penalty as "− 1" on the line', () => {
    // Purpose: as-1: a negative is written with a spaced minus, "Roll 1d4 − 1 for damage".
    const knife = { name: 'The long knife of the drowned causeway’s last warden', weapon: { damage: '1d4', qualities: ['Melee'] } };
    const damage = weaponRolls(knife, { 'abilityModifiers.MIG': { melee: -1 } }, WARDEN, 1, BY_MIGHT, named).at(-1)!;
    expect(damage.line).toBe('Roll 1d4 − 1 for damage');
    expect(damage.parts).toEqual([
      { label: knife.name, value: '1d4' },
      { label: 'Might 16', value: '−1' },
    ]);
  });

  it('says in words when the damage score doesn’t add to a missile', () => {
    // Purpose: the mockup's "Might, not added to a missile": a score that adds to melee damage only is named, not summed.
    const damage = weaponRolls(BOW, strong, WARDEN, 2, BY_MIGHT, named).at(-1)!;
    expect(damage.line).toBe('Roll 1d6 for damage');
    expect(damage.parts).toContainEqual({ label: 'Might', value: 'not added to a missile' });
  });

  it('never assumes roll-high-and-add: with a target figure the line names the die and what to add, with no note on who reads the hit', () => {
    // Purpose: as-1 with descending AC: no "to hit" sum is invented; the class's row is the target. tfw-2 (2026-11-19):
    // no line says who reads the hit; the roll is marked as read against a target, so nothing that shows it adds "to hit".
    const [hit, damage] = weaponRolls(BOW, strong, { progression: [{ level: 2, thac0: 19 }] }, 2, [], { ...named, direction: 'descending' });
    expect(hit!.line).toBe('Roll 1d20 + 1');
    expect(hit!.line).not.toContain('to hit');
    expect(hit!.lineNote).toBeNull();
    expect(hit!.againstTarget).toBe(true);
    expect(damage!.againstTarget).toBe(false);
    expect(hit!.parts).toEqual([
      { label: 'Fen warden, level 2', value: 'hits armour 0 on 19' },
      { label: 'Nimbleness 13', value: '+1' },
    ]);
  });

  it('gives a weapon both melee and missile a to-hit roll for each, and one damage roll when they match', () => {
    // Purpose: each kind's to-hit has its own line ("in melee", "as a missile"); the damage isn't said twice.
    const rolls = weaponRolls({ name: 'Eel spear', weapon: { damage: '1d6', qualities: ['Melee', 'Missile'] } }, strong, WARDEN, 2, [], named);
    expect(rolls.map((r) => r.line)).toEqual(['Roll 1d20 + 2 to hit, in melee', 'Roll 1d20 + 2 to hit, as a missile', 'Roll 1d6 for damage']);
  });

  it('adds a mode’s own to-hit as its own row, a zero kept', () => {
    // Purpose: ah-1's mode parts as as-1 rows: "Silver arrows +0" shows, and adds nothing.
    const [hit] = weaponRolls(BOW, strong, WARDEN, 2, [], { ...named, attack: { label: 'Silver arrows', value: 0 } });
    expect(hit!.parts.at(-1)).toEqual({ label: 'Silver arrows', value: '+0' });
    expect(hit!.line).toBe('Roll 1d20 + 2 to hit');
  });

  it('has no to-hit roll without the class’s figure, no damage roll without a die, and nothing for a non-weapon', () => {
    // Purpose: the sheet never makes up a roll the setting doesn't give.
    expect(weaponRolls(SPEAR, strong, null, 1, [], named).map((r) => r.roll)).toEqual(['damage']);
    expect(weaponRolls({ name: 'Club', weapon: { qualities: ['Melee'] } }, strong, WARDEN, 1, [], named).map((r) => r.roll)).toEqual(['hit']);
    expect(weaponRolls({ name: 'Rope' }, strong, WARDEN, 1)).toEqual([]);
  });
});

describe('a weapon’s magic in its rolls (mw-1 … mw-3)', () => {
  const FENBLADE = { name: 'Fenblade', weapon: { damage: '1d8', qualities: ['Melee'], magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }, { against: 'marsh wights', damage: 4 }] } };

  it('counts the magic bonus as its own row in both rolls, and the bonus against a kind of foe as a note, never added', () => {
    // Purpose: mw-1: "Fenblade, magic +1" in the to-hit and the damage; "+3 vs bog lurkers" under the to-hit line and
    // "damage +4 vs marsh wights" (mw-2) under the damage line, neither in the sum.
    const magic = weaponMagic({ name: 'Fenblade', data: FENBLADE }, [], false);
    const [hit, damage] = weaponRolls(FENBLADE, strong, WARDEN, 2, BY_MIGHT, { ...named, magic });
    expect(hit!.line).toBe('Roll 1d20 + 3 to hit');
    expect(hit!.parts.at(-1)).toEqual({ label: 'Fenblade, magic', value: '+1' });
    expect(hit!.notes).toEqual(['+3 vs bog lurkers']);
    expect(damage!.line).toBe('Roll 1d8 + 2 for damage');
    expect(damage!.parts.at(-1)).toEqual({ label: 'Fenblade, magic', value: '+1' });
    expect(damage!.notes).toEqual(['damage +4 vs marsh wights']);
  });

  it('counts the magic in At hand’s line and in the item sheet’s breakdown too, the notes under the line and never in it', () => {
    // Purpose: mw-1: the At hand figure and its breakdown agree with the Attack sheet; the bonusVs notes are lines of
    // their own under the figure (#594 review), never part of the one-line figure.
    const magic = weaponMagic({ name: 'Fenblade', data: FENBLADE }, [], false);
    expect(weaponFigures(FENBLADE, strong, WARDEN, 2, BY_MIGHT, { magic })).toBe('+3, 1d8+2');
    expect(magicNoteLines(magic)).toEqual(['+3 vs bog lurkers', 'damage +4 vs marsh wights']);
    const rows = weaponBreakdown(FENBLADE, strong, WARDEN, 2, BY_MIGHT, { magic });
    expect(rows).toContainEqual({ label: 'Fenblade, magic +1', value: '+3' });
    expect(rows).toContainEqual({ label: 'Damage, Fenblade, magic +1', value: '1d8+2' });
  });

  it('hides a cursed or unidentified weapon’s bonus from the player, and shows the GM it marked', () => {
    // Purpose: mw-1 point 4, the armour rule: the player's numbers and notes leave it out; the GM sees it, marked.
    const cursed = { ...FENBLADE, cursed: true, weapon: { ...FENBLADE.weapon, magicBonus: -2 } };
    expect(weaponMagic({ name: 'Fenblade', data: cursed }, [], false)).toEqual({ parts: [], hitNotes: [], damageNotes: [] });
    expect(weaponMagic({ name: 'Fenblade', data: cursed }, [], true).parts).toEqual([{ label: 'Fenblade, magic (hidden from the player)', value: -2 }]);
    const unknown = [{ itemCategories: [{ id: 'odd-blades', unidentified: true }] }];
    expect(weaponMagic({ name: 'Fenblade', data: FENBLADE, category: 'odd-blades' }, unknown, false).parts).toEqual([]);
  });

  it('gives the player the plain sword’s numbers for an untold cursed sword, and counts its −1 once told (K22a)', () => {
    // Purpose: the driver's finding of 2026-11-21: the player's numbers for the cursed Sorrow blade are the plain
    // sword's while its bonus is untold (and the GM's view marks the −1); once the GM tells "bonus" it counts, unmarked.
    const blade = { name: 'Sorrow blade', cursed: true, weapon: { damage: '1d8', qualities: ['Melee'], magicBonus: -1 } };
    expect(weaponMagic({ name: 'Sorrow blade', data: blade, told: [] }, [], false)).toEqual({ parts: [], hitNotes: [], damageNotes: [] });
    expect(weaponMagic({ name: 'Sorrow blade', data: blade, told: [] }, [], true).parts).toEqual([{ label: 'Sorrow blade, magic (hidden from the player)', value: -1 }]);
    expect(weaponMagic({ name: 'Sorrow blade', data: blade, told: ['magic', 'cursed'] }, [], false).parts).toEqual([]);
    expect(weaponMagic({ name: 'Sorrow blade', data: blade, told: ['magic', 'bonus'] }, [], false).parts).toEqual([{ label: 'Sorrow blade, magic', value: -1 }]);
    const unknown = [{ itemCategories: [{ id: 'odd-bows', unidentified: true }] }];
    const bow = { name: 'Heron bow', weapon: { damage: '1d6', qualities: ['Missile'], bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } };
    expect(weaponMagic({ name: 'Heron bow', data: bow, category: 'odd-bows' }, unknown, false).hitNotes).toEqual([]);
    expect(weaponMagic({ name: 'Heron bow', data: bow, category: 'odd-bows', told: ['bonus'] }, unknown, false).hitNotes).toEqual(['+3 vs bog lurkers']);
  });

  it('adds the drawn ammunition’s bonus only where the setting says both apply', () => {
    // Purpose: mw-3: with `attack.ammunitionBonus: "add"` the arrows' bonus is its own row; with no rule, nothing.
    const bow = { name: 'Heron bow', weapon: { damage: '1d6', qualities: ['Missile'], magicBonus: 2 } };
    const arrows = { name: 'Ember arrows', data: { category: 'ammunition', weapon: { magicBonus: 1 } }, category: 'ammunition' };
    expect(weaponMagic({ name: 'Heron bow', data: bow }, [{ attack: { ammunitionBonus: 'add' } }], false, arrows).parts).toEqual([
      { label: 'Heron bow, magic', value: 2 },
      { label: 'Ember arrows, magic', value: 1 },
    ]);
    expect(weaponMagic({ name: 'Heron bow', data: bow }, [], false, arrows)).toEqual({ parts: [{ label: 'Heron bow, magic', value: 2 }], hitNotes: [], damageNotes: [] });
  });

  it('hides a negative bonus from the player even when the player’s copy lacks `cursed` (a GM-hidden field)', () => {
    // Purpose: #594 review: `cursed` may be hidden from the player, so a minus bonus on their copy must not show; the GM
    // sees it, marked.
    const blade = { name: 'Sorrow blade', weapon: { damage: '1d8', qualities: ['Melee'], magicBonus: -2 } };
    expect(weaponMagic({ name: 'Sorrow blade', data: blade }, [], false).parts).toEqual([]);
    expect(weaponMagic({ name: 'Sorrow blade', data: blade }, [], true).parts).toEqual([{ label: 'Sorrow blade, magic (hidden from the player)', value: -2 }]);
  });

  it('gives magic arrows at hand no figure and no rolls of their own', () => {
    // Purpose: #594 review: ammunition carries a `weapon` block for its bonus, but it is fired, not swung.
    const arrows = { name: 'Ember arrows', category: 'ammunition', weapon: { magicBonus: 1 } };
    expect(weaponFigures(arrows, strong, WARDEN, 2)).toBeNull();
    expect(weaponRolls(arrows, strong, WARDEN, 2)).toEqual([]);
    expect(weaponBreakdown(arrows, strong, WARDEN, 2)).toEqual([]);
  });

  it('says the GM’s ammunition note once on At hand’s line, though both cards carry it', () => {
    // Purpose: #594 review: the mw-4 note sits under each card but isn't repeated under the one-line figure.
    const arrows = { name: 'Ember arrows', data: { weapon: { magicBonus: 1 } }, category: 'ammunition' };
    const magic = weaponMagic({ name: 'Heron bow', data: { weapon: { damage: '1d6', magicBonus: 2 } } }, [], true, arrows);
    expect(magicNoteLines(magic)).toEqual(['Ember arrows, magic +1. Not added: the rules don’t say.']);
  });

  it('with no rule, from a magic launcher, notes the ammunition’s bonus for the GM alone, never adding it', () => {
    // Purpose: mw-4 (narrowed by mw-5): a silent setting counts the launcher's bonus and not the arrows'; the GM sees
    // the arrows' bonus as a note on the attack line, the player nothing.
    const bow = { name: 'Heron bow', weapon: { damage: '1d6', qualities: ['Missile'], magicBonus: 2 } };
    const arrows = { name: 'Ember arrows', data: { weapon: { magicBonus: 1 } }, category: 'ammunition' };
    expect(weaponMagic({ name: 'Heron bow', data: bow }, [], true, arrows)).toEqual({
      parts: [{ label: 'Heron bow, magic', value: 2 }],
      hitNotes: ['Ember arrows, magic +1. Not added: the rules don’t say.'],
      damageNotes: ['Ember arrows, magic +1. Not added: the rules don’t say.'],
    });
    expect(weaponMagic({ name: 'Heron bow', data: bow }, [], false, arrows)).toEqual({ parts: [{ label: 'Heron bow, magic', value: 2 }], hitNotes: [], damageNotes: [] });
  });
});

describe('magic ammunition from a plain launcher (mw-5)', () => {
  const REED = { name: 'Reed bow', weapon: { damage: '1d6', qualities: ['Missile'] } };
  const EMBER = { name: 'Ember arrows', data: { weapon: { magicBonus: 1 } }, category: 'ammunition' };

  it('with no rule, counts the arrows’ bonus to hit and to damage as their own row, with no note', () => {
    // Purpose: mw-5: a plain bow drawing magic arrows in a silent setting: "Ember arrows, magic +1" in both cards and
    // in both lines; no GM note.
    const magic = weaponMagic({ name: 'Reed bow', data: REED }, [], true, EMBER);
    expect(magic).toEqual({ parts: [{ label: 'Ember arrows, magic', value: 1 }], hitNotes: [], damageNotes: [] });
    const [hit, damage] = weaponRolls(REED, strong, WARDEN, 2, [], { ...named, magic });
    expect(hit!.line).toBe('Roll 1d20 + 3 to hit');
    expect(hit!.parts.at(-1)).toEqual({ label: 'Ember arrows, magic', value: '+1' });
    expect(damage!.line).toBe('Roll 1d6 + 1 for damage');
    expect(damage!.parts.at(-1)).toEqual({ label: 'Ember arrows, magic', value: '+1' });
    expect(weaponFigures(REED, strong, WARDEN, 2, [], { magic })).toBe('+3, 1d6+1');
  });

  it('treats a launcher bonus of 0 as none; a cursed launcher counts its curse and the arrows’ bonus too, with no note', () => {
    // Purpose (as-4 ⚑ for 0; Design 2026-11-10, built not ruled, for a minus): a curse isn't "the bow having a bonus" that
    // silences the arrows under mw-4, so the GM sees the bow's −1 (as-5) and the arrows' +1 both counted, no note; the
    // player, who can't see the curse, sees the arrows' +1 counted, as before.
    const zero = { ...REED, weapon: { ...REED.weapon, magicBonus: 0 } };
    expect(weaponMagic({ name: 'Reed bow', data: zero }, [], false, EMBER).parts).toEqual([{ label: 'Ember arrows, magic', value: 1 }]);
    const sour = { ...REED, weapon: { ...REED.weapon, magicBonus: -1 } };
    expect(weaponMagic({ name: 'Reed bow', data: sour }, [], true, EMBER)).toEqual({
      parts: [
        { label: 'Reed bow, magic (hidden from the player)', value: -1 },
        { label: 'Ember arrows, magic', value: 1 },
      ],
      hitNotes: [],
      damageNotes: [],
    });
    expect(weaponMagic({ name: 'Reed bow', data: sour }, [], false, EMBER)).toEqual({ parts: [{ label: 'Ember arrows, magic', value: 1 }], hitNotes: [], damageNotes: [] });
  });

  it('from the player’s view, an unidentified bow’s bonus counts as none, so the arrows count and the bow isn’t given away', () => {
    // Purpose (#606 review): a +2 bow in a category the rules set marks unidentified: the player sees the arrows' row
    // (mw-5) and no bow row; the GM sees the bow's row, marked, and the mw-4 note.
    const unknown = [{ itemCategories: [{ id: 'odd-bows', unidentified: true }] }];
    const heron = { ...REED, weapon: { ...REED.weapon, magicBonus: 2 } };
    expect(weaponMagic({ name: 'Heron bow', data: heron, category: 'odd-bows' }, unknown, false, EMBER)).toEqual({ parts: [{ label: 'Ember arrows, magic', value: 1 }], hitNotes: [], damageNotes: [] });
    const gm = weaponMagic({ name: 'Heron bow', data: heron, category: 'odd-bows' }, unknown, true, EMBER);
    expect(gm.parts).toEqual([{ label: 'Heron bow, magic (hidden from the player)', value: 2 }]);
    expect(gm.hitNotes).toEqual(['Ember arrows, magic +1. Not added: the rules don’t say.']);
  });

  it('under mw-4, shows the arrows’ bonus against a kind of foe to the player too, a named note never added', () => {
    // Purpose (as-6, ruled 2026-11-10; replaces #606's GM-only rule): the arrows' bonusVs always shows to whoever may see
    // it, also where their plain bonus is the GM's mw-4 note: the player sees "Ember arrows, +3 vs bog lurkers" from a
    // magic bow with no rule, and the arrows' +1 still isn't added for them.
    const heron = { ...REED, weapon: { ...REED.weapon, magicBonus: 2 } };
    const arrows = { name: 'Ember arrows', data: { weapon: { magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } }, category: 'ammunition' };
    expect(weaponMagic({ name: 'Heron bow', data: heron }, [], false, arrows)).toEqual({ parts: [{ label: 'Heron bow, magic', value: 2 }], hitNotes: ['Ember arrows, +3 vs bog lurkers'], damageNotes: [] });
    expect(weaponMagic({ name: 'Heron bow', data: heron }, [], true, arrows).hitNotes).toEqual(['Ember arrows, magic +1. Not added: the rules don’t say.', 'Ember arrows, +3 vs bog lurkers']);
    expect(weaponMagic({ name: 'Heron bow', data: heron }, [{ attack: { ammunitionBonus: 'add' } }], false, arrows).hitNotes).toEqual(['Ember arrows, +3 vs bog lurkers']);
  });

  it('keeps an unidentified arrow’s bonus against a kind of foe from the player under mw-4, the GM seeing it marked', () => {
    // Purpose (as-6 with id-1): "to whoever may see it": arrows in a category the rules set marks unidentified show the
    // player no note at all; the GM sees it, marked.
    const unknown = [{ itemCategories: [{ id: 'odd-arrows', unidentified: true }] }];
    const heron = { ...REED, weapon: { ...REED.weapon, magicBonus: 2 } };
    const arrows = { name: 'Ember arrows', data: { weapon: { magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 3 }] } }, category: 'odd-arrows' };
    expect(weaponMagic({ name: 'Heron bow', data: heron }, unknown, false, arrows).hitNotes).toEqual([]);
    expect(weaponMagic({ name: 'Heron bow', data: heron }, unknown, true, arrows).hitNotes).toContain('Ember arrows, +3 vs bog lurkers (hidden from the player)');
  });

  it('keeps a cursed or unidentified arrow’s bonus from the player, the GM seeing it marked', () => {
    // Purpose: the hidden-bonus rule (mw-1 point 4) still holds for mw-5's counted ammunition.
    const cursed = { ...EMBER, data: { cursed: true, weapon: { magicBonus: -1 } } };
    expect(weaponMagic({ name: 'Reed bow', data: REED }, [], false, cursed)).toEqual({ parts: [], hitNotes: [], damageNotes: [] });
    expect(weaponMagic({ name: 'Reed bow', data: REED }, [], true, cursed).parts).toEqual([{ label: 'Ember arrows, magic (hidden from the player)', value: -1 }]);
  });

  it('with "add", counts both the launcher’s and the arrows’ bonus, unchanged', () => {
    // Purpose: mw-3 stands beside mw-5.
    const heron = { ...REED, weapon: { ...REED.weapon, magicBonus: 2 } };
    expect(weaponMagic({ name: 'Heron bow', data: heron }, [{ attack: { ammunitionBonus: 'add' } }], false, EMBER).parts.map((p) => p.value)).toEqual([2, 1]);
  });

  it('names the ammunition in its bonus against a kind of foe, a note never added; the launcher’s own stay as they were', () => {
    // Purpose (as-4 ⚑, built not ruled): "Ember arrows, +3 vs bog lurkers" under the to-hit and "Ember arrows, damage +4
    // vs marsh wights" under the damage; the bow's own "+1 vs reed hags" unchanged; none in the sums.
    const bow = { ...REED, weapon: { ...REED.weapon, bonusVs: [{ against: 'reed hags', bonus: 1 }] } };
    const arrows = { name: 'Ember arrows', data: { weapon: { bonusVs: [{ against: 'bog lurkers', bonus: 3 }, { against: 'marsh wights', damage: 4 }] } }, category: 'ammunition' };
    const magic = weaponMagic({ name: 'Reed bow', data: bow }, [], false, arrows);
    expect(magic).toEqual({ parts: [], hitNotes: ['+1 vs reed hags', 'Ember arrows, +3 vs bog lurkers'], damageNotes: ['Ember arrows, damage +4 vs marsh wights'] });
    expect(weaponRolls(bow, strong, WARDEN, 2, [], { ...named, magic })[0]!.line).toBe('Roll 1d20 + 2 to hit');
  });
});

describe('a curse always counts (as-5)', () => {
  const HERON = { name: 'Heron bow', weapon: { damage: '1d6', qualities: ['Missile'], magicBonus: 2 } };
  const SOUR = { name: 'Sour arrows', data: { weapon: { magicBonus: -1 } }, category: 'ammunition' };

  it('adds a cursed arrow from a magic bow in a setting that says nothing, to hit and damage, the GM seeing it marked', () => {
    // Purpose (as-5, ruled 2026-11-10): a negative bonus on the drawn ammunition is added whatever the launcher and the
    // rule on adding two bonuses: a −1 arrow from a +2 bow with no rule counts as its own row, not the GM's mw-4 note.
    const gm = weaponMagic({ name: 'Heron bow', data: HERON }, [], true, SOUR);
    expect(gm).toEqual({ parts: [{ label: 'Heron bow, magic', value: 2 }, { label: 'Sour arrows, magic (hidden from the player)', value: -1 }], hitNotes: [], damageNotes: [] });
    const [hit, damage] = weaponRolls(HERON, strong, WARDEN, 2, [], { ...named, magic: gm });
    expect(hit!.line).toBe('Roll 1d20 + 3 to hit');
    expect(damage!.line).toBe('Roll 1d6 + 1 for damage');
  });

  it('keeps the cursed arrow’s row from the player, whose sheet reads as if the arrows were plain', () => {
    // Purpose (as-5 with id-1, and #594's hidden rule): the curse counts for the GM's true figure; the player sees the bow's
    // bonus alone until the arrows are identified (seeing it after one use waits for M6).
    expect(weaponMagic({ name: 'Heron bow', data: HERON }, [], false, SOUR)).toEqual({ parts: [{ label: 'Heron bow, magic', value: 2 }], hitNotes: [], damageNotes: [] });
  });
});

describe('specialised in a weapon outside the class (as-7)', () => {
  it('shows both rows, "Specialised" and "Not your class’s weapon", netted in the to-hit line, the bonus alone in damage', () => {
    // Purpose (as-7, ruled 2026-11-10): a GM-approved specialisation in a weapon the class may not use: the two skill rows,
    // +1 and −2, come to −1 between them in the to-hit line (the line itself, with the class and score, reads + 1); the
    // damage card has the specialisation's +2 alone.
    const p = { note: '', start: 3, gainEvery: null, penalty: -2, specialisation: { cost: 2, attack: 1, damage: 2, note: '' }, restricted: { note: '' } };
    const skill = weaponPenalty([{ itemId: 'reed-bow', specialised: true }], { packEntryId: 'reed-bow', name: '', data: BOW }, { weaponsAllowed: { mode: 'tags', allowTags: ['Melee'] } }, p);
    const [hit, damage] = weaponRolls(BOW, strong, WARDEN, 2, [], { ...named, skill });
    expect(hit!.parts.slice(-2)).toEqual([
      { label: 'Specialised', value: '+1' },
      { label: 'Not your class’s weapon', value: '−2' },
    ]);
    expect(hit!.line).toBe('Roll 1d20 + 1 to hit');
    expect(damage!.parts.at(-1)).toEqual({ label: 'Specialised', value: '+2' });
    expect(damage!.line).toBe('Roll 1d6 + 2 for damage');
    expect(weaponFigures(BOW, strong, WARDEN, 2, [], { skill })).toBe('+1, 1d6+2');
  });
});

describe('a weapon skill in the rolls (as-4)', () => {
  const specialised = { attack: 1, damage: 2, source: 'specialised' as const, label: 'Specialised' };
  const notMine = { attack: -2, damage: 0, source: 'not a weapon skill of yours' as const, label: 'Not a weapon skill of yours' };

  it('shows a specialised weapon’s bonus as a row in both cards, counted in each line, before the magic', () => {
    // Purpose: as-4: "Specialised +1" to hit and "Specialised +2" to damage, each counted in its card's top line.
    const [hit, damage] = weaponRolls(SPEAR, strong, WARDEN, 2, BY_MIGHT, { ...named, skill: specialised });
    expect(hit!.line).toBe('Roll 1d20 + 3 to hit');
    expect(hit!.parts.at(-1)).toEqual({ label: 'Specialised', value: '+1' });
    expect(damage!.line).toBe('Roll 1d6 + 3 for damage');
    expect(damage!.parts.at(-1)).toEqual({ label: 'Specialised', value: '+2' });
  });

  it('shows the penalty for a weapon that isn’t the character’s skill to hit only', () => {
    // Purpose: as-4: "Not a weapon skill of yours −2" in the to-hit card; the damage card has no such row.
    const [hit, damage] = weaponRolls(SPEAR, strong, WARDEN, 2, BY_MIGHT, { ...named, skill: notMine });
    expect(hit!.line).toBe('Roll 1d20 to hit');
    expect(hit!.parts.at(-1)).toEqual({ label: 'Not a weapon skill of yours', value: '−2' });
    expect(damage!.parts.map((p) => p.label)).not.toContain('Not a weapon skill of yours');
  });

  it('counts the skill in At hand’s line and the item sheet’s breakdown alike', () => {
    // Purpose: as-4: the same totals wherever At hand or the item sheet shows them.
    expect(weaponFigures(SPEAR, strong, WARDEN, 2, BY_MIGHT, { skill: specialised })).toBe('+3, 1d6+3');
    expect(weaponFigures(SPEAR, strong, WARDEN, 2, BY_MIGHT, { skill: notMine })).toBe('+0, 1d6+1');
    const rows = weaponBreakdown(SPEAR, strong, WARDEN, 2, BY_MIGHT, { skill: specialised });
    expect(rows).toContainEqual({ label: 'Specialised +1', value: '+3' });
    expect(rows).toContainEqual({ label: 'Damage, Specialised +2', value: '1d6+3' });
  });
});

describe('the sum each roll carries, read by the weapon in hand (dec-13 C14)', () => {
  it('carries the sum its line says, so the Player screen reads it and never adds the parts again', () => {
    // Purpose: C14 "never a second sum": the to-hit's `adds` is the +2 its line says, the damage's the +1.
    const [hit, damage] = weaponRolls(SPEAR, strong, WARDEN, 2, BY_MIGHT, named);
    expect([hit!.adds, damage!.adds]).toEqual([2, 1]);
  });

  it('carries a zero and a penalty as numbers, the line dropping the zero', () => {
    // Purpose: a sum of nothing is 0 (the line says "Roll 1d20 to hit"); a penalty is negative ("− 1").
    const [hit] = weaponRolls(SPEAR, { 'abilityModifiers.MIG': { melee: -1 } }, WARDEN, 1, [], named);
    expect(hit!.adds).toBe(0);
    const damage = weaponRolls(SPEAR, { 'abilityModifiers.MIG': { melee: -1 } }, WARDEN, 1, BY_MIGHT, named).at(-1)!;
    expect(damage.adds).toBe(-1);
  });

  it('says which of a weapon’s two kinds a roll is for, and nothing when it has one kind or the damage is alike', () => {
    // Purpose: a weapon both melee and missile has a to-hit for each, named by `which`; its one damage roll names none.
    const rolls = weaponRolls({ name: 'Eel spear', weapon: { damage: '1d6', qualities: ['Melee', 'Missile'] } }, strong, WARDEN, 2, BY_MIGHT, named);
    expect(rolls.map((r) => [r.roll, r.which, r.adds])).toEqual([
      ['hit', 'melee', 2],
      ['hit', 'missile', 2],
      ['damage', 'melee', 1],
      ['damage', 'missile', 0],
    ]);
    expect(weaponRolls(SPEAR, strong, WARDEN, 2, [], named).map((r) => r.which)).toEqual([null, null]);
  });

  it('with a target figure carries only what the scores add, never the class’s target', () => {
    // Purpose: descending AC (as-1): the class's figure is a target, not added, so `adds` is the score's +1 alone.
    const [hit] = weaponRolls(BOW, strong, { progression: [{ level: 2, thac0: 19 }] }, 2, [], { ...named, direction: 'descending' });
    expect(hit!.adds).toBe(1);
  });
});
