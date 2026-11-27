// Finds raw spacing, type and colour values in a stylesheet (docs/06 "Design tokens": every value comes from a
// token). Spacing is margin, padding, gap and position offsets; type is font-size and line-height; colour is any
// hex, rgb() or hsl() value. Sizes (width, height), borders, media queries and the tokens file itself are left
// alone; 0 and percentages are fine. Pure, so a test can run it over every CSS file.

const SPACING = /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|margin-[a-z-]+|padding-[a-z-]+|inset-[a-z-]+|scroll-padding[a-z-]*)$/;
const TYPE = /^(font-size|line-height)$/;
const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
// A length that isn't 0: 12px, 1.5rem, 2em.
const LENGTH = /(?<![\w-])(?!0(?:px|rem|em)?\b)\d*\.?\d+(px|rem|em)\b/;

export interface RawValue {
  line: number;
  property: string;
  value: string;
  kind: 'spacing' | 'type' | 'colour';
}

export function rawValues(css: string): RawValue[] {
  const found: RawValue[] = [];
  // Comments out, keeping line numbers.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const lines = text.split('\n');
  let depth = 0;
  const mediaDepths: number[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (/^@media|^@supports|^@container/.test(line)) mediaDepths.push(depth);
    const declaration = /^([a-z-]+)\s*:\s*(.+?);?$/i.exec(line);
    if (declaration && !line.startsWith('--')) {
      const property = declaration[1]!.toLowerCase();
      const value = declaration[2]!;
      // A calc() built on a token (a tap-size trick) is the token's value, not a raw one.
      const bare = value.replace(/calc\((?=[^;]*var\()[^;]*\)/g, '').replace(/var\([^)]*\)/g, '');
      if ((SPACING.test(property) || TYPE.test(property)) && LENGTH.test(bare))
        found.push({ line: index + 1, property, value, kind: TYPE.test(property) ? 'type' : 'spacing' });
      else if (COLOUR_VALUE.test(value.replace(/var\([^)]*\)/g, '')) && !/shadow/.test(property))
        found.push({ line: index + 1, property, value, kind: 'colour' });
    }
    for (const ch of line) {
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (mediaDepths.length > 0 && depth === mediaDepths[mediaDepths.length - 1]) mediaDepths.pop();
      }
    }
  });
  return found;
}

// Check 5 (hard rule 7; docs/specs/hard-rule-and-size-checks.md): the same rule for inline `style={…}` values in a
// component's source. A raw value is one written in the source: a length with a unit, a colour literal (hex, rgb, hsl
// or a named colour), or a bare number on a spacing, size, type or colour property. A token, a calc() of tokens, 0, a
// percentage, a bare number on any other property (flex, order, opacity, z-index) and a value computed at run time
// (`${measured}px`, a variable) are fine. Style objects built outside the attribute are not read.

export interface InlineRawValue {
  line: number;
  /** The property as CSS writes it (marginTop is margin-top; custom properties as they are). */
  property: string;
  value: string;
  kind: 'length' | 'colour' | 'bare number';
}

/** The index of the bracket that closes the one at `open`, skipping strings, templates and comments; -1 if none. */
function closing(src: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]!;
    if (ch === "'" || ch === '"') i = stringEnd(src, i);
    else if (ch === '`') i = templateEnd(src, i);
    else if (ch === '/' && src[i + 1] === '/') i = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i);
    else if (ch === '/' && src[i + 1] === '*') i = src.indexOf('*/', i) < 0 ? src.length : src.indexOf('*/', i) + 1;
    else if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function stringEnd(src: string, start: number): number {
  for (let i = start + 1; i < src.length; i += 1) {
    if (src[i] === '\\') i += 1;
    else if (src[i] === src[start] || src[i] === '\n') return i;
  }
  return src.length;
}

function templateEnd(src: string, start: number): number {
  for (let i = start + 1; i < src.length; i += 1) {
    if (src[i] === '\\') i += 1;
    else if (src[i] === '`') return i;
    else if (src[i] === '$' && src[i + 1] === '{') {
      const end = closing(src, i + 1);
      if (end < 0) return src.length;
      i = end;
    }
  }
  return src.length;
}

/** Splits `text` at each top-level `separator`, outside strings, templates and brackets. Returns [start, end] spans. */
function topLevel(text: string, separator: RegExp): [number, number][] {
  const spans: [number, number][] = [];
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === "'" || ch === '"') i = stringEnd(text, i);
    else if (ch === '`') i = templateEnd(text, i);
    else if ('{(['.includes(ch)) i = Math.max(i, closing(text, i));
    else {
      const sep = separator.exec(text.slice(i));
      if (sep && sep.index === 0) {
        spans.push([from, i]);
        i += sep[0].length - 1;
        from = i + 1;
      }
    }
  }
  spans.push([from, text.length]);
  return spans;
}

/** The static text of each string and template literal in an expression; a template's `${…}` parts are left out. */
export function literals(expr: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i]!;
    if (ch === "'" || ch === '"') {
      const end = stringEnd(expr, i);
      out.push(expr.slice(i + 1, end));
      i = end;
    } else if (ch === '`') {
      const end = templateEnd(expr, i);
      let text = '';
      for (let j = i + 1; j < end; j += 1) {
        if (expr[j] === '$' && expr[j + 1] === '{') {
          const c = closing(expr, j + 1);
          if (c < 0) break; // an unclosed `${`: stop here rather than loop for ever
          j = c;
        } else text += expr[j];
      }
      out.push(text);
      i = end;
    }
  }
  return out;
}

