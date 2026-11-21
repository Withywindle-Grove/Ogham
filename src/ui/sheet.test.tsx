// @vitest-environment jsdom
// The Sheet (plan m5b-creation-final-drafts A7; "pop-up" means this, ruled 2026-11-06).
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreationLeave } from './creation.tsx';
import { Dialog, sheetPlace } from './Dialog.tsx';

afterEach(cleanup);

const screenSize = { width: 1024, height: 768 };

describe('the Sheet (A7)', () => {
  // Purpose: inside creation every pop-up that isn't Full screen is a sheet; elsewhere it stays the centred card.
  it('is a sheet inside creation and the old card outside it', () => {
    const { unmount } = render(
      <CreationLeave onLeave={() => {}}>
        <Dialog label="Reed Witch" onClose={() => {}}>
          <p>Spells from the marsh.</p>
        </Dialog>
      </CreationLeave>,
    );
    expect(screen.getByRole('dialog', { name: 'Reed Witch' }).classList.contains('dialog--sheet')).toBe(true);
    unmount();
    render(
      <Dialog label="Charges" onClose={() => {}}>
        <p>Roll for it.</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Charges' }).classList.contains('dialog--sheet')).toBe(false);
  });

  // Purpose: a Full screen pop-up stays full screen in creation.
  it('leaves Full screen alone', () => {
    render(
      <CreationLeave onLeave={() => {}}>
        <Dialog label="The shop" full onClose={() => {}}>
          <p>Rows.</p>
        </Dialog>
      </CreationLeave>,
    );
    expect(screen.getByRole('dialog', { name: 'The shop' }).classList.contains('dialog--sheet')).toBe(false);
  });

  // Purpose: ✕ or a tap outside closes the sheet.
  it('closes on ✕ and on a tap outside', async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    render(
      <CreationLeave onLeave={() => {}}>
        <Dialog label="Reed Witch" onClose={close}>
          <p>Spells.</p>
        </Dialog>
      </CreationLeave>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.pointer({ keys: '[MouseLeft]', target: document.querySelector('.dialog__backdrop--sheet')! });
    expect(close).toHaveBeenCalledTimes(2);
  });

  // Purpose: on a tablet the sheet opens below its button, else above it, kept inside the screen; with no button on screen it centres.
  it('places itself beside its button on a tablet', () => {
    const card = { width: 400, height: 300 };
    expect(sheetPlace({ top: 100, bottom: 144, left: 200, width: 300, height: 44 }, card, screenSize)).toEqual({ top: 152, left: 200 });
    expect(sheetPlace({ top: 600, bottom: 644, left: 200, width: 300, height: 44 }, card, screenSize)).toEqual({ top: 292, left: 200 });
    // At the right edge: pulled in to keep the 16 px margin.
    expect(sheetPlace({ top: 100, bottom: 144, left: 900, width: 100, height: 44 }, card, screenSize)).toEqual({ top: 152, left: 608 });
    // Too tall for either side: as low as fits.
    expect(sheetPlace({ top: 300, bottom: 344, left: 10, width: 100, height: 44 }, { width: 400, height: 700 }, screenSize)).toEqual({ top: 52, left: 16 });
    expect(sheetPlace({ top: 0, bottom: 0, left: 0, width: 0, height: 0 }, card, screenSize)).toBeNull();
  });

  // Purpose (fix-sheet-replacing-on-ipad): once open, a tablet sheet is placed only once; when its card grows (a row
  // ticked, a roll added) it moves up just enough to stay on screen, never down, never flipping above its button, and
  // a second pass changes nothing, so the sheet can't jump or loop between places as Francis's iPad showed.
  it('keeps an open sheet on screen without placing it again', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { sheetKeepOnScreen } = (await import('./Dialog.tsx')) as any;
    const screen768 = { width: 1024, height: 768 };
    // (a) Taller than the room under it: up just enough to end at the 16 px bottom margin.
    expect(sheetKeepOnScreen({ top: 400, left: 16 }, { height: 500 }, screen768)).toEqual({ top: 252, left: 16 });
    // Taller than the screen allows: no higher than the top margin.
    expect(sheetKeepOnScreen({ top: 400, left: 16 }, { height: 900 }, screen768)).toEqual({ top: 16, left: 16 });
    // (b) Shorter, or still fitting: it stays exactly where it opened (the same place, nothing to re-render).
    const opened = { top: 400, left: 16 };
    expect(sheetKeepOnScreen(opened, { height: 200 }, screen768)).toBe(opened);
    expect(sheetKeepOnScreen(opened, { height: 352 }, screen768)).toBe(opened);
    // (c) Applied twice, the same place: it settles in one step.
    const once = sheetKeepOnScreen(opened, { height: 500 }, screen768);
    expect(sheetKeepOnScreen(once, { height: 500 }, screen768)).toBe(once);
    // (d) Opened below its button (bottom 444) and grown by 20 px: up 20 px, not flipped above the button (where
    // placing it again from scratch would put it).
    const below = sheetPlace({ top: 400, bottom: 444, left: 16, width: 100, height: 44 }, { width: 400, height: 300 }, screen768)!;
    expect(below.top).toBe(452);
    expect(sheetPlace({ top: 400, bottom: 444, left: 16, width: 100, height: 44 }, { width: 400, height: 320 }, screen768)!.top).toBe(72);
    expect(sheetKeepOnScreen(below, { height: 320 }, screen768)).toEqual({ top: 432, left: 16 });
  });

  // Purpose (review of #666, Important 1): an open sheet's left edge is kept inside the screen's side margins too, so a
  // sheet opened on an iPad held sideways never runs off the right edge when it is turned upright; one that fits
  // stays where it is, and a second pass changes nothing.
  it('keeps an open sheet inside the screen’s sides', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { sheetKeepOnScreen } = (await import('./Dialog.tsx')) as any;
    const upright = { width: 820, height: 1180 };
    // Opened at left 340 in landscape, 788 px wide: pulled in to the 16 px margin, its top unchanged.
    const pulled = sheetKeepOnScreen({ top: 100, left: 340 }, { width: 788, height: 300 }, upright);
    expect(pulled).toEqual({ top: 100, left: 16 });
    expect(sheetKeepOnScreen(pulled, { width: 788, height: 300 }, upright)).toBe(pulled);
    // Already inside: the same place back.
    const inside = { top: 100, left: 16 };
    expect(sheetKeepOnScreen(inside, { width: 400, height: 300 }, upright)).toBe(inside);
  });
});
