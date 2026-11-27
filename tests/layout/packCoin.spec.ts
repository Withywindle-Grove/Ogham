// The coin line and the coin's sheets on the Pack (K9, K10; mockup pack/07 PC1 to PC5 and PC10, pack/08 PK1 and PK6,
// approved 2026-11-13 and 2026-11-14), in a real browser at 375 px and on a landscape tablet. Purposes:
//   1. The Pack with its coin line, the coin's sheet, Spend with a refusal under the herons row, and Give to: no
//      sideways scrolling, every target at least 44 px, readable text, no serious accessibility problem.
//   2. On a phone the coin line sits under the load and above the lists; on a tablet it sits in the right column,
//      under the load (PC10, PK1).
//   3. Five long coin names wrap inside the line and its chevron stays at the right, on the screen.
//   4. The GM on a character's Pack (K15, PC7 and PC8): the coin line, the sheet with Give coin… and Take coin…, Give
//      coin with its one accent, and Take coin refused under the row: no sideways scrolling, every target at least
//      44 px, readable text, no serious accessibility problem; the accent's words on one line.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1180, height: 820 },
] as const;

async function openPack(page: Page, coin: '1' | 'messy' = '1') {
  await page.goto(`/layout.html?as=player&coin=${coin}`);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Pack' }).click();
  await expect(page.getByRole('heading', { name: 'Wren of the Lantern Wardens’ pack' })).toBeAttached();
}

/** The GM opens Wren's pack from the Players page (the "Pack" button on her row; PC7). */
async function openPackAsGm(page: Page) {
  await page.goto('/layout.html?as=gm&coin=1');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('button', { name: /^Players/ }).click();
  await page.getByRole('button', { name: "Open Wren of the Lantern Wardens’ pack" }).click();
  await expect(page.getByRole('region', { name: 'Wren of the Lantern Wardens’ pack' })).toBeAttached();
}

