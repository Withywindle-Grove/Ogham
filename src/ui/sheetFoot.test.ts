// A sheet's or pop-up's foot (ft-1, 2026-11-14, "buttons are right justified"; the approved
// Pack frames PK3, PK5, PK10b, the shop's TW4a): one rule in the shared foot (`.dialog__actions`), so every sheet has
// it. Read from the stylesheet: jsdom draws no layout; the gallery's "A sheet's foot" section measures it in a real
// browser (tests/layout/sheetFoot.spec.ts), and sheetFootStack.test.tsx tests when a foot stacks. Purposes:
//   * a foot with one accent: it sits at the right edge, at its own width (never stretched, never at the left), on a
//     phone too, where every other accent button is the screen's full width;
//   * a foot with two or more buttons: side by side, the group at the right, in the order written (no reordering, so
//     Tab and reading agree); stacked, each at the right, only when they don't fit one row;
//   * a stacked accent alone in a foot: the same rule, by the accent's class, at its own width.
import { describe, expect, it } from 'vitest';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const css = fs.readFileSync('./src/ui/Dialog.css', 'utf8');
const parts = fs.readFileSync('./src/ui/parts.css', 'utf8');

/** Every rule body in `sheet` whose selector list names `selector` exactly (one of its comma-separated parts). */
function rules(sheet: string, selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(sheet); m; m = re.exec(sheet)) {
    const names = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim());
    if (names.includes(selector)) out.push(m[2]!);
  }
  return out;
}

const decl = (bodies: string[], property: string) => bodies.flatMap((b) => [...b.matchAll(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim()));

describe("a sheet's foot (ft-1, 2026-11-14)", () => {
  it('a foot with one accent: it sits at the right edge, at its own width', () => {
    // The row's group sits at the right, so one button alone does too.
    expect(decl(rules(css, '.dialog__actions'), 'justify-content')).toEqual(['flex-end']);
    const accent = rules(css, '.dialog__actions > .button-primary');
    // Its own width: never stretched, and the phone's full-width accent (App.css) does not reach it.
    expect(decl(accent, 'align-self')).not.toContain('stretch');
    expect(decl(accent, 'width')).toContain('auto');
    // tf-4's full-width foot is gone from the shared foot.
    expect(decl(rules(css, '.dialog__actions > .button-secondary'), 'align-self')).not.toContain('stretch');
  });

  it('a foot with two or more buttons: side by side at the right, in the order written; stacked at the right only when they do not fit', () => {
    const foot = rules(css, '.dialog__actions');
    expect(decl(foot, 'display')).toEqual(['flex']);
    expect(decl(foot, 'flex-direction')).toEqual([]);
    expect(decl(foot, 'justify-content')).toEqual(['flex-end']);
    // No reordering anywhere in the foot: code order is reading order and Tab order (the order itself is the screen's).
    expect(css).not.toMatch(/\.dialog__actions[^{]*\{[^}]*\border:/);
    // A plain button's own `align-self: flex-start` would put it at the top of the row or the left of the stack.
    expect(decl(rules(css, '.dialog__actions > .button-secondary'), 'align-self')).toEqual(['auto']);
    // Stacked (Dialog.tsx adds the class when a row would wrap): a column, each at the right.
    const stacked = rules(css, '.dialog__actions--stacked');
    expect(decl(stacked, 'flex-direction')).toEqual(['column']);
    expect(decl(stacked, 'align-items')).toEqual(['flex-end']);
  });

  it('a stacked accent alone in a foot: the same rule, at its own width', () => {
    // A stacked accent is a `.button-primary` with `.stacked-button` (StackedButton), so the foot's accent rule is its
    // rule too; the stacked button has no width cap of its own any more (stk-2: its word on one line widens it; this
    // asserted stk-1's cap of two and a half taps before).
    expect(decl(rules(css, '.dialog__actions > .button-primary'), 'width')).toContain('auto');
    expect(decl(rules(parts, '.stacked-button'), 'max-inline-size')).toEqual([]);
    expect(decl(rules(parts, '.stacked-button'), 'min-inline-size')).toEqual(['calc(var(--tap) * 2)']);
  });

  it('a group of stacked buttons in a foot: stacked, it is one column of buttons at one width (stk-2)', () => {
    // The group's grid turns from one row to one column when the foot stacks; its one column is the widest button's,
    // so every button keeps that one width, and the foot's column puts it at the right.
    expect(decl(rules(css, '.dialog__actions--stacked > .stacked-group'), 'grid-auto-flow')).toEqual(['row']);
    expect(decl(rules(parts, '.stacked-group'), 'grid-auto-columns')).toEqual(['1fr']);
  });
});
