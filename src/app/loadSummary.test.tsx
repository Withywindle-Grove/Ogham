// @vitest-environment jsdom
// The load bar: the Carrying treasure switch (pack review area 3, eq-3) and, eq-6 (ruled 2026-11-04,
// docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md), an item's `carryBonus` raising its wearer's limit while
// worn or held, named in the load breakdown (the tier words, tapped). Invented rules and names only.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  carriedLoad,
  combineEncumbrance,
  type CarriedLoad,
  type EncumbranceRules,
  type LoadLine,
} from '../modules/inventory/encumbrance.ts';
import { LoadSummary } from './LoadSummary.tsx';

afterEach(cleanup);

const treasureRules = {
  mode: 'armour',
  armour: {
    maxLoadCoin: 500,
    movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }],
    armourTypes: {},
  },
  treasureWeights: { gem: 1 },
  coin: null,
  slot: null,
  containers: 'hold-only',
  separateCategories: [],
} as unknown as EncumbranceRules;

const loadOf = (carriesTreasure: boolean): CarriedLoad => ({
  mode: 'armour',
  load: 4,
  capacity: 500,
  carriesTreasure,
  treasureSuggested: true,
  movement: carriesTreasure ? '70 ft' : '100 ft',
  over: false,
  overMax: '',
});

