// Moving on, as parts (December dec-7 piece 4a; mc-36, mc-36a, mc-41, mc-41a, mc-42, mc-42a), in a real browser on the
// layout page (`?moveOn=gm`, `way`, `obstacle`, `obstacle-plain`, `proposal`, `proposal-plain`, `players`,
// `players-other`, `queue`, `way-out`). What it checks, in plain words:
//   * every way button is at least 44 px each way, the buttons of a row 8 px apart and all one size (width and height);
//   * on a tablet a row's buttons sit at the right of its name, on one line; on a phone they take a line under it;
//   * Yes and No sit side by side, equal; the obstacle block comes before the sheet's short lines;
//   * the list has no foot line, and at a way out it ends with End expedition, a full-width 44 px row (B9, B10);
//   * nothing scrolls sideways and axe finds no serious problem, in light and dark, on every state of the page.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('not drawn');
  return b;
};

/** Every way button in a row: 44 px or more, one size, 8 apart, on one line. */
async function rowButtons(page: Page, rowName: string) {
  const row = page.getByRole('group', { name: rowName });
  const buttons = await row.locator('.way-button').all();
  const boxes = await Promise.all(buttons.map(box));
  for (const b of boxes) {
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(Math.abs(b.height - boxes[0]!.height)).toBeLessThan(1);
    expect(Math.abs(b.width - boxes[0]!.width)).toBeLessThan(1);
    expect(Math.abs(b.y - boxes[0]!.y)).toBeLessThan(1);
  }
  for (let i = 1; i < boxes.length; i += 1) expect(Math.round(boxes[i]!.x - (boxes[i - 1]!.x + boxes[i - 1]!.width))).toBeGreaterThanOrEqual(8);
  return { row, boxes };
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`moving on's parts (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose: the GM's list is one row a destination with its ways at the right (tablet) or under the name (phone),
      // every button a 44 px target, 8 apart, one size; the page passes the layout and accessibility checks.
      test('the GM’s Move on: rows, their buttons, and the checks', async ({ page }) => {
        await page.goto('/layout.html?moveOn=gm');
        await page.getByRole('dialog', { name: 'Move on: From the jetty, where to?' }).waitFor();
        const { row, boxes } = await rowButtons(page, '2. The wreck');
        const name = await box(row.locator('.destination-row__name'));
        if (size.name === 'tablet') expect(boxes[0]!.x).toBeGreaterThan(name.x + name.width - 1);
        else expect(boxes[0]!.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
        await rowButtons(page, '6 The Long Stair of the Drowned Customs House');
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (B9, B10; page 24, WY1a and WY1d): the list has no foot line; at a Location the pack marks a way out it
      // ends with End expedition, after Somewhere else…, as wide as the list and a 44 px target; a way's step has no Where
      // line and no line about the log, its foot the Back button alone.
      test('no foot line; End expedition at a way out', async ({ page }) => {
        await page.goto('/layout.html?moveOn=way-out');
        const dialog = page.getByRole('dialog', { name: 'Move on: From the jetty, where to?' });
        const [end, elsewhere] = await Promise.all([box(dialog.getByRole('button', { name: 'End expedition' })), box(dialog.getByRole('button', { name: 'Somewhere else…' }))]);
        expect(end.y).toBeGreaterThan(elsewhere.y + elsewhere.height - 1);
        expect(end.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(end.width - elsewhere.width)).toBeLessThan(1);
        expect(await dialog.locator('.move-sheet__foot').count()).toBe(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.goto('/layout.html?moveOn=way');
        const step = page.getByRole('dialog', { name: 'Move on: Rowing to 2. The wreck' });
        await step.getByRole('button', { name: 'Move' }).waitFor();
        expect(await step.locator('.move-sheet__foot').innerText()).toBe('Back');
        expect(await step.locator('.move-summary dt').allInnerTexts()).toEqual(['Takes', 'Then']);
      });

      // Purpose: a way with an obstacle shows the obstacle block before the short lines, then Yes and No side by side,
      // equal, each a 44 px target.
      test('a way with an obstacle: the block first, Yes and No equal', async ({ page }) => {
        await page.goto('/layout.html?moveOn=obstacle');
        const dialog = page.getByRole('dialog', { name: 'Move on: Rowing to 5. The sea cave' });
        const [block, lines, yes, no] = await Promise.all([box(dialog.locator('.obstacle-block')), box(dialog.locator('.move-summary')), box(dialog.getByRole('button', { name: 'Yes' })), box(dialog.getByRole('button', { name: 'No' }))]);
        expect(lines.y).toBeGreaterThan(block.y + block.height - 1);
        expect(Math.abs(yes.width - no.width)).toBeLessThan(1);
        expect(Math.abs(yes.y - no.y)).toBeLessThan(1);
        expect(yes.height).toBeGreaterThanOrEqual(44);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: a proposed way's sheet shows its count beside the ✕ and passes the checks; so does a plain way's step.
      test('a proposed way, and a plain way’s step', async ({ page }) => {
        await page.goto('/layout.html?moveOn=proposal');
        const dialog = page.getByRole('dialog', { name: 'Wren proposes: Rowing to 5. The sea cave' });
        const [count, close] = await Promise.all([box(dialog.locator('.move-sheet__count')), box(dialog.getByRole('button', { name: 'Close' }))]);
        expect(count.x + count.width).toBeLessThanOrEqual(close.x + 1);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.goto('/layout.html?moveOn=way');
        await page.getByRole('dialog', { name: 'Move on: Rowing to 2. The wreck' }).getByRole('button', { name: 'Move' }).waitFor();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose (review of #755): every other state of the layout page passes the layout and accessibility checks too:
      // an unnamed obstacle the GM doesn't decide, a proposal with no obstacle, another's proposal on the players' rows,
      // and the queue with a proposal open over the page.
      test('the other states: layout and accessibility', async ({ page }) => {
        for (const [state, ready] of [
          ['obstacle-plain', 'Move on: Along the piles to 4. The customs shed'],
          ['proposal-plain', 'Ash proposes: Rowing to 2. The wreck'],
        ] as const) {
          await page.goto(`/layout.html?moveOn=${state}`);
          await page.getByRole('dialog', { name: ready }).waitFor();
          expect(await layoutProblems(page)).toEqual([]);
          expect(await accessibilityProblems(page)).toEqual([]);
        }
        await page.goto('/layout.html?moveOn=players-other');
        await page.getByText('Proposed by Wren.').waitFor();
        await rowButtons(page, '2. The wreck');
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.goto('/layout.html?moveOn=queue');
        // The page has drawn before it is checked (the re-review of #755).
        await page.getByRole('button', { name: 'A proposal arrives' }).waitFor();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
        await page.getByRole('button', { name: 'A proposal arrives' }).click();
        await page.getByRole('dialog', { name: 'Wren proposes: Rowing to 5. The sea cave' }).waitFor();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });

      // Purpose: the players' Where to? rows, a proposal of theirs standing, pass the same checks.
      test('the players’ Where to?', async ({ page }) => {
        await page.goto('/layout.html?moveOn=players');
        await page.getByRole('region', { name: 'Where to?' }).waitFor();
        await rowButtons(page, '2. The wreck');
        await expect(page.getByRole('group', { name: '2. The wreck' }).getByRole('button', { name: 'Cancel' })).toBeVisible();
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page)).toEqual([]);
      });
    });
  }
}
