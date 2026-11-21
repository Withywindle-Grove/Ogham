// What a seeded character gets after its scores and class (docs/plans/test-seed-campaigns.md, follow-up): the first
// kit (the first row of each roll), the first spells, each trait list's first entry, and the given and extra
// languages. Planned with the app's own pure rules (the same functions the guided steps use) from the campaign's
// resolved setting, and written with the app's own commands. No pack content here: everything comes from the setting.
import { weaponSetup } from '../src/app/weaponSetup.ts';
import { classRace } from '../src/modules/characters/creation.ts';
import { languageText, settingLanguages } from '../src/modules/characters/creationGuide.ts';
import { bookOf, firstSpellsPlan, firstSpellsProblem, NO_PICKS, tapped, tapProblem } from '../src/modules/characters/firstSpells.ts';
import { isKitContainer } from '../src/modules/characters/kitPlaces.ts';
import { languagesOfPlan, languagesPlan, languagesStepExists, tapLanguage, NO_LANGUAGE_PICKS } from '../src/modules/characters/languagesStep.ts';
import { coinsOf, kitPrice, kitRolls, kitsFor, kitTaken, moneyCoin, priceOf, shopOpen, showMoney, startingEquipment } from '../src/modules/characters/startingGear.ts';
import { equipBlocks } from '../src/modules/inventory/equipWarnings.ts';
import { layoutHints, traitListsOf, traitSteps, traitValue } from '../src/modules/characters/traitLists.ts';
import { entryOptionOn } from '../src/modules/library/options.ts';
import { typicalRoll } from './seed-plan.mjs';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value) => (typeof value === 'number' && Number.isInteger(value) ? value : null);

/** The setting's starting money roll as text, the top rules set that says; '' when none (as the Gear step reads it). */
export function startingMoneyText(rulesSets) {
  for (const rules of [...rulesSets].reverse()) if (typeof rules.startingMoney === 'string' && rules.startingMoney.trim()) return rules.startingMoney.trim();
  return '';
}

/** "3d6 × 10 gp" → the typical total (dice average rounded down, times the multiplier); null when it isn't dice. */
export function typicalMoney(text) {
  const match = /(\d*d\d+)\s*(?:[×x*]\s*(\d+))?/i.exec(text);
  if (!match) return null;
  const dice = /^d/i.test(match[1]) ? `1${match[1]}` : match[1];
  const base = typicalRoll(dice);
  return base === null ? null : base * (match[2] ? Number(match[2]) : 1);
}

/** The item counts as the Add item sheet copies them: a bundle is its size times as many. */
export const bundleOf = (entry) => {
  const size = whole(entry.data.bundle);
  return size && size > 1 ? size : 1;
};

/** The ItemCopy `inventory.add` takes, as Add item makes it from a setting item. */
export const copyOf = (entry) => ({
  libraryEntryId: entry.entryId ?? null,
  name: entry.name,
  category: typeof entry.data.category === 'string' ? entry.data.category : '',
  weightCoin: whole(entry.data.weightCoin),
  slots: whole(entry.data.slots),
  stack: whole(entry.data.stack) || 1,
});

/** Whether a shop sells it (07 forSale): as the pack says, else everything but the magic categories (as Add item reads it). */
export function forSale(entry) {
  if (typeof entry.data.forSale === 'boolean') return entry.data.forSale;
  const category = typeof entry.data.category === 'string' ? entry.data.category : '';
  return !/(^|-)magic(-|$)/.test(category);
}

const words = (entry) => `${entry.name} ${typeof entry.data.category === 'string' ? entry.data.category : ''}`;
const textOf = (entry) => [entry.name, entry.data.description, entry.data.blurb, entry.data.notes].filter((t) => typeof t === 'string').join(' ');

/**
 * A starting set bought in a shop campaign (design ruling si-3, test data): the cheapest armour and shield the class may
 * use, one weapon it may use, a backpack, a week of rations and a light source, within `budget` (base coins), in that
 * order. Items are found by their data (slot, weapon, container) and by plain words in their names ("ration", "lantern"),
 * never by a name from a pack. What can't be found or afforded comes back as a note. Pure.
 */
