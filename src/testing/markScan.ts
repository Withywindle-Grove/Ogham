// The players' screens on creation's standard (plan m5b-players-screens-standard A2): a test helper that watches parts
// of the page while a test walks them and keeps every text holding a mark the standard forbids there: a middle dot
// between words (" · "), "›" or "▲". Shared by slices A–D (Player, Pack, the full sheet), so each adds its screens to
// the same check; the sweep (E) runs it on every screen. For jsdom tests.

/** What the plan forbids on these screens: a middle dot between words, "›", "▲". */
export const FORBIDDEN_MARKS = / · |[›▲]/;

/**
 * Starts watching `regions` (a selector) after every change to the page. `skip` leaves out parts another slice owns.
 * Returns the texts found ("<class>|<text>") and a stop.
 */
export function watchMarks(regions: string, skip?: string): { found: Set<string>; stop: () => void } {
  const found = new Set<string>();
  const scan = () => {
    for (const region of document.querySelectorAll(regions)) {
      for (const el of [region, ...region.querySelectorAll('*')]) {
        if (skip && el.closest(skip)) continue;
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join('');
        if (FORBIDDEN_MARKS.test(own)) found.add(`${String(el.className)}|${(el.textContent ?? '').trim()}`);
        const label = el.getAttribute('aria-label');
        if (label && FORBIDDEN_MARKS.test(label)) found.add(`${String(el.className)}|aria-label ${label}`);
      }
    }
  };
  const watching = new MutationObserver(scan);
  watching.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  scan();
  return { found, stop: () => watching.disconnect() };
}
