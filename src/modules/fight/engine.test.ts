import { describe, expect, it } from 'vitest';
import { applyStep, startFight, type Effect, type Step } from './engine.ts';
import { whoseTurn } from './order.ts';
import type { Fight } from './types.ts';
import { minutesElapsed } from './types.ts';
import { BRAM, INDIVIDUAL_RULES, SIDE_RULES, TOBBLE, WREN, lurker, skirmish, status, warden } from './fixtures.ts';

/** Applies steps in turn, failing the test on the first refusal; returns the fight and every effect. */
function run(fight: Fight, ...steps: Step[]): { fight: Fight; effects: Effect[] } {
  const effects: Effect[] = [];
  for (const step of steps) {
    const r = applyStep(fight, step);
    if (!r.ok) throw new Error(`${step.kind} refused: ${r.reason}`);
    fight = r.fight;
    effects.push(...r.effects);
  }
  return { fight, effects };
}

function kinds(effects: Effect[]): string[] {
  return effects.map((e) => e.kind);
}

describe('starting and joining', () => {
  // A fight with one side surprised gives that side no turn in round 1 and a normal turn in round 2.
  it('a surprised side skips round 1 and acts in round 2', () => {
    const start = startFight(skirmish(SIDE_RULES, { surprised: ['foes'] }));
    expect(start.effects).toEqual([{ kind: 'surprised-skips', side: 'foes' }]);
    const r1 = run(start.fight, { kind: 'set-winner', winner: 'foes' });
    expect(whoseTurn(r1.fight)).toEqual({ kind: 'side', sides: ['party'] });
    expect(applyStep(r1.fight, { kind: 'end-side-turn', side: 'foes' })).toMatchObject({ ok: false });
    const r2 = run(r1.fight, { kind: 'end-side-turn', side: 'party' });
    expect(r2.fight.round).toBe(2);
    expect(whoseTurn(r2.fight)).toEqual({ kind: 'side', sides: ['foes'] });
  });

  // Foes added mid-fight continue the numbering; a dead foe's number is not reused.
  it('numbers continue across Add foes and a dead foe keeps its number', () => {
    const { fight } = startFight(skirmish());
    expect(fight.combatants.filter((c) => c.kind === 'foe').map((c) => c.number)).toEqual([1, 2]);
    const dead = run(fight, { kind: 'mark-outcome', combatantId: 'lurker-1', outcome: 'dead' });
    const more = run(dead.fight, { kind: 'add-foes', foes: [lurker(3), warden(1), lurker(4)] });
    const numbers = Object.fromEntries(more.fight.combatants.filter((c) => c.kind === 'foe').map((c) => [c.id, c.number]));
    expect(numbers).toEqual({ 'lurker-1': 1, 'lurker-2': 2, 'lurker-3': 3, 'warden-1': 1, 'lurker-4': 4 });
    expect(applyStep(more.fight, { kind: 'add-foes', foes: [lurker(3)] })).toMatchObject({ ok: false });
  });

  // A foe arriving in two rounds joins at the second advance; a hidden foe takes no turn until revealed.
  it('arrives-in counts down and hidden foes take no turn', () => {
    const input = skirmish(INDIVIDUAL_RULES, { foes: [lurker(1, { arrivesIn: 2 }), lurker(2, { hidden: true })] });
    const { fight } = startFight(input);
    const order = (f: Fight) => (whoseTurn(f).kind === 'combatant' ? (whoseTurn(f) as { combatant: { id: string } }).combatant.id : whoseTurn(f).kind);
    expect(order(fight)).toBe('wren');
    const r2 = run(fight, { kind: 'next-round' });
    expect(r2.fight.combatants.find((c) => c.id === 'lurker-1')!.arrivesIn).toBe(1);
    expect(kinds(r2.effects)).not.toContain('arrived');
    const r3 = run(r2.fight, { kind: 'next-round' });
    expect(r3.fight.combatants.find((c) => c.id === 'lurker-1')!.arrivesIn).toBeNull();
    expect(r3.effects).toContainEqual({ kind: 'arrived', combatantId: 'lurker-1', hidden: false });
    // Wren and Bram end their turns; the lurker that arrived has a turn, the hidden one doesn't.
    const turns = run(r3.fight, { kind: 'end-turn', combatantId: 'wren' }, { kind: 'end-turn', combatantId: 'bram' });
    expect(order(turns.fight)).toBe('lurker-1');
    expect(applyStep(turns.fight, { kind: 'end-turn', combatantId: 'lurker-2' })).toMatchObject({ ok: false });
    const revealed = run(turns.fight, { kind: 'reveal', combatantId: 'lurker-2' }, { kind: 'end-turn', combatantId: 'lurker-1' });
    expect(order(revealed.fight)).toBe('lurker-2');
  });
});

