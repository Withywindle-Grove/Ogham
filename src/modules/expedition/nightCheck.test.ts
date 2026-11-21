// The night check comes before the camp is applied (SC-5-1, ruled B by Francis, 2026-11-03).
import { describe, expect, it } from 'vitest';
import type { CardLine } from './card.ts';
import { nightPlan } from './nightCheck.ts';

const line = (checkId: string | null, name = checkId ?? 'Weather'): CardLine => ({
  key: checkId ? `check:mode:${checkId}` : `weather:${name}`,
  group: 'procedure',
  decision: checkId ? 'check' : 'roll',
  name,
  icon: 'monster',
  count: 1,
  stepId: null,
  note: null,
  check: checkId
    ? { checkId, source: 'mode', chance: null, always: false, ruledOut: false, modifiers: [], hit: { tables: [], tableFrom: null, pick: false, column: null, columns: [], regionTable: null, regionTables: false, swap: null, noteOnly: true, candidates: [], note: null }, encounter: true, secret: true, again: false }
    : null,
  tableId: null,
  recharge: null,
  nextAt: null,
});

const night = new Set(['bog-prowl']);
const lines = [line('bog-astray', 'Going astray'), line('bog-prowl', 'Prowlers'), line(null)];

describe('nightPlan', () => {
  it('goes ahead with every line when the move applies no camp', () => {
    expect(nightPlan({ lines, nightChecks: night, camps: [], from: 0, asked: null })).toEqual({ move: lines });
  });

  it('stops at the night check alone when the move would apply a camp and the night check is due', () => {
    const plan = nightPlan({ lines, nightChecks: night, camps: ['camp-1'], from: 0, asked: null });
    expect('stop' in plan && plan.stop.map((l) => l.name)).toEqual(['Prowlers']);
    expect('stop' in plan && plan.asked).toEqual({ from: 0, camps: ['camp-1'] });
  });

  it('goes ahead without the night check once it was asked for the same move', () => {
    const plan = nightPlan({ lines, nightChecks: night, camps: ['camp-1'], from: 0, asked: { from: 0, camps: ['camp-1'] } });
    expect('move' in plan && plan.move.map((l) => l.name)).toEqual(['Going astray', 'Weather']);
  });

  it('asks again for a move from another time on the clock (another night)', () => {
    const plan = nightPlan({ lines, nightChecks: night, camps: ['camp-2'], from: 86400, asked: { from: 0, camps: ['camp-1'] } });
    expect('stop' in plan).toBe(true);
  });

  it('goes ahead without the night check when it was already recorded at this time (another GM device, or a reload)', () => {
    const plan = nightPlan({ lines, nightChecks: night, camps: ['camp-1'], from: 0, asked: null, answered: new Set(['check:mode:bog-prowl']) });
    expect('move' in plan && plan.move.map((l) => l.name)).toEqual(['Going astray', 'Weather']);
  });

  it("stops only for a split party's group whose night check isn't recorded yet", () => {
    const split = [{ ...line('bog-prowl', 'Prowlers, Group 1'), key: 'check:mode:bog-prowl@group1' }, { ...line('bog-prowl', 'Prowlers, Group 2'), key: 'check:mode:bog-prowl@group2' }];
    const plan = nightPlan({ lines: split, nightChecks: night, camps: ['camp-1', 'camp-2'], from: 0, asked: null, answered: new Set(['check:mode:bog-prowl@group1']) });
    expect('stop' in plan && plan.stop.map((l) => l.name)).toEqual(['Prowlers, Group 2']);
  });

  it('goes ahead when the move applies a camp but no night check is due', () => {
    const noNight = [line('bog-astray', 'Going astray')];
    expect(nightPlan({ lines: noNight, nightChecks: night, camps: ['camp-1'], from: 0, asked: null })).toEqual({ move: noNight });
  });

  // Purpose (gate walk, the night encounter, 2026-11-10): a night check the GM answered with Encounter check (⋯), which
  // records its key with a "now:" prefix, counts as answered, so Next day doesn't stop for it again.
  it('goes ahead without the night check when it was answered with Encounter check ("now:" key)', () => {
    const plan = nightPlan({ lines, nightChecks: night, camps: ['camp-1'], from: 0, asked: null, answered: new Set(['now:check:mode:bog-prowl']) });
    expect('move' in plan && plan.move.map((l) => l.name)).toEqual(['Going astray', 'Weather']);
  });
});
