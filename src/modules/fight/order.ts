// Whose turn it is. Pure reads over a fight's state: nothing here changes anything.
import type { Combatant, Fight, SideId, Ties } from './types.ts';
import { isActing } from './types.ts';

/** A surprised side loses round 1 (05, Surprise). */
export function skipsThisRound(fight: Fight, side: SideId): boolean {
  return fight.round === 1 && fight.surprised.includes(side);
}

/** The sides that take a turn this round: a side with nobody acting is done already, and a surprised side skips round 1. */
export function sidesActing(fight: Fight): SideId[] {
  return (['party', 'foes'] as const).filter(
    (side) => !skipsThisRound(fight, side) && fight.combatants.some((c) => c.side === side && isActing(c)),
  );
}

/**
 * Individual initiative: the round's order from the entered numbers alone (fe-1: the modifier is never added).
 * High or low first per the setting; a missing number acts last; a combatant flagged acts-last goes after everyone,
 * after the missing numbers too; ties between the sides follow the pack's tie rule, and within a side the list order.
 */
export function turnOrder(fight: Fight): Combatant[] {
  const acting = fight.combatants.filter(isActing);
  const indexOf = new Map(fight.combatants.map((c, i) => [c.id, i] as const));
  const rank = (c: Combatant): number => (c.actsLast ? 2 : c.initiative === null ? 1 : 0);
  const ties = individualTies(fight);
  const sideRank = (side: SideId): number => {
    if (ties === 'party') return side === 'party' ? 0 : 1;
    if (ties === 'opponents') return side === 'foes' ? 0 : 1;
    return 0; // reroll and simultaneous: nothing decides, so the list order stands (the reroll is asked for as an effect)
  };
  return [...acting].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) {
      const byNumber = fight.rules.order === 'high' ? b.initiative! - a.initiative! : a.initiative! - b.initiative!;
      if (byNumber !== 0) return byNumber;
      if (a.side !== b.side && sideRank(a.side) !== sideRank(b.side)) return sideRank(a.side) - sideRank(b.side);
    }
    return indexOf.get(a.id)! - indexOf.get(b.id)!;
  });
}

/** Individual mode's tie-breaker: the campaign's setting, else the pack's `ties`. */
export function individualTies(fight: Fight): Ties {
  return fight.rules.individualTies ?? fight.rules.ties;
}

/** Individual mode: the entered numbers that tie across the sides when the tie rule says to re-roll. */
export function tiedAcrossSides(fight: Fight): number[] {
  if (individualTies(fight) !== 'reroll') return [];
  const numbers = new Set<number>();
  const acting = fight.combatants.filter((c) => isActing(c) && c.initiative !== null && !c.actsLast);
  for (const a of acting) for (const b of acting) if (a.side !== b.side && a.initiative === b.initiative) numbers.add(a.initiative!);
  return [...numbers].sort((x, y) => x - y);
}

export type WhoseTurn =
  | { kind: 'winner' } // side mode, the GM's "which side won" tap is awaited
  | { kind: 'side'; sides: SideId[] } // side mode: one side, or both when the tie is simultaneous
  | { kind: 'combatant'; combatant: Combatant } // individual mode
  | { kind: 'done' }; // every turn is done (the round advances by itself right after)

/** Whose turn it is now. */
export function whoseTurn(fight: Fight): WhoseTurn {
  if (fight.rules.mode === 'side') {
    if (fight.awaitingWinner) return { kind: 'winner' };
    const acting = sidesActing(fight);
    const left = fight.sideOrder.filter((side) => acting.includes(side) && !fight.turnsDone.includes(side));
    if (left.length === 0) return { kind: 'done' };
    return { kind: 'side', sides: fight.simultaneous ? left : [left[0]!] };
  }
  const next = turnOrder(fight).find((c) => !fight.turnsDone.includes(c.id) && !skipsThisRound(fight, c.side));
  return next ? { kind: 'combatant', combatant: next } : { kind: 'done' };
}

/** True when nobody has a turn left this round. */
export function roundDone(fight: Fight): boolean {
  return whoseTurn(fight).kind === 'done';
}
