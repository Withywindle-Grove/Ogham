// The sheet's rows on the Player screen (dec-13 C12, frame P1; tfr-4 and tfr-5, row C10 of
// plans/test-feedback-2026-11-19.md, mockup page M1 approved 2026-11-19; rewritten on Francis's yes of 20 Nov 2026), in a
// real browser, on the shared P1-like character (layout.html ?as=player&p1=1, Brannoch Fenward;
// src/testing/layoutP1Character.ts). Its campaign row, "The Storm Lantern Road", opens the Player screen.
// Purposes:
//   At 1180 px the rows that follow Skills stand without the "Full character sheet" heading and without Edit: short
//   rows (name, a line, a chevron) inside the right column, each a 44 px target with 8 px between, nothing past the column.
//   At 375 px the same rows stand where the one "Full character sheet" row was, inside the screen, no sideways scroll.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/layout.html?as=player&p1=1');
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
}

/** Each row's box, top to bottom. */
const boxesOf = (page: Page) =>
  page
    .locator('.player .sheet--beside .list-row')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((b) => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height })));

test('at 1180 px the rows stand with no heading and no Edit, short rows with chevrons inside the right column', async ({ page }) => {
  await open(page, 1180, 820);
  const notes = page.locator('.player__right').getByRole('button', { name: 'Notes' });
  await expect(notes).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Full character sheet' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Full character sheet' })).toHaveCount(0);
  await expect(page.locator('.player').getByRole('button', { name: /^Edit/ })).toHaveCount(0);
  const column = (await page.locator('.player__right').boundingBox())!;
  const boxes = await boxesOf(page);
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  for (const b of boxes) {
    expect(b.height).toBeGreaterThanOrEqual(43.5);
    expect(b.left).toBeGreaterThanOrEqual(column.x - 1);
    expect(b.right).toBeLessThanOrEqual(column.x + column.width + 1);
  }
  for (let n = 1; n < boxes.length; n += 1) expect(boxes[n]!.top).toBeGreaterThanOrEqual(boxes[n - 1]!.bottom - 1);
  // The whole old sections are gone: the Notes button is a row.
  await expect(page.locator('.player .sheet--beside .sheet__notes-row')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  expect(await accessibilityProblems(page, '.player__right')).toEqual([]);
});

test('at 375 px the rows stand where the one Full character sheet row was, inside the screen', async ({ page }) => {
  await open(page, 375, 812);
  await expect(page.getByRole('button', { name: 'Full character sheet', exact: true })).toHaveCount(0);
  const notes = page.locator('.player .sheet--beside').getByRole('button', { name: 'Notes' });
  await notes.scrollIntoViewIfNeeded();
  await expect(notes).toBeVisible();
  // After Skills, as P2's order has it (tfr-5).
  const skills = (await page.getByRole('region', { name: 'Skills' }).boundingBox())!;
  expect((await notes.boundingBox())!.y).toBeGreaterThan(skills.y);
  await expect(page.locator('.player').getByRole('button', { name: /^Edit/ })).toHaveCount(0);
  const boxes = await boxesOf(page);
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  for (const b of boxes) {
    expect(b.height).toBeGreaterThanOrEqual(43.5);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(375);
  }
  expect(await layoutProblems(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
