// The Scene's top as words (plan dec-9-the-whole-scene rows S1, S4 and S9; page 16, approved 2026-11-14, st-1 to
// st-8): the band's session line, heading and date line, and the four facts with their states.
import { describe, expect, it } from 'vitest';
import { methodsOf, POINT_TO_POINT_ID, readExploration } from './modes.ts';
import type { PackPlace } from './placeTree.ts';
import {
  bandHeading,
  checkFact,
  checkRule,
  checkSheetLines,
  dateWords,
  departAreaName,
  departLocationGroups,
  departMethodOf,
  departModeOf,
  departSheetModeOf,
  partyInSettlement,
  placeMethodOf,
  partOfDayFact,
  partOfDayWords,
  showsDowntimeTop,
  showsTownTop,
  TOWN_STEP_LABEL,
  lightFact,
  lightLeftWords,
  lightSheetLines,
  regionOfChain,
  restEveryWords,
  restFact,
  restSheetLines,
  seasonIconOf,
  sessionLine,
  sessionStateOf,
  settingRule,
  weatherFact,
} from './sceneTop.ts';

describe('the session state (S9)', () => {
  // Purpose: a campaign that never played has no session yet; one played before with none running is paused.
  it('reads none, paused and running from the scene', () => {
    expect(sessionStateOf({ session: null, played: false })).toBe('none');
    expect(sessionStateOf({ session: null })).toBe('none');
    expect(sessionStateOf({ session: null, played: true })).toBe('paused');
    expect(sessionStateOf({ session: { id: 's' }, played: true })).toBe('running');
  });
});

describe('the band (S1)', () => {
  // Purpose: the line above the heading names the session and the region where it is known; with no session yet, the campaign.
  it('names the session, the region where known, or the campaign', () => {
    expect(sessionLine({ state: 'running', campaignName: 'The Reed Marches', sessionNumber: 1, region: 'Saltwick Island' })).toBe('Session 1. Saltwick Island.');
    expect(sessionLine({ state: 'paused', campaignName: 'The Reed Marches', sessionNumber: 3, region: null })).toBe('Session 3.');
    expect(sessionLine({ state: 'none', campaignName: 'The Reed Marches', sessionNumber: null, region: 'Saltwick Island' })).toBe('The Reed Marches');
  });

  // Purpose: the heading is the place and the mode's own count while a session runs, the place alone while paused, and "No session yet" before the first.
  it('shows no turn count while no session runs', () => {
    const at = { place: 'The Drowned Harbour', modeName: 'Dungeon', step: 'turn 14', fallback: 'Dungeon, turn 14' };
    expect(bandHeading({ state: 'running', ...at })).toBe('The Drowned Harbour, turn 14');
    expect(bandHeading({ state: 'paused', ...at })).toBe('The Drowned Harbour');
    expect(bandHeading({ state: 'none', ...at })).toBe('No session yet');
  });

  // Purpose: without a named place the mode stands in for it; between expeditions the strip's own words stay (the town and downtime are S5's).
  it('falls back to the mode, and between expeditions to the strip words', () => {
    expect(bandHeading({ state: 'running', place: null, modeName: 'Dungeon', step: 'turn 2', fallback: 'x' })).toBe('Dungeon, turn 2');
    expect(bandHeading({ state: 'running', place: null, modeName: null, step: null, fallback: 'Downtime' })).toBe('Downtime');
  });

  // Purpose: the region on the session line is the nearest region the place sits in, by the pack's own type.
  it('finds the region in the place chain', () => {
    const entry = (name: string, type: string) => ({ packId: 'p', entryId: name, name, data: { type } });
    expect(regionOfChain([entry('The jetty', 'room'), entry('The Drowned Harbour', 'site'), entry('Saltwick Island', 'region')])).toBe('Saltwick Island');
    expect(regionOfChain([entry('The jetty', 'room')])).toBeNull();
    expect(regionOfChain(null)).toBeNull();
  });
});

