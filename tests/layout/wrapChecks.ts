// Wrapping and fitting checks for the layout tests: the repeat catches in Design's gallery and gate-walk reviews
// (a word squeezed to a letter a line, text past the screen's side, text cut by a box that hides overflow).
import type { Page } from '@playwright/test';

/**
 * Text that wraps or fits badly. Intentional ellipsis (`text-overflow: ellipsis`) and sideways-scrolling strips are
 * left alone.
 */
export async function wrapProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''} "${(el.textContent || '').trim().slice(0, 40)}"`;
    const hides = (v: string) => v === 'hidden' || v === 'clip';
    const scrolls = (v: string) => v === 'auto' || v === 'scroll';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      const text = (node.textContent || '').trim();
      if (!el || !text || el.closest('script, style, [hidden], [aria-hidden=true], .visually-hidden')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) continue;
      // A letter a line: eight or more characters spread over so many lines that each holds fewer than three.
      const lines = new Set(rects.map((r) => Math.round(r.top / 4))).size;
      if (text.length >= 8 && text.length / lines < 3) problems.push(`squeezed to ${lines} lines (a letter a line): ${describe(el)}`);
      // Past the screen's sides (unless a sideways-scrolling strip holds it).
      const right = Math.max(...rects.map((r) => r.right));
      const left = Math.min(...rects.map((r) => r.left));
      let inStrip = false; // a sideways-scrolling strip, or an ellipsis or clamped line, holds the text on purpose
      let cut = '';
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        const clamp = (s as unknown as Record<string, string>).webkitLineClamp;
        if (s.textOverflow === 'ellipsis' || (clamp && clamp !== 'none') || scrolls(s.overflowX)) {
          inStrip = true;
          break;
        }
        if (!hides(s.overflowX) && !hides(s.overflowY)) continue;
        const box = a.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) break;
        if (rects.some((r) => r.right > box.right + 1.5 || r.left < box.left - 1.5 || r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5)) {
          cut = describe(a);
          break;
        }
      }
      if (cut) problems.push(`cut off by ${cut}: ${describe(el)}`);
      else if (!inStrip && (right > window.innerWidth + 1 || left < -1)) problems.push(`runs past the screen's side: ${describe(el)}`);
    }
    return [...new Set(problems)];
  });
}
