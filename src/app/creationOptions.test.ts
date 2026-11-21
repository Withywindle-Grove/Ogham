// Options at creation (M5b step 0c, second test, PR F; ct-10, ruled 2026-11-02): one on/off pair per row of
// docs/plans/m5b-0c-creation-options.md, on the invented fixture scripts/fixtures/m5b-creation.fixture.json (an
// invented stand-in with each real option's data shape; no real names or numbers). Each `it` is named after its row
// ("O3 …") and reads the option through the app's own readers: on, the thing is offered; off, it is absent.
//   The table and this file agree: every tested row's stand-in is an option of the fixture and has its `it` here.
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import table from '../../docs/plans/m5b-0c-creation-options.md?raw';
import self from './creationOptions.test.ts?raw';
import { creationMethods, raceStep } from '../modules/characters/creation.ts';
import { scoresRule, startOverTriggered } from '../modules/characters/creationRules.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { firstSpellsPlan } from '../modules/characters/firstSpells.ts';
import { shopOpen, startingEquipment } from '../modules/characters/startingGear.ts';
import { layoutHints, traitListsOf, traitSteps } from '../modules/characters/traitLists.ts';
import { hpReroll, rerollOffered } from '../modules/characters/whoTheyAre.ts';
import { entryOptionOn, resolveRules } from '../modules/library/options.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import { optionOn } from './GuidedCreation.tsx';
import { campaignChoices, weaponSetup } from './weaponSetup.ts';
import { weaponCountLine } from './WeaponSkillsStep.tsx';

type Data = Record<string, unknown> & { id: string; name?: string };
const pack = JSON.parse(fixture) as Record<string, Data[]>;
const KINDS: Record<string, string> = { options: 'option', rulesSets: 'rulesSet', races: 'race', classes: 'class', items: 'item', startingKits: 'startingKit', traitLists: 'traitList', fieldTemplates: 'fieldTemplate', spells: 'spell', spellLists: 'spellList', tables: 'table' };
const all = Object.entries(KINDS).flatMap(([part, kind]) =>
  (pack[part] ?? []).map((data) => ({ kind, packId: 'pack-fen', packEntryId: data.id, name: data.name ?? data.id, data, alsoIn: [], preferred: false })),
);
const of = (kind: string) => all.filter((e) => e.kind === kind);
const find = (kind: string, id: string) => all.find((e) => e.kind === kind && e.packEntryId === id)!;

/** The fixture as a campaign with these choices (the rest at the pack's defaults), as the app loads it. */
function setting(choices: Record<string, string> = {}): CampaignSetting {
  const base = { packs: [{ packId: 'pack-fen', optionChoices: choices }], all, items: of('item'), itemCategories: new Map(), rulesSets: [] } as unknown as CampaignSetting;
  return { ...base, rulesSets: pack.rulesSets!.map((r) => resolveRules(r, campaignChoices(base))) };
}
const choicesOf = (choices: Record<string, string>) => campaignChoices(setting(choices));

const field = (key: string, from: string): FieldDefinition => ({ id: key, campaignId: 'c1', key, label: key, type: 'list', choices: [], group: '', order: 0, showOnCard: false, hidden: false, fill: null, required: false, from });
const omenStep = (choices: Record<string, string>, fieldOption?: string) => {
  const layout = new Map(layoutHints(of('fieldTemplate')));
  if (fieldOption) layout.set('omen', { from: 'fen-omens', option: fieldOption });
  return traitSteps([field('omen', 'fen-omens')], traitListsOf(all), { layout, raceId: 'bog-folk', choices: choicesOf(choices) }).map((s) => s.id);
};

