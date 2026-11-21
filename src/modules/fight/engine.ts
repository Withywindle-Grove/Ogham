// The fight engine: every step that changes a fight, as pure functions `(fight, step) → { fight, effects, undo }`.
// Slice 2b wraps each step in a command and stores the event with its reversal. Nothing here rolls a die or decides
// an outcome; nothing here reads or writes storage. Plan: docs/plans/m6-2a-fight-engine.md.
import type { Combatant, CombatantKind, Fight, FightRules, FightStatusEntry, HitPoints, Outcome, SideId } from './types.ts';
import { isActing } from './types.ts';
import { roundDone, skipsThisRound, tiedAcrossSides, whoseTurn } from './order.ts';

// ---- Steps -------------------------------------------------------------------------------------------------------

export interface NewPartyMember {
  id: string;
  actorId: string;
  name: string;
  kind: Exclude<CombatantKind, 'foe'>;
  actsLast?: boolean;
  initiativeModifier?: number;
  hp?: HitPoints | null;
  statuses?: FightStatusEntry[];
}

export interface NewFoe {
  id: string;
  actorId: string;
  /** The kind's name without a number ("Bog lurker"). */
  name: string;
  /** Foes of one kind share a group: numbering and End turn per group. */
  groupId: string;
  /** An ally joins the party's side (05, Add foes); default foes. */
  side?: SideId;
  hidden?: boolean;
  arrivesIn?: number | null;
  actsLast?: boolean;
  initiativeModifier?: number;
  hp?: HitPoints | null;
  statuses?: FightStatusEntry[];
}

export interface StartInput {
  id: string;
  partyGroupId: string;
  rules: FightRules;
  party: NewPartyMember[];
  foes: NewFoe[];
  surprised?: SideId[];
}

export type Step =
  | { kind: 'add-foes'; foes: NewFoe[] }
  | { kind: 'set-winner'; winner: SideId | 'tie' }
  | { kind: 'end-side-turn'; side: SideId }
  | { kind: 'enter-initiative'; combatantId: string; value: number | null }
  | { kind: 'end-turn'; combatantId: string }
  | { kind: 'end-group-turn'; groupId: string }
  | { kind: 'delay'; combatantId: string }
  | { kind: 'act'; combatantId: string }
  | { kind: 'set-target'; combatantId: string; target: string | null }
  | { kind: 'next-round' }
  | { kind: 'reveal'; combatantId: string }
  | { kind: 'mark-outcome'; combatantId: string; outcome: Outcome }
  | { kind: 'add-status'; combatantId: string; status: FightStatusEntry }
  | { kind: 'end-status'; combatantId: string; statusId: string }
  | { kind: 'we-run' }
  | { kind: 'got-away' }
  | { kind: 'caught' }
  | { kind: 'end-fight' };

export type StepKind = Step['kind'];

// ---- Effects ------------------------------------------------------------------------------------------------------

/** What a step did besides changing the state: what the log says and what the screen prompts. In the order they happened. */
export type Effect =
  | { kind: 'surprised-skips'; side: SideId }
  | { kind: 'round-started'; round: number }
  | { kind: 'dying-loss'; combatantId: string; hp: number; atDeadPoint: boolean }
  | { kind: 'death-roll'; combatantId: string; die: string; on: string }
  | { kind: 'heal'; combatantId: string; statusId: string; amount: number }
  | { kind: 'arrived'; combatantId: string; hidden: boolean }
  | { kind: 'status-ended'; combatantId: string; statusId: string; name: string }
  | { kind: 'initiative-again' }
  | { kind: 'reroll-initiative' }
  | { kind: 'reroll-tie'; numbers: number[] }
  | { kind: 'turn-passed'; combatantId: string }
  | { kind: 'fight-time'; turns: 1 }
  | { kind: 'fight-time'; seconds: number };

// ---- Reversal -----------------------------------------------------------------------------------------------------

/** What undoes a step exactly: the prior values of what changed, or the whole prior state where that is cheaper. */
export type Reversal =
  | { kind: 'whole'; before: Fight }
  | { kind: 'patch'; fight: Partial<Fight>; combatants: Record<string, Partial<Combatant>> };

export type StepResult = { ok: true; fight: Fight; effects: Effect[]; undo: Reversal } | { ok: false; reason: string };

