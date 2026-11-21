// Skill lists and best-of fills (ex-3, ga-4; docs/plans/m5b-area-2-app.md, build order 2), on the invented fixture
// scripts/fixtures/m5b-creation.fixture.json: Hark is everyone's skill (6+ on a d6, the stone kin hark on 5+), its
// `fill.best` names the Mire Stalker's own Keen ear ("1-2" at level 1, "1-3" at level 3), and the activity "Hark for
// prowlers" rolls `["hark", "EAR"]`. One rule (skillChance.ts) serves the sheet and the activity.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { fillsAtCreation, ruleFills } from '../library/fills.ts';
import { skillsOf } from '../characters/play.ts';
import { explainFigure } from '../characters/explain.ts';
import { countedSkill, rollPlan, type ActorFacts } from './activities.ts';
import { readExploration } from './modes.ts';

type Data = Record<string, unknown>;
const pack = JSON.parse(fixture) as Record<string, Data[]>;
const rulesSets = pack.rulesSets!;
const byId = (list: string, id: string) => pack[list]!.find((e) => e.id === id)!;
const stalker = byId('classes', 'mire-stalker');
const warden = byId('classes', 'lantern-warden');
const stoneKin = byId('races', 'stone-kin');
const activity = readExploration(rulesSets).modes.flatMap((m) => m.activities).find((a) => a.id === 'hark-for-prowlers')!;

/** A character's filled values, skills and actor facts, as the Player screen works them out. */
function character(klass: Data, level: number, race: Data | null = null) {
  const { filled: hooked } = fillsAtCreation(pack.hooks!, rulesSets, { level, scores: {}, klass, race });
  const filled = { ...hooked, ...ruleFills(rulesSets, { klass, race, classRef: klass.id as string, raceRef: (race?.id as string) ?? null }, hooked) };
  const skills = skillsOf(filled, klass, {}, rulesSets, { race, raceRef: (race?.id as string) ?? null });
  const actor: ActorFacts = {
    id: 'c1',
    name: 'Ash',
    skills: new Set(skills.map((s) => s.code)),
    items: new Set(),
    skillShown: new Map(skills.map((s) => [s.code, { name: s.name, shown: s.shown, odds: s.odds, chance: s.chance }])),
  };
  const breakdown = explainFigure(
    'skills.hark',
    { level, filled, klass, klassName: klass.name as string, race, raceName: (race?.name as string) ?? null, xpTable: null },
    { rulesSets, scores: {}, classRef: klass.id as string, raceRef: (race?.id as string) ?? null, label: (n) => (n === 'skills.hark' ? 'Hark' : n) },
  );
  return { filled, skills, actor, breakdown };
}

describe('a skill filled with the best of the general chance and a class skill (ga-4)', () => {
  it("the sheet shows the class's skill on the skill's own scale when it's better, at the character's level", () => {
    // Purpose: a level-3 Mire Stalker's Keen ear (1-3, 3 in 6) beats Hark's 6+, so Hark shows 4+ on the sheet.
    const { filled, skills } = character(stalker, 3);
    expect(filled['skills.hark']).toBe(4);
    expect(skills.find((s) => s.code === 'hark')?.shown).toBe('4+');
    expect(character(stalker, 1).filled['skills.hark']).toBe(5);
  });

  it('a class without that skill keeps the general chance', () => {
    // Purpose: the fill only reads a class skill the class has; a Lantern Warden's Hark stays 6+.
    expect(character(warden, 3).filled['skills.hark']).toBe(6);
  });

  it('the breakdown says only what succeeds and what to roll, not which skill counted (tfs-1)', () => {
    // Purpose: tapping Hark reads its one line at the number the sheet shows (4+ from Keen ear at level 3, 5+ from the
    // stone kin at level 1); the lines on the general chance, the class skill standing in and which one counted are
    // gone (tfs-1 and its ruling's not-settled 2, drawn on M2 without them and approved with the page, 2026-11-19).
    expect(character(stalker, 3).breakdown).toEqual(['Succeeds on a 4+, roll 1d6']);
    expect(character(stalker, 1, stoneKin).breakdown).toEqual(['Succeeds on a 5+, roll 1d6']);
  });
});

describe("an activity's list of skills (ex-3)", () => {
  it('the pack reads a list of skills; one id stays a plain skill', () => {
    // Purpose: `chance.skill: ["hark", "EAR"]` reaches the activity whole, not dropped.
    expect(activity.chance).toEqual({ skill: ['hark', 'EAR'] });
  });

  it("rolls the character's best skill, names it, and agrees with the sheet", () => {
    // Purpose: a Mire Stalker rolls Hark at the number the sheet shows, and the line says it was the better of two.
    const { actor, skills } = character(stalker, 3);
    const plan = rollPlan(activity, actor);
    expect(plan.instructions).toBe(`Roll Hark (4+), ${skills.find((s) => s.code === 'hark')!.odds}, the better of Hark and Keen ear counts`);
  });

  it('the best counts even when the class skill is the better one', () => {
    // Purpose: without the sheet's fill (an older Hark of 6+), Keen ear's 1-3 counts and is the one named.
    const { actor } = character(stalker, 3);
    const older = new Map(actor.skillShown);
    older.set('hark', { name: 'Hark', shown: '6+', odds: null, chance: { hits: 1, sides: 6 } });
    expect(countedSkill(['hark', 'EAR'], { ...actor, skillShown: older }).code).toBe('EAR');
    expect(rollPlan(activity, { ...actor, skillShown: older }).instructions).toBe('Roll Keen ear (1-3), the better of Hark and Keen ear counts');
  });

  it('with only one of the skills, that one, and no "better of"', () => {
    // Purpose: a Lantern Warden has no Keen ear: the line is the plain Hark roll.
    expect(rollPlan(activity, character(warden, 1).actor).instructions).toBe('Roll Hark (6+), Succeeds on 6 or more, 1 in 6');
  });

  it("the GM's request, with no character, lists the skills", () => {
    // Purpose: the secret request still says what to roll.
    expect(rollPlan(activity, null).instructions).toBe('Roll the better of hark and EAR');
  });
});
