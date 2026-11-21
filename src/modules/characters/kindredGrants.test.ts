// Kindred-classes and kindred grants (M5b creation survey, PR 2; design/rulings/m5b-0c-creation-survey-2026-11-03.md
// cs-2, cs-4), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json, changed here where a test needs
// a grant or a binding. Every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { classKindredId, classLevelCap, kindredOf, offeredToKindred, raceAsPlayed, raceDataAsPlayed, replacesKindredTraits } from './creation.ts';
import { allGiven, bookOf, firstSpellsHint, firstSpellsPlan, firstSpellsProblem, fromWords, rollRows, tapProblem, tapped, NO_PICKS } from './firstSpells.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { races: Entry[]; classes: Entry[]; spells: Entry[]; spellLists: Entry[]; tables: Entry[] };
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e as Record<string, unknown> });
const raceOf = (id: string, extra: Record<string, unknown> = {}) => entry({ ...pack.races.find((r) => r.id === id)!, ...extra });
const classOf = (id: string, extra: Record<string, unknown> = {}) => entry({ ...pack.classes.find((c) => c.id === id)!, ...extra });
const setting = { spells: pack.spells.map(entry), lists: pack.spellLists.map(entry), tables: pack.tables.map(entry), choices: {} };

// The fixture's kin calling bound to bog folk, with its own traits and its own roll (cs-4, cs-2).
const bogKin = () =>
  classOf('bog-kin-calling', {
    race: 'bog-folk',
    replacesRaceTraits: true,
    abilities: [{ name: 'Mud wise', note: 'Reads the bog like a page.', kind: 'advantage' }],
    spellcasting: { listId: 'witch-list', fromLevel: 1, firstSpells: { rollTable: 'first-whispers' } },
  });
// Bog folk granting a roll on First charms and a reed bundle (cs-2).
const bogFolk = () => raceOf('bog-folk', { firstSpells: { rollTable: 'first-charms', note: 'One charm, on top of what the class gives.' }, startingItems: ['reed-bundle'] });

describe('a kindred-class bound to its kindred (cs-4)', () => {
  it('names its kindred; an ordinary class names none', () => {
    expect(classKindredId(bogKin().data)).toBe('bog-folk');
    expect(classKindredId(classOf('lantern-warden').data)).toBe('');
  });

  it('is listed only under its own kindred, or when no kindred is picked (the kindred-as-class path)', () => {
    expect(offeredToKindred(bogKin(), bogFolk())).toBe(true);
    expect(offeredToKindred(bogKin(), raceOf('stone-kin'))).toBe(false);
    expect(offeredToKindred(bogKin(), null)).toBe(true);
    expect(offeredToKindred(classOf('lantern-warden'), raceOf('stone-kin'))).toBe(true);
  });

  it('sets the kindred when picked; an ordinary class keeps the kindred picked', () => {
    const races = [bogFolk(), raceOf('stone-kin')];
    expect(kindredOf(bogKin().data, null, races)?.packEntryId).toBe('bog-folk');
    expect(kindredOf(classOf('lantern-warden').data, races[1]!, races)?.packEntryId).toBe('stone-kin');
    expect(kindredOf(classOf('lantern-warden').data, null, races)).toBeNull();
  });

  it("replaces the kindred's traits: the kindred keeps its name, languages and size, not its abilities, score changes, grants or class limits", () => {
    const played = raceAsPlayed(bogFolk(), bogKin())!;
    expect(played.name).toBe('Bog folk');
    expect(played.data.languages).toEqual(['fen-common', 'deep-croak']);
    for (const trait of ['abilities', 'abilityModifiers', 'skillTargets', 'firstSpells', 'startingItems', 'classMaxLevels', 'requirements']) expect(played.data).not.toHaveProperty(trait);
  });

  it("keeps the kindred's traits for an ordinary class, on another kindred, and when the class says replacesRaceTraits: false", () => {
    expect(raceAsPlayed(bogFolk(), classOf('lantern-warden'))!.data.abilities).toBeDefined();
    expect(raceAsPlayed(raceOf('stone-kin'), bogKin())!.data.abilities).toBeDefined();
    expect(replacesKindredTraits({ ...bogKin().data, replacesRaceTraits: false }, 'bog-folk')).toBe(false);
    // A class naming its kindred without the field replaces them (a race-as-class is the kindred as a class).
    expect(replacesKindredTraits({ race: 'bog-folk' }, 'bog-folk')).toBe(true);
    expect(raceDataAsPlayed(null, 'bog-folk', bogKin().data)).toBeNull();
  });

  it("a kindred-class's level cap is its own: its kindred's class table doesn't close it", () => {
    // Bog folk's table doesn't list a class called this (left out = closed); played as its own kindred, it doesn't apply.
    const kin = classOf('bog-kin-calling', { race: 'bog-folk', id: 'bog-kin-calling' });
    const folk = raceOf('bog-folk', { classMaxLevels: { 'lantern-warden': 8 } });
    expect(classLevelCap(kin, raceAsPlayed(folk, kin))).toBe(8);
  });
});

