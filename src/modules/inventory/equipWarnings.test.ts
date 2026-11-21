// Equip warnings from the setting's hooks (docs/05, 07 "What allows() checks"). Invented setting throughout.
import { describe, expect, it } from 'vitest';
import { allows, castingStatus, castingStoppedBy, equipBlocks, equipBlocksApart, equipWarnings } from './equipWarnings.ts';

const leatherOnly = { types: ['leather'], shields: false };
const plate = { id: 'plate', name: 'Plate', slot: 'armour', armourType: 'plate' };
const chosen = { id: 'odd-mail', slot: 'armour', armourType: 'chosen' };
const shield = { id: 'reed-shield', name: 'Reed shield', slot: 'shield', material: ['wood'] };
const greatsword = { id: 'greatsword', name: 'Greatsword', slot: 'hand', hands: 2, weaponTags: ['Melee'] };
const dagger = { id: 'dagger', name: 'Dagger', slot: 'hand', hands: 1, weaponTags: ['Melee', 'Missile'] };

describe('allows()', () => {
  it('armour: by type, "any", and "chosen" passes (the GM picks the base)', () => {
    expect(allows(leatherOnly, plate)).toBe(false);
    expect(allows({ types: 'any' }, plate)).toBe(true);
    expect(allows(leatherOnly, chosen)).toBe(true);
  });

  // Purpose (G-65, 07 "Level-scaled class features and armour tiers"): a class allowed "quilted" may wear an item
  // whose armour tier is "quilted", though its own armourType is something else; a class not allowed that tier may not.
  it('armour: a class allowed a type may wear an item whose armour.tier is that type', () => {
    const fenCoat = { id: 'fen-coat', name: 'Fen coat', slot: 'armour', armourType: 'fen-coat', armour: { base: 3, tier: 'quilted' } };
    expect(allows({ types: ['quilted'] }, fenCoat)).toBe(true);
    expect(allows({ types: ['leather'] }, fenCoat)).toBe(false);
    expect(allows({ types: ['fen-coat'] }, fenCoat)).toBe(true);
  });

  // Purpose (area 3 re-check, item 3): magic armour of armourType "chosen" is checked against its chosen base,
  // so a class allowed no armour can't wear it, and a class allowed only one base type can wear only that base.
  it('chosen magic armour: the chosen base decides', () => {
    const quilted = { id: 'quilted-coat', slot: 'armour', armourType: 'quilted' };
    const scale = { id: 'iron-scale', slot: 'armour', armourType: 'iron-scale' };
    expect(allows({ types: [] }, { ...chosen, chosenBase: quilted })).toBe(false);
    expect(allows({ types: ['quilted'] }, { ...chosen, chosenBase: quilted })).toBe(true);
    expect(allows({ types: ['quilted'] }, { ...chosen, chosenBase: scale, baseOptions: [quilted, scale] })).toBe(false);
    expect(allows({ types: ['quilted'] }, { ...chosen, chosenBase: { ...scale, armour: { tier: 'quilted' } } })).toBe(true);
    expect(allows({ types: 'any' }, { ...chosen, chosenBase: scale })).toBe(true);
  });

  // Purpose (item 3): before a base is chosen, a class allowed no armour can't wear chosen-type magic armour whose
  // bases are all armour it can't wear; if one of the bases fits, it still passes (the GM picks the base; scope check
  // in docs/plans/m5b-review-area-3.md); with no bases listed at all, "chosen" passes as 07 says.
  it('chosen magic armour before a base is chosen: blocked only when no base it offers fits', () => {
    const quilted = { id: 'quilted-coat', slot: 'armour', armourType: 'quilted' };
    const scale = { id: 'iron-scale', slot: 'armour', armourType: 'iron-scale' };
    expect(allows({ types: [] }, { ...chosen, baseOptions: [quilted, scale] })).toBe(false);
    expect(allows({ types: ['quilted'] }, { ...chosen, baseOptions: [quilted, scale] })).toBe(true);
    expect(allows({ types: [] }, chosen)).toBe(true);
  });

  it('shields: true, false, or a material', () => {
    expect(allows(leatherOnly, shield)).toBe(false);
    expect(allows({ shields: true }, shield)).toBe(true);
    expect(allows({ shields: 'wood' }, shield)).toBe(true);
    expect(allows({ shields: 'metal' }, shield)).toBe(false);
  });

  it('weapons: any (but excluded), a list (or its extra tags), tags (and one-handed melee)', () => {
    expect(allows({ mode: 'any', exclude: ['greatsword'] }, greatsword)).toBe(false);
    expect(allows({ mode: 'list', ids: ['dagger'] }, dagger)).toBe(true);
    expect(allows({ mode: 'list', ids: [], alsoAllowTags: ['missile'] }, dagger)).toBe(true);
    expect(allows({ mode: 'tags', allowTags: ['Blunt'], oneHandedMelee: true }, dagger)).toBe(true);
    expect(allows({ mode: 'tags', allowTags: ['Blunt'], oneHandedMelee: true }, greatsword)).toBe(false);
  });
});

