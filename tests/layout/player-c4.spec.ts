// Details on the Player screen (dec-13 C4; ps-3; page M1, approved 2026-11-19: tfr-1, euf-1), on the shared P1-like
// character (`layout.html?as=player&p1=1`, src/testing/layoutP1Character.ts, Brannoch Fenward) and the layout page's
// Wren. Purposes:
//   On a tablet held sideways (1180) Details is last in the left column; on a phone (375) it sits in the one column.
//   Folded, it is its heading row alone: the word "Details" and the chevron, one 44 px tall target across the column,
//   and no line under it (tfr-1, C5).
//   A tap on the heading row opens every line in place, the book's labelled lines whole inside the column, with
//   nothing cut off or under anything; the heading doesn't move; a tap folds it again.
//   Left open, it is open when the page is opened again on this device (euf-1, P1).
//   Literacy is not a Details line (it is the line under Languages).
//   "Nothing written yet." is at least 14 px (the review of #910).
import { expect, test, type Page } from "@playwright/test";
import { accessibilityProblems, layoutProblems } from "./checks.ts";

const SIZES = [
  { name: "tablet-landscape", width: 1180, height: 820, beside: true },
  { name: "phone", width: 375, height: 812, beside: false },
] as const;

async function openP1(page: Page) {
  await page.goto("/layout.html?as=player&p1=1");
  // The P1 character's campaign row opens the Player screen, as player-c3.spec.ts opens it.
  await page.getByRole("button", { name: /The Storm Lantern Road/ }).click();
  // The level block is drawn once the sheet has opened (Details, folded, draws the same heading before and after).
  await expect(page.locator(".player-level")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of SIZES) {
  test.describe(`Details (C4, C5), ${size.name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("folded to its heading and chevron; a tap opens every line in place, whole, and folds it again", async ({
      page,
    }) => {
      await openP1(page);
      const details = page.getByRole("region", { name: "Details" });
      if (size.beside) {
        // Last in the left column.
        const left = page.locator(".player__pane--play");
        await expect(
          left.getByRole("region", { name: "Details" }),
        ).toBeVisible();
        const lastRegion = await left.evaluate((el) => {
          const regions = [
            ...el.querySelectorAll("section[aria-label]"),
          ].filter((r) => !r.parentElement?.closest("section[aria-label]"));
          return regions.at(-1)?.getAttribute("aria-label");
        });
        expect(lastRegion).toBe("Details");
      }
      // Folded: the heading row alone, a 44 px target across the column, with its chevron; no line.
      const fold = details.getByRole("button", { name: "Details" });
      await expect(fold).toHaveAttribute("aria-expanded", "false");
      await expect(fold.locator(".icon")).toBeVisible();
      await expect(details.locator(".book-line")).toHaveCount(0);
      await expect(details.locator(".player-details")).toHaveCount(0);
      const box = (await fold.boundingBox())!;
      const region = (await details.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      expect(box.width).toBeGreaterThanOrEqual(region.width - 1);
      expect(await layoutProblems(page)).toEqual([]);
      expect(
        await accessibilityProblems(page, 'section[aria-label="Details"]'),
      ).toEqual([]);

      // Opened: every line in the book's form, whole inside the column; the heading has not moved (measured once it is
      // in view, so the click itself scrolls nothing).
      await fold.scrollIntoViewIfNeeded();
      const top = (await fold.boundingBox())!.y;
      await fold.click();
      await expect(fold).toHaveAttribute("aria-expanded", "true");
      await expect(details.locator(".player-details")).toBeVisible();
      const labels = await details
        .locator(".book-line > .book-label")
        .allTextContents();
      expect(labels.length).toBeGreaterThan(0);
      expect(labels).not.toContain("Literacy");
      const outside = await details.evaluate((el) => {
        const edge = el.getBoundingClientRect().right;
        return [...el.querySelectorAll(".book-line")].filter(
          (l) => l.getBoundingClientRect().right > edge + 1,
        ).length;
      });
      expect(outside).toBe(0);
      expect(
        Math.abs((await fold.boundingBox())!.y - top),
      ).toBeLessThanOrEqual(1);
      expect(await layoutProblems(page)).toEqual([]);
      expect(
        await accessibilityProblems(page, 'section[aria-label="Details"]'),
      ).toEqual([]);
      await fold.click();
      await expect(fold).toHaveAttribute("aria-expanded", "false");
      await expect(details.locator(".book-line")).toHaveCount(0);
    });

    test("left open, it is open when the page is opened again (euf-1)", async ({
      page,
    }) => {
      await openP1(page);
      const fold = page
        .getByRole("region", { name: "Details" })
        .getByRole("button", { name: "Details" });
      await fold.click();
      await expect(fold).toHaveAttribute("aria-expanded", "true");
      await openP1(page);
      const again = page.getByRole("region", { name: "Details" });
      await expect(
        again.getByRole("button", { name: "Details" }),
      ).toHaveAttribute("aria-expanded", "true");
      await expect(again.locator(".book-line").first()).toBeVisible();
    });
  });
}

test.describe("Details (C5), many lines, phone (375×812)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('a tap opens all the lines and folds them again; "Nothing written yet." would be 14 px or more', async ({
    page,
  }) => {
    // The layout page's Wren has more than three lines: folded, none shows; opened, all of them.
    await page.goto("/layout.html?as=player");
    await page.getByRole("button", { name: /The Drowned Marches/ }).click();
    const details = page.getByRole("region", { name: "Details" });
    const fold = details.getByRole("button", { name: "Details" });
    await expect(fold).toBeVisible();
    const box = (await fold.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    await expect(details.locator(".book-line")).toHaveCount(0);
    await fold.click();
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await expect(details.locator(".book-line").first()).toBeVisible();
    expect(await details.locator(".book-line").count()).toBeGreaterThan(3);
    expect(await layoutProblems(page)).toEqual([]);
    await fold.click();
    await expect(details.locator(".book-line")).toHaveCount(0);
    // "Nothing written yet." is the part's `.auth__meta` line (only while nothing is written): the same class set in
    // the same place, measured, is at least 14 px (the review of #910).
    const size = await details.evaluate((el) => {
      const p = document.createElement("p");
      p.className = "auth__meta";
      p.textContent = "Nothing written yet.";
      el.appendChild(p);
      const px = parseFloat(getComputedStyle(p).fontSize);
      p.remove();
      return px;
    });
    expect(size).toBeGreaterThanOrEqual(14);
  });
});
