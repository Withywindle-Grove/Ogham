import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './fields.ts';
import {
  acDirection,
  acEmpty,
  acLines,
  acShown,
  attackIsBonus,
  attackLine,
  baseArmourChoices,
  bonusHidden,
  combatFields,
  hpSegments,
  saveRules,
  savesOf,
  skillOdds,
  weaponBreakdown,
  weaponFigures,
  skillsOf,
  classSkillsNote,
  unarmouredAc,
  workOutAc,
  wornForAc,
  type WornGear,
} from './play.ts';

// Invented content only (hard rule 2).
const field = (key: string, label: string, extra: Partial<FieldDefinition> = {}) => ({ key, label, hidden: false, fill: null, ...extra }) as FieldDefinition;

describe("the Player screen's figures (ruled 2026-10-26)", () => {
  it('finds the AC field and the attack field, by key, label or fill', () => {
    const found = combatFields([field('ac', 'AC'), field('thac0', 'THAC0 [attack bonus]'), field('move', 'Movement')]);
    expect(found.ac?.key).toBe('ac');
    expect(found.attack?.key).toBe('thac0');
    expect(combatFields([field('hit', 'To hit', { fill: 'attack' })]).attack?.key).toBe('hit');
    expect(combatFields([field('ac', 'AC', { hidden: true })]).ac).toBeUndefined();
  });

  it('the HP bar: one segment per HP up to 12, one per 5 above, a part-lost segment partly filled', () => {
    expect(hpSegments(3, 4)).toEqual({ per: 1, fills: [1, 1, 1, 0] });
    expect(hpSegments(12, 12).fills).toHaveLength(12);
    expect(hpSegments(23, 27)).toEqual({ per: 5, fills: [1, 1, 1, 1, 0.6, 0] });
    expect(hpSegments(20, 27).fills).toEqual([1, 1, 1, 1, 0, 0]);
    expect(hpSegments(17, 27).fills).toEqual([1, 1, 1, 0.4, 0, 0]);
    // The last segment holds what's left over (27 = 5 × 5 + 2).
    expect(hpSegments(26, 27).fills).toEqual([1, 1, 1, 1, 1, 0.5]);
    expect(hpSegments(-3, 6).fills.every((f) => f === 0)).toBe(true);
    expect(hpSegments(5, null).fills).toEqual([]);
  });

  // Purpose: a most above 100 HP would need more than 20 pips, so it is one continuous fill (plan m5b-sheet-revised 13).
  it('the HP bar above 20 segments is one continuous fill, and 20 is still pips', () => {
    expect(hpSegments(100, 100).fills).toHaveLength(20);
    expect(hpSegments(101, 101).fills).toEqual([1]);
    expect(hpSegments(250, 500)).toEqual({ per: 500, fills: [0.5] });
    expect(hpSegments(0, 150).fills).toEqual([0]);
    expect(hpSegments(-4, 150).fills).toEqual([0]);
    expect(hpSegments(900, 150).fills).toEqual([1]);
    expect(hpSegments(40, null).fills).toEqual([]);
  });

  it('the attack sub-line names melee and missile from the scores', () => {
    expect(attackLine({ 'abilityModifiers.STR': { melee: 1 }, 'abilityModifiers.DEX': { missile: -1, ac: -1 } })).toBe('Melee +1, Missile −1');
    expect(attackLine({ attack: 19 })).toBe('');
  });

  it("a skill reads in its pack's style, with the odds both ways (CS-5a)", () => {
    expect(skillOdds(2, 'd6')).toEqual({ shown: '2-in-6', odds: 'Succeeds on 5 or 6, 2 in 6' });
    expect(skillOdds(1, 'd6').odds).toBe('Succeeds on 6, 1 in 6');
    expect(skillOdds(3, 'd6').odds).toBe('Succeeds on 4, 5 or 6, 3 in 6');
    expect(skillOdds('2-in-6', undefined).shown).toBe('2-in-6');
    expect(skillOdds(35, '%')).toEqual({ shown: '35%', odds: 'Succeeds on 35 or less on d100, 35 in 100' });
    expect(skillOdds('5+', undefined)).toEqual({ shown: '5+', odds: 'Succeeds on 5 or more' });
    expect(skillOdds('special', undefined)).toEqual({ shown: 'special', odds: null });
  });

  it("the class's skills in the class's order and names; the GM's secret rolls marked", () => {
    const klass = { skills: { names: { HS: 'Hide in reeds', LW: 'Listen at water' }, die: 'd6', gmRolls: ['LW'] } };
    expect(skillsOf({ 'skills.LW': 2, 'skills.HS': 1, attack: 19 }, klass)).toEqual([
      { code: 'HS', name: 'Hide in reeds', shown: '1-in-6', odds: 'Succeeds on 6, 1 in 6', chance: { hits: 1, sides: 6 }, gmRolls: false, group: 'class' },
      { code: 'LW', name: 'Listen at water', shown: '2-in-6', odds: 'Succeeds on 5 or 6, 2 in 6', chance: { hits: 2, sides: 6 }, gmRolls: true, group: 'class' },
    ]);
    expect(skillsOf({ attack: 19 }, klass)).toEqual([]);
  });

  it("saves in the setting's order with its short names; a save the setting doesn't name still shows", () => {
    const rules = [{ saveCategories: [{ key: 'R', name: 'Save vs river', short: 'River', note: 'Floods and fords.' }, { key: 'M', name: 'Mire, bog and fen' }] }];
    // Without a short name the tile's word is the name's first word, never the bare key (the 2026-11-09 ruling, F8).
    expect(savesOf({ 'saves.M': 13, 'saves.R': 12, 'saves.X': 15 }, rules)).toEqual([
      { key: 'R', name: 'Save vs river', short: 'River', value: '12', note: 'Floods and fords.' },
      { key: 'M', name: 'Mire, bog and fen', short: 'Mire', value: '13', note: '' },
      { key: 'X', name: 'Save X', short: 'Save X', value: '15', note: '' },
    ]);
    expect(savesOf({ 'saves.R': 12 }, [{ saveCategories: { R: 'Save vs river' } }])[0]!.name).toBe('Save vs river');
    // The setting's short description (N23) also comes as `notes`, as entries carry it elsewhere in packs.
    expect(savesOf({ 'saves.R': 12 }, [{ saveCategories: [{ key: 'R', name: 'Ripple', notes: 'Fast effects that can be dodged.' }] }])[0]!.note).toBe('Fast effects that can be dodged.');
  });

  it("AC with nothing worn is the setting's value (N22): one number, or one per style picked by the setting's style or the campaign's choice", () => {
    expect(unarmouredAc([{ attack: { unarmouredAC: 11 } }])).toBe(11);
    const both = { attack: { unarmouredAC: { low: 8, high: 11 } } };
    expect(unarmouredAc([both], 'high')).toBe(11);
    expect(unarmouredAc([both], 'low-table')).toBe(8);
    expect(unarmouredAc([{ attack: { ...both.attack, style: 'high' } }], 'low')).toBe(11);
    // Without a style it takes the first the setting gives; without a value, there's none.
    expect(unarmouredAc([both])).toBe(8);
    expect(unarmouredAc([{ attack: {} }])).toBeNull();
    expect(unarmouredAc([])).toBeNull();
  });

  // Ruled 2026-10-29 (B9). Invented numbers throughout.
  describe('AC as players use it (B9)', () => {
    const names = (k: string) => ({ NIM: 'Nimbleness' })[k] ?? k;
    const rising = [{ attack: { style: 'ascending', unarmouredAC: { ascending: 10 }, shieldBonus: 1 } }];
    const falling = [{ attack: { unarmouredAC: { descending: 9, ascending: 10 } } }];
    const nimble = { 'abilityModifiers.NIM': { ac: 2, missile: 2 } };
    const reedCoat: WornGear = { name: 'Reed coat', slot: 'armour', armour: { aac: 13, ac: 6 } };
    const buckler: WornGear = { name: 'Bog buckler', slot: 'shield', armour: { acBonus: 1 } };

    it("reads the setting's AC direction from the rules set, else the campaign's style choice, else the one it names, else ascending", () => {
      expect(acDirection(rising)).toBe('ascending');
      expect(acDirection(falling, 'descending-matrix')).toBe('descending');
      expect(acDirection([{ attack: { unarmouredAC: { descending: 9 } } }])).toBe('descending');
      expect(acDirection(falling)).toBe('ascending');
      expect(acDirection([])).toBe('ascending');
    });

    it('with nothing worn: the unarmoured base plus the ability modifier, each listed', () => {
      const worked = workOutAc({ rulesSets: rising, chosenStyle: null, worn: [], filled: nimble, abilityName: names });
      expect(worked).toEqual({ value: 12, lines: ['Unarmoured: 10', 'Nimbleness: +2'], known: true });
    });

    it("with armour and a shield worn: the armour's AC from the pack, the shield's bonus, then the modifier", () => {
      const worked = workOutAc({ rulesSets: rising, chosenStyle: null, worn: [reedCoat, buckler], filled: nimble, abilityName: names });
      expect(worked.value).toBe(16);
      expect(worked.lines).toEqual(['Reed coat: 13', 'Bog buckler: +1', 'Nimbleness: +2']);
      // A shield without its own bonus takes the rules set's.
      expect(workOutAc({ rulesSets: rising, chosenStyle: null, worn: [{ name: 'Plank', slot: 'shield', armour: {} }], filled: {}, abilityName: names }).value).toBe(11);
    });

    it('where lower is better, bonuses take the number down and the breakdown says so', () => {
      const worked = workOutAc({ rulesSets: falling, chosenStyle: 'descending-matrix', worn: [reedCoat, buckler], filled: nimble, abilityName: names });
      expect(worked.value).toBe(3);
      expect(worked.lines).toEqual(['Reed coat: 6', 'Bog buckler: −1', 'Nimbleness: −2', 'Lower is better.']);
    });

    it("never guesses: no AC for the armour (or no unarmoured AC) gives no number, and says why", () => {
      const bare: WornGear = { name: 'Moss cloak', slot: 'armour', armour: { bulk: 'light' } };
      const worked = workOutAc({ rulesSets: rising, chosenStyle: null, worn: [bare], filled: nimble, abilityName: names });
      expect(worked.value).toBeNull();
      expect(worked.lines[0]).toBe('Moss cloak: no AC in the setting rules');
      expect(workOutAc({ rulesSets: [], chosenStyle: null, worn: [], filled: {}, abilityName: names }).value).toBeNull();
      // Still loading what's worn: nothing yet.
      expect(workOutAc({ rulesSets: rising, chosenStyle: null, worn: null, filled: {}, abilityName: names })).toEqual({ value: null, lines: [], known: false });
    });

    it('the AC shown: a value set by hand, else the worked-out number, else nothing ("—" and Set AC)', () => {
      const worked = (value: number | null) => ({ value, lines: [], known: true });
      expect(acShown('14', worked(12))).toBe('14');
      expect(acShown(null, worked(12))).toBe('12');
      expect(acShown(null, worked(-2))).toBe('−2');
      expect(acShown(null, worked(null))).toBeNull();
    });
  });

  // Ruled 2026-10-29 (the armour block, Set AC). Invented numbers throughout.
  describe('the armour block and the AC set by hand', () => {
    const names = (k: string) => k;
    const rising = [{ attack: { style: 'ascending', unarmouredAC: 10, shieldBonus: 2 } }];
    const falling = [{ attack: { style: 'descending', unarmouredAC: 9 } }];
    const work = (rulesSets: Record<string, unknown>[], worn: WornGear[], seesHidden = false) =>
      workOutAc({ rulesSets, chosenStyle: null, worn, filled: {}, abilityName: names, seesHidden });

    it('a plain number is the base; a block gives aac or ac for the direction, else its base', () => {
      expect(work(rising, [{ name: 'Bark vest', slot: 'armour', armour: 12 }]).value).toBe(12);
      expect(work(rising, [{ name: 'Reed coat', slot: 'armour', armour: { base: 11, ac: 7, aac: 13 } }]).value).toBe(13);
      expect(work(falling, [{ name: 'Reed coat', slot: 'armour', armour: { base: 11, ac: 7, aac: 13 } }]).value).toBe(7);
      expect(work(falling, [{ name: 'Bark vest', slot: 'armour', armour: { base: 8, type: 'light' } }]).value).toBe(8);
      // The old direction names aren't read (the checker names the new keys): no number, never a guess.
      expect(work(rising, [{ name: 'Old coat', slot: 'armour', armour: { ascending: 14 } }]).value).toBeNull();
    });

    it("a shield's own acBonus wins over the rules set's shield bonus; other worn items add their acBonus", () => {
      const worked = work(rising, [
        { name: 'Reed buckler', slot: 'shield', armour: { acBonus: 1 } },
        { name: 'Plank', slot: 'shield', armour: {} },
        { name: 'Moth-wing ring', slot: 'hand', armour: { acBonus: 1 } },
      ]);
      expect(worked.value).toBe(14);
      expect(worked.lines).toEqual(['Unarmoured: 10', 'Reed buckler: +1', 'Plank: +2', 'Moth-wing ring: +1']);
    });

    it('a magic bonus makes AC better (taken off where lower is better)', () => {
      const coat: WornGear = { name: 'Glimmer coat', slot: 'armour', armour: { ac: 6, aac: 13, magicBonus: 2 } };
      expect(work(rising, [coat])).toMatchObject({ value: 15, lines: ['Glimmer coat: 13', 'Glimmer coat, magic: +2'] });
      expect(work(falling, [coat]).value).toBe(4);
    });

    it("a hidden magic bonus (unidentified category or cursed) leaves the player's numbers alone; the GM sees the true AC", () => {
      const unknownKind = [{ ...rising[0], itemCategories: [{ id: 'magic-armour', name: 'Strange armour', unidentified: true }] }];
      const coat: WornGear = { name: 'Dull coat', slot: 'armour', armour: { aac: 13, magicBonus: 2 }, category: 'magic-armour' };
      expect(work(unknownKind, [coat])).toMatchObject({ value: 13, lines: ['Dull coat: 13'] });
      expect(work(unknownKind, [coat], true)).toMatchObject({ value: 15, lines: ['Dull coat: 13', 'Dull coat, magic: +2 (hidden from the player)'] });
      const cursed: WornGear = { name: 'Itchy coat', slot: 'armour', armour: { aac: 13, magicBonus: -1 }, cursed: true };
      expect(work(rising, [cursed]).value).toBe(13);
      expect(work(rising, [cursed], true).value).toBe(12);
      expect(bonusHidden({ name: 'Plain coat', slot: 'armour', armour: 12, category: 'armour' }, unknownKind)).toBe(false);
    });

    it('a bonus the GM told counts in the player’s numbers from then on, curse or not (K22a)', () => {
      // Purpose: bonusHidden reads what was told on the line, not the category alone: once "bonus" is in its revealed
      // fields the player's AC counts it, unmarked; untold it stays out (K22a; 05, a told bonus counts).
      const unknownKind = [{ ...rising[0], itemCategories: [{ id: 'magic-armour', name: 'Strange armour', unidentified: true }] }];
      const coat: WornGear = { name: 'Dull coat', slot: 'armour', armour: { aac: 13, magicBonus: 2 }, category: 'magic-armour', told: ['magic', 'bonus'] };
      expect(work(unknownKind, [coat])).toMatchObject({ value: 15, lines: ['Dull coat: 13', 'Dull coat, magic: +2'] });
      expect(work(unknownKind, [{ ...coat, told: ['magic'] }]).value).toBe(13);
      const cursed: WornGear = { name: 'Itchy coat', slot: 'armour', armour: { aac: 13, magicBonus: -1 }, cursed: true, told: ['cursed', 'bonus'] };
      expect(work(rising, [cursed])).toMatchObject({ value: 12, lines: ['Itchy coat: 13', 'Itchy coat, magic: −1'] });
    });

    it('counts armour, shields and any worn item whose block gives a bonus', () => {
      expect(wornForAc({ slot: 'armour' })).toBe(true);
      expect(wornForAc({ slot: 'shield' })).toBe(true);
      expect(wornForAc({ slot: 'hand', armour: { acBonus: 1 } })).toBe(true);
      expect(wornForAc({ slot: 'hand', armour: { magicBonus: 1 } })).toBe(true);
      expect(wornForAc({ slot: 'hand' })).toBe(false);
      expect(wornForAc({ slot: 'hand', armour: { type: 'light' } })).toBe(false);
    });

    it('an AC set by hand wins over everything, and its pop-up says what Clear brings back', () => {
      const worked = (value: number | null) => ({ value, lines: ['Unarmoured: 10'], known: true });
      expect(acShown(null, worked(12), 0)).toBe('0');
      expect(acShown('14', worked(12), -2)).toBe('−2');
      expect(acShown(null, worked(12), 999)).toBe('999');
      expect(acLines(null, worked(12), 5)).toEqual(['Set by hand: 5.', 'Clear it to go back to 12.']);
      expect(acLines(null, worked(null), 5)).toEqual(['Set by hand: 5.', 'Clear it to go back to "—".']);
    });

    // Purpose: tfw-1 (2026-11-19): on the sheet and the Player tab the Armour class pop-up ends with how the figure is
    // worked out, with no line about the GM, for a worked figure and for one typed on the sheet.
    it('the pop-up ends with the worked figure or the typed one, never a line about the GM', () => {
      const worked = (value: number | null) => ({ value, lines: ['Unarmoured: 10', 'Nimbleness: +2'], known: true });
      expect(acLines(null, worked(12))).toEqual(['Unarmoured: 10', 'Nimbleness: +2']);
      expect(acLines('14', worked(12))).toEqual(['Set by hand: 14.']);
      for (const lines of [acLines(null, worked(12)), acLines('14', worked(12)), acLines(null, worked(12), 5), acLines(null, worked(null))]) {
        expect(lines.join(' ')).not.toMatch(/GM/);
      }
    });
  });

  // Ruled 2026-10-29 (engine rulings, pack format): magic armour whose base is picked once when it's found.
  describe('magic armour with a base to choose (armour.baseArmour)', () => {
    const names = (k: string) => k;
    const rising = [{ attack: { style: 'ascending', unarmouredAC: 10 } }];
    const falling = [{ attack: { style: 'descending', unarmouredAC: 9 } }];
    const glimmer: WornGear = { name: 'Glimmer mail', slot: 'armour', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } } };
    const reedCoat = { id: 'reed-coat', name: 'Reed coat', armour: { ac: 7, aac: 12, type: 'light' } };
    const work = (rulesSets: Record<string, unknown>[], worn: WornGear[]) => workOutAc({ rulesSets, chosenStyle: null, worn, filled: {}, abilityName: names });

    it('with a base chosen, AC is the chosen base plus the magic bonus, in either direction', () => {
      expect(work(rising, [{ ...glimmer, chosenBase: reedCoat }])).toEqual({ value: 13, lines: ['Glimmer mail (Reed coat): 12', 'Glimmer mail, magic: +1'], known: true });
      expect(work(falling, [{ ...glimmer, chosenBase: reedCoat }]).value).toBe(6);
    });

    it('with no base chosen yet, there is no number and AC shows "Choose base armour", not "—"', () => {
      const worked = work(rising, [glimmer]);
      expect(worked).toMatchObject({ value: null, known: true, chooseBase: { item: 'Glimmer mail', choices: ['reed-coat', 'bark-vest'] } });
      expect(worked.lines[0]).toBe('Glimmer mail: choose base armour');
      expect(acEmpty(worked)).toBe('Choose base armour');
      expect(acLines(null, worked).at(-1)).toBe('Choose the base armour for Glimmer mail to work out AC.');
      expect(acShown(null, worked)).toBeNull();
      expect(work(rising, [{ ...glimmer, chosenBase: null }]).chooseBase).toBeDefined();
    });

    it('anything else with no number still shows "—"', () => {
      expect(acEmpty(work([], []))).toBe('—');
    });

    it('reads only a non-empty list of ids; armour.class and armour.bulk are never read', () => {
      expect(baseArmourChoices({ baseArmour: { choose: ['reed-coat', 3, ''] } })).toEqual(['reed-coat']);
      expect(baseArmourChoices({ baseArmour: { choose: [] } })).toBeNull();
      expect(baseArmourChoices({ baseArmour: 'reed-coat' })).toBeNull();
      expect(baseArmourChoices(12)).toBeNull();
      expect(work(rising, [{ name: 'Old coat', slot: 'armour', armour: { class: 'light', bulk: 'heavy', aac: 12 } }]).value).toBe(12);
    });
  });

  it("how saves are rolled and what changes them, from the rules set", () => {
    expect(saveRules([{ saveRule: 'Roll a d20; meet the number to save.', saveModifiers: [{ name: 'Against bog magic', value: 2 }] }])).toEqual([
      'Roll a d20; meet the number to save.',
      'Against bog magic +2',
    ]);
    expect(saveRules([{}])).toEqual([]);
  });
});