/** Returns the fight as it was before the step the reversal came from. */
export function undoStep(fight: Fight, undo: Reversal): Fight {
  if (undo.kind === 'whole') return undo.before;
  return {
    ...fight,
    ...undo.fight,
    combatants: fight.combatants.map((c) => (undo.combatants[c.id] ? { ...c, ...undo.combatants[c.id] } : c)),
  };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The reversal from before to after: a patch of the changed fields when the combatant list is the same, else the whole. */
export function reversalOf(before: Fight, after: Fight): Reversal {
  const sameIds = before.combatants.length === after.combatants.length && before.combatants.every((c, i) => c.id === after.combatants[i]!.id);
  if (!sameIds) return { kind: 'whole', before };
  const fight: Partial<Fight> = {};
  for (const key of Object.keys(before) as (keyof Fight)[]) {
    if (key === 'combatants') continue;
    if (!same(before[key], after[key])) (fight as Record<string, unknown>)[key] = before[key];
  }
  const combatants: Record<string, Partial<Combatant>> = {};
  before.combatants.forEach((b, i) => {
    const a = after.combatants[i]!;
    const patch: Partial<Combatant> = {};
    for (const key of Object.keys(b) as (keyof Combatant)[]) if (!same(b[key], a[key])) (patch as Record<string, unknown>)[key] = b[key];
    if (Object.keys(patch).length > 0) combatants[b.id] = patch;
  });
  return { kind: 'patch', fight, combatants };
}

// ---- Starting -----------------------------------------------------------------------------------------------------

function partyMember(p: NewPartyMember): Combatant {
  return {
    id: p.id,
    actorId: p.actorId,
    name: p.name,
    kind: p.kind,
    side: 'party',
    groupId: null,
    number: null,
    initiative: null,
    initiativeModifier: p.initiativeModifier ?? 0,
    actsLast: p.actsLast ?? false,
    delayed: false,
    target: null,
    statuses: p.statuses ?? [],
    hidden: false,
    arrivesIn: null,
    outcome: 'fighting',
    hp: p.hp ?? null,
  };
}

/** Numbers the foes in order, continuing each group's count; returns the new combatants and the counts after. */
function numberFoes(foes: NewFoe[], nextNumber: Record<string, number>): { combatants: Combatant[]; nextNumber: Record<string, number> } {
  const counts = { ...nextNumber };
  const combatants = foes.map((f): Combatant => {
    const number = counts[f.groupId] ?? 1;
    counts[f.groupId] = number + 1;
    return {
      id: f.id,
      actorId: f.actorId,
      name: f.name,
      kind: 'foe',
      side: f.side ?? 'foes',
      groupId: f.groupId,
      number,
      initiative: null,
      initiativeModifier: f.initiativeModifier ?? 0,
      actsLast: f.actsLast ?? false,
      delayed: false,
      target: null,
      statuses: f.statuses ?? [],
      hidden: f.hidden ?? false,
      arrivesIn: f.arrivesIn ?? null,
      outcome: 'fighting',
      hp: f.hp ?? null,
    };
  });
  return { combatants, nextNumber: counts };
}

/** Starts a fight at round 1. Side mode awaits the winner tap; a surprised side's skip is reported. */
export function startFight(input: StartInput): { fight: Fight; effects: Effect[] } {
  const surprised = input.surprised ?? [];
  const { combatants, nextNumber } = numberFoes(input.foes, {});
  const fight: Fight = {
    id: input.id,
    partyGroupId: input.partyGroupId,
    rules: input.rules,
    status: 'under-way',
    paused: false,
    round: 1,
    secondsElapsed: 0,
    surprised,
    combatants: [...input.party.map(partyMember), ...combatants],
    sideOrder: [],
    simultaneous: false,
    awaitingWinner: input.rules.mode === 'side',
    turnsDone: [],
    nextNumber,
  };
  return { fight, effects: surprised.map((side) => ({ kind: 'surprised-skips', side })) };
}

// ---- The round advance --------------------------------------------------------------------------------------------

/**
 * The next round: adds the round's time (none when the pack gives no round length, fe-2), applies dying and per-round
 * heals, counts arrivals down, ticks every round timer and ends those at zero, clears the turns done and the targets,
 * and asks for initiative again when the rule re-rolls.
 */
export function advanceRound(fight: Fight): { fight: Fight; effects: Effect[] } {
  const effects: Effect[] = [];
  const round = fight.round + 1;
  effects.push({ kind: 'round-started', round });
  let combatants = fight.combatants.map((c) => ({ ...c, statuses: c.statuses.map((s) => ({ ...s })) }));

  // Dying: an automatic loss or a death-roll prompt for each Down character (05, Down and the death panel).
  const dying = fight.rules.dyingPerRound;
  if (dying) {
    combatants = combatants.map((c) => {
      if (c.outcome !== 'down') return c;
      if ('hp' in dying) {
        const current = c.hp ? c.hp.current - dying.hp : null;
        const atDeadPoint = current !== null && fight.rules.deadAt !== null && current <= fight.rules.deadAt;
        effects.push({ kind: 'dying-loss', combatantId: c.id, hp: dying.hp, atDeadPoint });
        return c.hp && current !== null ? { ...c, hp: { ...c.hp, current } } : c;
      }
      effects.push({ kind: 'death-roll', combatantId: c.id, die: dying.chance.die, on: dying.chance.on });
      return c;
    });
  }

  // Per-round heals (ha-2): each healing status restores its amount, never past the maximum.
  combatants = combatants.map((c) => {
    let hp = c.hp;
    for (const s of c.statuses) {
      if (s.healPerRound === null || s.healPerRound <= 0) continue;
      const amount = hp ? Math.max(0, Math.min(s.healPerRound, hp.max - hp.current)) : 0;
      if (hp) hp = { ...hp, current: hp.current + amount };
      effects.push({ kind: 'heal', combatantId: c.id, statusId: s.id, amount });
    }
    return hp === c.hp ? c : { ...c, hp };
  });

  // Arrivals: the countdown ticks and the foe joins by itself at zero (still hidden if it was added hidden).
  combatants = combatants.map((c) => {
    if (c.arrivesIn === null) return c;
    const left = c.arrivesIn - 1;
    if (left > 0) return { ...c, arrivesIn: left };
    effects.push({ kind: 'arrived', combatantId: c.id, hidden: c.hidden });
    return { ...c, arrivesIn: null };
  });

  // Round timers tick; a status at zero ends (the end-of-round reminders).
  combatants = combatants.map((c) => {
    const statuses: FightStatusEntry[] = [];
    for (const s of c.statuses) {
      if (s.roundsLeft === null) {
        statuses.push(s);
        continue;
      }
      const left = s.roundsLeft - 1;
      if (left > 0) statuses.push({ ...s, roundsLeft: left });
      else effects.push({ kind: 'status-ended', combatantId: c.id, statusId: s.id, name: s.name });
    }
    return { ...c, statuses };
  });

  // The new round: turns and targets clear. A Delayed flag stays until its owner's own turn begins (dry run 5), so a
  // character who delayed and hasn't acted may still act during the turns that come before theirs.
  combatants = combatants.map((c) => ({ ...c, target: null }));

  let next: Fight = {
    ...fight,
    round,
    secondsElapsed: fight.secondsElapsed + (fight.rules.roundSeconds ?? 0),
    combatants,
    turnsDone: [],
  };
  if (fight.rules.rerollEachRound) {
    effects.push({ kind: 'initiative-again' });
    next =
      fight.rules.mode === 'side'
        ? { ...next, awaitingWinner: true, sideOrder: [], simultaneous: false }
        : { ...next, combatants: next.combatants.map((c) => ({ ...c, initiative: null })) };
  }
  return { fight: next, effects };
}

// ---- Steps --------------------------------------------------------------------------------------------------------

function refuse(reason: string): StepResult {
  return { ok: false, reason };
}

function withCombatant(fight: Fight, id: string, change: (c: Combatant) => Combatant): Fight {
  return { ...fight, combatants: fight.combatants.map((c) => (c.id === id ? change(c) : c)) };
}

function find(fight: Fight, id: string): Combatant | undefined {
  return fight.combatants.find((c) => c.id === id);
}

function fightTime(fight: Fight): Effect {
  return fight.rules.roundSeconds === null ? { kind: 'fight-time', turns: 1 } : { kind: 'fight-time', seconds: fight.secondsElapsed };
}

/** After a turn ends: when every turn is done, the next round starts by itself (04 turnsDone; dry run 4). */
function settle(fight: Fight, effects: Effect[]): { fight: Fight; effects: Effect[] } {
  if (fight.status !== 'under-way' || !roundDone(fight)) return { fight, effects };
  const advanced = advanceRound(fight);
  return { fight: advanced.fight, effects: [...effects, ...advanced.effects] };
}

function applyUnderWay(fight: Fight, step: Step): { fight: Fight; effects: Effect[] } | string {
  switch (step.kind) {
    case 'add-foes': {
      if (step.foes.length === 0) return 'Nothing to add.';
      if (step.foes.some((f) => find(fight, f.id))) return 'A foe with that id is in the fight already.';
      const { combatants, nextNumber } = numberFoes(step.foes, fight.nextNumber);
      return { fight: { ...fight, combatants: [...fight.combatants, ...combatants], nextNumber }, effects: [] };
    }
    case 'set-winner': {
      if (fight.rules.mode !== 'side') return 'Initiative is individual here: enter each number instead.';
      if (!fight.awaitingWinner) return 'This round’s order is set already.';
      if (step.winner !== 'tie') {
        const other: SideId = step.winner === 'party' ? 'foes' : 'party';
        return { fight: { ...fight, awaitingWinner: false, sideOrder: [step.winner, other], simultaneous: false }, effects: [] };
      }
      switch (fight.rules.ties) {
        case 'party':
          return { fight: { ...fight, awaitingWinner: false, sideOrder: ['party', 'foes'], simultaneous: false }, effects: [] };
        case 'opponents':
          return { fight: { ...fight, awaitingWinner: false, sideOrder: ['foes', 'party'], simultaneous: false }, effects: [] };
        case 'simultaneous':
          return { fight: { ...fight, awaitingWinner: false, sideOrder: ['party', 'foes'], simultaneous: true }, effects: [] };
        case 'reroll':
          return { fight, effects: [{ kind: 'reroll-initiative' }] };
      }
      return 'Unknown tie rule.';
    }
    case 'end-side-turn': {
      if (fight.rules.mode !== 'side') return 'Initiative is individual here: end each turn instead.';
      if (fight.awaitingWinner) return 'Tap which side won first.';
      if (skipsThisRound(fight, step.side)) return 'That side is surprised and has no turn this round.';
      if (fight.turnsDone.includes(step.side)) return 'That side’s turn is over already.';
      const turn = whoseTurn(fight);
      if (turn.kind === 'side' && !turn.sides.includes(step.side)) return 'It isn’t that side’s turn yet.';
      if (turn.kind === 'done') return 'Every turn is done this round.';
      const next: Fight = {
        ...fight,
        turnsDone: [...fight.turnsDone, step.side],
        combatants: fight.combatants.map((c) => (c.side === step.side ? { ...c, target: null } : c)),
      };
      return settle(next, []);
    }
    case 'enter-initiative': {
      if (fight.rules.mode !== 'individual') return 'Initiative is by side here: tap which side won instead.';
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (step.value !== null && !Number.isInteger(step.value)) return 'Initiative is a whole number.';
      const next = withCombatant(fight, c.id, (x) => ({ ...x, initiative: step.value }));
      const tied = tiedAcrossSides(next);
      return { fight: next, effects: tied.length > 0 ? [{ kind: 'reroll-tie', numbers: tied }] : [] };
    }
    case 'end-turn': {
      if (fight.rules.mode !== 'individual') return 'Initiative is by side here: end the side’s turn instead.';
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (!isActing(c)) return `${c.name} has no turn this round.`;
      if (skipsThisRound(fight, c.side)) return `${c.name}’s side is surprised and has no turn this round.`;
      if (fight.turnsDone.includes(c.id)) return `${c.name}’s turn is over already.`;
      const next = withCombatant({ ...fight, turnsDone: [...fight.turnsDone, c.id] }, c.id, (x) => ({ ...x, target: null, delayed: false }));
      return settle(next, []);
    }
    case 'end-group-turn': {
      if (fight.rules.mode !== 'individual') return 'Initiative is by side here: end the side’s turn instead.';
      const members = fight.combatants.filter((c) => c.groupId === step.groupId && isActing(c) && !fight.turnsDone.includes(c.id) && !skipsThisRound(fight, c.side));
      if (members.length === 0) return 'That group has no turn left this round.';
      const ids = members.map((c) => c.id);
      const next: Fight = {
        ...fight,
        turnsDone: [...fight.turnsDone, ...ids],
        combatants: fight.combatants.map((c) => (ids.includes(c.id) ? { ...c, target: null, delayed: false } : c)),
      };
      return settle(next, []);
    }
    case 'delay': {
      if (fight.rules.mode !== 'individual') return 'Delay is only for individual initiative.';
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      const turn = whoseTurn(fight);
      if (turn.kind !== 'combatant' || turn.combatant.id !== c.id) return `It isn’t ${c.name}’s turn.`;
      const next = withCombatant({ ...fight, turnsDone: [...fight.turnsDone, c.id] }, c.id, (x) => ({ ...x, delayed: true }));
      return settle(next, [{ kind: 'turn-passed', combatantId: c.id }]);
    }
    case 'act': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (!isActing(c)) return `${c.name} can’t act now.`;
      return { fight: withCombatant(fight, c.id, (x) => ({ ...x, delayed: false })), effects: [] };
    }
    case 'set-target': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (step.target !== null) {
        const t = find(fight, step.target);
        if (!t) return 'No such target.';
        if (t.side === c.side) return 'A target is on the other side.';
      }
      return { fight: withCombatant(fight, c.id, (x) => ({ ...x, target: step.target })), effects: [] };
    }
    case 'next-round':
      return advanceRound(fight);
    case 'reveal': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (!c.hidden) return `${c.name} is already revealed.`;
      return { fight: withCombatant(fight, c.id, (x) => ({ ...x, hidden: false })), effects: [] };
    }
    case 'mark-outcome': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (c.outcome === step.outcome) return `${c.name} is marked so already.`;
      return settle(withCombatant(fight, c.id, (x) => ({ ...x, outcome: step.outcome })), []);
    }
    case 'add-status': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (c.statuses.some((s) => s.id === step.status.id)) return 'That status is on already.';
      if (step.status.roundsLeft !== null && (!Number.isInteger(step.status.roundsLeft) || step.status.roundsLeft < 1)) return 'A timer is a whole number of rounds, 1 or more.';
      return { fight: withCombatant(fight, c.id, (x) => ({ ...x, statuses: [...x.statuses, step.status] })), effects: [] };
    }
    case 'end-status': {
      const c = find(fight, step.combatantId);
      if (!c) return 'No such combatant.';
      if (!c.statuses.some((s) => s.id === step.statusId)) return 'That status isn’t on.';
      return { fight: withCombatant(fight, c.id, (x) => ({ ...x, statuses: x.statuses.filter((s) => s.id !== step.statusId) })), effects: [] };
    }
    case 'we-run':
      return { fight: { ...fight, status: 'escaping' }, effects: [] };
    case 'end-fight':
      return { fight: { ...fight, status: 'ended' }, effects: [fightTime(fight)] };
    case 'got-away':
    case 'caught':
      return 'Nobody is running: call We run first.';
  }
  return 'Unknown step.';
}

