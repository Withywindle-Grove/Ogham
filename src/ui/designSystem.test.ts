// The design system's automatic checks (docs/06 "Gallery and screenshot tests"; ruled 2026-10-25): every token
// pair has enough contrast in both themes, no stylesheet uses raw spacing, type or colour values, and the app's own
// text follows the words guide. The browser checks (targets, text sizes, screenshots) are in tests/layout.
import { describe, expect, it } from 'vitest';
import { rawValues } from './rawValues.ts';
import { wordProblems } from './words.ts';

// The files are listed by Vite and read from disk (CSS read through Vite comes back empty in tests). Node's file
// reader is loaded by name so the app's type settings needn't include Node.
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const read = (paths: string[]) => Object.fromEntries(paths.map((p) => [p, fs.readFileSync(`.${p}`, 'utf8')]));
const styles = read(Object.keys(import.meta.glob('/src/**/*.css')));
const screens = read(Object.keys(import.meta.glob(['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/testing/**'])));
const tokensCss = styles['/src/ui/tokens.css']!;

/** A theme's colour tokens, read from tokens.css: the :root block (light) or the data-theme="dark" block. */
function colours(theme: 'light' | 'dark'): Record<string, string> {
  const read = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
  if (theme === 'light') return read(tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('/* Spacing scale')));
  const darkAt = tokensCss.indexOf(":root[data-theme='dark'] {");
  return read(tokensCss.slice(darkAt, tokensCss.indexOf('}', darkAt)));
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('contrast, both themes (WCAG 2.2 AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    const c = colours(theme);
    it(`${theme}: text tokens are at least 4.5:1 on page, surface and sheet; control edges and the focus ring at least 3:1`, () => {
      const short: string[] = [];
      for (const bg of ['page', 'surface', 'sheet']) {
        for (const fg of ['ink', 'muted', 'accent', 'warning', 'danger', 'info', 'book-label'])
          if (contrast(c[fg]!, c[bg]!) < 4.5) short.push(`${fg} on ${bg}: ${contrast(c[fg]!, c[bg]!).toFixed(2)}`);
        for (const edge of ['control', 'outline']) if (contrast(c[edge]!, c[bg]!) < 3) short.push(`${edge} on ${bg}: ${contrast(c[edge]!, c[bg]!).toFixed(2)}`);
      }
      if (contrast(c['on-accent']!, c.accent!) < 4.5) short.push('on-accent on accent');
      // A stat block's labels (December 5c, cr-c2) are text in the pop-up too.
      if (contrast(c['book-label']!, c.popup!) < 4.5) short.push(`book-label on popup: ${contrast(c['book-label']!, c.popup!).toFixed(2)}`);
      // The book format's sub-headings and a book table's band (dec-10 S3): the sub-heading is text on every ground an
      // entry sits on; the band holds a table's text.
      for (const bg of ['page', 'surface', 'sheet', 'popup']) if (contrast(c['book-subhead']!, c[bg]!) < 4.5) short.push(`book-subhead on ${bg}: ${contrast(c['book-subhead']!, c[bg]!).toFixed(2)}`);
      for (const fg of ['ink', 'muted']) if (contrast(c[fg]!, c['book-band']!) < 4.5) short.push(`${fg} on book-band: ${contrast(c[fg]!, c['book-band']!).toFixed(2)}`);
      // The Selected wash (tf-4): ink and muted text on it, and its edge against it and the pop-up behind.
      for (const fg of ['ink', 'muted']) if (contrast(c[fg]!, c.selected!) < 4.5) short.push(`${fg} on selected`);
      for (const bg of ['selected', 'popup', 'sheet']) if (contrast(c['selected-edge']!, c[bg]!) < 3) short.push(`selected-edge on ${bg}`);
      // Notes: the ramp's quiet fill behind the darkest step (light) or ink (dark).
      for (const tone of ['warning', 'danger', 'info']) {
        const text = theme === 'light' ? c[`${tone}-5`]! : c.ink!;
        if (contrast(text, c[`${tone}-1`]!) < 4.5) short.push(`${tone} note`);
      }
      expect(short).toEqual([]);
    });

    // S12 (st-10, 2026-11-14): a light's ring on a party circle is a graphic on its rank's surface, inside the card's
    // sheet on the page: the lit-light glow reaches 3:1 on all three.
    it(`${theme}: the lit-light glow is at least 3:1 on page, surface and sheet (a light's ring is a graphic)`, () => {
      const short = ['page', 'surface', 'sheet'].filter((bg) => contrast(c['light-glow']!, c[bg]!) < 3).map((bg) => `light-glow on ${bg}: ${contrast(c['light-glow']!, c[bg]!).toFixed(2)}`);
      expect(short).toEqual([]);
    });
  }
});