const hooks = [
  { id: 'warn-armour', kind: 'warn', when: 'equip', test: 'item.slot == "armour" and not allows(character.class.armourAllowed, item)', message: "{character.class.name} can't wear {item.name}. The GM can allow it." },
  { id: 'warn-two-handed', kind: 'warn', when: 'equip', test: '(item.hands == 2 and equipped.shield != null) or (item.slot == "shield" and equipped.hand.hands == 2)', message: '{item.name} needs both hands.', offer: 'stowOther' },
  { id: 'warn-broken', kind: 'warn', when: 'equip', test: 'item.name + 1 > 2', message: 'Never shown.' },
];
const mage = { name: 'Moss', class: { name: 'Bog mage', armourAllowed: { types: [], shields: false } } };

describe('equipWarnings', () => {
  it('fills the message, names what the offer moves, and skips (and names) a rule that can’t run', () => {
    expect(equipWarnings(hooks, { character: mage, item: plate, equipped: { armour: null, shield: null, hand: null } })).toEqual({
      warnings: [{ id: 'warn-armour', message: "Bog mage can't wear Plate. The GM can allow it.", offer: null, inTheWay: [] }],
      skipped: ['warn-broken'],
    });
    const found = equipWarnings(hooks, { character: mage, item: greatsword, equipped: { armour: null, shield, hand: null } });
    expect(found.warnings).toEqual([{ id: 'warn-two-handed', message: 'Greatsword needs both hands.', offer: 'stowOther', inTheWay: ['shield', 'hand'] }]);
  });

  it('nothing to warn about: no warnings', () => {
    expect(equipWarnings(hooks.slice(0, 2), { character: mage, item: dagger, equipped: { armour: null, shield: null, hand: null } }).warnings).toEqual([]);
  });
});

describe('equipBlocks() (A10, ruled 2026-10-25: against the class rules is blocked)', () => {
  const wardenClass = { name: 'Lantern Warden', armourAllowed: { types: ['leather'], shields: false, note: 'Leather only.' }, weaponsAllowed: { mode: 'list', ids: ['dagger'], optional: { ids: ['greatsword'], option: 'big-blades' } } };
  const warden = { name: 'Bryn', class: wardenClass };

  it("armour, a shield or a weapon the class can't use is blocked, with the reason and the rule's note", () => {
    expect(equipBlocks(warden, plate)).toEqual(["Lantern Warden can't use Plate. Leather only."]);
    expect(equipBlocks(warden, shield)).toHaveLength(1);
    expect(equipBlocks(warden, { id: 'spear', name: 'Spear', slot: 'hand', weaponTags: ['Melee'] })).toEqual(["Lantern Warden can't use Spear."]);
  });

  it('what the class allows, what its option might allow, non-weapons and classless characters are not blocked', () => {
    expect(equipBlocks(warden, dagger)).toEqual([]);
    expect(equipBlocks(warden, greatsword)).toEqual([]);
    expect(equipBlocks(warden, { id: 'lantern', name: 'Lantern', slot: 'hand' })).toEqual([]);
    expect(equipBlocks({ name: 'Bryn', class: null }, plate)).toEqual([]);
    expect(equipBlocks({ name: 'Bryn', class: { name: 'Reed Witch' } }, plate)).toEqual([]);
  });
});