// M5 gate C3 (ruled 2026-11-01; 05 At hand): a weapon at hand shows its attack bonus and damage from the pack.
describe('weaponFigures', () => {
  // An invented class: an attack bonus that grows at level 3, and a descending-only one (no bonus given).
  const lantern = { progression: [{ level: 1, attackBonus: 1, thac0: 19 }, { level: 3, attackBonus: 2, thac0: 18 }] };
  const scores = { 'abilityModifiers.STR': { melee: 1 }, 'abilityModifiers.DEX': { missile: -1 } };

  it("adds the scores' melee modifier to the class's bonus for a melee weapon, at the character's level", () => {
    expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, lantern, 1)).toBe('+2, 1d6');
    expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, lantern, 4)).toBe('+3, 1d6');
  });

  it('uses the missile modifier for a missile weapon, and names both for a weapon that is both', () => {
    expect(weaponFigures({ weapon: { damage: '1d4', qualities: ['Missile'] } }, scores, lantern, 1)).toBe('+0, 1d4');
    expect(weaponFigures({ weapon: { damage: '1d4' }, weaponTags: ['Melee', 'Missile'] }, scores, lantern, 1)).toBe('Melee +2, Missile +0, 1d4');
  });

  it("reads `attack` as the bonus only when the row has no thac0", () => {
    expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, {}, { progression: [{ level: 1, attack: 3 }] }, 1)).toBe('+3, 1d8');
    expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, {}, { progression: [{ level: 1, attack: 19, thac0: 19 }] }, 1)).toBe('1d8');
  });

  it('shows the damage die alone when the pack gives no attack bonus, and nothing for an item that is not a weapon', () => {
    expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, null, 1)).toBe('1d6');
    expect(weaponFigures({ name: 'Rope' }, scores, lantern, 1)).toBeNull();
    expect(weaponFigures(null, scores, lantern, 1)).toBeNull();
  });

  // C3's follow-up (ruled 2026-11-01): the rules set's attack.damageScore names the score whose modifier adds to damage.
  describe('with attack.damageScore', () => {
    const strong = [{ attack: { damageScore: 'STR' } }];

    it("adds the named score's melee modifier to a melee weapon's damage", () => {
      expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, scores, lantern, 1, strong)).toBe('+2, 1d8+1');
    });

    it('adds nothing to a missile weapon when the score has only a melee modifier, and shows a negative modifier with a minus', () => {
      expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Missile'] }, scores, lantern, 1, strong)).toBe('+0, 1d6');
      expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, { 'abilityModifiers.STR': { melee: -2 } }, lantern, 1, strong)).toBe('−1, 1d6−2');
    });

    it('gives a weapon that is both its damage beside each kind when they differ', () => {
      expect(weaponFigures({ weapon: { damage: '1d4' }, weaponTags: ['Melee', 'Missile'] }, scores, lantern, 1, strong)).toBe('Melee +2, 1d4+1, Missile +0, 1d4');
      expect(weaponFigures({ weapon: { damage: '1d4' }, weaponTags: ['Melee', 'Missile'] }, scores, null, 1, strong)).toBe('Melee 1d4+1, Missile 1d4');
    });

    it('adds the damage modifier even when the pack gives no attack bonus', () => {
      expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, null, 1, strong)).toBe('1d6+1');
    });

    it('shows the die alone when the field is absent, or names a score the character has no modifier for', () => {
      expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, scores, lantern, 1, [{ attack: {} }])).toBe('+2, 1d8');
      expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, scores, lantern, 1, [{ attack: { damageScore: 'MIG' } }])).toBe('+2, 1d8');
      expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, { 'abilityModifiers.STR': { melee: 0 } }, lantern, 1, strong)).toBe('+1, 1d8');
    });
  });
});

