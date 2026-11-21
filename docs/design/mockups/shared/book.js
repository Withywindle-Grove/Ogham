// THE ONE TYPE PASS for the mockup pages (the lead, 2026-11-14). Load after the page's own script and call applyBook().
// It draws the target type inside every marked frame (.bit and .dev): running text in the text face; what a page marks
// as small capitals (font-variant, spaced uppercase, or data-sc) in the small-capitals face at bold, spaced .04em;
// display type (the older display face) in the text face at 700. A group of stacked buttons (an element marked
// data-stkgroup) shares its widest button's width. The book-format parts carry their own rules in
// shared/book.css and are left alone. A page must not write its own pass.
function applyBook() {
  const OWN = '.bk, .ehead, .bsub, .sclab, .toastb, .btn.stk';
  for (const root of document.querySelectorAll('.bit, .dev')) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el instanceof SVGElement) continue;
      if (el.matches(OWN) || (el.closest('.bk') && !el.matches('.tbar, caption'))) continue;
      const cs = getComputedStyle(el);
      const caps = el.dataset.sc !== undefined || cs.fontVariantCaps === 'small-caps' || (cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) > 0);
      if (caps) { el.dataset.sc = '1'; continue; }
      const display = /Garamond/.test(cs.fontFamily);
      el.style.fontFamily = '"T Bitter", Georgia, serif';
      if (display) el.style.fontWeight = '700';
    }
    for (const el of root.querySelectorAll('[data-sc]')) {
      if (el.matches('.ehead') || el.closest('.bk')) continue;
      el.style.fontFamily = '"T Alegreya Sans SC", sans-serif'; el.style.fontVariant = 'normal'; el.style.textTransform = 'none'; el.style.fontWeight = '700'; el.style.letterSpacing = '.04em';
    }
  }
  // a group of stacked buttons shares its widest (ic-1; the lead, 2026-11-14)
  const sizeGroups = () => {
    for (const g of document.querySelectorAll('[data-stkgroup]')) {
      const bs = [...g.querySelectorAll('.btn.stk')];
      for (const x of bs) x.style.minWidth = '';
      const w = Math.ceil(Math.max(0, ...bs.map((x) => x.getBoundingClientRect().width)));
      for (const x of bs) x.style.minWidth = w + 'px';
    }
  };
  sizeGroups();
  // measured again once the faces have loaded: a width taken in the fallback face is wrong
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeGroups);
}
