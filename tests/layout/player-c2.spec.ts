// dec-13 C2 (docs/plans/dec-13-the-player-screen.md; ps-3, ps-5; frames P1 and P2 of december/14, approved ps-9
// 2026-11-14): the Player screen's head, on the shared P1-like character (`layout.html?as=player&p1=1`,
// src/testing/layoutP1Character.ts), its messy form (`p1=messy`: a long name, no portrait, nine statuses)
// and two statuses (`p1=two`). Purposes, each a test below:
//   1. On a tablet the bar reads the name, "the" kindred and the title; the head is the 96 px portrait (page M1, row
//      C1) with the four rings at its right, 8 px apart, alone (no words), one row 96 px tall; and the first row of
//      score boxes starts level with the top of the hit points box (the aligned top, moved to C2 by the plan's C15
//      note; ls-1).
//   2. On a phone the bar keeps the name and the head's first line gives "the" kindred and the title, beside the 96 px
//      portrait, with the notices box under the line and the rings on their own row under the portrait (frames M1c,
//      M1f); the rings fit in 375 px.
//   3. Nine statuses: four in view on a tablet and three on a phone, then "+5" or "+6", which opens every status;
//      a long name never pushes the page sideways; no portrait shows the initial.
//   4. One or two statuses: each ring's name and time sit in words beside it.
//   5. A tap on a ring opens that status's sheet.
//   6. In a setting with no roll for scores (`p1=noline`) the Scores heading stands alone, under the notices box, and its
//      word still sits at the foot of the 96 px beside the head, so the aligned top holds.
//   7. A character with no class (`p1=classless`) on a tablet: the GM's card line sits in the head, which grows to hold
//      it; nothing spills out of the head.
//   Each in light and dark, with the shared checks (no sideways scroll, 44 px targets, nothing under 14 px, axe).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

