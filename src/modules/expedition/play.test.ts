// The clock, sessions and expeditions as Scene shows them (M5 step 5). Invented rules only.
//   The time reads in plain words; the strip's line says the mode and its step, counted from the expedition's start.
//   The main advance is named after the mode's step; units follow the campaign's time lengths and the setting's turnsPerHour.
//   A full rest names the rest and day abilities of each character who went, and nothing else.
//   Chances read the short way, the chance first; the procedure's note steps make one quiet line.
import { describe, expect, it } from 'vitest';
import { FALLBACK_MODES, readExploration } from './modes.ts';
import { fenRules } from './fixtures.ts';
import { nextStep, nextSteps } from './procedure.ts';
import {
  advanceLabel,
  campaignUnits,
  chanceWords,
  clockWords,
  plainDate,
  startSeconds,
  startTimeOf,
  startTimeWords,
  DEFAULT_START_TIME,
  expeditionLine,
  facesWords,
  healingText,
  noteLine,
  restRefills,
  seasonNotNowHolds,
  timeWords,
  toExpedition,
} from './play.ts';

const units = campaignUnits({ time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 } }, []);
const dungeon = FALLBACK_MODES[0]!;
const wilderness = FALLBACK_MODES[1]!;

describe('reading the time', () => {
  it('says a length of time in plain words, the two largest parts', () => {
    expect(timeWords(0)).toBe('no time');
    expect(timeWords(6)).toBe('6 seconds');
    expect(timeWords(600)).toBe('10 minutes');
    expect(timeWords(3600)).toBe('1 hour');
    expect(timeWords(86400 + 7200 + 600)).toBe('1 day 2 hours');
    expect(timeWords(999 * 86400)).toBe('999 days');
  });

  it('shows the day from 1 and the time of day', () => {
    expect(clockWords(0, units)).toBe('Day 1, Month 1, 00:00');
    expect(clockWords(86400 + 8 * 3600 + 600, units)).toBe('Day 2, Month 1, 08:10');
    // B13: without a pack calendar, a numbered day and month (30-day months, twelve to a year).
    expect(clockWords(43 * 86400, units)).toBe('Day 14, Month 2, 00:00');
    expect(plainDate(74)).toBe('Day 14, Month 3');
    expect(plainDate(360)).toBe('Day 30, Month 12');
    expect(plainDate(361)).toBe('Day 1, Month 1, Year 2');
  });

  it("names the main advance after the mode's step", () => {
    expect(advanceLabel(dungeon, units)).toBe('Next turn');
    expect(advanceLabel(wilderness, units)).toBe('Next day');
    expect(advanceLabel({ ...wilderness, step: { value: 1, unit: 'hours' } }, units)).toBe('Next hour');
    expect(advanceLabel({ ...wilderness, step: { value: 4, unit: 'hour' } }, units)).toBe('Next 4 hours');
  });

  it("counts the expedition's steps from its own start, from 1 ('Dungeon, turn 3')", () => {
    expect(expeditionLine(dungeon, { startedAt: 3000 }, 3000, units)).toBe('Dungeon, turn 1');
    expect(expeditionLine(dungeon, { startedAt: 3000 }, 3000 + 1200, units)).toBe('Dungeon, turn 3');
    expect(expeditionLine(wilderness, { startedAt: 0 }, 2 * 86400, units)).toBe('Wilderness, day 3');
  });

  it("follows the campaign's turn length, and the setting's turnsPerHour wins for the hour", () => {
    const long = campaignUnits({ time: { roundSeconds: 10, turnMinutes: 20, dayHours: 24 } }, []);
    expect(long.turn).toBe(1200);
    expect(long.hour).toBe(3600);
    const set = campaignUnits({}, [{ time: { turnsPerHour: 4 } }]);
    expect(set.turn).toBe(600);
    expect(set.hour).toBe(2400);
    // Nothing set: the app's defaults.
    expect(campaignUnits(null, []).turn).toBe(600);
  });

  it('reads a stored expedition, with its summary once ended', () => {
    const read = toExpedition({ id: 'x', campaign_id: 'c', mode: 'dungeon', started_at: 600, ended_at: 1800, who_went: ['a', 'b'], summary: { seconds: 1200, fullRest: true }, version: 3 });
    expect(read).toEqual({ id: 'x', campaignId: 'c', mode: 'dungeon', startedAt: 600, endedAt: 1800, whoWent: ['a', 'b'], summary: { seconds: 1200, fullRest: true }, safePaths: false, endedSafe: null, createdAt: null, version: 3 });
    expect(toExpedition({ id: 'y', campaign_id: 'c', mode: 'roam', started_at: 0, ended_at: null, who_went: [], summary: null, version: 1 }).summary).toBeNull();
  });
});