describe('side initiative', () => {
  // With side initiative rolled once, the winner acts first every round and the winner is asked for only at the start.
  it('rolled once: the winner is asked once and leads every round', () => {
    const { fight } = startFight(skirmish());
    expect(whoseTurn(fight)).toEqual({ kind: 'winner' });
    expect(applyStep(fight, { kind: 'end-side-turn', side: 'party' })).toMatchObject({ ok: false, reason: 'Tap which side won first.' });
    const r1 = run(fight, { kind: 'set-winner', winner: 'foes' });
    expect(whoseTurn(r1.fight)).toEqual({ kind: 'side', sides: ['foes'] });
    expect(applyStep(r1.fight, { kind: 'end-side-turn', side: 'party' })).toMatchObject({ ok: false });
    const r2 = run(r1.fight, { kind: 'end-side-turn', side: 'foes' }, { kind: 'end-side-turn', side: 'party' });
    expect(r2.fight.round).toBe(2);
    expect(r2.fight.awaitingWinner).toBe(false);
    expect(whoseTurn(r2.fight)).toEqual({ kind: 'side', sides: ['foes'] });
    expect(kinds(r2.effects)).not.toContain('initiative-again');
  });

  // With initiative re-rolled each round, the round advance asks again, and the same side can act twice in a row.
  it('re-rolled each round: asked again, and the same side may act twice in a row', () => {
    const { fight } = startFight(skirmish({ ...SIDE_RULES, rerollEachRound: true }));
    const r1 = run(fight, { kind: 'set-winner', winner: 'party' }, { kind: 'end-side-turn', side: 'party' }, { kind: 'end-side-turn', side: 'foes' });
    expect(r1.fight.round).toBe(2);
    expect(kinds(r1.effects)).toContain('initiative-again');
    expect(whoseTurn(r1.fight)).toEqual({ kind: 'winner' });
    const r2 = run(r1.fight, { kind: 'set-winner', winner: 'foes' });
    expect(whoseTurn(r2.fight)).toEqual({ kind: 'side', sides: ['foes'] });
  });

  // A simultaneous tie lets both sides act and the round still advances after both are done.
  it('a simultaneous tie lets both sides act, in either order', () => {
    const { fight } = startFight(skirmish({ ...SIDE_RULES, ties: 'simultaneous' }));
    const tie = run(fight, { kind: 'set-winner', winner: 'tie' });
    expect(whoseTurn(tie.fight)).toEqual({ kind: 'side', sides: ['party', 'foes'] });
    const foesFirst = run(tie.fight, { kind: 'end-side-turn', side: 'foes' });
    expect(whoseTurn(foesFirst.fight)).toEqual({ kind: 'side', sides: ['party'] });
    const both = run(foesFirst.fight, { kind: 'end-side-turn', side: 'party' });
    expect(both.fight.round).toBe(2);
  });

  // The pack's tie rule picks the side that goes first, or asks for a re-roll and leaves the tap awaited.
  it('ties go by the pack: party, opponents or re-roll', () => {
    const party = run(startFight(skirmish({ ...SIDE_RULES, ties: 'party' })).fight, { kind: 'set-winner', winner: 'tie' });
    expect(party.fight.sideOrder).toEqual(['party', 'foes']);
    const foes = run(startFight(skirmish({ ...SIDE_RULES, ties: 'opponents' })).fight, { kind: 'set-winner', winner: 'tie' });
    expect(foes.fight.sideOrder).toEqual(['foes', 'party']);
    const reroll = run(startFight(skirmish({ ...SIDE_RULES, ties: 'reroll' })).fight, { kind: 'set-winner', winner: 'tie' });
    expect(reroll.fight.awaitingWinner).toBe(true);
    expect(reroll.effects).toEqual([{ kind: 'reroll-initiative' }]);
  });

  // The round advances by itself when the last turn ends, and Next round advances it early.
  it('the round advances by itself at the last turn, and Next round advances it early', () => {
    const { fight } = startFight(skirmish());
    const r1 = run(fight, { kind: 'set-winner', winner: 'party' }, { kind: 'end-side-turn', side: 'party' });
    expect(r1.fight.round).toBe(1);
    const early = run(r1.fight, { kind: 'next-round' });
    expect(early.fight.round).toBe(2);
    expect(early.fight.turnsDone).toEqual([]);
    expect(early.effects[0]).toEqual({ kind: 'round-started', round: 2 });
    const r2 = run(r1.fight, { kind: 'end-side-turn', side: 'foes' });
    expect(r2.fight.round).toBe(2);
    expect(r2.fight.secondsElapsed).toBe(6);
  });

  // Side initiative keeps no numbers: entering one or delaying is refused with a reason.
  it('refuses individual-mode steps', () => {
    const { fight } = startFight(skirmish());
    expect(applyStep(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 4 })).toMatchObject({ ok: false });
    expect(applyStep(fight, { kind: 'delay', combatantId: 'wren' })).toMatchObject({ ok: false });
    expect(applyStep(fight, { kind: 'end-turn', combatantId: 'wren' })).toMatchObject({ ok: false });
  });
});