// A4 (bq3-13): weapons at hand follow the campaign's AC style.
describe('weaponFigures with descending AC (A4)', () => {
  const lantern = { progression: [{ level: 1, attackBonus: 1, thac0: 19 }] };
  const scores = { 'abilityModifiers.STR': { melee: 1 }, 'abilityModifiers.DEX': { missile: -1 } };

  it("shows the class's target number less the score's modifier, after the attack field's name", () => {
    // Purpose: with descending AC a weapon at hand reads as the sheet's attack field does, never as a bonus.
    const style = { direction: 'descending' as const, targetLabel: 'THAC0' };
    expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, lantern, 1, [], style)).toBe('THAC0 18, 1d6');
    expect(weaponFigures({ weapon: { damage: '1d4' }, weaponTags: ['Missile'] }, scores, lantern, 1, [], style)).toBe('THAC0 20, 1d4');
    expect(weaponFigures({ weapon: { damage: '1d4' }, weaponTags: ['Melee', 'Missile'] }, scores, lantern, 1, [], style)).toBe('Melee 18, Missile 20, 1d4');
    // Ascending (or no style): the bonus, as before.
    expect(weaponFigures({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, lantern, 1, [], { direction: 'ascending' })).toBe('+2, 1d6');
  });

  it("keeps the rule's die, a patch's delta and the reason beside the target number", () => {
    // Purpose: with descending AC and a rule that sets every weapon's die (of-8) plus a patch's −1, the line reads the target number, then the rule's die less the patch, then the rule's reason.
    const rulesSets = [{ attack: { weaponDamage: 'd6' } }];
    const options = { direction: 'descending' as const, targetLabel: 'THAC0', damageReason: 'All weapons d6', damageDelta: -1 };
    expect(weaponFigures({ weapon: { damage: '1d8' }, weaponTags: ['Melee'] }, scores, lantern, 1, rulesSets, options)).toBe('THAC0 18, d6−1, All weapons d6');
  });
});

