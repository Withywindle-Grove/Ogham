// Several fights at once (04 Combat; DG15, 2026-10-30): one is run at a time and the others pause exactly where they
// were. Pure functions over the set of fights; slice 2b stores it.
import type { Effect, StartInput, Step, StepResult } from './engine.ts';
import { applyStep, startFight } from './engine.ts';
import type { Fight } from './types.ts';

export interface Fights {
  fights: Record<string, Fight>;
  /** The fight being run; null when none is. */
  running: string | null;
}

export const NO_FIGHTS: Fights = { fights: {}, running: null };

export type FightsResult = { ok: true; fights: Fights; effects: Effect[]; before: Fights } | { ok: false; reason: string };

function pauseRunning(state: Fights): Record<string, Fight> {
  const fights = { ...state.fights };
  if (state.running && fights[state.running]) fights[state.running] = { ...fights[state.running]!, paused: true };
  return fights;
}

/** Starts a new fight and runs it; the fight being run, if any, pauses where it is. */
export function startAndRun(state: Fights, input: StartInput): FightsResult {
  if (state.fights[input.id]) return { ok: false, reason: 'A fight with that id exists already.' };
  const started = startFight(input);
  return { ok: true, before: state, fights: { fights: { ...pauseRunning(state), [input.id]: started.fight }, running: input.id }, effects: started.effects };
}

/** Resumes a paused fight; the one being run pauses where it is. Everything the paused fight kept is unchanged. */
export function resumeFight(state: Fights, fightId: string): FightsResult {
  const fight = state.fights[fightId];
  if (!fight) return { ok: false, reason: 'No such fight.' };
  if (fight.status === 'ended') return { ok: false, reason: 'That fight has ended.' };
  if (state.running === fightId && !fight.paused) return { ok: false, reason: 'That fight is being run already.' };
  const fights = pauseRunning(state);
  fights[fightId] = { ...fight, paused: false };
  return { ok: true, before: state, fights: { fights, running: fightId }, effects: [] };
}

/** Pauses the fight being run (nothing runs until one is resumed). */
export function pauseFight(state: Fights, fightId: string): FightsResult {
  const fight = state.fights[fightId];
  if (!fight) return { ok: false, reason: 'No such fight.' };
  if (fight.paused) return { ok: false, reason: 'That fight is paused already.' };
  return { ok: true, before: state, fights: { fights: { ...state.fights, [fightId]: { ...fight, paused: true } }, running: state.running === fightId ? null : state.running }, effects: [] };
}

/** Sends a step to one fight. A paused fight refuses it with a reason; the others are untouched. */
export function applyFightStep(state: Fights, fightId: string, step: Step): FightsResult & { step?: StepResult } {
  const fight = state.fights[fightId];
  if (!fight) return { ok: false, reason: 'No such fight.' };
  const result = applyStep(fight, step);
  if (!result.ok) return result;
  return { ok: true, before: state, fights: { ...state, fights: { ...state.fights, [fightId]: result.fight } }, effects: result.effects, step: result };
}