describe('individual initiative', () => {
  // In individual mode a missing number acts last and nobody is blocked.
  it('a missing number acts last and any turn can be ended out of order', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES, { party: [WREN, BRAM, TOBBLE] }));
    const entered = run(
      fight,
      { kind: 'enter-initiative', combatantId: 'wren', value: 3 },
      { kind: 'enter-initiative', combatantId: 'lurker-1', value: 5 },
      { kind: 'enter-initiative', combatantId: 'lurker-2', value: 5 },
      { kind: 'enter-initiative', combatantId: 'bram', value: 6 },
    );
    const ids = (f: Fight) => {
      const out: string[] = [];
      let cur = f;
      for (;;) {
        const t = whoseTurn(cur);
        if (t.kind !== 'combatant') break;
        out.push(t.combatant.id);
        cur = run(cur, { kind: 'end-turn', combatantId: t.combatant.id }).fight;
        if (cur.round !== f.round) break;
      }
      return out;
    };
    expect(ids(entered.fight)).toEqual(['bram', 'lurker-1', 'lurker-2', 'wren', 'tobble']);
    // Nobody blocks: Tobble's turn (no number) can be ended while it's Bram's turn.
    const tobbleDone = run(entered.fight, { kind: 'end-turn', combatantId: 'tobble' });
    expect(whoseTurn(tobbleDone.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'bram' } });
  });

  // The setting's low-first order and the tie-breaker between sides are honoured.
  it('low first and the pack tie-breaker', () => {
    const { fight } = startFight(skirmish({ ...INDIVIDUAL_RULES, order: 'low', ties: 'opponents' }));
    const entered = run(
      fight,
      { kind: 'enter-initiative', combatantId: 'wren', value: 2 },
      { kind: 'enter-initiative', combatantId: 'bram', value: 4 },
      { kind: 'enter-initiative', combatantId: 'lurker-1', value: 2 },
      { kind: 'enter-initiative', combatantId: 'lurker-2', value: 1 },
    );
    expect(whoseTurn(entered.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-2' } });
    const next = run(entered.fight, { kind: 'end-turn', combatantId: 'lurker-2' });
    expect(whoseTurn(next.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
  });

  // The campaign's tie-breaker beats the pack's: with the pack saying party first and the campaign saying opponents,
  // a foe entering the same number as a character goes first.
  it('the campaign’s tie-breaker beats the pack’s', () => {
    const { fight } = startFight(skirmish({ ...INDIVIDUAL_RULES, ties: 'party', individualTies: 'opponents' }));
    const entered = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 4 }, { kind: 'enter-initiative', combatantId: 'lurker-1', value: 4 });
    expect(whoseTurn(entered.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
    const packOnly = run(
      startFight(skirmish({ ...INDIVIDUAL_RULES, ties: 'party', individualTies: null })).fight,
      { kind: 'enter-initiative', combatantId: 'wren', value: 4 },
      { kind: 'enter-initiative', combatantId: 'lurker-1', value: 4 },
    );
    expect(whoseTurn(packOnly.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'wren' } });
  });

  // When the pack says ties are re-rolled, entering a tied number across the sides asks for the re-roll.
  it('a tie across the sides asks for a re-roll when the pack says so', () => {
    const { fight } = startFight(skirmish({ ...INDIVIDUAL_RULES, ties: 'reroll' }));
    const first = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 4 });
    expect(first.effects).toEqual([]);
    const tied = run(first.fight, { kind: 'enter-initiative', combatantId: 'lurker-1', value: 4 });
    expect(tied.effects).toEqual([{ kind: 'reroll-tie', numbers: [4] }]);
  });

  // End turn per foe group marks every foe of the group done at once.
  it('End turn for a foe group ends every foe of the group', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES, { foes: [lurker(1), lurker(2), warden(1)] }));
    const r = run(fight, { kind: 'end-group-turn', groupId: 'bog-lurker' });
    expect(r.fight.turnsDone).toEqual(['lurker-1', 'lurker-2']);
    expect(applyStep(r.fight, { kind: 'end-group-turn', groupId: 'bog-lurker' })).toMatchObject({ ok: false });
    const all = run(r.fight, { kind: 'end-group-turn', groupId: 'lantern-warden' }, { kind: 'end-turn', combatantId: 'wren' }, { kind: 'end-turn', combatantId: 'bram' });
    expect(all.fight.round).toBe(2);
  });

  // With initiative re-rolled each round, the numbers clear at the advance and the engine asks again.
  it('re-rolled each round: the numbers clear at the advance', () => {
    const { fight } = startFight(skirmish({ ...INDIVIDUAL_RULES, rerollEachRound: true }));
    const r = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 5 }, { kind: 'next-round' });
    expect(r.fight.combatants.every((c) => c.initiative === null)).toBe(true);
    expect(kinds(r.effects)).toContain('initiative-again');
    const once = run(startFight(skirmish(INDIVIDUAL_RULES)).fight, { kind: 'enter-initiative', combatantId: 'wren', value: 5 }, { kind: 'next-round' });
    expect(once.fight.combatants.find((c) => c.id === 'wren')!.initiative).toBe(5);
  });
});