describe('skills in two groups, the pack’s way (sr-2)', () => {
  const rulesSets = [
    {
      skills: [
        { id: 'hark', name: 'Hark', die: 'd6', default: 6, rollMode: 'equal-or-over', gmRolls: true, fill: { races: { 'race-reed': 5 } } },
        { id: 'forage', name: 'Forage the fen', die: 'd6', default: 1 },
      ],
    },
  ];
  const stalker = { skills: { names: { 'slip-reeds': 'Slip through reeds', 'pick-lock': 'Pick lock', hark: 'Hark' }, die: 'd%', gmRolls: ['slip-reeds'], byLevel: [] } };

  it("everyone's skills first by the rules set's names, then the class's own; each in the pack's notation", () => {
    // Purpose: a class's skills appear in the class's group, never mixed into everyone's, and a skill both name is everyone's.
    const filled = { 'skills.hark': 5, 'skills.forage': 1, 'skills.slip-reeds': 87, 'skills.pick-lock': 20 };
    const skills = skillsOf(filled, stalker, {}, rulesSets, { race: null, raceRef: 'race-reed' });
    expect(skills.map((s) => `${s.group}:${s.name} ${s.shown}`)).toEqual(['everyone:Hark 5+', 'everyone:Forage the fen 1-in-6', 'class:Slip through reeds 87%', 'class:Pick lock 20%']);
    // The kindred's number is the one that counts: tagged.
    expect(skills[0]!.byRace).toBe(true);
    expect(skills[0]!.gmRolls).toBe(true);
    expect(skills[1]!.byRace).toBeUndefined();
    expect(skills[2]!.gmRolls).toBe(true);
  });

  it('reads a skill rolled at or over its target, a percentage die with words after it, and words as they are', () => {
    // Purpose: "5+" not "5-in-6" for an equal-or-over skill; "87%" for "d% (…)"; "1-2" stays "1-2".
    expect(skillOdds(5, 'd6', 'equal-or-over')).toEqual({ shown: '5+', odds: 'Succeeds on 5 or more, 2 in 6' });
    expect(skillOdds(87, 'd% (one on d6)').shown).toBe('87%');
    expect(skillOdds('1-2', 'd% (one on d6)').shown).toBe('1-2');
    expect(skillOdds(2, 'd6').shown).toBe('2-in-6');
  });
});

