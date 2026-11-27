// @vitest-environment jsdom
// A skipped step reached by Back (final drafts F; clo-5, clo-17, picture creation/final 23-H3; L5 ⚑ 1 and ⚑ 2, Francis
// 2026-11-27). Invented words. The line's words as the app writes them, reached through the real steps, are tested in
// firstSpells.test.tsx ("a skipped First spells reached by Back says why").
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreationLeave } from '../ui/creation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { SkippedStep } from './Characters.tsx';

afterEach(cleanup);

function renderSkipped(why: string) {
  return render(
    <ToastHost>
      <CreationLeave onLeave={() => {}}>
        <SkippedStep title="First spells" counter={{ at: 7, of: 12 }} why={why} onBack={() => {}} onNext={() => {}} />
      </CreationLeave>
    </ToastHost>,
  );
}

describe('a skipped step reached by Back', () => {
  it('says "Nothing to choose here" once, in its foot, and draws no "Skipped" row', () => {
    // Purpose: as 23-H3 draws it, the foot says it once and nothing sits under the line (L5 ⚑ 1: the row is gone).
    renderSkipped('A Lantern Warden has no spells to pick.');
    expect(screen.getAllByText(/Nothing to choose here/)).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing to choose here');
    expect(screen.queryByText('Skipped')).toBeNull();
    expect(screen.queryByText(/comes back if you change/)).toBeNull();
  });

  it('shows its why-line above the foot', () => {
    // Purpose: the reason it is given is the step's line (clo-5).
    const { container } = renderSkipped('A Lantern Warden has no spells to pick.');
    expect(container.querySelector('.creation-step__why')?.textContent).toContain('A Lantern Warden has no spells to pick.');
  });

  it('keeps the whole of a long class name in the line', () => {
    // Purpose: a long name is never cut short in the words (the wrap itself is the line's CSS, seen at 375 px by hand).
    const long = 'A Warden of the Seventeen Drowned Lanterns of the Lower Bog has no spells to pick.';
    const { container } = renderSkipped(long);
    expect(container.querySelector('.creation-step__why')?.textContent).toContain(long);
  });

  it('with no reason, shows no why-line', () => {
    // Purpose: an empty reason draws no words above the foot (every step but First spells, L5 ⚑ 2).
    const { container } = renderSkipped('');
    expect(container.querySelector('.creation-step__why')?.textContent ?? '').toBe('');
  });
});
