// The reminder card (docs/05 "The reminder card", M5-5; docs/06 "The reminder card"): one card for everything that
// came due, in a fixed order (procedure steps, then lights, then rest, then the GM's reminders), 4 lines and then
// "N more". Repeats merge with counts: a line still on the card when it falls due again counts up. Decision lines
// keep their buttons (a check's Hit / Miss, a recharge's one-tap confirm); the rest have Done, and All done clears
// everything that needs no decision. A check line carries its chance with the modifiers counted, each modifier with
// its source, and what a hit rolls; the GM's "+ Modifier" adds a line by hand. Pure: the screen keeps the card.
import { addFaces, type CheckPrompt, type HitPlan, type ModifierLine } from './checks.ts';
import { toSeconds, type TimeUnits } from './clock.ts';
import type { Chance, Icon, Mode } from './modes.ts';
import type { Advance, Summary } from './procedure.ts';
import type { ScheduleInfo } from './reminders.ts';
import { nextAfter } from './schedule.ts';
import { facesWords } from './partyModifiers.ts';

export type CardGroup = 'procedure' | 'light' | 'rest' | 'gm';

export interface CheckLine {
  checkId: string;
  /** Where the check comes from: the mode, a location (M8b), or one of the GM's own reminders. */
  source: 'mode' | 'location' | 'gm';
  chance: Chance | null;
  /** No chance at all: the table is always rolled. */
  always: boolean;
  /** A modifier rules the roll out (a road, say). */
  ruledOut: boolean;
  modifiers: ModifierLine[];
  hit: HitPlan;
  /** An encounter check (the mode's wandering check, or a GM reminder marked so). */
  encounter: boolean;
  /** A lost check (it uses the terrain's lostChance, or runs from a "lost" step): its hit isn't an encounter. */
  lost?: boolean;
  /** checks[].secret (the GM's own checks are secret): players see the result only at Downtime. */
  secret: boolean;
  /**
   * The check already ran this period (05, Once per period; ruled 2026-10-29): this is the optional "Check again",
   * and its result is logged as checking again (Verbose).
   */
  again: boolean;
  /** Check now (DG3): an ad-hoc check, logged as checking now; the regular schedule carries on. */
  now?: boolean;
}

export interface CardLine {
  key: string;
  group: CardGroup;
  /**
   * check: Hit / Miss · again: "Checked today · Check again" (one optional tap makes it a check) · recharge: one tap
   * to confirm · roll: a roll to read from a table · rest: Rested / Push on (DG5) · done: Done · info: nothing to do.
   */
  decision: 'check' | 'again' | 'recharge' | 'roll' | 'rest' | 'done' | 'info';
  name: string;
  icon: Icon;
  count: number;
  /** The procedure step it belongs to (the strip lights it), if any. */
  stepId: string | null;
  note: string | null;
  check: CheckLine | null;
  /** A roll line's table. */
  tableId: string | null;
  /** A weather line with no table yet (no season known): the tables the GM picks from (ruled 2026-10-30). */
  tableChoices?: string[];
  recharge: { lineId: string; amount: string } | null;
  /** When it falls due next, on the clock ("next at turn 16"); null when it doesn't repeat on its own. */
  nextAt: number | null;
}

const ORDER: CardGroup[] = ['procedure', 'light', 'rest', 'gm'];

const noHit = (tableId: string | null, note: string | null): HitPlan => ({
  tables: tableId ? [tableId] : [],
  tableFrom: tableId ? 'check' : null,
  pick: false,
  column: null,
  columns: [],
  regionTable: null,
  regionTables: false,
  swap: null,
  noteOnly: !tableId,
  candidates: tableId ? [{ tableId, why: 'check', season: null }] : [],
  note,
});