const SIZES = [
  { name: 'tablet', width: 1180, height: 820 },
  { name: 'phone', width: 375, height: 812 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function openPlayer(page: Page, p1: '1' | 'messy' | 'two' | 'noline' | 'classless') {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.locator('.player-head')).toBeVisible();
  await expect(page.locator('.player-head .status-ring').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const boxOf = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
const barTitle = (page: Page) => page.locator('.top-row__title').first();

for (const scheme of SCHEMES) {
  test.describe(`the head (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test(`tablet: the bar reads name, kindred, title; the portrait and four bare rings in one 96 px row; the aligned top (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height });
      await openPlayer(page, '1');
      await expect(page.getByRole('heading', { level: 1, name: 'Brannoch Fenward' })).toBeAttached();
      await expect(barTitle(page)).toHaveText(/^Brannoch Fenward the [^,]+(, .+)?$/);
      // No line in the head: the bar has the words.
      await expect(page.locator('.player-head__line')).toHaveCount(0);

      const head = await boxOf(page, '.player-head');
      expect(Math.round(head.height)).toBe(96);
      const portrait = await boxOf(page, '.player-head .portrait');
      expect(Math.round(portrait.width)).toBe(96);
      expect(Math.round(portrait.height)).toBe(96);

      const rings = page.locator('.player-head .status-ring');
      await expect(rings).toHaveCount(4);
      await expect(page.locator('.player-head .status-ring-more')).toHaveCount(0);
      const boxes = await rings.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
      for (const [i, b] of boxes.entries()) {
        expect(Math.round(b.width)).toBe(52);
        // At the portrait's right, on the portrait's row.
        expect(b.left).toBeGreaterThanOrEqual(portrait.x + portrait.width);
        expect(Math.abs(b.top + b.height / 2 - (portrait.y + portrait.height / 2))).toBeLessThanOrEqual(1);
        if (i > 0) expect(Math.round(b.left - boxes[i - 1]!.right)).toBe(8);
      }
      // The ring alone: no words drawn.
      await expect(page.locator('.player-head .status-ring__name')).toHaveCount(0);

      // The aligned top (ls-1): the first row of score boxes starts level with the top of the hit points box.
      const hp = await boxOf(page, '.player__pane--play .hp-box');
      const score = await boxOf(page, '.player__right .score-row .stat-tile');
      expect(Math.abs(score.y - hp.y)).toBeLessThanOrEqual(1);

      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.player-head')).toEqual([]);
    });

    test(`phone: the bar keeps the name, the head's line gives the kindred and title with the box under it, the rings on their own row (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[1].width, height: SIZES[1].height });
      await openPlayer(page, '1');
      await expect(barTitle(page)).toHaveText('Brannoch Fenward');
      const line = page.locator('.player-head__line');
      await expect(line).toHaveText(/^the [^,]+(, .+)?$/);
      const portrait = await boxOf(page, '.player-head .portrait');
      expect(Math.round(portrait.width)).toBe(96);
      const lineBox = (await line.boundingBox())!;
      expect(lineBox.x).toBeGreaterThanOrEqual(portrait.x + portrait.width);
      // The notices box under the line, beside the portrait (frame M1c).
      const box = await boxOf(page, '.player-head .notices-box');
      expect(box.x).toBeGreaterThanOrEqual(portrait.x + portrait.width);
      expect(box.y).toBeGreaterThanOrEqual(lineBox.y + lineBox.height - 0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      // The rings on their own row, under the portrait.
      const rings = page.locator('.player-head .status-ring');
      await expect(rings).toHaveCount(4);
      for (const b of await rings.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(b.top).toBeGreaterThanOrEqual(portrait.y + portrait.height - 0.5);
        expect(b.right).toBeLessThanOrEqual(375);
      }
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.player-head')).toEqual([]);
    });

    test(`no roll for scores: the bare Scores heading sits under the box at the foot of the 96 px and the aligned top holds (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height });
      await openPlayer(page, 'noline');
      const section = page.locator(".player__right .sheet__section[aria-label='Scores']");
      await expect(section.locator('.rule-heading')).toHaveCount(0);
      const heading = section.locator('h2.sheet__label').first();
      const box = (await heading.boundingBox())!;
      // The box over it, the two as tall as the head (64 and 32).
      const notices = await boxOf(page, '.player__right .notices-box');
      expect(box.y).toBeGreaterThanOrEqual(notices.y + notices.height - 0.5);
      const head = await boxOf(page, '.player-head');
      expect(Math.abs(box.y + box.height - (head.y + head.height))).toBeLessThanOrEqual(1);
      // The word's own box, not the heading's: at the foot, not the top.
      const word = await heading.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().toJSON() as DOMRect;
      });
      expect(box.y + box.height - word.bottom).toBeLessThanOrEqual(2);
      const hp = await boxOf(page, '.player__pane--play .hp-box');
      const score = await boxOf(page, '.player__right .score-row .stat-tile');
      expect(Math.abs(score.y - hp.y)).toBeLessThanOrEqual(1);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test(`no class on a tablet: the card line sits inside the head, which grows to hold it (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: SIZES[0].width, height: SIZES[0].height });
      await openPlayer(page, 'classless');
      const line = page.locator('.player-head__line');
      await expect(line).toHaveText(/Level 3$/);
      const head = await boxOf(page, '.player-head');
      expect(Math.round(head.height)).toBeGreaterThanOrEqual(96);
      // Every drawn part (the screen readers' copy of the name is not drawn).
      for (const r of await page.locator('.player-head *:not(.visually-hidden)').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(r.bottom).toBeLessThanOrEqual(head.y + head.height + 0.5);
        expect(r.top).toBeGreaterThanOrEqual(head.y - 0.5);
      }
      expect(await layoutProblems(page)).toEqual([]);
      expect(await accessibilityProblems(page, '.player-head')).toEqual([]);
    });

    for (const size of SIZES) {
      test(`nine statuses, a long name, no portrait: ${size.name === 'tablet' ? 'four' : 'three'} in view and "+N" opens every status (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'messy');
        const inView = size.name === 'tablet' ? 4 : 3;
        await expect(page.locator('.player-head .status-ring')).toHaveCount(inView);
        const more = page.getByRole('button', { name: `${9 - inView} more: see every status` });
        await expect(more).toHaveText(`+${9 - inView}`);
        // The initial stands in for the portrait.
        await expect(page.locator('.player-head .portrait')).toHaveText('B');
        if (size.name === 'tablet') expect(Math.round((await boxOf(page, '.player-head')).height)).toBe(96);
        // Everything in the head stays inside the screen.
        for (const r of await page.locator('.player-head *').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) expect(r).toBeLessThanOrEqual(size.width);
        expect(await layoutProblems(page)).toEqual([]);

        await more.click();
        const sheet = page.getByRole('dialog', { name: 'Statuses' });
        await expect(sheet.locator('.status-ring')).toHaveCount(9);
        expect(await accessibilityProblems(page, '[role="dialog"]')).toEqual([]);
        // A tile there opens its own status.
        await sheet.getByRole('button', { name: /^Watchful/ }).click();
        await expect(page.getByRole('dialog', { name: 'Watchful' })).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Statuses' })).toHaveCount(0);
      });

      test(`two statuses: each ring's name and time in words beside it (${size.name}, ${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await openPlayer(page, 'two');
        const rings = page.locator('.player-head .status-ring');
        await expect(rings).toHaveCount(2);
        for (const ring of await rings.all()) {
          const mark = (await ring.locator('.status-ring__mark').boundingBox())!;
          const name = (await ring.locator('.status-ring__name').boundingBox())!;
          const words = (await ring.locator('.status-ring__words').boundingBox())!;
          expect(name.x).toBeGreaterThanOrEqual(mark.x + mark.width);
          expect(words.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
          expect(name.x + name.width).toBeLessThanOrEqual(size.width);
        }
        await expect(rings.first()).toContainText('Lantern-blessed');
        await expect(rings.nth(1)).toContainText(/Chilled\s*\d+ turns?/);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '.player-head')).toEqual([]);

        // A tap on a ring opens that status.
        await rings.nth(1).click();
        await expect(page.getByRole('dialog', { name: 'Chilled' })).toBeVisible();
      });
    }
  });
}
