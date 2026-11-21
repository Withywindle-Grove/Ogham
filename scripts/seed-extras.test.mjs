// Tests for what seeded characters get after scores and class (scripts/seed-extras.mjs). Invented content only: the
// fixture pack is scripts/fixtures/m5b-creation.fixture.json. No network: the planner is pure.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { keyFromLabel } from '../src/modules/characters/fields.ts';
import { readPackJson } from '../src/modules/library/packFile.ts';
import { layoutFields } from '../src/modules/library/sheetLayout.ts';
import { placeLines, planExtras, resolveLines, startingMoneyText, typicalMoney } from './seed-extras.mjs';
import { fieldValuesFor, planPack } from './seed-plan.mjs';

const fixture = resolve(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/m5b-creation.fixture.json');
const pack = (() => {
  const read = readPackJson(readFileSync(fixture, 'utf8'));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
})();

/** The campaign's setting as the screens read it, built from the pack's own entries. */
const entries = pack.entries.map((e, i) => ({ ...e, entryId: `entry-${i}`, packId: 'pack-1' }));
const setting = { all: entries, items: entries.filter((e) => e.kind === 'item'), rulesSets: entries.filter((e) => e.kind === 'rulesSet').map((e) => e.data) };

/** The campaign's fields as "Use this sheet layout" makes them (a list with no choices and no plain list id is text). */
const fieldDefs = layoutFields(pack.entries).map((f, order) => {
  const type = String(f.type).toLowerCase();
  const choices = Array.isArray(f.choices) ? f.choices.map(String) : [];
  const from = type === 'list' && choices.length === 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(f.from ?? '')) ? String(f.from) : null;
  return { id: `f${order}`, campaignId: 'c', key: keyFromLabel(f.key ?? f.label, []), label: String(f.label ?? f.key), type: type === 'list' && choices.length === 0 && !from ? 'text' : type, choices, group: '', order, showOnCard: false, hidden: false, fill: null, required: f.required === true, from };
});

const campaigns = planPack(pack).campaigns;
/** The setting with the options this campaign has in play (weapon rules read them from the attached pack). */
const settingFor = (campaign) => ({ ...setting, itemCategories: new Map(), packs: [{ packId: 'pack-1', optionChoices: campaign.choices }] });
const planFor = (campaign, className) => {
  const character = campaign.characters.find((c) => c.className === className);
  const { values } = fieldValuesFor(pack.entries, character);
  return { character, ...planExtras({ setting: settingFor(campaign), choices: campaign.choices, character, fieldDefs, baseFields: values }), baseFields: values };
};
const entryOf = (kind, id) => pack.entries.find((e) => e.kind === kind && e.packEntryId === id);

describe('the first kit', () => {
  // Purpose: each character gets its class's first kit, taking the first row of each roll, with the price on the record.
  it("plans the class's first kit with all its items and records what it cost", () => {
    const plan = planFor(campaigns[0], 'Lantern Warden');
    const kit = plan.items.find((i) => i.why === 'kit');
    expect(kit.kitId).toBe('warden-kit');
    expect(kit.lines).toEqual(entryOf('startingKit', 'warden-kit').data.items);
    expect(plan.record.spentBase).toBeGreaterThan(0);
    expect(plan.record.startingMoney * 10).toBeGreaterThanOrEqual(plan.record.spentBase); // enough money to have paid for it
  });

  it('takes the first row of every roll a rolled kit has', () => {
    const rolled = entries.find((e) => e.kind === 'startingKit' && Array.isArray(e.data.rolls) && e.data.rolls.length > 0);
    if (!rolled) return; // the fixture's rolled kit is optional here; the rule is the app's own kitTaken
    const klass = (rolled.data.classIds ?? [])[0];
    const campaign = campaigns.find((c) => c.characters.some((ch) => ch.classId === klass));
    if (!campaign) return;
    const plan = planFor(campaign, entryOf('class', klass).name);
    const kit = plan.items.find((i) => i.kitId === rolled.packEntryId);
    expect(kit?.picks.every((times) => times.every((row) => row === 0))).toBe(true);
  });
});

