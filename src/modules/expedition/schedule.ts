// What falls due when the clock moves (docs/05 "Expeditions, time and light", "Exploration modes"; 07 remind hooks;
// ruled 2026-10-24, M5-5, S17): every reminder and check fires once per clock jump, with a count ("Encounter check
// ×3"), never three times. A location's own check stands in for the GM's encounter-check reminders while the party
// is there; on leaving, they start again from now, with no backlog. Everything due shares one card. Pure.

export interface Schedule {
  id: string;
  name: string;
  /** reminder: Done; check: Hit / Miss; an encounter check is a check the GM marked so. */
  kind: 'reminder' | 'check';
  encounterCheck?: boolean;
  /** When it was set going, on the campaign clock (seconds), and how often it falls due. */
  anchor: number;
  interval: number;
  /** Where it sits on the reminder card: procedure steps, then lights, then rest, then the GM's own. */
  group?: 'procedure' | 'light' | 'rest' | 'gm';
  /** Players may see it (a public GM reminder); the hour track shows them only these. */
  public?: boolean;
}

export interface Due {
  id: string;
  name: string;
  kind: Schedule['kind'];
  group: NonNullable<Schedule['group']>;
  /** How many times it fell due in the jump. */
  count: number;
  /** When it next falls due after the jump. */
  nextAt: number;
}

/** How many times something set going at `anchor`, every `interval`, falls due after `from` up to and including `to`. */
export function occurrences(anchor: number, interval: number, from: number, to: number): number {
  if (interval <= 0 || to <= from) return 0;
  const upTo = (t: number) => (t < anchor ? 0 : Math.floor((t - anchor) / interval));
  return upTo(to) - upTo(from);
}

/** When it next falls due after `t`. */
export function nextAfter(anchor: number, interval: number, t: number): number {
  if (t < anchor) return anchor + interval;
  return anchor + (Math.floor((t - anchor) / interval) + 1) * interval;
}

/** What falls due in a jump from `from` to `to`, each once with its count, in the order given (procedure order). */
export function dueOnJump(schedules: readonly Schedule[], from: number, to: number): Due[] {
  return schedules.flatMap((s) => {
    const count = occurrences(s.anchor, s.interval, from, to);
    return count > 0 ? [{ id: s.id, name: s.name, kind: s.kind, group: s.group ?? 'gm', count, nextAt: nextAfter(s.anchor, s.interval, to) }] : [];
  });
}

/** Repeats merge: a reminder still on the card when it falls due again counts up rather than appearing twice. */
export function mergeDue(onCard: readonly Due[], fresh: readonly Due[]): Due[] {
  const merged = onCard.map((d) => ({ ...d }));
  for (const f of fresh) {
    const there = merged.find((d) => d.id === f.id);
    if (there) {
      there.count += f.count;
      there.nextAt = f.nextAt;
    } else merged.push({ ...f });
  }
  return merged;
}

const ORDER: Due['group'][] = ['procedure', 'light', 'rest', 'gm'];

/**
 * The reminder card (M5-5): procedure steps, then lights, then rest, then the GM's reminders; 4 lines, then
 * "N more". Checks keep their buttons (a decision); `information` lines need none and go to the log on the next
 * Next or when the card closes.
 */
export function reminderCard(due: readonly Due[], information: readonly string[] = [], shown = 4): { lines: (Due | { info: string })[]; more: number } {
  const ordered = [...due].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
  const all: (Due | { info: string })[] = [...ordered, ...information.map((info) => ({ info }))];
  return { lines: all.slice(0, shown), more: Math.max(0, all.length - shown) };
}

/** "All done" clears what needs no decision: reminders (Done) and information; checks stay for Hit or Miss. */
export function allDone(due: readonly Due[]): Due[] {
  return due.filter((d) => d.kind === 'check');
}

/**
 * Which schedules run while the party is somewhere (ruled 2026-10-24): a location with its own check suspends the
 * GM's encounter-check reminders, unless the GM chose "Use my check here instead". Other reminders keep running.
 */
export function activeSchedules(schedules: readonly Schedule[], here: { check: Schedule | null; useMineHere: boolean }): { active: Schedule[]; suspended: string[]; source: 'adventure' | 'yours' } {
  if (!here.check || here.useMineHere) return { active: [...schedules], suspended: [], source: 'yours' };
  const suspended = schedules.filter((s) => s.encounterCheck).map((s) => s.id);
  return { active: [...schedules.filter((s) => !s.encounterCheck), here.check], suspended, source: 'adventure' };
}

/** Leaving the location: the GM's encounter-check reminders start again from now, with no catch-up backlog. */
export function resumeFrom(schedules: readonly Schedule[], ids: readonly string[], now: number): Schedule[] {
  return schedules.map((s) => (ids.includes(s.id) ? { ...s, anchor: now } : s));
}
