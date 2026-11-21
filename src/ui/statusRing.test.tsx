// @vitest-environment jsdom
// The Status ring part (06 Components; plan m5b-creation-retest-3 F; mockups players/02, players/03). Purposes:
//   A tile is one button (the tap), named for a screen reader; its ring, name and words are decorative inside it.
//   The arc draws the share of the time left: 4 of 6 is two thirds of the circle; 0 left draws no arc.
//   The ring's colour is its tone's token (light → glow, harm → danger, boon → info, neutral → ink), set on the ring.
//   A known icon draws its symbol; an unknown one, or none, draws the first letter in ink.
//   No end: the track is dashed and there is no arc.
//   The sheet's big ring is 84 px with a 7 px stroke; the tile's 52 px with 5.
//   The name stops at two lines (then …), the tile is 72 px wide and at least 88 tall: the CSS says so.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusRing, StatusRingMark } from './StatusRing.tsx';

afterEach(() => cleanup());

/** The part's own CSS, read from disk (the test runner doesn't load style sheets). */
async function ringCss() {
  const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
  return fs.readFileSync('./src/ui/StatusRing.css', 'utf8');
}

const arcOf = (root: ParentNode) => root.querySelector('.status-ring__arc');
const dashShare = (el: Element) => {
  const [drawn, length] = (el.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
  return drawn! / length!;
};

describe('the Status ring tile', () => {
  it('is one button, named for a screen reader, that opens the sheet', async () => {
    const onOpen = vi.fn();
    render(<StatusRing name="Blessed" icon="star" tone="boon" fraction={4 / 6} words="4 turns" label="Blessed, 4 turns left. Details" onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Blessed, 4 turns left. Details' });
    expect(button.textContent).toContain('Blessed');
    expect(button.textContent).toContain('4 turns');
    await userEvent.setup().click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('draws two thirds of the circle for 4 of 6, and no arc at 0 left', () => {
    const { container, rerender } = render(<StatusRingMark name="Blessed" icon="star" tone="boon" fraction={4 / 6} />);
    expect(dashShare(arcOf(container)!)).toBeCloseTo(2 / 3, 3);
    rerender(<StatusRingMark name="Blessed" icon="star" tone="boon" fraction={0} />);
    expect(arcOf(container)).toBeNull();
    expect(container.querySelector('.status-ring__track')).not.toBeNull();
  });

  it("takes its tone's colour token", () => {
    const tones = { light: 'var(--light-glow)', harm: 'var(--danger)', boon: 'var(--info)', neutral: 'var(--ink)' } as const;
    for (const [tone, token] of Object.entries(tones)) {
      const { container } = render(<StatusRingMark name="Torch-lit" icon="flame" tone={tone} fraction={1} />);
      const mark = container.querySelector<HTMLElement>('.status-ring__mark')!;
      expect(mark.style.getPropertyValue('--ring-tone')).toBe(token);
      cleanup();
    }
  });

  it('draws its symbol for a known icon; for an unknown one, or none, the first letter in ink', () => {
    const { container, rerender } = render(<StatusRingMark name="Poisoned" icon="drop" tone="harm" fraction={1} />);
    expect(container.querySelector('.status-ring__symbol svg')).not.toBeNull();
    expect(container.querySelector('.status-ring__letter')).toBeNull();
    rerender(<StatusRingMark name="muddy boots" icon="no-such-symbol" fraction={1} />);
    expect(container.querySelector('.status-ring__letter')?.textContent).toBe('M');
    expect(container.querySelector<HTMLElement>('.status-ring__mark')!.style.getPropertyValue('--ring-tone')).toBe('var(--ink)');
    rerender(<StatusRingMark name="Weary" fraction={1} />);
    expect(container.querySelector('.status-ring__letter')?.textContent).toBe('W');
  });

  it('with no end, dashes the track and draws no arc', async () => {
    const css = await ringCss();
    const { container } = render(<StatusRingMark name="Down" icon="bed" tone="harm" fraction={1} endless />);
    expect(container.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(arcOf(container)).toBeNull();
    expect(css).toMatch(/\.status-ring__track--endless \{[^}]*stroke-dasharray/);
  });

  it('is 84 px with a 7 px stroke in the sheet, 52 px with 5 on the tile', () => {
    const { container, rerender } = render(<StatusRingMark name="Blessed" fraction={1} big />);
    const svg = () => container.querySelector('svg.status-ring__svg')!;
    expect(svg().getAttribute('width')).toBe('84');
    expect(container.querySelector('.status-ring__track')!.getAttribute('stroke-width')).toBe('7');
    rerender(<StatusRingMark name="Blessed" fraction={1} />);
    expect(svg().getAttribute('width')).toBe('52');
    expect(container.querySelector('.status-ring__track')!.getAttribute('stroke-width')).toBe('5');
  });

  // Variant bare (S12, the party circle): the symbol alone in its tone, no ring; a letter drawn in ink, as text.
  it('bare: the symbol in its tone with no ring; with no symbol, the letter ("•" for a blank name) in ink', async () => {
    const { container, rerender } = render(<StatusRingMark name="Weary" icon="flame" tone="light" fraction={null} bare />);
    expect(container.querySelector('svg.status-ring__svg')).toBeNull();
    expect(container.querySelector('.status-ring__mark--bare')!.getAttribute('data-tone')).toBe('light');
    expect(container.querySelector('.status-ring__symbol svg')).not.toBeNull();
    rerender(<StatusRingMark name="  " tone="light" fraction={null} bare />);
    expect(container.querySelector('.status-ring__letter--bare')!.textContent).toBe('•');
    expect(await ringCss()).toMatch(/\.status-ring__letter--bare \{[^}]*color: var\(--ink\)/);
  });

  it('stops a long name at two lines, in a 72 × 88 tile', async () => {
    const css = await ringCss();
    expect(css).toMatch(/\.status-ring__name \{[^}]*-webkit-line-clamp: 2/);
    expect(css).toMatch(/\.status-ring \{[^}]*inline-size: 72px;[^}]*min-block-size: 88px/);
    expect(css).not.toMatch(/border-radius: var\(--radius-(pill|card|sheet)\)/);
  });
});