describe('the date line (S1, frame TB)', () => {
  // Purpose: the date reads day, month and season; an extra day names its month; with no calendar start it is "Day N".
  it('words the date', () => {
    expect(dateWords({ date: { day: 14, month: 'Reedmonth', extraDay: null }, season: 'spring', dayNumber: 3 })).toBe('14 Reedmonth, spring');
    expect(dateWords({ date: { day: null, month: 'Reedmonth', extraDay: { id: 'x', name: 'Lantern Night' } }, season: null, dayNumber: 3 })).toBe('Lantern Night, after Reedmonth');
    expect(dateWords({ date: null, season: null, dayNumber: 14 })).toBe('Day 14');
  });

  // Purpose: each of the four seasons has its icon from the set, and a season the app can't place has none.
  it('gives a season its icon, and an unknown one none', () => {
    expect(seasonIconOf('Spring')).toBe('sprout');
    expect(seasonIconOf('high summer')).toBe('sunflower');
    expect(seasonIconOf('Autumn')).toBe('maple-leaf');
    expect(seasonIconOf('fall')).toBe('maple-leaf');
    expect(seasonIconOf('Winter')).toBe('snowflake-1');
    expect(seasonIconOf('the Wet')).toBeNull();
    expect(seasonIconOf(null)).toBeNull();
  });

  // Purpose: the light left counts whole hours to sunset, says dusk inside the last two, night after sunset, and nothing without a daylight rule.
  it('words the light left', () => {
    const sun = { sunrise: 6 * 60, sunset: 18 * 60 };
    expect(lightLeftWords(sun, 15 * 60 + 30)).toBe('2 hours of light left.');
    expect(lightLeftWords(sun, 16 * 60 + 30)).toBe('Dusk in 1 hour.');
    expect(lightLeftWords(sun, 17 * 60 + 30)).toBe('Dusk within the hour.');
    expect(lightLeftWords(sun, 19 * 60)).toBe('Night.');
    expect(lightLeftWords(sun, 5 * 60)).toBe('Night.');
    expect(lightLeftWords(null, 12 * 60)).toBeNull();
  });
});

