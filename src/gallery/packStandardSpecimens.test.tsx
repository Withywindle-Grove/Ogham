// @vitest-environment jsdom
// The gallery's Pack pictures (plan m5b-players-screens-standard C). Purpose: the specimens draw (the load line, the
// rows with their chevron and the pinned star, the fold rows, the waiting card, the foot, the item's sheet with its
// star), with no middle dot, angle quote or plain ▲, and one accent button in the Pack picture.
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PackStandardSpecimens } from './PackStandardSpecimens.tsx';

afterEach(cleanup);

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption>{name}</figcaption>
      <div className="stage">{children}</div>
    </figure>
  );
}

describe('the gallery’s Pack on the standard', () => {
  it('draws every piece, with no middle dot, angle quote or ▲, and one accent button on the Pack', () => {
    render(<PackStandardSpecimens Specimen={Specimen} />);
    const stages = [...document.querySelectorAll('.stage')];
    for (const stage of stages) expect(stage.textContent).not.toMatch(/ · |[‹›▲]/);
    const pack = within(screen.getByRole('region', { name: 'Wren’s pack, in the gallery' }));
    const atHand = within(pack.getByRole('region', { name: 'At hand' }));
    expect(atHand.getByRole('button', { name: /^Lantern pinned/ })).toBeTruthy();
    expect(atHand.getByRole('button', { name: 'Light Lantern' })).toBeTruthy();
    expect(atHand.getByRole('button', { name: 'Fire Reed arrows' })).toBeTruthy();
    expect(atHand.getByRole('button', { name: 'Drink Moss draught' })).toBeTruthy();
    expect(atHand.getByRole('button', { name: 'Attack with Reed spear' })).toBeTruthy();
    expect(pack.getByRole('region', { name: 'At hand' }).querySelector('.pack__chevron')).toBeNull();
    expect(screen.getByRole('button', { name: 'Put out Lantern' })).toBeTruthy();
    expect(pack.getByRole('button', { name: /2 items waiting for the GM/ })).toBeTruthy();
    expect([...stages[0]!.querySelectorAll('.button-primary')].map((b) => b.textContent)).toEqual(['Add item']);
    expect(screen.getByRole('button', { name: 'Use a charge of Glow wand' })).toBeTruthy();
    // Not allowed takes its own line with the sign; the row's line sits under it, never run together (Design on #552).
    const chain = pack.getByRole('button', { name: /^Chain shirt/ });
    expect(chain.querySelector('.pack__not-allowed')!.textContent).toBe('Not allowed');
    expect(chain.querySelector('.pack__not-allowed .warning-sign')).toBeTruthy();
    expect(chain.querySelector('.pack__not-allowed + .pack__sub')!.textContent).toBe('Worn, 200 coins');
    // A fold's list ends with the ellipsis alone; "Not counted for speed" is its second line.
    const gear = screen.getByText('Gear', { selector: '.creation-fold__label' }).closest('details')!;
    expect(gear.querySelector('.creation-fold__note')!.textContent).toMatch(/…$/);
    expect(gear.querySelector('.creation-fold__detail')!.textContent).toBe('Not counted for speed');
    expect(screen.getByRole('button', { name: 'Pin to top' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Unpin' }).getAttribute('aria-pressed')).toBe('true');
  });

  // Purpose: the Pack and the item's sheet write the one ellipsis character, never three typed dots ("Give to…",
  // "Put in…", the Gear fold's "Dry rations ×3…"; Design on #552).
  it('writes "…", never "...", on the Pack and the item’s sheet, and no "·" at all on the sheet', () => {
    render(<PackStandardSpecimens Specimen={Specimen} />);
    const stages = [...document.querySelectorAll('.stage')];
    for (const stage of stages) expect(stage.textContent).not.toContain('...');
    for (const sheet of stages.slice(2)) expect(sheet.textContent).not.toContain('·');
    expect(screen.getAllByText('Give to…').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Put in…').length).toBeGreaterThan(0);
  });

  // Purpose: the item's sheet shows its details as kv rows, the label at the left and the value at the right edge, as
  // Weight and How many do: the Lantern's "Slot" and "hand" (Design on #552).
  it('shows the Lantern’s Slot as a kv row', () => {
    render(<PackStandardSpecimens Specimen={Specimen} />);
    const slot = screen.getAllByText('Slot', { selector: 'dt' })[0]!;
    expect(slot.closest('dl')!.classList.contains('rules-browser__lines--kv')).toBe(true);
    expect(slot.nextElementSibling!.tagName).toBe('DD');
    expect(slot.nextElementSibling!.textContent).toBe('hand');
  });
});