describe('ct-10: every creation option, on and off (docs/plans/m5b-0c-creation-options.md)', () => {
  it('O1 creation method: "kindred, then calling" has a Race step; "calling as kindred" has none', () => {
    const method = (choice: string) => creationMethods(of('option'), (id) => (id === 'creation-path' ? choice : undefined))!.chosen;
    expect(raceStep(method('kindred-first'), of('race'))).toBe('required');
    expect(raceStep(method('calling-only'), of('race'))).toBe('none');
  });

  it('O2 a trait list gated with its field spelled "=on": on, its step; off, none', () => {
    expect(omenStep({ 'fen-omens': 'on' }, 'fen-omens=on')).toEqual(['fen-omens']);
    expect(omenStep({ 'fen-omens': 'off' }, 'fen-omens=on')).toEqual([]);
  });

  it('O3 weapon proficiency on: the Weapon skills step with its count; off: no step', () => {
    const on = weaponSetup(setting({ 'fen-weapon-drill': 'on' }), 'lantern-warden', 1);
    expect(on?.allowed).toBe(2);
    expect(on?.proficiency.specialisation).toBeNull();
    expect(weaponSetup(setting({ 'fen-weapon-drill': 'off' }), 'lantern-warden', 1)).toBeNull();
    // The pack's default (off) when the campaign never chose.
    expect(weaponSetup(setting(), 'lantern-warden', 1)).toBeNull();
  });

  it('O4 a specialisation choice of the same option: the step stays, the count line says specialisation is on; plain on says nothing', () => {
    const master = weaponSetup(setting({ 'fen-weapon-drill': 'on-drill-master' }), 'lantern-warden', 1)!;
    expect(master.proficiency.specialisation).toEqual({ cost: 2, attack: 1, damage: 1, note: 'Pick one weapon twice to master it: two picks for +1 to hit and +1 damage.' });
    expect(weaponCountLine([], master.proficiency, master.allowed).meta).toBe('Specialisation is on: pick one again to specialise');
    const plain = weaponSetup(setting({ 'fen-weapon-drill': 'on' }), 'lantern-warden', 1)!;
    expect(weaponCountLine([], plain.proficiency, plain.allowed).meta).toBe('');
    // A class whose category may not specialise drills, but never masters.
    expect(weaponSetup(setting({ 'fen-weapon-drill': 'on-drill-master' }), 'reed-witch', 1)?.proficiency.specialisation).toBeNull();
  });

  it('O5 restricted weapons on: the forbidden weapon in the folded group; off: no group', () => {
    const on = weaponSetup(setting({ 'fen-weapon-drill': 'on', 'fen-odd-weapons': 'on' }), 'mire-stalker', 1)!;
    expect(on.proficiency.restricted).not.toBeNull();
    expect(on.restricted.map((w) => w.packEntryId)).toEqual(['bog-sling']);
    expect(on.groups.flatMap((g) => g.items.map((w) => w.packEntryId))).not.toContain('bog-sling');
    expect(weaponSetup(setting({ 'fen-weapon-drill': 'on', 'fen-odd-weapons': 'off' }), 'mire-stalker', 1)!.proficiency.restricted).toBeNull();
  });

  it('O6 the hit-points re-roll on: a 1 on the die offers Roll again; off: nothing', () => {
    const rule = { dice: 'd8', modifier: null, minimum: 1 };
    const offered = (choice: string) => {
      const s = setting({ 'fen-second-wind': choice });
      return rerollOffered('1', rule, hpReroll(s.rulesSets), (id) => optionOn(s, id));
    };
    expect(offered('on')).toBe(true);
    expect(offered('off')).toBe(false);
  });

  it('O7 cantrips on: the Fen Cantor picks a small charm on First spells; off: no cantrip group', () => {
    const plan = (choice: string) => {
      const s = setting({ 'fen-small-charms': choice });
      return firstSpellsPlan(find('class', 'fen-cantor'), 1, { spells: of('spell'), lists: of('spellList'), tables: of('table'), choices: campaignChoices(s) });
    };
    expect(plan('on')?.cantrips?.count).toBe(1);
    expect(plan('on')?.cantrips?.options.map((o) => o.id)).toEqual(expect.arrayContaining(['frog-chorus', 'dry-boots', 'knot-charm']));
    expect(plan('off')?.cantrips).toBeNull();
  });

  it('O15 kindred-as-class on: the kin calling is offered; off: it is not', () => {
    const offered = (choice: string) => entryOptionOn(find('class', 'bog-kin-calling').data, choicesOf({ 'fen-kin-callings': choice }));
    expect(offered('on')).toBe(true);
    expect(offered('off')).toBe(false);
  });

  it('O16 buying gear on: the shop is open and nothing is handed out; off: no shop, the given gear instead', () => {
    const on = setting({ 'fen-market': 'on' }).rulesSets;
    expect(shopOpen(on)).toBe(true);
    expect(startingEquipment(on)).toEqual([]);
    const off = setting({ 'fen-market': 'off' }).rulesSets;
    expect(shopOpen(off)).toBe(false);
    expect(startingEquipment(off).map((i) => i.itemId)).toEqual(['rope-reed', 'storm-lantern']);
  });

  it('O17 a kit gated "=off": offered with buying off; absent with it on', () => {
    const offered = (choice: string) => entryOptionOn(find('startingKit', 'fen-market-bundle').data, choicesOf({ 'fen-market': choice }));
    expect(offered('off')).toBe(true);
    expect(offered('on')).toBe(false);
  });

  it('O18 a trait list and its field gated by one option (bare): on, its step; off, none', () => {
    expect(omenStep({ 'fen-omens': 'on' })).toEqual(['fen-omens']);
    expect(omenStep({ 'fen-omens': 'off' })).toEqual([]);
  });

  it('O19 start over on: very low scores offer Start over; off: they stand', () => {
    const low = { MUS: 3, NIM: 4, GRT: 5, WIT: 9, LORE: 9, CHARM: 9 };
    const offered = (choice: string) => {
      const s = setting({ 'fen-cruel-dice': choice });
      return startOverTriggered(scoresRule(s.rulesSets), low, (id) => optionOn(s, id));
    };
    expect(offered('on')).toBe(true);
    expect(offered('off')).toBe(false);
  });

  it('O23 a kit gated by an option (bare): offered when on; absent when off', () => {
    const offered = (choice: string) => entryOptionOn(find('startingKit', 'fen-quick-bundle').data, choicesOf({ 'fen-quick-kit': choice }));
    expect(offered('on')).toBe(true);
    expect(offered('off')).toBe(false);
  });
});

describe('the options table and this file agree', () => {
  const rows = table
    .split('\n')
    .filter((line) => /^\| O\d+ \|/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()));
  const firstCode = (cell: string) => /`([^`]+)`/.exec(cell)?.[1] ?? '';

  it('lists every row once, each tested or explained', () => {
    expect(rows.length).toBeGreaterThan(20);
    expect(new Set(rows.map((r) => r[1])).size).toBe(rows.length);
    for (const r of rows) expect(r[7], r[1]).toMatch(/^(tested|can't model: .+)/);
  });

  it('every tested row has its stand-in in the fixture and its test in this file', () => {
    const fixtureOptions = new Set([...of('option'), ...of('startingKit')].map((e) => e.packEntryId));
    for (const r of rows.filter((x) => x[7]!.startsWith('tested'))) {
      expect(fixtureOptions.has(firstCode(r[6]!)), `${r[1]} stand-in ${r[6]}`).toBe(true);
      expect(self.includes(`it('${r[1]} `), `${r[1]} has no test`).toBe(true);
    }
  });
});
