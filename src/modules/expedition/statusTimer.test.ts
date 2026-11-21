// Status timers (docs/04 "Status"; ruled 2026-10-29, D27). Invented statuses.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { showTimer, startTimer, tickTimer, timerFromCondition } from './statusTimer.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });

describe('status timers', () => {
  it('are kept in seconds and shown in the status’s own unit', () => {
    const timer = startTimer({ value: 3, unit: 'turns' }, units)!;
    expect(timer).toEqual({ remaining: 1800, total: 1800, unit: 'turn', secret: false });
    expect(showTimer(timer, units, 'player')).toEqual({ left: { value: 3, unit: 'turn' }, fillPercent: 100, hiddenFromViewer: false });
  });

  it('a condition with a default length in rounds starts a timer in rounds; one without has no timer', () => {
    expect(timerFromCondition({ id: 'dazzled', defaultRounds: 2 }, units)).toMatchObject({ remaining: 12, unit: 'round' });
    expect(timerFromCondition({ id: 'mired', defaultRounds: null }, units)).toBeNull();
    expect(startTimer({ value: 0, unit: 'turn' }, units)).toBeNull();
    expect(startTimer({ value: 2, unit: 'aeon' }, units)).toBeNull();
  });

  it('ticks down with the clock, ends once, and reads rounded up in its unit while any is left', () => {
    const timer = startTimer({ value: 2, unit: 'day' }, units)!;
    const half = tickTimer(timer, 86400 + 600);
    expect(half.ended).toBe(false);
    expect(showTimer(half.timer, units, 'gm')).toMatchObject({ left: { value: 1, unit: 'day' }, fillPercent: 50 });
    const done = tickTimer(half.timer, 86400 * 5);
    expect(done).toMatchObject({ ended: true, timer: { remaining: 0 } });
    expect(tickTimer(done.timer, 600).ended).toBe(false);
  });

  it('a secret timer shows its time left to the GM only; players see no fill', () => {
    const timer = startTimer({ value: 4, unit: 'turn' }, units, true)!;
    expect(showTimer(timer, units, 'gm').left).toEqual({ value: 4, unit: 'turn' });
    expect(showTimer(timer, units, 'player')).toEqual({ left: null, fillPercent: null, hiddenFromViewer: true });
  });

  it('a status with no timer shows nothing to count', () => {
    expect(showTimer({ remaining: null, total: null, unit: 'turn', secret: false }, units, 'gm')).toEqual({ left: null, fillPercent: null, hiddenFromViewer: false });
  });
});
