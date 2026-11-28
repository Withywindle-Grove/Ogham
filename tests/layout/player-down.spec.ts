// "Down" as a Status ring in the Player tab's head (#165; pss-7, psb-1, psb-2; ⚑ 1 ruled B on 2026-11-28: no tap
// until M6 builds the death panel), on the shared P1-like character with nine statuses, at 0 hit points under rules
// that mark Down at 0 (`layout.html?as=player&p1=messy&down=1`, src/testing/layoutP1Character.ts). Purposes, each in
// light and dark, on a tablet and at 375 px:
//   1. Down leads the rings: the first ring in the head, a 52 px ring like the others, read aloud "Down", a status and
//      not a button (no tap until M6), its track dashed and drawn in the harm tone, no arc.
//   2. Down counts among the rings in view and the "+N": ten in all, four in view and "+6" on a tablet, three and "+7"
//      on a phone; the "+N" sheet still holds the nine statuses (Down has no sheet of its own to open there).
//   3. Nothing under the hit points bar says Down.
//   4. Down with no other status (`&down=alone`): the word "Down" beside its ring, inside the screen.
//   5. The shared checks: no sideways scroll, 44 px targets, nothing under 14 px, axe on the head.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820, inView: 4 },
  { name: 'phone', width: 375, height: 812, inView: 3 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openDown(page: Page, down: '1' | 'alone' = '1') {
  await page.goto(`/layout.html?as=player&p1=messy&down=${down}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player-head .status-ring').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of SCHEMES) {
  test.describe(`Down in the head (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const size of SIZES) {
      test(`Down leads the rings, counts in view and in "+N", and is a status, not a button (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openDown(page);
        const rings = page.locator('.player-head .status-ring-row > .status-ring');
        await expect(rings).toHaveCount(size.inView);
        const down = rings.first();
        await expect(down).toHaveAttribute('role', 'img');
        await expect(down).toHaveAttribute('aria-label', 'Down');
        expect(await down.evaluate((el) => el.tagName)).not.toBe('BUTTON');
        expect(await down.evaluate((el) => el.closest('button') === null)).toBe(true);
        const box = (await down.boundingBox())!;
        expect(Math.round(box.width)).toBe(52);
        // The dashed track (no end), no arc, in the harm tone (--danger).
        const look = await down.evaluate((el) => {
          const track = el.querySelector('.status-ring__track')!;
          const mark = el.querySelector<HTMLElement>('.status-ring__mark')!;
          const probe = document.createElement('span');
          probe.style.color = 'var(--danger)';
          document.body.append(probe);
          const danger = getComputedStyle(probe).color;
          probe.remove();
          return { dash: getComputedStyle(track).strokeDasharray, arcs: el.querySelectorAll('.status-ring__arc').length, colour: getComputedStyle(mark).color, danger };
        });
        expect(look.dash).not.toBe('none');
        expect(look.arcs).toBe(0);
        expect(look.colour).toBe(look.danger);
        // The skull drawn in the middle (one of the 25 approved).
        await expect(down.locator('.status-ring__symbol svg')).toHaveCount(1);

        // Ten in all: the "+N" counts Down.
        const more = page.getByRole('button', { name: `${10 - size.inView} more: see every status` });
        await expect(more).toHaveText(`+${10 - size.inView}`);
        // Nothing under the hit points bar says Down.
        await expect(page.locator('.player__pane--play .hp-box').getByText('Down')).toHaveCount(0);
        for (const r of await page.locator('.player-head *').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) expect(r).toBeLessThanOrEqual(size.width);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '.player-head')).toEqual([]);

        await more.click();
        const sheet = page.getByRole('dialog', { name: 'Statuses' });
        await expect(sheet.locator('.status-ring')).toHaveCount(9);
      });

      test(`Down alone: the word beside its ring, no "+N" (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openDown(page, 'alone');
        const rings = page.locator('.player-head .status-ring-row > .status-ring');
        await expect(rings).toHaveCount(1);
        const down = rings.first();
        await expect(down).toHaveAttribute('aria-label', 'Down');
        const word = down.locator('.status-ring__name');
        await expect(word).toHaveText('Down');
        await expect(word).toBeVisible();
        const mark = (await down.locator('.status-ring__mark').boundingBox())!;
        const words = (await word.boundingBox())!;
        expect(words.x).toBeGreaterThanOrEqual(mark.x + mark.width);
        expect(words.x + words.width).toBeLessThanOrEqual(size.width);
        await expect(page.locator('.player-head .status-ring-more')).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '.player-head')).toEqual([]);
      });
    }
  });
}
