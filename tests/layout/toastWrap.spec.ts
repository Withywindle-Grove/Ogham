// The toast with an action (the lead's toast ruling, 2026-11-13), in WebKit at a phone (375) and at iPad landscape (1180).
// Purpose: a toast whose message and action won't fit on one line keeps the message across the toast and puts the
// action on its own line underneath, at the right (at least 44 px tall, at least 8 px below the message), the toast no
// taller than it needs and its bar across its full width; a short toast stays on one line at its 60 px height.
// Undo and a named action ("Play as <name>") are both checked. The gallery's two toasts are measured as they are, then
// given long words in the page (the layout is what's tested, not the words).
// Widths are compared with motion reduced, because the bar drains by transform (getBoundingClientRect includes it).
import { expect } from '@playwright/test';
import { test } from '../fails.ts';

test('a short toast keeps one line; a long one drops its action under the message (375 and 1180 px)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const size of [
    { width: 375, height: 812 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const measure = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.toast')].slice(0, 2).map((toast) => {
          const box = (el: Element | null) => {
            const r = el!.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          };
          return {
            toast: box(toast),
            text: box(toast.querySelector('.toast__text')),
            action: box(toast.querySelector('.toast__undo')),
            bar: box(toast.querySelector('.toast__bar')),
          };
        }),
      );
    const where = `at ${size.width} px`;

    // Short: "Dropped 3 torches · Undo" and "A new version is ready. · Reload" stay on one line, 60 px tall.
    const short = await measure();
    expect(short, where).toHaveLength(2);
    for (const t of short) {
      expect(Math.abs(t.toast.height - 60), `short toast height ${where}`).toBeLessThanOrEqual(1);
      const middle = (b: { top: number; bottom: number }) => (b.top + b.bottom) / 2;
      expect(Math.abs(middle(t.text) - middle(t.action)), `short toast on one line ${where}`).toBeLessThanOrEqual(2);
      expect(t.action.left, `short toast action beside ${where}`).toBeGreaterThanOrEqual(t.text.right);
    }

    // Long: an Undo toast with a long item name, and a "Play as <name>" action with a long name.
    await page.evaluate(() => {
      const [undo, action] = [...document.querySelectorAll('.toast')];
      undo!.querySelector('.toast__text')!.textContent =
        'Gave Lantern of the drowned causeway wardens to Mirelda Ashgrove-Thistlewaite of the Reedmere';
      action!.querySelector('.toast__text')!.textContent =
        'Mirelda Ashgrove-Thistlewaite of the drowned causeway has joined the party.';
      action!.querySelector('.toast__undo')!.textContent = 'Play as Mirelda Ashgrove-Thistlewaite of the drowned causeway';
    });
    const long = await measure();
    for (const t of long) {
      // The message keeps most of the toast's width.
      expect(t.text.width, `message width ${where}`).toBeGreaterThanOrEqual(t.toast.width * 0.75);
      // The action sits below it, at the right, at least 44 px tall and at least 8 px under the message.
      expect(t.action.top - t.text.bottom, `gap above the action ${where}`).toBeGreaterThanOrEqual(8 - 0.5);
      expect(t.action.height, `action height ${where}`).toBeGreaterThanOrEqual(44);
      expect(t.toast.right - t.action.right, `action at the right ${where}`).toBeLessThanOrEqual(8 + 1);
      // No taller than it needs: the toast's own padding above the message and below the action, nothing more.
      expect(t.text.top - t.toast.top, `room above ${where}`).toBeLessThanOrEqual(8 + 1);
      expect(t.toast.bottom - t.action.bottom, `room below ${where}`).toBeLessThanOrEqual(8 + 1);
      // The running bar spans the toast.
      expect(Math.abs(t.bar.left - t.toast.left), `bar start ${where}`).toBeLessThanOrEqual(1);
      expect(Math.abs(t.bar.width - t.toast.width), `bar width ${where}`).toBeLessThanOrEqual(1);
    }
  }
});

// Purpose: an action whose own label is too long for one line wraps it with every line ending at the right, not
// centred, so the action still reads as sitting at the toast's right (375 px).
test("a long action label's lines end at the toast's right (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const lines = await page.evaluate(() => {
    const action = [...document.querySelectorAll('.toast')][1]!;
    action.querySelector('.toast__text')!.textContent = 'Mirelda Ashgrove-Thistlewaite of the drowned causeway has joined the party.';
    const button = action.querySelector('.toast__undo')!;
    button.textContent = 'Play as Mirelda Ashgrove-Thistlewaite of the drowned causeway';
    const range = document.createRange();
    range.selectNodeContents(button);
    const tops = new Map<number, number>();
    for (const r of range.getClientRects()) tops.set(Math.round(r.top), Math.max(tops.get(Math.round(r.top)) ?? 0, r.right));
    const padding = parseFloat(getComputedStyle(button).paddingRight);
    return { rights: [...tops.values()], end: button.getBoundingClientRect().right - padding };
  });
  expect(lines.rights.length).toBeGreaterThanOrEqual(2);
  for (const right of lines.rights) expect(Math.abs(lines.end - right)).toBeLessThanOrEqual(2);
});

// Purpose (sm-1, the lead's toast words): the sun and moon flip's longer toast, "Out and about today: On. Active
// tonight: Off." with Undo, follows the toast's rule at 375 px: on one line at 60 px, or its Undo under the message.
test("the town switches' two-part toast keeps the toast's rule (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const t = await page.evaluate(() => {
    const toast = [...document.querySelectorAll('.toast')][0]!;
    toast.querySelector('.toast__text')!.textContent = 'Out and about today: On. Active tonight: Off.';
    const box = (el: Element | null) => {
      const r = el!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { toast: box(toast), text: box(toast.querySelector('.toast__text')), action: box(toast.querySelector('.toast__undo')) };
  });
  const oneLine = Math.abs(t.toast.height - 60) <= 1;
  if (oneLine) {
    expect(t.action.left).toBeGreaterThanOrEqual(t.text.right);
  } else {
    expect(t.text.width).toBeGreaterThanOrEqual(t.toast.width * 0.75);
    expect(t.action.top - t.text.bottom).toBeGreaterThanOrEqual(8 - 0.5);
    expect(t.action.height).toBeGreaterThanOrEqual(44);
  }
  expect(t.toast.right).toBeLessThanOrEqual(375);
});

// Purpose: holding the bar still for the width checks must not hide a bar that stopped draining. With motion allowed,
// the bar's scale shrinks over a short wait. The gallery's toasts run for minutes, so the change in a second is under a
// pixel: it is read from the bar's computed transform (its horizontal scale), not from its box.
test('with motion allowed, the bar still drains (375 px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/gallery.html?theme=light');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  const scale = () =>
    page.evaluate(() => {
      const t = getComputedStyle(document.querySelector('.toast .toast__bar')!).transform;
      return t === 'none' ? 1 : new DOMMatrixReadOnly(t).a;
    });
  const first = await scale();
  await page.waitForTimeout(1000);
  expect(await scale()).toBeLessThan(first);
});
