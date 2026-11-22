// A pack update reaches the items already owned (gate finding F27, 2026-11-10, option 1; lineItem.ts withEntryBlocks
// through lineInPlay). Invented names only (hard rule 2): the Fen Rules' Reed bow and Reed arrows. Purposes:
//   1. An item added before a pack update reads a mode the update added: the line's copy has no `weapon.modes`, the
//      entry now has them, and the line in play has both its own keys and the new modes.
//   2. A line's own edited value still wins over the entry's: a bow whose weapon.damage was edited keeps it.
//   3. An item whose entry was removed from the pack still reads from its own copy, unchanged.
//   4. A typed one-off item (no pack, no entry) is untouched.
//   And the patches in play (of-13) still work: a patch reaches the line's own key once, and a key that came from the
//   entry (already patched there) isn't patched twice, its patch line shown once.
//   Armour (review of #596): base-armour choices a pack update added stay out of an armour already owned, so AC shows
//   the armour's own figure, not "choose base armour" (the database checks the pick against the line's own copy);
//   and a ring whose AC bonus came with the update counts for AC.
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/options-gates.fixture.json?raw';
import materialsFixture from '../../scripts/fixtures/options-gates-3b-materials.fixture.json?raw';
import { baseArmourChoices, weaponMagic, workOutAc } from '../modules/characters/play.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { withEntryBlocks } from '../modules/inventory/lineItem.ts';
import { hasModeButton, modeState, weaponModesOf } from '../modules/inventory/weaponModes.ts';
import { drawnAmmunition, lineFigureParts, modeFigureParts } from './CarrierItems.tsx';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { lineInPlay, settingFrom } from './campaignSetting.ts';
import { wornGearOf } from './EquipWarning.tsx';

const link = (packId: string, name: string, kind: CampaignPack['kind'], priority: number, optionChoices: Record<string, string> = {}): CampaignPack => ({
  id: `link-${packId}`,
  campaignId: 'c-1',
  packId,
  name,
  shortName: name,
  version: '0.1',
  kind,
  optionChoices,
  priority,
  overrides: {},
  campaignHomebrew: false,
});

