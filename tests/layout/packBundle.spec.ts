// A pack arrives with its pictures in one bundled file (plan scene-point-to-point B14; p2p-27; mockup december/24,
// frames IM1 and IM1b, approved 2026-11-18 with fixes), in a real browser on the layout page's Rules library. The .zip
// is read by the browser's own unpacking, as on a GM's device. What it checks, in plain words:
//   * a bundle with every picture: no panel, the toast "Saltwick Island imported, with 2 maps.";
//   * a bundle with one picture missing: the Side sheet names it with what it costs, "Add it…" is a 44 px target, the
//     words line up under the ticked rows', nothing scrolls sideways and axe finds no serious problem;
//   * long names (a long pack name, a long path) wrap inside the sheet at 375 px;
//   * in light and dark, on a phone and a tablet. Saves `test-results/layout-screens/pack-bundle-*.png`.
import { expect, test, type Page } from '@playwright/test';
import { makeZip } from '../../src/testing/makeZip.ts';
import { accessibilityProblems, layoutProblems } from './checks.ts';

// Node's own bytes, as Playwright takes a picked file. (Declared here so the project needn't add Node's type definitions.)
declare const Buffer: { from(bytes: Uint8Array): never };

// A real picture the browser can read: one grey pixel.
const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

const pack = (name: string, beachFile: string) =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { id: 'saltwick-island', name, kind: 'adventure' },
    locations: [
      { id: 'drowned-harbour', name: 'The Drowned Harbour' },
      { id: 'shingle-beach', name: 'The Shingle Beach' },
    ],
    images: [
      { id: 'map-harbour', file: 'images/map-harbour.png', type: 'map', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', locationIds: ['drowned-harbour'] },
      { id: 'map-beach', file: beachFile, type: 'map', title: 'The Shingle Beach', alt: 'A long beach of grey stones.', locationIds: ['shingle-beach'] },
    ],
  });

/** Opens the Rules library, picks this bundle under "Import a file" and saves the preview. */
async function importBundle(page: Page, files: Record<string, string | Uint8Array>) {
  await page.goto('/layout.html?as=gm');
  await page.getByRole('button', { name: 'Account and device options' }).click();
  await page.getByRole('button', { name: 'Rules library' }).click();
  await expect(page.getByText('River Rules')).toBeVisible();
  await page.getByLabel('Import a file').setInputFiles({ name: 'saltwick-island.zip', mimeType: 'application/zip', buffer: Buffer.from(await makeZip(files)) });
  await page.getByRole('button', { name: 'Save to your library' }).click();
}

