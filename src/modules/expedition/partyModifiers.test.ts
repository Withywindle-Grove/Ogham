// Modifiers keyed to the party (ruled 2026-11-03, ex-2 and ga-3; plan m5b-area-2-app build order 1). Invented names.
import { describe, expect, it } from 'vitest';
import { activityModifierWords, rollPlan, type ActorFacts } from './activities.ts';
import { modifierWords } from './card.ts';
import { checkPrompt } from './checks.ts';
import { readCheck, readMode, type Terrain } from './modes.ts';
import { readPartyCondition, type PartyMember } from './partyModifiers.ts';

const terrain = (id: string, lostChance: number[], classId: string | null = null): Terrain => ({
  id,
  name: id,
  cost: 2,
  searchCost: null,
  lostChance,
  wanderChance: [1],
  mounts: null,
  vehicles: null,
  classId,
  encounterTableId: null,
  encounterColumn: null,
  note: null,
});
const reedbed = terrain('reedbed', [1, 2, 3]);
const sedge = terrain('sedge', [1, 2]);
const willowCarr = terrain('willow-carr', [1, 2, 3], 'reedbed');

const member = (id: string, name: string, classId: string | null, className: string | null, skills: [string, string][] = []): PartyMember => ({ id, name, classId, className, skills: new Map(skills) });
const tam = member('tam', 'Tam', 'lantern-warden', 'Lantern Warden', [['wade', 'Wade']]);
const wren = member('wren', 'Wren', 'reed-witch', 'Reed Witch');
const ash = member('ash', 'Ash', 'mire-stalker', 'Mire Stalker');

const astray = readCheck({
  id: 'fen-astray',
  name: 'Going astray',
  chance: { die: 'd6', on: [1] },
  byTerrain: true,
  terrainChance: 'lostChance',
  modifiers: [
    { routeType: 'causeway', never: true },
    { ifPartyHas: { class: 'reed-witch' }, chance: { on: [1] }, onlyOnTerrain: ['reedbed'], note: 'Reed-reading.' },
  ],
  onHit: { note: 'The GM picks the real direction.' },
})!;

describe('reading modifiers keyed to the party', () => {
  it('a check modifier with ifPartyHas, chance and onlyOnTerrain is read as a party modifier', () => {
    expect(astray.modifiers[1]).toEqual({
      kind: 'party',
      when: { ifPartyHas: { class: 'reed-witch' }, who: null, ifClass: null, onlyOnTerrain: ['reedbed'] },
      add: 0,
      chance: { die: null, on: [1] },
      note: 'Reed-reading.',
    });
  });

  it('a party modifier with neither add nor chance, or onlyOnTerrain alone, is left out', () => {
    const check = readCheck({ id: 'x', chance: { die: 'd6', on: [1] }, modifiers: [{ ifPartyHas: { class: 'reed-witch' } }, { onlyOnTerrain: ['bog'], add: 1 }] })!;
    expect(check.modifiers).toEqual([]);
    expect(readPartyCondition({ who: 'self', ifClass: 'mire-stalker' })).toEqual({ ifPartyHas: null, who: 'self', ifClass: 'mire-stalker', onlyOnTerrain: [] });
  });

  it("an activity's party modifier is read beside the pack's plain { when, add } ones", () => {
    const mode = readMode({
      id: 'trek',
      name: 'Trek',
      step: { value: 1, unit: 'day' },
      activities: [{ id: 'cut', name: 'Cut reeds', chance: { abilityCheck: 'WIT' }, modifiers: [{ when: 'fullDay', add: 1 }, { who: 'self', ifClass: 'reed-witch', add: 1 }] }],
    })!;
    expect(mode.activities[0]!.modifiers).toEqual([
      { when: 'fullDay', add: 1, note: null },
      { when: '', add: 1, note: null, party: { ifPartyHas: null, who: 'self', ifClass: 'reed-witch', onlyOnTerrain: [] }, chance: null },
    ]);
  });
});