describe('the facts (S4)', () => {
  // Purpose: the weather fact is due while today's weather is to roll, says it when it is in, and is absent without a weather rule.
  it('follows the weather', () => {
    expect(weatherFact({ kind: 'due', table: 'Marsh weather, spring' })).toMatchObject({ value: 'To roll', sub: 'Marsh weather, spring.', state: 'due' });
    expect(weatherFact({ kind: 'in', result: 'Drizzle', line: 'Wet.' })).toMatchObject({ value: 'Drizzle', sub: 'Wet.', state: 'quiet' });
    expect(weatherFact({ kind: 'none' })).toBeNull();
  });

  // Purpose: the light fact names the light that runs out first and its time; a group in the dark is "No light", dark and with the warning sign.
  it('follows the light of one group', () => {
    const lit = lightFact({ stepWord: 'turn', groups: [{ group: 1, name: 'Group 1', dark: false, lights: [{ name: 'Wren’s lantern', stepsLeft: 9 }, { name: 'Ash’s torch', stepsLeft: 4 }] }] });
    expect(lit).toMatchObject({ value: 'Ash’s torch', sub: '4 turns left.', state: 'quiet', warn: false });
    const dark = lightFact({ stepWord: 'turn', groups: [{ group: 1, name: 'Group 1', dark: true, lights: [] }] });
    expect(dark).toMatchObject({ value: 'No light', state: 'dark', warn: true });
    // Nothing lit and nobody in the dark (a day mode in daylight): nothing to state.
    expect(lightFact({ stepWord: 'turn', groups: [{ group: 1, name: 'Group 1', dark: false, lights: [] }] })).toBeNull();
  });

  // Purpose: with a split party the light fact names the group that needs the GM and lists the others, or counts the groups lit.
  it('follows the light of a split party', () => {
    const g1 = { group: 1, name: 'Group 1', dark: false, lights: [{ name: 'Ash’s torch', stepsLeft: 4 }] };
    const g2lit = { group: 2, name: 'Group 2', dark: false, lights: [{ name: 'Bram’s torch', stepsLeft: 6 }] };
    const g2dark = { group: 2, name: 'Group 2', dark: true, lights: [] };
    expect(lightFact({ stepWord: 'turn', groups: [g1, g2lit] })).toMatchObject({ value: '2 groups lit', sub: 'Group 1: 4 turns. Group 2: 6 turns.', state: 'quiet' });
    expect(lightFact({ stepWord: 'turn', groups: [g1, g2dark] })).toMatchObject({ value: 'Group 2 dark', sub: 'Group 1: Ash’s torch, 4 turns.', state: 'dark', warn: true });
  });

  // Purpose: the rest fact counts down to the next rest and is due when it falls due; absent without a rest rule.
  it('follows the rest of one group', () => {
    expect(restFact({ stepWord: 'turn', day: false, ruleWords: '1 turn in 6.', groups: [{ group: 1, name: 'Group 1', open: false, stepsLeft: 4 }] })).toMatchObject({ value: 'In 4 turns', sub: '1 turn in 6.', state: 'quiet' });
    expect(restFact({ stepWord: 'turn', day: false, ruleWords: '1 turn in 6.', groups: [{ group: 1, name: 'Group 1', open: true, stepsLeft: 0 }] })).toMatchObject({ value: 'Rest due', state: 'due' });
    expect(restFact({ stepWord: 'day', day: true, ruleWords: null, groups: [{ group: 1, name: 'Group 1', open: true, stepsLeft: 0 }] })).toMatchObject({ value: 'Rest day', state: 'due' });
    expect(restFact({ stepWord: 'turn', day: false, ruleWords: null, groups: [] })).toBeNull();
  });

  // Purpose: with a split party the rest fact names the group whose rest is due, or the group whose rest comes first.
  it('follows the rest of a split party', () => {
    const due = restFact({ stepWord: 'turn', day: false, ruleWords: null, groups: [{ group: 1, name: 'Group 1', open: true, stepsLeft: 0 }, { group: 2, name: 'Group 2', open: false, stepsLeft: 3 }] });
    expect(due).toMatchObject({ value: 'Group 1 due', sub: 'Group 2: in 3 turns.', state: 'due' });
    const quiet = restFact({ stepWord: 'turn', day: false, ruleWords: null, groups: [{ group: 1, name: 'Group 1', open: false, stepsLeft: 4 }, { group: 2, name: 'Group 2', open: false, stepsLeft: 3 }] });
    expect(quiet).toMatchObject({ value: 'In 3 turns', sub: 'Group 2 first. Group 1: in 4 turns.', state: 'quiet' });
  });

  // Purpose: the rest rule's small line is its length in its period, in numerals.
  it('words the rest rule', () => {
    expect(restEveryWords({ every: { value: 6, unit: 'turns' }, length: { value: 1, unit: 'turn' } })).toBe('1 turn in 6.');
    expect(restEveryWords({ every: { value: 6, unit: 'days' }, length: null })).toBe('Every 6 days.');
    expect(restEveryWords(null)).toBeNull();
  });

  // Purpose: the encounter check fact says when it is rolled on one line and its chance with its die, named by its own name.
  it('states the encounter check', () => {
    const chance = { die: 'd6', on: [1] };
    expect(checkFact({ name: null, eachMove: true, every: null, chance, fallbackUnit: 'turn' })).toMatchObject({ label: 'Encounter check', value: 'On every move', sub: '1 in 6', die: 'd6', state: 'quiet' });
    expect(checkFact({ name: 'Wandering things', eachMove: false, every: { value: 2, unit: 'turns' }, chance: null, fallbackUnit: 'turn' })).toMatchObject({ label: 'Wandering things', value: 'Every 2 turns', sub: null, die: null });
  });
});

