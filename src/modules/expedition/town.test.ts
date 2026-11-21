// The town screen's pure part (M5b step 6c; ST3; 07 Settlements, st-2, and Downtime's lodgings and lifestyles).
// Invented rules only.
import { describe, expect, it } from 'vitest';
import { entryOf, playerWords, rateWords, readTown, readTownState, shownWords, thingsToDoOf, townPlacesOf, withEntry } from './town.ts';

const base = {
  settlement: {
    services: [
      { id: 'buy-gear', name: 'Buy gear', kind: 'buy', note: 'Rope, lamps and the like.' },
      { id: 'sell-pelts', name: 'Sell pelts', kind: 'sell', rate: 40, note: '' },
      { id: 'strongroom', name: 'Strongroom', kind: 'store' },
      { id: 'gossip', name: 'Hear the gossip', kind: 'other', note: 'An evening at the well.' },
      { name: 'No id', kind: 'buy' },
    ],
  },
  downtime: { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 2 }, per: 'night', sleeps: 2 }], lifestyles: [{ name: 'Modest', rate: { gp: 1 } }] },
};

describe('what the setting says about towns (readTown)', () => {
  // Purpose: the services, lodgings and lifestyles come from the pack's fields, entries without an id or name left out.
  it('reads services, lodgings and lifestyles', () => {
    const town = readTown([base])!;
    expect(town.services.map((s) => s.id)).toEqual(['buy-gear', 'sell-pelts', 'strongroom', 'gossip']);
    expect(town.lodgings).toEqual([{ name: 'The Lantern Rest', rate: '2 sp a night', sleeps: 2 }]);
    expect(town.lifestyles).toEqual([{ name: 'Modest', rate: '1 gp a day' }]);
  });

  // Purpose: the pack highest in the stack wins, as the other readers; a setting saying nothing gives null.
  it('takes the top pack and gives null when nothing is said', () => {
    const top = { settlement: { services: [{ id: 'ferry', name: 'Ferry crossing', kind: 'other' }] } };
    expect(readTown([base, top])!.services.map((s) => s.id)).toEqual(['ferry']);
    expect(readTown([base, top])!.lodgings).toHaveLength(1);
    expect(readTown([{ exploration: {} }])).toBeNull();
  });

  // Purpose: rates read as written, in coins, or with a longer period.
  it('says rates in words', () => {
    expect(rateWords({ gp: 1, sp: 5 }, 'night')).toBe('1 gp 5 sp a night');
    expect(rateWords('a song', '')).toBe('a song');
    expect(rateWords(3, 'per week')).toBe('3 per week');
    expect(rateWords(null, 'night')).toBe('');
  });
});

describe('the places in town and things to do', () => {
  // Purpose: places to go are grouped shops, lodgings, others; kind `other` is a thing to do, not a place.
  it('groups the places and lists the things to do', () => {
    const rules = readTown([base]);
    const places = townPlacesOf(rules);
    expect(places.map((p) => [p.key, p.group])).toEqual([
      ['service:buy-gear', 'shop'],
      ['service:sell-pelts', 'shop'],
      ['lodging:the lantern rest', 'lodging'],
      ['service:strongroom', 'other'],
    ]);
    expect(places[1]!.words).toBe('Shop, buys at 40% of the price');
    expect(places[2]!.words).toBe('Lodging, 2 sp a night, sleeps 2');
    expect(thingsToDoOf(rules).map((t) => t.name)).toEqual(['Hear the gossip']);
    expect(townPlacesOf(null)).toEqual([]);
  });

  // Purpose (2c, pf-5): a lodging's grade is said after "Lodging", and the pack's inn that offers it is kept on the
  // place for the town page; a lodging without them reads as before.
  it("says a lodging's grade and keeps its inn", () => {
    const rules = readTown([{ downtime: { lodgings: [{ name: 'A room above the quay', grade: 'Comfortable', placeId: 'eel-and-lantern', rate: { sp: 2 }, per: 'night' }] } }]);
    expect(rules!.lodgings).toEqual([{ name: 'A room above the quay', rate: '2 sp a night', sleeps: null, grade: 'Comfortable', placeId: 'eel-and-lantern' }]);
    const [room] = townPlacesOf(rules);
    expect(room!.words).toBe('Lodging, Comfortable, 2 sp a night');
    expect(room!.placeId).toBe('eel-and-lantern');
    expect(townPlacesOf(readTown([base]))[2]!.placeId).toBeUndefined();
  });

  // Purpose: a place nobody touched is hidden and open; a change keeps the other field and the other places.
  it('keeps what the GM set, one place at a time', () => {
    const [stall, , inn] = townPlacesOf(readTown([base]));
    expect(entryOf({}, stall!)).toEqual({ name: 'Buy gear', kind: 'shop', shown: false, open: true });
    const shown = withEntry({}, stall!, { shown: true });
    const closed = withEntry(shown, inn!, { open: false });
    expect(closed).toEqual({
      'service:buy-gear': { name: 'Buy gear', kind: 'shop', shown: true, open: true },
      'lodging:the lantern rest': { name: 'The Lantern Rest', kind: 'lodging', shown: false, open: false },
    });
    expect(shownWords(townPlacesOf(readTown([base])), closed)).toBe('1 of 4 shown to players');
  });

  // Purpose: stored entries that aren't written right are left out when read back.
  it('reads the stored town safely', () => {
    expect(readTownState({ a: { name: 'Stall', kind: 'shop', shown: true, open: false }, b: { name: '', shown: true, open: true }, c: 'odd' })).toEqual({
      a: { name: 'Stall', kind: 'shop', shown: true, open: false },
    });
    expect(readTownState(null)).toEqual({});
  });

  // Purpose: a player's line says what the place does (from their own pack when it has it) and whether it's open.
  it("says a player's line", () => {
    const places = townPlacesOf(readTown([base]));
    expect(playerWords({ key: 'service:sell-pelts', kind: 'shop', open: false }, places)).toBe('Shop, buys at 40% of the price, Closed');
    expect(playerWords({ key: 'service:gone', kind: 'lodging', open: true }, places)).toBe('Lodging, Open');
  });
});

