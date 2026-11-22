// The light's ring is the tap (plan light-tap, rows LT1 to LT3; lt-1 to lt-6; page 35, frames 35A to 35F), on the shared
// P1-like character (`layout.html?as=player&p1=…`, src/testing/layoutP1Character.ts). Purposes, at a phone (375) and a
// tablet held sideways (1180), light and dark:
//   The ring is one target of 72 by 76 at least, at least 8 px from the light's name (its own target).
//   Keep lit's toggle sits flush with the light's right edge (At hand's column), Refill 8 px to its left, on one line.
//   Not lit: the ring over "Light" is the same target; no Keep lit row.
//   Burnt out: the ring is a picture, not a tap; Refill and Light another are one width, 8 px apart.
//   Burnt out with nothing left: the words alone, no button.
//   A long name with 999 turns and 999 refills wraps beside the ring, which keeps its 72 px column.
//   Several lights: "Light…" opens "Which light?" from the foot on a phone and centred on a tablet.
//   At Larger text, "Put out" stays under the ring, inside its target.
//   No sideways scroll anywhere. At 1180, At hand's column width is measured and noted (the ruling's third note: drawn
//   at about 440).
import { expect, test, type Locator, type Page } from '@playwright/test';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet held sideways', width: 1180, height: 820 },
] as const;

async function openPlayer(page: Page, head: string, larger = false) {
  if (larger) await page.addInitScript(() => localStorage.setItem('grimoire.textSize', 'larger'));
  await page.goto(`/layout.html?as=player&p1=${head}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  const atHand = page.getByRole('region', { name: 'At hand' });
  await expect(atHand.locator('.light-block--at-hand')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { atHand, light: atHand.locator('.light-block--at-hand') };
}

const boxOf = async (target: Locator) => (await target.boundingBox())!;

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

/** The ring's target: 72 by 76 at least, 8 px or more from the name's target beside it. */
async function ringTarget(light: Locator, ringName: string, nameName: string) {
  const ring = await boxOf(light.getByRole('button', { name: ringName }));
  expect(ring.width).toBeGreaterThanOrEqual(71.5);
  expect(ring.height).toBeGreaterThanOrEqual(75.5);
  const name = await boxOf(light.getByRole('button', { name: nameName, exact: true }));
  expect(name.x - (ring.x + ring.width)).toBeGreaterThanOrEqual(7.5);
  return ring;
}

for (const size of SIZES) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.name} (${size.width} px), ${scheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      test("lit: the ring is the tap, Keep lit's toggle at the right edge with Refill 8 px to its left", async ({ page }) => {
        const { atHand, light } = await openPlayer(page, '1');
        await ringTarget(light, 'Put out Storm lantern', 'Storm lantern');
        await expect(light.getByRole('switch', { name: /: lit$/ })).toHaveCount(0);
        const block = await boxOf(light);
        const toggle = await boxOf(light.getByRole('switch', { name: 'Keep lit' }));
        const refill = await boxOf(light.getByRole('button', { name: 'Refill' }));
        expect(Math.abs(toggle.x + toggle.width - (block.x + block.width))).toBeLessThanOrEqual(1);
        expect(toggle.x - (refill.x + refill.width)).toBeGreaterThanOrEqual(7.5);
        expect(toggle.x - (refill.x + refill.width)).toBeLessThanOrEqual(8.5);
        // One line: Refill and the toggle overlap top to bottom.
        expect(refill.y < toggle.y + toggle.height && toggle.y < refill.y + refill.height).toBe(true);
        await noSidewaysScroll(page);
        if (size.width === 1180) {
          const column = await boxOf(atHand);
          test.info().annotations.push({ type: 'At hand column at 1180', description: `${Math.round(column.width)} px` });
          console.log(`At hand's column at 1180 px: ${Math.round(column.width)} px wide`);
        }
      });

      test('not lit, one light: the ring over "Light" is the same target, and no Keep lit row', async ({ page }) => {
        const { light } = await openPlayer(page, 'unlit');
        await ringTarget(light, 'Light Storm lantern', 'Storm lantern');
        await expect(light.getByText('Not lit. 4 turns left. 3 refills left')).toBeVisible();
        await expect(light.getByRole('switch')).toHaveCount(0);
        await noSidewaysScroll(page);
      });

      test('burnt out: the ring a picture; Refill and Light another one width, 8 px apart', async ({ page }) => {
        const { light } = await openPlayer(page, 'burnt');
        await expect(light.getByRole('img', { name: 'Storm lantern, burnt out' })).toBeVisible();
        await expect(light.getByRole('button', { name: /^(Put out|Light) Storm lantern/ })).toHaveCount(0);
        await expect(light.getByText('Burnt out. 3 refills left')).toBeVisible();
        const refill = await boxOf(light.getByRole('button', { name: 'Refill' }));
        const another = await boxOf(light.getByRole('button', { name: 'Light another' }));
        expect(Math.abs(refill.width - another.width)).toBeLessThanOrEqual(0.5);
        expect(another.x - (refill.x + refill.width)).toBeGreaterThanOrEqual(7.5);
        for (const b of [refill, another]) expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(43.5);
        const block = await boxOf(light);
        expect(Math.abs(another.x + another.width - (block.x + block.width))).toBeLessThanOrEqual(1);
        await noSidewaysScroll(page);
      });

      test('burnt out with nothing left: the words alone, no button', async ({ page }) => {
        const { light } = await openPlayer(page, 'burntnone');
        await expect(light.getByRole('img', { name: 'Reed torch, burnt out' })).toBeVisible();
        await expect(light.getByText('Burnt out. No reed torches left')).toBeVisible();
        await expect(light.getByRole('button')).toHaveCount(0);
        await noSidewaysScroll(page);
      });

      test('a long name with 999 turns and refills wraps beside the ring, which keeps its column', async ({ page }) => {
        const { light } = await openPlayer(page, 'longlight');
        const ring = await ringTarget(light, 'Put out Hooded lantern of the drowned bell', 'Hooded lantern of the drowned bell');
        const words = light.getByText('Lit, 999 turns left. 999 refills left');
        await expect(words).toBeVisible();
        const body = await boxOf(light.locator('.light-block__body'));
        expect(body.x).toBeGreaterThanOrEqual(ring.x + ring.width);
        const block = await boxOf(light);
        expect(body.x + body.width).toBeLessThanOrEqual(block.x + block.width + 0.5);
        await noSidewaysScroll(page);
      });

      test('several lights: "Light…" opens "Which light?", from the foot on a phone, centred on a tablet', async ({ page }) => {
        const { light } = await openPlayer(page, 'several');
        await expect(light.getByText('No light lit')).toBeVisible();
        const ring = await boxOf(light.getByRole('button', { name: 'Light: choose which' }));
        expect(ring.width).toBeGreaterThanOrEqual(71.5);
        expect(ring.height).toBeGreaterThanOrEqual(75.5);
        await light.getByRole('button', { name: 'Light: choose which' }).click();
        const pick = page.getByRole('dialog', { name: 'Which light?' });
        await expect(pick.getByRole('button', { name: /^Storm lantern/ })).toBeVisible();
        await expect(pick.getByRole('button', { name: /^Reed torch ×4/ })).toBeVisible();
        // Let the sheet finish arriving.
        await page.waitForTimeout(400);
        const box = await boxOf(pick);
        if (size.width === 375) expect(Math.abs(box.y + box.height - size.height)).toBeLessThanOrEqual(1);
        else {
          expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThanOrEqual(1);
          expect(box.y + box.height).toBeLessThan(size.height - 8);
        }
        await noSidewaysScroll(page);
      });
    });
  }
}