export function shopSet({ items, coins, unit, klass, race, budget }) {
  const notes = [];
  const forClass = { name: klass.name, level: 1, class: { ...klass.data, id: klass.packEntryId, name: klass.name }, race: race ? { ...race.data, id: race.packEntryId, name: race.name } : null };
  const mayUse = (entry) => equipBlocks(forClass, { ...entry.data, id: entry.packEntryId, name: entry.name }).length === 0;
  const priced = items.filter(forSale).flatMap((entry) => {
    const price = priceOf(entry.data.value, coins, unit);
    return price === null ? [] : [{ entry, price }];
  });
  const cheapest = (list) => [...list].sort((a, b) => a.price - b.price || a.entry.name.localeCompare(b.entry.name))[0];
  const slot = (name) => priced.filter((p) => p.entry.data.slot === name && mayUse(p.entry));
  const shield = cheapest(slot('shield'));
  const handed = priced.filter((p) => p.entry.data.slot === 'hand' && isRecord(p.entry.data.weapon) && mayUse(p.entry));
  const oneHanded = handed.filter((p) => p.entry.data.hands !== 2);
  const weapon = cheapest(shield && oneHanded.length > 0 ? oneHanded : handed);
  const containers = priced.filter((p) => isKitContainer(p.entry.data));
  const backpack = cheapest(containers.filter((p) => /back\s*pack|rucksack|knapsack/i.test(p.entry.name))) ?? cheapest(containers);
  const rations = cheapest(priced.filter((p) => /ration|provision/i.test(words(p.entry))));
  const light = cheapest(priced.filter((p) => isRecord(p.entry.data.light) || /torch|lantern|candle|lamp/i.test(p.entry.name)));
  // A ration item that already says it feeds for a week is one purchase; one per day is seven.
  const weekQty = rations && /week|7 days|seven days/i.test(textOf(rations.entry)) ? 1 : 7;
  const wanted = [
    ['armour', cheapest(slot('armour')), 1],
    ['shield', shield, 1],
    ['weapon', weapon, 1],
    ['backpack', backpack, 1],
    ['a week of rations', rations, weekQty],
    ['a light source', light, 1],
  ];
  const groups = [];
  let total = 0;
  for (const [role, pick, qty] of wanted) {
    if (!pick) {
      notes.push(`shop: no ${role} the class may use was found`);
      continue;
    }
    const cost = pick.price * qty;
    if (total + cost > budget) {
      notes.push(`shop: couldn't afford ${pick.entry.name} (${role}) within the starting money`);
      continue;
    }
    total += cost;
    groups.push({ why: 'shop', label: pick.entry.name, lines: [{ itemId: pick.entry.packEntryId, qty }], howGot: 'bought', cost: showMoney(cost, coins, unit), price: cost });
  }
  return { groups, total, notes };
}

/**
 * Everything the extras add for one character, planned and not written. `setting` is the campaign's setting as the
 * screens read it ({ all, items, rulesSets }), `choices` the options in play, `fieldDefs` the campaign's fields and
 * `baseFields` the values already on the draft. `notes` says anything left out and why.
 */
