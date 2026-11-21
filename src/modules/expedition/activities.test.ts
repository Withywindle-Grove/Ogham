// Running an activity (M5b step 3, build order 1; ruled 2026-10-30, D3, S4-8; docs/05 "Activities", 07 Activities).
// Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { fenRules, plainRules } from './fixtures.ts';
import { readExploration } from './modes.ts';
import { timeUnits } from './clock.ts';
import {
  actorCap,
  actorsFor,
  bestRoll,
  costLine,
  finderOf,
  rollPlan,
  spendOf,
  usableActivities,
  yieldLine,
  type ActorFacts,
} from './activities.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const fen = readExploration([plainRules, fenRules]);
const roam = fen.modes.find((m) => m.id === 'roam')!;
const creep = fen.modes.find((m) => m.id === 'creep')!;
const marsh = roam.terrain.find((t) => t.id === 'marsh')!;
const notMarsh = roam.terrain.find((t) => t.id !== 'marsh')!;
const ids = (list: { activity: { id: string } }[]) => list.map((u) => u.activity.id);

const facts = (id: string, name: string, skills: string[] = [], items: string[] = []): ActorFacts => ({ id, name, skills: new Set(skills), items: new Set(items) });
const lurker = facts('a', 'Bog lurker', ['pry'], ['crowbar']);
const warden = facts('b', 'Lantern Warden', ['pry']);
const witch = facts('c', 'Reed witch');

describe('which activities are offered (07 onlyOnTerrain, onlyWithOption, requires)', () => {
  it('onlyOnTerrain shows an activity only on its terrain', () => {
    expect(ids(usableActivities(roam, units, { terrain: marsh }))).toContain('gather-reeds');
    expect(ids(usableActivities(roam, units, { terrain: notMarsh }))).not.toContain('gather-reeds');
  });

  it('onlyWithOption hides an activity while its option is off (and its season must match)', () => {
    expect(ids(usableActivities(roam, units, { season: 'wet', choices: {} }))).not.toContain('eel-run');
    expect(ids(usableActivities(roam, units, { season: 'wet', choices: { eels: 'on' } }))).toContain('eel-run');
  });

  it("a character without the `requires` skill or item isn't offered", () => {
    const pry = creep.activities.find((a) => a.id === 'pry-lid')!;
    expect(actorsFor(pry, [lurker, warden, witch]).map((a) => a.name)).toEqual(['Bog lurker']);
  });
});

describe('cost, roll and finder (S4-8, D3)', () => {
  it('the cost line names the budget, all of it, or the time; the spend never goes below 0', () => {
    const forage = usableActivities(roam, units, {}).find((u) => u.activity.id === 'forage')!;
    const hunt = usableActivities(roam, units, {}).find((u) => u.activity.id === 'hunt')!;
    expect(costLine({ kind: 'budget', amount: 3 }, 5, 'Travel points', { one: 'point', many: 'points' })).toBe('3 points');
    expect(costLine(hunt.cost, 5, 'Travel points', { one: 'point', many: 'points' })).toBe("All of today's travel points (5)");
    expect(costLine({ kind: 'time', seconds: 7200 }, 5, 'Travel points', { one: 'point', many: 'points' })).toBe('2 hours');
    expect([spendOf(hunt.cost, 5), spendOf(forage.cost, 5), spendOf({ kind: 'time', seconds: 60 }, 5), spendOf(hunt.cost, -2)]).toEqual([5, 0, 0, 0]);
  });

  it('searchCost comes from the terrain (fromTerrain)', () => {
    const gather = usableActivities(roam, units, { terrain: marsh }).find((u) => u.activity.id === 'gather-reeds')!;
    expect(gather.cost.kind).toBe('budget');
  });

  it("the roll explains itself with each modifier and its source; a skill's value shows when known", () => {
    const gather = roam.activities.find((a) => a.id === 'gather-reeds')!;
    const plan = rollPlan(gather, witch, [{ label: 'Reed witch: knows the reeds', add: 1 }]);
    expect(plan.instructions).toBe('Roll a WIS check');
    expect(plan.modifiers.map((m) => [m.label, m.add, m.source])).toEqual([
      ['A whole day at it', 1, 'rules'],
      ['Reed witch: knows the reeds', 1, 'party'],
    ]);
    const listen = { chance: { skill: 'hear' }, modifiers: [] };
    const known = { ...witch, skillShown: new Map([['hear', { name: 'Hear noise', shown: '2-in-6', odds: 'Succeeds on 5 or 6, 2 in 6' }]]) };
    expect(rollPlan(listen, known).instructions).toBe('Roll Hear noise (2-in-6), Succeeds on 5 or 6, 2 in 6');
    expect(rollPlan(listen, known).better).toBe('high');
  });

  it('bestOf keeps the best of several rolls, and the best roller finds the yield', () => {
    const rolls = [
      { actorId: 'a', roll: 4 },
      { actorId: 'b', roll: 9 },
      { actorId: 'c', roll: 2 },
    ];
    expect(bestRoll(rolls, 'high')).toEqual({ actorId: 'b', roll: 9 });
    expect(bestRoll(rolls, 'low')).toEqual({ actorId: 'c', roll: 2 });
    expect(finderOf({ bestOf: true }, ['a', 'b', 'c'], rolls, 'high')).toBe('b');
    // Without bestOf, or with no rolls, the first to act finds it.
    expect(finderOf({ bestOf: false }, ['a', 'b'], rolls, 'high')).toBe('a');
    expect(finderOf({ bestOf: true }, ['c'], [], 'high')).toBe('c');
    expect(finderOf({ bestOf: true }, [], rolls, 'high')).toBeNull();
  });

  it('who: one, several capped by maxActors, the party all', () => {
    expect(actorCap({ who: 'one', maxActors: null }, 4)).toBe(1);
    expect(actorCap({ who: 'several', maxActors: 3 }, 5)).toBe(3);
    expect(actorCap({ who: 'several', maxActors: null }, 5)).toBe(5);
    expect(actorCap({ who: 'party', maxActors: 2 }, 5)).toBe(5);
  });

  it('the yield line names how many, the item and whose pack', () => {
    expect(yieldLine(3, 'Reed bundles', 'Tam')).toBe("3 Reed bundles → Tam's pack");
  });
});
