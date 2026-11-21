// @vitest-environment jsdom
// Slot bands on screen and in travel (ga-1, sr-9, bq-5): the Pack tab's two bars, and travel's speed from the same
// function. Invented numbers and names only (hard rule 2).
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { carriedLoad, combineEncumbrance, speedOf, type LoadLine } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { actorLoad } from '../modules/inventory/packView.ts';
import { LoadSummary } from './LoadSummary.tsx';
import { bandSpeedsOf } from './travelView.ts';

afterEach(cleanup);

const rules = combineEncumbrance([
  {
    mode: 'slot',
    slot: {
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
  },
]);

let next = 0;
const loadLine = (equipped: boolean): LoadLine => ({
  id: `line-${++next}`,
  name: 'Eel trap',
  category: 'gear',
  qty: 1,
  weightCoin: null,
  slots: 1,
  stack: 1,
  containerLineId: null,
  equipped,
  container: null,
  armourType: null,
});
const lines = (onBody: number, inBags: number) => [...Array.from({ length: onBody }, () => loadLine(true)), ...Array.from({ length: inBags }, () => loadLine(false))];

describe("the Pack tab's bars (sr-9)", () => {
  it('shows one bar per band with its count and speed, and names the slower one "sets your speed"', () => {
    render(<LoadSummary load={carriedLoad(lines(1, 6), rules, 'slot')} rules={rules} from={['Fen rules']} />);
    expect(screen.getByRole('button', { name: 'Speed 35' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Equipped 1 of 4 slots, speed 50', 'Stowed 6 of 9 slots, speed 35, sets your speed']);
  });

  it('opens both bands\' lists from the speed, and says the slower of the two sets it', async () => {
    render(<LoadSummary load={carriedLoad(lines(1, 6), rules, 'slot')} rules={rules} from={['Fen rules']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Speed 35' }));
    expect(screen.getByText('up to 7 slots, speed 35')).toBeTruthy();
    expect(screen.getByText('up to 4 slots, speed 25')).toBeTruthy();
    expect(screen.getByText('The slower of the two sets your speed.')).toBeTruthy();
    expect(screen.getByText('From your setting: Fen rules')).toBeTruthy();
  });

  it("says over in words on the band that's over and on top, never by colour alone", () => {
    render(<LoadSummary load={carriedLoad(lines(5, 0), rules, 'slot')} rules={rules} from={[]} />);
    expect(screen.getByRole('button', { name: 'Rooted to the spot' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')[0]?.textContent).toBe('Equipped 5 of 4 slots, Rooted to the spot');
  });

  it('names no band when both give the same speed (an empty pack)', () => {
    render(<LoadSummary load={carriedLoad([], rules, 'slot')} rules={rules} from={[]} />);
    expect(screen.queryByText(/sets your speed/)).toBeNull();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Equipped 0 of 4 slots, speed 50', 'Stowed 0 of 9 slots, speed 50']);
  });
});

describe('travel reads the same speed (bq-5)', () => {
  const inv = (actorId: string, equipped = false): InventoryLine =>
    ({ id: `inv-${++next}`, actorId, name: 'Eel trap', category: 'gear', slots: 1, stack: 1, qty: 1, containerLineId: null, equipped, approval: 'approved', details: {}, weightCoin: null, perUnits: 1 }) as InventoryLine;
  const pack = [...Array.from({ length: 6 }, () => inv('actor-wren')), inv('actor-moss', true)];
  const marchers = [
    { id: 'actor-wren', ownerUserId: 'user-wren' },
    { id: 'actor-moss', ownerUserId: 'user-moss' },
  ];

  it("gives each traveller the Pack tab's speed on the GM's device", () => {
    const speeds = bandSpeedsOf(pack, rules, marchers, { userId: 'user-gm', gm: true });
    expect(speeds?.get('actor-wren')).toBe(speedOf(actorLoad(pack, 'actor-wren', rules, 'slot')));
    expect(speeds?.get('actor-wren')).toBe(35);
    expect(speeds?.get('actor-moss')).toBe(50);
  });

  it("knows only a player's own characters on their device (others' packs are hidden)", () => {
    const speeds = bandSpeedsOf(pack, rules, marchers, { userId: 'user-moss', gm: false });
    expect(speeds?.get('actor-moss')).toBe(50);
    expect(speeds?.get('actor-wren')).toBeNull();
  });

  it('leaves travel to the database tier when the pack has no bands', () => {
    expect(bandSpeedsOf(pack, combineEncumbrance([{ mode: 'slot', slot: { tiers: [{ label: 'Spry', maxSlots: 3 }] } }]), marchers)).toBeNull();
  });
});
