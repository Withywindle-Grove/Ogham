// Checks shared by the layout and gallery tests: sideways scrolling, tap targets, text sizes, accessibility.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** Problems with the page as it stands: sideways scrolling, small tap targets, small text. */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1) {
      problems.push(`scrolls sideways: page is ${root.scrollWidth}px wide in a ${window.innerWidth}px window`);
    }
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 2 && box.height > 2 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const describe = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;

    // Tap targets: buttons, links, form boxes, and labels that act as buttons (the photo choosers).
    const targets = document.querySelectorAll(
      'button, a[href], select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]), label[for], .check',
    );
    for (const el of targets) {
      if (!visible(el)) continue;
      // A label beside its own box isn't a separate target.
      if (el.tagName === 'LABEL' && !el.matches('.portrait-picker__add, .portrait-picker__change, .quick-portrait__label')) continue;
      const height = el.getBoundingClientRect().height;
      if (height < 43.5) problems.push(`small tap target (${Math.round(height)}px tall): ${describe(el)}`);
    }

    // Button groups line up (tf-9, 2026-11-03): buttons side by side in one flex row, on the same line, share their
    // top, middle or bottom (within a pixel). A button pinned to the top beside one pinned to the bottom fails.
    const rows = new Set<Element>();
    for (const el of document.querySelectorAll('button')) if (el.parentElement) rows.add(el.parentElement);
    for (const row of rows) {
      const style = getComputedStyle(row);
      if (!style.display.endsWith('flex') || style.flexDirection.startsWith('column')) continue;
      const buttons = [...row.children].filter((el) => el.tagName === 'BUTTON' && visible(el)).map((el) => ({ el, box: el.getBoundingClientRect() }));
      for (let i = 1; i < buttons.length; i++) {
        const [a, b] = [buttons[i - 1]!, buttons[i]!];
        const sameLine = a.box.top < b.box.bottom && b.box.top < a.box.bottom;
        if (!sameLine) continue;
        const level = (x: number, y: number) => Math.abs(x - y) <= 1;
        if (!level(a.box.top, b.box.top) && !level(a.box.bottom, b.box.bottom) && !level(a.box.top + a.box.height / 2, b.box.top + b.box.height / 2)) {
          problems.push(`buttons out of line: ${describe(a.el)} and ${describe(b.el)}`);
        }
      }
    }

    // Text sizes: body at least 16px; nothing under 14px (the type scale's floor, ruled 2026-10-25).
    const body = parseFloat(getComputedStyle(document.body).fontSize);
    if (body < 16) problems.push(`body text is ${body}px`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim() || !visible(el)) continue;
      seen.add(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 13.95) problems.push(`text under 14px (${size}px): ${describe(el)}`);
    }
    return problems;
  });
}

/** Serious or critical accessibility problems axe finds on the page, in short words. */
/** `within` limits the check to one part (an open pop-up, whose dimmed page behind it isn't being read). */
export async function accessibilityProblems(page: Page, within?: string): Promise<string[]> {
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  const results = await (within ? axe.include(within) : axe).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')})`);
}