/**
 * Applies one step. A paused fight refuses every step (resume it first); an ended one too. While the party is escaping
 * only Got away and Caught are taken: We run changes nothing else and Caught returns to the fight where it was.
 */
export function applyStep(fight: Fight, step: Step): StepResult {
  if (fight.paused) return refuse('This fight is paused: resume it first.');
  if (fight.status === 'ended') return refuse('The fight has ended.');
  if (fight.status === 'escaping') {
    if (step.kind === 'got-away') return finish(fight, { ...fight, status: 'ended' }, [fightTime(fight)]);
    if (step.kind === 'caught') return finish(fight, { ...fight, status: 'under-way' }, []);
    return refuse('The party is running: tap Got away or Caught first.');
  }
  const result = applyUnderWay(fight, step);
  if (typeof result === 'string') return refuse(result);
  return finish(fight, result.fight, result.effects);
}

/** A Delayed flag clears when its owner's next normal turn begins (05 Delay; dry run 5). */
function clearDelayedWhoseTurnBegins(fight: Fight): Fight {
  if (fight.status !== 'under-way') return fight;
  const turn = whoseTurn(fight);
  if (turn.kind !== 'combatant' || !turn.combatant.delayed) return fight;
  return withCombatant(fight, turn.combatant.id, (c) => ({ ...c, delayed: false }));
}

function finish(before: Fight, after: Fight, effects: Effect[]): StepResult {
  const settled = clearDelayedWhoseTurnBegins(after);
  return { ok: true, fight: settled, effects, undo: reversalOf(before, settled) };
}
