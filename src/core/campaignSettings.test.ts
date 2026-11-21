import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME, readTime, startingSettings } from './campaignSettings.ts';

describe('time lengths', () => {
  it('works out rounds per turn and turns per day from the lengths', () => {
    expect(readTime({ roundSeconds: '6', turnMinutes: '10', dayHours: '24' })).toEqual({
      ok: true,
      time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24, roundsPerTurn: 100, turnsPerDay: 144 },
    });
  });

  it('the app default is 6 seconds, 10 minutes and 24 hours', () => {
    expect(DEFAULT_TIME).toEqual({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
  });

  it('needs whole numbers above zero', () => {
    for (const roundSeconds of ['', '0', '-6', '2.5', 'six']) {
      const result = readTime({ roundSeconds, turnMinutes: '10', dayHours: '24' });
      expect(result, roundSeconds).toEqual({ ok: false, message: 'A round needs a whole number of seconds above 0.' });
    }
    expect(readTime({ roundSeconds: '6', turnMinutes: '0', dayHours: '24' })).toEqual({
      ok: false,
      message: 'A turn needs a whole number of minutes above 0.',
    });
  });

  it('a turn must be a whole number of rounds', () => {
    expect(readTime({ roundSeconds: '7', turnMinutes: '10', dayHours: '24' })).toEqual({
      ok: false,
      message: 'A turn must be a whole number of rounds: 10 minutes is 600 seconds, which 7-second rounds don’t divide evenly.',
    });
  });

  it('a day must be a whole number of turns', () => {
    expect(readTime({ roundSeconds: '6', turnMinutes: '7', dayHours: '24' })).toEqual({
      ok: false,
      message: 'A day must be a whole number of turns: 24 hours is 1440 minutes, which 7-minute turns don’t divide evenly.',
    });
  });
});

describe("a new campaign's settings", () => {
  it('keeps the encumbrance chosen and the worked-out time lengths', () => {
    expect(
      startingSettings({ encumbranceMode: 'slot', time: { roundSeconds: 10, turnMinutes: 10, dayHours: 24, roundsPerTurn: 60, turnsPerDay: 144 } }),
    ).toEqual({
      encumbrance: { mode: 'slot' },
      time: { roundSeconds: 10, turnMinutes: 10, dayHours: 24, roundsPerTurn: 60, turnsPerDay: 144 },
    });
  });
});