describe("a skill's own words, from the pack (R3-13, G-210)", () => {
  const rulesSets = [{ skills: [{ id: 'hark', name: 'Hark', die: 'd6', default: 1, notes: 'Hearing what waits behind a door.' }, { id: 'wade', name: 'Wade', die: 'd6', default: 1 }] }];
  const filled = { 'skills.hark': 1, 'skills.wade': 1, 'skills.snare': 2 };
  const textOf = (klass: Record<string, unknown>) => Object.fromEntries(skillsOf(filled, klass, {}, rulesSets).map((s) => [s.code, s.text ?? null]));

  it("a rules set skill's notes are its text", () => {
    // Purpose: Hark's sheet can show the rules set's own line on what Hark does, not the "doesn't describe" fallback.
    expect(textOf({ skills: { names: { snare: 'Set a snare' }, byLevel: [{ level: 1, snare: 2 }] } }).hark).toBe('Hearing what waits behind a door.');
  });

  it("a class skill's entry in the class's skills.notes map is its text", () => {
    // Purpose: a class-defined skill (G-210) reads its words from the class's map, keyed like names and byLevel.
    const klass = { skills: { names: { snare: 'Set a snare' }, notes: { snare: 'Catching small game overnight.' }, note: 'Bog stalkers learn these young.', byLevel: [{ level: 1, snare: 2 }] } };
    expect(textOf(klass)).toEqual({ hark: 'Hearing what waits behind a door.', wade: null, snare: 'Catching small game overnight.' });
  });

  it("a class's skills.notes written as one string is the class-wide line, never a skill's text", () => {
    // Purpose: packs not yet rebuilt carry the class-wide line in `notes`; it must not appear as every skill's description.
    const klass = { skills: { names: { snare: 'Set a snare' }, notes: 'Bog stalkers learn these young.', byLevel: [{ level: 1, snare: 2 }] } };
    expect(textOf(klass)).toEqual({ hark: 'Hearing what waits behind a door.', wade: null, snare: null });
  });

  it("the class's line on its skills: skills.note, else a string skills.notes, else nothing", () => {
    // Purpose: the Skills list's muted top line reads `note`, takes an older string `notes` as it, and never a map.
    expect(classSkillsNote({ skills: { note: 'Learnt young.', notes: { snare: 'Catching small game.' } } })).toBe('Learnt young.');
    expect(classSkillsNote({ skills: { notes: 'Learnt young.' } })).toBe('Learnt young.');
    expect(classSkillsNote({ skills: { notes: { snare: 'Catching small game.' } } })).toBe('');
    expect(classSkillsNote({ skills: {} })).toBe('');
    expect(classSkillsNote(null)).toBe('');
  });

  it('a skill with no words anywhere has no text, so its sheet falls back', () => {
    // Purpose: with neither source the skill carries no text at all (the sheet then shows "Your setting doesn't describe…").
    expect(textOf({ skills: { names: { snare: 'Set a snare' }, notes: { hark: '  ' }, byLevel: [{ level: 1, snare: 2 }] } })).toEqual({ hark: 'Hearing what waits behind a door.', wade: null, snare: null });
  });
});