for (const size of [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 1024, height: 768 },
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`a pack's bundle (${size.name}, ${scheme})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });

      // Purpose (IM1 with its fix): every picture found shows no panel, only the toast.
      test('every picture found: the toast, no panel', async ({ page }) => {
        await importBundle(page, { 'saltwick-island/saltwick-island.pack.json': pack('Saltwick Island', 'images/map-beach.png'), 'saltwick-island/images/map-harbour.png': PIXEL, 'saltwick-island/images/map-beach.png': PIXEL });
        await expect(page.getByText('Saltwick Island imported, with 2 maps.')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.screenshot({ path: `test-results/layout-screens/pack-bundle-found-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
      });

      // Purpose (IM1b): a missing picture is named in the Side sheet with its one consequence and "Add it…".
      test('a picture missing: the sheet names it, with Add it…', async ({ page }) => {
        await importBundle(page, { 'saltwick-island.pack.json': pack('Saltwick Island', 'images/map-beach.png'), 'images/map-harbour.png': PIXEL });
        const sheet = page.getByRole('dialog', { name: 'Imported: Saltwick Island' });
        await expect(sheet.getByText('1 map: The Drowned Harbour.')).toBeVisible();
        await expect(sheet.getByText('1 picture missing: images/map-beach.png')).toBeVisible();
        await expect(sheet.getByText('The Shingle Beach has no map until this picture is added.')).toBeVisible();
        const add = await sheet.getByRole('button', { name: 'Add it…' }).boundingBox();
        expect(add!.height).toBeGreaterThanOrEqual(44);
        // The missing row's words start where the ticked rows' do (the icon column is kept).
        const lefts = await sheet.locator('.list-row__text').evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().left)));
        expect(new Set(lefts).size).toBe(1);
        await page.screenshot({ path: `test-results/layout-screens/pack-bundle-missing-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        expect(await accessibilityProblems(page, '.dialog')).toEqual([]);
        // (Audit 4) IM1b draws "Add it…" at the sheet's foot: the button sits at the sheet's bottom, not under the rows.
        const card = await page.locator('.dialog--side').boundingBox();
        expect(card!.y + card!.height - (add!.y + add!.height)).toBeLessThanOrEqual(32);
        // "Add it…" takes the picture, and the sheet gives way to the toast.
        await sheet.getByLabel('Choose the missing picture: images/map-beach.png').setInputFiles({ name: 'IMG_0042.png', mimeType: 'image/png', buffer: Buffer.from(PIXEL) });
        await expect(page.getByText('Saltwick Island imported, with 2 maps.')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });

      // Purpose (re-audit New 1, 25 Nov): with focus on "Add it…" (where the sheet opens it), its whole focus ring shows:
      // no box that scrolls or clips (the sheet's body, the sheet) cuts it off, at either width.
      test('the focus ring on Add it… is not clipped', async ({ page }) => {
        await importBundle(page, { 'saltwick-island.pack.json': pack('Saltwick Island', 'images/map-beach.png'), 'images/map-harbour.png': PIXEL });
        const add = page.getByRole('dialog', { name: 'Imported: Saltwick Island' }).getByRole('button', { name: 'Add it…' });
        await expect(add).toBeFocused();
        // A keyboard's way back to it, so the ring is the one :focus-visible draws.
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(add).toBeFocused();
        const cut = await add.evaluate((el) => {
          const style = getComputedStyle(el);
          const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
          const r = el.getBoundingClientRect();
          const box = { left: r.left - ring, right: r.right + ring, top: r.top - ring, bottom: r.bottom + ring };
          const found: string[] = [];
          if (style.outlineStyle === 'none' || !(ring > 0)) found.push('no ring drawn');
          for (let up = el.parentElement; up; up = up.parentElement) {
            const s = getComputedStyle(up);
            if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
            const u = up.getBoundingClientRect();
            const inner = { left: u.left + up.clientLeft, top: u.top + up.clientTop, right: u.left + up.clientLeft + up.clientWidth, bottom: u.top + up.clientTop + up.clientHeight };
            if (box.left < inner.left - 0.5 || box.right > inner.right + 0.5 || box.top < inner.top - 0.5 || box.bottom > inner.bottom + 0.5)
              found.push(`${up.className || up.tagName}: ring ${JSON.stringify(box)} outside ${JSON.stringify(inner)}`);
          }
          return found;
        });
        expect(cut).toEqual([]);
        await page.screenshot({ path: `test-results/layout-screens/pack-bundle-focus-${size.width}-${scheme}.png` });
      });

      // Purpose: a long pack name and a long path wrap inside the sheet; nothing scrolls sideways.
      test('long names wrap inside the sheet', async ({ page }) => {
        const long = 'The Drowned Marches of the Lantern Coast, the whole of the Saltwick Island cycle';
        const path = 'images/the-shingle-beach-and-the-drowned-harbour-at-low-tide-with-every-wreck-marked-final-v2.png';
        await importBundle(page, { 'saltwick-island.pack.json': pack(long, path), 'images/map-harbour.png': PIXEL });
        const sheet = page.getByRole('dialog', { name: `Imported: ${long}` });
        await expect(sheet.getByText(`1 picture missing: ${path}`)).toBeVisible();
        await page.screenshot({ path: `test-results/layout-screens/pack-bundle-long-${size.width}-${scheme}.png` });
        expect(await layoutProblems(page)).toEqual([]);
        const inside = await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        expect(inside).toBe(true);
      });
    });
  }
}