/** What an advance (or several summed up) puts on the card. */
export function cardFrom(
  advance: Pick<Advance | Summary, 'prompts' | 'rest' | 'reminders' | 'to'> & { lights?: Advance['lights'] },
  ctx: { info?: ReadonlyMap<string, ScheduleInfo>; mode?: Mode | null; units?: TimeUnits; startedAt?: number; skippedHooks?: readonly string[] } = {},
): CardLine[] {
  const lines: CardLine[] = [];
  const base = { note: null, check: null, tableId: null, recharge: null, nextAt: null, stepId: null };
  // A check's line: Hit / Miss; or, when it already ran this period, the optional "Check again" (its own key, so it
  // never counts up the first run's line).
  const checkLine = (p: CheckPrompt & { count: number; again: boolean }, source: 'mode' | 'location', stepId: string | null): CardLine => {
    const check = ctx.mode?.checks.find((c) => c.id === p.checkId);
    const per = ctx.mode && ctx.units ? toSeconds(ctx.mode.step, ctx.units) : null;
    const interval = check?.every && ctx.units ? toSeconds(check.every, ctx.units) : per;
    return {
      ...base,
      key: p.again ? `again:${source}:${p.checkId}:${stepId ?? ''}` : `check:${source}:${p.checkId}`,
      group: 'procedure',
      decision: p.again ? 'again' : p.ruledOut ? 'done' : 'check',
      name: p.name,
      icon: p.icon,
      count: p.count,
      stepId,
      note: p.note,
      check: {
        checkId: p.checkId,
        source,
        chance: p.chance,
        always: p.always,
        ruledOut: p.ruledOut,
        modifiers: p.modifiers,
        hit: p.hit,
        encounter: p.icon === 'encounter' || p.icon === 'monster' || p.hit.tables.length > 0 || p.hit.regionTables,
        // A lost check (05: never an encounter check): its hit queues no Encounter waiting card (M5b step 2).
        lost: p.terrainChance ? p.terrainChance === 'lostChance' : p.icon === 'lost',
        secret: p.secret,
        again: p.again,
      },
      nextAt: !p.again && interval && ctx.startedAt !== undefined ? nextAfter(ctx.startedAt, interval, advance.to) : null,
    };
  };
  for (const p of advance.prompts) {
    if (p.kind === 'check') {
      lines.push(checkLine(p, p.source, p.stepId));
    } else if (p.kind === 'roll') {
      lines.push({ ...base, key: `roll:${p.stepId}`, group: 'procedure', decision: 'roll', name: p.name, icon: p.icon, count: p.count, stepId: p.stepId, note: p.note, tableId: p.tableId });
    } else if (p.kind === 'weather') {
      // No season known (Not now on "Which season?", ruled 2026-10-30): the GM picks one of the weather tables.
      const pick = p.tableChoices.length > 0 ? { tableChoices: p.tableChoices, note: 'No season yet: pick the weather table.' } : {};
      lines.push({ ...base, key: `weather:${p.stepId ?? ''}`, group: 'procedure', decision: 'roll', name: 'Weather', icon: 'weather', count: p.count, stepId: p.stepId, tableId: p.tableId, ...pick });
    } else if (p.kind === 'camp' || p.kind === 'watches') {
      lines.push({ ...base, key: `${p.kind}:${p.stepId}`, group: 'procedure', decision: 'done', name: p.name, icon: p.icon, count: p.count, stepId: p.stepId, note: p.note });
      // The camp's own checks: a check the day already ran is the optional "Check again" (05, Once per period).
      if (p.kind === 'camp') for (const c of p.checks) lines.push(checkLine(c, 'mode', p.stepId));
    }
  }
  // Lights (M5-8, M5 step 7): one information line when a light starts to run low, and one when it burns out (the
  // database burns it out with the clock; the carrier's device offers "Light another"). A light that ran low and
  // burnt out in the same advance (+N) shows only its burnout.
  const burnt = new Set((advance.lights ?? []).filter((l) => l.outAt !== null).map((l) => l.id));
  for (const l of advance.lights ?? []) {
    if (l.outAt === null && burnt.has(l.id)) continue;
    if (l.outAt !== null) lines.push({ ...base, key: `light-out:${l.id}`, group: 'light', decision: 'info', name: `${l.name} burnt out`, icon: 'light', count: 1 });
    else if (l.warned) lines.push({ ...base, key: `light-low:${l.id}`, group: 'light', decision: 'info', name: `${l.name} is running low`, icon: 'light', count: 1 });
  }
  // Rest due is no longer a card line (M5b g6, B5): the shared rest flow's panel and the strip's marker carry it.
  for (const due of advance.reminders) {
    const info = ctx.info?.get(due.id);
    if (info?.source === 'recharge' && info.lineId && info.amount) {
      lines.push({ ...base, key: due.id, group: due.group, decision: 'recharge', name: due.name, icon: 'star', count: due.count, recharge: { lineId: info.lineId, amount: info.amount }, nextAt: due.nextAt });
    } else if (due.kind === 'check') {
      lines.push({
        ...base,
        key: due.id,
        group: due.group,
        decision: 'check',
        name: due.name,
        icon: 'encounter',
        count: due.count,
        note: info?.note ?? null,
        check: { checkId: due.id, source: 'gm', chance: info?.chance ?? null, always: false, ruledOut: false, modifiers: [], hit: noHit(info?.tableId ?? null, null), encounter: true, secret: true, again: false },
        nextAt: due.nextAt,
      });
    } else {
      lines.push({ ...base, key: due.id, group: due.group, decision: 'done', name: due.name, icon: 'note', count: due.count, note: info?.note ?? null, nextAt: due.nextAt });
    }
  }
  for (const id of ctx.skippedHooks ?? []) {
    lines.push({ ...base, key: `skipped:${id}`, group: 'gm', decision: 'info', name: `A rule couldn't be checked: ${id}`, icon: 'note', count: 1 });
  }
  return lines;
}

