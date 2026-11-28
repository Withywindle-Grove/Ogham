// dec-13 C14 (docs/plans/dec-13-the-player-screen.md; ps-2, ps-9, frames P1 and P2 of december/14, approved
// 2026-11-14): the weapon in hand as its own block, on the shared P1-like character (`layout.html?as=player&p1=1`, the
// reed spear in hand) and its messy weapon (`p1=weapon`: a long name, melee and missile, a Grip). Purposes:
//   The weapon in hand is its own bordered block, under armour class and attack and above At hand, outside it.
//   Its name is 20 px and its roll lines' figures 20 px, their small words 14 px (nothing under 14); its name and its
//   Attack are 44 px targets at least.
//   With two buttons (Grip and Attack) they take their own line under the name, at the block's right, 8 px apart (P1).
//   Everything stays inside the block and the page never scrolls sideways, at 375 px (a phone) and 1024 px (a tablet).
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const;

async function openPlayer(page: Page, p1: string) {
  await page.goto(`/layout.html?as=player&p1=${p1}`);
  await page.getByRole('button', { name: /The Storm Lantern Road/ }).click();
  await expect(page.getByRole('region', { name: 'Weapon in hand' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const fontSize = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

async function staysInside(page: Page) {
  const block = page.locator('.weapon-in-hand');
  const outer = (await block.boundingBox())!;
  for (const inner of await block.locator('button, .weapon-in-hand__roll').all()) {
    const box = (await inner.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(outer.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

for (const size of SIZES) {
  test(`the weapon in hand is its own block above At hand (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page, '1');
    const region = page.getByRole('region', { name: 'Weapon in hand' });
    const block = region.locator('.weapon-in-hand');
    await expect(block).toHaveCount(1);
    expect(await block.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');

    // Under armour class and attack, above At hand (which no longer lists the spear).
    const [vitals, mine, atHand] = await Promise.all([page.getByRole('region', { name: 'Vitals' }).boundingBox(), region.boundingBox(), page.getByRole('region', { name: 'At hand' }).boundingBox()]);
    expect(mine!.y).toBeGreaterThanOrEqual(vitals!.y + vitals!.height - 0.5);
    expect(atHand!.y).toBeGreaterThanOrEqual(mine!.y + mine!.height - 0.5);
    await expect(page.getByRole('region', { name: 'At hand' }).getByRole('button', { name: /^Reed spear/ })).toHaveCount(0);

    // The type: the name and the figures 20 px, the small words 14 px.
    expect(await fontSize(page, '.weapon-in-hand .pack__name')).toBeCloseTo(20, 0);
    expect(await fontSize(page, '.weapon-in-hand__figure')).toBeCloseTo(20, 0);
    expect(await fontSize(page, '.weapon-in-hand__label')).toBeCloseTo(14, 0);
    await expect(region.locator('.weapon-in-hand__roll')).toHaveText(['d20 +3 to hit', 'd6 damage']);

    // 44 px targets (t44-1): the name (it opens the item's sheet) and Attack.
    for (const target of [region.getByRole('button', { name: /^Reed spear/ }), region.getByRole('button', { name: 'Attack with Reed spear' })]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await staysInside(page);
  });

  test(`a long weapon with a Grip keeps its two buttons on their own line, inside the block (${size.name}, ${size.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openPlayer(page, 'weapon');
    const region = page.getByRole('region', { name: 'Weapon in hand' });
    const name = (await region.getByRole('button', { name: /^Hooked eel-spear/ }).boundingBox())!;
    const grip = (await region.getByRole('button', { name: /^Grip/ }).boundingBox())!;
    const attack = (await region.getByRole('button', { name: /^Attack/ }).boundingBox())!;
    const block = (await region.locator('.weapon-in-hand').boundingBox())!;
    // Their own line under the name, at the block's right, 8 px apart, each 44 px.
    expect(grip.y).toBeGreaterThanOrEqual(name.y + name.height - 0.5);
    expect(Math.abs(grip.y - attack.y)).toBeLessThan(1);
    expect(attack.x - (grip.x + grip.width)).toBeGreaterThanOrEqual(8 - 0.5);
    expect(block.x + block.width - (attack.x + attack.width)).toBeLessThan(24);
    for (const b of [grip, attack]) expect(b.height).toBeGreaterThanOrEqual(44);
    // Two kinds: a to-hit for each, named, then the damage.
    await expect(region.locator('.weapon-in-hand__roll')).toHaveText([/^d20 \+\d+ to hit, in melee$/, /^d20 \+\d+ to hit, as a missile$/, '2d4 damage']);
    await expect(region.getByText('In hand, Grip: One hand')).toBeVisible();
    await staysInside(page);
  });
}
