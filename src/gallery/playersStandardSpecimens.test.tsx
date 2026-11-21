// @vitest-environment jsdom
// The gallery's players page gains the Player screen's Light section (the sweep, plan m5b-players-screens-standard E).
// Purpose: three lights draw with the ring as their glyph: one just lit (a full arc), one at its last sixth (the
// warning sign beside its words, never colour alone), one that never runs out (a dashed track and no arc).
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayersStandardSpecimens } from './PlayersStandardSpecimens.tsx';

afterEach(cleanup);

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption>{name}</figcaption>
      <div className="stage">{children}</div>
    </figure>
  );
}

describe('the gallery’s Light section', () => {
  it('draws a full ring, a last sixth with the warning sign, and a dashed light that never runs out', () => {
    render(<PlayersStandardSpecimens Specimen={Specimen} />);
    const full = screen.getByRole('img', { name: 'Storm lantern, lit, 6 turns left' });
    const low = screen.getByRole('img', { name: 'Rushlight, lit, 1 turn left, running low' });
    const endless = screen.getByRole('img', { name: /^Glow-moss jar, lit/ });
    const block = (ring: Element) => ring.closest('.light-block')!;

    expect(full.querySelector('.status-ring__arc')).not.toBeNull();
    expect(block(full).querySelector('.warning-sign')).toBeNull();

    expect(low.querySelector('.status-ring__arc')).not.toBeNull();
    expect(block(low).querySelector('.light-block__words .warning-sign')).not.toBeNull();
    expect(block(low).querySelector('.light-block__name')!.textContent).toBe('Rushlight');
    expect(block(low).querySelector('.light-block__words')!.textContent).toBe('Lit, 1 turn left');

    expect(endless.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(endless.querySelector('.status-ring__arc')).toBeNull();
    // Each section has its own heading.
    expect(screen.getAllByRole('heading', { name: 'Light' })).toHaveLength(3);
  });

  // Purpose (Design on #561; tg-1, frame P1 of december/14): the ring leads the row, then the light's name and its line,
  // then the lit-or-out toggle at the right of the row; under the row, Keep lit (its name, ⓘ, its toggle). No Put out.
  it('puts the ring at the left of each light row, the name and line beside it, the toggle at its right, and Keep lit under it', () => {
    render(<PlayersStandardSpecimens Specimen={Specimen} />);
    const rows = document.querySelectorAll('.light-block__row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const [ring, body, toggle] = [...row.children];
      expect(ring!.classList.contains('light-block__ring')).toBe(true);
      expect(body!.classList.contains('light-block__body')).toBe(true);
      const [name, words] = [...body!.children];
      expect(name!.classList.contains('light-block__name')).toBe(true);
      expect(words!.classList.contains('light-block__words')).toBe(true);
      expect(toggle!.getAttribute('role')).toBe('switch');
      expect(toggle!.getAttribute('aria-checked')).toBe('true');
      const keep = row.nextElementSibling as HTMLElement;
      expect(keep.classList.contains('light-block__keep')).toBe(true);
      expect(within(keep).getByRole('switch', { name: 'Keep lit' })).toBeTruthy();
      expect(within(row.closest('.light-block') as HTMLElement).queryByRole('button', { name: 'Put out' })).toBeNull();
    }
    expect(screen.getByText('Lit, burns on')).toBeTruthy();
  });
});
