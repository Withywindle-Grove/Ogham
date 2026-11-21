// @vitest-environment jsdom
// The gallery's Player screen states (dec-13 C11). Purpose: the three specimens draw the screen's own lines: "Opening…"
// as a status, the error as an alert with a Try again that is a real button (never disabled), and the offline line
// naming the stored copy's date; no middle dot.
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerStatesSpecimens } from './PlayerStatesSpecimens.tsx';

afterEach(cleanup);

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption>{name}</figcaption>
      <div className="stage">{children}</div>
    </figure>
  );
}

describe('the gallery’s Player screen states', () => {
  it('draws opening, couldn’t open and offline as the screen does', () => {
    render(<PlayerStatesSpecimens Specimen={Specimen} />);
    const stages = [...document.querySelectorAll('.stage')];
    expect(stages).toHaveLength(3);
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual(['Opening…', expect.stringMatching(/^Setting rules as of .+, offline$/)]);
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t open this character. Check your connection and try again.');
    const again = screen.getByRole('button', { name: 'Try again' });
    expect(again.hasAttribute('disabled')).toBe(false);
    for (const stage of stages) expect(stage.textContent).not.toMatch(/·/);
  });
});
