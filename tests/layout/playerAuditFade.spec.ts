// Batch E of plan dec-14-player-audit-fixes (page 38 of december, frame 38-5, approved 2026-11-24): the left column says
// more lies beyond. Held sideways the Player tab's left column scrolls by itself; a 16 px fade sits on an edge only while
// something is cut there (ruled 2026-11-24, ⚑ 4: built as drawn).
// Purposes, each a plain sentence:
//   5a. When the left column fits, it has no fade; when the screen shrinks so it no longer fits, the foot fades, and
//       when it grows again the fade goes.
//   5b. At the top of a column that is cut below, the fade is at the foot only, 16 px tall.
//   5c. Scrolled part way, the fade is at both edges.
//   5d. Scrolled to the end, the fade is at the top only.
//   5e. In dark the fades behave the same, and the faded foot shows the dark page through it.
//   5f. In one column (a tablet held upright, a phone at 375 px) there is no fade.
//   5g. The fade never catches a tap: a button half in the faded foot is still what a tap there lands on.
//   5h. Scrolled to the end, when the column's contents grow with nothing scrolled (a picture loading), the foot fades.
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './checks.ts';

const SIDEWAYS = { width: 1180, height: 820 };
/** Sideways, and tall enough that the whole left column fits. */
const SIDEWAYS_TALL = { width: 1180, height: 2600 };
const FADE = 16;

async function open(page: Page) {
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player__pane--play > .player__opened')).not.toHaveAttribute('hidden');
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.player__pane--play');
}

/** Which edges the column fades, as the page draws it (classes and the mask the browser computed). */
async function fades(page: Page) {
  return page.locator('.player__pane--play').evaluate((column) => {
    const mask = getComputedStyle(column).maskImage;
    return {
      above: column.classList.contains('player__pane--cut-above'),
      below: column.classList.contains('player__pane--cut-below'),
      mask: mask === 'none' ? 'none' : 'gradient',
    };
  });
}

/** Scroll the column to a place (0 the top, 1 the end) and let the fade catch up. */
async function scrollTo(page: Page, where: number) {
  await page.locator('.player__pane--play').evaluate((column, at) => {
    column.scrollTop = (column.scrollHeight - column.clientHeight) * at;
  }, where);
}