export function planExtras({ setting, choices, character, fieldDefs, baseFields }) {
  const notes = [];
  const rs = setting.rulesSets;
  const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classId);
  const races = setting.all.filter((e) => e.kind === 'race');
  const race = character.raceId ? (races.find((r) => r.packEntryId === character.raceId) ?? null) : null;
  const fields = {};
  if (!klass) return { fields, spellBook: null, weaponSkills: null, items: [], record: {}, notes: [`class ${character.classId} isn't in the campaign's setting`] };

  // Languages: the given ones, and the first of the offered list for each extra the scores earn.
  const languagesField = fieldDefs.find((d) => d.key.toLowerCase() === 'languages' && !d.hidden && (d.type === 'text' || d.type === 'longtext'));
  if (languagesField) {
    const alignmentField = fieldDefs.find((d) => d.key.toLowerCase() === 'alignment');
    const alignment = alignmentField && typeof baseFields[alignmentField.key] === 'string' ? baseFields[alignmentField.key] : null;
    const legacy = settingLanguages(setting.all.filter((e) => e.kind === 'race' || e.kind === 'class'), fieldDefs.map((f) => f.label));
    const plan = languagesPlan({ rulesSets: rs, race, klass, scores: character.scores ?? {}, alignment, fields: fieldDefs, legacy });
    let picks = NO_LANGUAGE_PICKS;
    if (languagesStepExists(plan) && plan.count !== null) {
      for (const option of plan.offered) {
        const tap = tapLanguage(plan, picks, option.id);
        if ('picks' in tap) picks = tap.picks;
        else break; // the count is full
      }
    } else if (languagesStepExists(plan)) notes.push('languages: the setting lets any be picked; only the given ones were set');
    fields[languagesField.key] = languageText(languagesOfPlan(plan, picks));
  }

  // Trait lists: each list's first entry; an entry that grants gear puts it in the pack.
  const lists = traitListsOf(setting.all);
  const raceId = race?.packEntryId ?? classRace(klass.data, races)?.packEntryId ?? null;
  const traitGrants = [];
  for (const step of traitSteps(fieldDefs, lists, { layout: layoutHints(setting.all), raceId, choices })) {
    const entry = step.list.entries[0];
    if (!entry) continue;
    fields[step.field.key] = traitValue(step, { entryId: entry.id });
    if (entry.items.length > 0) traitGrants.push({ listId: step.list.id, items: entry.items });
  }

  // First spells: the given ones, the first picks, the first row of each roll (the next row when it can't be taken), the first cantrips.
  let spellBook = null;
  const spellPlan = firstSpellsPlan(klass, character.level ?? 1, {
    spells: setting.all.filter((e) => e.kind === 'spell'),
    lists: setting.all.filter((e) => e.kind === 'spellList'),
    tables: setting.all.filter((e) => e.kind === 'table'),
    choices,
  });
  if (spellPlan) {
    let picks = NO_PICKS;
    const take = (group, id) => {
      if (tapProblem(spellPlan, picks, group, id) === null) picks = tapped(picks, group, id);
    };
    for (const option of spellPlan.choose?.options ?? []) if (picks.chosen.length < spellPlan.choose.count) take('choose', option.id);
    for (const option of spellPlan.cantrips?.options ?? []) if (picks.cantrips.length < spellPlan.cantrips.count) take('cantrips', option.id);
    for (const group of spellPlan.rolls) {
      if (group.unreadable) {
        notes.push(`first spells: table ${group.tableId} can't be read by a player`);
        continue;
      }
      for (const row of group.rows) {
        if (picks.rolled[group.tableId]) break;
        take('roll', row.key);
      }
    }
    const left = firstSpellsProblem(spellPlan, picks);
    if (left) notes.push(`first spells: ${left}`);
    spellBook = bookOf(spellPlan, picks);
  }

  // Weapon skills: the first picks the step offers, in its order, one each (the step exists only while its option is on).
  let weaponSkills = null;
  const weapons = weaponSetup(setting, character.classId, character.level ?? 1);
  if (weapons) {
    weaponSkills = [];
    for (const group of weapons.groups) {
      for (const item of group.items) {
        if (weaponSkills.length < weapons.allowed && !weaponSkills.some((s) => s.itemId === item.packEntryId)) weaponSkills.push({ itemId: item.packEntryId });
      }
    }
    if (weaponSkills.length < weapons.allowed) notes.push(`weapon skills: the step offers ${weaponSkills.length} but allows ${weapons.allowed}`);
  }

  // The kit: the class's first, with the first row of each roll; and what everyone is given.
  const items = [];
  const record = {};
  const coins = coinsOf(rs);
  const moneyText = startingMoneyText(rs);
  const unit = moneyCoin(moneyText, coins);
  const kits = kitsFor(setting.all.filter((e) => e.kind === 'startingKit' && entryOptionOn(e.data, choices)), character.classId, false);
  const given = startingEquipment(rs);
  if (given.length > 0) items.push({ why: 'given', label: 'Starting equipment', lines: given, howGot: 'found' });
  let price = 0;
  if (kits.length > 0) {
    const kit = kits[0];
    const picksOfKit = kitRolls(kit.data).map((roll) => Array.from({ length: roll.times }, () => 0));
    price = kitPrice(kit.data, coins, unit) ?? 0;
    items.push({ why: 'kit', label: kit.name, lines: kitTaken(kit.data, picksOfKit), howGot: 'bought', cost: kit.name, kitId: kit.packEntryId, picks: picksOfKit, price });
  } else if (moneyText && shopOpen(rs)) {
    // No kit for this class but a shop (si-3): buy a starting set within the starting money.
    const shopping = shopSet({ items: setting.items, coins, unit, klass, race, budget: (typicalMoney(moneyText) ?? 0) * unit.valueInBase });
    items.push(...shopping.groups);
    price = shopping.total;
    notes.push(...shopping.notes);
  } else if (moneyText || given.length === 0) notes.push(`kit: none for ${klass.name}`);
  for (const grant of traitGrants) items.push({ why: 'trait', label: grant.listId, lines: grant.items, howGot: 'found', listId: grant.listId });
  const typical = typicalMoney(moneyText);
  if (moneyText) {
    const startingMoney = Math.max(typical ?? 0, Math.ceil(price / unit.valueInBase));
    Object.assign(record, { startingMoney, moneyCoin: { key: unit.key, valueInBase: unit.valueInBase } });
    if (typical === null) notes.push('money: the roll could not be read as dice, so the kit price is the money');
  }
  record.spentBase = price;
  return { fields, spellBook, weaponSkills, items, record, notes };
}

/** Which line of the pack a kit item goes in: the container it came with, else none. Pure placement for the seed. */
export function placeLines(entries) {
  const isBox = (e) => isKitContainer(e.entry.data);
  return [...entries.filter(isBox), ...entries.filter((e) => !isBox(e))];
}

/** A kit-item line resolved against the setting's items: [{ entry, qty }] and the ids the setting doesn't have. */
export function resolveLines(setting, lines) {
  const entries = [];
  const missing = [];
  for (const line of lines) {
    const entry = setting.items.find((i) => i.packEntryId === line.itemId);
    if (entry) entries.push({ entry, qty: line.qty * bundleOf(entry) });
    else missing.push(line.itemId);
  }
  return { entries, missing };
}
