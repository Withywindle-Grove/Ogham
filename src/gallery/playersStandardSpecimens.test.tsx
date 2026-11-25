// @vitest-environment jsdom
// The gallery's players page draws the Player screen's light as At hand's block (the sweep, plan
// m5b-players-screens-standard E; page 35). Purpose: three lit lights draw with the ring as the tap: one just lit (a
// full arc), one at its last sixth (the warning sign beside its words, never colour alone), one that never runs out
// (a dashed track and no arc); then one light not lit, several, and a holder burnt out.
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

describe('the gallery’s light in At hand', () => {
  it('draws a full ring, a last sixth with the warning sign, a dashed light that never runs out, and the three not burning', () => {
    render(<PlayersStandardSpecimens Specimen={Specimen} />);
    const [full, low, endless] = screen.getAllByRole('button', { name: /^Put out / });
    const block = (ring: Element) => ring.closest('.light-block')!;

    expect(full!.getAttribute('aria-label')).toBe('Put out Storm lantern');
    expect(full!.querySelector('.status-ring__arc')).not.toBeNull();
    expect(block(full!).querySelector('.warning-sign')).toBeNull();

    expect(low!.querySelector('.status-ring__arc')).not.toBeNull();
    expect(block(low!).querySelector('.light-block__words .warning-sign')).not.toBeNull();
    expect(block(low!).querySelector('.light-block__name')!.textContent).toBe('Rushlight');
    expect(block(low!).querySelector('.light-block__words')!.textContent).toBe('Running low. Lit, 1 turn left');

    expect(endless!.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(endless!.querySelector('.status-ring__arc')).toBeNull();

    expect(screen.getByRole('button', { name: 'Light Torch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light: choose which' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Storm lantern, burnt out' })).toBeTruthy();
    expect(screen.getByText('Burnt out. 3 refills left')).toBeTruthy();
    // No "Light" heading on any of them (lt-4).
    expect(screen.queryAllByRole('heading', { name: 'Light' })).toHaveLength(0);
  });

  // Purpose (lt-1, lt-6; frames 35A to 35D): the ring tap leads the light's row, then the light's name and its line, and
  // nothing at the row's right (no lit toggle); under a lit light, Keep lit's row (its name, ⓘ, its toggle).
  it("puts the ring tap at the left of each light row, the name and line beside it, no toggle on the row, Keep lit's row under a lit one", () => {
    render(<PlayersStandardSpecimens Specimen={Specimen} />);
    const rows = document.querySelectorAll('.light-block__row');
    expect(rows.length).toBe(6);
    for (const row of rows) {
      const [ring, body, ...rest] = [...row.children];
      expect(ring!.classList.contains('status-ring-tap') || ring!.classList.contains('light-block__still')).toBe(true);
      expect(body!.classList.contains('light-block__body')).toBe(true);
      expect(rest).toHaveLength(0);
      const [name, words] = [...body!.children];
      expect(name!.classList.contains('light-block__name')).toBe(true);
      expect(words!.classList.contains('light-block__words')).toBe(true);
      expect(within(row as HTMLElement).queryByRole('switch')).toBeNull();
      if (ring!.getAttribute('aria-label')?.startsWith('Put out')) {
        const keep = row.nextElementSibling as HTMLElement;
        expect(keep.classList.contains('light-block__keep')).toBe(true);
        expect(within(keep).getByRole('switch', { name: 'Keep lit' })).toBeTruthy();
      } else expect(row.parentElement!.querySelector('.light-block__keep')).toBeNull();
    }
    expect(screen.getByText('Lit, burns on')).toBeTruthy();
  });
});