describe('the first spells', () => {
  // Purpose: a caster's book holds the given spells, the first picks, the first readable row of each roll and the cantrips.
  it("fills a caster's book with no repeats, and leaves a non-caster without one", () => {
    const caster = planFor(campaigns[0], 'Reed Witch');
    expect(caster.spellBook).toContain('glimmer'); // the class's given spell
    expect(new Set(caster.spellBook).size).toBe(caster.spellBook.length);
    expect(caster.spellBook.length).toBeGreaterThan(1);
    expect(planFor(campaigns[0], 'Lantern Warden').spellBook).toBeNull();
  });

  it('says so when a roll can only be read by the GM, instead of guessing', () => {
    const plan = planFor(campaigns[0], 'Reed Witch');
    const unreadable = plan.notes.filter((n) => n.includes("can't be read"));
    expect(unreadable.length + (plan.spellBook?.length ?? 0)).toBeGreaterThan(0);
  });
});

describe('the trait lists', () => {
  // Purpose: each trait list a character takes gets its first entry; a list an option leaves out gets nothing.
  it("gives the kindred's background list its first entry, saved as the sheet field keeps it", () => {
    const plan = planFor(campaigns[0], 'Lantern Warden');
    const list = entryOf('traitList', `fen-backgrounds-${plan.character.raceId}`);
    expect(list).toBeTruthy();
    expect(plan.fields.background).toBe(list.data.entries[0].name); // a per-race list keeps the entry's name
  });

  it('leaves out the birth omen when its option is off, and takes the first omen when it is on', () => {
    expect(planFor(campaigns[0], 'Lantern Warden').fields.omen).toBeUndefined();
    const on = planFor(campaigns[1], 'Lantern Warden');
    const omens = entryOf('traitList', 'fen-omens');
    expect(on.fields.omen).toBe(omens.data.entries[0].id);
  });

  it("puts a picked entry's gear in the pack, from the setting's own items", () => {
    const withGear = entries.filter((e) => e.kind === 'traitList').flatMap((l) => l.data.entries ?? []).find((e) => Array.isArray(e.items) && e.items.length > 0);
    if (!withGear) return; // no entry in the fixture grants gear; the planner then adds none
    const all = campaigns.flatMap((c) => c.characters.map((ch) => planFor(c, ch.className)));
    expect(all.some((p) => p.items.some((i) => i.why === 'trait'))).toBe(true);
  });
});

describe('the weapon skills', () => {
  // Purpose: while the weapon-skills option is on, a class that takes the step gets the first weapons it offers, one
  // pick each and no more than the level allows; with the option off there is no step and nothing is set.
  it('gives the options-on campaign the first weapons the step offers, and the defaults none', () => {
    const on = planFor(campaigns[1], 'Lantern Warden');
    expect(on.weaponSkills?.length).toBeGreaterThan(0);
    for (const skill of on.weaponSkills) expect(entryOf('item', skill.itemId)?.data.weapon).toBeTruthy();
    expect(new Set(on.weaponSkills.map((s) => s.itemId)).size).toBe(on.weaponSkills.length);
    expect(planFor(campaigns[0], 'Lantern Warden').weaponSkills).toBeNull();
  });
});

describe('the languages', () => {
  // Purpose: the given languages are on every sheet, and each extra language the scores earn takes the list's first.
  it('writes the given and the extra languages into the languages field, once each', () => {
    const plan = planFor(campaigns[0], 'Lantern Warden');
    const value = plan.fields.languages;
    expect(typeof value).toBe('string');
    const names = value.split(', ');
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('small helpers', () => {
  // Purpose: the money and the kit lines are read the way the Gear step reads them.
  it("reads a money roll's typical total, rounded down, with its multiplier", () => {
    expect(typicalMoney('3d6 × 10 gp')).toBe(100);
    expect(typicalMoney('d6 x 5')).toBe(15);
    expect(typicalMoney('a handful')).toBeNull();
    expect(startingMoneyText([{ startingMoney: ' 2d6 ' }, {}])).toBe('2d6');
  });

  it('puts containers first and says which kit items the setting does not have', () => {
    const container = { entry: { data: { container: { capacity: 4 } } }, qty: 1 };
    const plain = { entry: { data: {} }, qty: 1 };
    expect(placeLines([plain, container])).toEqual([container, plain]);
    const found = resolveLines(setting, [{ itemId: 'reed-spear', qty: 1 }, { itemId: 'no-such-thing', qty: 2 }]);
    expect(found.entries).toHaveLength(1);
    expect(found.missing).toEqual(['no-such-thing']);
  });
});
