// @vitest-environment jsdom
// A skipped step reached by Back (final drafts F; clo-5, clo-17, picture creation/final 23-H3; #794's review). Invented words.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreationLeave } from '../ui/creation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { SkippedStep, skippedWhy } from './Characters.tsx';

afterEach(cleanup);

function renderSkipped(why: string) {
  return render(
    <ToastHost>
      <CreationLeave onLeave={() => {}}>
        <SkippedStep title="First spells" counter={{ at: 7, of: 12 }} why={why} classWord="Class" onBack={() => {}} onNext={() => {}} />
      </CreationLeave>
    </ToastHost>,
  );
}

describe('a skipped step reached by Back', () => {
  it('says "Nothing to choose here" once, in its foot, with the row saying when it comes back', () => {
    // Purpose: the step's line and its foot both said it; H3 keeps the foot's words, said once, with the why-line above.
    renderSkipped(skippedWhy('spells', 'Lantern Warden'));
    expect(screen.getAllByText(/Nothing to choose here/)).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing to choose here');
    expect(screen.getByText('This step comes back if you change your class.')).toBeTruthy();
  });

  it('says why in its line, made from the class and what the Magic step offers', () => {
    // Purpose: a skipped Magic step reached by Back says why (clo-5): the class has no spells to pick.
    const { container } = renderSkipped(skippedWhy('spells', 'Lantern Warden'));
    expect(container.querySelector('.creation-step__why')?.textContent).toContain('A Lantern Warden has no spells to pick.');
  });

  it('keeps the whole of a long class name in the line', () => {
    // Purpose: a long name is never cut short in the words (the wrap itself is the line's CSS, seen at 375 px by hand).
    const long = 'Warden of the Seventeen Drowned Lanterns of the Lower Bog';
    const { container } = renderSkipped(skippedWhy('spells', long));
    expect(container.querySelector('.creation-step__why')?.textContent).toContain(`A ${long} has no spells to pick.`);
  });

  it('with no reason, shows no why-line', () => {
    // Purpose: an empty reason draws no words above the row.
    const { container } = renderSkipped('');
    expect(container.querySelector('.creation-step__why')?.textContent ?? '').toBe('');
  });
});

describe('the skipped step’s why-line', () => {
  it('names the class in the singular, as the pack gives it', () => {
    // Purpose: clo-17 rules the singular ("A Lantern Warden"), never "Lantern Wardens".
    expect(skippedWhy('spells', 'Lantern Warden')).toBe('A Lantern Warden has no spells to pick.');
    expect(skippedWhy('spells', 'Ember-reader')).toBe('An Ember-reader has no spells to pick.');
  });

  it('is made from the class name and the step alone, with no pack field read', () => {
    // Purpose: clo-5 adds no pack field: the line takes two plain strings, so the same words come for any setting.
    expect(skippedWhy('weaponSkills', 'Lantern Warden')).toBe('A Lantern Warden has no weapon skills to pick.');
    expect(skippedWhy('expertise', 'Lantern Warden')).toBe('A Lantern Warden has no skill points to spend.');
  });

  it('stays empty where the step’s check is not the class’s, or no class is named', () => {
    // Purpose: the line never guesses a reason: a step skipped for another cause, or with no class, says nothing there.
    expect(skippedWhy('languages', 'Lantern Warden')).toBe('');
    expect(skippedWhy('details', 'Lantern Warden')).toBe('');
    expect(skippedWhy('trait:knots', 'Lantern Warden')).toBe('');
    expect(skippedWhy('spells', '  ')).toBe('');
  });
});
