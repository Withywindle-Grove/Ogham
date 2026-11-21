// dec-13 C13 (docs/plans/dec-13-the-player-screen.md; ps-2, ps-9, ch-1; frames P1 and P2 of december/14, approved
// 2026-11-14): skills as rows with a chevron and the die's glyph beside the odds, on the shared P1-like character
// (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts; its Hark is on a d6). Purposes:
//   On the Player screen each skill row shows, left to right, its name, the die's glyph, its odds and a chevron; the
//   glyph sits on the odds' line, the row is a 44 px target, and nothing runs off a 375 px phone, in light and dark.
//   A skill rolled the target or higher on one die (Hark) reads "N+ on", the glyph, "dN" instead (tfs-3, plan
//   test-feedback-2026-11-19 row C14; changed on Francis's yes, 2026-11-20).
//   The skills are one shared block, so the full sheet's own page (from the menu's "Full character sheet"; the tab's row is gone, tfr-5) shows the
//   same chevron and glyph.
//   No text under 14 px, no sideways scroll and no serious accessibility problem in the Skills section.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';
import { openFullSheetFromMenu } from './fullSheetMenu.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Skills' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Each skill row: the glyph before the odds, the chevron after them, all on one line, a 44 px target inside the screen. */
async function checkRows(skills: Locator, width: number) {
  const rows = skills.getByRole('button');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await row.scrollIntoViewIfNeeded();
    const glyph = row.locator('.list-row__value .die-glyph');
    const value = row.locator('.list-row__value');
    const chevron = row.locator('.list-row__chevron');
    await expect(glyph).toBeVisible();
    await expect(chevron).toBeVisible();
    const [r, g, v, c] = await Promise.all([row.boundingBox(), glyph.boundingBox(), value.boundingBox(), chevron.boundingBox()]);
    expect(r!.height).toBeGreaterThanOrEqual(44);
    expect(r!.x + r!.width).toBeLessThanOrEqual(width);
    // Name, then the glyph with the odds, then the chevron (frame P1): the glyph ends before the odds' words begin; for
    // a target ("N+ on", the glyph, "dN"; tfs-3) the glyph sits between the two parts of the words.
    const words = await value.evaluate((el) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        .map((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          const box = range.getBoundingClientRect();
          return { text: n.textContent!.trim(), x: box.x, right: box.right };
        }),
    );
    expect(g!.x).toBeGreaterThanOrEqual(v!.x);
    if (/^\d+\+ on$/.test(words[0]!.text)) {
      expect(words.map((w) => w.text)).toEqual([words[0]!.text, `d${await glyph.getAttribute('data-die')}`]);
      expect(words[0]!.right).toBeLessThanOrEqual(g!.x);
      expect(g!.x + g!.width).toBeLessThanOrEqual(words[1]!.x);
    } else {
      expect(g!.x + g!.width).toBeLessThanOrEqual(words[0]!.x);
    }
    expect(c!.x).toBeGreaterThanOrEqual(v!.x + v!.width);
    // The glyph sits on the odds' line: its middle within the value's box.
    const middle = g!.y + g!.height / 2;
    expect(middle).toBeGreaterThan(v!.y);
    expect(middle).toBeLessThan(v!.y + v!.height);
  }
}

for (const scheme of SCHEMES) {
  test.describe(`skills as rows (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const size of SIZES) {
      test(`each skill: name, the die's glyph, the odds, a chevron (${size.name}, ${size.width} px, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page);
        const skills = page.getByRole('region', { name: 'Skills' });
        await checkRows(skills, size.width);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await noSidewaysScroll(page)).toBe(true);
        expect(await accessibilityProblems(page, 'section[aria-label="Skills"]')).toEqual([]);
      });
    }

    test(`the full sheet's own page shows the same rows (phone, 375 px, ${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await openPlayer(page);
      // The full sheet's own page from the menu: the Player tab's row is gone (tfr-5).
      await openFullSheetFromMenu(page);
      const skills = page.getByRole('region', { name: 'Skills' });
      await expect(skills).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await checkRows(skills, SIZES[1].width);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await noSidewaysScroll(page)).toBe(true);
    });
  });
}