// CSS's named colours (transparent and currentColor are not colours of their own, so they are fine).
const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
    'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue ' +
    'slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
const namesColour = (text: string) => (text.toLowerCase().match(/[a-z][a-z-]*/g) ?? []).some((word) => NAMED_COLOURS.has(word));

const kebab = (name: string) => (name.startsWith('--') ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

// Spacing, size, type and colour properties, as CSS writes them: a bare number on one of these is React's pixels
// (or, for line-height and font-weight, a unitless value that has a token).
const MEASURED =
  /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|(margin|padding|inset|scroll-padding|scroll-margin)(-[a-z-]+)?|(min-|max-)?(width|height|inline-size|block-size)|flex-basis|font-size|font-weight|line-height|letter-spacing|word-spacing|text-indent|border-radius|border(-[a-z-]+)?-(width|radius)|outline-(width|offset)|stroke-width|color|background(-color)?|fill|stroke|[a-z-]+-color)$/;
// Properties React writes without a unit, so a bare number on them is not pixels.
const UNITLESS = new Set(['line-height', 'font-weight']);

/** True when one side of the value (a ternary's or a fallback's) is a plain number other than 0. */
function bareNumber(value: string): boolean {
  return topLevel(value, /^(\?\?|\|\||&&|\?(?!\.)|:)/).some(([from, to]) => {
    const side = value.slice(from, to).trim().replace(/^\(\s*(.*?)\s*\)$/, '$1');
    return /^-?\d*\.?\d+$/.test(side) && Number(side) !== 0;
  });
}

function rawKind(property: string, value: string): InlineRawValue['kind'] | null {
  const texts = literals(value).map((t) => t.replace(/var\([^)]*\)/g, ''));
  if (texts.some((t) => LENGTH.test(t))) return 'length';
  if (texts.some((t) => COLOUR_VALUE.test(t) || namesColour(t))) return 'colour';
  if (MEASURED.test(property) && bareNumber(value)) return 'bare number';
  return null;
}

/** A style object's text with its comments blanked (same length, newlines kept), skipping strings and templates, so a
 * comment line never becomes part of the next member's name. */
function withoutComments(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    let end = i;
    if (ch === "'" || ch === '"') end = stringEnd(src, i);
    else if (ch === '`') end = templateEnd(src, i);
    else if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const stop = src[i + 1] === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2) + 2;
      end = (stop < i + 2 ? src.length : stop) - 1;
      out += src.slice(i, end + 1).replace(/[^\n]/g, ' ');
      i = end;
      continue;
    }
    out += src.slice(i, end + 1);
    i = end;
  }
  return out;
}

export function inlineRawValues(source: string): InlineRawValue[] {
  const found: InlineRawValue[] = [];
  const lineAt = (index: number) => source.slice(0, index).split('\n').length;
  for (const attribute of source.matchAll(/\bstyle=\{/g)) {
    const open = attribute.index + attribute[0].length - 1;
    const end = closing(source, open);
    if (end < 0) continue;
    // Every object literal inside the attribute's expression (a ternary may hold one on each side).
    for (let i = open + 1; i < end; i += 1) {
      if (source[i] !== '{') continue;
      const close = closing(source, i);
      if (close < 0) break;
      const body = withoutComments(source.slice(i + 1, close)); // same length, so line numbers hold
      for (const [from, to] of topLevel(body, /^,/)) {
        const member = body.slice(from, to);
        const colon = topLevel(member, /^:/);
        if (colon.length < 2) continue; // a spread or a shorthand: the value is computed elsewhere
        const name = member.slice(colon[0]![0], colon[0]![1]).trim().replace(/^['"]|['"]$/g, '');
        const value = member.slice(colon[1]![0]).trim();
        const kind = rawKind(kebab(name), value);
        if (kind) found.push({ line: lineAt(i + 1 + from + member.search(/\S/)), property: kebab(name), value, kind });
      }
      i = close;
    }
  }
  return found;
}

/** An old break, listed beside the test with its reason (src/ui/inlineStyles.known.ts): one per file and property. */
export interface KnownInlineBreak {
  file: string;
  property: string;
  reason: string;
}

const KIND_WORDS: Record<InlineRawValue['kind'], string> = { length: 'a raw length', colour: 'a raw colour', 'bare number': 'a bare number (pixels)' };
const words = (b: InlineRawValue) => (b.kind === 'bare number' && UNITLESS.has(b.property) ? 'a bare number' : KIND_WORDS[b.kind]);

/** Every inline raw value in `sources` (path to source) not on the known list, and every known entry that no longer breaks. */
export function inlineProblems(sources: Record<string, string>, known: KnownInlineBreak[]): string[] {
  const isKnown = (file: string, property: string) => known.some((k) => k.file === file && k.property === property);
  const breaks = Object.entries(sources).flatMap(([file, source]) => inlineRawValues(source).map((v) => ({ file, ...v })));
  const fresh = breaks.filter((b) => !isKnown(b.file, b.property)).map((b) => `${b.file}:${b.line} ${b.property}: ${b.value} is ${words(b)}; use a token (hard rule 7)`);
  const stale = known
    .filter((k) => !breaks.some((b) => b.file === k.file && b.property === k.property))
    .map((k) => `${k.file} ${k.property} is on the known list (src/ui/inlineStyles.known.ts) but no longer breaks: take it off the list`);
  return [...fresh, ...stale];
}
