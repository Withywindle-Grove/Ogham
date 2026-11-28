// The on-device pack cache's Dexie adapter in a real browser (perf fix 2b, docs/plans/perf-pack-cache.md, build order
// 5): opening a campaign writes the setting rules to IndexedDB; they're still there after a reload; signing out empties
// the store. The unit tests cover the cache's rules with an in-memory store; this is the one check that the real store
// reads and writes. Against the stand-in database (layout.html), as every layout check.
import { expect, type Page } from '@playwright/test';
import { test } from '../fails.ts';

/** How many pack copies the device holds, and whether it belongs to someone (−1: no store yet). */
async function storeState(page: Page): Promise<{ packs: number; owned: boolean }> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('grimoire-packs');
        request.onerror = () => resolve({ packs: -1, owned: false });
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('packs') || !db.objectStoreNames.contains('owner')) {
            db.close();
            resolve({ packs: -1, owned: false });
            return;
          }
          const tx = db.transaction(['packs', 'owner'], 'readonly');
          const packs = tx.objectStore('packs').count();
          const owner = tx.objectStore('owner').count();
          tx.oncomplete = () => {
            db.close();
            resolve({ packs: packs.result, owned: owner.result > 0 });
          };
        };
      }),
  );
}

test('the setting rules are stored on the device, survive a reload, and go on sign-out', async ({ page }) => {
  await page.goto('/layout.html?as=player');
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  // The player's screen reads the setting rules; the device stores each pack's copy.
  await expect.poll(() => storeState(page).then((s) => s.packs), { timeout: 15_000 }).toBeGreaterThan(0);
  expect((await storeState(page)).owned).toBe(true);

  // Reloaded: the stored copies are still there (the stand-in database starts afresh; IndexedDB doesn't).
  await page.reload();
  await expect.poll(() => storeState(page).then((s) => s.packs)).toBeGreaterThan(0);
  await page.getByRole('button', { name: /The Drowned Marches/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Sign out: every copy goes, and the store belongs to nobody.
  await page.getByRole('button', { name: 'Character options' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect.poll(() => storeState(page)).toEqual({ packs: 0, owned: false });
});