describe('gear that stops casting (B25, ruled 2026-10-25)', () => {
  const kindler = {
    name: 'Bryn',
    class: {
      name: 'Ember Keeper',
      armourAllowed: { types: 'any', shields: true },
      spellcasting: { castingType: 'divine', blockedBy: { armour: ['heavy'], shields: true, tags: ['iron-bound'], note: 'Embers need free hands.' }, statusName: "Can't kindle" },
    },
  };
  const mail = { id: 'mail', name: 'Chainmail', slot: 'armour', armourType: 'heavy' };
  const leather = { id: 'leather', name: 'Leather', slot: 'armour', armourType: 'light' };

  it("heavy armour, any shield or a listed tag stops casting, with the pack's status name and note", () => {
    expect(castingStoppedBy(kindler, mail)).toEqual({ statusName: "Can't kindle", reason: 'Chainmail stops divine casting. Embers need free hands.', short: 'Chainmail stops divine casting', note: 'Stops divine casting' });
    expect(castingStoppedBy(kindler, shield)?.statusName).toBe("Can't kindle");
    expect(castingStoppedBy(kindler, { id: 'gauntlet', name: 'Gauntlet', weaponTags: ['Iron-bound'] })).not.toBeNull();
    expect(castingStoppedBy(kindler, leather)).toBeNull();
  });

  it("it can still be worn (not blocked), a rule for other casting types doesn't apply, and the status comes from all the gear", () => {
    expect(equipBlocks(kindler, mail)).toEqual([]);
    const arcaneOnly = { ...kindler, class: { ...kindler.class, spellcasting: { ...kindler.class.spellcasting, blockedBy: { armour: 'any', castingTypes: ['arcane'] } } } };
    expect(castingStoppedBy(arcaneOnly, mail)).toBeNull();
    expect(castingStatus(kindler, [leather])).toBeNull();
    expect(castingStatus(kindler, [mail, shield])).toMatchObject({ statusName: "Can't kindle", reasons: [expect.stringContaining('Chainmail'), expect.stringContaining('Reed shield')] });
  });

  it("without a name the status is 'Can't cast'; non-casters never get it", () => {
    const plain = { ...kindler, class: { ...kindler.class, spellcasting: { castingType: 'arcane', blockedBy: { armour: 'any' } } } };
    expect(castingStoppedBy(plain, leather)?.statusName).toBe("Can't cast");
    expect(castingStoppedBy({ name: 'Bryn', class: { name: 'Bog Knight' } }, mail)).toBeNull();
  });
});

// Purpose (creation survey PR 4, cs-6, G-88): a kindred's weapon limit is read beside the class's, so a Small kindred
// can't wield a large weapon its class allows; the class's own limit still speaks first; a kindred without one doesn't block.
describe("equipBlocks(): the kindred's weapon limit (cs-6)", () => {
  const knight = { name: 'Reed Knight', weaponsAllowed: { mode: 'any' } };
  const greatPike = { id: 'great-pike', name: 'Great pike', slot: 'hand', hands: 2, weaponTags: ['Melee', 'large'] };
  const shortPike = { id: 'short-pike', name: 'Short pike', slot: 'hand', weaponTags: ['Melee', 'small'] };
  const mireKin = { name: 'Mire-kin', weaponsAllowed: { mode: 'tags', allowTags: ['small', 'medium'], note: 'Small: no large weapons.' } };

  it("a Small kindred can't wield a large weapon its class allows; a small one is fine", () => {
    expect(equipBlocks({ name: 'Wren', class: knight, race: mireKin }, greatPike)).toEqual(["Mire-kin can't use Great pike. Small: no large weapons."]);
    expect(equipBlocks({ name: 'Wren', class: knight, race: mireKin }, shortPike)).toEqual([]);
  });

  it("the class's limit speaks first; a kindred without a limit doesn't block", () => {
    const pikeOnly = { name: 'Lantern Warden', weaponsAllowed: { mode: 'list', ids: ['short-pike'] } };
    expect(equipBlocks({ name: 'Wren', class: pikeOnly, race: mireKin }, greatPike)).toEqual(["Lantern Warden can't use Great pike."]);
    expect(equipBlocks({ name: 'Wren', class: knight, race: { name: 'Bog folk' } }, greatPike)).toEqual([]);
    // A class with no weapon rule still meets the kindred's.
    expect(equipBlocks({ name: 'Wren', class: { name: 'Fen Cantor' }, race: mireKin }, greatPike)).toHaveLength(1);
  });
});

