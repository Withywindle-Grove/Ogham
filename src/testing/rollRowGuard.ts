// The Roll row guard (creation retest 4 S1, 2026-11-09): every roll the app asks for sits in a Roll row with its die's
// glyph (06 Components, Roll row), never as loose words in a line, a hint or a caption. A test renders a screen and
// asks this for any "Roll" words outside one.
//   Allowed: inside a Roll row (`.roll-row`; a table with no die the app draws reads "Roll on the table" there, without
//   a glyph); a button that carries the die's glyph ("Roll for a name"); a status or alert line answering a tap
//   ("Roll d4 again…", feedback, not the ask); an entry's own heading ("Roll: 1–3 on d6" in an open entry is the
//   pack's text about the row, not an ask).

/** The words "Roll …" found outside a Roll row in `root`, each with a little of its text; [] when there are none. */
export function rollWordsOutsideRollRows(root: ParentNode): string[] {
  const found: string[] = [];
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root as Node, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    if (!/\bRoll\b/.test(text)) continue;
    const at = node.parentElement;
    if (!at) continue;
    if (at.closest('.roll-row')) continue;
    const button = at.closest('button');
    if (button?.querySelector('.die-glyph')) continue;
    if (at.closest('[role="status"], [role="alert"], .toast, .entry-panel__list dt')) continue;
    if (at.closest('[aria-hidden="true"]')) continue;
    found.push(text.trim().slice(0, 80));
  }
  return found;
}
