// The component gallery in a real browser (docs/06 "Gallery and screenshot tests"; ruled 2026-10-25): every part
// on the real tokens, in both themes, at phone and tablet widths and at the largest text. Each run checks:
//   * no sideways scrolling, targets at least 44px, text at least 14px (body 16);
//   * no serious accessibility problems, colour contrast included (axe, WCAG 2 AA);
//   * nothing in the gallery animates under reduced motion (skeletons and the toast bar hold still);
// and saves a screenshot of each in test-results/gallery for review (compared pixel by pixel once approved).
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const;
const THEMES = ['light', 'dark'] as const;
// Set by GitHub Actions. (Declared here so the project needn't add Node's type definitions.)
declare const process: { env: Record<string, string | undefined> };
const CI = !!process.env.CI;
// A pull request into a held stack (any base but main) skips the picture comparison; every other check still runs. Main,
// and a stack's own pull request into main, compare in full (Francis, 2026-11-18, ci-held-gallery). Set by check.yml.
const INTO_HELD_STACK = !!process.env.PR_BASE && process.env.PR_BASE !== 'main';

for (const size of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`${size.name} ${theme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test(`gallery (${size.name}, ${theme}): fits, 44px targets, 14px text, accessible`, async ({ page }) => {
        // The whole gallery is checked in one page, and it has outgrown the default 30 s (tablet dark ran out on #555 and
        // on main): a longer budget, not a fault. 300 s since 2026-11-21: on GitHub's machines the tablet-dark run ran out
        // at 120 s on #11, #12 and #13, while every other check of theirs passed (the PC took a fraction of that).
        test.setTimeout(300_000);
        await page.goto(`/gallery.html?theme=${theme}`);
        await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
        // The whole page while it fits a browser's picture limit (32,767 device pixels: on a high-density screen the
        // phone gallery passed it with the trait chips, tc-1); past that, the first screenful. The section pictures
        // below cover every part.
        const tall = await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio);
        await page.screenshot({ path: `test-results/gallery/gallery-${size.name}-${theme}.png`, fullPage: tall < 32767 });
        // One picture per section too, readable for review.
        for (const section of await page.locator('.gallery__section').all()) {
          const id = await section.getAttribute('id');
          await section.screenshot({ path: `test-results/gallery/${size.name}-${theme}-${id}.png` });
        }
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Each section against its approved picture (Francis approves intended changes; ruled 2026-10-25).
      test(`gallery (${size.name}, ${theme}) matches the approved pictures`, async ({ page }) => {
        test.skip(!CI, 'compared in CI only: the approved pictures are drawn on Linux');
        test.skip(INTO_HELD_STACK, 'not compared on a pull request into a held stack: the stack is compared on its way to main');
        test.setTimeout(120_000); // one picture per section; the gallery outgrew 30 s on a tablet (#567)
        await page.goto(`/gallery.html?theme=${theme}`);
        await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        // Every section is compared even after one differs (expect.soft), so one run shows every changed picture;
        // stopping at the first made the later ones look as if they came and went between runs.
        for (const section of await page.locator('.gallery__section').all()) {
          const id = await section.getAttribute('id');
          await expect.soft(section).toHaveScreenshot(`${size.name}-${theme}-${id}.png`, { maxDiffPixelRatio: 0.002 });
        }
      });
    });
  }
}

// The gallery pictures' "1 px offsets" (fix-gallery-flake): a part added in one section moved every later section by
// a fraction of a pixel, so their pictures changed though nothing in them did. Each section now starts on a whole
// pixel and is a whole number of pixels tall, so one section's change can't reach another section's picture.
test('every gallery section starts on a whole pixel and is a whole number of pixels tall, phone and tablet', async ({ page }) => {
  const off: string[] = [];
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Two frames, so the sections have measured themselves after the fonts arrived (as the picture check's two
    // matching screenshots do).
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('.gallery__section')].flatMap((section) => {
        const box = section.getBoundingClientRect();
        const top = box.top + window.scrollY;
        return Number.isInteger(top) && Number.isInteger(box.height) ? [] : [`${section.id}: top ${top}, height ${box.height}`];
      }),
    );
    off.push(...found.map((line) => `${size.name} ${line}`));
  }
  expect(off).toEqual([]);
});

// The Light rows (Design on #561; tg-1, frame P1 of december/14): the 52 px ring at the left, the name and its line
// beside it, the lit-or-out toggle at the right of the same row; under the row Keep lit (its name, ⓘ, its toggle) and,
// for a holder, Refill, a stacked button at the right. Every control 44 px with at least 8 px between, at a phone's width.
test.describe('Light rows', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("the ring leads each row, the words beside it, the toggle at the row's right; Keep lit under it", async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    const rows = await page.locator('#players-standard .light-block__row').all();
    expect(rows.length).toBe(3);
    for (const row of rows) {
      const box = (await row.boundingBox())!;
      const ring = (await row.locator('.light-block__ring').boundingBox())!;
      const words = (await row.locator('.light-block__body').boundingBox())!;
      const toggle = (await row.locator('[role="switch"]').boundingBox())!;
      expect(Math.round(ring.width)).toBe(52);
      expect(words.x).toBeGreaterThanOrEqual(ring.x + ring.width);
      expect(toggle.x).toBeGreaterThanOrEqual(words.x + words.width);
      expect(Math.round(toggle.x + toggle.width)).toBe(Math.round(box.x + box.width));
      expect(Math.min(toggle.width, toggle.height)).toBeGreaterThanOrEqual(43.5);
      const keep = row.locator('xpath=following-sibling::div[contains(@class, "light-block__keep")][1]');
      const controls = await keep.locator('button').all();
      const boxes = await Promise.all(controls.map(async (b) => (await b.boundingBox())!));
      expect(boxes.length).toBeGreaterThanOrEqual(2);
      for (const b of boxes) expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(43.5);
      expect(boxes[0]!.y).toBeGreaterThanOrEqual(box.y + box.height);
      for (let i = 1; i < boxes.length; i++) {
        const [a, b] = [boxes[i - 1]!, boxes[i]!];
        // On one line when they overlap top to bottom (centred, they needn't share a top edge).
        const sameLine = a.y < b.y + b.height && b.y < a.y + a.height;
        const gap = sameLine ? b.x - (a.x + a.width) : b.y - (a.y + a.height);
        expect(gap).toBeGreaterThanOrEqual(7.5);
      }
    }
  });
});

// The Status ring's symbol (ruled 2026-11-08, Francis on the live Light row): its box is half the ring's diameter and
// centred in it, and the drawing itself sits centred in the ring too (the flame was small and high), on every ring:
// the tiles, the sheet's big ring and the Light rows.
test.describe('Status ring symbol', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('the symbol is half the ring across and centred in it', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    const marks = await page.locator('#players-standard .status-ring__mark').all();
    let symbols = 0;
    for (const mark of marks) {
      const svg = mark.locator('.status-ring__symbol svg');
      if ((await svg.count()) === 0) continue;
      symbols++;
      const ring = (await mark.boundingBox())!;
      const box = (await svg.boundingBox())!;
      expect(Math.abs(box.width - ring.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - ring.height / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.x + box.width / 2 - (ring.x + ring.width / 2))).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height / 2 - (ring.y + ring.height / 2))).toBeLessThanOrEqual(1);
      // The drawing (its paths' painted box) is centred too, within 1.5 px, and fills most of its box.
      const drawn = await svg.evaluate((el) => {
        const boxes = [...el.querySelectorAll('path, circle, rect, line, polyline, polygon')].map((p) => p.getBoundingClientRect());
        const left = Math.min(...boxes.map((b) => b.left));
        const top = Math.min(...boxes.map((b) => b.top));
        const right = Math.max(...boxes.map((b) => b.right));
        const bottom = Math.max(...boxes.map((b) => b.bottom));
        return { x: (left + right) / 2, y: (top + bottom) / 2, size: Math.max(right - left, bottom - top) };
      });
      expect(Math.abs(drawn.x - (ring.x + ring.width / 2))).toBeLessThanOrEqual(1.5);
      expect(Math.abs(drawn.y - (ring.y + ring.height / 2))).toBeLessThanOrEqual(1.5);
      expect(drawn.size).toBeGreaterThanOrEqual(box.width * 0.75);
    }
    expect(symbols).toBeGreaterThan(5);
  });
});

// One Close everywhere (tf-8): every Close is the bare ✕, named "Close", with a 44 px tap area both ways.
test.describe('Close', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('every Close in the gallery is the ✕, named Close, at least 44 px wide and tall', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    // Every Close measured at once (C7, Francis's yes of 2026-11-20): one query over the gallery, not one per Close,
    // so the test stays quick as the gallery grows. The role query keeps the name check.
    const closes = await page.getByRole('button', { name: 'Close', exact: true }).evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { text: (button.textContent ?? '').trim(), size: Math.min(box.width, box.height) };
      }),
    );
    expect(closes.length).toBeGreaterThan(0);
    for (const [i, close] of closes.entries()) {
      expect(close.text, `Close ${i}`).toBe('✕');
      expect(close.size, `Close ${i}`).toBeGreaterThanOrEqual(43.5);
    }
  });
});

// The Open card on a phone (Francis, #364's pictures): with a long name that wraps, the › sits at the card's right
// edge (inside its padding) and halfway down the card, never wrapped under the text.
test.describe('Open card on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('with a long name, the › sits at the right edge, centred, and the text wraps beside it', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const card = page.getByRole('button', { name: 'Where you are: the long name' });
    const [box, mark, text] = await Promise.all([
      card.boundingBox(),
      card.locator('.open-card__chevron').boundingBox(),
      card.locator('.open-card__text').boundingBox(),
    ]);
    const padRight = await card.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight) + parseFloat(getComputedStyle(el).borderRightWidth));
    // The name really wraps (more than two lines of text), so the test means something.
    expect(text!.height).toBeGreaterThan(box!.height / 2);
    expect(Math.abs(mark!.x + mark!.width - (box!.x + box!.width - padRight))).toBeLessThanOrEqual(1);
    expect(Math.abs(mark!.y + mark!.height / 2 - (box!.y + box!.height / 2))).toBeLessThanOrEqual(3);
    // Beside the text, not under it.
    expect(text!.x + text!.width).toBeLessThanOrEqual(mark!.x);
  });
});

test.describe('larger text', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('at the largest text size, long names and numbers never push the page sideways', async ({ page }) => {
    await page.goto('/gallery.html?theme=light&size=larger');
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
    // One picture pixel per CSS pixel, and the whole page while it fits a browser's picture limit (32,767 px); past
    // that, the first screenful only. The check below covers the whole page.
    const tall = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: 'test-results/gallery/gallery-phone-larger.png', fullPage: tall < 32767, scale: 'css' });
    expect(await layoutProblems(page)).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  test('skeletons and the toast bar hold still', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('.skeleton__row, .toast__bar')].filter((el) => getComputedStyle(el).animationName !== 'none').length,
    );
    expect(moving).toBe(0);
  });

  // Purpose (plan m5b-sheet-revised PR 2, step 9): a lit tab's glow holds still under reduced motion, still glowing.
  test("a lit tab's glow holds still and keeps its halo", async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await expect(page.locator('#gm-attention')).toBeVisible();
    const lit = await page.evaluate(() =>
      [...document.querySelectorAll('.section-nav__tab--lit .section-nav__icon > .icon')].map((el) => ({
        animation: getComputedStyle(el).animationName,
        filter: getComputedStyle(el).filter,
      })),
    );
    expect(lit.length).toBeGreaterThan(0);
    for (const icon of lit) {
      expect(icon.animation).toBe('none');
      expect(icon.filter).toContain('drop-shadow');
    }
  });
});

// The breathe (plan m5b-sheet-revised PR 2, step 9): with motion allowed, a lit tab's icon breathes; an unlit one doesn't.
test.describe('the glow breathes', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('a lit tab breathes on its 2.4 s cycle; unlit tabs are still', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    await expect(page.locator('#gm-attention')).toBeVisible();
    const icons = await page.evaluate(() =>
      // The reduced-motion specimen (.motion-still) is the one lit tab drawn still on purpose.
      [...document.querySelectorAll('#gm-attention .section-nav__tab')].filter((tab) => !tab.closest('.motion-still')).map((tab) => {
        const style = getComputedStyle(tab.querySelector('.section-nav__icon > .icon')!);
        return { lit: tab.classList.contains('section-nav__tab--lit'), animation: style.animationName, duration: style.animationDuration };
      }),
    );
    expect(icons.some((i) => i.lit)).toBe(true);
    for (const icon of icons) {
      if (icon.lit) expect(icon).toMatchObject({ animation: 'section-nav-breathe', duration: '2.4s' });
      else expect(icon.animation).toBe('none');
    }
  });
});

// Skills on a phone (#410's pictures): a name long enough to wrap past two lines takes the whole row; a short one
// keeps its half, so the grid stays two columns.
test.describe('Skill grid on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('the long skill spans the row at 375 px and "Wade the deep pools" does not', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const long = page.getByRole('button', { name: /^Find the way through the drowned causeway at night/ });
    const wade = page.getByRole('button', { name: /^Wade the deep pools/ });
    const grid = long.locator('xpath=..');
    const [gridBox, longBox, wadeBox] = await Promise.all([grid.boundingBox(), long.boundingBox(), wade.boundingBox()]);
    expect(Math.abs(longBox!.width - gridBox!.width)).toBeLessThanOrEqual(1);
    expect(wadeBox!.width).toBeLessThan(gridBox!.width * 0.6);
  });
});

// Traits as chips on a phone (tc-1 … tc-4): 13 kindred traits with a long name. Every chip is 44 px tall and fits the
// panel; the long one takes a row of its own; short ones share a row (8 px apart); the group folds after 12 with
// "+ 1 more", which shows all 13.
test.describe('Trait chips on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('at 375 px the chips wrap, the long name takes its row, and 13 fold to 12 with "+ 1 more"', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const group = page.getByRole('group', { name: 'Kindred: Reed kin' });
    await group.scrollIntoViewIfNeeded();
    const row = group.locator('.trait-chips__row');
    const rowBox = (await row.boundingBox())!;
    const more = group.getByRole('button', { name: 'Show 1 more Kindred: Reed kin traits' });
    await expect(more).toHaveText('+ 1 more');
    const chips = group.locator('.chip--trait');
    await expect(chips).toHaveCount(13);
    const boxes = await Promise.all((await chips.all()).map((c) => c.boundingBox()));
    for (const box of boxes) {
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
      expect(box!.x).toBeGreaterThanOrEqual(rowBox.x - 0.5);
      expect(box!.x + box!.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
    }
    // The long name wraps inside its chip, alone on its row.
    const long = (await group.getByRole('button', { name: /^Knows the hidden paths/ }).boundingBox())!;
    const sharing = boxes.filter((b) => b !== null && b.y < long.y + long.height - 1 && b.y + b.height > long.y + 1);
    expect(sharing).toHaveLength(1);
    // Short names share a row: the first two sit side by side, 8 px apart.
    const [first, second] = boxes;
    expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1);
    expect(Math.round(second!.x - (first!.x + first!.width))).toBe(8);
    await more.click();
    await expect(group.locator('.chip--trait')).toHaveCount(13);
    await expect(group.getByRole('button', { name: 'Tide memory: open its entry' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

// The to-hit row on a phone (#410's pictures): two rows of five (AC 9–5, then 4–0), so every AC column is in sight
// with no sideways scroll; from 600 px the two join into one row as before.
test.describe('Breakdown to-hit row', () => {
  const cells = (page: Page) => page.locator('.breakdown__to-hit-rows td');
  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 } });
    test('at 375 px every AC column 9…0 is visible without scrolling', async ({ page }) => {
      await page.goto('/gallery.html?theme=light');
      const rows = page.locator('.breakdown__to-hit-rows').first();
      await rows.scrollIntoViewIfNeeded();
      const acs = await page.locator('.breakdown__to-hit-rows tr:first-child td').allTextContents();
      expect(acs).toEqual(['9', '8', '7', '6', '5', '4', '3', '2', '1', '0']);
      const box = (await rows.boundingBox())!;
      for (const cell of await cells(page).all()) {
        const c = (await cell.boundingBox())!;
        expect(c.x).toBeGreaterThanOrEqual(box.x - 0.5);
        expect(c.x + c.width).toBeLessThanOrEqual(Math.min(box.x + box.width, 375) + 0.5);
      }
      // Nothing between the cells and the page scrolls sideways.
      const scrolls = await rows.evaluate((el) => {
        const out: string[] = [];
        for (let node: Element | null = el; node; node = node.parentElement) if (node.scrollWidth > node.clientWidth + 1) out.push(node.className);
        return out;
      });
      expect(scrolls).toEqual([]);
    });
  });
  test.describe('on a tablet', () => {
    test.use({ viewport: { width: 1024, height: 768 } });
    test('the to-hit row stays one row, AC 9 to 0', async ({ page }) => {
      await page.goto('/gallery.html?theme=light');
      await page.locator('.breakdown__to-hit-rows').first().scrollIntoViewIfNeeded();
      expect(await cells(page).count()).toBe(20);
      const tops = new Set((await Promise.all((await cells(page).all()).map((c) => c.boundingBox()))).map((b) => Math.round(b!.y)));
      // Two lines (AC and Roll), not four.
      expect(tops.size).toBe(2);
    });
  });
});

// The Magic section's harder states (Design, on #482), at 375 px: six spell levels wrap without clipping (level 4,
// with none, left out); five kinds of magic take the small tabs once full size would take more than two rows, still
// 44 px tall; a list of 11 folds after 8 with "3 more" (no "›", plan m5b-players-screens-standard D); a caster who prays with nothing prepared says so.
test.describe('Magic section states on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('levels wrap unclipped, five kinds use the small tabs, the fold, nothing prepared', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const specimen = (name: string) => page.locator('.gallery__specimen').filter({ has: page.getByText(name, { exact: true }) });
    const levels = specimen('Magic, six spell levels with level 4 at none (left out): the levels wrap, nothing clipped');
    await levels.scrollIntoViewIfNeeded();
    const stage = (await levels.locator('.gallery__stage').boundingBox())!;
    const items = levels.locator('.magic__level');
    await expect(items).toHaveText([/^Level 1/, /^Level 2/, /^Level 3/, /^Level 5/, /^Level 6/]);
    const boxes = await Promise.all((await items.all()).map((i) => i.boundingBox()));
    for (const box of boxes) expect(box!.x + box!.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBeGreaterThan(1);

    const kinds = specimen('Magic, five kinds: past two rows at full size the tabs take the small size').getByRole('group', { name: 'Kinds of magic' }).getByRole('button');
    await expect(kinds).toHaveText(['Spell book: 2', 'Prepared: 1', 'Glamours: 1', 'Runes: 1', 'Knacks: 1']);
    for (const tab of await kinds.all()) {
      await expect(tab).toHaveClass(/button-secondary--small/);
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    }

    const long = specimen('Magic, a list of 11 folds after 8');
    await expect(long.getByRole('heading', { name: 'Fen tricks: 11' })).toBeVisible();
    // A lone kind (a heading, no tabs, no spells a day): every row still spans the section's full width (Design).
    const inner = await long.locator('.gallery__stage').evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    });
    const section = (await long.locator('.magic').boundingBox())!;
    expect(Math.abs(section.width - inner)).toBeLessThanOrEqual(0.5);
    for (const row of await long.locator('.entry-panel__book-row').all()) expect(Math.abs((await row.boundingBox())!.width - section.width)).toBeLessThanOrEqual(0.5);
    await expect(long.locator('.entry-panel__book-row')).toHaveCount(8);
    await long.getByRole('button', { name: '3 more' }).click();
    await expect(long.locator('.entry-panel__book-row')).toHaveCount(11);

    const prays = specimen('Magic, a caster who prays, nothing prepared');
    await expect(prays.getByRole('heading', { name: 'Prepared: 0' })).toBeVisible();
    await expect(prays.getByText('Nothing prepared yet.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

// On a tablet the same five kinds fit two rows at full size: no small tabs.
test.describe('Magic section tabs on a tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('five kinds keep the full-size tabs', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const kinds = page.locator('.gallery__specimen').filter({ has: page.getByText('Magic, five kinds: past two rows at full size the tabs take the small size', { exact: true }) }).getByRole('group', { name: 'Kinds of magic' }).getByRole('button');
    await expect(kinds).toHaveCount(5);
    for (const tab of await kinds.all()) await expect(tab).not.toHaveClass(/button-secondary--small/);
  });
});

// A score tile's long name (Design on #544, 2026-11-07), at 375 px: a short name sits beside its stepper; a long one
// takes its own line, wrapping between words and never inside one, with the stepper under it at the right. Scores and
// Adjust alike.
test.describe('score tiles with long names on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('a short name beside the stepper; a long one on its own line, never broken inside a word', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const SCORES = 'Scores (B, final draft 1): untouched tiles at the average with the line; three touched; a long name, 0 and 999';
    const ADJUST = 'Adjust scores (B, final draft 1): the lead; the prime tagged with + only; others with − only; at the floor no −; under it the sign; a traded tile says what it was (Design on #555)';
    const TWO = "Adjust scores (B), two primes: the pack's line in the lead; both primes with +; neither says which sets the experience (the pack's line does); 999";
    const tile = (specimen: string, name: string) =>
      page.locator('.gallery__specimen').filter({ has: page.getByText(specimen, { exact: true }) }).getByRole('group', { name: `${name} score`, exact: true });
    const parts = async (specimen: string, name: string) => {
      const t = tile(specimen, name);
      await t.scrollIntoViewIfNeeded();
      return { box: (await t.boundingBox())!, name: (await t.locator('.score-tile__key').boundingBox())!, value: (await t.locator('.score-tile__value').boundingBox())! };
    };
    // Each word of a name drawn on one line: no word split across two.
    const wordsWhole = (specimen: string, name: string) =>
      tile(specimen, name)
        .locator('.score-tile__key')
        .evaluate((el) => {
          const split: string[] = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? '';
            for (const m of text.matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
              if (tops.size > 1) split.push(m[0]);
            }
          }
          return split;
        });
    for (const specimen of [SCORES, ADJUST]) {
      const short = await parts(specimen, 'Might');
      expect(short.value.y).toBeLessThan(short.name.y + short.name.height);
    }
    for (const [specimen, name] of [
      [SCORES, 'Nimbleness of the long-gone marsh wardens'],
      [ADJUST, 'Nimbleness of the long-gone marsh wardens'],
      [TWO, 'Lore of the drowned abbey'],
    ] as const) {
      const long = await parts(specimen, name);
      expect(long.value.y).toBeGreaterThanOrEqual(long.name.y + long.name.height - 0.5);
      expect(long.value.x + long.value.width).toBeGreaterThan(long.box.x + long.box.width - 40);
      expect(await wordsWhole(specimen, name)).toEqual([]);
    }
  });
});

// Design on #564 (mockup creation/final/12): a word figure in a Score tile is 16 px and wraps to at most three lines.
test.describe('a word figure in a Score tile at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('draws at 16 px on at most three lines', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const words = page.locator('#creation-review .stat-tile__value--word');
    await words.first().scrollIntoViewIfNeeded();
    expect(await words.count()).toBeGreaterThan(1);
    for (const el of await words.all()) {
      const m = await el.evaluate((node) => {
        const style = getComputedStyle(node);
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = node.getBoundingClientRect();
        const tops = new Set([...range.getClientRects()].filter((r) => r.top < box.bottom - 1).map((r) => Math.round(r.top)));
        return { size: style.fontSize, lines: tops.size };
      });
      expect(m.size).toBe('16px');
      expect(m.lines).toBeLessThanOrEqual(3);
    }
  });
});

// Design on #564: a long Save tile label wraps (the whole label matters) and the rows stay even: every tile in a row
// the same height and width. Since F8 (Design, 2026-11-10) a word too wide for five across makes the row three and
// two instead of breaking the word, so the tiles are compared row by row.
test.describe('a long Save tile label at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('wraps whole, never cut at the bottom, and the tiles stay even row by row', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const row = page.locator('#players-standard .save-tiles').nth(1);
    await row.scrollIntoViewIfNeeded();
    const tiles = await row.locator('.stat-tile').all();
    const boxes = await Promise.all(tiles.map(async (t) => (await t.boundingBox())!));
    for (const top of new Set(boxes.map((b) => Math.round(b.y)))) {
      const inRow = boxes.filter((b) => Math.round(b.y) === top);
      for (const box of inRow) {
        expect(Math.abs(box.height - inRow[0]!.height)).toBeLessThan(1);
        expect(Math.abs(box.width - boxes[0]!.width)).toBeLessThan(1);
      }
    }
    const label = row.locator('.stat-tile__label').last();
    const m = await label.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = [...range.getClientRects()].filter((r) => r.width > 0);
      const tile = el.closest('.stat-tile')!.getBoundingClientRect();
      // Every line of the label inside its own box and its tile: nothing cut at the bottom.
      return { cut: el.scrollHeight > el.clientHeight + 1, lastBottom: Math.max(...lines.map((r) => r.bottom)), tileBottom: tile.bottom };
    });
    expect(m.cut).toBe(false);
    expect(m.lastBottom).toBeLessThanOrEqual(m.tileBottom + 0.5);
  });
});

// The players' screens on a phone (Design on #553): five Save tiles sit on one row at 375 px, each at least one tap
// tall and wide; a list row's value ("87 %") never breaks, the name beside it wraps instead.
test.describe("The players' screens at 375 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('five save tiles on one row, and a skill value kept whole', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const section = page.locator('#players-standard');
    await expect(section.locator('.save-tiles').first()).toBeVisible();
    const tiles = await section.locator('.save-tiles').first().locator('.stat-tile').all();
    expect(tiles).toHaveLength(5);
    const boxes = await Promise.all(tiles.map(async (t) => (await t.boundingBox())!));
    for (const box of boxes) {
      expect(Math.abs(box.y - boxes[0]!.y)).toBeLessThan(1);
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(43.5);
    }
    const value = section.locator('.list-row__value', { hasText: '87 %' });
    const lines = await value.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
    // The long name beside it wrapped instead.
    const name = (await section.locator('.list-row', { hasText: '87 %' }).locator('.list-row__title').boundingBox())!;
    expect(name.height).toBeGreaterThan(30);
  });
});

// The List row in the book's type (the lead's ruling, pq-1 sizes, 2026-11-14), at 375 px:
//   * a plain row's title is 20 px inside the book's scope, and stays 16 px outside it;
//   * a figure row's name stays 16 px beside its 24 px figure, inside the scope;
//   * a label row ("Source", "Set by", "Log") stays 16 px inside the scope;
//   * nothing runs past the screen's edge, a long title wrapping instead.
test.describe("The List row in the book's type at 375 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('plain titles 20 px inside the book, 16 outside; figure and label rows 16; no overflow', async ({ page }) => {
    await page.goto('/gallery.html?theme=light');
    const size = (el: Element) => getComputedStyle(el).fontSize;
    const book = page.locator('#book-list-rows');
    await expect(book.locator('.book-type .list-row').first()).toBeVisible();
    expect(await book.locator('.list-row:not(.list-row--figure, .list-row--label) .list-row__title').first().evaluate(size)).toBe('20px');
    expect(await book.locator('.list-row--figure .list-row__title').first().evaluate(size)).toBe('16px');
    expect(await book.locator('.list-row--label .list-row__title').first().evaluate(size)).toBe('16px');
    // Outside the book's scope: the players' screens' rows are unchanged.
    expect(await page.locator('#players-standard .list-row:not(.list-row--figure) .list-row__title').first().evaluate(size)).toBe('16px');
    // No row wider than the screen: the long title wraps at 20 px.
    for (const row of await book.locator('.list-row').all()) {
      const fit = await row.evaluate((el) => ({ over: el.scrollWidth > el.clientWidth + 1, right: el.getBoundingClientRect().right }));
      expect(fit.over).toBe(false);
      expect(fit.right).toBeLessThanOrEqual(375);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
