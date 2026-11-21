// @vitest-environment jsdom
// When a sheet's foot stacks (ft-1, "buttons are right justified"): two or more buttons sit side by side at the right;
// only when they don't fit one row do they stack, in the same order. jsdom draws no layout, so each
// button's place is given; the real browser's is measured in tests/layout/sheetFoot.spec.ts. Purposes:
//   * buttons that fit one row stay a row (no stacked class), even of different heights (the accent is taller);
//   * a button that wrapped under the first makes the whole foot stack;
//   * a foot that fits again after a wider screen goes back to a row;
//   * a lone button never stacks;
//   * every Dialog measures its feet as it opens (the measure is wired to the card);
//   * a button that comes into a foot without the card changing size is measured too (the foot stacks).
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, stackFeet } from './Dialog.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Every button in a foot sits one row under the one before it: two or more always wrap (a narrow card). */
function wrapEveryButton() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const at = this.parentElement?.classList.contains('dialog__actions') ? [...this.parentElement.children].indexOf(this) : 0;
    const top = 100 + at * 60;
    return { top, bottom: top + 44, height: 44, left: 0, right: 80, width: 80, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
}

function Foot({ two }: { two: boolean }) {
  return (
    <Dialog label="Storm lantern" onClose={() => undefined}>
      <div className="dialog__actions" data-testid="foot">
        <button type="button" className="button-primary">
          Buy it
        </button>
        {two && (
          <button type="button" className="button-secondary">
            Leave it
          </button>
        )}
      </div>
    </Dialog>
  );
}

/** A card with one foot whose buttons sit at these tops and heights. */
function cardWith(places: { top: number; height: number }[]): { card: HTMLElement; foot: HTMLElement } {
  const card = document.createElement('div');
  const foot = document.createElement('div');
  foot.className = 'dialog__actions';
  for (const { top, height } of places) {
    const b = document.createElement('button');
    b.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 80, width: 80, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    foot.append(b);
  }
  card.append(foot);
  return { card, foot };
}

describe('when a foot stacks (ft-1)', () => {
  it('keeps buttons that fit one row as a row', () => {
    const { card, foot } = cardWith([
      { top: 100, height: 52 },
      { top: 104, height: 44 },
    ]);
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });

  it('stacks the whole foot when a button wrapped under the first', () => {
    const { card, foot } = cardWith([
      { top: 100, height: 52 },
      { top: 104, height: 44 },
      { top: 160, height: 44 },
    ]);
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(true);
  });

  it('goes back to a row once the buttons fit again', () => {
    const { card, foot } = cardWith([
      { top: 100, height: 52 },
      { top: 104, height: 44 },
    ]);
    foot.classList.add('dialog__actions--stacked');
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });

  it('never stacks a lone button', () => {
    const { card, foot } = cardWith([{ top: 100, height: 52 }]);
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });
});

/** A card with one foot this wide holding one group of stacked buttons this wide (stk-2, `StackedGroup`). */
function cardWithGroup(footWidth: number, groupWidth: number, buttons = 3): { card: HTMLElement; foot: HTMLElement } {
  const rect = (width: number) => () => ({ top: 100, bottom: 152, height: 52, left: 0, right: width, width, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
  const card = document.createElement('div');
  const foot = document.createElement('div');
  foot.className = 'dialog__actions';
  foot.getBoundingClientRect = rect(footWidth);
  const group = document.createElement('div');
  group.className = 'stacked-group';
  group.getBoundingClientRect = rect(groupWidth);
  for (let i = 0; i < buttons; i++) group.append(document.createElement('button'));
  foot.append(group);
  card.append(foot);
  return { card, foot };
}

// A group of stacked buttons (stk-2) is one row that never wraps, so its foot stacks when the group is wider than it.
// Purposes:
//   * a group that fits the foot stays a row;
//   * a group wider than the foot (a phone) makes the foot stack, so the group turns to one column;
//   * a group of one button never stacks, nor does a foot that is not drawn (no width).
describe('when a foot with a group of stacked buttons stacks (stk-2, ft-1)', () => {
  it('keeps a group that fits the foot as a row', () => {
    const { card, foot } = cardWithGroup(416, 300);
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });

  it('stacks the foot when the group is wider than it', () => {
    const { card, foot } = cardWithGroup(319, 340);
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(true);
    // Measured again once it fits (a wider screen), it goes back to a row.
    foot.getBoundingClientRect = () => ({ top: 100, bottom: 152, height: 52, left: 0, right: 416, width: 416, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
    stackFeet(card);
    expect(foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });

  it('never stacks a group of one, nor a foot that is not drawn', () => {
    const one = cardWithGroup(100, 200, 1);
    stackFeet(one.card);
    expect(one.foot.classList.contains('dialog__actions--stacked')).toBe(false);
    const hidden = cardWithGroup(0, 200);
    stackFeet(hidden.card);
    expect(hidden.foot.classList.contains('dialog__actions--stacked')).toBe(false);
  });
});

describe("a Dialog's feet are measured (ft-1)", () => {
  it('measures its feet as it opens', () => {
    wrapEveryButton();
    render(<Foot two />);
    expect(screen.getByTestId('foot').classList.contains('dialog__actions--stacked')).toBe(true);
  });

  it('measures again when a button comes into a foot without the card changing size', async () => {
    wrapEveryButton();
    const { rerender } = render(<Foot two={false} />);
    expect(screen.getByTestId('foot').classList.contains('dialog__actions--stacked')).toBe(false);
    rerender(<Foot two />);
    await waitFor(() => expect(screen.getByTestId('foot').classList.contains('dialog__actions--stacked')).toBe(true));
  });
});