test('at Larger text on a phone, "Put out" stays under the ring, inside its target', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { light } = await openPlayer(page, 'longlight', true);
  const tap = light.getByRole('button', { name: /^Put out / });
  const target = await boxOf(tap);
  const mark = await boxOf(tap.locator('.status-ring__mark'));
  const verb = await boxOf(tap.locator('.status-ring-tap__verb'));
  expect(verb.y).toBeGreaterThanOrEqual(mark.y + mark.height);
  expect(verb.x).toBeGreaterThanOrEqual(target.x - 0.5);
  expect(verb.x + verb.width).toBeLessThanOrEqual(target.x + target.width + 0.5);
  expect(verb.y + verb.height).toBeLessThanOrEqual(target.y + target.height + 0.5);
  // Keep lit's toggle still at the right edge, on one line with Refill.
  const block = await boxOf(light);
  const toggle = await boxOf(light.getByRole('switch', { name: 'Keep lit' }));
  const refill = await boxOf(light.getByRole('button', { name: 'Refill' }));
  expect(Math.abs(toggle.x + toggle.width - (block.x + block.width))).toBeLessThanOrEqual(1);
  expect(refill.y < toggle.y + toggle.height && toggle.y < refill.y + refill.height).toBe(true);
  await noSidewaysScroll(page);
});
