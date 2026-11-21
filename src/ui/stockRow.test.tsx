// @vitest-environment jsdom
// The stock row (cs-21, picture creation/final 21-F5): the shared part the creation shop draws, built once for the town's
// market to reuse (po-2), and the shared stacked button its Buy is (stk-1, st-6). Invented names only.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ICON_SET } from './iconSet.ts';
import { StackedButton, StackedGroup, StockRow } from './parts.tsx';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };

afterEach(cleanup);

describe('the stock row (cs-21)', () => {
  it('names the thing as a tap to its entry, says what it is and its price, and Buy buys', async () => {
    // Purpose: the name opens the thing's entry (the link style, no ⓘ); the line under it says what it is and its
    // weight with the price beside it; the two-coins Buy is its own 44 px tap, named for the thing and its price.
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onBuy = vi.fn();
    render(
      <ul>
        <StockRow name="Waxed coat" line="Keeps the wet out and some blows. 150 coins' weight" price="10 silver" onOpen={onOpen} onBuy={onBuy} />
      </ul>,
    );
    await user.click(screen.getByRole('button', { name: 'Waxed coat' }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(document.querySelector('.stock-row__line')?.textContent).toBe("10 silverKeeps the wet out and some blows. 150 coins' weight");
    const buy = screen.getByRole('button', { name: 'Buy Waxed coat, 10 silver' });
    expect(buy.textContent).toBe('Buy');
    expect(buy.querySelector('svg')).not.toBeNull();
    await user.click(buy);
    expect(onBuy).toHaveBeenCalledOnce();
    // No ⓘ in the shop (cs-37): the name is the way to the entry.
    expect(document.querySelectorAll('svg')).toHaveLength(1);
  });

  it("says why the character can't use it, with the sign, and Buy still buys", async () => {
    // Purpose: a thing the class cannot use carries the warning sign and the words; it is never refused or disabled.
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(
      <ul>
        <StockRow name="Bog-iron coat" line="Heavy, rusty and very hard to cut. 400 coins' weight" price="40 silver" warn="A Reed Witch can't use it. Heavy iron drowns the whisper." onOpen={() => {}} onBuy={onBuy} />
      </ul>,
    );
    expect(document.querySelector('.warning-line')?.textContent).toContain("A Reed Witch can't use it. Heavy iron drowns the whisper.");
    expect(document.querySelector('.warning-sign')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Buy Bog-iron coat, 40 silver' }));
    expect(onBuy).toHaveBeenCalledOnce();
  });

  it('draws Buy as the shared stacked button, exactly as before', () => {
    // Purpose: lifting Buy's shape into the shared part changes nothing in the shop: Buy is still the secondary
    // button, the two coins above the word, its row's own class kept, named for the thing and its price.
    render(
      <ul>
        <StockRow name="Waxed coat" line="Keeps the wet out." price="10 silver" onOpen={() => {}} onBuy={() => {}} />
      </ul>,
    );
    const buy = screen.getByRole('button', { name: 'Buy Waxed coat, 10 silver' });
    expect([...buy.classList].sort()).toEqual(['button-secondary', 'stacked-button', 'stock-row__buy']);
    expect([...buy.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'span']);
    expect(buy.querySelector('svg')!.getAttribute('width')).toBe('24');
    expect(buy.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['two-coins'].d);
    expect(buy.querySelector('span')!.textContent).toBe('Buy');
  });
});

describe('the stacked button (stk-1, st-6)', () => {
  it('draws its icon from the set above its word, and does what it says', async () => {
    // Purpose: the part is an icon from the set above its word, never the icon alone; the word is its name, and a tap runs it.
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StackedButton icon="camping-tent" label="Make camp" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Make camp' });
    expect(button.getAttribute('type')).toBe('button');
    expect([...button.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'span']);
    expect(button.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 512 512');
    expect(button.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['camping-tent'].d);
    expect(button.querySelector('span')!.textContent).toBe('Make camp');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is secondary unless asked to be primary', () => {
    // Purpose: the two variants: the ordinary secondary button, and the accent (primary) one for the screen's main action.
    render(
      <>
        <StackedButton icon="check-mark" label="Done" onClick={() => {}} />
        <StackedButton icon="play-button" label="Start" variant="primary" onClick={() => {}} />
      </>,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    const start = screen.getByRole('button', { name: 'Start' });
    expect(done.classList.contains('button-secondary')).toBe(true);
    expect(done.classList.contains('button-primary')).toBe(false);
    expect(start.classList.contains('button-primary')).toBe(true);
    expect(start.classList.contains('button-secondary')).toBe(false);
    for (const button of [done, start]) expect(button.classList.contains('stacked-button')).toBe(true);
  });

  it('takes a fuller name for screen readers and its row’s own class', () => {
    // Purpose: where the word alone is too short to say what it does (Buy), the button carries a fuller name; a row may add its own class.
    render(<StackedButton icon="two-coins" label="Buy" aria-label="Buy Waxed coat, 10 silver" className="stock-row__buy" onClick={() => {}} />);
    const buy = screen.getByRole('button', { name: 'Buy Waxed coat, 10 silver' });
    expect(buy.textContent).toBe('Buy');
    expect(buy.classList.contains('stock-row__buy')).toBe(true);
  });

  it('is 44 px high and 88 px wide at least, its word centred on one line however long, with no widest (stk-2)', () => {
    // Purpose: the part's own style holds a 44 px tap high and two taps (88 px) wide, 8 px at its sides, the 14 px word
    // centred and never wrapped, and no cap on its width, so a long word widens the button; from tokens only.
    // (stk-2 replaces stk-1's two lines under a cap of two and a half taps, which this test asserted before.)
    const css = fs.readFileSync('./src/ui/parts.css', 'utf8');
    const rule = /\.stacked-button \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('min-inline-size: calc(var(--tap) * 2);');
    expect(rule).toContain('min-block-size: var(--tap);');
    expect(rule).toContain('padding: var(--space-1) var(--space-2);');
    expect(rule).toContain('font-size: var(--text-14);');
    expect(rule).toContain('text-align: center;');
    expect(rule).toContain('flex-direction: column;');
    expect(rule).toContain('white-space: nowrap;');
    expect(rule).not.toMatch(/max-inline-size|max-width|overflow-wrap|word-break/);
    expect(rule).not.toMatch(/\d+px/);
  });

  it('gives stacked buttons that sit together one width, the widest one’s (stk-2, the Group variant)', () => {
    // Purpose: StackedGroup wraps its buttons in `.stacked-group`, a grid of equal columns side by side in code order
    // (each a share of a width sized to the widest), every button filling its column and the row's height, the 8 px gap.
    render(
      <StackedGroup>
        <StackedButton icon="check-mark" label="Done" onClick={() => {}} />
        <StackedButton icon="two-coins" label="Add" onClick={() => {}} />
        <StackedButton icon="run" label="Ask for escape rolls" onClick={() => {}} />
      </StackedGroup>,
    );
    const group = screen.getByRole('button', { name: 'Done' }).parentElement!;
    expect(group.className).toBe('stacked-group');
    expect([...group.children].map((b) => b.textContent)).toEqual(['Done', 'Add', 'Ask for escape rolls']);
    const css = fs.readFileSync('./src/ui/parts.css', 'utf8');
    const rule = /\.stacked-group \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('display: inline-grid;');
    expect(rule).toContain('grid-auto-flow: column;');
    expect(rule).toContain('grid-auto-columns: 1fr;');
    expect(rule).toContain('gap: var(--gap);');
    const each = /\.stacked-group > \.stacked-button \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(each).toContain('justify-self: stretch;');
    expect(each).toContain('align-self: stretch;');
    expect(each).toContain('inline-size: 100%;');
    // It comes after the primary's own width (`width: auto`), so inside a group it fills its column.
    expect(css.indexOf('.stacked-group > .stacked-button {')).toBeGreaterThan(css.indexOf('.button-primary.stacked-button {'));
  });

  it('sizes a primary stacked button to its word on a phone, not to the full width', () => {
    // Purpose: the phone's full-width primary button (App.css) must not stretch a primary stacked button to its cap;
    // a rule of two classes, stronger than App.css's one, gives it its own width back, and the secondary Buy is untouched.
    const parts = fs.readFileSync('./src/ui/parts.css', 'utf8');
    const app = fs.readFileSync('./src/app/App.css', 'utf8');
    expect(app).toMatch(/\.button-primary \{\s*width: 100%;/);
    expect(/\.button-primary\.stacked-button \{([^}]*)\}/.exec(parts)?.[1]?.trim()).toBe('width: auto;');
    expect(/\.stacked-button \{([^}]*)\}/.exec(parts)?.[1]).not.toContain('width: auto');
    expect(parts).not.toMatch(/\.stock-row__buy \{/);
  });
});