describe("the town's and downtime's top (S5)", () => {
  // Purpose: the town's top shows only with no expedition open in adventure time; downtime's only in downtime.
  it('decides the town top and the downtime top in one place each', () => {
    expect(showsTownTop({ expedition: null, campaignMode: 'adventure' })).toBe(true);
    expect(showsTownTop({ expedition: { id: 'x' }, campaignMode: 'adventure' })).toBe(false);
    expect(showsTownTop({ expedition: null, campaignMode: 'downtime' })).toBe(false);
    expect(showsDowntimeTop({ expedition: null, campaignMode: 'downtime' })).toBe(true);
    expect(showsDowntimeTop({ expedition: { id: 'x' }, campaignMode: 'downtime' })).toBe(false);
    expect(showsDowntimeTop({ expedition: null, campaignMode: 'adventure' })).toBe(false);
  });

  // Purpose: the town's step has its own words, whatever the step's length (ic-5).
  it('reads Advance time', () => {
    expect(TOWN_STEP_LABEL).toBe('Advance time');
  });

  // Purpose: the part of the day says now and next, and its tap is said as Advance by…; the date line's words end in a stop.
  it('says the part of the day and the next', () => {
    expect(partOfDayFact('morning', 'afternoon')).toMatchObject({ id: 'part', label: 'Part of the day', value: 'Morning', sub: 'Afternoon comes next.', state: 'quiet', tap: 'Advance by…' });
    expect(partOfDayFact('night', 'morning')).toMatchObject({ value: 'Night', sub: 'Morning comes next.' });
    expect(partOfDayWords('afternoon')).toBe('Afternoon.');
  });

  // Purpose: the Depart sheet starts on the GM's pick, else the newest expedition's mode, else the setting's first.
  it("starts the sheet on the GM's pick, else the last mode, else the first", () => {
    const modes = [{ id: 'quay' }, { id: 'cellars' }];
    expect(departModeOf(modes, 'cellars', 'quay')?.id).toBe('cellars');
    expect(departModeOf(modes, null, 'cellars')?.id).toBe('cellars');
    expect(departModeOf(modes, 'gone', 'gone')?.id).toBe('quay');
    expect(departModeOf([], null, null)).toBeUndefined();
  });

  // fno-1 (Francis, "A", 2026-11-15): the Depart sheet starts on the town way when no expedition has ever been started
  // and whenever the party is in a settlement; the GM's own pick still wins. The town way is a mode whose step is a part
  // of the day (07 Settlements). Invented modes: "Lantern crawl" by turns, "Market rounds" by parts of the day.
  const crawl = { id: 'crawl', step: { value: 1, unit: 'turn' } };
  const rounds = { id: 'rounds', step: { value: 1, unit: 'partOfDay' } };
  const trek = { id: 'trek', step: { value: 1, unit: 'day' } };

  // Purpose: a campaign that has never started an expedition opens the Depart sheet on the town way, not the setting's first mode.
  it('starts on the town way when no expedition was ever started', () => {
    expect(departSheetModeOf([crawl, rounds, trek], { picked: null, last: null, inSettlement: false })?.id).toBe('rounds');
  });

  // Purpose: once an expedition has been started, outside a settlement the sheet starts on the newest expedition's mode, as before.
  it('keeps the last mode outside a settlement once an expedition was started', () => {
    expect(departSheetModeOf([crawl, rounds, trek], { picked: null, last: 'trek', inSettlement: false })?.id).toBe('trek');
  });

  // Purpose: a party in a settlement opens the sheet on the town way even when the last expedition used another mode.
  it('starts on the town way while the party is in a settlement', () => {
    expect(departSheetModeOf([crawl, rounds, trek], { picked: null, last: 'crawl', inSettlement: true })?.id).toBe('rounds');
  });

  // Purpose: the GM's own pick on the sheet always wins over the town way.
  it("keeps the GM's pick over the town way", () => {
    expect(departSheetModeOf([crawl, rounds, trek], { picked: 'crawl', last: null, inSettlement: true })?.id).toBe('crawl');
  });

  // Purpose: a setting with no town way falls back to today's rule (the last mode, else the first).
  it('falls back to the last mode, else the first, without a town way', () => {
    expect(departSheetModeOf([crawl, trek], { picked: null, last: null, inSettlement: true })?.id).toBe('crawl');
    expect(departSheetModeOf([crawl, trek], { picked: null, last: 'trek', inSettlement: true })?.id).toBe('trek');
    expect(departSheetModeOf([], { picked: null, last: null, inSettlement: false })).toBeUndefined();
  });

  // Purpose: "parts of the day" (plural) also reads as the town way, and the first such mode is the one taken.
  it('takes the first mode whose step is a part of the day', () => {
    const evening = { id: 'evening', step: { value: 2, unit: 'partsOfDay' } };
    expect(departSheetModeOf([crawl, evening, rounds], { picked: null, last: null, inSettlement: false })?.id).toBe('evening');
  });

  // Point to point (plan scene-point-to-point, piece B8; p2p-6): offered beside the setting's modes (`methodsOf`).
  // Purpose: given the methods, the Depart sheet can start on point to point (the GM's pick, or the method of the
  // newest expedition), while the town's own current mode, read from the setting's modes alone, never becomes it.
  it('starts the sheet on point to point when it is picked or was the last method', () => {
    const modes = readExploration([{ exploration: { modes: [crawl, trek] } }]).modes;
    const methods = methodsOf(modes);
    expect(departSheetModeOf(methods, { picked: POINT_TO_POINT_ID, last: 'trek', inSettlement: false })?.id).toBe(POINT_TO_POINT_ID);
    expect(departSheetModeOf(methods, { picked: null, last: POINT_TO_POINT_ID, inSettlement: false })?.id).toBe(POINT_TO_POINT_ID);
    expect(departSheetModeOf(methods, { picked: 'crawl', last: POINT_TO_POINT_ID, inSettlement: false })?.id).toBe('crawl');
    // Point to point's step is never a part of the day: it is not the town way.
    expect(departSheetModeOf(methods, { picked: null, last: null, inSettlement: true })?.id).toBe('crawl');
    expect(departModeOf(modes, null, POINT_TO_POINT_ID)?.id).toBe('crawl');
  });

  // Purpose: the party is in a settlement only when every group between expeditions stands at a settlement place (marked
  // a settlement, Safe or Hostile); a group at an ordinary place, a group with no place, or no groups at all is not.
  it('reads the party as in a settlement only when every group is at one', () => {
    const town = { settlement: { size: 'small', population: null }, safety: null };
    const safe = { settlement: null, safety: 'safe' as const };
    const ford = { settlement: null, safety: null };
    expect(partyInSettlement([{ place: town }, { place: safe }])).toBe(true);
    expect(partyInSettlement([{ place: town }, { place: ford }])).toBe(false);
    expect(partyInSettlement([{ place: town }, { place: null }])).toBe(false);
    expect(partyInSettlement([])).toBe(false);
  });
});

