// Help me choose's width (P5, 2026-11-06; mockup creation/12). Purpose:
//   The block takes the column's full width and the open help the full width, while the button keeps its own words'
//   width on one line; the help's lines still keep a readable length. (Read from the stylesheet: jsdom draws no layout;
//   the gallery's creation scenes show it in a real browser.)
import { describe, expect, it } from 'vitest';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const css = fs.readFileSync('./src/ui/parts.css', 'utf8');
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('Help me choose takes the full width (P5)', () => {
  it('the block and the open help are full width; the button stays on one line at its own width', () => {
    expect(rule('.help-choose')).toContain('inline-size: 100%');
    expect(rule('.help-choose__panel')).toContain('justify-self: stretch');
    expect(rule('.help-choose__panel')).not.toContain('max-inline-size');
    expect(rule('.help-choose__link')).toContain('white-space: nowrap');
    // Final drafts A6: the button itself is full width too.
    expect(rule('.help-choose__link')).toContain('inline-size: 100%');
    expect(rule('.help-choose__text')).toContain('max-inline-size: var(--reading-width)');
  });
});
