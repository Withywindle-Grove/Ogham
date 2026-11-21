// @vitest-environment jsdom
// The GM's rest prompt's Sheet (NightRest.tsx; dec-8 piece D, mp-5). Invented names: Wren, Brother Alder, Pike and
// his Bird friend.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RestRow } from '../modules/characters/magicView.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { applyNightRest, NightRestSheet, type Rester } from './NightRest.tsx';

afterEach(() => cleanup());

const caster = (id: string): RestRow => ({ characterId: id, caster: true, becomeReady: [], castsCleared: {}, usesBack: [] });
const ROWS: RestRow[] = [caster('wren'), caster('alder'), { characterId: 'pike', caster: false, becomeReady: [], castsCleared: {}, usesBack: [{ name: 'Bird friend', uses: 1, spent: 1 }] }];
const NAMES = new Map([
  ['wren', 'Wren'],
  ['alder', 'Brother Alder'],
  ['pike', 'Pike'],
]);

describe("A night's rest (the GM's rest prompt)", () => {
  // Purpose: each row is the ruled switch (ds-1c) named by the character, in the order given, every one on at the
  // start; there is no instruction line (mc-46); Pike's power is the line under his; a tap switches one off and a
  // second tap back, and Apply rest hands over the marks as they stand.
  it('a switch a character, in order, all on; a tap switches; Apply hands over the marks', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<NightRestSheet rows={ROWS} names={NAMES} onApply={onApply} onClose={() => {}} />);
    const sheet = within(screen.getByRole('dialog', { name: "A night's rest" }));
    const switches = within(sheet.getByRole('group', { name: 'Who rested' })).getAllByRole('switch');
    expect(switches.map((s) => [s.textContent, s.getAttribute('aria-checked')])).toEqual([
      ['Wren', 'true'],
      ['Brother Alder', 'true'],
      ['Pike', 'true'],
    ]);
    expect(sheet.getByText('Who gets their magic back?')).toBeTruthy();
    expect(sheet.queryByText(/Tap a mark/)).toBeNull();
    expect(sheet.getByText('Bird friend, once a rest')).toBeTruthy();
    await user.click(sheet.getByRole('switch', { name: 'Brother Alder' }));
    expect(sheet.getByRole('switch', { name: 'Brother Alder' }).getAttribute('aria-checked')).toBe('false');
    await user.click(sheet.getByRole('switch', { name: 'Pike' }));
    await user.click(sheet.getByRole('switch', { name: 'Pike' }));
    await user.click(sheet.getByRole('button', { name: 'Apply rest' }));
    expect(onApply).toHaveBeenCalledWith({ wren: true, alder: false, pike: true });
  });

  // Purpose (#790 review, items 3 and 6): a refused full rest writes no spells at all; after a full rest that went
  // through, a caster whose own change is refused is named, and the others still get theirs.
  it('Apply rest: no spells after a refused full rest; a refused caster is named', async () => {
    const play = (over: Partial<Rester['rest']['play']>) => ({ prepared: [{ spell: 'marsh-light', level: 1 }], chosen: null, spellsCast: { '1:marsh-light': 1 }, usesSpent: {}, ...over });
    const rester = (id: string, name: string): Rester => ({
      ref: { id, campaignId: 'c', ownerType: 'user', ownerUserId: null, approval: 'approved', archived: false },
      name,
      rest: { id, slots: [1], powers: [], play: play({}) },
    });
    const resters = [rester('wren', 'Wren'), rester('ash', 'Ash')];
    const marks = { wren: true, ash: true };

    const act = vi.fn(async () => null);
    expect(await applyNightRest({ resters, marks, act, fullRest: async () => false })).toEqual({ done: false, notBack: [] });
    expect(act).not.toHaveBeenCalled();

    const some = vi.fn(async (_command: unknown, input: { character: { id: string } }) => (input.character.id === 'ash' ? null : {}));
    const result = await applyNightRest({ resters, marks, act: some as never, fullRest: async () => true });
    expect(result).toEqual({ done: true, notBack: ['Ash'] });
    expect(some).toHaveBeenCalledTimes(2);
  });

  // Purpose (ic-1, ap-4; pq-1): Apply rest is the shared stacked button, primary, the set's night-sleep icon above its
  // word, never the icon alone; and the sheet, the piece's own surface, is in the book's scope.
  it("Apply rest is a primary stacked button with night-sleep; the sheet is in the book's scope", () => {
    render(<NightRestSheet rows={ROWS} names={NAMES} onApply={() => {}} onClose={() => {}} />);
    const sheet = screen.getByRole('dialog', { name: "A night's rest" });
    const apply = within(sheet).getByRole('button', { name: 'Apply rest' });
    expect(apply.classList.contains('stacked-button')).toBe(true);
    expect(apply.classList.contains('button-primary')).toBe(true);
    expect([...apply.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'span']);
    expect(apply.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['night-sleep'].d);
    expect(apply.querySelector('span')!.textContent).toBe('Apply rest');
    expect(sheet.closest('.book-type') ?? (sheet.classList.contains('book-type') ? sheet : null)).not.toBeNull();
  });

  // Purpose: the sheet's one accent is Apply rest, and there is no Cancel beside its ✕ (mc-78); ✕ closes without applying.
  it('one accent, no Cancel; ✕ closes and applies nothing', async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NightRestSheet rows={ROWS} names={NAMES} onApply={onApply} onClose={onClose} />);
    const sheet = screen.getByRole('dialog', { name: "A night's rest" });
    expect([...sheet.querySelectorAll('.button-primary')].map((b) => b.textContent)).toEqual(['Apply rest']);
    expect(within(sheet).queryByRole('button', { name: 'Cancel' })).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