describe('the three hooks (ha-2)', () => {
  // A combatant with a slow weapon acts after everyone, whatever number was entered (ha-2, fi-1).
  it('acts-last goes after everyone, even after missing numbers', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES, { party: [{ ...WREN, actsLast: true }, BRAM, TOBBLE], foes: [lurker(1, { actsLast: true }), lurker(2)] }));
    const entered = run(
      fight,
      { kind: 'enter-initiative', combatantId: 'wren', value: 9 },
      { kind: 'enter-initiative', combatantId: 'bram', value: 2 },
      { kind: 'enter-initiative', combatantId: 'lurker-1', value: 8 },
      { kind: 'enter-initiative', combatantId: 'lurker-2', value: 1 },
    );
    const order: string[] = [];
    let cur = entered.fight;
    while (cur.round === 1) {
      const t = whoseTurn(cur);
      if (t.kind !== 'combatant') break;
      order.push(t.combatant.id);
      cur = run(cur, { kind: 'end-turn', combatantId: t.combatant.id }).fight;
    }
    expect(order).toEqual(['bram', 'lurker-2', 'tobble', 'wren', 'lurker-1']);
  });

  // An initiative modifier is carried with the combatant and never changes the order: two actors entering the same
  // number, one with a modifier, are ordered by the tie-breaker alone (fe-1).
  it('the modifier is carried but never changes the order (fe-1)', () => {
    const { fight } = startFight(skirmish({ ...INDIVIDUAL_RULES, ties: 'opponents' }, { party: [{ ...WREN, initiativeModifier: 3 }], foes: [lurker(1)] }));
    expect(fight.combatants.find((c) => c.id === 'wren')!.initiativeModifier).toBe(3);
    const entered = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 4 }, { kind: 'enter-initiative', combatantId: 'lurker-1', value: 4 });
    expect(whoseTurn(entered.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
    expect(entered.fight.combatants.find((c) => c.id === 'wren')!.initiative).toBe(4);
  });

  // A per-round heal restores its amount at each round and never past the maximum (ha-2).
  it('a per-round heal restores its amount, capped at the maximum', () => {
    const { fight } = startFight(skirmish());
    const withHeal = run(fight, { kind: 'add-status', combatantId: 'wren', status: status('mending', { healPerRound: 2 }) });
    const r2 = run(withHeal.fight, { kind: 'next-round' });
    expect(r2.fight.combatants.find((c) => c.id === 'wren')!.hp).toEqual({ current: 11, max: 12 });
    expect(r2.effects).toContainEqual({ kind: 'heal', combatantId: 'wren', statusId: 'mending', amount: 2 });
    const r3 = run(r2.fight, { kind: 'next-round' });
    expect(r3.fight.combatants.find((c) => c.id === 'wren')!.hp).toEqual({ current: 12, max: 12 });
    expect(r3.effects).toContainEqual({ kind: 'heal', combatantId: 'wren', statusId: 'mending', amount: 1 });
    const r4 = run(r3.fight, { kind: 'next-round' });
    expect(r4.fight.combatants.find((c) => c.id === 'wren')!.hp).toEqual({ current: 12, max: 12 });
    expect(r4.effects).toContainEqual({ kind: 'heal', combatantId: 'wren', statusId: 'mending', amount: 0 });
  });
});

