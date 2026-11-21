// A score tile's long name (Design on #544, 2026-11-07). Purpose:
//   A name never breaks inside a word: on a phone, a name too long to sit beside the stepper takes its own line and the
//   stepper drops under it at the right, the caption under both; a short name stays beside its stepper. Scores and Adjust
//   alike. (Read from the stylesheet: jsdom draws no layout; tests/layout/gallery.spec.ts checks it in a real browser.)
import { describe, expect, it } from 'vitest';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const css = fs.readFileSync('./src/ui/creation.css', 'utf8');
const rule = (selector: string, from = 0) => {
  const at = css.indexOf(`${selector} {`, from);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};
const phone = css.search(/@media \(max-width: 600px\) \{\s*\.score-tiles \{/);

describe('a long score name wraps between words, never inside one', () => {
  it('the name wraps at words', () => {
    expect(rule('.score-tile__name')).toContain('overflow-wrap: break-word');
    expect(rule('.score-tile__name')).not.toContain('anywhere');
  });

  it('on a phone the row wraps: the stepper under a long name at the right, the caption under both', () => {
    expect(phone).toBeGreaterThan(0);
    expect(rule('.score-tiles .score-tile', phone)).toContain('flex-wrap: wrap');
    expect(rule('.score-tiles .score-tile__key', phone)).toContain('flex: 1 1 auto');
    expect(rule('.score-tiles .score-tile__value', phone)).toContain('margin-inline-start: auto');
    expect(rule('.score-tiles .score-tile__words', phone)).toContain('flex: 1 0 100%');
  });
});
