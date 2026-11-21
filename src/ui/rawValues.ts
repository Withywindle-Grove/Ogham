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