describe('the round advance', () => {
  // A status with a three-round timer ends at the third advance; one with no timer stays.
  it('a three-round timer ends at the third advance; no timer stays', () => {
    const { fight } = startFight(skirmish());
    const set = run(
      fight,
      { kind: 'add-status', combatantId: 'bram', status: status('dazed', { roundsLeft: 3 }) },
      { kind: 'add-status', combatantId: 'bram', status: status('marked') },
    );
    const r2 = run(set.fight, { kind: 'next-round' });
    const r3 = run(r2.fight, { kind: 'next-round' });
    expect(r3.fight.combatants.find((c) => c.id === 'bram')!.statuses.map((s) => [s.id, s.roundsLeft])).toEqual([['dazed', 1], ['marked', null]]);
    expect(kinds(r3.effects)).not.toContain('status-ended');
    const r4 = run(r3.fight, { kind: 'next-round' });
    expect(r4.fight.combatants.find((c) => c.id === 'bram')!.statuses.map((s) => s.id)).toEqual(['marked']);
    expect(r4.effects).toContainEqual({ kind: 'status-ended', combatantId: 'bram', statusId: 'dazed', name: 'dazed' });
  });

  // Dying by the pack's rule: an automatic loss each round, flagged at the dead point; or a death-roll prompt.
  it('a Down character loses HP each round or is asked for the death roll', () => {
    const loss = startFight(skirmish({ ...SIDE_RULES, dyingPerRound: { hp: 1 }, deadAt: -3 }, { party: [{ ...WREN, hp: { current: -1, max: 12 } }] })).fight;
    const down = run(loss, { kind: 'mark-outcome', combatantId: 'wren', outcome: 'down' });
    const r2 = run(down.fight, { kind: 'next-round' });
    expect(r2.fight.combatants[0]!.hp).toEqual({ current: -2, max: 12 });
    expect(r2.effects).toContainEqual({ kind: 'dying-loss', combatantId: 'wren', hp: 1, atDeadPoint: false });
    const r3 = run(r2.fight, { kind: 'next-round' });
    expect(r3.effects).toContainEqual({ kind: 'dying-loss', combatantId: 'wren', hp: 1, atDeadPoint: true });
    expect(r3.fight.combatants[0]!.outcome).toBe('down'); // only the GM marks a character dead
    const roll = startFight(skirmish({ ...SIDE_RULES, dyingPerRound: { chance: { die: '1d6', on: '1' } } })).fight;
    const asked = run(roll, { kind: 'mark-outcome', combatantId: 'bram', outcome: 'down' }, { kind: 'next-round' });
    expect(asked.effects).toContainEqual({ kind: 'death-roll', combatantId: 'bram', die: '1d6', on: '1' });
    expect(asked.fight.combatants.find((c) => c.id === 'bram')!.hp).toEqual({ current: 14, max: 14 });
  });

  // The per-round effects come in the plan's order: dying, heals, arrivals, reminders, initiative again.
  it('returns the per-round effects in order', () => {
    const rules = { ...SIDE_RULES, rerollEachRound: true, dyingPerRound: { hp: 1 } };
    const { fight } = startFight(skirmish(rules, { foes: [lurker(1, { arrivesIn: 1 })] }));
    const set = run(
      fight,
      { kind: 'mark-outcome', combatantId: 'wren', outcome: 'down' },
      { kind: 'add-status', combatantId: 'bram', status: status('mending', { healPerRound: 1, roundsLeft: 1 }) },
    );
    const r = run(set.fight, { kind: 'next-round' });
    expect(kinds(r.effects)).toEqual(['round-started', 'dying-loss', 'heal', 'arrived', 'status-ended', 'initiative-again']);
  });

  // The advance clears targets and turns done; a Delayed flag clears only when its owner's own turn begins.
  it('clears targets and turns done; Delayed clears when the owner’s turn begins', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES));
    const set = run(fight, { kind: 'set-target', combatantId: 'wren', target: 'lurker-1' }, { kind: 'delay', combatantId: 'wren' });
    expect(set.fight.combatants[0]).toMatchObject({ target: 'lurker-1', delayed: true });
    expect(set.fight.turnsDone).toEqual(['wren']);
    const r = run(set.fight, { kind: 'next-round' });
    // Wren is first in the order, so round 2 begins with Wren's turn and the flag clears there.
    expect(r.fight.combatants[0]).toMatchObject({ target: null, delayed: false });
    expect(r.fight.turnsDone).toEqual([]);
  });

  // A target must be on the other side and must exist.
  it('refuses a target on the same side', () => {
    const { fight } = startFight(skirmish());
    expect(applyStep(fight, { kind: 'set-target', combatantId: 'wren', target: 'bram' })).toMatchObject({ ok: false });
    expect(applyStep(fight, { kind: 'set-target', combatantId: 'wren', target: 'nobody' })).toMatchObject({ ok: false });
    expect(applyStep(fight, { kind: 'set-target', combatantId: 'wren', target: 'lurker-2' })).toMatchObject({ ok: true });
  });
});

