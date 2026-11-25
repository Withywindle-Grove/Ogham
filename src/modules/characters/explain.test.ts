import { describe, expect, it } from 'vitest';
import { abilityLines, acCaption, explainAttack, explainFigure, explainHp, explainLevel, plainName, signed, type Explaining } from './explain.ts';

// Invented content only (hard rule 2).
const warden: Explaining = {
  level: 3,
  filled: {
    hitDice: '3d8',
    attack: 19,
    'abilityModifiers.STR': { melee: 1, openDoors: '2-in-6' },
    'abilityModifiers.DEX': { missile: -1, ac: -1 },
    'abilityModifiers.CON': { hp: 1 },
  },
  klass: { id: 'lantern-warden', maxLevel: 14 },
  klassName: 'Lantern Warden',
  race: { classMaxLevels: { 'lantern-warden': 8 } },
  raceName: 'Marsh folk',
  xpTable: { levels: [{ level: 2, xp: 1800 }, { level: 4, xp: 7200 }] },
  abilityLabel: (k) => ({ STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution' })[k] ?? k,
};

describe('how a figure is worked out (ruled 2026-10-26)', () => {
  it('names and numbers read as words: sentence case, signs on numbers', () => {
    expect(plainName('openDoors')).toBe('Open doors');
    expect(plainName('hp')).toBe('Hit points');
    expect(plainName('ac')).toBe('Armour class');
    expect([signed(1), signed(-2), signed(0), signed('2-in-6')]).toEqual(['+1', '−2', '+0', '2-in-6']);
  });

  it("an ability's modifiers are one plain line each, not a run-on list", () => {
    expect(abilityLines({ melee: 1, openDoors: '2-in-6' })).toEqual(['Melee: +1', 'Open doors: 2-in-6']);
    expect(abilityLines(null)).toEqual([]);
  });

  // Gate walk 2026-11-05, bug 3: the ability pop-up reads the row as the Scores step's tiles do.
  it('the pop-up shows a value column unsigned, a zero value, and leaves a zero modifier out', () => {
    expect(abilityLines({ parley: 0, followers: 0, faith: 7, melee: -1 }, { followers: 'value', faith: 'value' })).toEqual(['Followers: 0', 'Faith: 7', 'Melee: −1']);
    expect(abilityLines({ parley: 0, faith: 7 })).toEqual(['Faith: +7']);
  });

  it('hit points: now and at most, the hit dice for the class and level, and the score that adds', () => {
    expect(explainHp(warden, { current: 9, max: 14 })).toEqual([
      '9 now, of 14 at most.',
      'Hit dice: 3d8 for a Lantern Warden at level 3.',
      '+1 from Constitution.',
      'Damage and healing change the current number; the most rises when you go up a level.',
    ]);
  });

  // Purpose: tfw-2 (2026-11-19; voice rule 16): with no hit dice the lines say nothing about the GM setting them.
  it('hit points with no hit dice: no line about the GM', () => {
    expect(explainHp({ ...warden, filled: {}, klass: null, klassName: null }, { current: null, max: null })).toEqual([
      'Damage and healing change the current number; the most rises when you go up a level.',
    ]);
  });

  // Row 7a of docs/plans/dec-14-player-audit-fixes.md (A2, page 39, frames 39-4 to 39-6; approved 2026-11-24, "approve
  // A2 as drawn, no line for zero"). Purposes:
  //   The armour class tile's line names the score in full, the setting's own long name, then its figure, and never
  //   "AC" or "from".
  //   A score that adds nothing leaves no line.
  //   In a setting where lower is better, the figure is turned round, as before (B9).
  //   Two scores read one after the other, a comma between; a long name is passed whole, never cut.
  describe("the armour class tile's line in whole words (dec-14 row 7a, A2)", () => {
    const longName = (k: string) => ({ NIM: 'Nimbleness', GRT: 'Grit', PRM: 'Presence of mind' })[k] ?? k;

    it.fails('names the score in full, then its figure, with no "AC" and no "from"', () => {
      const line = acCaption({ 'abilityModifiers.NIM': { ac: 1 } }, longName);
      expect(line).toBe('Nimbleness +1');
      expect(line).not.toMatch(/\bAC\b|\bfrom\b/);
      expect(acCaption(warden.filled, warden.abilityLabel!)).toBe('Dexterity −1');
    });

    it('leaves no line when the score adds nothing', () => {
      expect(acCaption({ 'abilityModifiers.NIM': { ac: 0 } }, longName)).toBe('');
      expect(acCaption({}, longName)).toBe('');
    });

    it.fails('turns the figure round where lower is better (B9)', () => {
      expect(acCaption({ 'abilityModifiers.NIM': { ac: 1 } }, longName, 'descending')).toBe('Nimbleness −1');
      expect(acCaption(warden.filled, warden.abilityLabel!, 'descending')).toBe('Dexterity +1');
    });

    it.fails('reads two scores one after the other, and a long name whole', () => {
      expect(acCaption({ 'abilityModifiers.NIM': { ac: 1 }, 'abilityModifiers.GRT': { ac: 1 } }, longName)).toBe('Nimbleness +1, Grit +1');
      expect(acCaption({ 'abilityModifiers.NIM': { ac: 1 }, 'abilityModifiers.PRM': { ac: 1 } }, longName)).toBe('Nimbleness +1, Presence of mind +1');
    });
  });

  it('attack: the class figure at this level, then melee and missile from the scores', () => {
    expect(explainAttack(warden, 'THAC0')).toEqual(['THAC0 19 for a Lantern Warden at level 3.', 'Melee +1 from Strength', 'Missile −1 from Dexterity']);
    expect(explainAttack({ ...warden, filled: { attack: 1 } }, 'Attack')).toEqual(['Attack +1 for a Lantern Warden at level 3.']);
    expect(explainAttack({ ...warden, filled: {} }, 'Attack')).toEqual(['Your GM sets it.']);
  });

  it("level: the XP for the next, and the race's cap when it's lower than the class's", () => {
    expect(explainLevel(warden)).toEqual(['Level 3 Lantern Warden.', 'Level 4 at 7,200 XP.', 'A Marsh folk goes no higher than level 8 as a Lantern Warden.']);
    expect(explainLevel({ ...warden, level: 8 })).toContain('This is the highest level.');
    expect(explainLevel({ ...warden, race: null, raceName: null })).toContain('The highest level is 14.');
  });
});

describe('every worked-out figure has its breakdown (ct3-9, 2026-11-03)', () => {
  // Invented: a rules set with a skill, a save modifier and movement; a kindred with a skill target and a field.
  const rulesSets = [
    {
      movement: { default: 30, exploration: 'speed * 3', combat: { formula: 'speed / 3', unit: 'ft per round' } },
      skills: [{ id: 'hark', name: 'Hark', default: 6, rollMode: 'equal-or-over' }],
      saveModifiers: [{ id: 'spell-ward', name: 'Spell ward', value: { from: 'LORE', plusRaceField: 'spellWard' }, notes: 'The LORE modifier plus any kindred bonus.' }],
    },
  ];
  const input: Explaining = {
    ...warden,
    level: 1,
    filled: { 'saves.mire': 12, attack: 19, 'skills.hark': 5, 'saveModifiers.spell-ward': 3, 'abilityModifiers.LORE': { magic: 1 }, 'movement.speed': 20, movement: 20, 'movement.exploration': 60, 'movement.combat': 6, title: 'Lamplighter', mystery: 4 },
    klass: { id: 'lantern-warden', skills: { byLevel: [{ level: 1, hark: 6 }] } },
    race: { speed: 20, spellWard: 2, skillTargets: { hark: 5 } },
    raceName: 'Stone kin',
    abilityLabel: (k) => ({ LORE: 'Lore' })[k] ?? k,
  };
  const names: Record<string, string> = { 'saves.mire': 'Save vs mire', 'skills.hark': 'Hark', 'saveModifiers.spell-ward': 'Spell ward', 'movement.exploration': 'Exploring', 'movement.combat': 'In a fight', title: 'Title' };
  const ctx = { rulesSets, scores: { LORE: 13 }, classRef: 'lantern-warden', raceRef: 'stone-kin', notes: { 'saves.mire': '+3 to the roll vs poison' }, label: (n: string) => names[n] ?? n };

  it('a save names the class and level, then what the race says beside it', () => {
    // Purpose: a tapped save says where its number comes from and the race's note, not a bare number.
    expect(explainFigure('saves.mire', input, ctx)).toEqual(['Save vs mire 12 for a Lantern Warden at level 1.', 'Stone kin: +3 to the roll vs poison.']);
  });

  it("a skill says only what succeeds: no line on where its number comes from, and not the kindred's words (tfs-1)", () => {
    // Purpose: Hark 5 (the kindred's) reads its one line; "Base chance for everyone", the class's line, "Lower is
    // better" and the kindred's line are gone (his note on item 26, 2026-11-19). Its die isn't named, so the line keeps
    // today's words.
    expect(explainFigure('skills.hark', input, ctx)).toEqual(['Succeeds on 5 or more']);
    expect(explainFigure('skills.hark', input, { ...ctx, notes: { 'skills.hark': '4 when wading' } })).toEqual(['Succeeds on 5 or more']);
  });

  it("a save modifier adds the ability's part and the race's part", () => {
    // Purpose: Spell ward 3 reads as +1 from Lore 13 and +2 from Stone kin.
    expect(explainFigure('saveModifiers.spell-ward', input, ctx)).toEqual(['+1 from Lore 13.', '+2 from Stone kin.', 'Spell ward 3 in all.', 'The LORE modifier plus any kindred bonus.']);
  });

  it('movement comes from the speed, a mode from its formula, and says when it was rounded down', () => {
    // Purpose: each movement figure says the speed it starts from and the sum that gives it; a sum that leaves a
    // fraction (20 / 3) says "(rounded down)", as the tablet's Movement breakdown does (07 Formulas, 05), and one
    // that comes out whole (20 × 3) doesn't.
    expect(explainFigure('movement', input, ctx)).toEqual(["Speed 20: Stone kin's own."]);
    expect(explainFigure('movement.exploration', input, ctx)).toEqual(["Speed 20: Stone kin's own.", 'Exploring: speed × 3 = 60.']);
    expect(explainFigure('movement.combat', input, ctx)[1]).toBe('In a fight: speed / 3 = 6 ft per round (rounded down).');
  });

  it('a speed with no kindred speed of its own says it is the base speed for everyone', () => {
    // Purpose: the speed line says where 120 comes from in plain words (R3-13), not "your setting's usual speed".
    const plain = { ...input, race: {}, filled: { ...input.filled, 'movement.speed': 120 } };
    expect(explainFigure('movement', plain, ctx)).toEqual(['Speed 120: the base speed for everyone in your setting.']);
  });

  it('a skill rolled the target or higher on a d6 reads "Succeeds on a 2+, roll 1d6", on the rules set\'s die or the class\'s (tfs-1)', () => {
    // Purpose: a 5-in-6 skill reads as its target, "Succeeds on a 2+, roll 1d6", never "Base chance for everyone: 1-in-6"
    // or the class's line; a class's own skill reads the class's die the same way.
    const rules = [{ skills: [{ id: 'snare', name: 'Set a snare', die: 'd6', default: 1 }] }];
    const stalker = { ...input, klassName: 'Reed Stalker', race: {}, raceName: 'Bog folk', filled: { 'skills.snare': 5 }, klass: { id: 'reed-stalker', skills: { die: 'd6', byLevel: [{ level: 1, snare: 5 }] } } };
    expect(explainFigure('skills.snare', stalker, { ...ctx, rulesSets: rules, label: () => 'Set a snare' })).toEqual(['Succeeds on a 2+, roll 1d6']);
    // A class's own skill, not in the rules set: in the class's die.
    const own = { ...stalker, filled: { 'skills.creep': 3 }, klass: { id: 'reed-stalker', skills: { die: 'd6', names: { creep: 'Creep' }, byLevel: [{ level: 1, creep: 3 }] } } };
    expect(explainFigure('skills.creep', own, { ...ctx, rulesSets: rules, label: () => 'Creep' })).toEqual(['Succeeds on a 4+, roll 1d6']);
  });

  it('no figure is left without a line: an unknown fill says the rules give it', () => {
    // Purpose: whatever the pack fills, its tap never opens an empty pop-up.
    expect(explainFigure('title', input, ctx)).toEqual(['Title Lamplighter for a Lantern Warden at level 1.']);
    expect(explainFigure('mystery', input, ctx)).toEqual(["mystery 4: your setting's rules give this for a Lantern Warden at level 1."]);
    expect(explainFigure('abilityModifiers.LORE.magic', input, ctx)).toEqual(['From Lore 13: 1.']);
  });
});