// sq-4 (ruled 2026-11-04): At hand's weapon figure opens a breakdown like every other figure.
describe('weaponBreakdown', () => {
  const lantern = { progression: [{ level: 1, attackBonus: 1, thac0: 19 }, { level: 3, attackBonus: 2, thac0: 18 }] };
  const scores = { 'abilityModifiers.STR': { melee: 1 }, 'abilityModifiers.DEX': { missile: -1 } };
  const names = { klassName: 'Lantern Warden', shortName: (a: string) => a };

  // Purpose: the breakdown's rows are the line's parts, with the same numbers: the class at this level, the score's
  // modifier with the attack it gives, then the damage.
  it("gives the class's figure, the score's modifier with the attack, and the damage, as the line has them", () => {
    const sword = { weapon: { damage: '1d6' }, weaponTags: ['Melee'] };
    expect(weaponFigures(sword, scores, lantern, 3)).toBe('+3, 1d6');
    expect(weaponBreakdown(sword, scores, lantern, 3, [], names)).toEqual([
      { label: 'Lantern Warden at level 3', value: '+2' },
      { label: 'Melee, STR +1', value: '+3' },
      { label: 'Damage', value: '1d6' },
    ]);
  });

  // Purpose: a weapon that is both kinds shows each kind's attack; the damage score's modifier gets its own row.
  it('names each kind, and the damage with the damage score', () => {
    const rulesSets = [{ attack: { damageScore: 'STR' } }];
    const spear = { weapon: { damage: '1d6' }, weaponTags: ['Melee', 'Missile'] };
    expect(weaponFigures(spear, scores, lantern, 1, rulesSets)).toBe('Melee +2, 1d6+1, Missile +0, 1d6');
    expect(weaponBreakdown(spear, scores, lantern, 1, rulesSets, names)).toEqual([
      { label: 'Lantern Warden at level 1', value: '+1' },
      { label: 'Melee, STR +1', value: '+2' },
      { label: 'Missile, DEX −1', value: '+0' },
      { label: 'Damage', value: '1d6' },
      { label: 'Melee damage, STR +1', value: '1d6+1' },
    ]);
  });

  // Purpose: with descending AC the rows read as target numbers, and a rule's die is named by its reason.
  it("reads target numbers with descending AC, and names the rule that sets the die", () => {
    const rulesSets = [{ attack: { weaponDamage: 'd6' } }];
    const axe = { weapon: { damage: '1d8' }, weaponTags: ['Melee'] };
    expect(weaponBreakdown(axe, scores, lantern, 1, rulesSets, { ...names, direction: 'descending', damageReason: 'All weapons d6' })).toEqual([
      { label: 'Lantern Warden at level 1', value: '19' },
      { label: 'Melee, STR +1', value: '18' },
      { label: 'Damage, All weapons d6', value: 'd6' },
    ]);
  });

  // Purpose: nothing to break down for an item that isn't a weapon; a class with no figure leaves only the damage.
  it('is empty for a non-weapon, and the damage alone without a class figure', () => {
    expect(weaponBreakdown({ name: 'Rope' }, scores, lantern, 1)).toEqual([]);
    expect(weaponBreakdown({ weapon: { damage: '1d6' }, weaponTags: ['Melee'] }, scores, null, 1)).toEqual([{ label: 'Damage', value: '1d6' }]);
  });

  // Purpose: a weapon mode's own to-hit (ah-1, G-211) is a named part in the figure and its own row in the breakdown,
  // both ways round (descending lowers the target), and a mode's own die names its source.
  it("adds a weapon mode's to-hit as a named part, and names a mode's die as the damage's source", () => {
    const bow = { weapon: { damage: '1d8' }, weaponTags: ['Missile'] };
    const bone = { label: 'Bone-tipped arrows', value: 1 };
    expect(weaponFigures(bow, scores, lantern, 1, [], { attack: bone })).toBe('+1, 1d8');
    expect(weaponBreakdown(bow, scores, lantern, 1, [], { ...names, attack: bone, damageSource: 'Ember arrows' })).toEqual([
      { label: 'Lantern Warden at level 1', value: '+1' },
      { label: 'Missile, DEX −1', value: '+0' },
      { label: 'Bone-tipped arrows, +1', value: '+1' },
      { label: 'Damage, Ember arrows', value: '1d8' },
    ]);
    expect(weaponFigures(bow, scores, lantern, 1, [], { direction: 'descending', attack: bone })).toBe('19, 1d8');
    expect(weaponBreakdown(bow, scores, lantern, 1, [], { ...names, direction: 'descending', attack: bone }).find((r) => r.label.startsWith('Bone'))).toEqual({ label: 'Bone-tipped arrows, +1', value: '19' });
  });
});

describe('whether the attack is a bonus (the Player screen’s Attack tile, frame P1)', () => {
  // Invented figures (hard rule 2).
  const bonusClass = { progression: [{ level: 1, attack: 0 }, { level: 3, attack: 1 }] };
  const targetClass = { progression: [{ level: 1, thac0: 19 }] };

  // Purpose: the tile signs the figure exactly when the weapon's roll lines add it to the d20: going up, or with no AC
  // style, from a class whose figure is a bonus; a target number (descending AC, or `thac0`) is never signed.
  it('is a bonus when the roll lines add it to the d20, never a target number', () => {
    expect(attackIsBonus(bonusClass, 3, null)).toBe(true);
    expect(attackIsBonus(bonusClass, 3, 'ascending')).toBe(true);
    expect(attackIsBonus({ progression: [{ level: 1, attackBonus: 2 }] }, 1, null)).toBe(true);
    expect(attackIsBonus(bonusClass, 3, 'descending')).toBe(false);
    expect(attackIsBonus(targetClass, 1, null)).toBe(false);
    expect(attackIsBonus(null, 1, null)).toBe(false);
  });
});