describe('the Depart sheet of p2p-5 (plan scene-point-to-point B7; page 24, DP1)', () => {
  const place = (entryId: string, name: string, type: string, parentId: string | null, more: Partial<PackPlace> = {}): PackPlace => ({
    packId: 'pack-isle',
    packName: 'Saltwick Isle',
    packKind: 'adventure',
    entryId,
    name,
    type,
    parentId,
    key: null,
    hex: null,
    settlement: false,
    terrain: null,
    ...more,
  });
  const isle = place('isle', 'Saltwick Island', 'region', null);
  const harbour = place('harbour', 'The Drowned Harbour', 'site', 'isle');
  const anchorage = place('anchorage', 'The Anchorage', 'area', 'harbour');
  const jetty = place('jetty', 'The Jetty', 'area', 'harbour', { key: '1' });
  const steps = place('steps', 'The Jetty Steps', 'area', 'jetty');
  const beach = place('beach', 'The Shingle Beach', 'site', 'isle');
  const landing = place('landing', 'The Landing', 'area', 'beach');
  const hex = place('hex-0412', 'Oath Isle', 'area', 'isle', { hex: '0412', key: '0412' });
  const room = place('vault', 'The Vault', 'room', 'harbour');
  const lone = place('rock', 'The Lone Rock', 'area', null);
  const crawl = { id: 'crawl', name: 'Crawl', step: { value: 1, unit: 'turn' } };
  const trek = { id: 'trek', name: 'Trek', step: { value: 1, unit: 'day' } };
  const rounds = { id: 'rounds', step: { value: 1, unit: 'partOfDay' } };

  // Purpose: only a Location fills in a method, Point to point; a hex, a room, an Area or no place gives none.
  it('a Location gives Point to point; any other place gives none', () => {
    expect(placeMethodOf(anchorage)).toBe(POINT_TO_POINT_ID);
    for (const other of [hex, room, harbour, isle, null, undefined]) expect(placeMethodOf(other)).toBeNull();
  });

  // Purpose: the pick (the GM's tap, or the one the place filled in) shows at once, before Where? too; with none, the
  // method is unset until a place is picked, then today's start (the town way where nothing was started before, else
  // the newest expedition's way).
  it('shows the pick at once; else unset until a place is picked, then the start of fno-1', () => {
    const methods = methodsOf(readExploration([{ exploration: { modes: [crawl, trek] } }]).modes);
    expect(departMethodOf(methods, { picked: null, placed: false, last: 'trek', inSettlement: false })).toBeNull();
    expect(departMethodOf(methods, { picked: 'crawl', placed: false, last: 'trek', inSettlement: false })?.id).toBe('crawl');
    expect(departMethodOf(methods, { picked: POINT_TO_POINT_ID, placed: true, last: 'trek', inSettlement: false })?.id).toBe(POINT_TO_POINT_ID);
    expect(departMethodOf(methods, { picked: null, placed: true, last: 'trek', inSettlement: false })?.id).toBe('trek');
    expect(departMethodOf([crawl, rounds], { picked: null, placed: true, last: null, inSettlement: false })?.id).toBe('rounds');
    expect(departMethodOf([], { picked: null, placed: true, last: null, inSettlement: false })).toBeNull();
  });

  // Purpose: Where? lists only Locations, each under its Area's name, in the pack's own order; a Location inside a
  // Location stays in its Area's group; an Area, a Region, a hex or a room is never a row.
  it('groups Locations under their Area, in the pack tree order', () => {
    const groups = departLocationGroups([isle, harbour, anchorage, jetty, steps, room, beach, landing, hex]);
    expect(groups.map((g) => [g.name, g.locations.map((p) => p.name)])).toEqual([
      ['The Drowned Harbour', ['The Anchorage', 'The Jetty', 'The Jetty Steps']],
      ['The Shingle Beach', ['The Landing']],
    ]);
    expect(departAreaName([isle, harbour, jetty, steps], steps)).toBe('The Drowned Harbour');
    expect(departAreaName([isle, harbour, room], room)).toBeNull();
  });

  // Purpose: a Location with no Area above it heads its group with the nearest place above it, else the pack's name;
  // packs with no Locations give no groups (the sheet then keeps today's picker); a loop in a pack ends the walk.
  it('falls back to the place above, then the pack, and gives nothing without Locations', () => {
    const cove = place('cove', 'Smugglers’ Cove', 'area', 'isle');
    expect(departLocationGroups([isle, cove, lone]).map((g) => [g.name, g.locations.map((p) => p.name)])).toEqual([
      ['Saltwick Island', ['Smugglers’ Cove']],
      ['Saltwick Isle', ['The Lone Rock']],
    ]);
    expect(departLocationGroups([isle, harbour, room, hex])).toEqual([]);
    expect(departLocationGroups([])).toEqual([]);
    const a = place('a', 'Loop A', 'area', 'b');
    const b = place('b', 'Loop B', 'site', 'a');
    // The loop's places are no pack's roots, so the walk never reaches them; the rest still lists, and nothing hangs.
    expect(departLocationGroups([a, b, anchorage]).flatMap((g) => g.locations.map((p) => p.name))).toEqual(['The Anchorage']);
  });
});

