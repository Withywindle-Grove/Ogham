// Town requests' pure parts (M5b step 6e; ST5–ST9; 07 Settlements, st-2). Invented rules only.
import { describe, expect, it } from 'vitest';
import { timeUnits } from '../expedition/clock.ts';
import { toRequest } from './requests.ts';
import { availabilityOf, availabilityWords, morningOf, overnightLines, saleShare, stayFor, suggestedSale } from './townRequests.ts';

const rules = [
  {
    currency: [
      { key: 'gp', label: 'Gold', valueInBase: 100 },
      { key: 'sp', label: 'Silver', valueInBase: 10 },
      { key: 'cp', label: 'Copper', valueInBase: 1 },
    ],
    settlement: {
      services: [{ id: 'pelts', name: 'The Pelt Buyer', kind: 'sell', rate: 40 }],
      availability: { bySize: [{ size: 'Hamlet', chance: 10 }, { size: 'Market town', chance: 60 }], note: 'Rarer goods.' },
      salePrice: { default: 50, byService: { jeweller: 80 } },
    },
  },
];

describe('the pack rules for town trade', () => {
  // Purpose: the availability chance reads as one line by size, with the pack's note kept.
  it('reads the availability chance by size', () => {
    const a = availabilityOf(rules)!;
    expect(availabilityWords(a)).toBe('Hamlet 10%, Market town 60%');
    expect(a.note).toBe('Rarer goods.');
    expect(availabilityOf([{}])).toBeNull();
  });

  // Purpose: the share a buyer pays comes from the sale rule by service first, then the service's rate, then the default.
  it('picks the sale share in order', () => {
    expect(saleShare(rules, 'jeweller', null)).toBe(80);
    expect(saleShare(rules, 'pelts', 40)).toBe(40);
    expect(saleShare(rules, 'used-gear', null)).toBe(50);
    expect(saleShare([{}], null, null)).toBeNull();
  });

  // Purpose: the suggested price is whole coins, rounded down, in the setting's coins (0 and odd amounts included).
  it('suggests a sale price in whole coins', () => {
    expect(suggestedSale({ gp: 5 }, 1, 40, rules)).toBe('2 gp');
    expect(suggestedSale({ gp: 5 }, 3, 50, rules)).toBe('7 gp 5 sp');
    expect(suggestedSale({ sp: 3 }, 1, 50, rules)).toBe('1 sp 5 cp');
    expect(suggestedSale({ cp: 1 }, 1, 50, rules)).toBe('0 cp');
    expect(suggestedSale({ gp: 999 }, 999, 100, rules)).toBe('998001 gp');
    expect(suggestedSale(undefined, 1, 50, rules)).toBeNull();
    expect(suggestedSale({ gp: 5 }, 1, null, rules)).toBeNull();
  });
});

describe('the overnight card', () => {
  const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
  const h = 3600;

  // Purpose: the morning starts at 06:00, the night before at 22:00, and the card shows until the night comes.
  it('finds the morning the clock is in', () => {
    expect(morningOf(30 * h, units)).toEqual({ index: 1, start: 30 * h, nightStart: 22 * h, showing: true });
    expect(morningOf(45 * h, units)!.showing).toBe(true);
    expect(morningOf(46 * h, units)!.showing).toBe(false);
  });

  const stay = (id: string, at: number, extra: Record<string, unknown> = {}) =>
    toRequest({
      id,
      campaign_id: 'c',
      actor_id: 'wren',
      kind: 'lodging',
      direction: 'playerAsks',
      status: 'answered',
      answer: { kind: 'stay', listed: true },
      prompt: { listed: true, key: `lodging:${id}`, name: id, rate: '2 sp a night', at, town: 'Quay Gate' },
      created_at: '2026-11-04T10:00:00Z',
      ...extra,
    });

  // Purpose: last night's stay is the newest picked before the morning, in this town; a later pick or another town doesn't count.
  it('reads last night’s stay', () => {
    const requests = [stay('The Lantern Rest', 20 * h), stay('The Hay Loft', 31 * h), stay('Far Inn', 21 * h, { prompt: { listed: true, name: 'Far Inn', at: 21 * h, town: 'Elsewhere' } })];
    expect(stayFor(requests, 'wren', 'Quay Gate', 30 * h)).toEqual({ name: 'The Lantern Rest', rate: '2 sp a night' });
    expect(stayFor(requests, 'ash', 'Quay Gate', 30 * h)).toBeNull();
    expect(overnightLines({ name: 'The Lantern Rest', rate: '2 sp a night' }, [{ name: 'Weary', change: 'ended' }])).toEqual(['Last night: The Lantern Rest, 2 sp a night', 'Ended: Weary']);
    expect(overnightLines(null, [])).toEqual([]);
  });
});
