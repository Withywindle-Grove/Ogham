// dec-14 player audit, batch C (docs/plans/dec-14-player-audit-fixes.md; page 38 of december, approved 2026-11-24).
// Row 8 (ruled 8a, frame 38-8) on the over-loaded test character (`layout.html?as=player&p1=heavy`). Purposes:
//   Over the most, with the speed card there, "Can't move" shows once in Movement: on the speed card, not the load card.
//   The load card keeps its warning sign, its bar and its figures; the sign has the pack's own words as its spoken name,
//   is still a 44 px target, and opens the burden's levels.
//   No sideways scroll at 375 px, no serious accessibility problem, in light and dark.
// Row 7b (frame 38-7) on the plain test character (`layout.html?as=player&p1=1`). Purposes:
//   The Attack tile's line reads "Melee +2, missile +1": no capital after its first word (on a phone, stacked a part
//   a line, as every tile's line is when it doesn't fit).
//   No sideways scroll at 375 px, no serious accessibility problem, in light and dark.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openHeavy(page: Page) {
  await page.goto('/layout.html?as=player&p1=heavy');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Movement' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const scheme of SCHEMES) {
  test.describe(`row 8: over the most, said once (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`the speed card says it, the load card shows the sign (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openHeavy(page);
        const movement = page.getByRole('region', { name: 'Movement' });

        await expect(movement.getByText("Can't move", { exact: true })).toHaveCount(1);
        await expect(movement.locator('.sheet__card--tap')).toContainText("Can't move");

        const tier = movement.locator('.pack__tier');
        await expect(tier).toHaveText('');
        await expect(tier).toHaveAccessibleName("Can't move");
        await expect(tier.locator('.warning-sign')).toBeVisible();
        await expect(movement.locator('.pack__bar')).toBeVisible();
        await expect(movement.getByText('1,259 of 1,200 coins’ weight')).toBeVisible();

        const box = (await tier.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);

        expect(await layoutProblems(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Movement"]')).toEqual([]);

        await tier.scrollIntoViewIfNeeded();
        await tier.click();
        await expect(page.getByRole('dialog', { name: 'Burden' })).toBeVisible();
      });
    }
  });
}

for (const scheme of SCHEMES) {
  test.describe(`row 7b: the attack line in plain case (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`no capital after the line's first word (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('/layout.html?as=player&p1=1');
        await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
        const vitals = page.getByRole('region', { name: 'Vitals' });
        await expect(vitals).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const line = vitals.getByRole('button', { name: /^Attack / }).locator('.stat-tile__caption');
        await expect(line).toBeVisible();
        // Too narrow for one line (a phone), the tile stacks the parts, one a line, without the comma.
        const parts = line.locator('.stat-tile__part');
        const shown = (await parts.count()) > 0 ? (await parts.allTextContents()).join(', ') : (await line.textContent())!;
        expect(shown).toBe('Melee +2, missile +1');
        expect(shown.slice(1)).not.toMatch(/\p{Lu}/u);

        expect(await layoutProblems(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Vitals"]')).toEqual([]);
      });
    }
  });
}
