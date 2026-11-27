// The design system's automatic checks (docs/06 "Gallery and screenshot tests"; ruled 2026-10-25): every token
// pair has enough contrast in both themes, no stylesheet uses raw spacing, type or colour values, and the app's own
// text follows the words guide. The browser checks (targets, text sizes, screenshots) are in tests/layout.
import { describe, expect, it } from 'vitest';
import { KNOWN_INLINE_BREAKS } from './inlineStyles.known.ts';
import { inlineProblems, inlineRawValues, literals, rawValues } from './rawValues.ts';
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

// Check 5 (hard rule 7; docs/specs/hard-rule-and-size-checks.md): the same rule for inline `style` values in the app's
// components. Planted sources use invented names only.
describe('tokens only in inline styles', () => {
  const found = (source: string) => inlineRawValues(source).map((v) => `${v.line} ${v.property}: ${v.kind}`);

  // Purpose: a length written with a unit in an inline style fails, naming its line, property and kind.
  it('a px or rem length fails', () => {
    expect(found('<p className="bog" style={{ padding: \'12px\' }}>\n  <i style={{ marginTop: "1.5rem" }} />\n</p>')).toEqual(['1 padding: length', '2 margin-top: length']);
  });

  // Purpose: a colour written as a literal fails, whether hex, rgb or a named colour, on its own or inside a ternary.
  it('a hex, rgb or named colour fails', () => {
    const source = "<b style={{ color: '#7a1f1f', background: lit ? 'rgb(10, 20, 30)' : 'var(--surface)' }} />\n<s style={{ borderColor: 'SlateGray' }} />";
    expect(found(source)).toEqual(['1 color: colour', '1 background: colour', '2 border-color: colour']);
  });

  // Purpose: a bare number on a spacing, size or type property is a pixel value React writes for you, so it fails too.
  it('a bare number on padding, width or font size fails', () => {
    const source = '<u style={{ padding: 12, width: wide ? 320 : -4, fontSize: (18) }} />';
    expect(found(source)).toEqual(['1 padding: bare number', '1 width: bare number', '1 font-size: bare number']);
  });

  // Purpose: what the rule allows passes: tokens, a calc() of tokens, 0, percentages, bare numbers on properties that
  // aren't spacing, size, type or colour, and values only known at run time (a measured position, a data fraction).
  it('a token, a calc of tokens, 0, a percentage and a bare number on flex, order, opacity or z-index pass', () => {
    const source = [
      "<a style={{ padding: 'var(--space-2) var(--space-3)', marginLeft: `calc(var(--space-5) * ${depth})`, gap: 'calc(var(--space-1) + var(--space-2))' }} />",
      "<a style={{ margin: 0, top: '0', inset: '0px', inlineSize: '56%', width: `${share * 100}%`, color: 'var(--ink)', background: 'transparent' }} />",
      "<a style={{ flex: 1, order: 2, opacity: 0.5, zIndex: 3, animationName: 'tan-fade', fontFamily: 'Lantern Sans' }} />",
      "<a style={shown ? ({ top: spot.top, '--lift-top': `${lift.top}px`, transform: `translateY(${by}px)`, ...rest } as Place) : undefined} />",
    ].join('\n');
    expect(found(source)).toEqual([]);
  });

  // Purpose: a bare number on a weight, radius, border, outline or stroke property fails too: each has a token.
  it('a bare number on font weight, border radius, border width, outline or stroke width fails', () => {
    const source = '<u style={{ fontWeight: 700, borderRadius: 8, borderTopWidth: 2, outlineOffset: 2, strokeWidth: 2 }} />';
    expect(found(source)).toEqual(['1 font-weight: bare number', '1 border-radius: bare number', '1 border-top-width: bare number', '1 outline-offset: bare number', '1 stroke-width: bare number']);
  });

  // Purpose: a comment line in a style object doesn't hide the member after it (it would pass silently otherwise).
  it('a comment before a member does not hide its bare number', () => {
    const source = '<u\n  style={{\n    // the gutter\n    padding: 12,\n    /* a note */ margin: 4,\n  }}\n/>';
    expect(found(source)).toEqual(['4 padding: bare number', '5 margin: bare number']);
  });

  // Purpose: a template with a `${` that never closes ends the scan instead of hanging the test run.
  it('an unclosed template part ends instead of looping', () => {
    expect(literals('`12px ${gap')).toEqual(['12px ']);
  });

  // Purpose: React writes line height and font weight without a unit, so the message doesn't call their number pixels.
  it('a bare line height is reported as a bare number, not pixels', () => {
    expect(inlineProblems({ '/src/app/Bog.tsx': '<i style={{ lineHeight: 1.5, gap: 4 }} />' }, [])).toEqual([
      '/src/app/Bog.tsx:1 line-height: 1.5 is a bare number; use a token (hard rule 7)',
      '/src/app/Bog.tsx:1 gap: 4 is a bare number (pixels); use a token (hard rule 7)',
    ]);
  });

  // Purpose: the known list only gets shorter: a listed break passes, a new one fails, and a fixed one still listed fails.
  it('a break on the known list passes; a new break, or a listed one that no longer breaks, fails', () => {
    const breaks = { '/src/app/Bog.tsx': "<i style={{ padding: '4px', color: 'red' }} />", '/src/app/Lurker.tsx': "<i style={{ gap: 'var(--space-1)' }} />" };
    const known = [
      { file: '/src/app/Bog.tsx', property: 'padding', reason: 'a planted old case' },
      { file: '/src/app/Lurker.tsx', property: 'gap', reason: 'fixed since' },
    ];
    expect(inlineProblems(breaks, known)).toEqual([
      "/src/app/Bog.tsx:1 color: 'red' is a raw colour; use a token (hard rule 7)",
      '/src/app/Lurker.tsx gap is on the known list (src/ui/inlineStyles.known.ts) but no longer breaks: take it off the list',
    ]);
  });

  // Purpose: the real components pass: every inline raw value is on the known list, and every listed one still breaks.
  it("the app's components write no raw value in an inline style outside the known list", () => {
    const components = Object.fromEntries(Object.entries(screens).filter(([path]) => !path.startsWith('/src/gallery/')));
    expect(inlineProblems(components, KNOWN_INLINE_BREAKS)).toEqual([]);
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