test.describe('the left column, sideways', () => {
  test.use({ viewport: SIDEWAYS });

  test('5a. a column that fits has no fade; shrunk so it is cut, the foot fades; grown again, the fade goes', async ({ page }) => {
    await page.setViewportSize(SIDEWAYS_TALL);
    await open(page);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: false, mask: 'none' });
    await page.setViewportSize(SIDEWAYS);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: true, mask: 'gradient' });
    await page.setViewportSize(SIDEWAYS_TALL);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: false, mask: 'none' });
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('5b. at the top of a cut column the fade is at the foot only, 16 px tall', async ({ page }) => {
    const column = await open(page);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: true, mask: 'gradient' });
    // The mask's stops: opaque from the top, opaque until 16 px from the foot, then transparent.
    const mask = await column.evaluate((el) => getComputedStyle(el).maskImage);
    expect(mask).toContain(`${FADE}px`);
    expect(mask.match(/rgba\(0, 0, 0, 0\)|transparent/g)).toHaveLength(1);
    expect(mask.trim().replace(/\)+$/, '')).toMatch(/(rgba\(0, 0, 0, 0|transparent)$/);
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('5c. scrolled part way, both edges fade', async ({ page }) => {
    const column = await open(page);
    await scrollTo(page, 0.5);
    await expect.poll(() => fades(page)).toEqual({ above: true, below: true, mask: 'gradient' });
    const mask = await column.evaluate((el) => getComputedStyle(el).maskImage);
    expect(mask.match(/rgba\(0, 0, 0, 0\)|transparent/g)).toHaveLength(2);
  });

  test('5d. scrolled to the end, only the top fades', async ({ page }) => {
    const column = await open(page);
    await scrollTo(page, 1);
    await expect.poll(() => fades(page)).toEqual({ above: true, below: false, mask: 'gradient' });
    const mask = await column.evaluate((el) => getComputedStyle(el).maskImage);
    expect(mask.match(/rgba\(0, 0, 0, 0\)|transparent/g)).toHaveLength(1);
    expect(mask).toMatch(/gradient\((to bottom, )?(rgba\(0, 0, 0, 0\)|transparent)/);
    // Back to the top, the top's fade goes again.
    await scrollTo(page, 0);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: true, mask: 'gradient' });
  });

  test('5h. scrolled to the end, when a part grows and nothing scrolls, the foot fades again', async ({ page }) => {
    await open(page);
    await scrollTo(page, 1);
    await expect.poll(() => fades(page)).toEqual({ above: true, below: false, mask: 'gradient' });
    // At hand grows from a rule in the page's head, as a picture loading would: the column's own box and the markup
    // inside it stay the same, so only watching the parts' sizes sees it. The parts sit in wrappers with no box of
    // their own (`display: contents`: `.player__opened`, the book-type host), which the watch looks through.
    await page.evaluate(() => {
      const grow = document.createElement('style');
      grow.textContent = '.player__pane--play .pack--at-hand { min-height: 600px; }';
      document.head.append(grow);
    });
    await expect.poll(() => fades(page)).toEqual({ above: true, below: true, mask: 'gradient' });
  });

  test('5g. the fade never catches a tap: a button in the faded foot is what a tap there lands on', async ({ page }) => {
    const column = await open(page);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: true, mask: 'gradient' });
    // The page scrolled so the column stands in its stuck place, its foot on screen (at the page's top its foot sits
    // below the screen's edge until the page scrolls). Then a button's middle brought into the faded band (16 px above
    // the column's foot), and what a tap there meets.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const hit = await column.evaluate((el, fade) => {
      const foot = el.getBoundingClientRect().bottom;
      if (foot > innerHeight) return { found: false, landsOnIt: false, inFade: false };
      const button = [...el.querySelectorAll('button')].find((b) => b.getBoundingClientRect().top > foot + 40);
      if (!button) return { found: false, landsOnIt: false, inFade: false };
      const box = button.getBoundingClientRect();
      el.scrollTop += box.top + box.height / 2 - (foot - fade / 2);
      const now = button.getBoundingClientRect();
      const y = now.top + now.height / 2;
      const under = document.elementFromPoint(now.left + now.width / 2, y);
      return { found: true, landsOnIt: !!under && button.contains(under), inFade: y > foot - fade && y < foot };
    }, FADE);
    expect(hit).toEqual({ found: true, landsOnIt: true, inFade: true });
  });
});

test.describe('the left column, sideways, dark', () => {
  test.use({ viewport: SIDEWAYS, colorScheme: 'dark' });

  test('5e. in dark the fades behave the same, and the faded foot shows the dark page', async ({ page }) => {
    await open(page);
    await expect.poll(() => fades(page)).toEqual({ above: false, below: true, mask: 'gradient' });
    await scrollTo(page, 0.5);
    await expect.poll(() => fades(page)).toEqual({ above: true, below: true, mask: 'gradient' });
    await scrollTo(page, 1);
    await expect.poll(() => fades(page)).toEqual({ above: true, below: false, mask: 'gradient' });
    // The fade shows what is behind the column: the page, dark, not a light band.
    // The body's colour is the dark page token, as the browser resolves it (a probe painted with `var(--page)`), and
    // not transparent, so the faded edge shows that colour.
    const { behind, page: pageColour } = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--page)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { behind: getComputedStyle(document.body).backgroundColor, page: resolved };
    });
    expect(pageColour).not.toBe('rgba(0, 0, 0, 0)');
    expect(behind).toBe(pageColour);
    expect(behind).not.toBe('rgb(250, 250, 247)');
    expect(await layoutProblems(page)).toEqual([]);
  });
});

for (const [name, viewport] of [
  ['a tablet held upright', { width: 820, height: 1180 }],
  ['a phone at 375 px', { width: 375, height: 812 }],
] as const) {
  test.describe(`one column: ${name}`, () => {
    test.use({ viewport });

    test(`5f. in one column there is no fade (${name})`, async ({ page }) => {
      await open(page);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => fades(page)).toEqual({ above: false, below: false, mask: 'none' });
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}