describe("a player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8)", () => {
  // Purpose: the Light pop-up lists each lit light with the time it has left, a light that never runs out by its name
  // alone, a group in the dark as "No light." and one with nothing lit as "Nothing lit."; groups are named only where
  // the player has more than one.
  it('says each light and its time left, the dark and nothing lit', () => {
    const lit = { group: 1, name: 'Group 1', dark: false, lights: [{ name: 'Ash’s torch', stepsLeft: 4 }, { name: 'Glow-worm jar', stepsLeft: null }] };
    expect(lightSheetLines([lit], 'turn')).toEqual([
      { label: 'Ash’s torch.', words: '4 turns left.' },
      { label: 'Glow-worm jar.', words: '' },
    ]);
    expect(lightSheetLines([{ group: 1, name: 'Group 1', dark: true, lights: [] }], 'turn')[0]!.label).toBe('No light.');
    expect(lightSheetLines([lit, { group: 2, name: 'Group 2', dark: false, lights: [] }], 'turn').map((l) => l.label)).toEqual(['Group 1: Ash’s torch.', 'Group 1: Glow-worm jar.', 'Group 2: Nothing lit.']);
  });

  // Purpose (the audit of #86, Francis's pick 5): a group in the dark reads "No light." then "Nobody in the group has a
  // light lit, so they are in darkness. Light one from a pack.", with no bracket after it.
  it.fails('says the dark in plain words, with no bracket', () => {
    expect(lightSheetLines([{ group: 1, name: 'Group 1', dark: true, lights: [] }], 'turn')).toEqual([
      { label: 'No light.', words: 'Nobody in the group has a light lit, so they are in darkness. Light one from a pack.' },
    ]);
  });

  // Purpose: the Rest pop-up says when the next rest falls, whole; the small line that only repeats the rule is left
  // to "The rule", and one that says more ("You pushed on.") stays.
  it('says when the next rest falls', () => {
    const rule = 'One turn in six.';
    expect(restSheetLines(restFact({ groups: [{ group: 1, name: 'Group 1', open: false, stepsLeft: 4 }], ruleWords: rule, stepWord: 'turn', day: false })!, rule)).toEqual([{ label: 'Next.', words: 'In 4 turns.' }]);
    expect(restSheetLines(restFact({ groups: [{ group: 1, name: 'Group 1', open: false, stepsLeft: 4 }], ruleWords: rule, stepWord: 'turn', day: false, pushedOn: true })!, rule)).toEqual([{ label: 'Next.', words: 'Rest due. You pushed on.' }]);
  });

  // Purpose: the Encounter check pop-up says when it is rolled and its chance; a check with no chance has no chance line.
  it('says when the check is rolled and its chance', () => {
    const fact = checkFact({ name: null, eachMove: true, every: null, chance: { die: 'd6', on: [1] }, fallbackUnit: 'turn' });
    expect(checkSheetLines(fact)).toEqual([
      { label: 'When.', words: 'On every move.' },
      { label: 'Chance.', words: '1 in 6.' },
    ]);
    expect(checkSheetLines(checkFact({ name: null, eachMove: true, every: null, chance: null, fallbackUnit: 'turn' }))).toHaveLength(1);
  });

  // Purpose: a rule shows the pack's words and then its page as the setting's; with no words there is no rule at all,
  // not even a source line.
  it('ends a rule with its source, and has none without words', () => {
    expect(settingRule(['The party rests one turn in every six.'], 'Fen Rules, p. 50')).toEqual([
      { kind: 'p', lead: '', text: 'The party rests one turn in every six.' },
      { kind: 'source', text: 'From your setting: Fen Rules, p. 50' },
    ]);
    expect(settingRule([null], 'Fen Rules, p. 50')).toEqual([]);
  });

  // Purpose: the check's words a player reads are the note of the procedure step that runs it, and only while the rules
  // set opens its procedures to players; the check's own note (the GM's) is never among them.
  it('reads the check step’s words only where the procedures are open to players', () => {
    const [mode] = readExploration([
      {
        exploration: {
          playerReadable: true,
          modes: [
            {
              id: 'creep',
              name: 'Creeping',
              step: { value: 1, unit: 'turn' },
              procedure: [{ id: 'wander-step', name: 'Wandering', kind: 'check', checkId: 'wander', note: 'The GM rolls for what wanders the fen.', source: 'Fen Rules, p. 40' }],
              checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, note: 'Only the GM reads this.' }],
            },
          ],
        },
      },
    ]).modes;
    expect(checkRule(mode!, 'wander', true)).toEqual([
      { kind: 'p', lead: '', text: 'The GM rolls for what wanders the fen.' },
      { kind: 'source', text: 'From your setting: Fen Rules, p. 40' },
    ]);
    expect(checkRule(mode!, 'wander', false)).toEqual([]);
    expect(JSON.stringify(checkRule(mode!, 'wander', true))).not.toContain('Only the GM');
  });
});