describe('the fight’s time (fe-2)', () => {
  // A fight of five rounds with no round length adds exactly one turn at End fight and none before.
  it('with no round length, nothing passes per round and End fight returns one turn', () => {
    const { fight } = startFight(skirmish({ ...SIDE_RULES, roundSeconds: null }));
    let cur = fight;
    for (let i = 0; i < 4; i++) cur = run(cur, { kind: 'next-round' }).fight;
    expect(cur.round).toBe(5);
    expect(cur.secondsElapsed).toBe(0);
    expect(minutesElapsed(cur)).toBe(0);
    const ended = run(cur, { kind: 'end-fight' });
    expect(ended.effects).toEqual([{ kind: 'fight-time', turns: 1 }]);
    expect(ended.fight.status).toBe('ended');
  });

  // With a round length, the clock adds the rounds' time and End fight returns it.
  it('with a round length the clock adds each round and End fight returns the seconds', () => {
    const { fight } = startFight(skirmish({ ...SIDE_RULES, roundSeconds: 10 }));
    let cur = fight;
    for (let i = 0; i < 6; i++) cur = run(cur, { kind: 'next-round' }).fight;
    expect(cur.secondsElapsed).toBe(60);
    expect(minutesElapsed(cur)).toBe(1);
    expect(run(cur, { kind: 'end-fight' }).effects).toEqual([{ kind: 'fight-time', seconds: 60 }]);
  });
});

