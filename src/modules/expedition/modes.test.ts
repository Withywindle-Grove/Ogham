// Reading exploration modes in the G-07 shapes (docs/07 "Exploration"). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { fenRules, plainRules } from './fixtures.ts';
import { usableHere } from './activities.ts';
import { readDungeonExit } from './dungeonExit.ts';
import { campOf, FALLBACK_MODES, isPointToPoint, methodsOf, modeById, optionOn, optionSpecOf, pointToPoint, POINT_TO_POINT_ID, readCheck, readExploration, terrainOf } from './modes.ts';

const fen = readExploration([plainRules, fenRules]);
const creep = modeById(fen.modes, 'creep')!;
const roam = modeById(fen.modes, 'roam')!;
const town = modeById(fen.modes, 'town')!;

describe('the plain fallbacks', () => {
  it('with no attached pack defining modes, the app offers Dungeon (turn by turn) and Wilderness (day by day), with no checks', () => {
    const plain = readExploration([plainRules]);
    expect(plain.fallback).toBe(true);
    expect(plain.modes.map((m) => [m.id, m.pace, m.step, m.checks.length, m.rest])).toEqual([
      ['dungeon', 'turn', { value: 1, unit: 'turn' }, 0, null],
      ['wilderness', 'day', { value: 1, unit: 'day' }, 0, null],
    ]);
    expect(readExploration([]).modes).toEqual([...FALLBACK_MODES]);
  });

  it('nothing a pack writes makes reading fail: broken exploration sections give the fallbacks', () => {
    for (const broken of [{ exploration: null }, { exploration: 'modes' }, { exploration: { modes: 'all' } }, { exploration: { modes: [null, 3, { id: 'x' }] } }]) {
      expect(readExploration([broken]).fallback).toBe(true);
    }
  });
});