describe('a check with modifiers keyed to the party', () => {
  it('a class in the party sets the lost chance to its faces on its terrain, keeping the die, and the roll line names it', () => {
    const prompt = checkPrompt(astray, 'lost', null, { terrain: reedbed, party: [tam, wren] });
    expect(prompt.chanceText).toBe('1 on d6');
    const line = prompt.modifiers.find((m) => m.kind === 'trait')!;
    expect(line).toMatchObject({ source: 'party', label: 'a Reed Witch in the party', replaces: { die: 'd6', on: [1] }, public: true });
    expect(modifierWords(line)).toBe('Only on 1, a Reed Witch in the party');
  });

  it('the set chance counts only on its terrain (or a terrain of that class), and only while someone has the class', () => {
    expect(checkPrompt(astray, 'lost', null, { terrain: sedge, party: [tam, wren] }).chanceText).toBe('1–2 on d6');
    expect(checkPrompt(astray, 'lost', null, { terrain: willowCarr, party: [tam, wren] }).chanceText).toBe('1 on d6');
    const without = checkPrompt(astray, 'lost', null, { terrain: reedbed, party: [tam, ash] });
    expect(without.chanceText).toBe('1–3 on d6');
    expect(without.modifiers.some((m) => m.kind === 'trait')).toBe(false);
  });

  it('a causeway still rules the roll out with a Reed Witch in the party', () => {
    expect(checkPrompt(astray, 'lost', null, { terrain: reedbed, routeType: 'causeway', party: [wren] }).ruledOut).toBe(true);
  });

  it('when several set the chance, the fewest faces win and only that source is named', () => {
    const check = readCheck({
      id: 'astray',
      chance: { die: 'd6', on: [1, 2, 3] },
      modifiers: [
        { ifPartyHas: { class: 'lantern-warden' }, chance: { on: [1, 2] } },
        { ifPartyHas: { class: 'reed-witch' }, chance: { on: [1] } },
      ],
    })!;
    const prompt = checkPrompt(check, 'lost', null, { party: [tam, wren] });
    expect(prompt.chanceText).toBe('1 on d6');
    expect(prompt.modifiers.filter((m) => m.kind === 'trait').map((m) => m.label)).toEqual(['a Reed Witch in the party']);
  });

  it("a skill in the party adds faces like weather does, and the line names the skill", () => {
    const check = readCheck({ id: 'astray', chance: { die: 'd6', on: [1, 2, 3] }, modifiers: [{ ifPartyHas: { skill: 'wade' }, add: -1 }, { weatherTag: 'fog', add: 1 }] })!;
    const prompt = checkPrompt(check, 'lost', null, { party: [tam], weatherTags: ['fog'] });
    expect(prompt.chanceText).toBe('1–3 on d6');
    expect(prompt.modifiers.map((m) => modifierWords(m))).toEqual(['−1, Wade in the party', '+1, fog (weather)']);
  });

  it("a self modifier changes only that character's surprise: the group's chance stays and the line says whose it is", () => {
    const surprise = readCheck({ id: 'unawares', name: 'Caught unawares', chance: { die: 'd6', on: [1, 2] }, modifiers: [{ who: 'self', ifClass: 'mire-stalker', chance: { on: [1] } }] })!;
    const prompt = checkPrompt(surprise, 'monster', null, { party: [tam, ash] });
    expect(prompt.chanceText).toBe('1–2 on d6');
    const line = prompt.modifiers.find((m) => m.kind === 'trait')!;
    expect(line.actor).toEqual({ id: 'ash', name: 'Ash' });
    expect(modifierWords(line)).toBe('Only on 1 for Ash, a Mire Stalker');
    expect(checkPrompt(surprise, 'monster', null, { party: [tam] }).modifiers).toEqual([]);
  });

  it('with nobody known (no party given) a party modifier never applies', () => {
    expect(checkPrompt(astray, 'lost', null, { terrain: reedbed }).chanceText).toBe('1–3 on d6');
  });
});

describe('an activity with modifiers keyed to the party', () => {
  const actor = (m: PartyMember): ActorFacts => ({ id: m.id, name: m.name, skills: new Set(m.skills.keys()), items: new Set(), classId: m.classId, className: m.className });
  const cut = {
    chance: { abilityCheck: 'WIT' },
    modifiers: [
      { when: 'fullDay', add: 1, note: null },
      { when: '', add: 1, note: null, party: { ifPartyHas: null, who: 'self' as const, ifClass: 'reed-witch', onlyOnTerrain: [] }, chance: null },
      { when: '', add: 1, note: null, party: { ifPartyHas: { class: 'lantern-warden' }, who: null, ifClass: null, onlyOnTerrain: ['reedbed'] }, chance: null },
    ],
  };

  it("a self modifier is listed for its character only, and a party one only on its terrain", () => {
    const plan = rollPlan(cut, actor(wren), [], { members: [tam, wren], terrain: reedbed });
    expect(plan.modifiers.map(activityModifierWords)).toEqual(['+1 a whole day at it, the rules', '+1 for Wren, a Reed Witch', '+1, a Lantern Warden in the party']);
    const tamPlan = rollPlan(cut, actor(tam), [], { members: [tam], terrain: sedge });
    expect(tamPlan.modifiers.map(activityModifierWords)).toEqual(['+1 a whole day at it, the rules']);
  });

  it('a set chance on an activity: the most faces win, and the instructions say what to roll', () => {
    const forage = {
      chance: { skill: 'forage' },
      modifiers: [
        { when: '', add: 0, note: null, party: { ifPartyHas: { class: 'reed-witch' }, who: null, ifClass: null, onlyOnTerrain: [] }, chance: { die: 'd6', on: [1, 2, 3] } },
        { when: '', add: 0, note: null, party: { ifPartyHas: { class: 'lantern-warden' }, who: null, ifClass: null, onlyOnTerrain: [] }, chance: { die: 'd6', on: [1, 2] } },
      ],
    };
    const plan = rollPlan(forage, actor(tam), [], { members: [tam, wren] });
    expect(plan.sets).toEqual({ die: 'd6', on: [1, 2, 3] });
    expect(plan.instructions).toBe('Roll d6, succeeds on 1–3');
    expect(plan.better).toBe('low');
    expect(plan.modifiers.map(activityModifierWords)).toEqual(['Succeeds on 1–3, a Reed Witch in the party']);
  });
});