/**
 * Check now's lines (ruled 2026-10-30, DG3): the checks the engine's checkNow gives, as Hit / Miss lines with their
 * own keys ("now:…", so they never count up the schedule's lines) and no "next at" (nothing is scheduled), named
 * "<check> · now". A split party gets one per group (perGroup, as for the schedule's).
 */
export function checkNowLines(
  found: Pick<Advance, 'prompts' | 'reminders' | 'rest' | 'to'>,
  ctx: Parameters<typeof cardFrom>[1] = {},
): CardLine[] {
  return cardFrom(found, ctx)
    .filter((l) => l.check)
    .map((l) => ({ ...l, key: `now:${l.key}`, name: `${l.name}, now`, nextAt: null, check: { ...l.check!, now: true, again: false } }));
}

/**
 * The checks a Move… sets off (alsoWhen, ruled 2026-10-30, D9; M5b step 1 follow-up, build order 8), as the card's
 * Hit / Miss lines: worked out for where the group goes (eventChecks.triggeredPrompts), each with its own key
 * ("move:…", per group after a split) so it never counts up the schedule's line, named "<check> · <why>" (and
 * "· Group N" after a split), logged as checking now (an ad-hoc check; the schedule carries on).
 */
export function moveCheckLines(prompts: readonly (CheckPrompt & { reason: string })[], group: number | null): CardLine[] {
  const lines = cardFrom({ prompts: prompts.map((p) => ({ ...p, kind: 'check' as const, stepId: null, source: 'mode' as const, count: 1, again: false })), rest: null, reminders: [], to: 0 });
  return lines.flatMap((line) => {
    const prompt = prompts.find((p) => p.checkId === line.check?.checkId);
    if (!line.check || !prompt) return [];
    const where = group === null ? '' : `, Group ${group}`;
    return [{ ...line, key: `move:${line.check.checkId}${group === null ? '' : `@group${group}`}`, name: `${line.name}, ${prompt.reason}${where}`, nextAt: null, check: { ...line.check, now: true, again: false } }];
  });
}

/**
 * A split party (ruled 2026-10-30, DG14): each group gets its own wandering checks on the same schedule. With more
 * than one group, every encounter check line becomes one line per group ("Wandering check · Group 2", its own key, so
 * each is recorded and merged on its own); everything else stays one line. With one group, nothing changes.
 */
/**
 * The group a camp check's encounter belongs to, from its name ("Wandering things, Group 2, now"; a name saved
 * before the sweep reads "Wandering things · Group 2 · now"): 1 without a group. Pure.
 */
export function groupOfCheckName(name: string): number {
  return Number(/Group (\d+)(?:(?: ·|,) now)?$/.exec(name)?.[1] ?? 1);
}

export function perGroup(lines: readonly CardLine[], groups: readonly number[]): CardLine[] {
  if (groups.length < 2) return [...lines];
  return lines.flatMap((line) =>
    line.check?.encounter && (line.decision === 'check' || line.decision === 'again')
      ? groups.map((n) => ({ ...line, key: `${line.key}@group${n}`, name: `${line.name}, Group ${n}` }))
      : [line],
  );
}

/** Fresh lines join the card: a line already there counts up (its modifiers by hand stay); a new one is added. */
export function mergeCard(card: readonly CardLine[], fresh: readonly CardLine[]): CardLine[] {
  const merged = card.map((l) => ({ ...l }));
  for (const f of fresh) {
    const there = merged.find((l) => l.key === f.key);
    if (there) {
      there.count += f.count;
      there.nextAt = f.nextAt;
    } else merged.push({ ...f });
  }
  return orderCard(merged);
}

