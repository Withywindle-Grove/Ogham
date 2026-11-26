// "Roll…"'s pop-up (sf-5; page 44, EN2, EN4 B, EN7 D to F), opened for real from the gallery's `tapped-tables` section,
// in a real browser. Purposes:
//   The pop-up is a centred card on a tablet and a sheet from the foot on a phone, with no layout or contrast problems,
//   in light and dark.
//   A table taller than the screen keeps its title, X, roll row and head in place while only its rows scroll; the
//   pop-up itself never scrolls, and every row is a 44 px tap.
//   On a d100 table, "Go to number" brings the row found to the top of the rows with a rule at its leading edge and
//   its range in bold, and no wash.
//   Loading shows its skeleton only after 300 ms.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const open = async (page: Page, theme: string, button: string) => {
  await page.goto(`/gallery.html?theme=${theme}`);
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const opener = page.locator('#tapped-tables').getByRole('button', { name: button });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
};

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });

    for (const theme of ['light', 'dark'] as const) {
      test(`the pop-up is ${size.name === 'phone' ? 'a sheet from the foot' : 'a centred card'} (${theme})`, async ({ page }) => {
        await open(page, theme, 'Change… (15–16 picked)');
        const card = page.getByRole('dialog', { name: 'Encounters in the harbour' });
        await expect(card).toBeVisible();
        await expect(card.getByRole('radio', { name: /Two bog lurkers/ })).toHaveAttribute('aria-checked', 'true');
        const box = (await card.boundingBox())!;
        if (size.name === 'phone') {
          expect(Math.round(box.x)).toBe(0);
          expect(Math.round(box.width)).toBe(size.width);
          expect(Math.abs(box.y + box.height - size.height)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThanOrEqual(2);
          expect(Math.abs(box.y + box.height / 2 - size.height / 2)).toBeLessThanOrEqual(2);
          expect(box.width).toBeLessThanOrEqual(720);
        }
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
      });
    }

    test('a tall table keeps its title, roll row and head while only the rows scroll', async ({ page }) => {
      await open(page, 'light', 'Roll… a tall table');
      const card = page.getByRole('dialog', { name: 'Encounters on the open water' });
      await expect(card).toBeVisible();
      const where = () =>
        card.evaluate((el) => ({
          title: Math.round(el.querySelector('.dialog__title')!.getBoundingClientRect().top),
          roll: Math.round(el.querySelector('.roll-row')!.getBoundingClientRect().top),
          head: Math.round(el.querySelector('.book-tap-head')!.getBoundingClientRect().top),
          cardScroll: el.scrollTop,
          cardBottom: el.getBoundingClientRect().bottom,
        }));
      const before = await where();
      const rows = card.locator('.table-sheet__rows');
      const scroll = await rows.evaluate((el) => ({ can: el.scrollHeight > el.clientHeight + 1 }));
      expect(scroll.can).toBe(true);
      await rows.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await expect.poll(() => rows.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      const after = await where();
      expect(after.title).toBe(before.title);
      expect(after.roll).toBe(before.roll);
      expect(after.head).toBe(before.head);
      expect(after.cardScroll).toBe(0);
      expect(after.cardBottom).toBeLessThanOrEqual(size.height + 1);
      const short = await card.locator('[role="radio"]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43.5).length);
      expect(short).toBe(0);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test('Go to number brings the row found to the top with its rule and no wash', async ({ page }) => {
      await open(page, 'light', 'Roll… a d100 table');
      const card = page.getByRole('dialog', { name: 'What the deep sends' });
      await card.getByLabel('Go to number').fill('64');
      await card.getByRole('button', { name: 'Go' }).click();
      const found = card.locator('.book-tap-table__cell--found');
      await expect(found).toHaveCount(1);
      await expect(found.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
      await expect(found.getByRole('radio')).toBeFocused();
      const look = await found.evaluate((el) => {
        const rows = el.closest('.table-sheet__rows')!;
        const radio = el.querySelector('.option-row')!;
        return {
          rule: getComputedStyle(el).boxShadow,
          rangeWeight: getComputedStyle(el.querySelector('.option-row__range')!).fontWeight,
          wash: getComputedStyle(radio).backgroundColor,
          plain: getComputedStyle(rows.children[0]!).backgroundColor,
          top: Math.round(el.getBoundingClientRect().top - rows.getBoundingClientRect().top),
        };
      });
      expect(look.rule).toContain('inset');
      expect(Number(look.rangeWeight)).toBeGreaterThanOrEqual(700);
      // No wash of its own: the row keeps its band (its option row is clear over it).
      expect(look.wash).toBe('rgba(0, 0, 0, 0)');
      expect(Math.abs(look.top)).toBeLessThanOrEqual(1);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test('loading shows its skeleton only after 300 ms', async ({ page }) => {
      // The page's clock stands still from before the tap until told, so "not yet" can't race the 300 ms.
      await page.clock.install({ time: new Date('2026-11-26T10:00:00') });
      await page.goto('/gallery.html?theme=light');
      await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
      const opener = page.locator('#tapped-tables').getByRole('button', { name: 'Roll… while it loads' });
      await opener.scrollIntoViewIfNeeded();
      await page.clock.pauseAt(new Date('2026-11-26T10:05:00'));
      await opener.click();
      const card = page.getByRole('dialog', { name: 'Encounters in the harbour' });
      await expect(card).toBeVisible();
      await page.clock.runFor(250);
      expect(await card.locator('.skeleton').count()).toBe(0);
      expect(await card.getByText('Loading the table…').count()).toBe(0);
      await page.clock.runFor(100);
      await expect(card.getByText('Loading the table…')).toBeVisible();
      await expect(card.locator('.skeleton')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}