describe('reading modes (G-07)', () => {
  it('reads the good modes and leaves out ones with no id or step; turn and day pace come from the step', () => {
    expect(fen.fallback).toBe(false);
    expect(fen.modes.map((m) => [m.id, m.pace])).toEqual([
      ['creep', 'turn'],
      ['roam', 'day'],
      ['town', 'day'],
    ]);
    expect(fen.playerReadable).toBe(true);
    expect(fen.note).toBe('Exploration in the fens.');
  });

  it('the old "dungeon" and "wilderness" values read as the first turn-by-turn and day-by-day modes', () => {
    expect(modeById(fen.modes, 'dungeon')?.id).toBe('creep');
    expect(modeById(fen.modes, 'wilderness')?.id).toBe('roam');
    expect(modeById(fen.modes, 'nowhere')).toBeNull();
  });

  it('procedure steps: free text is note with notes as an alias; an unknown symbol is the plain dot; an unknown kind is left out', () => {
    expect(creep.procedure.map((s) => [s.id, s.kind, s.icon])).toEqual([
      ['wander', 'check', 'monster'],
      ['listen', 'note', 'listen'],
      ['odd', 'note', 'dot'],
      ['tick', 'auto', 'time'],
    ]);
    expect(creep.procedure[1]!.note).toBe('Quiet line from the notes alias.');
  });

  it('checks: onHit shapes, byTerrain, when, modifiers from the fixed list (others left out), and byTrack', () => {
    const astray = roam.checks.find((c) => c.id === 'roam-astray')!;
    expect(astray).toMatchObject({ when: 'start', byTerrain: true, onHit: { tableId: 'roam-astray-result', tableChoices: [], columns: [], regionTables: false } });
    expect(astray.modifiers.map((m) => m.kind)).toEqual(['weatherTag', 'routeType', 'routeType']);
    expect(creep.checks[0]!.onHit).toMatchObject({ tableId: null, tableChoices: ['creep-shallow', 'creep-deep'], note: 'Pick by depth.' });
    const heron = roam.checks.find((c) => c.id === 'roam-heron')!;
    expect(heron).toMatchObject({ chance: null, onHit: { tableId: 'heron-omens' } });
    expect(heron.modifiers).toEqual([{ kind: 'track', trackId: 'flood', min: 3, max: 5, chance: { die: 'd6', on: [1, 2, 3] }, add: 0, note: null }]);
    expect(roam.checks.find((c) => c.id === 'roam-night')!.onHit).toMatchObject({ tableId: null, note: 'Something circles the fire.' });
  });

  it('terrain takes its class numbers unless it gives its own; both shapes are valid; a terrain with no id is left out', () => {
    expect(terrainOf(roam, 'meadow')).toMatchObject({ classId: 'soft', cost: 2, lostChance: [1], wanderChance: [1], mounts: 'ride', vehicles: true });
    expect(terrainOf(roam, 'marsh')).toMatchObject({ cost: 3, lostChance: [1, 2], encounterColumn: 'Marsh', note: 'Sucking mud.', mounts: 'none' });
    expect(terrainOf(roam, 'scrub')).toMatchObject({ classId: null, cost: 4, lostChance: [1, 2, 3], encounterTableId: 'scrub-beasts' });
    expect(roam.terrain).toHaveLength(3);
  });

  it('rest: null means no rest; other defaults to true; camp.sameAs reuses another mode’s camp, keeping its own note', () => {
    expect(town.rest).toBeNull();
    expect(town.other).toBe(false);
    expect(creep.other).toBe(true);
    expect(creep.rest).toMatchObject({ every: { value: 5, unit: 'turn' }, condition: 'weary' });
    const camp = campOf(creep, fen.modes)!;
    expect(camp.procedure.map((s) => s.id)).toEqual(['setup', 'watches', 'night', 'sleep']);
    expect(camp.note).toBe('Camp as in the open, quietly.');
    const sleep = campOf(roam, fen.modes)!.procedure[3]!;
    expect(sleep).toMatchObject({ checkAbility: 'CON', onGoodRest: [{ heal: 1 }], onBadRest: [{ condition: 'weary' }] });
  });

  it('a camp naming itself, or a missing mode, gives just the note (no loop)', () => {
    const loop = { ...creep, camp: { procedure: [], quickOption: null, note: 'Here.', sameAs: 'creep' } };
    expect(campOf(loop, fen.modes)).toMatchObject({ procedure: [], note: 'Here.' });
  });

  it('activities: the G-07 shapes are read and the replaced ones ignored', () => {
    const old = creep.activities.find((a) => a.id === 'old-search')!;
    expect(old).toMatchObject({ cost: null, tableId: null, modifiers: [], requires: { skill: null, item: null } });
    expect(creep.activities.find((a) => a.id === 'pry-lid')).toMatchObject({ chance: { abilityCheck: 'STR' }, requires: { skill: 'pry', item: 'crowbar' }, onlyIn: ['creep'] });
    expect(roam.activities.find((a) => a.id === 'gather-reeds')).toMatchObject({ cost: { fromTerrain: 'searchCost' }, maxActors: 3, bestOf: true, modifiers: [{ when: 'fullDay', add: 1 }] });
    expect(roam.activities.find((a) => a.id === 'forage')!.bySeason).toEqual({ dry: '1 meal' });
  });

  it('seasons, special seasons (encounterSwap singular; the old plural ignored), the default weather and wild encounters', () => {
    expect(fen.seasons.map((s) => s.id)).toEqual(['wet', 'dry']);
    expect(fen.specialSeasons.map((s) => [s.id, s.encounterSwap?.tableId ?? null])).toEqual([
      ['gloaming', 'gloam-things'],
      ['mistwane', null],
      ['old-swaps', null],
    ]);
    expect(fen.weather).toMatchObject({ rollEvery: { value: 1, unit: 'day' }, onlyWithOption: 'weather-rules', tables: { any: 'weather-any' } });
    expect(fen.wildEncounters?.regionalTables).toEqual({ 'Fen Reach': 'fen-reach-beasts' });
  });

  it('when two packs define modes, the GM picks one pack’s modes, all or nothing', () => {
    const other = { exploration: { modes: [{ id: 'skulk', name: 'Skulking', step: { value: 1, unit: 'turn' } }] } };
    expect(readExploration([fenRules, other]).modes.map((m) => m.id)).toEqual(['skulk']);
    expect(readExploration([fenRules, other], 0).modes.map((m) => m.id)).toEqual(['creep', 'roam', 'town']);
  });

  it('onlyWithOption: "<option>" means its on choice; "<option>:<choice>" that choice', () => {
    expect(optionOn('weather-rules', { 'weather-rules': 'on' })).toBe(true);
    expect(optionOn('weather-rules', { 'weather-rules': 'off' })).toBe(false);
    expect(optionOn('exit:escape', { exit: 'escape' })).toBe(true);
    expect(optionOn(null, {})).toBe(true);
  });

  // Purpose: `option` is the one name for "only when this optional rule is on" (07, G-40, ruled 2026-11-01), with the
  // older `onlyWithOption` still read as its alias, on checks, activities, the weather block and the dungeon exit,
  // so a pack written either way works the same.
  it('reads option ("<option>[=<choice>]") and the older onlyWithOption alias the same way; option wins when both are given', () => {
    expect(optionSpecOf({ option: 'eels' })).toBe('eels');
    expect(optionSpecOf({ option: ' eels=thick ' })).toBe('eels:thick');
    expect(optionSpecOf({ onlyWithOption: 'eels:thick' })).toBe('eels:thick');
    expect(optionSpecOf({ option: 'eels', onlyWithOption: 'other' })).toBe('eels');
    expect(optionSpecOf({ option: ' ', onlyWithOption: '' })).toBeNull();
    expect(readCheck({ id: 'c', name: 'Gutter', chance: { die: 'd6', on: [1] }, option: 'mire-adversity=on' })!.onlyWithOption).toBe('mire-adversity:on');
    const read = readExploration([
      {
        weather: { tables: { any: 'fen-sky' }, option: 'weather-rules' },
        exploration: { modes: [{ id: 'trudge', name: 'Trudging', step: { value: 1, unit: 'day' }, activities: [{ id: 'eel-run', name: 'Eel run', option: 'eels=thick' }] }] },
      },
    ]);
    expect(read.weather!.onlyWithOption).toBe('weather-rules');
    const eelRun = read.modes[0]!.activities.find((a) => a.id === 'eel-run')!;
    expect(eelRun.onlyWithOption).toBe('eels:thick');
    expect(usableHere(eelRun, read.modes[0]!, { choices: { eels: 'thick' } })).toBe(true);
    expect(usableHere(eelRun, read.modes[0]!, { choices: { eels: 'on' } })).toBe(false);
    expect(readDungeonExit([{ dungeonExit: { roll: { check: 'wits' }, option: 'exit=escape' } }], { exit: 'off' })).toBeNull();
    expect(readDungeonExit([{ dungeonExit: { roll: { check: 'wits' }, option: 'exit=escape' } }], { exit: 'escape' })).not.toBeNull();
  });
});

