// Event-triggered checks (ruled 2026-10-30, D9). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { fenRules, mireRules } from './fixtures.ts';
import { readExploration } from './modes.ts';
import { iconForCheck, triggeredChecks, triggeredPrompts } from './eventChecks.ts';
import { previewMove } from './travel.ts';
import { moveCheckLines } from './card.ts';

const mire = readExploration([mireRules]);
const trek = mire.modes[0]!;

describe('alsoWhen', () => {
  it('is read as one object or a list, and unknown keys are left out', () => {
    const byId = Object.fromEntries(trek.checks.map((c) => [c.id, c.alsoWhen]));
    expect(byId['trek-astray']).toEqual([{ event: 'leaveRoute', id: 'causeway' }]);
    expect(byId['trek-omen']).toEqual([{ event: 'enterTerrain', id: 'sedge' }]);
    expect(byId['trek-prowl']).toEqual([]);
  });

  it('checks written before alsoWhen existed read with none', () => {
    expect(readExploration([fenRules]).modes.flatMap((m) => m.checks).every((c) => c.alsoWhen.length === 0)).toBe(true);
  });

  it('leaving the causeway sets off the lost check, with its reason; staying on it does not', () => {
    const left = triggeredChecks(trek, { routeId: 'causeway', terrainId: 'bog' }, { routeId: 'wild', terrainId: 'bog' });
    expect(left.map((t) => [t.check.id, t.reason])).toEqual([['trek-astray', 'Left the Causeway']]);
    expect(triggeredChecks(trek, { routeId: 'causeway', terrainId: 'bog' }, { routeId: 'causeway', terrainId: 'bog' })).toEqual([]);
  });

  it('entering a terrain sets off its check only when coming from another terrain', () => {
    expect(triggeredChecks(trek, { routeId: 'wild', terrainId: 'bog' }, { routeId: 'wild', terrainId: 'sedge' }).map((t) => t.reason)).toEqual(['Entered the Sedge']);
    expect(triggeredChecks(trek, { routeId: 'wild', terrainId: 'sedge' }, { routeId: 'wild', terrainId: 'sedge' })).toEqual([]);
  });

  it("the prompt is worked out for the destination: off the causeway the lost check isn't ruled out", () => {
    const [prompt] = triggeredPrompts(trek, mire, { routeId: 'causeway', terrainId: 'bog' }, { routeId: 'wild', terrainId: 'bog' });
    expect(prompt).toMatchObject({ checkId: 'trek-astray', chanceText: '1–2 on d6', ruledOut: false, reason: 'Left the Causeway', icon: 'lost' });
  });

  it('Move… lists the checks it sets off when it knows where the party was', () => {
    const day = { total: 5, spent: 0, pending: null, forced: 0 };
    const preview = previewMove(trek, mire, day, { routeId: 'wild', terrainId: 'sedge' }, { from: { routeId: 'causeway', terrainId: 'bog' } });
    expect(preview.triggered.map((t) => [t.checkId, t.reason])).toEqual([
      ['trek-astray', 'Left the Causeway'],
      ['trek-omen', 'Entered the Sedge'],
    ]);
    expect(previewMove(trek, mire, day, { routeId: 'wild', terrainId: 'sedge' }).triggered).toEqual([]);
  });

  // Build order 8 (M5b step 1 follow-up): the checks a move sets off land on the card as Hit / Miss lines.
  it("a move's checks become Hit / Miss lines named with why, keyed apart from the schedule's, logged as checking now", () => {
    const day = { total: 5, spent: 0, pending: null, forced: 0 };
    const preview = previewMove(trek, mire, day, { routeId: 'wild', terrainId: 'sedge' }, { from: { routeId: 'causeway', terrainId: 'bog' } });
    const lines = moveCheckLines(preview.triggered, null);
    expect(lines.map((l) => [l.key, l.name, l.decision])).toEqual([
      ['move:trek-astray', `${preview.triggered[0]!.name}, Left the Causeway`, 'check'],
      ['move:trek-omen', `${preview.triggered[1]!.name}, Entered the Sedge`, 'check'],
    ]);
    expect(lines.every((l) => l.check?.now === true && l.check.again === false && l.nextAt === null && l.check.source === 'mode')).toBe(true);
    // The lost check (its terrain chance) stays a lost check: its hit queues no encounter.
    expect(lines[0]!.check?.lost).toBe(true);
  });

  it("after a split, a move's check lines name their group and are keyed per group", () => {
    const day = { total: 5, spent: 0, pending: null, forced: 0 };
    const preview = previewMove(trek, mire, day, { routeId: 'wild', terrainId: 'bog' }, { from: { routeId: 'causeway', terrainId: 'bog' } });
    const [line] = moveCheckLines(preview.triggered, 2);
    expect(line).toMatchObject({ key: 'move:trek-astray@group2', name: `${preview.triggered[0]!.name}, Left the Causeway, Group 2` });
    expect(moveCheckLines([], 2)).toEqual([]);
  });

  it('a check no step runs shows the plain dot', () => {
    expect(iconForCheck(trek, 'trek-omen')).toBe('dot');
    expect(iconForCheck(trek, 'trek-prowl')).toBe('monster');
  });
});
