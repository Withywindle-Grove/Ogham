// Hit points on the Player screen: whole numbers; HP may go below 0; + stops at max, but the keypad may set
// any whole number, including above max (temporary HP). M2 adds a log entry and undo to setHp.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult } from '../../core/commands.ts';
import { gmRuling, isOwner, type CharacterRef } from './commands.ts';

/** An empty current HP shows as full; null when there's no max either. */
export function shownHp(current: number | null, max: number | null): number | null {
  return current ?? max;
}

/** What + leads to: one more, but never past max (and never lowering HP that's already over it). */
export function afterPlus(current: number, max: number | null): number {
  return max !== null && current >= max ? current : current + 1;
}

/** "11 of 14", "16 of 14 · over max", or just "7" with no max. */
export function hpLine(current: number, max: number | null): string {
  if (max === null) return String(current);
  return current > max ? `${current} of ${max}, over max` : `${current} of ${max}`;
}

/** A typed HP: any whole number, negatives too; null for anything else. */
export function readHpInput(text: string): number | null {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** The owner or the GM sets current HP on an approved character still in play. */
export const setHp = defineCommand({
  name: 'character.setHp',
  log: 'verbose',
  target: (input: { character: CharacterRef; hpCurrent: number }) => input.character,
  allowed: (user, character) =>
    character.approval === 'approved' &&
    !character.archived &&
    (isGm(user, character.campaignId) || isOwner(user, character)),
  fiat: gmRuling,
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    if (!Number.isInteger(input.hpCurrent)) return failed('HP must be a whole number.');
    const saved = fromWrite(
      await db.from('actors').update({ hp_current: input.hpCurrent }).eq('id', input.character.id).select('id, hp_current'),
    );
    return saved.ok ? ok(saved.value.hp_current ?? input.hpCurrent) : saved;
  },
});

// Hit points in place (ruled 2026-11-08, mockup players/04 alternative C): − and + beside the figure, each tap at
// once; taps within two seconds fold into one logged change with one Undo.

/** How long after the last tap a burst of − and + is sent as one change. */
export const HP_BURST_MS = 2000;

/** One tap of − (−1) or + (+1): − stops at 0 (and leaves a figure already below it), + stops at the most. */
export function stepHp(current: number, max: number | null, step: 1 | -1): number {
  if (step < 0) return current <= 0 ? current : current - 1;
  return max !== null && current >= max ? current : current + 1;
}

/**
 * The HP at which the rules set marks a character Down (`death.at`, 07), from the top rules set that says; null when
 * none does (then the app never calls 0 "Down").
 */
export function downAtOf(rulesSets: readonly Record<string, unknown>[]): number | null {
  for (const set of rulesSets) {
    const death = set.death;
    if (death && typeof death === 'object' && !Array.isArray(death)) {
      const at = (death as Record<string, unknown>).at;
      if (typeof at === 'number' && Number.isInteger(at)) return at;
    }
  }
  return null;
}

/** "5 of 8" (or "HP 5" with no most recorded). */
const figureLine = (now: number, max: number | null) => (max === null ? `HP ${now}` : `${now} of ${max}`);

/** The figure, then what a limit means: ": Down" (only when the rules say so), ", the lowest it goes", ", at the most". */
function figureWords(now: number, max: number | null, downAt: number | null): string {
  const line = figureLine(now, max);
  if (downAt !== null && now <= downAt) return `${line}: Down`;
  if (now <= 0) return `${line}, the lowest it goes`;
  if (max !== null && now >= max) return `${line}, at the most`;
  return line;
}

/**
 * A burst's toast: "Took 3 damage, 5 of 8", "Healed 3, 8 of 8, at the most", "Took 5 damage, 0 of 8: Down"; a tap
 * that changes nothing says why ("Wren is at the most already, 8 of 8"); taps that cancel out say "No change".
 */
export function burstWords(input: { name: string; start: number; now: number; max: number | null; downAt: number | null; step: 1 | -1 }): string {
  const { name, start, now, max, downAt, step } = input;
  if (now < start) return `Took ${start - now} damage, ${figureWords(now, max, downAt)}`;
  if (now > start) return `Healed ${now - start}, ${figureWords(now, max, downAt)}`;
  if (step > 0 && max !== null && now >= max) return `${name} is at the most already, ${figureLine(now, max)}`;
  if (step < 0 && now <= 0) return `${name} is at the lowest already, ${figureWords(now, max, downAt).replace(', the lowest it goes', '')}`;
  return `No change, ${figureLine(now, max)}`;
}
