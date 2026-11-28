// The map card and the map pop-up (December dec-7 piece 5a; mc-43, mc-43a, mc-44, mc-44a), in a real browser on the
// layout page's invented harbour (`?mapParts=1`; `loading` and `failed` for those frames). What it checks, in plain words:
//   * the card is the picture alone at the column's width, its tools in one row under it, each a 44 px target, and
//     every tool in the row 44 px high (one height in a row, p2p-16; page 23, frame LA1);
//   * a tap on the picture opens the pop-up fitted, the whole picture inside its frame, Fit marked;
//   * the figure sits to the left of the two magnifiers; zoom in enlarges the picture past its frame, Fit returns;
//   * on a phone the pop-up is the whole screen;
//   * the loading and failed frames show their words and no tools;
//   * the map wanted (5m-2; `wanted`, `sending`, `long`): one row, its title and file, + Map a 44 px target;
//   * nothing scrolls sideways and axe finds no serious problem, in light and dark.
import { expect, test, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function openPopup(page: Page) {
  await page.getByRole('button', { name: /show the map whole/ }).click();
  const dialog = page.getByRole('dialog', { name: 'The Drowned Harbour: The map' });
  await dialog.waitFor();
  await expect(dialog.locator('img.map-picture__img[data-ready]')).toBeVisible();
  return dialog;
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`the map's parts (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the card fits its column with its tools in one row under the picture, each at least 44 px, and the page
      // passes the layout and accessibility checks.
      test('the card: the picture, then its tools in one row', async ({ page }) => {
        await page.goto('/layout.html?mapParts=1');
        const picture = page.getByRole('button', { name: /show the map whole/ });
        await expect(page.locator('img.map-picture__img[data-ready]')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        const tools = page.locator('.map-tools');
        const [p, t] = await Promise.all([picture.boundingBox(), tools.boundingBox()]);
        if (!p || !t) throw new Error('not drawn');
        expect(t.y).toBeGreaterThanOrEqual(p.y + p.height - 1);
        for (const name of ['Zoom out', 'Zoom in']) {
          const box = await page.getByRole('button', { name }).boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(Math.abs(box!.y - (await page.getByRole('button', { name: 'Zoom out' }).boundingBox())!.y)).toBeLessThan(1);
        }
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (p2p-16, ruled 2026-11-18; page 23, frame LA1): the map's tools, side by side in one row (zoom out,
      // zoom in and the eye the page hands in), measure 44 px high each and start on one line.
      test('the card: every tool in the row measures 44 px high', async ({ page }) => {
        await page.goto('/layout.html?mapParts=1');
        await expect(page.locator('img.map-picture__img[data-ready]')).toHaveCount(1);
        const row = page.locator('.map-tools__buttons').first();
        await expect(row.getByRole('button', { name: 'Zoom out' })).toBeVisible();
        const tools = await row.evaluate((el) =>
          [...el.children].map((tool) => {
            const box = tool.getBoundingClientRect();
            return { name: tool.getAttribute('aria-label') ?? tool.textContent ?? '', height: Math.round(box.height), top: Math.round(box.top) };
          }),
        );
        // The two magnifiers and the eye: three tools at least, so the row really is controls side by side.
        expect(tools.length).toBeGreaterThanOrEqual(3);
        expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['Zoom out', 'Zoom in']));
        for (const tool of tools) expect(tool, tool.name).toEqual({ name: tool.name, height: 44, top: tools[0]!.top });
      });

      // Purpose: a tap opens the pop-up fitted, the picture whole inside its frame; zoom in makes it larger than its
      // frame and lifts the Fit mark; Fit brings the whole picture back.
      test('the pop-up: fitted, zoomed, and Fit again', async ({ page }) => {
        await page.goto('/layout.html?mapParts=1');
        const dialog = await openPopup(page);
        const frame = dialog.locator('.map-popup__body .map-picture');
        const img = dialog.locator('img.map-picture__img');
        const fit = dialog.getByRole('button', { name: 'Fit' });
        await expect(fit).toHaveAttribute('aria-pressed', 'true');
        const [f, i] = await Promise.all([frame.boundingBox(), img.boundingBox()]);
        if (!f || !i) throw new Error('not drawn');
        expect(i.x).toBeGreaterThanOrEqual(f.x - 1);
        expect(i.x + i.width).toBeLessThanOrEqual(f.x + f.width + 1);
        expect(i.y + i.height).toBeLessThanOrEqual(f.y + f.height + 1);
        // The figure, then the two magnifiers, then Fit, left to right.
        const xs = await Promise.all([dialog.locator('.map-popup__percent'), dialog.getByRole('button', { name: 'Zoom out' }), dialog.getByRole('button', { name: 'Zoom in' }), fit].map(async (l) => (await l.boundingBox())!.x));
        expect([...xs].sort((a, b) => a - b)).toEqual(xs);
        await dialog.getByRole('button', { name: 'Zoom in' }).click();
        await dialog.getByRole('button', { name: 'Zoom in' }).click();
        await expect(fit).toHaveAttribute('aria-pressed', 'false');
        const zoomed = (await img.boundingBox())!;
        expect(zoomed.width).toBeGreaterThan(i.width * 2);
        await fit.click();
        await expect(fit).toHaveAttribute('aria-pressed', 'true');
        if (size.name === 'phone') {
          const box = (await page.getByRole('dialog').boundingBox())!;
          expect(Math.round(box.width)).toBe(size.width);
        }
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: while the picture is on its way the pop-up says so with a still block and no tools; when it fails it
      // says so plainly with Try again.
      test('the pop-up: loading and failed', async ({ page }) => {
        await page.goto('/layout.html?mapParts=loading&open=1');
        await expect(page.getByRole('dialog').getByText('The picture is on its way.')).toBeVisible();
        await expect(page.getByRole('group', { name: 'Zoom' })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        await page.goto('/layout.html?mapParts=failed&open=1');
        await expect(page.getByRole('dialog').getByText('The map’s picture couldn’t load.')).toBeVisible();
        await expect(page.getByRole('dialog').getByRole('button', { name: 'Try again' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Zoom' })).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (dec-7 5m-2, frames 2c and 4d): the map wanted is one row: the title, the file's name under it, and
      // "+ Map" at the right as a 44 px target; while the file is sent the button gives way to one line; a long title
      // and file name wrap inside the row and nothing scrolls sideways.
      test('the map wanted: the title, the file, + Map; sending; long words', async ({ page }) => {
        await page.goto('/layout.html?mapParts=wanted');
        const add = page.getByRole('button', { name: '+ Map' });
        const [title, file, button] = await Promise.all([
          page.getByText('The Drowned Harbour, the harbour chart').boundingBox(),
          page.getByText('harbour-chart.png').boundingBox(),
          add.boundingBox(),
        ]);
        if (!title || !file || !button) throw new Error('not drawn');
        expect(file.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
        expect(button.x).toBeGreaterThan(title.x + title.width - 1);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.goto('/layout.html?mapParts=sending');
        await expect(page.getByRole('status')).toHaveText('Uploading the map…');
        await expect(page.getByRole('button', { name: '+ Map' })).toHaveCount(0);
        await page.goto('/layout.html?mapParts=long');
        expect((await page.getByRole('button', { name: '+ Map' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (re-audit New 2 and its question, 25 Nov): a map the pack brought shows no file-name line, fetching or
      // not; on a phone its "+ Map from the pack" (or the fetching line) goes under the title, so the title keeps to two
      // lines; after a failed fetch "or choose a file…" stands under the retry as a 44 px target.
      test("the pack's map row: no file line, under the title on a phone, or choose a file… after a failure", async ({ page }) => {
        const phone = size.width < 600;
        for (const state of ['packed', 'fetching', 'fetchFailed'] as const) {
          await page.goto(`/layout.html?mapParts=${state}`);
          const row = page.locator('.map-wanted');
          await expect(row).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expect(row.locator('.map-wanted__file')).toHaveCount(0);
          const title = row.locator('.map-wanted__title');
          const lines = await title.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
          expect(lines).toBeLessThanOrEqual(2);
          const action = state === 'fetching' ? row.getByRole('status') : row.getByRole('button', { name: '+ Map from the pack' });
          const [t, a] = [(await title.boundingBox())!, (await action.boundingBox())!];
          if (phone) expect(a.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
          else expect(a.x).toBeGreaterThan(t.x + t.width - 1);
          if (state === 'fetchFailed') {
            const choose = (await row.getByRole('button', { name: 'or choose a file…' }).boundingBox())!;
            expect(choose.height).toBeGreaterThanOrEqual(44);
            expect(choose.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
          }
          await page.screenshot({ path: `test-results/layout-screens/pack-map-row-${state}-${size.width}-${scheme}.png` });
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        }
      });
    });
  }
}

// The map card's title (the lead, 2026-11-15, #851): beside the tools only in full or cut no shorter than its first two
// words; else on a line of its own above them, whole and wrapping between words, the tools still at the right.
async function titleRow(card: ReturnType<Page['locator']>) {
  const row = card.locator('.map-tools');
  const title = row.locator(':scope > .map-tools__title');
  return row.evaluate((el) => {
    const t = el.querySelector<HTMLElement>(':scope > .map-tools__title')!;
    const b = el.querySelector<HTMLElement>(':scope > .map-tools__buttons')!;
    const two = el.querySelectorAll<HTMLElement>('.map-tools__measure > .map-tools__title')[1]!;
    const [r, tr, br] = [el.getBoundingClientRect(), t.getBoundingClientRect(), b.getBoundingClientRect()];
    return {
      above: el.classList.contains('map-tools--title-above'),
      whole: t.scrollWidth <= t.clientWidth + 1,
      titleBottom: tr.bottom,
      titleWidth: tr.width,
      twoWords: two.getBoundingClientRect().width,
      buttonsTop: br.top,
      buttonsRightGap: r.right - br.right,
      lines: Math.round(tr.height / parseFloat(getComputedStyle(t).lineHeight)),
    };
  }).then(async (m) => ({ ...m, text: await title.textContent() }));
}

for (const size of [
  // The phone's card is the column's width: its first two words ("The Drowned…") fit beside the tools, so the rule keeps
  // it there, cut. The right column at 680 is too narrow even for those, so the title goes above.
  { name: 'phone', width: 375, height: 812, url: '/layout.html?mapParts=longTitle', above: false },
  { name: '680, the right column', width: 680, height: 1000, url: '/layout.html?as=gm&placePage=spot&map=added&mapTitle=long', above: true },
] as const) {
  test.describe(`the map card's long title (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    // Purpose: a long title is beside the tools only cut no shorter than its first two words; else it takes its own
    // line above them, whole and wrapping, the tools at the right of their row.
    test(size.above ? 'a long title: a line of its own above the tools, whole, the tools at the right' : 'a long title: beside the tools, cut no shorter than its first two words', async ({ page }) => {
      await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
      await page.goto(size.url);
      if (size.url.includes('as=gm')) await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      const card = page.locator('.map-card').first();
      await expect(card.locator('.map-tools')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(card.locator('.map-tools--title-above')).toHaveCount(size.above ? 1 : 0);
      const m = await titleRow(card);
      expect(m.text).toBe('The Drowned Harbour and the Saltwick Breakwater at the turn of the tide');
      if (size.above) {
        expect(m.whole).toBe(true);
        expect(m.lines).toBeGreaterThan(1);
        expect(m.titleBottom).toBeLessThanOrEqual(m.buttonsTop + 1);
      } else {
        expect(m.titleWidth).toBeGreaterThanOrEqual(m.twoWords - 1);
      }
      expect(Math.abs(m.buttonsRightGap)).toBeLessThanOrEqual(1);
      expect(await layoutProblems(page)).toEqual([]);
    });

    // Purpose: whatever the title, beside the tools it is never cut shorter than its first two words.
    test('any title beside the tools shows at least its first two words', async ({ page }) => {
      await page.route('https://files.example/**', (route) => route.fulfill({ path: 'src/gallery/invented-harbour-map.svg', contentType: 'image/svg+xml' }));
      await page.goto(size.url.replace('longTitle', '1').replace('&mapTitle=long', ''));
      if (size.url.includes('as=gm')) await page.getByRole('button', { name: /The Drowned Marches of the Lantern Coast/ }).click();
      const card = page.locator('.map-card').first();
      await expect(card.locator('.map-tools')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const m = await titleRow(card);
      if (m.above) expect(m.whole).toBe(true);
      else expect(m.titleWidth).toBeGreaterThanOrEqual(m.twoWords - 1);
      expect(await layoutProblems(page)).toEqual([]);
    });
  });
}
