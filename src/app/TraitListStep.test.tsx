// @vitest-environment jsdom
// The trait-list step (M5b step 0b part B; on the creation step shell from m5b-0c slice 6, cr-17; 06 Trait list step).
// Invented content only.
//   Purpose: the list's name is the title and its notes the why-line; with a die the line says "roll, then tap — or
//   pick" and each row's range comes first; the ✓ picks one, saved on Next; Next with nothing picked stays tappable and
//   says what's missing (with or without Decide later); the row opens the entry's full notes and the gear it grants,
//   with Pick at its foot; Other… takes a typed entry with a note.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { traitListsOf, traitLines, type TraitPick } from '../modules/characters/traitLists.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { TraitListStep } from './TraitListStep.tsx';

afterEach(cleanup);

const [list] = traitListsOf([
  {
    kind: 'traitList',
    packEntryId: 'fen-backgrounds',
    name: 'Fen backgrounds',
    data: {
      die: 'd6',
      notes: 'Where they come from.',
      entries: [
        { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 3, blurb: 'Knows the channels.', notes: 'Knows every channel and its moods.', items: [{ itemId: 'eel-knife', qty: 1 }] },
        { id: 'reed-cutter', name: 'Reed cutter', min: 4, max: 6, blurb: 'Strong arms.' },
      ],
    },
  },
]);

function renderStep(extra: { onLater?: () => void; onSave?: (picks: TraitPick[]) => Promise<boolean> } = {}) {
  const onSave = extra.onSave ?? vi.fn(async () => true);
  render(
    <ToastHost>
      <TraitListStep
        list={list!}
        chosen={[]}
        {...traitLines(list!)}
        help={null}
        counter={{ at: 6, of: 8 }}
        itemName={(id) => (id === 'eel-knife' ? 'Eel knife' : undefined)}
        onSave={onSave}
        onBack={() => undefined}
        {...('onLater' in extra ? { onLater: extra.onLater } : {})}
      />
    </ToastHost>,
  );
  return onSave;
}

