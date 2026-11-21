// @vitest-environment jsdom
// A skipped step reached by Back (final drafts F; cs-51, picture creation/final 23-H3; #794's review). Invented words.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreationLeave } from '../ui/creation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { SkippedStep } from './Characters.tsx';

afterEach(cleanup);

describe('a skipped step reached by Back', () => {
  it('says "Nothing to choose here" once, in its foot, with the row saying when it comes back', () => {
    // Purpose: the step's line and its foot both said it; H3 keeps the foot's words, said once.
    render(
      <ToastHost>
        <CreationLeave onLeave={() => {}}>
          <SkippedStep title="First spells" counter={{ at: 7, of: 12 }} classWord="Class" onBack={() => {}} onNext={() => {}} />
        </CreationLeave>
      </ToastHost>,
    );
    expect(screen.getAllByText(/Nothing to choose here/)).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing to choose here');
    expect(screen.getByText('This step comes back if you change your class.')).toBeTruthy();
  });
});