describe('Delay', () => {
  // A Delayed character can act during the foes' turn, and the flag clears when they do.
  it('a Delayed character acts during the foes’ turn and the flag clears', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES));
    const entered = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 6 }, { kind: 'enter-initiative', combatantId: 'lurker-1', value: 4 });
    expect(applyStep(entered.fight, { kind: 'delay', combatantId: 'lurker-1' })).toMatchObject({ ok: false });
    const delayed = run(entered.fight, { kind: 'delay', combatantId: 'wren' });
    expect(delayed.effects).toEqual([{ kind: 'turn-passed', combatantId: 'wren' }]);
    expect(delayed.fight.combatants[0]!.delayed).toBe(true);
    expect(whoseTurn(delayed.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
    const acted = run(delayed.fight, { kind: 'act', combatantId: 'wren' });
    expect(acted.fight.combatants[0]!.delayed).toBe(false);
    expect(whoseTurn(acted.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
  });

  // Delayed in round 1 and not acted, the flag is still set at the start of round 2 and clears when their round-2 turn begins.
  it('a Delayed flag survives into the next round until the owner’s own turn begins', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES));
    const entered = run(fight, { kind: 'enter-initiative', combatantId: 'lurker-1', value: 6 }, { kind: 'enter-initiative', combatantId: 'wren', value: 4 });
    const r1 = run(
      entered.fight,
      { kind: 'end-turn', combatantId: 'lurker-1' },
      { kind: 'delay', combatantId: 'wren' },
      { kind: 'end-turn', combatantId: 'bram' },
      { kind: 'end-turn', combatantId: 'lurker-2' },
    );
    expect(r1.fight.round).toBe(2);
    expect(whoseTurn(r1.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'lurker-1' } });
    expect(r1.fight.combatants[0]).toMatchObject({ id: 'wren', delayed: true });
    const r2 = run(r1.fight, { kind: 'end-turn', combatantId: 'lurker-1' });
    expect(whoseTurn(r2.fight)).toMatchObject({ kind: 'combatant', combatant: { id: 'wren' } });
    expect(r2.fight.combatants[0]!.delayed).toBe(false);
  });
});

describe('We run and ending', () => {
  // We run sets the fight to escaping and changes nothing else; Caught returns to the fight where it was.
  it('We run changes only the status; Caught returns to the same place', () => {
    const { fight } = startFight(skirmish(INDIVIDUAL_RULES));
    const mid = run(fight, { kind: 'enter-initiative', combatantId: 'wren', value: 5 }, { kind: 'end-turn', combatantId: 'wren' }, { kind: 'delay', combatantId: 'bram' });
    const running = run(mid.fight, { kind: 'we-run' });
    expect(running.fight).toEqual({ ...mid.fight, status: 'escaping' });
    expect(applyStep(running.fight, { kind: 'end-turn', combatantId: 'lurker-1' })).toMatchObject({ ok: false });
    expect(applyStep(running.fight, { kind: 'next-round' })).toMatchObject({ ok: false });
    const caught = run(running.fight, { kind: 'caught' });
    expect(caught.fight).toEqual(mid.fight);
    const away = run(running.fight, { kind: 'got-away' });
    expect(away.fight.status).toBe('ended');
    expect(away.effects).toEqual([{ kind: 'fight-time', seconds: 0 }]);
    expect(applyStep(away.fight, { kind: 'next-round' })).toMatchObject({ ok: false, reason: 'The fight has ended.' });
    expect(applyStep(fight, { kind: 'got-away' })).toMatchObject({ ok: false });
  });
});