const tick = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('the trait-list step', () => {
  // Purpose (ct-9; retest 4 S1): the die is named in the step's Roll row with its glyph, the notes in the line.
  it("shows the list's name, the why-line, the die in its Roll row (ct-9, S1), and each row's range first", () => {
    renderStep({ onLater: () => undefined });
    expect(screen.getByRole('heading', { name: 'Fen backgrounds' })).toBeTruthy();
    expect(screen.getByText('Where they come from.')).toBeTruthy();
    const roll = screen.getByText('Roll 1d6 at the table, then tap the row, or pick one.').closest('.roll-row');
    expect(roll).not.toBeNull();
    expect(roll!.querySelector('.die-glyph--d6')).not.toBeNull();
    expect(screen.getByText('Step 6 of 8')).toBeTruthy();
    expect(tick(/^Pick 1–3: Eel catcher/)).toBeTruthy();
    expect(tick(/^Pick 4–6: Reed cutter/)).toBeTruthy();
    // The gear an entry grants shows on its row.
    expect(screen.getByText('starts with Eel knife')).toBeTruthy();
  });

  it("one tap picks, Next saves the entry's id", async () => {
    const user = userEvent.setup();
    const onSave = renderStep({ onLater: () => undefined });
    await user.click(tick(/Reed cutter/));
    expect(tick(/Reed cutter/).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Reed cutter picked');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith([{ entryId: 'reed-cutter' }], null);
  });

  it('Next with nothing picked stays tappable and says what is missing, offering Decide later only when it is there', async () => {
    const user = userEvent.setup();
    const onSave = renderStep({ onLater: () => undefined });
    const next = screen.getByRole('button', { name: 'Next' });
    expect((next as HTMLButtonElement).disabled).toBe(false);
    await user.click(next);
    expect((await screen.findAllByText('Pick one, or Decide later.')).length).toBeGreaterThan(0);
    expect(onSave).not.toHaveBeenCalled();
    cleanup();
    renderStep();
    expect(screen.queryByRole('button', { name: 'Decide later' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Pick one to go on.')).toBeTruthy();
  });

  it("the row opens the entry's full notes and the gear it grants, with Pick at its foot (no ⓘ)", async () => {
    const user = userEvent.setup();
    renderStep({ onLater: () => undefined });
    expect(screen.queryByRole('button', { name: /^About/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^1–3: Eel catcher/ }));
    const entry = within(await screen.findByRole('dialog', { name: 'Eel catcher' }));
    expect(entry.getByText('Knows every channel and its moods.')).toBeTruthy();
    expect(entry.getByText('Eel knife, added to your pack when picked')).toBeTruthy();
    await user.click(entry.getByRole('button', { name: 'Pick Eel catcher' }));
    expect(tick(/Eel catcher/).getAttribute('aria-checked')).toBe('true');
  });

  // Purpose (retest 4 T7): the step is one column, so on a tablet an entry opens as a sheet, never beside the list
  // (only Race and Class keep the pair side by side).
  it('on a landscape tablet the entry opens as a sheet, not beside the list', async () => {
    const was = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      renderStep({ onLater: () => undefined });
      await user.click(screen.getByRole('button', { name: /^1–3: Eel catcher/ }));
      expect(await screen.findByRole('dialog', { name: 'Eel catcher' })).toBeTruthy();
      expect(document.querySelector('.creation-step__side')).toBeNull();
    } finally {
      window.matchMedia = was;
    }
  });

  it('Other… takes a typed name and a note; Next saves them', async () => {
    const user = userEvent.setup();
    const onSave = renderStep({ onLater: () => undefined });
    await user.click(screen.getByRole('button', { name: /^Other…/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Type a name first, then tap Add.')).toBeTruthy();
    await user.type(screen.getByLabelText('Your own fen backgrounds'), 'Basket weaver');
    await user.type(screen.getByLabelText('A note (optional)'), 'learned from an aunt');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(tick(/^Pick Basket weaver/).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSave).toHaveBeenCalledWith([{ other: 'Basket weaver', note: 'learned from an aunt' }], null);
  });
});

// The takes mark (pf-16; the lead's rulings of 2026-11-13) on a list rolled three times without `distinct`.
describe('an entry taken more than once', () => {
  function renderThrice() {
    render(
      <ToastHost>
        <TraitListStep list={{ ...list!, rolls: 3 }} chosen={[]} {...traitLines(list!)} help={null} onSave={async () => true} onBack={() => undefined} onLater={() => undefined} />
      </ToastHost>,
    );
  }

  // Purpose: one tick for each take: taken three times the row's Pick reads "Picked ✓✓✓" and is heard as "picked 3
  // times"; the ticks never turn into a number, the name carries no count, and the row may drop its button under the
  // name once it no longer fits beside it.
  it('taken three times reads Picked ✓✓✓, heard as "picked 3 times"', async () => {
    const user = userEvent.setup();
    renderThrice();
    for (let n = 0; n < 3; n++) await user.click(tick(/^Pick 1–3: Eel catcher/));
    const button = tick(/^Pick 1–3: Eel catcher/);
    expect(button.textContent).toBe('Picked ✓✓✓');
    expect(button.getAttribute('aria-label')).toBe('Pick 1–3: Eel catcher, picked 3 times');
    const row = button.closest('.pick-row')!;
    expect(row.querySelector('.pick-row__name')!.textContent).toBe('1–3: Eel catcher');
    expect(row.textContent).not.toMatch(/×|times|3 /);
    expect(row.classList.contains('pick-row--takes')).toBe(true);
  });

  // Purpose: the foot line names each entry once, with its ticks when taken more than once, as its row shows them
  // ("Eel catcher ✓✓, Reed cutter picked"); a screen reader hears the count instead of the ticks ("Eel catcher, picked
  // twice, Reed cutter picked"), and "picked" is not said twice when the last entry carries the count.
  it('the foot line names each entry once, with its ticks, and says the count aloud', async () => {
    const user = userEvent.setup();
    renderThrice();
    const status = () => screen.getByRole('status', { name: 'Step status' });
    // What the eye sees: everything but the hidden words. What is heard: everything but the aria-hidden ticks.
    const seen = () => {
      const copy = status().cloneNode(true) as HTMLElement;
      copy.querySelectorAll('.visually-hidden').forEach((n) => n.remove());
      return copy.textContent;
    };
    const heard = () => {
      const copy = status().cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return copy.textContent;
    };
    await user.click(tick(/^Pick 1–3: Eel catcher/));
    await user.click(tick(/^Pick 1–3: Eel catcher/));
    await user.click(tick(/^Pick 4–6: Reed cutter/));
    expect(seen()).toBe('Eel catcher ✓✓, Reed cutter picked');
    expect(heard()).toBe('Eel catcher, picked twice, Reed cutter picked');
    // Reed cutter off, Eel catcher a third time: the last entry carries the count.
    await user.click(screen.getByRole('button', { name: /^4–6: Reed cutter/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Reed cutter' })).getByRole('button', { name: 'Pick Reed cutter, picked' }));
    await user.click(tick(/^Pick 1–3: Eel catcher/));
    expect(seen()).toBe('Eel catcher ✓✓✓ picked');
    expect(heard()).toBe('Eel catcher, picked 3 times');
  });

  // Purpose: the entry's pop-up button says exactly what its row's button says: "Picked ✓✓" for an entry taken twice,
  // heard with the same words; one state, one mark, wherever the entry's button is drawn. At one take it is heard
  // "Pick <name>, picked", the same form as at every count.
  it("the entry's pop-up reads Picked ✓✓ like its row, with the same spoken words", async () => {
    const user = userEvent.setup();
    renderThrice();
    await user.click(tick(/^Pick 1–3: Eel catcher/));
    // At one take the pop-up is heard the same way, "Pick <name>, picked" (#671 review).
    await user.click(screen.getByRole('button', { name: /^1–3: Eel catcher/ }));
    const once = within(await screen.findByRole('dialog', { name: 'Eel catcher' })).getByRole('button', { name: 'Pick Eel catcher, picked' });
    expect(once.textContent).toBe('Picked ✓');
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    await user.click(tick(/^Pick 1–3: Eel catcher/));
    const row = tick(/^Pick 1–3: Eel catcher/);
    expect(row.textContent).toBe('Picked ✓✓');
    await user.click(screen.getByRole('button', { name: /^1–3: Eel catcher/ }));
    const entry = within(await screen.findByRole('dialog', { name: 'Eel catcher' }));
    // The pop-up names the entry without its range, as its Pick always has ("Pick Eel catcher").
    const foot = entry.getByRole('button', { name: 'Pick Eel catcher, picked twice' });
    expect(foot.textContent).toBe('Picked ✓✓');
    expect(foot.getAttribute('aria-pressed')).toBe('true');
  });
});