const MODES = {
  button: 'quiver',
  list: [
    { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
    { id: 'bone', name: 'Bone-tipped arrows', draws: { itemId: 'bone-arrows' } },
  ],
};

/** The Fen Rules after the update: the Reed bow's weapon block now has modes and a range. */
const bowEntry: CampaignEntry = {
  kind: 'item',
  packEntryId: 'reed-bow',
  name: 'Reed bow',
  packId: 'pack-fen',
  data: { id: 'reed-bow', name: 'Reed bow', category: 'weapon', slot: 'hand', weapon: { damage: '1d6', qualities: ['Missile'], range: '5/10/15', modes: MODES } },
};
const fen = (entries: CampaignEntry[] = [bowEntry]) => settingFrom([link('pack-fen', 'Fen Rules', 'setting', 1)], entries, {});

/** A Reed bow added before the update: its own copy has no modes and no range. */
const oldBow = (weapon: Record<string, unknown> = { damage: '1d6', qualities: ['Missile'] }) => ({
  category: 'weapon',
  details: { slot: 'hand', weapon },
  sourceEntryId: 'reed-bow',
  sourcePackId: 'pack-fen',
});

describe('a pack update reaches items already owned (F27)', () => {
  it('1. an item added before the update reads the mode the update added', () => {
    const now = lineInPlay(fen(), oldBow());
    expect(now.details.weapon).toEqual({ damage: '1d6', qualities: ['Missile'], range: '5/10/15', modes: MODES });
    expect(hasModeButton(weaponModesOf(now.details))).toBe(true);
    // Reading only: the line's own copy is left as it was.
    expect(oldBow().details.weapon).toEqual({ damage: '1d6', qualities: ['Missile'] });
    expect(now.lines).toEqual([]);
  });

  it('2. a line’s own edited value still wins over the entry’s', () => {
    const now = lineInPlay(fen(), oldBow({ damage: '1d10', qualities: ['Missile'] }));
    expect((now.details.weapon as Record<string, unknown>).damage).toBe('1d10');
    expect((now.details.weapon as Record<string, unknown>).modes).toEqual(MODES);
  });

  it('3. an item whose entry was removed from the pack still reads from its own copy', () => {
    const line = oldBow();
    const now = lineInPlay(fen([]), line);
    expect(now.details).toBe(line.details);
    // Its entry is still found but under another pack's id (not the one it was copied from): its own copy too.
    const elsewhere = lineInPlay(fen(), { ...line, sourcePackId: 'pack-gone' });
    expect(elsewhere.details).toBe(line.details);
  });

  it('4. a typed one-off item is untouched', () => {
    const typed = { category: 'weapon', details: { slot: 'hand', weapon: { damage: '1d4' } }, sourceEntryId: null, sourcePackId: null };
    expect(lineInPlay(fen(), typed).details).toBe(typed.details);
  });

  it('nothing new in the entry: the very same details (no extra work for the row)', () => {
    const line = oldBow({ damage: '1d6', qualities: ['Missile'], range: '5/10/15', modes: MODES });
    expect(lineInPlay(fen(), line).details).toBe(line.details);
  });
});

describe('the merge, key by key (withEntryBlocks)', () => {
  it('takes a whole block the line hasn’t, keeps a block that isn’t an object, and leaves other keys alone', () => {
    const entry = { weapon: { damage: '1d6' }, armour: { acBonus: 1 }, notes: 'A new note' };
    const merged = withEntryBlocks({ slot: 'shield', armour: { acBonus: 2 } }, entry);
    expect(merged.details).toEqual({ slot: 'shield', armour: { acBonus: 2 }, weapon: { damage: '1d6' } });
    expect(merged.fromEntry).toEqual(['weapon']);
    const odd = { weapon: 'none' };
    expect(withEntryBlocks(odd, entry).details.weapon).toBe('none');
    expect(withEntryBlocks(odd, null).details).toBe(odd);
  });
});

// fp-1 (ruling m5b-evening-rulings-2026-11-10): a weapon's modes, range, magic bonus and bonus against a foe always
// come from the current entry when it has them. Purposes:
//   1. An owned launcher made before the pack corrected its modes no longer adds the corrected-away mode's toHit.
//   2. A stored mode id the corrected list no longer has counts as a fresh weapon: the default mode is used (#569).
//   3. An ammunition stack's corrected magic bonus and bonus against a foe reach the stack already owned.
//   4. An item with no pack entry, or whose entry is gone, keeps its own copy, stale keys and all.
//   And the patches still apply beside a corrected key (of-13), and armour.baseArmour stays the line's own.
describe('some weapon keys always follow the pack (fp-1)', () => {
  /** The Fen Rules before the correction: the Ember mode carried the arrows' magic as its own toHit. */
  const STALE_MODES = {
    button: 'quiver',
    list: [
      { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
      { id: 'ember-old', name: 'Ember arrows', draws: { itemId: 'ember-arrows' }, toHit: 1 },
    ],
  };
  /** After the correction: the Ember mode has no toHit (the arrows carry their own magicBonus) and a new id. */
  const CORRECTED_MODES = {
    button: 'quiver',
    list: [
      { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
      { id: 'ember', name: 'Ember arrows', draws: { itemId: 'ember-arrows' } },
    ],
  };
  const corrected: CampaignEntry = { ...bowEntry, data: { ...bowEntry.data, weapon: { damage: '1d6', qualities: ['Missile'], range: '10/20/30', modes: CORRECTED_MODES } } };
  const embers: CampaignEntry = {
    kind: 'item',
    packEntryId: 'ember-arrows',
    name: 'Ember arrows',
    packId: 'pack-fen',
    data: { id: 'ember-arrows', name: 'Ember arrows', category: 'ammunition', weapon: { magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 2 }] } },
  };
  const setting = fen([corrected, embers]);
  const staleBow = oldBow({ damage: '1d6', qualities: ['Missile'], range: '5/10/15', modes: STALE_MODES });
  const stack = (id: string, sourceEntryId: string, qty: number) => ({ id, actorId: 'ch-1', approval: 'approved', qty, sourceEntryId, details: {} }) as unknown as InventoryLine;
  const quiver = [stack('line-reed', 'reed-arrows', 20), stack('line-ember', 'ember-arrows', 6)];

  it('1. an owned launcher made before the correction no longer adds the corrected-away mode toHit', () => {
    const before = modeState(weaponModesOf(staleBow.details)!, 'ember-old', quiver, 'ch-1');
    expect(modeFigureParts(before)?.attack).toEqual({ label: 'Ember arrows', value: 1 });
    const now = lineInPlay(setting, staleBow);
    const modes = weaponModesOf(now.details)!;
    expect(modes.list.map((m) => m.toHit)).toEqual([null, null]);
    expect(modeFigureParts(modeState(modes, 'ember', quiver, 'ch-1'))?.attack).toBeNull();
    expect((now.details.weapon as Record<string, unknown>).range).toBe('10/20/30');
    // The line's own damage still wins; its copy is left as it was.
    expect((now.details.weapon as Record<string, unknown>).damage).toBe('1d6');
    expect((staleBow.details.weapon as Record<string, unknown>).modes).toBe(STALE_MODES);
  });

  it('2. a stored mode id the corrected list no longer has falls back to the default', () => {
    const state = modeState(weaponModesOf(lineInPlay(setting, staleBow).details)!, 'ember-old', quiver, 'ch-1');
    expect(state.chosen).toBe(false);
    expect(state.mode?.id).toBe('reed');
    expect(state.engaged).toBe(true);
  });

  it('3. an ammunition stack’s corrected magic bonus and bonus against a foe reach the owned stack', () => {
    const owned = { category: 'ammunition', details: { weapon: { magicBonus: 2, bonusVs: [{ against: 'marsh wights', bonus: 1 }] } }, sourceEntryId: 'ember-arrows', sourcePackId: 'pack-fen' };
    const now = lineInPlay(setting, owned);
    expect(now.details.weapon).toEqual({ magicBonus: 1, bonusVs: [{ against: 'bog lurkers', bonus: 2 }] });
    // Already the same as the entry: the very same details (key order aside).
    const sameAlready = { ...owned, details: { weapon: { bonusVs: [{ bonus: 2, against: 'bog lurkers' }], magicBonus: 1 } } };
    expect(lineInPlay(setting, sameAlready).details).toBe(sameAlready.details);
  });

  it('4. an item with no pack entry, or whose entry is gone, keeps its copy', () => {
    const gone = lineInPlay(fen([]), staleBow);
    expect(gone.details).toBe(staleBow.details);
    const typed = { ...staleBow, sourceEntryId: null, sourcePackId: null };
    expect(lineInPlay(setting, typed).details).toBe(typed.details);
    // An entry with no weapon block at all leaves the line's block as it is.
    const plain = { weapon: { magicBonus: 2 } };
    expect(withEntryBlocks(plain, { notes: 'A stick' }).details).toBe(plain);
  });

  it('an entry whose weapon block no longer has the magic bonus removes the line’s old one', () => {
    // Purpose (review of #616): the four keys are read from the current entry, so one the pack dropped is dropped.
    const merged = withEntryBlocks({ weapon: { damage: '1d8', magicBonus: 2, range: '5/10/15' } }, { weapon: { damage: '1d6', range: '5/10/15' } });
    expect(merged.details.weapon).toEqual({ damage: '1d8', range: '5/10/15' });
    expect(merged.fromEntry).toEqual(['weapon.magicBonus']);
  });

  it('the drawn ammunition’s corrected magic bonus is the one the Attack sheet counts', () => {
    // Purpose (review of #616): the stack a mode draws is read as the campaign makes it now (lineInPlay), not from its
    // raw copy, so a stale magicBonus +2 on Ember arrows owned before the correction counts as the pack's +1.
    const owned = { name: 'Ember arrows', category: 'ammunition', details: { weapon: { magicBonus: 2 } }, sourceEntryId: 'ember-arrows', sourcePackId: 'pack-fen' };
    const ammo = drawnAmmunition(setting, owned, embers);
    const magic = weaponMagic({ name: 'Reed bow', data: { weapon: { damage: '1d6', qualities: ['Missile'] } } }, [], false, ammo);
    expect(magic.parts).toEqual([{ label: 'Ember arrows, magic', value: 1 }]);
    expect(lineFigureParts(null, magic, 'reed-bow', true).magic?.parts).toEqual([{ label: 'Ember arrows, magic', value: 1 }]);
  });

  it('armour.baseArmour stays the line’s own even when the entry’s differs', () => {
    const line = { armour: { ac: 7, baseArmour: { choose: ['waxed-coat'] } } };
    const merged = withEntryBlocks(line, { armour: { ac: 7, baseArmour: { choose: ['bog-iron-coat'] } } });
    expect(merged.details).toBe(line);
    expect(merged.fromEntry).toEqual([]);
  });
});

describe('the patches still work over the merge (of-13)', () => {
  const base = readPackJson(fixture);
  const materials = readPackJson(materialsFixture);
  if (!base.ok || !materials.ok) throw new Error('fixture');
  const entries = [...base.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-options' })), ...materials.pack.entries.map((e) => ({ ...e, packId: 'fixture-mire-materials' }))];
  const bone = settingFrom([link('fixture-fen-options', 'Fen options', 'setting', 1), link('fixture-mire-materials', 'Mire materials', 'homebrew', 2, { 'mire-metals': 'bone' })], entries, {});
  const knife = (weapon: Record<string, unknown>) => ({ category: 'weapon', details: { slot: 'hand', weapon }, sourceEntryId: 'eel-knife', sourcePackId: 'fixture-fen-options' });

  it('patches the line’s own key once, as before', () => {
    const now = lineInPlay(bone, knife({ damage: '1d4' }));
    expect(now.details.weapon).toEqual({ damage: '1d4−1' });
    expect(now.lines).toEqual(['Damage −1: Bone, Mire materials']);
  });

  it('a key that came from the entry is patched once, not twice, and its patch line shows once', () => {
    const now = lineInPlay(bone, knife({}));
    expect(now.details.weapon).toEqual({ damage: '1d4−1' });
    expect(now.lines).toEqual(['Damage −1: Bone, Mire materials']);
  });

  it('a corrected key (fp-1) comes from the entry while the patch still reaches the line’s own damage once', () => {
    const fixed = entries.map((e) => (e.packEntryId === 'eel-knife' ? { ...e, data: { ...e.data, weapon: { damage: '1d4', magicBonus: 1 } } } : e));
    const withBonus = settingFrom([link('fixture-fen-options', 'Fen options', 'setting', 1), link('fixture-mire-materials', 'Mire materials', 'homebrew', 2, { 'mire-metals': 'bone' })], fixed, {});
    const now = lineInPlay(withBonus, knife({ damage: '1d4', magicBonus: 2 }));
    expect(now.details.weapon).toEqual({ damage: '1d4−1', magicBonus: 1 });
    expect(now.lines).toEqual(['Damage −1: Bone, Mire materials']);
  });

  it('a patch on a key that always follows the pack shows its line once, from the entry', () => {
    // Purpose (review of #616): with a patch on weapon.magicBonus, the line's own patched copy and the entry both have
    // a patch line for it; the item shows the entry's value and the line once.
    const raw = JSON.parse(materialsFixture) as { patches: unknown[] };
    raw.patches.push({ byOption: 'mire-metals=bone', match: { kind: 'item', ids: ['eel-knife'] }, change: { 'weapon.magicBonus': { delta: 1 } } });
    const more = readPackJson(JSON.stringify(raw));
    if (!more.ok) throw new Error('fixture');
    const fixed = [
      ...base.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-options', ...(e.packEntryId === 'eel-knife' ? { data: { ...e.data, weapon: { damage: '1d4', magicBonus: 1 } } } : {}) })),
      ...more.pack.entries.map((e) => ({ ...e, packId: 'fixture-mire-materials' })),
    ];
    const patchedBonus = settingFrom([link('fixture-fen-options', 'Fen options', 'setting', 1), link('fixture-mire-materials', 'Mire materials', 'homebrew', 2, { 'mire-metals': 'bone' })], fixed, {});
    const now = lineInPlay(patchedBonus, knife({ damage: '1d4', magicBonus: 3 }));
    expect((now.details.weapon as Record<string, unknown>).magicBonus).toBe(2);
    expect(now.lines).toHaveLength(2);
    expect(new Set(now.lines).size).toBe(2);
    expect(now.lines[0]).toBe('Damage −1: Bone, Mire materials');
  });
});

describe('armour already owned after a pack update (review of #596)', () => {
  const base = readPackJson(fixture);
  if (!base.ok) throw new Error('fixture');
  const fenEntries = base.pack.entries.map((e) => ({ ...e, packId: 'fixture-fen-options' }));
  const added = (id: string, name: string, data: Record<string, unknown>): CampaignEntry => ({ kind: 'item', packEntryId: id, name, packId: 'fixture-fen-options', data: { id, name, ...data } });
  const setting = settingFrom(
    [link('fixture-fen-options', 'Fen options', 'setting', 1)],
    [
      ...fenEntries,
      // After the update: the mail now offers bases, and the ring now gives AC.
      added('fen-mail', 'Fen mail', { category: 'armour', slot: 'armour', armour: { ac: 7, aac: 12, baseArmour: { choose: ['waxed-coat'] } } }),
      added('glow-ring', 'Glow ring', { category: 'ring', slot: 'ring', armour: { acBonus: 1 } }),
    ],
    {},
  );
  const worn = (id: string, name: string, details: Record<string, unknown>): InventoryLine =>
    ({ id: `line-${id}`, name, category: String(details.slot), details, sourceEntryId: id, sourcePackId: 'fixture-fen-options', equipped: true, baseArmourId: null, version: 1 }) as unknown as InventoryLine;
  const mail = worn('fen-mail', 'Fen mail', { slot: 'armour', armour: { ac: 7, aac: 12 } });
  const ring = worn('glow-ring', 'Glow ring', { slot: 'ring' });

  it('base-armour choices the update added stay out: AC shows the armour’s own figure', () => {
    const now = lineInPlay(setting, mail);
    expect(baseArmourChoices(now.details.armour)).toBeNull();
    const gear = wornGearOf([mail], setting);
    const ac = workOutAc({ rulesSets: setting.rulesSets, chosenStyle: null, worn: gear, filled: {}, abilityName: (k) => k });
    expect(ac.value).toBe(12);
    expect(ac.lines[0]).toBe('Fen mail: 12');
  });

  it('a ring whose AC bonus came with the update counts for AC', () => {
    expect(wornGearOf([ring], null)).toEqual([]);
    const gear = wornGearOf([mail, ring], setting);
    expect(gear.map((g) => g.name)).toEqual(['Fen mail', 'Glow ring']);
    expect(gear[1]!.armour).toEqual({ acBonus: 1 });
    expect(workOutAc({ rulesSets: setting.rulesSets, chosenStyle: null, worn: gear, filled: {}, abilityName: (k) => k }).value).toBe(13);
  });
});

describe('an unidentified item’s told bonus (K22a)', () => {
  // The Sorrow blade as a player's copy of its entry has it: the face, its weapon block with no magic bonus.
  const face: CampaignEntry = { kind: 'item', packEntryId: 'sorrow-blade', name: 'Weapon', packId: 'pack-fen', data: { id: 'sorrow-blade', category: 'weapon', slot: 'hand', weapon: { damage: '1d8' } } };
  // The GM's copy: the whole entry.
  const whole: CampaignEntry = { ...face, name: 'Sorrow blade', data: { ...face.data, cursed: true, weapon: { damage: '1d8', magicBonus: -1 } } };
  const blade = (weapon: Record<string, unknown>, revealedFields: string[]) => ({ category: 'weapon', details: { slot: 'hand', weapon }, sourceEntryId: 'sorrow-blade', sourcePackId: 'pack-fen', revealedFields });

  // Purpose: the player's face has no bonus to bring back, so an untold line in play has none; the GM's whole entry
  // brings the true −1 back for the GM's view (where bonusHidden marks it).
  it('untold: the player reads no bonus, the GM reads the true one', () => {
    expect(lineInPlay(fen([face]), blade({ damage: '1d8' }, [])).details.weapon).toEqual({ damage: '1d8' });
    expect(lineInPlay(fen([whole]), blade({ damage: '1d8' }, [])).details.weapon).toEqual({ damage: '1d8', magicBonus: -1 });
  });

  // Purpose: once the GM tells the bonus, the line holds it, and fp-1's "read from the current entry" must not drop it
  // because the player's copy of the entry (its face) has none.
  it('told: the line keeps its bonus against the player’s face of the entry', () => {
    expect(lineInPlay(fen([face]), blade({ damage: '1d8', magicBonus: -1 }, ['magic', 'bonus'])).details.weapon).toEqual({ damage: '1d8', magicBonus: -1 });
    // Not told: a bonus a line carries from before K22 follows the entry, as fp-1 rules.
    expect(lineInPlay(fen([face]), blade({ damage: '1d8', magicBonus: -1 }, [])).details.weapon).toEqual({ damage: '1d8' });
  });
});
