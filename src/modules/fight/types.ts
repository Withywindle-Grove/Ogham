// The fight engine's state (M6 slice 2a, docs/plans/m6-2a-fight-engine.md). Pure data: slice 2b stores it and wraps
// every step in a command. Shapes follow 04 Combat (Encounter, Combatant, We run); where 04 is silent the choice is
// written in the plan's Departures. Nothing here rolls a die or decides an outcome: every number is entered, every
// result is tapped.

/** The two sides of a fight. Allies join the party's side (05, Add foes); hirelings are on it already. */
export type SideId = 'party' | 'foes';

/** 04: `status` (under way, escaping, ended) and `paused` are separate fields; a paused fight keeps its status. */
export type FightStatus = 'under-way' | 'escaping' | 'ended';

export type InitiativeMode = 'side' | 'individual';

/** 07 `initiative.ties`: what happens when both sides roll the same. */
export type Ties = 'party' | 'opponents' | 'reroll' | 'simultaneous';

/** A combatant's standing in the fight (05, Down, dying, dead, fled, surrendered; captured from Ending a fight). */
export type Outcome = 'fighting' | 'down' | 'dead' | 'fled' | 'surrendered' | 'captured';

export type CombatantKind = 'character' | 'hireling' | 'foe';

/**
 * The setting's timing, read from the pack by slice 2b (07 `initiative`, `time`, `death`). Every field has a
 * fallback so a pack without them still works (07: "Every field below is optional").
 */
export interface FightRules {
  mode: InitiativeMode;
  /** 07 `initiative.rerollEachRound`: true asks for the winner (or new numbers) every round; false once per fight. */
  rerollEachRound: boolean;
  ties: Ties;
  /** Individual mode: whether the higher or the lower entered number acts first (07 `initiative.order`). */
  order: 'high' | 'low';
  /**
   * Individual mode's tie-breaker from the campaign's settings (05: number range, high or low first, tie-breaker);
   * null means the pack's `ties` applies. Slice 2b passes the campaign's setting in.
   */
  individualTies: Ties | null;
  /**
   * The seconds one round adds to the clock (07 `time.roundSeconds`). `null` when the pack gives none: then no time
   * passes round by round and the whole fight takes one turn, returned as an effect when it ends (fe-2).
   */
  roundSeconds: number | null;
  /** 07 `death.dying.perRound`: what happens by itself to a Down character at each new round; null for the plain rule. */
  dyingPerRound: { hp: number } | { chance: { die: string; on: string } } | null;
  /** 07 `death.dying.deadAt`: the HP at which dying ends in death (the GM still marks it); null when the pack gives none. */
  deadAt: number | null;
}

/** A status on a combatant, with its optional round timer and the ha-2 per-round heal. */
export interface FightStatusEntry {
  id: string;
  name: string;
  /** Rounds left; null means no timer (it stays until removed). Ticks at each round advance; ends at zero. */
  roundsLeft: number | null;
  /** ha-2: HP restored at each round advance while the status lasts, capped at the maximum. */
  healPerRound: number | null;
  /** GM-secret timer (05): players see that it is active, not what is left. Slice 2b hides it; the engine only keeps it. */
  secret: boolean;
}

/**
 * HP as the engine needs it for its own arithmetic (per-round heals and dying losses). HP's home is its own table
 * (slice 1); slice 2b fills this from it and writes the result back. A foe's HP is secret: 2b never sends it to players.
 */
export interface HitPoints {
  current: number;
  max: number;
}

export interface Combatant {
  id: string;
  actorId: string;
  /** The display name without the number ("Bog lurker"); the number is `number`. */
  name: string;
  kind: CombatantKind;
  side: SideId;
  /** Foes of one kind form a group (05: numbered, End turn per group). Null for party members. */
  groupId: string | null;
  /** Its number among foes of the same kind: never reshuffled, never reused (05). Null for party members. */
  number: number | null;
  /** The entered initiative (individual mode); null when nothing was entered: acts last, never blocks. */
  initiative: number | null;
  /**
   * ha-2 / fe-1: the actor's own modifier (07's `initiativeModifier` target), carried only so the pad can show it as a
   * reminder. The entered number is final: the engine never adds the modifier and it never changes the order.
   */
  initiativeModifier: number;
  /** ha-2 / fi-1: a slow weapon or `initiative: "last"` on the stat block. Goes after everyone else in its round. */
  actsLast: boolean;
  /** 04: a visible flag set by Delay; cleared when the character acts or when their next normal turn begins. */
  delayed: boolean;
  /** 04: a player's optional tap on the foe they attack; cleared when the turn ends or the round advances. */
  target: string | null;
  statuses: FightStatusEntry[];
  /** Hidden from players (05, Add foes): takes no turn until revealed. */
  hidden: boolean;
  /** Rounds until it joins; null when present. Counts down at each round advance. */
  arrivesIn: number | null;
  outcome: Outcome;
  hp: HitPoints | null;
}

export interface Fight {
  id: string;
  partyGroupId: string;
  rules: FightRules;
  status: FightStatus;
  paused: boolean;
  round: number;
  /** Seconds on the clock since the fight began (integer). Minutes are derived: see `minutesElapsed`. */
  secondsElapsed: number;
  /** Sides that lose round 1 (05, Surprise). */
  surprised: SideId[];
  combatants: Combatant[];
  /**
   * Side mode: the order of the sides this round once the winner is tapped; empty while the tap is awaited.
   * `simultaneous` marks a tie the pack resolves by both acting together.
   */
  sideOrder: SideId[];
  simultaneous: boolean;
  /** Side mode: the GM's "which side won" tap is awaited (at the start, and at each round when the rule re-rolls). */
  awaitingWinner: boolean;
  /** 04 turnsDone: side ids in side mode, combatant ids in individual mode. Reset at each round. */
  turnsDone: string[];
  /** The next number for each foe group: numbers continue and are never reused. */
  nextNumber: Record<string, number>;
}

export function minutesElapsed(fight: Pick<Fight, 'secondsElapsed'>): number {
  return Math.floor(fight.secondsElapsed / 60);
}

/** A combatant that takes turns this round: present, revealed, and still in the fight. */
export function isActing(c: Combatant): boolean {
  return c.arrivesIn === null && !c.hidden && c.outcome === 'fighting';
}
