// Square chits (R3-6, 2026-11-08, "no pill-shaped chips anywhere"): every chip takes the 4 px corner token, never a pill.
import { describe, expect, it } from 'vitest';

// Stylesheets read from disk (a CSS import is styles, not text, under the test runner), as designSystem.test.ts does.
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const sheets = Object.keys(import.meta.glob('/src/**/*.css')).map((p) => [p, fs.readFileSync(`.${p}`, 'utf8')] as const);
const tokens = sheets.find(([p]) => p.endsWith('/ui/tokens.css'))![1];

/** Each rule in a stylesheet: its selector and its declarations (media queries' insides included). */
function rules(css: string): { selector: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));
}
const radius = (body: string) => /border-radius:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? null;

// The chip-like parts: a chip, the tap-value pill, the log's filter chip, the marching order's name, the rest marker,
// the "lost" tag on the travel card, the offline pill.
const CHIPS = /\.chip\b|\.tap-value--pill|\.tap-values\b|\.log__chip\b|\.marching__who\b|\.rest-marker\b|\.travel__lost\b|\.offline-pill\b/;

describe('square chits', () => {
  it('the corner token is 4 px', () => {
    expect(tokens).toMatch(/--radius:\s*4px;/);
  });

  it('the shared chip takes the corner token', () => {
    const chip = sheets.flatMap(([, css]) => rules(css)).find((r) => r.selector === '.chip');
    expect(chip && radius(chip.body)).toBe('var(--radius)');
  });

  it('no chip anywhere is a pill (no pill token, no 999px, no 50 %)', () => {
    const pills = sheets.flatMap(([path, css]) =>
      rules(css)
        .filter((r) => CHIPS.test(r.selector))
        .filter((r) => {
          const value = radius(r.body);
          return value !== null && /radius-pill|999|50%/.test(value);
        })
        .map((r) => `${path}: ${r.selector}`),
    );
    expect(pills).toEqual([]);
  });
});
