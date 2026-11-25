// Rest as a shared flow (M5b step g6; ruled 2026-11-01, M5 gate B5; docs/05 "Rest"; docs/06 "Rest flow"; mockup
// docs/design/mockups/m5-gate/b5-rest-flow.html; supabase/migrations/20261102330000_m5b_g6_rest_flow.sql). One flow
// per group: the rest falls due when the group's countdown runs out (or a player calls one with the Rest button);
// each character answers Rest or Push on (or is still waiting); the GM's Next turn applies the answers in the same
// request as the clock's move (resting counts as rest; Push on and unanswered get the pack's condition, stacked),
// restarts the countdown and writes one log line. A character who pushed on keeps "Rest due · you pushed on" on their
// strip until they rest. The pure part (who is in which flow, the marker's words, what Next turn sends) and the two
// commands (answer, call) live here.
import { defineCommand, fromError, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import { mayChangeStatus, toCharacterRest, type CharacterRest, type Condition } from './statusPlay.ts';

/** What a character answered for the rest under way. */
export type RestAnswer = 'resting' | 'pushing' | 'waiting';

export const answerOf = (rest: CharacterRest | undefined): RestAnswer =>
  !rest ? 'waiting' : rest.chosenAt !== null ? 'resting' : rest.pushingAt !== null ? 'pushing' : 'waiting';

/** The words and symbol for an answer, as the GM's rows show it (B5: ☾ Resting · → Pushing on · … waiting). */
export const ANSWER_WORDS: Record<RestAnswer, { symbol: string; words: string }> = {
  resting: { symbol: '☾', words: 'Resting' },
  pushing: { symbol: '→', words: 'Pushing on' },
  waiting: { symbol: '…', words: 'waiting' },
};

/** A tap on the GM's row flips it: resting ↔ pushing on; waiting becomes resting. */
export const flipped = (answer: RestAnswer): 'rest' | 'push' => (answer === 'resting' ? 'push' : 'rest');

/** One group's rest flow now. */
export interface RestFlow {
  group: number;
  /** The characters and hirelings in play in this group. */
  members: string[];
  /** Where its countdown started: the expedition's start, or the last rest applied to it. */
  from: number;
  /** The countdown ran out: the rest is due this step (B8: due now, not next turn). */
  due: boolean;
  /** A rest called out of turn since the countdown started (the Rest button), and by which character. */
  called: { at: number; by: string | null } | null;
  /**
   * The group forced the march today and has made camp tonight: rest is due in camp's Sleep step (ruled 2026-11-03,
   * SC-4-3 A; the forced march no longer opens the flow at once). Undoing the march closes it again.
   */
  forced: boolean;
  /** Due, called or forced: answers are asked for, and the GM's Next turn applies them. */
  open: boolean;
  /** Steps until it falls due (0 when open). */
  stepsLeft: number;
  /** How many have answered (while open). */
  answered: number;
}

/** Every group's flow: `groups` in play (each with its members), the rest rows, and the mode's rule on the clock. */
export function restFlows(input: {
  groups: readonly { number: number; members: readonly string[] }[];
  rests: readonly CharacterRest[];
  startedAt: number;
  now: number;
  /** The rule's period, in seconds. */
  every: number;
  /** One step of the mode, in seconds. */
  step: number;
  /** The groups that forced the march today and are in camp tonight (camp's Sleep step: "Rest due (forced march)"). */
  forcedGroups?: ReadonlySet<number>;
}): RestFlow[] {
  const { rests, startedAt, now, every } = input;
  const step = input.step > 0 ? input.step : every;
  return input.groups.map(({ number, members }) => {
    const rows = members.map((id) => rests.find((r) => r.actorId === id));
    const from = Math.max(startedAt, ...rows.map((r) => r?.periodFrom ?? startedAt));
    const due = every > 0 && now - from >= every;
    const caller = rows.find((r) => r && r.calledAt !== null && r.calledAt >= from);
    const called = caller ? { at: caller.calledAt!, by: caller.calledBy } : null;
    const forced = input.forcedGroups?.has(number) ?? false;
    const open = due || called !== null || forced;
    const stepsLeft = open ? 0 : Math.max(1, Math.ceil((from + every - now) / step));
    const answered = open ? rows.filter((r) => answerOf(r) !== 'waiting').length : 0;
    return { group: number, members: [...members], from, due, called, forced, open, stepsLeft, answered };
  });
}

/**
 * The groups whose rest a forced march makes due tonight (D4, ruled 2026-11-03 SC-4-3 A): today's travel row counts a
 * forced march, and the group has a camp for that same day that Next day hasn't applied yet.
 */
export function forcedRestGroups(rows: Iterable<{ group: number; day: number; forced: number }>, camps: Iterable<{ group: number; day: number; appliedAt?: number | null }>): Set<number> {
  const open = [...camps].filter((c) => c.appliedAt === null || c.appliedAt === undefined);
  return new Set([...rows].filter((r) => r.forced > 0 && open.some((c) => c.group === r.group && c.day === r.day)).map((r) => r.group));
}

/**
 * The groups that forced the march today and come to Next day with no camp that evening (ruled B 2026-11-03, camp
 * follow-up ⚑): Next day applies their rest as unanswered (Push on: the pack's condition, stacked). `today` is the day
 * the move starts on and `toDay` the day it reaches (0 the first; `toDay` > `today` only when the move reaches a new
 * day). A stale row (a day already past) counts for nothing, so a second Next day never applies it again.
 */
export function forcedWithoutCamp(
  rows: Iterable<{ group: number; day: number; forced: number }>,
  camps: Iterable<{ group: number; day: number }>,
  today: number,
  toDay: number,
): Set<number> {
  if (today < 0 || toDay <= today) return new Set();
  const all = [...camps];
  return new Set([...rows].filter((r) => r.forced > 0 && r.day === today && !all.some((c) => c.group === r.group && c.day === r.day)).map((r) => r.group));
}

/** The flows with these groups' rest open too (Next day's forced rest without a camp, unanswered). */
export const withForcedOpen = (flows: readonly RestFlow[], groups: ReadonlySet<number>): RestFlow[] =>
  groups.size === 0 ? [...flows] : flows.map((f) => (groups.has(f.group) && !f.open ? { ...f, forced: true, open: true, stepsLeft: 0 } : f));

/** Whether a character pushed on during this expedition and hasn't rested since. */
export const pushedOn = (rest: CharacterRest | undefined, startedAt: number): boolean => !!rest && rest.pushedOnAt !== null && rest.pushedOnAt >= startedAt;

/** What the GM's Next turn sends: everyone in an open flow, and the pack's condition for those who didn't rest. */
export interface RestApply {
  actors: string[];
  condition: { name: string; conditionId: string | null; icon: string | null; stacks: boolean; levels: Condition['levels']; note: string | null } | null;
  /** When the next rest falls due (SC-g6-3, ruled B 2026-11-03): for the log line's "next rest due turn 20". */
  nextDue?: NextDue | null;
}

/** A due time on the clock and its step as the time strip counts it ("turn 20"). */
export interface NextDue {
  at: number;
  unit: string;
  number: number;
}

export function restToApply(flows: readonly RestFlow[], condition: Condition | null, nextDue: NextDue | null = null): RestApply | null {
  const actors = flows.filter((f) => f.open).flatMap((f) => f.members);
  if (actors.length === 0) return null;
  return {
    actors,
    condition: condition ? { name: condition.name, conditionId: condition.id, icon: condition.icon, stacks: condition.stacks, levels: condition.levels, note: condition.note } : null,
    nextDue,
  };
}

// Commands ---------------------------------------------------------------------------------------------------------

type Character = { id: string; campaignId: string; ownerUserId: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function restRows(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<CharacterRest[]>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  return ok((Array.isArray(data) ? data : []).filter(isRecord).map(toCharacterRest));
}

/** Who an answer is for: the campaign and the characters (each this person's to play). */
export interface RestAnswerTarget {
  campaignId: string;
  characters: Character[];
}

/**
 * Rest, Push on, or back to waiting, for the rest under way: a player for their own characters and hirelings; the GM
 * for anyone (a tap on a row flips it; Everyone rests / No one rests answer the whole list). Logged (Verbose): the
 * applied rest's one line is the record.
 */
export const answerRest = defineCommand({
  name: 'rest.answer',
  log: 'verbose',
  target: (input: { target: RestAnswerTarget; answer: 'rest' | 'push' | 'wait' }) => input.target,
  allowed: (user: CurrentUser, target: RestAnswerTarget) =>
    target.characters.length > 0 && target.characters.every((c) => c.campaignId === target.campaignId && mayChangeStatus(user, c)),
  run: (db, _user, input) => restRows(db.rpc('answer_rest', { actors: input.target.characters.map((c) => c.id), answer: input.answer })),
});

/**
 * The Rest button under the marching order (B18): calls a rest for the character's whole group, opening the flow
 * now (merged with a due one); the caller answers Rest. Logged (Simple); the applied line says who called it.
 */
export const callRest = defineCommand({
  name: 'rest.call',
  log: 'simple',
  target: (input: { character: Character }) => input.character,
  allowed: mayChangeStatus,
  run: (db, _user, input) => restRows(db.rpc('call_rest', { actor: input.character.id })),
});

/** The rest payload as the database takes it. */
export const restArg = (rest: RestApply): Json => rest as unknown as Json;

export const REST_COMMANDS = [answerRest, callRest] as const;
