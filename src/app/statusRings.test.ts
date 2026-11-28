// A status as its Status ring reads it (plan m5b-creation-retest-3 F). Invented statuses. Purposes:
//   A status with 4 of 6 turns left draws a two-thirds arc, "4 turns" under it, and "4 of 6 turns left" in its sheet.
//   Its symbol and tone come from its condition (07 `icon`, `tone`); the stored icon stands in when the setting no
//   longer has the condition, and a status from no condition has no tone (ink).
//   No end: the dashed track and no arc, "until removed" (or "until rest", "until stepped down").
//   0 left: an empty ring, "ran out"; 999 left: its words.
//   A secret timer: a player gets the track with no arc and "time hidden"; the GM gets the time, marked hidden.
//   ⚑ 1 (proposed answer): a timer in a unit the ring can't read is dashed, with the words the app has.
//   The head's list (pss-7, psb-2; #165): at or below the rules' `death.at` "Down" leads the statuses; above it, or with
//   no `death.at`, or no hit points set, there is no Down; Down is worked out from the hit points, never stored.
//   The Down ring (psb-1): the skull, the harm tone, no end (the dashed track, no arc), no time in words.
import { describe, expect, it } from 'vitest';
import type { CharacterStatus, Condition, StatusSecret } from '../modules/expedition/statusPlay.ts';
import { timeUnits } from '../modules/expedition/clock.ts';
import { DOWN_RING, headStatusList, ringView } from './statusRings.ts';

const TURN = 600;
const units = timeUnits({ roundSeconds: 10, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 }, []);

const status = (over: Partial<CharacterStatus> = {}): CharacterStatus => ({
  id: 'st-1',
  campaignId: 'c-1',
  actorId: 'wren',
  name: 'Bog adder venom',
  conditionId: 'bog-adder-venom',
  icon: null,
  stacks: 1,
  stacking: false,
  levels: null,
  level: null,
  source: 'condition',
  note: null,
  startedAt: 0,
  endsAt: 6 * TURN,
  totalSeconds: 6 * TURN,
  unit: 'turn',
  secret: false,
  untilRest: false,
  endedAt: null,
  version: 1,
  ...over,
});

const venom: Condition = { id: 'bog-adder-venom', name: 'Bog adder venom', icon: 'drop', tone: 'harm', stacks: false, levels: null, defaultRounds: null, note: 'Slow and sick.' };
const book = (now: number, secrets: ReadonlyMap<string, StatusSecret> = new Map(), conditions: Condition[] = [venom]) => ({ secrets, now, units, conditions });

describe('the ring of a timed status', () => {
  it('4 of 6 turns: a two-thirds arc, "4 turns", "4 of 6 turns left"', () => {
    const view = ringView(status(), book(2 * TURN), 'player');
    expect(view.fraction).toBeCloseTo(2 / 3);
    expect(view.endless).toBe(false);
    expect(view.words).toBe('4 turns');
    expect(view.count).toBe('4 of 6 turns left');
  });

  it('takes its symbol and tone from its condition; the stored icon stands in for a condition gone', () => {
    expect(ringView(status(), book(0), 'player')).toMatchObject({ icon: 'drop', tone: 'harm' });
    expect(ringView(status({ icon: 'skull' }), book(0, new Map(), []), 'player')).toMatchObject({ icon: 'skull', tone: null });
    expect(ringView(status({ conditionId: null, name: 'Muddy boots' }), book(0), 'player')).toMatchObject({ icon: null, tone: null, name: 'Muddy boots' });
  });

  it('0 left: an empty ring and "ran out"; 999 left: its words and a full ring', () => {
    expect(ringView(status(), book(6 * TURN), 'player')).toMatchObject({ fraction: 0, words: 'ran out', count: 'Ran out' });
    const long = ringView(status({ endsAt: 999 * TURN, totalSeconds: 999 * TURN }), book(0), 'player');
    expect(long).toMatchObject({ fraction: 1, words: '999 turns', count: '999 of 999 turns left' });
  });

  it('names its stacks with the name', () => {
    expect(ringView(status({ stacks: 3 }), book(0), 'player').name).toBe('Bog adder venom ×3');
  });
});

describe('a status with no end', () => {
  it('is the dashed track with no arc, and says how it ends', () => {
    const none = { endsAt: null, totalSeconds: null, unit: null };
    expect(ringView(status(none), book(0), 'player')).toMatchObject({ fraction: null, endless: true, words: 'until removed', count: null });
    expect(ringView(status({ ...none, untilRest: true }), book(0), 'player').words).toBe('until rest');
    expect(ringView(status({ ...none, levels: [{ id: 'a', name: 'Dazed' }], level: 0 }), book(0), 'player').words).toBe('until stepped down');
  });
});

describe('a secret timer', () => {
  const secret = status({ secret: true, endsAt: null, totalSeconds: null, unit: null });
  const secrets = new Map([['st-1', { id: 'st-1', endsAt: 6 * TURN, totalSeconds: 6 * TURN, unit: 'turn' }]]);
  it('a player gets the track with no arc and "time hidden"', () => {
    expect(ringView(secret, book(2 * TURN), 'player')).toMatchObject({ fraction: null, endless: false, words: 'time hidden', count: "Time left is the GM's" });
  });
  it('the GM gets the time left, marked hidden from players', () => {
    expect(ringView(secret, book(2 * TURN, secrets), 'gm')).toMatchObject({ words: '4 turns', count: '4 of 6 turns left, hidden from players' });
  });
});

describe('⚑ 1: a clock unit the ring cannot read', () => {
  it('is dashed, with the words the app has', () => {
    const view = ringView(status({ unit: 'watch' }), book(0), 'player');
    expect(view.endless).toBe(true);
    expect(view.fraction).toBeNull();
    expect(view.words).toBe('60 minutes');
  });
});

describe("the head's status list with Down", () => {
  const two = [status({ id: 'st-1' }), status({ id: 'st-2', name: 'Mist-dazed' })];
  const kinds = (list: ReturnType<typeof headStatusList>) => list.map((r) => (r.kind === 'down' ? 'Down' : r.status.id));

  it('at death.at: Down first, then the statuses', () => {
    expect(kinds(headStatusList(two, 0, 0))).toEqual(['Down', 'st-1', 'st-2']);
  });

  it('below death.at: Down first', () => {
    expect(kinds(headStatusList(two, -3, 0))).toEqual(['Down', 'st-1', 'st-2']);
    // A setting that marks Down below 0 counts from its own number.
    expect(kinds(headStatusList([], -3, -3))).toEqual(['Down']);
  });

  it('above death.at: no Down', () => {
    expect(kinds(headStatusList(two, 1, 0))).toEqual(['st-1', 'st-2']);
    expect(kinds(headStatusList([], 0, -3))).toEqual([]);
  });

  it('with no death.at in the rules: no Down, even at 0 or below', () => {
    expect(kinds(headStatusList(two, 0, null))).toEqual(['st-1', 'st-2']);
    expect(kinds(headStatusList([], -5, null))).toEqual([]);
  });

  it('with no hit points set: no Down', () => {
    expect(kinds(headStatusList(two, null, 0))).toEqual(['st-1', 'st-2']);
  });

  it('the Down ring: the skull in the harm tone, no end, no time in words', () => {
    expect(DOWN_RING).toEqual({ name: 'Down', icon: 'skull', tone: 'harm', fraction: null, endless: true });
  });
});