/**
 * Check now's lines join the card (M5 gate fix): a line already on the card stays as it is (never ×2); only the
 * lines not there yet are added. `added` names the keys added, so Undo can take exactly those off again.
 */
export function addCheckNow(card: readonly CardLine[], fresh: readonly CardLine[]): { card: CardLine[]; added: string[] } {
  const added = fresh.filter((f) => !card.some((l) => l.key === f.key)).map((f) => f.key);
  return { card: mergeCard(card, fresh.filter((f) => added.includes(f.key))), added };
}

/** The lines with these keys leave the card (Check now's Undo). */
export function withoutLines(card: readonly CardLine[], keys: readonly string[]): CardLine[] {
  return card.filter((l) => !keys.includes(l.key));
}

/** Procedure steps, then lights, then rest, then the GM's reminders (each group keeps its own order). */
export function orderCard(card: readonly CardLine[]): CardLine[] {
  return [...card].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
}

/** The lines shown (4 by default) and how many more there are. */
export function cardView(card: readonly CardLine[], shown = 4): { lines: CardLine[]; more: number } {
  const ordered = orderCard(card);
  return { lines: ordered.slice(0, shown), more: Math.max(0, ordered.length - shown) };
}

/** One of a line's count dealt with (Hit, Miss, Done, a recharge confirmed): the count drops; at 0 the line goes. */
export function takeOne(card: readonly CardLine[], key: string): CardLine[] {
  return card.flatMap((l) => (l.key !== key ? [l] : l.count > 1 ? [{ ...l, count: l.count - 1 }] : []));
}

/**
 * What a check already run this period says (ruled 2026-10-30: the words follow the mode's step): "Checked this
 * turn" in turn modes, "Checked today" in day modes.
 */
export function checkedWords(pace: 'turn' | 'day'): string {
  return pace === 'day' ? 'Checked today' : 'Checked this turn';
}

/** "Check again" tapped: the optional line becomes a check with Hit / Miss (its result is logged as checking again). */
export function checkAgain(card: readonly CardLine[], key: string): CardLine[] {
  return card.map((l) => (l.key === key && l.decision === 'again' ? { ...l, decision: 'check' as const } : l));
}

/** All done: clears what needs no decision (an unused "Check again" too); checks and recharges stay for the GM. */
export function allDone(card: readonly CardLine[]): CardLine[] {
  return card.filter((l) => l.decision === 'check' || l.decision === 'recharge');
}

/** "+ Modifier" (GM only, with a note): the faces it adds or takes away, counted into the chance, listed by hand. */
export function addHandModifier(line: CardLine, label: string, add: number): CardLine {
  if (!line.check || !Number.isInteger(add) || add === 0) return line;
  const chance = line.check.chance ? addFaces(line.check.chance, add) : null;
  const modifier: ModifierLine = { source: 'hand', kind: 'hand', label: label.trim(), add, replaces: null, never: false, public: false, note: null };
  return { ...line, check: { ...line.check, chance, modifiers: [...line.check.modifiers, modifier] } };
}

/** A modifier line in words, value then source ("+1 · Hunter (class)"; docs/06 words guide). */
export function modifierWords(m: ModifierLine): string {
  // Keyed to the party (ex-2, ga-3): "Only on 1 · a Reed Witch in the party", "+1 for Ash · a Mire Stalker".
  if (m.kind === 'trait') {
    const who = m.actor ? ` for ${m.actor.name}` : '';
    if (m.replaces) return `Only on ${facesWords(m.replaces.on)}${who}, ${m.label}`;
    return `${m.add !== null && m.add < 0 ? '−' : '+'}${Math.abs(m.add ?? 0)}${who}, ${m.label}`;
  }
  const from = m.source === 'hand' ? 'by hand' : m.source === 'party' ? 'party' : m.kind === 'terrain' ? 'terrain' : m.kind === 'weatherTag' ? 'weather' : m.kind === 'routeType' ? 'route' : m.kind === 'track' ? 'track' : 'rules';
  if (m.never) return `Not this time, ${m.label} (${from})`;
  if (m.add !== null) return m.label ? `${m.add > 0 ? '+' : '−'}${Math.abs(m.add)}, ${m.label} (${from})` : `${m.add > 0 ? '+' : '−'}${Math.abs(m.add)}, ${from}`;
  return `${m.label} (${from})`;
}
