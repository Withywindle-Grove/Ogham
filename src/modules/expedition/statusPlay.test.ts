// Statuses and rest, the pure parts (M5 step 9; docs/05 "Status symbols", "Rest"; ruled 2026-10-29 D27, 2026-10-30
// DG5, WA3). Invented conditions and modes.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { readMode } from './modes.ts';
import {
  conditionRows,
  conditionsOf,
  customCondition,
  durationChoices,
  readCondition,
  restNow,
  restRuleWords,
  searchConditions,
  shownName,
  statusEffect,
  statusEffects,
  statusLabel,
  statusTime,
  timerSeconds,
  timerUnits,
  toCharacterStatus,
  type StatusSecret,
} from './statusPlay.ts';

const units = timeUnits({ roundSeconds: 10, turnMinutes: 10, dayHours: 24 });
const TURN = 600;

const status = (row: Record<string, unknown>) =>
  toCharacterStatus({ id: 's1', campaign_id: 'c', actor_id: 'wren', name: 'Glowing', stacks: 1, started_at: 0, version: 1, ...row });

describe('conditions from the setting rules', () => {
  it('reads a condition leniently: its name, symbol, stacks, levels, default rounds and rules text', () => {
    const read = readCondition('dazed', { name: 'Dazed', icon: 'star', levels: [{ id: 'dazed', name: 'Dazed' }, { name: 'Reeling' }, { id: 'x' }], defaultRounds: 2, notes: 'Wobbly.' });
    expect(read).toEqual({ id: 'dazed', name: 'Dazed', icon: 'star', stacks: false, levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'Reeling', name: 'Reeling' }], defaultRounds: 2, note: 'Wobbly.', family: null, tone: null });
    expect(readCondition('nameless', {})).toBeNull();
  });

  // R3-6 (2026-11-08): a condition's `tone` gives its Status ring's colour; anything but the four is read as none (ink).
  it("reads a condition's tone: light, harm, boon or neutral, and none for anything else", () => {
    for (const tone of ['light', 'harm', 'boon', 'neutral']) expect(readCondition('x', { name: 'X', tone })?.tone).toBe(tone);
    for (const tone of ['spooky', 'Harm', 3, null]) expect(readCondition('x', { name: 'X', tone })?.tone).toBeNull();
  });

  it('lists conditions by name and finds them by any words typed, in any case', () => {
    const all = conditionsOf([
      { kind: 'condition', packEntryId: 'weary', data: { name: 'Weary' } },
      { kind: 'item', packEntryId: 'rope', data: { name: 'Rope' } },
      { kind: 'condition', packEntryId: 'bog-sick', data: { name: 'Bog sickness' } },
    ]);
    expect(all.map((c) => c.id)).toEqual(['bog-sick', 'weary']);
    expect(searchConditions(all, 'SICK bog').map((c) => c.id)).toEqual(['bog-sick']);
    expect(searchConditions(all, '  ')).toHaveLength(2);
  });
});

// M5 gate B6 (ruled 2026-11-01; 07 conditions[].family, G-46). Invented kinds.
describe('the + Status pop-up (B6)', () => {
  const pack = (rows: [string, Record<string, unknown>][]) => conditionsOf(rows.map(([id, data]) => ({ kind: 'condition', packEntryId: id, data })));

  it('a pack with `family` groups its kinds behind one row; a pack without shows a flat list; the app never shows a kind the pack doesn\'t carry', () => {
    const withFamilies = pack([
      ['fen-bite', { name: 'Fen bite', family: 'Bog rot', notes: 'Itches until dawn.' }],
      ['reed-cut', { name: 'Reed cut', family: 'Bog rot', notes: 'Bleeds a little.' }],
      ['weary', { name: 'Weary', stacks: true }],
    ]);
    const rows = conditionRows(withFamilies);
    expect(rows.map((r) => (r.kind === 'family' ? `${r.name}: ${r.kinds.map((k) => k.id).join(', ')}` : r.condition.id))).toEqual(['Bog rot: fen-bite, reed-cut', 'weary']);
    // The kinds are exactly the pack's: nothing added, nothing invented.
    const kinds = rows.flatMap((r) => (r.kind === 'family' ? r.kinds : [r.condition])).map((c) => c.id).sort();
    expect(kinds).toEqual(['fen-bite', 'reed-cut', 'weary']);

    const flat = pack([
      ['fen-bite', { name: 'Fen bite' }],
      ['weary', { name: 'Weary' }],
    ]);
    expect(conditionRows(flat).every((r) => r.kind === 'condition')).toBe(true);
    expect(conditionRows(flat)).toHaveLength(2);
    expect(conditionRows([])).toEqual([]);
  });

  it('a family of one is a plain row; families match by name in any case; typing searches the kinds flat, by name or family', () => {
    const all = pack([
      ['fen-bite', { name: 'Fen bite', family: 'Bog rot' }],
      ['reed-cut', { name: 'Reed cut', family: 'bog rot' }],
      ['lantern-glow', { name: 'Lantern glow', family: 'Lights' }],
    ]);
    const rows = conditionRows(all);
    expect(rows.map((r) => r.kind)).toEqual(['family', 'condition']);
    expect(conditionRows(all, 'rot').map((r) => (r.kind === 'condition' ? r.condition.id : r.name))).toEqual(['fen-bite', 'reed-cut']);
    expect(conditionRows(all, 'reed').map((r) => (r.kind === 'condition' ? r.condition.id : r.name))).toEqual(['reed-cut']);
  });

  it("a status's brief effect is its condition's notes, else its own note (a custom status's What it does)", () => {
    const all = pack([['weary', { name: 'Weary', notes: 'Slow and sore.' }]]);
    expect(statusEffect({ conditionId: 'weary', note: null }, all)).toBe('Slow and sore.');
    expect(statusEffect({ conditionId: null, note: 'Muddy to the knee.' }, all)).toBe('Muddy to the knee.');
    expect(statusEffect({ conditionId: 'gone', note: null }, all)).toBeNull();
  });

  it('the durations sit on one row: 1 turn and 1 hour when the campaign has them, Until rest, Until removed, Other…', () => {
    expect(durationChoices(units).map((d) => d.label)).toEqual(['1 turn', '1 hour', 'Until rest', 'Until removed', 'Other…']);
    expect(durationChoices({ minute: 60, hour: 3600, day: 86400 }).map((d) => d.label)).toEqual(['1 hour', 'Until rest', 'Until removed', 'Other…']);
    expect(durationChoices(units).some((d) => d.label === 'None')).toBe(false);
  });

  it('a custom status becomes a homebrew condition: a unique id, its name, what it does and Stacks', () => {
    expect(customCondition([{ id: 'soaked' }], ' Soaked ', 'Can\'t light a fire.', true)).toEqual({ id: 'soaked-2', name: 'Soaked', notes: "Can't light a fire.", stacks: true });
    expect(customCondition([], 'Moss-grown!', '', false)).toEqual({ id: 'moss-grown', name: 'Moss-grown!' });
    expect(customCondition([], '***', '', false).id).toBe('custom');
  });

  it('a status given until rest says it ends when they rest', () => {
    expect(statusTime(status({ until_rest: true }), new Map(), 0, units, 'player').ends).toBe('Ends when they rest.');
  });
});