describe('tokens only', () => {
  it('no stylesheet uses a raw spacing, type or colour value (tokens.css is where they live)', () => {
    const raw = Object.entries(styles)
      .filter(([path]) => !path.endsWith('/tokens.css'))
      .flatMap(([path, css]) => rawValues(css).map((v) => `${path}:${v.line} ${v.property}: ${v.value}`));
    expect(raw).toEqual([]);
  });

  it('the checker finds raw values and leaves tokens, 0, sizes and borders alone', () => {
    const css = '.a {\n  padding: 6px 0;\n  font-size: 13px;\n  color: #ff0000;\n  margin: var(--space-2);\n  width: 320px;\n  border: 1px solid var(--rule);\n  gap: 0;\n}';
    expect(rawValues(css).map((v) => v.kind)).toEqual(['spacing', 'type', 'colour']);
  });
});

describe('one Close (tf-8)', () => {
  it('no screen writes Close as a text button: every Close is the ✕ part (CloseButton)', () => {
    const found = Object.entries(screens).flatMap(([path, source]) =>
      // A button with its own name (the disappearing message's "Close the message") is an action, not a view's Close.
      source.split(/\r?\n/).flatMap((line, n, lines) => ((/^\s*(‹ )?Close\s*$/.test(line) && !/aria-label=/.test(lines[n - 1] ?? '')) || /['"]‹ Close['"]/.test(line) ? [`${path}:${n + 1}`] : [])),
    );
    expect(found).toEqual([]);
  });

  // Purpose (ruled B 2026-11-03, tf-8's scope check): no pop-up has a Back ‹ that only closes it; a Back always goes
  // back a step, and closing is the ✕.
  it('no Back button closes a pop-up: a Back that would is the ✕ instead', () => {
    const closes = /aria-label="Back[^"]*"[^>]*onClick=\{(?:onClose|close|\(\) => (?:onClose|close(?:\.current)?)\(\))\}/;
    const found = Object.entries(screens).flatMap(([path, source]) => source.split(/\r?\n/).flatMap((line, n) => (closes.test(line) ? [`${path}:${n + 1}`] : [])));
    expect(found).toEqual([]);
    expect(closes.test('<button type="button" className="dialog__back" aria-label="Back" onClick={() => close.current()}>')).toBe(true);
  });
});

describe('words guide', () => {
  it("the app's own text has no exclamation marks, Title Case labels or listed phrases", () => {
    const found = Object.entries(screens).flatMap(([path, source]) => wordProblems(source).map((p) => `${path}:${p.line} ${p.why}: ${p.text}`));
    expect(found).toEqual([]);
  });

  it('the checker catches each kind and passes plain sentence case', () => {
    const source = ['<p>Saved successfully!</p>', "const label = 'Add New Item';", "const hint = 'Add item to the Party stash';", "const x = a !== b;"].join('\n');
    expect(wordProblems(source).map((p) => p.why)).toEqual(['exclamation mark', '"successfully"', 'Title Case']);
  });
});
