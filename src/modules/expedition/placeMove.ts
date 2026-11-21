// Move on (December step 4, piece c; docs/plans/dec-4-point-travel.md; ruled 2026-11-11, pt-f2 and pt-f3;
// supabase/migrations/20261111150000_dec_4c_move_between_places.sql): the party goes to a linked place and the clock
// moves on by the way's turns, in ONE request: one log line (place.moveOn, Simple) and one Undo, which puts back the
// place, the clock, the lights and whatever the clock's move ended or used up. The clock's side of it is Advance
// by…'s own (lights burn down, status timers end, the open rest flows' answers apply when sent). The GM only; the
// party's own group (no split party in this cut). The app sends what the GM picked (the place, the way's `by` and
// `name`, its turns); the database reads no route. No screen here: the Move on sheet (piece b) calls this.
import { defineCommand, failed, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { toClock, type Clock } from './play.ts';

/** The way of moving the GM picked on a link (07 `routes`, `travel`): its short id and its words. */
export interface WayTaken {
  by: string;
  name: string;
}

/** What the GM picked on the Move on sheet. */
export interface MoveOnInput {
  campaignId: string;
  /** The campaign's place the link leads to (made first with place.fromPack when the campaign doesn't have it yet). */
  placeId: string;
  /** How many turns the way takes, and the same in this campaign's seconds (as Advance by… sends them). */
  turns: number;
  seconds: number;
  /** The copy of the clock this device has: a move from an older one is refused, and nothing moves. */
  clock: Clock;
  /** Null: a link with one amount and no named way. */
  way?: WayTaken | null;
  /** As Advance by…: the open rest flows' answers to apply with the move. */
  rest?: Json | null;
}

/** Move on's answer: the new visit's row id, how many pieces came back shown (0: a first visit), and the clock. */
export interface MovedOn {
  id: string;
  backShown: number;
  clock: Clock;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/**
 * Move on (place.moveOn): the party goes to the place and the clock moves on by the way's turns, as one logged step
 * with one Undo. A place visited before starts with what was shown at the end of its last visit, in the same step.
 */
export const moveOn = defineCommand({
  name: 'place.moveOn',
  log: 'simple',
  target: (input: MoveOnInput) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<MovedOn>> => {
    if (!Number.isInteger(input.turns) || input.turns < 1 || !Number.isInteger(input.seconds) || input.seconds < 1) {
      return failed('A move takes a whole number of turns, 1 or more.');
    }
    const by = input.way?.by.trim() ?? '';
    const name = input.way?.name.trim() ?? '';
    const { data, error } = await db.rpc('move_between_places', {
      campaign: input.campaignId,
      place: input.placeId,
      turns: input.turns,
      by_seconds: input.seconds,
      seen_version: input.clock.version,
      ...(by ? { way_by: by } : {}),
      ...(name ? { way_name: name } : {}),
      ...(input.rest ? { rest: input.rest } : {}),
    });
    if (error) return fromError(error);
    const made = isRecord(data) ? data : null;
    const visit = made && isRecord(made.visit) ? made.visit : null;
    const clock = made && isRecord(made.clock) ? made.clock : null;
    if (!visit || !clock) return fromError({ code: '42501', message: '' });
    return ok({ id: String(visit.id ?? ''), backShown: typeof made!.back_shown === 'number' ? made!.back_shown : 0, clock: toClock(clock) });
  },
});

/** Registered by the expedition module (index.ts), beside PLACE_COMMANDS. */
export const PLACE_MOVE_COMMANDS = [moveOn] as const;
