// Fight module (M6 slice 2a): the engine only. Nothing in the app imports this yet; slice 2b registers its commands
// here (02 Foundation 5) and stores the state. Plan: docs/plans/m6-2a-fight-engine.md.
export type { Combatant, CombatantKind, Fight, FightRules, FightStatus, FightStatusEntry, HitPoints, InitiativeMode, Outcome, SideId, Ties } from './types.ts';
export { isActing, minutesElapsed } from './types.ts';
export type { Effect, NewFoe, NewPartyMember, Reversal, StartInput, Step, StepKind, StepResult } from './engine.ts';
export { advanceRound, applyStep, reversalOf, startFight, undoStep } from './engine.ts';
export type { WhoseTurn } from './order.ts';
export { individualTies, roundDone, sidesActing, skipsThisRound, tiedAcrossSides, turnOrder, whoseTurn } from './order.ts';
export type { Fights, FightsResult } from './fights.ts';
export { NO_FIGHTS, applyFightStep, pauseFight, resumeFight, startAndRun } from './fights.ts';
