// Event-triggered checks (ruled 2026-10-30, D9; 05 "Exploration modes"): a check's `alsoWhen` (e.g. leaving a road)
// prompts it on a Move… that matches, beside its usual place in the procedure. The prompt itself is the ordinary
// check prompt, worked out for where the party is going. Pure.
import { checkPrompt, type CheckContext, type CheckPrompt } from './checks.ts';
import type { Check, ExplorationRules, Icon, Mode } from './modes.ts';
import type { Trigger } from './wildPack.ts';
import { runsNow, type TownSwitches } from './townSwitches.ts';

/** Where the party is on the map, for triggers: the route it follows and the terrain it's in. */
export interface Position {
  routeId: string | null;
  terrainId: string | null;
}

export interface Triggered {
  check: Check;
  trigger: Trigger;
  /** Why it prompts, in plain words ("Left the Road"). */
  reason: string;
}

function matches(trigger: Trigger, from: Position, to: Position): boolean {
  switch (trigger.event) {
    case 'leaveRoute':
      return from.routeId === trigger.id && to.routeId !== trigger.id;
    case 'enterRoute':
      return to.routeId === trigger.id && from.routeId !== trigger.id;
    case 'leaveTerrain':
      return from.terrainId === trigger.id && to.terrainId !== trigger.id;
    case 'enterTerrain':
      return to.terrainId === trigger.id && from.terrainId !== trigger.id;
  }
}

function reasonFor(trigger: Trigger, mode: Mode): string {
  const route = mode.wild.travel?.routes.find((r) => r.id === trigger.id)?.name ?? trigger.id;
  const terrain = mode.terrain.find((t) => t.id === trigger.id)?.name ?? trigger.id;
  switch (trigger.event) {
    case 'leaveRoute':
      return `Left the ${route}`;
    case 'enterRoute':
      return `Joined the ${route}`;
    case 'leaveTerrain':
      return `Left the ${terrain}`;
    case 'enterTerrain':
      return `Entered the ${terrain}`;
  }
}

/** The mode's checks a move from one position to another sets off, each once (its first matching trigger), in pack order. */
export function triggeredChecks(mode: Mode, from: Position, to: Position, switches?: TownSwitches): Triggered[] {
  // A check with onlyWhen is set off only while its town switch is on (sw-1 … sw-4), as in the procedure.
  return mode.checks.filter((check) => runsNow(check.onlyWhen, switches)).flatMap((check) => {
    const trigger = check.alsoWhen.find((t) => matches(t, from, to));
    return trigger ? [{ check, trigger, reason: reasonFor(trigger, mode) }] : [];
  });
}

/** The symbol of the step that runs a check (the procedure, then camp); the plain dot when no step runs it. */
export function iconForCheck(mode: Mode, checkId: string): Icon {
  const steps = [...mode.procedure, ...(mode.camp?.procedure ?? [])];
  return steps.find((s) => s.kind === 'check' && s.checkId === checkId)?.icon ?? 'dot';
}

/** The prompts a move sets off, worked out for the destination (its terrain and route), each with its reason. */
export function triggeredPrompts(
  mode: Mode,
  rules: ExplorationRules | null,
  from: Position,
  to: Position,
  ctx: Omit<CheckContext, 'terrain' | 'routeType'> = {},
  switches?: TownSwitches,
): (CheckPrompt & { reason: string })[] {
  const terrain = to.terrainId ? (mode.terrain.find((t) => t.id === to.terrainId) ?? null) : null;
  return triggeredChecks(mode, from, to, switches).map(({ check, reason }) => ({
    ...checkPrompt(check, iconForCheck(mode, check.id), rules, { ...ctx, terrain, routeType: to.routeId }),
    reason,
  }));
}
