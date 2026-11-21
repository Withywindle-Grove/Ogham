// Timed effects and the hour track (docs/05 "Exploration follow-ups", X-1 and X-3). Invented effects.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { endingOnJump, fill, readDuration, startEffect, startRolledEffect } from './effects.ts';
import { hourTrack } from './hourTrack.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
const TURN = 600;

describe('durations', () => {
  it('a number or a formula with a unit; dice wait for the GM; concentration, until broken and permanent have no timer', () => {
    expect(readDuration({ value: 3, unit: 'turn' }, units)).toEqual({ kind: 'timed', seconds: 3 * TURN });
    expect(readDuration({ formula: '2 + level', unit: 'turn' }, units, 4)).toEqual({ kind: 'timed', seconds: 6 * TURN });
    expect(readDuration({ formula: '1d4 + level', unit: 'round' }, units, 2)).toEqual({ kind: 'roll', dice: '1d4 + 2', unit: 'round' });
    expect(readDuration('concentration', units)).toEqual({ kind: 'concentration' });
    expect(readDuration({ value: 1, unit: 'aeon' }, units)).toBeNull();
  });

  it('starting one: a timer ends it; without one it names the caster; dice start once the roll is in', () => {
    expect(startEffect('e1', 'Fen-sight', { kind: 'timed', seconds: 3 * TURN }, 1000)).toMatchObject({ endsAt: 1000 + 3 * TURN, caster: null });
    expect(startEffect('e2', 'Still water', { kind: 'concentration' }, 1000, { caster: 'Moss' })).toMatchObject({ endsAt: null, caster: 'Moss' });
    expect(startEffect('e3', 'Quick feet', { kind: 'roll', dice: '1d4', unit: 'round' }, 0)).toBeNull();
    expect(startRolledEffect('e3', 'Quick feet', { kind: 'roll', dice: '1d4', unit: 'round' }, 3, 0, units)).toMatchObject({ endsAt: 18 });
  });

  it('ends in the jump that passes it; the ring drains as time goes', () => {
    const e = startEffect('e1', 'Fen-sight', { kind: 'timed', seconds: 4 * TURN }, 0)!;
    expect(endingOnJump([e], 0, 3 * TURN)).toEqual([]);
    expect(endingOnJump([e], 3 * TURN, 6 * TURN)).toEqual([e]);
    expect(fill(e, 0, TURN)).toBe(0.75);
  });
});

describe('the hour track', () => {
  it("one pip per turn in the hour; the current one; events on the turn they fall due in (B8); players see only public ones", () => {
    const now = 3600 * 2 + 2 * TURN; // the third turn of the hour
    const events = [
      { at: now + TURN, symbol: 'check', label: 'Encounter check', public: false },
      { at: now + 2 * TURN, symbol: 'light', label: 'Rushlight out', public: true },
      { at: now + 9 * TURN, symbol: 'rest', label: 'Rest', public: true },
    ];
    const gm = hourTrack(now, units, events, 'gm');
    expect(gm.map((p) => [p.turn, p.current, p.done, p.events.map((e) => e.symbol)])).toEqual([
      [1, false, true, []],
      [2, false, true, []],
      [3, true, false, []],
      [4, false, false, ['check']],
      [5, false, false, ['light']],
      [6, false, false, []],
    ]);
    // An event at the end of the current turn comes due with the next Next turn: it sits on the next pip, and
    // players don't see the GM's check.
    expect(hourTrack(now, units, events, 'player')[3]!.events).toEqual([]);
    // One due now (just brought due) sits on the current pip; one due as the hour turns over isn't on this hour.
    const dueNow = hourTrack(now, units, [{ at: now, symbol: 'rest', label: 'Rest', public: true }, { at: 3 * 3600, symbol: 'check', label: 'Encounter check', public: false }], 'gm');
    expect(dueNow.map((p) => p.events.map((e) => e.symbol))).toEqual([[], [], ['rest'], [], [], []]);
  });

  // B8 follow-up (ruled 2026-11-01, g1's ⚑ 2, option B).
  it("on the hour's last turn, a check or rest due as the hour turns over shows ahead on an extra pip at the track's edge; earlier in the hour it doesn't", () => {
    const hourEnd = 3 * 3600;
    const turnOver = [
      { at: hourEnd, symbol: 'check', label: 'Encounter check', public: false },
      { at: hourEnd, symbol: 'rest', label: 'Rest', public: true },
    ];
    const last = hourTrack(hourEnd - TURN, units, turnOver, 'gm');
    expect(last.map((p) => [p.turn, p.current, p.next ?? false, p.events.map((e) => e.symbol)])).toEqual([
      [1, false, false, []],
      [2, false, false, []],
      [3, false, false, []],
      [4, false, false, []],
      [5, false, false, []],
      [6, true, false, []],
      [1, false, true, ['check', 'rest']],
    ]);
    // Players see the rest at the edge, not the GM's check; with nothing due as the hour turns over, no edge pip.
    expect(hourTrack(hourEnd - TURN, units, turnOver, 'player').at(-1)!.events.map((e) => e.symbol)).toEqual(['rest']);
    expect(hourTrack(hourEnd - TURN, units, [turnOver[0]!], 'player')).toHaveLength(6);
    expect(hourTrack(hourEnd - TURN, units, [], 'gm')).toHaveLength(6);
    // On the turn before the last, it isn't shown ahead.
    expect(hourTrack(hourEnd - 2 * TURN, units, turnOver, 'gm')).toHaveLength(6);
  });

  it('with turns per hour from the rules set, the track has that many pips and the hour is that many turns', () => {
    const fives = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 5 });
    const pips = hourTrack(5 * TURN + TURN, fives, [], 'gm');
    expect(pips.map((p) => p.current)).toEqual([false, true, false, false, false]);
  });
});
