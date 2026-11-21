// Slot bands (ga-1, ruled 2026-11-03; sr-9): equipped and stowed counted apart, the slower band sets the speed,
// through the one speed function every screen reads (bq-5). Invented numbers and names only (hard rule 2).
import { describe, expect, it } from 'vitest';
import { carriedLoad, combineEncumbrance, modesOffered, speedOf, type CarriedLoad, type LoadLine } from './encumbrance.ts';

let next = 0;
const line = (name: string, extra: Partial<LoadLine> = {}): LoadLine => ({
  id: `line-${++next}`,
  name,
  category: 'gear',
  qty: 1,
  weightCoin: null,
  slots: 1,
  stack: 1,
  containerLineId: null,
  equipped: false,
  container: null,
  armourType: null,
  ...extra,
});

const bandsSection = {
  mode: 'slot',
  labels: { equipped: 'Worn kit', stowed: 'Packed kit' },
  slot: {
    baseSlots: 4,
    bands: {
      equipped: [
        { maxSlots: 2, speed: 50 },
        { maxSlots: 4, speed: 25 },
      ],
      stowed: [
        { maxSlots: 5, speed: 50 },
        { maxSlots: 7, speed: 35 },
        { maxSlots: 9, speed: 15 },
      ],
    },
    combine: 'slowest',
    overMax: 'Rooted to the spot',
  },
};
const rules = combineEncumbrance([bandsSection]);
const equipped = (n: number) => Array.from({ length: n }, (_, i) => line(`Reed blade ${i}`, { equipped: true }));
const stowed = (n: number) => Array.from({ length: n }, (_, i) => line(`Eel trap ${i}`));
const bandsOf = (load: CarriedLoad) => (load.mode === 'slot' ? load.bands : undefined);

describe('slot bands', () => {
  it('counts equipped and stowed apart, and the slower band gives the speed, named for its band', () => {
    // Equipped 1 (speed 50), stowed 6 (speed 35): stowed sets it.
    const load = carriedLoad([...equipped(1), ...stowed(6)], rules, 'slot');
    expect(bandsOf(load)?.map((b) => [b.name, b.load, b.capacity, b.speed])).toEqual([
      ['Worn kit', 1, 4, 50],
      ['Packed kit', 6, 9, 35],
    ]);
    expect(load).toMatchObject({ mode: 'slot', load: 7, over: false, setsSpeed: 'stowed', tier: { label: 'Packed kit 6 / 9' } });
    expect(speedOf(load)).toBe(35);
    // Now the equipped band is the slower one.
    const heavyHands = carriedLoad([...equipped(3), ...stowed(6)], rules, 'slot');
    expect(heavyHands).toMatchObject({ setsSpeed: 'equipped' });
    expect(speedOf(heavyHands)).toBe(25);
  });

  it('names neither band when both give the same speed', () => {
    const load = carriedLoad([...equipped(1), ...stowed(1)], rules, 'slot');
    expect(load).toMatchObject({ setsSpeed: null });
    expect(speedOf(load)).toBe(50);
  });

  it("is over, with the setting's words and no speed, when either band is past its most", () => {
    const load = carriedLoad([...equipped(5), ...stowed(1)], rules, 'slot');
    expect(load).toMatchObject({ over: true, overMax: 'Rooted to the spot', tier: null, setsSpeed: null });
    expect(bandsOf(load)?.map((b) => b.over)).toEqual([true, false]);
    expect(speedOf(load)).toBeNull();
  });

  it('adds what containers hold to the stowed band only, when containers add capacity', () => {
    const adding = combineEncumbrance([{ ...bandsSection, containers: 'add' }]);
    const sack = line('Reed sack', { container: { capacitySlots: 2 } });
    const load = carriedLoad([sack, ...stowed(9)], adding, 'slot');
    expect(bandsOf(load)?.map((b) => b.capacity)).toEqual([4, 11]);
    expect(load).toMatchObject({ over: false });
  });

  it('counts a stack by its stacks, as one list does', () => {
    const load = carriedLoad([line('Rush lights', { qty: 7, stack: 3 })], rules, 'slot');
    expect(bandsOf(load)?.[1]?.load).toBe(3);
  });

  it('keeps the one list (tiers) working when a pack gives no bands', () => {
    const one = combineEncumbrance([{ mode: 'slot', slot: { tiers: [{ label: 'Spry', maxSlots: 3, movement: '60 ft' }], overMax: 'Stuck' } }]);
    const load = carriedLoad([line('Net')], one, 'slot');
    expect(load).toMatchObject({ tier: { label: 'Spry' } });
    expect(bandsOf(load)).toBeUndefined();
    expect(speedOf(load)).toBe(60);
  });

  it('wins over the one list when a pack gives both, and offers the slot mode with bands alone', () => {
    const both = combineEncumbrance([{ ...bandsSection, slot: { ...bandsSection.slot, tiers: [{ label: 'Spry', maxSlots: 3, movement: '60 ft' }] } }]);
    expect(bandsOf(carriedLoad([line('Net')], both, 'slot'))).toHaveLength(2);
    expect(modesOffered(rules)).toContain('slot');
  });

  it('names the bands "Equipped" and "Stowed" when the pack has no labels, and ignores a band list that is missing', () => {
    const plain = combineEncumbrance([{ mode: 'slot', slot: { ...bandsSection.slot } }]);
    expect(bandsOf(carriedLoad([], plain, 'slot'))?.map((b) => b.name)).toEqual(['Equipped', 'Stowed']);
    const half = combineEncumbrance([{ mode: 'slot', slot: { bands: { equipped: bandsSection.slot.bands.equipped } } }]);
    expect(half.slot?.bands).toBeNull();
  });

  // Main's carry bonuses (eq-6) and bags by fill (eq-5) still count when a pack uses bands: a bonus adds room to the
  // stowed band (like a bag that adds room), and a bag by fill weighs its fill in its band.
  it('adds a carry bonus to the stowed band and weighs a bag by fill, as with one list', () => {
    const grips = line('Ogre grips', { equipped: true, slots: 0, carryBonus: 2 });
    const load = carriedLoad([grips, ...stowed(9)], rules, 'slot');
    expect(bandsOf(load)?.map((b) => b.capacity)).toEqual([4, 11]);
    expect(load).toMatchObject({ bonuses: [{ name: 'Ogre grips', amount: 2 }] });
    const bag = line('Heron satchel', { slots: 2, container: { capacitySlots: 4, weightEmpty: 0, weightFull: 2 } });
    const inside = Array.from({ length: 2 }, (_, i) => line(`Eel ${i}`, { containerLineId: bag.id }));
    // Half full: the bag weighs 1, its contents don't count.
    expect(bandsOf(carriedLoad([bag, ...inside], rules, 'slot'))?.map((b) => b.load)).toEqual([0, 1]);
  });
});
