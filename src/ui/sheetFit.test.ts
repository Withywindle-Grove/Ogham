// How a sheet fits a tablet's screen (creation retest 4, 2026-11-09). Read from the stylesheet: jsdom draws no layout;
// the gallery's sheet specimens show it in a real browser. Purposes:
//   T2: on an iPad the last row and the foot of a sheet were cut off at the bottom. A sheet on a tablet keeps its foot
//       clear of the home indicator (the safe area in its padding) and is never taller than the screen; one placed
//       beside its button is capped from where it opens to the bottom, safe area included.
//   T4: a table sheet (trinkets, backgrounds, names, any describing table, the kit's rolls) takes the screen's width on
//       a tablet, by one rule for every table sheet, instead of the 440 px card that wrapped its rows as on a phone.
import { describe, expect, it } from 'vitest';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const css = fs.readFileSync('./src/ui/Dialog.css', 'utf8');

/** The body of the rule for `selector` inside the media block that starts with `media` ('' for none at the top level). */
function rule(selector: string, media = ''): string {
  const from = media ? css.indexOf(media) : 0;
  if (from < 0) return '';
  // The selector alone on its line (".dialog--anchored" is not ".dialog--table.dialog--anchored").
  const found = new RegExp(`(^|\\n)[ \\t]*${selector.replace(/[.]/g, '\\.')} \\{`).exec(css.slice(from));
  if (!found) return '';
  const at = from + found.index;
  return css.slice(at, css.indexOf('}', at));
}

describe('a sheet on a tablet (T2)', () => {
  it('keeps its foot clear of the home indicator and fits the screen', () => {
    const tablet = rule('.dialog--sheet', '@media (min-width: 700px)');
    expect(tablet).toContain('padding-bottom: calc(var(--pad) + env(safe-area-inset-bottom))');
    expect(tablet).toContain('env(safe-area-inset-bottom)');
    expect(tablet).toMatch(/max-height: calc\(100dvh/);
  });

  it('beside its button, is capped from where it opens to the bottom', () => {
    const anchored = rule('.dialog--anchored');
    expect(anchored).toContain('var(--sheet-top');
    expect(anchored).toContain('env(safe-area-inset-bottom)');
  });
});

describe('a table sheet on a tablet (T4)', () => {
  it('takes the screen’s width up to the page’s, one rule for every table sheet', () => {
    const table = rule('.dialog--table', '@media (min-width: 700px)');
    expect(table).toContain('width: min(1024px, 100%)');
    // Placed beside its button it still fits between the margins.
    expect(rule('.dialog--table.dialog--anchored', '@media (min-width: 700px)')).toContain('width: min(1024px, calc(100vw - 2 * var(--gutter)))');
  });
});