// Purpose (tfw-4, test feedback 2026-11-19, B5): a blocked wield or wear shows the rule once, as the pop-up's title, and
// a rule with a note shows the note under it, and nothing else: a weapon rule's verdict stays out of the pop-up's parts
// though the written reason (equipBlocks) keeps it.
describe("equipBlocksApart(): the rule as the title, the pack's note under it, nothing else (tfw-4)", () => {
  const warden = { name: 'Bryn', class: { name: 'Lantern Warden', armourAllowed: { types: ['leather'], shields: false, note: 'Leather only.' }, weaponsAllowed: { mode: 'list', ids: ['dagger'] } } };
  const spear = { id: 'spear', name: 'Spear', slot: 'hand', weaponTags: ['Melee'] };

  it('a rule without a note is the title alone, with nothing under it', () => {
    expect(equipBlocksApart(warden, spear)).toEqual([{ rule: "Lantern Warden can't use Spear", note: '', why: '' }]);
  });

  it("a rule with a note keeps the note apart; a kindred's rule too", () => {
    expect(equipBlocksApart(warden, plate)).toEqual([{ rule: "Lantern Warden can't use Plate", note: 'Leather only.', why: '' }]);
    const mireKin = { name: 'Mire-kin', weaponsAllowed: { mode: 'tags', allowTags: ['small'], note: 'Small: no large weapons.' } };
    const pike = { id: 'great-pike', name: 'Great pike', slot: 'hand', weaponTags: ['Melee', 'large'] };
    expect(equipBlocksApart({ class: { name: 'Reed Knight', weaponsAllowed: { mode: 'any' } }, race: mireKin }, pike)).toEqual([{ rule: "Mire-kin can't use Great pike", note: 'Small: no large weapons.', why: '' }]);
  });

  it("a weapon rule's verdict is kept apart from the class's note, out of the title and the note", () => {
    const rules = [{ category: 'Thunder-tube', classCategories: ['martial'], note: 'The marsh referee decides for chaplains.' }];
    const tube = { id: 'reed-thunder-tube', name: 'Reed thunder-tube', slot: 'hand', weaponTags: ['Thunder-tube', 'Missile'] };
    const knight = { name: 'Bog knight', weaponProficiencyCategory: 'gentle', weaponsAllowed: { mode: 'list', ids: ['eel-knife'], note: 'No missile weapons.' } };
    const [block] = equipBlocksApart({ class: knight }, tube, rules);
    expect(block).toMatchObject({ rule: "Bog knight can't use Reed thunder-tube", note: 'No missile weapons.' });
    expect(block!.why).toContain('The Thunder-tube rule');
    // The written reason still says all three, as before.
    expect(equipBlocks({ class: knight }, tube, rules)).toEqual([`Bog knight can't use Reed thunder-tube. No missile weapons. ${block!.why}`]);
  });

  it("a form's rule keeps the form in the title, whatever the form's name holds", () => {
    const phaseKin = { name: 'Phase kin', forms: [{ id: 'dusk', name: 'Dusk. The long phase', armourAllowed: { types: [], shields: false }, note: 'Knives only.' }] };
    const blocks = equipBlocksApart({ class: phaseKin, formId: 'dusk' }, { id: 'iron-coat', name: 'Iron coat', slot: 'armour', armourType: 'heavy' });
    expect(blocks.map((b) => b.rule)).toEqual(["Phase kin can't use Iron coat in Dusk. The long phase"]);
  });
});
