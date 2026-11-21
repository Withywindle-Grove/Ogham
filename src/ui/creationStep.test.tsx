// @vitest-environment jsdom
// The creation step shell (docs/06, Creation step shell; the second test, 2026-11-02):
//   Every step opens at its top: the shell scrolls up when it appears, and again when it is reused for another step
//   (the trait-list steps share one shell and change only the title and the counter), never on an ordinary re-render.
//   The Scores step asks for the wide variant: room for four score tiles on an iPad's landscape row.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreationStep } from './creation.tsx';

let scrolled: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrolled = vi.fn();
  vi.spyOn(window, 'scrollTo').mockImplementation(scrolled as unknown as typeof window.scrollTo);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const step = (title: string, at: number, hint = 'Nothing picked', wide = false) => (
  <CreationStep title={title} counter={{ at, of: 9 }} why="Why it matters." help={null} onBack={() => {}} hint={hint} onNext={() => {}} wide={wide}>
    <p>Rows</p>
  </CreationStep>
);

describe('CreationStep', () => {
  it('scrolls to the top when it appears and when it becomes another step, not on other re-renders', () => {
    const { rerender } = render(step('Background', 7));
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled).toHaveBeenLastCalledWith({ top: 0 });
    rerender(step('Background', 7, 'Reed-cutter picked'));
    expect(scrolled).toHaveBeenCalledTimes(1);
    rerender(step('Omen', 8));
    expect(scrolled).toHaveBeenCalledTimes(2);
    expect(scrolled).toHaveBeenLastCalledWith({ top: 0 });
  });

  it('the wide variant is a named class, only when asked', () => {
    const { container, rerender } = render(step('Scores', 1));
    expect(container.querySelector('.creation-step--wide')).toBeNull();
    rerender(step('Scores', 1, 'All 6 entered', true));
    expect(container.querySelector('.creation-step--wide')).not.toBeNull();
  });

  // Purpose: a creation step's foot puts its line first (ex-9), while a foot with an extra button (the New campaign
  // steps) keeps the older order, the extra then the line, under its own named class, so those steps look as before.
  it('the foot puts the line first, but a foot with an extra keeps the extra before the line', () => {
    const { container, rerender } = render(step('Background', 7));
    const order = () => [...container.querySelector('.creation-step__foot')!.children].map((el) => el.className.split(' ')[0]);
    expect(order()[0]).toBe('creation-step__hint');
    expect(container.querySelector('.creation-step__foot--extra')).toBeNull();
    rerender(
      <CreationStep title="Setting rules" counter={{ at: 1, of: 3 }} why="Why it matters." help={null} onBack={() => {}} hint="2 picked" onNext={() => {}} footExtra={<span className="extra">Import a file…</span>}>
        <p>Rows</p>
      </CreationStep>,
    );
    expect(order().slice(0, 2)).toEqual(['extra', 'creation-step__hint']);
    expect(container.querySelector('.creation-step__foot--extra')).not.toBeNull();
  });
});
