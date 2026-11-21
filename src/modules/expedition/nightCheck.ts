// The night check comes before the camp is applied (M5b gate, SC-5-1; ruled B by Francis, 2026-11-03). When a move
// (Next day, or Advance by… into a new day) would apply the evening's camps, it first stops at the camp's night
// check: only those check lines go on the card and the clock doesn't move, so a hit finds the camp still open and its
// Encounter waiting card asks Which watch?. The GM's next Next day moves on: the clock, the camps and the morning in
// one request (one Undo, as before), without the night check again. The night counts as answered once its check is
// recorded at this time on the clock (any GM device, after a reload too), or once this device stopped for it (the GM
// moved on without answering). Pure: the time strip keeps what was asked and reads the results.
import type { CardLine } from './card.ts';

/** The night already asked on this device: the move it held back (where it starts) and the camps it would apply. */
export interface NightAsked {
  from: number;
  camps: string[];
}

/** Whether a card line is one of the camp's night checks (the camp's night step names the check). */
export function isNightLine(line: CardLine, nightChecks: ReadonlySet<string>): boolean {
  return !!line.check && nightChecks.has(line.check.checkId);
}

/**
 * The keys of the checks that answer tonight's night check, from those recorded where the move starts on the clock.
 * One recorded with the GM's Encounter check (a "now:" key) counts only when it was recorded after its group's camp
 * was made: in a day mode the clock doesn't move between midday and camp, so a midday Encounter check isn't the
 * night's (#619 review). A split party's key ends "@group<N>" (perGroup); without it, every camp counts.
 */
export function nightAnswers(recorded: readonly { checkKey: string; createdAt?: string }[], camps: readonly { group: number; createdAt?: string }[]): Set<string> {
  const madeAt = (group: number | null) => {
    const times = camps.filter((c) => group === null || c.group === group).map((c) => Date.parse(c.createdAt ?? ''));
    return times.length > 0 ? Math.max(...times) : Number.NaN;
  };
  const counts = (r: { checkKey: string; createdAt?: string }) => {
    if (!r.checkKey.startsWith('now:')) return true;
    const group = /@group(\d+)$/.exec(r.checkKey)?.[1];
    return Date.parse(r.createdAt ?? '') > madeAt(group ? Number(group) : null);
  };
  return new Set(recorded.filter(counts).map((r) => r.checkKey));
}

const sameCamps =(a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * What a move does about the night: `stop` puts these night check lines on the card and moves nothing (and `asked`
 * is what to remember); `move` goes ahead with these lines (the night check left out once it was asked or answered).
 */
export function nightPlan(input: {
  /** The move's card lines (after the split into groups, so each group's line has its own key). */
  lines: readonly CardLine[];
  nightChecks: ReadonlySet<string>;
  /** The camps this move would apply. */
  camps: readonly string[];
  /** Where the move starts on the clock. */
  from: number;
  asked: NightAsked | null;
  /**
   * The keys of the checks that answer the night (`nightAnswers`): those recorded at `from` on this expedition (Hit or
   * Miss, not undone), a "now:" one only after the camp was made.
   */
  answered?: ReadonlySet<string>;
}): { stop: CardLine[]; asked: NightAsked } | { move: CardLine[] } {
  const { lines, nightChecks, camps, from, asked, answered = new Set<string>() } = input;
  if (camps.length === 0) return { move: [...lines] };
  const night = lines.filter((l) => isNightLine(l, nightChecks));
  // The GM's Encounter check (⋯) records its line with a "now:" prefix (card.ts); once after the camp was made
  // (nightAnswers), it answers the night just the same.
  const done = new Set([...answered].map((key) => key.replace(/^now:/, '')));
  const open = night.filter((l) => !done.has(l.key));
  const withoutNight = () => lines.filter((l) => !isNightLine(l, nightChecks));
  if (night.length === 0) return { move: [...lines] };
  if (open.length === 0 || (asked && asked.from === from && sameCamps(asked.camps, camps))) return { move: withoutNight() };
  return { stop: open, asked: { from, camps: [...camps] } };
}
