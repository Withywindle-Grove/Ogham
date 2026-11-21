import { describe, expect, it } from 'vitest';
import { applyStep, startFight, undoStep, type Step } from './engine.ts';
import type { Fight, FightRules, Outcome, SideId, Ties } from './types.ts';
import { BRAM, SIDE_RULES, TOBBLE, WREN, lurker, status, warden } from './fixtures.ts';

/** A small seeded generator (mulberry32) so a failing sequence can be replayed from its seed; no die is rolled in the engine. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

const OUTCOMES: Outcome[] = ['fighting', 'down', 'dead', 'fled', 'surrendered', 'captured'];
const SIDES: SideId[] = ['party', 'foes'];
const TIES: Ties[] = ['party', 'opponents', 'reroll', 'simultaneous'];

function randomRules(r: () => number): FightRules {
  return {
    mode: r() < 0.5 ? 'side' : 'individual',
    rerollEachRound: r() < 0.5,
    ties: pick(r, TIES),
    order: r() < 0.5 ? 'high' : 'low',
    individualTies: r() < 0.5 ? null : pick(r, TIES),
    roundSeconds: r() < 0.3 ? null : 6,
    dyingPerRound: r() < 0.3 ? null : r() < 0.5 ? { hp: 1 } : { chance: { die: '1d6', on: '1' } },
    deadAt: r() < 0.5 ? null : -3,
  };
}

function randomStep(r: () => number, fight: Fight, n: number): Step {
  const ids = fight.combatants.map((c) => c.id);
  const id = () => pick(r, ids);
  const kinds: Step['kind'][] = [
    'add-foes', 'set-winner', 'end-side-turn', 'enter-initiative', 'end-turn', 'end-group-turn', 'delay', 'act', 'set-target',
    'next-round', 'reveal', 'mark-outcome', 'add-status', 'end-status', 'we-run', 'got-away', 'caught', 'end-fight',
  ];
  let kind = pick(r, kinds);
  // Ending the fight refuses everything after; keep those rare so the sequences stay long.
  if ((kind === 'end-fight' || kind === 'got-away') && r() < 0.9) kind = 'next-round';
  switch (kind) {
    case 'add-foes':
      return { kind, foes: r() < 0.5 ? [lurker(100 + n, { hidden: r() < 0.3, arrivesIn: r() < 0.3 ? 1 + Math.floor(r() * 3) : null, actsLast: r() < 0.2 })] : [warden(100 + n), lurker(200 + n)] };
    case 'set-winner':
      return { kind, winner: r() < 0.3 ? 'tie' : pick(r, SIDES) };
    case 'end-side-turn':
      return { kind, side: pick(r, SIDES) };
    case 'enter-initiative':
      return { kind, combatantId: id(), value: r() < 0.2 ? null : 1 + Math.floor(r() * 6) };
    case 'end-turn':
    case 'delay':
    case 'act':
    case 'reveal':
      return { kind, combatantId: id() };
    case 'end-group-turn':
      return { kind, groupId: pick(r, ['bog-lurker', 'lantern-warden']) };
    case 'set-target':
      return { kind, combatantId: id(), target: r() < 0.3 ? null : id() };
    case 'mark-outcome':
      return { kind, combatantId: id(), outcome: pick(r, OUTCOMES) };
    case 'add-status':
      return { kind, combatantId: id(), status: status(`s${n}`, { roundsLeft: r() < 0.5 ? null : 1 + Math.floor(r() * 3), healPerRound: r() < 0.4 ? 1 + Math.floor(r() * 3) : null }) };
    case 'end-status': {
      const c = pick(r, fight.combatants);
      return { kind, combatantId: c.id, statusId: c.statuses.length > 0 ? pick(r, c.statuses).id : 'none' };
    }
    default:
      return { kind };
  }
}

describe('undo', () => {
  // Undo of any step, and of We run, returns exactly the prior state (property test over random step sequences).
  it('every accepted step is reversed exactly by its reversal', () => {
    let accepted = 0;
    const seen = new Set<Step['kind']>();
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const rules = randomRules(r);
      let fight = startFight({
        id: 'f',
        partyGroupId: 'g',
        rules,
        party: [{ ...WREN, actsLast: r() < 0.2 }, BRAM, TOBBLE],
        foes: [lurker(1), lurker(2, { hidden: r() < 0.3 }), warden(1, { arrivesIn: r() < 0.3 ? 2 : null })],
        surprised: r() < 0.3 ? [pick(r, SIDES)] : [],
      }).fight;
      for (let n = 0; n < 40; n++) {
        const step = randomStep(r, fight, n);
        const before = JSON.parse(JSON.stringify(fight)) as Fight;
        const result = applyStep(fight, step);
        expect(fight, `seed ${seed}, step ${n} (${step.kind}) changed its input`).toEqual(before);
        if (!result.ok) continue;
        accepted++;
        seen.add(step.kind);
        expect(undoStep(result.fight, result.undo), `seed ${seed}, step ${n} (${step.kind}) did not undo`).toEqual(before);
        fight = result.fight;
      }
    }
    expect(accepted).toBeGreaterThan(2000);
    expect([...seen].sort()).toEqual([
      'act', 'add-foes', 'add-status', 'caught', 'delay', 'end-fight', 'end-group-turn', 'end-side-turn', 'end-status', 'end-turn',
      'enter-initiative', 'got-away', 'mark-outcome', 'next-round', 'reveal', 'set-target', 'set-winner', 'we-run',
    ]);
  });

  // We run's undo returns to the same round, turn, flags, timers and numbers.
  it('undoing We run returns the fight exactly where it was', () => {
    const { fight } = startFight({ id: 'f', partyGroupId: 'g', rules: { ...SIDE_RULES, rerollEachRound: true }, party: [WREN], foes: [lurker(1)] });
    const steps: Step[] = [
      { kind: 'set-winner', winner: 'party' },
      { kind: 'add-status', combatantId: 'wren', status: status('dazed', { roundsLeft: 2 }) },
      { kind: 'end-side-turn', side: 'party' },
      { kind: 'end-side-turn', side: 'foes' },
      { kind: 'set-winner', winner: 'foes' },
      { kind: 'end-side-turn', side: 'foes' },
    ];
    let cur = fight;
    for (const step of steps) {
      const r = applyStep(cur, step);
      if (!r.ok) throw new Error(r.reason);
      cur = r.fight;
    }
    const ran = applyStep(cur, { kind: 'we-run' });
    if (!ran.ok) throw new Error(ran.reason);
    expect(ran.undo).toEqual({ kind: 'patch', fight: { status: 'under-way' }, combatants: {} });
    expect(undoStep(ran.fight, ran.undo)).toEqual(cur);
    expect(cur).toMatchObject({ round: 2, turnsDone: ['foes'], sideOrder: ['foes', 'party'] });
    expect(cur.combatants[0]!.statuses).toEqual([status('dazed', { roundsLeft: 1 })]);
  });

  // Cheap steps carry a patch of what changed, not the whole fight; adding foes carries the whole prior state.
  it('reverses cheap steps by a patch and Add foes by the whole prior state', () => {
    const { fight } = startFight({ id: 'f', partyGroupId: 'g', rules: SIDE_RULES, party: [WREN], foes: [lurker(1)] });
    const winner = applyStep(fight, { kind: 'set-winner', winner: 'party' });
    if (!winner.ok) throw new Error(winner.reason);
    expect(winner.undo).toEqual({ kind: 'patch', fight: { awaitingWinner: true, sideOrder: [] }, combatants: {} });
    const added = applyStep(fight, { kind: 'add-foes', foes: [lurker(2)] });
    if (!added.ok) throw new Error(added.reason);
    expect(added.undo).toEqual({ kind: 'whole', before: fight });
  });
});
