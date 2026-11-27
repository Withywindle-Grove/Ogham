// Weapon modes (ruling m5b-at-hand-actions-2026-11-08, ah-3 and ah-4; G-211). Invented weapons and names only.
import { describe, expect, it } from 'vitest';
import type { InventoryLine } from './inventory.ts';
import { attackRules, carriedModes, drawnLines, inflictedBy, hasModeButton, modeBlurb, modeIntro, modeLine, modeState, modeVerb, noneCarriedWords, spentWords, weaponModesOf, withMode } from './weaponModes.ts';

let next = 0;
const line = (name: string, extra: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `line-${++next}`,
    campaignId: 'campaign-reedmouth',
    actorId: 'actor-wren',
    locationId: null,
    libraryEntryId: null,
    name,
    category: 'ammunition',
    weightCoin: 1,
    slots: null,
    stack: 20,
    qty: 1,
    containerLineId: null,
    equipped: false,
    howGot: 'found',
    cost: '',
    notes: '',
    details: {},
    sourcePackId: 'pack-fen',
    sourceEntryId: null,
    chargesLeft: null,
    chargesHidden: false,
    chargesUsed: 0,
    spentShown: false,
    pinned: false,
    atHandHidden: false,
    approval: 'approved',
    perUnits: 1,
    version: 1,
    baseArmourId: null,
    ...extra,
  }) as InventoryLine;