// Point to point (plan scene-point-to-point, piece B8; p2p-6, ruled 2026-11-18): a third exploration method, the app's
// own, beside whatever modes the campaign has. Invented modes only.
describe('point to point, the app’s own method (p2p-6)', () => {
  // Purpose: point to point is offered beside a rules set's modes, after them, and every one of those modes is still there.
  it('is offered beside a rules set’s modes, after them', () => {
    expect(methodsOf(fen.modes).map((m) => [m.id, m.name])).toEqual([
      ['creep', 'Creeping'],
      ['roam', 'Roaming'],
      ['town', 'In town'],
      [POINT_TO_POINT_ID, 'Point to point'],
    ]);
    // The campaign's own modes are untouched: it is offered beside them, not among them.
    expect(fen.modes.map((m) => m.id)).toEqual(['creep', 'roam', 'town']);
    expect(methodsOf(methodsOf(fen.modes)).filter(isPointToPoint)).toHaveLength(1);
  });

  // Purpose: with no pack defining modes, point to point is offered beside the plain Dungeon and Wilderness.
  it('is offered beside the plain fallbacks too', () => {
    expect(methodsOf(readExploration([plainRules]).modes).map((m) => m.id)).toEqual(['dungeon', 'wilderness', POINT_TO_POINT_ID]);
  });

  // Purpose: point to point never shadows a rules set's mode: each still reads by its own id, the old "dungeon" and
  // "wilderness" values still read as the set's own first turn and day modes, and a mode a pack names "Point to point"
  // under its own id stays that pack's mode.
  it('never shadows a rules set’s mode', () => {
    const methods = methodsOf(fen.modes);
    expect(['creep', 'roam', 'town'].map((id) => modeById(methods, id)?.id)).toEqual(['creep', 'roam', 'town']);
    expect(modeById(methods, 'dungeon')?.id).toBe('creep');
    expect(modeById(methods, 'wilderness')?.id).toBe('roam');
    // A setting with no turn-by-turn mode: the old "dungeon" value finds none, never point to point.
    const dayOnly = readExploration([{ exploration: { modes: [{ id: 'trudge', name: 'Trudging', step: { value: 1, unit: 'day' } }] } }]).modes;
    expect(modeById(methodsOf(dayOnly), 'dungeon')).toBeNull();
    const hop = readExploration([{ exploration: { modes: [{ id: 'hop', name: 'Point to point', step: { value: 1, unit: 'hour' }, rest: { every: { value: 9, unit: 'hour' } } }] } }]).modes;
    expect(modeById(hop, 'hop')).toMatchObject({ id: 'hop', name: 'Point to point', rest: { every: { value: 9, unit: 'hour' } } });
    expect(methodsOf(hop).map((m) => m.id)).toEqual(['hop', POINT_TO_POINT_ID]);
  });

  // Purpose: a rules set can't take the app's id for a mode of its own, so nothing a pack writes stands in for point to
  // point: such a mode is left out like any other the app can't read, and the set's other modes are kept.
  it('is never shadowed by a rules set’s mode: a mode written with the app’s id is left out', () => {
    const cuckoo = { id: POINT_TO_POINT_ID, name: 'Cuckoo', step: { value: 1, unit: 'day' }, checks: [{ id: 'peck', name: 'Pecking' }] };
    const read = readExploration([{ exploration: { modes: [cuckoo, { id: 'App:Other', step: { value: 1, unit: 'turn' } }, { id: 'wade', name: 'Wading', step: { value: 1, unit: 'turn' } }] } }]);
    expect(read.modes.map((m) => m.id)).toEqual(['wade']);
    expect(modeById(read.modes, POINT_TO_POINT_ID)).toMatchObject({ name: 'Point to point', checks: [] });
    // A set whose only mode takes the app's id has no modes the app can read: the plain fallbacks stand.
    expect(readExploration([{ exploration: { modes: [cuckoo] } }]).fallback).toBe(true);
  });

  // Purpose: an expedition started in point to point stores its id, and that id reads back as point to point whatever
  // modes the campaign has, the same mode each time it is asked for (so a screen doesn't see a new one on every read).
  it('reads back from the id an expedition stores, whatever the campaign’s modes', () => {
    const stored = POINT_TO_POINT_ID;
    expect(stored).toBe('app:point-to-point');
    for (const modes of [fen.modes, readExploration([plainRules]).modes, FALLBACK_MODES, []]) {
      const mode = modeById(modes, stored)!;
      expect(isPointToPoint(mode)).toBe(true);
      expect(mode.name).toBe('Point to point');
      expect(modeById(modes, stored)).toBe(mode);
    }
    expect(isPointToPoint(stored)).toBe(true);
    expect([isPointToPoint('creep'), isPointToPoint(creep), isPointToPoint(null)]).toEqual([false, false, false]);
  });

  // Purpose: one step of point to point is one unit of the place's ways, a turn where none is given; a unit of turns
  // makes it turn by turn, any longer unit day by day, as for a rules set's mode.
  it('takes its step’s unit from what the place gives, a turn where it gives none', () => {
    expect(pointToPoint(fen.modes)).toMatchObject({ step: { value: 1, unit: 'turn' }, pace: 'turn' });
    expect(pointToPoint(fen.modes, 'hour')).toMatchObject({ step: { value: 1, unit: 'hour' }, pace: 'day' });
    expect(pointToPoint(fen.modes, 'day')).toMatchObject({ step: { value: 1, unit: 'day' }, pace: 'day' });
    expect(pointToPoint(fen.modes, 'hour')).toBe(pointToPoint(fen.modes, 'hour'));
  });

  // Purpose: it brings no rules of its own: no check (the place's own check runs), no terrain, no activity and no
  // weather block, and it is not one of the plain fallbacks (what it borrows is the setting's, so players read its
  // procedure only where they may read the setting's).
  it('has no check, terrain, activity or weather of its own, and is not a plain fallback', () => {
    expect(pointToPoint(fen.modes)).toMatchObject({ checks: [], terrain: [], activities: [], weather: null, fallback: false });
    expect(pointToPoint(fen.modes).procedure.map((s) => [s.id, s.kind])).toEqual([['time', 'auto']]);
  });

  // Purpose: rest and camp keep running by the setting's rules for the unit of time: by turns, the setting's
  // turn-by-turn mode's; by days, its day-by-day mode's; a mode with that very unit comes before one of the same pace;
  // a setting with no rule for it gives none.
  it('keeps the setting’s rest and camp for its unit of time', () => {
    expect(pointToPoint(fen.modes, 'turn').rest).toEqual(creep.rest);
    expect(pointToPoint(fen.modes, 'turn').camp).toEqual(creep.camp);
    expect(campOf(pointToPoint(fen.modes, 'turn'), fen.modes)).toEqual(campOf(creep, fen.modes));
    expect(pointToPoint(fen.modes, 'day').rest).toEqual(roam.rest);
    expect(campOf(pointToPoint(fen.modes, 'day'), fen.modes)).toEqual(campOf(roam, fen.modes));
    // An hour is day by day: with no mode stepped by the hour, the first day-by-day mode's rule.
    expect(pointToPoint(fen.modes, 'hour').rest).toEqual(roam.rest);
    // A mode with the very unit comes before an earlier one that only shares its pace.
    const byHour = readExploration([
      {
        exploration: {
          modes: [
            { id: 'trudge', name: 'Trudging', step: { value: 1, unit: 'day' }, rest: { every: { value: 6, unit: 'day' } } },
            { id: 'punt', name: 'Punting', step: { value: 1, unit: 'hour' }, rest: { every: { value: 8, unit: 'hour' } } },
          ],
        },
      },
    ]).modes;
    expect(pointToPoint(byHour, 'hour').rest?.every).toEqual({ value: 8, unit: 'hour' });
    expect(pointToPoint(byHour, 'turn')).toMatchObject({ rest: null, camp: null });
    expect(pointToPoint(FALLBACK_MODES)).toMatchObject({ rest: null, camp: null });
  });

  // Purpose: the town's own way (a mode stepped by the part of the day) never lends its rest or camp to point to
  // point, even when it comes before the wilderness mode: the road's rule is the day-by-day mode's, and a setting
  // with only a town way gives none. Invented modes: "Market rounds" by parts of the day, "Trudging" by days.
  it('never takes the town way’s rest or camp', () => {
    const rounds = { id: 'rounds', name: 'Market rounds', step: { value: 1, unit: 'partOfDay' }, rest: { every: { value: 2, unit: 'day' } }, camp: { note: 'A bed at the inn.' } };
    const trudge = { id: 'trudge', name: 'Trudging', step: { value: 1, unit: 'day' }, rest: { every: { value: 6, unit: 'day' } }, camp: { note: 'A dry hummock.' } };
    const townFirst = readExploration([{ exploration: { modes: [rounds, trudge] } }]).modes;
    expect(townFirst.map((m) => [m.id, m.pace])).toEqual([['rounds', 'day'], ['trudge', 'day']]);
    for (const unit of ['day', 'hour', 'partOfDay', 'partsOfDay']) {
      expect(pointToPoint(townFirst, unit).rest?.every).toEqual({ value: 6, unit: 'day' });
      expect(pointToPoint(townFirst, unit).camp?.note).toBe('A dry hummock.');
    }
    const townOnly = readExploration([{ exploration: { modes: [rounds] } }]).modes;
    expect(pointToPoint(townOnly, 'day')).toMatchObject({ rest: null, camp: null });
  });
});

describe('the older onHit.column (ruled 2026-10-29: the importer reads it as columns)', () => {
  it('reads column: "a|b" as columns ["a", "b"], so old and homebrew packs keep working; columns wins when both are given', () => {
    expect(readCheck({ id: 'c', name: 'Road or wild', onHit: { tableId: 'reed-things', column: 'road|wild' } })!.onHit.columns).toEqual(['road', 'wild']);
    expect(readCheck({ id: 'c', name: 'One column', onHit: { column: ' road ' } })!.onHit.columns).toEqual(['road']);
    expect(readCheck({ id: 'c', name: 'Both', onHit: { column: 'road|wild', columns: ['marsh'] } })!.onHit.columns).toEqual(['marsh']);
    expect(readCheck({ id: 'c', name: 'Neither', onHit: { tableId: 'reed-things' } })!.onHit.columns).toEqual([]);
  });
});