describe('the full rest (D23)', () => {
  const warden = {
    abilities: [
      { name: 'Lantern ward', uses: { count: 2, per: 'rest' } },
      { name: 'Reed call', uses: { count: 1, per: 'day' } },
      { name: 'Fen fury', uses: { count: 1, per: 'fight' } },
      { name: 'Long vigil', uses: { count: 1, per: 'week' } },
      { name: 'Deep breath', fromLevel: 5, uses: { count: 1, per: 'rest' } },
    ],
  };
  const marshFolk = { abilities: [{ name: 'Mud sense', uses: { count: 1, per: 'Day' } }] };

  it('names the abilities whose uses come back on a rest or a day, for each character who went', () => {
    expect(
      restRefills([
        { id: 'wren', level: 3, klass: warden, race: marshFolk },
        { id: 'ash', level: 1, klass: null, race: null },
      ]),
    ).toEqual({ wren: ['Lantern ward', 'Reed call', 'Mud sense'] });
  });

  it("shows the setting's healing rule as text, the top setting first", () => {
    expect(healingText([])).toBeNull();
    expect(healingText([{ healing: 'Rest a night: heal 1.' }, { healing: { note: 'A full rest heals 1d3.', perLevel: 2 } }])).toBe('A full rest heals 1d3.');
  });
});

describe('chances and the quiet note line (the reminder card itself: card.test.ts)', () => {
  it('says faces and chances the short way', () => {
    expect(facesWords([2, 1])).toBe('1–2');
    expect(facesWords([1, 3, 4])).toBe('1, 3–4');
    expect(chanceWords({ die: 'd8', on: [1] })).toBe('Roll 1d8, on 1');
    expect(chanceWords({ die: null, on: [1, 2] })).toBe('on 1–2');
    expect(chanceWords(null)).toBe("the GM's call");
  });

  it('puts the quiet note steps on one line', () => {
    const rules = readExploration([fenRules]);
    const creep = rules.modes.find((m) => m.id === 'creep')!;
    const one = nextStep({ rules, mode: creep, units, startedAt: 0, now: 0 })!;
    expect(noteLine(one)).toBe('Listen at the dark, Odd step');
    expect(nextSteps({ rules, mode: creep, units, startedAt: 0, now: 0 }, 4)!.steps).toBe(4);
  });

  it('a fallback mode has no note steps, so the line is empty', () => {
    const turn = nextStep({ rules: readExploration([]), mode: dungeon, units, startedAt: 0, now: 0 })!;
    expect(noteLine(turn)).toBe('');
  });
});

describe('"Not now" on "Which season?" (ruled 2026-10-30)', () => {
  it('holds until a session starts after it, and never when it was not said', () => {
    expect(seasonNotNowHolds(null, null)).toBe(false);
    expect(seasonNotNowHolds('2026-10-30T10:00:00Z', null)).toBe(true);
    expect(seasonNotNowHolds('2026-10-30T10:00:00Z', '2026-10-30T09:00:00Z')).toBe(true);
    expect(seasonNotNowHolds('2026-10-30T10:00:00Z', '2026-10-30T11:00:00Z')).toBe(false);
  });
});

// The first day's start time (B13, ruled 2026-11-01): 06:00 by default, put on the clock in this campaign's hours.
describe('the start time', () => {
  it('defaults to 06:00, reads a saved one, and ignores one that is not whole hours and minutes', () => {
    expect(startTimeWords(DEFAULT_START_TIME)).toBe('06:00');
    expect(startTimeOf({ hour: 7, minute: 30 })).toEqual({ hour: 7, minute: 30 });
    expect(startTimeOf({ hour: 7.5, minute: 0 })).toBeNull();
    expect(startTimeOf('06:00')).toBeNull();
    expect(startTimeOf(undefined)).toBeNull();
  });

  it("puts the clock at the time in this campaign's hours, and refuses a time past the day's end or the hour's", () => {
    const units = campaignUnits({}, []);
    expect(startSeconds({ hour: 6, minute: 0 }, units)).toBe(6 * 3600);
    expect(startSeconds({ hour: 24, minute: 0 }, units)).toBeNull();
    expect(startSeconds({ hour: 6, minute: 60 }, units)).toBeNull();
    // An hour of 5 ten-minute turns: 06:00 is 6 of those hours in, and a minute past 49 doesn't fit.
    const fives = campaignUnits({}, [{ time: { turnsPerHour: 5 } }]);
    expect(startSeconds({ hour: 6, minute: 0 }, fives)).toBe(6 * 3000);
    expect(startSeconds({ hour: 6, minute: 50 }, fives)).toBeNull();
  });
});