describe("the kindred's grants, added to the class's (cs-2)", () => {
  it("a caster whose kindred grants a roll gets both, the kindred's after the class's, each labelled with its source", () => {
    const plan = firstSpellsPlan(classOf('reed-witch'), 1, setting, bogFolk())!;
    expect(plan.rolls.map((g) => [g.from, g.table])).toEqual([
      ['class', 'first-whispers'],
      ['kindred', 'first-charms'],
    ]);
    expect(plan.fromKindred).toBe(true);
    expect(plan.kindredNote).toBe('One charm, on top of what the class gives.');
    expect(fromWords(plan, 'kindred', 'First charms: roll d2')).toBe('From your kindred, first charms: roll d2');
    expect(fromWords(plan, 'class', 'Pick 2')).toBe('From your class, pick 2');
  });

  it('a class that casts nothing gets the step for its kindred’s grant alone (an elf fighter)', () => {
    const plan = firstSpellsPlan(classOf('lantern-warden'), 1, setting, bogFolk())!;
    expect(plan).not.toBeNull();
    expect(plan.rolls.map((g) => g.tableId)).toEqual(['kindred:first-charms']);
    expect(plan.magic).toBe(true);
    expect(firstSpellsProblem(plan, NO_PICKS)).toBe('Roll d2 at the table, then tap what it shows');
    const row = rollRows(plan).find((r) => r.result === 'Mire grip')!;
    const picks = tapped(NO_PICKS, 'roll', row.key);
    expect(bookOf(plan, picks)).toEqual(['mire-grip']);
    expect(firstSpellsHint(plan, picks)).toBe('All picked: 1 yours');
  });

  it('without a kindred grant nothing changes: no source words, no step for a non-caster', () => {
    const plan = firstSpellsPlan(classOf('reed-witch'), 1, setting, raceOf('bog-folk'))!;
    expect(plan.fromKindred).toBe(false);
    expect(fromWords(plan, 'class', 'Pick 2')).toBe('Pick 2');
    expect(firstSpellsPlan(classOf('lantern-warden'), 1, setting, raceOf('bog-folk'))).toBeNull();
  });

  it('a kindred and its class rolling on the same table are two rolls (an elf enchanter’s two glamours)', () => {
    const race = raceOf('bog-folk', { firstSpells: { rollTable: 'first-whispers' } });
    const plan = firstSpellsPlan(classOf('reed-witch'), 1, setting, race)!;
    expect(plan.rolls.map((g) => g.tableId)).toEqual(['first-whispers', 'kindred:first-whispers']);
    const classRow = rollRows(plan).find((r) => r.tableId === 'first-whispers' && r.result === 'Mire grip')!;
    const kindredRow = rollRows(plan).find((r) => r.tableId === 'kindred:first-whispers' && r.result === 'Reed whisper')!;
    const picks = tapped(tapped({ ...NO_PICKS, chosen: ['damp-wick', 'glimmer'] }, 'roll', classRow.key), 'roll', kindredRow.key);
    expect(picks.rolled).toEqual({ 'first-whispers': classRow.key, 'kindred:first-whispers': kindredRow.key });
  });

  it("a kindred's given spells are their own group, and a tap says they come from the kindred", () => {
    const race = raceOf('bog-folk', { firstSpells: { given: ['frog-chorus'] } });
    const plan = firstSpellsPlan(classOf('lantern-warden'), 1, setting, race)!;
    expect(plan.given).toEqual([]);
    expect(allGiven(plan).map((s) => s.id)).toEqual(['frog-chorus']);
    expect(tapProblem(plan, NO_PICKS, 'given', 'frog-chorus')).toBe('Given by your kindred: always yours.');
    // Its level is read from any list (a kindred's spells are on no class list).
    expect(plan.kindredGiven[0]!.level).toBe(0);
  });

  it("a kindred-class's own kindred grants nothing beside it: the race is read as played (cs-4)", () => {
    const plan = firstSpellsPlan(bogKin(), 1, setting, raceAsPlayed(bogFolk(), bogKin()))!;
    expect(plan.rolls.map((g) => g.tableId)).toEqual(['first-whispers']);
    expect(plan.fromKindred).toBe(false);
    // A kindred-class's magic is data like any class's, rolled the same way; with no `type` it is named Magic.
    expect(plan.magic).toBe(true);
  });

  it('a spell book (type book) is not named Magic', () => {
    expect(firstSpellsPlan(classOf('reed-witch'), 1, setting)!.magic).toBe(false);
  });
});