const coinLine = (page: Page) => page.getByRole('button', { name: /^Coin: / });

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    const scenes: { name: string; open: (page: Page) => Promise<void> }[] = [
      { name: 'pack-coin', open: async (page) => void (await expect(coinLine(page)).toHaveText('12 crowns, 30 herons')) },
      {
        name: 'pack-coin-sheet',
        open: async (page) => {
          await coinLine(page).click();
          await expect(page.getByRole('dialog', { name: 'Wren of the Lantern Wardens’ coin' })).toBeVisible();
        },
      },
      {
        name: 'pack-coin-spend-refused',
        open: async (page) => {
          await coinLine(page).click();
          await page.getByRole('button', { name: 'Spend…' }).click();
          await page.getByRole('textbox', { name: 'Herons' }).fill('45');
          await page.getByRole('button', { name: 'Spend 45 herons' }).click();
          await expect(page.getByRole('alert')).toHaveText('Wren of the Lantern Wardens has 30 herons.');
        },
      },
      {
        name: 'pack-coin-give',
        open: async (page) => {
          await coinLine(page).click();
          await page.getByRole('button', { name: 'Give to…' }).click();
          await page.getByRole('textbox', { name: 'Herons' }).fill('10');
          await page.getByRole('radio', { name: 'Party stash' }).click();
          await expect(page.getByRole('button', { name: 'Put in 10 herons' })).toBeVisible();
        },
      },
    ];
    for (const scene of scenes) {
      test(`${scene.name}: no sideways scrolling, taps at least 44px, readable text, accessible`, async ({ page }) => {
        await openPack(page);
        await scene.open(page);
        await page.screenshot({ path: `test-results/layout-screens/${scene.name}-${size.width}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }

    test(`the coin line sits ${size.name === 'phone' ? 'under the load, above the lists' : 'in the right column, under the load'}`, async ({ page }) => {
      await openPack(page);
      const line = (await coinLine(page).boundingBox())!;
      const load = (await page.locator('.pack__load').boundingBox())!;
      const list = (await page.locator('.pack__list').boundingBox())!;
      expect(line.y).toBeGreaterThanOrEqual(load.y + load.height - 1);
      if (size.name === 'phone') expect(line.y + line.height).toBeLessThanOrEqual(list.y + 1);
      else expect(line.x).toBeGreaterThanOrEqual(list.x + list.width);
    });

    // Purpose (the lead, 2026-11-14): the accent is a stacked button, its icon over words that keep the amount on one
    // line, and at least 88 px wide.
    test('the accent "Spend 2 herons" keeps its words on one line under its icon, at least 88 px wide', async ({ page }) => {
      await openPack(page);
      await coinLine(page).click();
      await page.getByRole('button', { name: 'Spend…' }).click();
      await page.getByRole('textbox', { name: 'Herons' }).fill('2');
      const button = page.getByRole('button', { name: 'Spend 2 herons' });
      const box = (await button.boundingBox())!;
      const icon = (await button.locator('svg').boundingBox())!;
      const words = await button.locator('span').evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return { lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size, top: el.getBoundingClientRect().top };
      });
      expect(box.width).toBeGreaterThanOrEqual(88);
      expect(words.lines).toBe(1);
      expect(icon.y + icon.height).toBeLessThanOrEqual(words.top + 1);
    });

    test('five long coin names wrap inside the line, the chevron at its right and on the screen', async ({ page }) => {
      await openPack(page, 'messy');
      const line = coinLine(page);
      await expect(line).toHaveText('2 moon-silver crowns of the Old Causeway, 999 heron marks, 120 reed-bits, 7 drowned pennies, 3 lantern tokens');
      const box = (await line.boundingBox())!;
      const chevron = (await line.locator('.pack__chevron').boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(chevron.x + chevron.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(chevron.x).toBeGreaterThan(box.x + box.width / 2);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}

// The GM's pictures at the phone's width and the iPad's (K15: the lead looks at 375 and 1024 before the merge).
for (const size of [{ name: 'gm-phone', width: 375, height: 812 }, { name: 'gm-ipad', width: 1024, height: 768 }] as const) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    const gmScenes: { name: string; open: (page: Page) => Promise<void> }[] = [
      { name: 'pack-coin-gm', open: async (page) => void (await expect(coinLine(page)).toHaveText('12 crowns, 30 herons')) },
      {
        name: 'pack-coin-gm-sheet',
        open: async (page) => {
          await coinLine(page).click();
          await expect(page.getByRole('dialog', { name: 'Wren of the Lantern Wardens’ coin' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Take coin…' })).toBeVisible();
        },
      },
      {
        name: 'pack-coin-gm-give',
        open: async (page) => {
          await coinLine(page).click();
          await page.getByRole('button', { name: 'Give coin…' }).click();
          await page.getByRole('textbox', { name: 'Herons' }).fill('40');
          await expect(page.getByRole('button', { name: 'Give Wren of the Lantern Wardens 40 herons' })).toBeVisible();
        },
      },
      {
        name: 'pack-coin-gm-take',
        open: async (page) => {
          await coinLine(page).click();
          await page.getByRole('button', { name: 'Take coin…' }).click();
          await page.getByRole('textbox', { name: 'Herons' }).fill('10');
          await expect(page.getByRole('button', { name: 'Take 10 herons' })).toBeVisible();
          // One accent on the sheet (sa-1).
          await expect(page.getByRole('dialog').locator('.button-primary')).toHaveCount(1);
        },
      },
      {
        name: 'pack-coin-gm-take-refused',
        open: async (page) => {
          await coinLine(page).click();
          await page.getByRole('button', { name: 'Take coin…' }).click();
          await page.getByRole('textbox', { name: 'Herons' }).fill('45');
          await page.getByRole('button', { name: 'Take 45 herons' }).click();
          await expect(page.getByRole('alert')).toHaveText('Wren of the Lantern Wardens has 30 herons.');
        },
      },
    ];
    for (const scene of gmScenes) {
      test(`${scene.name}: no sideways scrolling, taps at least 44px, readable text, accessible`, async ({ page }) => {
        await openPackAsGm(page);
        await scene.open(page);
        await page.screenshot({ path: `test-results/layout-screens/${scene.name}-${size.width}.png`, fullPage: true });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    }
  });
}
