// @vitest-environment jsdom
// The creation review's gallery specimens (after-test A10; dec-10 G, #794's review). Purpose:
//   The specimens' foot is the live review's (cs-36): the quiet pair, Start over then Save and leave, then the accent
//   Send to the GM outermost; so their pictures match the live review.
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreationReviewSpecimens } from './CreationReviewSpecimens.tsx';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation((() => {}) as unknown as typeof window.scrollTo);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Specimen = ({ name, children }: { name: string; children: ReactNode }) => <section aria-label={name}>{children}</section>;

describe('the review specimens (after-test A10)', () => {
  it("have the live review's foot: Start over, Save and leave, then Send to the GM", () => {
    render(<CreationReviewSpecimens Specimen={Specimen} />);
    expect(screen.getAllByRole('button', { name: 'Send to the GM' }).length).toBeGreaterThan(0);
    const feet = [...document.querySelectorAll('.creation-step__foot')].map((foot) => [...foot.querySelectorAll('button')].map((b) => b.textContent));
    expect(feet.slice(0, 2)).toEqual([
      ['Start over', 'Save and leave', 'Send to the GM'],
      ['Start over', 'Save and leave', 'Send to the GM'],
    ]);
  });
});