const REED_BOW = {
  weapon: {
    damage: '1d6',
    qualities: ['Missile', 'Two-handed'],
    modes: {
      button: 'quiver',
      list: [
        { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
        { id: 'bone', name: 'Bone-tipped arrows', draws: { itemId: 'bone-arrows' }, toHit: 1, note: 'Counts as bone' },
        { id: 'ember', name: 'Ember arrows', draws: { itemId: 'ember-arrows' }, damage: '1d8' },
      ],
    },
  },
};
const EEL_SPEAR = {
  weaponTags: ['Melee', 'Missile'],
  weapon: {
    damage: '1d6',
    qualities: ['Melee', 'Missile', 'Brace'],
    modes: { button: 'Grip', list: [{ id: 'melee', name: 'Melee', qualities: ['Melee', 'Brace'] }, { id: 'thrown', name: 'Thrown', qualities: ['Missile'] }] },
  },
};

describe('weapon modes (G-211)', () => {
  // Purpose: the pack's block is read as written: its button word from the short list, each mode's fields; anything else
  // (no block, a word off the list such as "Mode", no readable mode) gives no modes.
  it('reads `weapon.modes` as the pack writes it, and nothing from a block the app cannot read', () => {
    const bow = weaponModesOf(REED_BOW)!;
    expect(bow.button).toBe('quiver');
    expect(bow.list.map((m) => m.id)).toEqual(['reed', 'bone', 'ember']);
    expect(bow.list[1]).toEqual({ id: 'bone', name: 'Bone-tipped arrows', draws: 'bone-arrows', qualities: null, damage: null, toHit: 1, note: 'Counts as bone', range: null });
    expect(weaponModesOf(EEL_SPEAR)!.button).toBe('grip');
    expect(weaponModesOf({ weapon: { damage: '1d6' } })).toBeNull();
    expect(weaponModesOf({ weapon: { modes: { button: 'mode', list: [{ id: 'a', name: 'A' }] } } })).toBeNull();
    expect(weaponModesOf({ weapon: { modes: { button: 'stance', list: [{ name: 'No id' }] } } })).toBeNull();
    expect(weaponModesOf(null)).toBeNull();
  });

  // Purpose: ah-4: a weapon with one mode has no button; two or more have one.
  it('gives a mode button only to a weapon with two or more modes', () => {
    expect(hasModeButton(weaponModesOf(REED_BOW))).toBe(true);
    expect(hasModeButton(weaponModesOf({ weapon: { modes: { button: 'stance', list: [{ id: 'normal', name: 'Normal' }] } } }))).toBe(false);
    expect(hasModeButton(null)).toBe(false);
  });

  // Purpose: a mode's stack is the item with its id, or a variant whose baseId is that id unless another mode draws the
  // variant itself; only the character's approved lines count, and several lines add up, the smallest spent first.
  it('finds the stack a mode draws by id or baseId, unless another mode draws it', () => {
    const modes = weaponModesOf(REED_BOW)!;
    const reed = modes.list[0]!;
    const plain = line('Reed arrows', { sourceEntryId: 'reed-arrows', qty: 12 });
    const few = line('Reed arrows', { sourceEntryId: 'reed-arrows', qty: 3 });
    const fletched = line('Fen-fletched arrows', { sourceEntryId: 'fen-arrows', qty: 5, details: { baseId: 'reed-arrows' } });
    const bone = line('Bone-tipped arrows', { sourceEntryId: 'bone-arrows', qty: 4, details: { baseId: 'reed-arrows' } });
    const elsewhere = line('Reed arrows', { sourceEntryId: 'reed-arrows', qty: 9, actorId: 'actor-other' });
    const waiting = line('Reed arrows', { sourceEntryId: 'reed-arrows', qty: 9, approval: 'pending' });
    const all = [plain, few, fletched, bone, elsewhere, waiting];
    expect(drawnLines(reed, modes, all, 'actor-wren').map((l) => l.id)).toEqual([few.id, fletched.id, plain.id]);
    const state = modeState(modes, 'reed', all, 'actor-wren');
    expect(state).toMatchObject({ mode: reed, chosen: true, engaged: true, left: 20 });
    expect(state.stack?.id).toBe(few.id);
    expect(modeLine(state)).toBe('Quiver: Reed arrows ×20');
  });

  // Purpose: ah-3 with Design's rulings on #569 (round 3): a fresh bow (nothing stored) fires the first kind it carries;
  // a stored mode whose stack is gone stays disengaged ("nothing chosen") even with another kind in the pack; with no
  // stack at all in the pack it reads "No reed arrows in the pack"; a grip or stance uses its first mode.
  it('a fresh bow fires the first kind it carries; a spent stored mode stays blocked; no stack reads "No … in the pack"', () => {
    const modes = weaponModesOf(REED_BOW)!;
    const reed = line('Reed arrows', { sourceEntryId: 'reed-arrows', qty: 12 });
    const bone = line('Bone-tipped arrows', { sourceEntryId: 'bone-arrows', qty: 4 });
    // Fresh: the plain arrows when the player has any, else the first kind that is in the pack.
    expect(modeState(modes, null, [reed, bone], 'actor-wren')).toMatchObject({ mode: modes.list[0], chosen: false, engaged: true, why: null, left: 12 });
    expect(modeState(modes, null, [bone], 'actor-wren')).toMatchObject({ mode: modes.list[1], chosen: false, engaged: true, left: 4 });
    expect(modeState(modes, 'bone', [bone], 'actor-wren')).toMatchObject({ chosen: true, engaged: true, left: 4 });
    // Stored and spent: disengaged, even with plain arrows in the pack.
    const spent = modeState(modes, 'ember', [reed, bone], 'actor-wren');
    expect(spent).toMatchObject({ chosen: true, engaged: false, why: 'spent', left: 0, stack: null });
    expect(modeLine(spent)).toBe('Quiver: nothing chosen');
    expect(spentWords(spent, 'reed bow')).toEqual({ title: 'Nothing chosen', why: 'Ember arrows used up. Choose what the reed bow fires next.', open: 'Quiver' });
    // No stack at all in the pack: the first kind's own noun.
    const empty = modeState(modes, null, [], 'actor-wren');
    expect(empty).toMatchObject({ mode: null, engaged: false, why: 'empty' });
    expect(modeLine(empty)).toBe('Quiver: no reed arrows in the pack');
    expect(spentWords(empty, 'reed bow')).toEqual({ title: 'No reed arrows in the pack', why: 'Add some to the pack, then choose what the reed bow fires.', open: 'Quiver' });
    // A choice the pack no longer lists counts as fresh.
    expect(modeState(modes, 'gone', [bone], 'actor-wren')).toMatchObject({ chosen: false, mode: modes.list[1] });
    const spearModes = weaponModesOf(EEL_SPEAR)!;
    const spear = modeState(spearModes, 'thrown', [], 'actor-wren');
    expect(spear).toMatchObject({ engaged: true, chosen: true });
    expect(modeLine(spear)).toBe('Grip: Thrown');
    // A grip with none chosen stands in its first mode (it draws nothing): Melee.
    expect(modeLine(modeState(spearModes, null, [], 'actor-wren'))).toBe('Grip: Melee');
    // A weapon's only mode, with its stack in the pack.
    const sling = weaponModesOf({ weapon: { modes: { button: 'pouch', list: [{ id: 'stones', name: 'Stones', draws: { itemId: 'stones' } }] } } })!;
    expect(modeState(sling, null, [line('Stones', { sourceEntryId: 'stones', qty: 9 })], 'actor-wren')).toMatchObject({ engaged: true, left: 9 });
    expect(modeVerb('quiver')).toBe('Fire');
    expect(modeVerb('grip')).toBe('Use');
  });

  // Purpose: ic-3 (2026-11-14, "Open the quiver, just use quiver"): a blocked Attack's button says the mode button's own
  // word, the same word for a stack used up and for none in the pack, for each of the four mode buttons.
  it("a blocked Attack's button says the mode button's own word: Quiver, Pouch, Grip, Stance", () => {
    const expected = { quiver: 'Quiver', pouch: 'Pouch', grip: 'Grip', stance: 'Stance' } as const;
    for (const [button, word] of Object.entries(expected)) {
      const modes = weaponModesOf({ weapon: { modes: { button, list: [{ id: 'pebbles', name: 'Marsh pebbles', draws: { itemId: 'marsh-pebbles' } }] } } })!;
      const usedUp = modeState(modes, 'pebbles', [], 'actor-wren');
      expect(usedUp.why).toBe('spent');
      expect(spentWords(usedUp, 'fen sling').open).toBe(word);
      const noneInPack = modeState(modes, null, [], 'actor-wren');
      expect(noneInPack.why).toBe('empty');
      expect(spentWords(noneInPack, 'fen sling').open).toBe(word);
    }
  });

  // Purpose: the mode sheet's rows say how many of what each mode draws the pack holds ("4 in the pack", the row's name
  // saying the kind: page M2, frame M2o, approved 2026-11-19), its damage, to-hit and note.
  it('describes each mode for its pick row', () => {
    const modes = weaponModesOf(REED_BOW)!;
    const bone = line('Bone-tipped arrows', { sourceEntryId: 'bone-arrows', qty: 4 });
    expect(modeBlurb(modes.list[1]!, modes, [bone], 'actor-wren', '1d6')).toBe('4 in the pack, 1d6, +1 to hit, Counts as bone');
    expect(modeBlurb(modes.list[2]!, modes, [bone], 'actor-wren', '1d6')).toBe('None in the pack, 1d8');
    const spear = weaponModesOf(EEL_SPEAR)!;
    expect(modeBlurb(spear.list[1]!, spear, [], 'actor-wren', '1d6')).toBe('1d6, Missile');
  });

  // Purpose (tfh-6, 2026-11-19): the Quiver lists only the kinds the character carries; a grip or a stance, which draw
  // nothing, list every way; with none carried the sheet's one line says so, and a quiver has no first line of its own.
  it('lists only the kinds carried, and says so when there are none', () => {
    const modes = weaponModesOf(REED_BOW)!;
    const bone = line('Bone-tipped arrows', { sourceEntryId: 'bone-arrows', qty: 4 });
    expect(carriedModes(modes, [bone], 'actor-wren').map((m) => m.name)).toEqual(['Bone-tipped arrows']);
    // Another character's arrows are not this one's.
    expect(carriedModes(modes, [bone], 'actor-other')).toEqual([]);
    expect(carriedModes(modes, [], 'actor-wren')).toEqual([]);
    expect(noneCarriedWords('quiver')).toBe('Nothing to fire in your pack.');
    expect(modeIntro('quiver', 'Reed bow')).toBeNull();
    const spear = weaponModesOf(EEL_SPEAR)!;
    expect(carriedModes(spear, [], 'actor-wren')).toHaveLength(spear.list.length);
    expect(modeIntro(spear.button, 'Eel spear')).toMatch(/^How the Eel spear is (held|used)\.$/);
  });

  // Purpose: what an attack inflicts (Design on #569): applies.conditionId on the weapon or on the stack in use, named
  // from the setting's conditions with its brief effect; an id the setting lacks shows as written; nothing when none.
  it('names the conditions an attack inflicts, from the weapon or its stack', () => {
    const conditions = [{ id: 'fen-sting', name: 'Fen sting', note: 'Slow for a turn' }, { id: 'smoulder', name: 'Smouldering', note: null }];
    const embers = line('Ember arrows', { sourceEntryId: 'ember-arrows', details: { applies: { conditionId: 'smoulder' } } });
    expect(inflictedBy({ applies: { conditionId: 'fen-sting', save: 'poison' } }, embers, conditions)).toEqual([
      { name: 'Fen sting', note: 'Slow for a turn' },
      { name: 'Smouldering', note: null },
    ]);
    expect(inflictedBy({ applies: { conditionId: 'bog-rot' } }, null, conditions)).toEqual([{ name: 'bog-rot', note: null }]);
    expect(inflictedBy({ applies: { conditionId: 'smoulder' } }, embers, conditions)).toHaveLength(1);
    expect(inflictedBy({ weapon: { damage: '1d6' } }, null, conditions)).toEqual([]);
  });

  // Purpose: the chosen mode changes the figures: its qualities replace the weapon's (a dropped quality leaves the tags,
  // so a thrown spear is missile only), its damage replaces the weapon's; the rules that bear follow the mode.
  it('makes the item the mode says, and the rules that bear follow it', () => {
    const spear = weaponModesOf(EEL_SPEAR)!;
    const thrown = withMode(EEL_SPEAR, spear.list[1]!);
    expect(thrown).toMatchObject({ weaponTags: ['Missile'], weapon: { qualities: ['Missile'], damage: '1d6' } });
    // The line's own copy is left as it was.
    expect(EEL_SPEAR.weapon.qualities).toEqual(['Melee', 'Missile', 'Brace']);
    const bow = weaponModesOf(REED_BOW)!;
    expect(withMode(REED_BOW, bow.list[2]!)).toMatchObject({ weapon: { damage: '1d8', qualities: ['Missile', 'Two-handed'] } });
    expect(withMode(REED_BOW, null)).toBe(REED_BOW);
    expect(attackRules(withMode(REED_BOW, bow.list[1]!), bow.list[1]!, ['By the Fen bow rule', null])).toEqual(['Missile', 'Two-handed', 'Counts as bone', 'By the Fen bow rule']);
    expect(attackRules({ hands: 2, weapon: { qualities: [] } }, null)).toEqual(['two-handed']);
  });
});