describe('the Carrying treasure switch on the load bar', () => {
  // Purpose: while carrying, the GM's button offers "Switch off", and a tap calls the handler.
  it('shows "Switch off" when carrying, and tapping it calls onSwitch', () => {
    const onSwitch = vi.fn();
    render(<LoadSummary load={loadOf(true)} rules={treasureRules} from={[]} treasure={{ gmSwitch: null, onSwitch }} />);
    expect(screen.getByText(', treasure in the pack', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  // Purpose: when not carrying, the button offers "Switch on", and a tap calls the handler.
  it('shows "Switch on" when not carrying, and tapping it calls onSwitch', () => {
    const onSwitch = vi.fn();
    render(<LoadSummary load={loadOf(false)} rules={treasureRules} from={[]} treasure={{ gmSwitch: false, onSwitch }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  // Purpose: a player sees why the switch reads as it does but gets no button.
  it('with no onSwitch, shows the words and no button', () => {
    render(<LoadSummary load={loadOf(true)} rules={treasureRules} from={[]} treasure={{ gmSwitch: null, onSwitch: null }} />);
    expect(screen.getByText(', treasure in the pack', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch o/ })).toBeNull();
  });
  // Purpose (Design, #479): two lines; the GM's call first, then the treasure, naming the rules' suggestion only when it differs.
  it("reads 'Not carrying treasure, the GM's call', then the treasure with the rules' suggestion when the GM differs", () => {
    const { container } = render(<LoadSummary load={{ ...loadOf(false), load: 1250, capacity: 1500 } as CarriedLoad} rules={treasureRules} from={[]} treasure={{ gmSwitch: false, onSwitch: null }} />);
    const lines = [...container.querySelectorAll('.pack__treasure-lines > p')].map((p) => p.textContent);
    expect(lines).toEqual(["Not carrying treasure, the GM's call", 'Treasure 1,250 of 1,500 coins’ weight. The rules suggest Carrying treasure']);
  });

  // Purpose: when the GM's switch agrees with the rules, no suggestion is added.
  it('adds no suggestion when the GM agrees with the rules', () => {
    const { container } = render(<LoadSummary load={loadOf(true)} rules={treasureRules} from={[]} treasure={{ gmSwitch: true, onSwitch: null }} />);
    expect(container.querySelector('.pack__treasure-lines > p:last-child')?.textContent).toBe('Treasure 4 of 500 coins’ weight');
  });
});

const rules = combineEncumbrance([
  { mode: 'coin', coin: { maxLoadCoin: 1000, tiers: [{ label: 'Easy', max: 300 }, { label: 'Bowed', max: 1000 }], overMax: 'Stuck' } },
]);
const line = (name: string, extra: Partial<LoadLine>): LoadLine => ({
  id: name,
  name,
  category: 'gear',
  qty: 1,
  weightCoin: null,
  slots: null,
  stack: 1,
  containerLineId: null,
  equipped: false,
  container: null,
  armourType: null,
  ...extra,
});

describe('the load breakdown names what raises the limit', () => {
  // Purpose: worn gauntlets show in the breakdown with their bonus; taken off, the line goes.
  it('names worn gauntlets and their bonus, and not when they are carried', async () => {
    const worn = carriedLoad([line('Ogre grips', { weightCoin: 10, equipped: true, carryBonus: 200 })], rules, 'coin');
    render(<LoadSummary load={worn} rules={rules} from={[]} />);
    expect(screen.getByText(/10 of 1,200 coins/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(screen.getByText('Ogre grips: +200 coins to each limit, while worn or in hand.')).toBeTruthy();
    cleanup();

    const carried = carriedLoad([line('Ogre grips', { weightCoin: 10, carryBonus: 200 })], rules, 'coin');
    render(<LoadSummary load={carried} rules={rules} from={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(screen.queryByText(/Ogre grips/)).toBeNull();
  });
});

// dec-13 C10 (docs/plans/dec-13-the-player-screen.md; frames P1 and P2 of december/14, ps-9, 2026-11-14): the Player
// screen says the speed once, on its speed card, so its load card uses the variant "speed said once": the tier's name
// alone on top, then the bar and the figures. Every other screen keeps the tier with its speed. Invented tiers.
describe('the load bar, variant "speed said once" (the Player screen)', () => {
  const coinRules = {
    mode: 'coin',
    armour: null,
    coin: {
      maxLoadCoin: 1200,
      miscGearCoin: 0,
      miscGearCategories: [],
      tiers: [
        { label: 'Unhurried', max: 450, effect: 'Full pace', movement: '125 ft' },
        { label: 'Bowed', max: 1200, effect: 'Crawling', movement: '50 ft' },
      ],
      overMax: 'Stuck in the mud',
    },
    slot: null,
    treasureWeights: {},
    containers: 'add',
    separateCategories: [],
  } as unknown as EncumbranceRules;
  const coin = (load: number): CarriedLoad => {
    const tier = coinRules.coin!.tiers.find((t) => load <= t.max) ?? null;
    return { mode: 'coin', load, capacity: 1200, tier, over: load > 1200, overMax: 'Stuck in the mud' };
  };
  const top = (container: HTMLElement) => container.querySelector('.pack__tier')?.textContent;

  // Purpose: on the Player screen the load card's top line is the tier's name alone, with no speed in it.
  it('shows the tier alone, without its speed', () => {
    const { container } = render(<LoadSummary load={coin(383)} rules={coinRules} from={[]} speedOnce />);
    expect(top(container)).toBe('Unhurried');
    expect(container.textContent).not.toMatch(/speed/i);
    expect(container.querySelector('.pack__bar')).toBeTruthy();
    // In coins' weight, as frame P1 says it (Francis's fix 6 of 19 Nov 2026).
    expect(screen.getByText('383 of 1,200 coins’ weight')).toBeTruthy();
  });

  // Purpose: every other screen (the Pack, the overview, starting gear, the full sheet) still reads the tier with its speed.
  it('leaves the plain load bar as it was: the tier, then its speed', () => {
    const { container } = render(<LoadSummary load={coin(383)} rules={coinRules} from={[]} />);
    expect(top(container)).toBe('Unhurried, speed 125');
  });

  // Purpose: an empty pack (0) reads the first tier, an empty bar and "0 of 1,200 coins".
  it('reads an empty pack: the first tier, an empty bar, 0 of the most', () => {
    const { container } = render(<LoadSummary load={coin(0)} rules={coinRules} from={[]} speedOnce />);
    expect(top(container)).toBe('Unhurried');
    expect((container.querySelector('.pack__fill') as HTMLElement).style.width).toBe('0%');
    expect(screen.getByText('0 of 1,200 coins’ weight')).toBeTruthy();
  });

  // Purpose: a heavy pack (999) names the later tier alone, marked as a warning, with its figures and no speed.
  it('reads a heavy pack (999): the later tier alone, as a warning', () => {
    const { container } = render(<LoadSummary load={coin(999)} rules={coinRules} from={[]} speedOnce />);
    expect(top(container)).toBe('Bowed');
    expect(container.querySelector('.pack__tier--warn')).toBeTruthy();
    expect(screen.getByText('999 of 1,200 coins’ weight')).toBeTruthy();
  });

  // Purpose: over the most, beside the speed card, the load card shows the warning sign with no words (the speed card
  // says them, dec-14 row 8, ruled 8a); the sign keeps the pack's own words as its spoken name, and the tiers stay one tap away.
  it('reads over the most as the warning sign alone, named by the pack, and opens the tiers on a tap', async () => {
    const { container } = render(<LoadSummary load={coin(1250)} rules={coinRules} from={[]} speedOnce />);
    expect(top(container)).toBe('');
    expect(container.querySelector('.pack__tier .warning-sign')).toBeTruthy();
    expect(screen.getByText('1,250 of 1,200 coins’ weight')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Stuck in the mud' }));
    expect(screen.getByText('Bowed: up to 1,200 coins, Crawling')).toBeTruthy();
  });

  // Purpose: with no speed card (the Pack, the GM's overview), over the most still says the pack's words beside the sign.
  it('keeps the words over the most without "speed said once"', () => {
    const { container } = render(<LoadSummary load={coin(1250)} rules={coinRules} from={[]} />);
    expect(top(container)).toBe('Stuck in the mud');
    expect(container.querySelector('.pack__tier .warning-sign')).toBeTruthy();
    expect(container.querySelector('.pack__tier')?.getAttribute('aria-label')).toBeNull();
  });
});
