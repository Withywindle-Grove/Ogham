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
import { StatusRing, StatusRingMark, StatusRingTap } from './StatusRing.tsx';

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

// Variant ring as a tap and the light's still looks (lt-2, lt-4, lt-5; page 35). Purposes:
//   The ring as a tap is one button, named for what it does ("Put out Torch"), its verb under the ring (decorative),
//   and a tap runs it; it is at least 72 by 76, with no edge.
//   Not lit draws the track alone (no arc, never dashed) and the symbol in the muted colour.
//   Burnt out draws the flame struck through, muted, and no arc; in a picture, not a button.
describe('the ring as a tap, and a light not burning', () => {
  it('is one button named for its action, the verb under the ring, at least 72 by 76 with no edge', async () => {
    const onTap = vi.fn();
    render(<StatusRingTap verb="Put out" label="Put out Torch" onTap={onTap} name="Torch" icon="flame" tone="light" fraction={4 / 6} />);
    const tap = screen.getByRole('button', { name: 'Put out Torch' });
    const [mark, verb] = [...tap.children];
    expect(mark!.classList.contains('status-ring__mark')).toBe(true);
    expect(verb!.textContent).toBe('Put out');
    expect(verb!.getAttribute('aria-hidden')).toBe('true');
    await userEvent.setup().click(tap);
    expect(onTap).toHaveBeenCalledTimes(1);
    const css = await ringCss();
    expect(css).toMatch(/\.status-ring-tap \{[^}]*inline-size: var\(--ring-tap-width\);[^}]*min-block-size: var\(--ring-tap-height\);[^}]*border: 0;/);
    expect(css).toMatch(/\.status-ring-tap:active \{[^}]*background: var\(--tint\)/);
    // The size lives in the tokens (72 by 76).
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    const tokens = fs.readFileSync('./src/ui/tokens.css', 'utf8');
    expect(tokens).toMatch(/--ring-tap-width: 72px;/);
    expect(tokens).toMatch(/--ring-tap-height: 76px;/);
  });

  it('not lit: no arc, a plain track, the symbol muted', () => {
    const { container } = render(<StatusRingMark name="Torch" icon="flame" tone="light" fraction={1} endless still="unlit" />);
    const mark = container.querySelector<HTMLElement>('.status-ring__mark')!;
    expect(arcOf(container)).toBeNull();
    expect(container.querySelector('.status-ring__track--endless')).toBeNull();
    expect(mark.style.getPropertyValue('--ring-tone')).toBe('var(--muted)');
    expect(container.querySelectorAll('.status-ring__symbol svg path')).toHaveLength(1);
  });

  it('burnt out: the flame struck through, muted, no arc, in a picture rather than a button', () => {
    const { container } = render(
      <span role="img" aria-label="Torch, burnt out">
        <StatusRingMark name="Torch" icon="flame" tone="light" fraction={null} still="out" />
      </span>,
    );
    const picture = screen.getByRole('img', { name: 'Torch, burnt out' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(arcOf(picture)).toBeNull();
    expect(picture.querySelector<HTMLElement>('.status-ring__mark')!.style.getPropertyValue('--ring-tone')).toBe('var(--muted)');
    // The flame and the stroke across it, in one drawing.
    expect([...container.querySelectorAll('.status-ring__symbol svg path')].map((p) => p.getAttribute('d'))).toContain('M4 21L20 3');
  });
});