describe('what a status shows', () => {
  it('a status with levels shows the level it is at', () => {
    expect(shownName(status({ levels: [{ id: 'a', name: 'Dazed' }, { id: 'b', name: 'Reeling' }], level: 1 }))).toBe('Reeling');
    expect(shownName(status({}))).toBe('Glowing');
  });

  it('a timer reads in its own unit, and its ring drains; the screen reader hears name, stacks and time', () => {
    const s = status({ ends_at: 4 * TURN, total_seconds: 4 * TURN, unit: 'turn', stacks: 2 });
    const time = statusTime(s, new Map(), TURN, units, 'player');
    expect(time).toMatchObject({ words: '3 turns left', ends: 'Ends in 3 turns.' });
    expect(time.shown?.fillPercent).toBe(75);
    expect(statusLabel(s, time)).toBe('Glowing, 2 stacks, 3 turns left');
  });

  it("a secret timer: a player sees it active and nothing more; the GM's device reads its time from the secret", () => {
    const s = status({ secret: true });
    const forPlayer = statusTime(s, new Map(), 0, units, 'player');
    expect(forPlayer).toMatchObject({ words: "Time left is the GM's", shown: { hiddenFromViewer: true, fillPercent: null } });
    expect(statusLabel(s, forPlayer)).toBe('Glowing, active');
    const secrets = new Map<string, StatusSecret>([['s1', { id: 's1', endsAt: 2 * TURN, totalSeconds: 2 * TURN, unit: 'turn' }]]);
    expect(statusTime(s, secrets, 0, units, 'gm').words).toBe('2 turns left, hidden from players');
    // On the hour track: hidden (the GM's alone) when secret; a player's device has no time for it at all.
    expect(statusEffects([s], secrets, () => 'Wren')).toEqual([{ id: 's1', name: 'Glowing on Wren', endsAt: 2 * TURN, caster: null, hidden: true }]);
    expect(statusEffects([s], new Map(), () => 'Wren')).toEqual([]);
  });

  it('without a timer it lasts until removed (or until rest, for the rest condition)', () => {
    expect(statusTime(status({}), new Map(), 0, units, 'gm').ends).toBe('Lasts until removed.');
    expect(statusTime(status({ source: 'rest' }), new Map(), 0, units, 'gm').ends).toBe('Ends when they rest.');
  });

  it("a timer's length: a whole number in a unit the campaign has, in seconds", () => {
    expect(timerSeconds(3, 'turn', units)).toBe(3 * TURN);
    expect(timerSeconds(0, 'turn', units)).toBeNull();
    expect(timerSeconds(2.5, 'turn', units)).toBeNull();
    expect(timerUnits(units)).toEqual(['round', 'turn', 'hour', 'day']);
  });
});

describe('rest (DG5)', () => {
  const creep = readMode({ id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: [], checks: [], rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary' } })!;
  const roam = readMode({ id: 'roam', name: 'Roaming', step: { value: 1, unit: 'day' }, procedure: [], checks: [], rest: { every: { value: 6, unit: 'day' }, note: 'Rest a day in every seven.' } })!;

  it('is due in the step right after each rest period since the expedition began, and not before', () => {
    const at = (turns: number) => restNow(creep, units, 0, turns * TURN, TURN)!.due;
    expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([false, false, false, true, false, false, true]);
    expect(restNow(creep, units, 0, 0, TURN)).toMatchObject({ button: 'Rest this turn', resting: 'Resting this turn', condition: 'weary' });
  });

  it('day modes say Rest today; a mode without a rest rule has none', () => {
    expect(restNow(roam, units, 0, 0, units.day!)).toMatchObject({ button: 'Rest today', resting: 'Resting today' });
    expect(restNow(readMode({ id: 'x', name: 'X', step: { value: 1, unit: 'turn' }, procedure: [], checks: [], rest: null }), units, 0, 0, TURN)).toBeNull();
  });

  it("ⓘ says the pack's own words first, then the rule plainly", () => {
    expect(restRuleWords(roam, null)[0]).toBe('Rest a day in every seven.');
    expect(restRuleWords(creep, 'Weary')[0]).toBe("Rest 1 turn every 3 turns. Pushing on marks Weary on those who didn't rest.");
  });
});