describe("town entries' options and a rules overlay's lists (fix-town-options-and-stack)", () => {
  /** readTown with the campaign's choices (the fix's second argument). */
  const readWith = readTown as unknown as (sets: readonly Record<string, unknown>[], choices: Record<string, string>) => ReturnType<typeof readTown>;

  // Purpose: a service, lodging or lifestyle carrying `option` is in play only while its choice is on (of-3).
  it('keeps an entry only while its option is on', () => {
    const sets = [
      {
        settlement: { services: [{ id: 'valuer', name: 'The Valuer', kind: 'identify', option: 'valuing' }, { id: 'stall', name: 'Stall', kind: 'buy' }] },
        downtime: { lodgings: [{ name: 'The Net Loft', rate: { sp: 1 }, per: 'night', option: 'lofts=on' }], lifestyles: [{ name: 'Threadbare', rate: { sp: 1 }, option: 'living-costs=on' }] },
      },
    ];
    const off = readWith(sets, { valuing: 'off', lofts: 'off', 'living-costs': 'off' })!;
    expect(off.services.map((s) => s.id)).toEqual(['stall']);
    expect(off.lodgings).toEqual([]);
    expect(off.lifestyles).toEqual([]);
    const on = readWith(sets, { valuing: 'on', lofts: 'on', 'living-costs': 'on' })!;
    expect(on.services.map((s) => s.id)).toEqual(['valuer', 'stall']);
    expect(on.lodgings.map((l) => l.name)).toEqual(['The Net Loft']);
    expect(on.lifestyles).toEqual([{ name: 'Threadbare', rate: '1 sp a day' }]);
  });

  // Purpose: an entry whose `option` is a list (of-12) is in play while any of its choices is made, and only then.
  it('reads an option list on a town entry', () => {
    const sets = [{ settlement: { services: [{ id: 'tide-clerk', name: 'The Tide Clerk', kind: 'store', option: ['tides=high', 'tides=spring'] }, { id: 'stall', name: 'Stall', kind: 'buy' }] } }];
    expect(readWith(sets, { tides: 'spring' })!.services.map((s) => s.id)).toEqual(['tide-clerk', 'stall']);
    expect(readWith(sets, { tides: 'high' })!.services.map((s) => s.id)).toEqual(['tide-clerk', 'stall']);
    expect(readWith(sets, { tides: 'low' })!.services.map((s) => s.id)).toEqual(['stall']);
    expect(readWith(sets, {})!.services.map((s) => s.id)).toEqual(['stall']);
  });

  // Purpose: a rules overlay's fragment (`extends` the base's rules set, ov-1) merges the town's lists by id: the base's
  // order kept, the overlay's copy of the same id in its place, new ids after; lodgings without an id merge by name.
  it('merges an overlay into the base by id, lodgings by name', () => {
    const base = {
      id: 'quay-rules',
      settlement: { services: [{ id: 'a', name: 'Stall A', kind: 'buy' }, { id: 'b', name: 'Stall B', kind: 'buy' }] },
      downtime: { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 2 }, per: 'night' }] },
    };
    const overlay = {
      id: 'harbour-rules',
      extends: 'quay-rules',
      settlement: { services: [{ id: 'a', name: 'Stall A, rebuilt', kind: 'buy' }, { id: 'c', name: 'Stall C', kind: 'buy' }] },
      downtime: { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 3 }, per: 'night' }, { name: 'The Net Loft', rate: { sp: 1 }, per: 'night' }] },
    };
    const town = readWith([base, overlay], {})!;
    expect(town.services.map((s) => s.name)).toEqual(['Stall A, rebuilt', 'Stall B', 'Stall C']);
    expect(town.lodgings.map((l) => `${l.name}: ${l.rate}`)).toEqual(['The Lantern Rest: 3 sp a night', 'The Net Loft: 1 sp a night']);
  });
});
