// Shared by the pages of creation's style sweep (batches B to H). Load after final.js; call applyPair() after mount().
const col = (label, inner, cls = '') => `<div><p class="lab">${label}</p><div class="phone ${cls}">${inner}</div></div>`;
const frame = (cap, cols, w = 1100, from = 'From the mockup, not yet checked against the built screen.') => `<div><p class="cap" style="width:${w}px;max-width:${w}px">${cap}</p><div class="trio">${cols.join('')}</div><p class="from">${from}</p></div>`;
const BUILT = 'Drawn from the built gallery’s picture of these parts (parts, not a whole screen).';
// a pick row as ruled 2026-11-12: the ⓘ at its start opens the entry; the short line runs under the row at its full width
const irow = (name, sub, state = 'pick', extra = '') => `<div class="card${state === 'picked' ? ' picked' : ''}"><div class="prow"><span class="i" role="button" aria-label="About ${name}">${I.info}</span><div class="text">${name}</div><span class="btn${state === 'accent' ? ' accent' : ''}">${state === 'picked' ? 'Picked ✓' : 'Pick'}</span></div>${sub ? `<div class="under">${sub}</div>` : ''}${extra}</div>`;
// today's row, for the "before" columns: the short line beside the ⓘ and the button
const irowOld = (name, sub, state = 'pick') => `<div class="card"><div class="prow"><span class="i" role="button" aria-label="About ${name}">${I.info}</span><div class="text">${name}<small>${sub}</small></div><span class="btn${state === 'accent' ? ' accent' : ''}">Pick</span></div></div>`;
// one fold mark (ruled 2026-11-12): a chevron, down when folded, up when open; "+" is kept for adding
const foldMark = (open) => `<span class="fmark${open ? ' open' : ''}" aria-hidden="true">${I.chev}</span>`;
const helpGap = `<div class="helpgap">${helpBtn()}</div>`;
// inside .bit: the pair. Alegreya Sans SC where today's styles set small capitals; Bitter for everything else, with the plain zero.
function applyPair() {
  for (const root of document.querySelectorAll('.bit')) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el instanceof SVGElement || el.closest('.bk') || el.classList.contains('ehead')) continue;
      const cs = getComputedStyle(el);
      const garamond = /Garamond/.test(cs.fontFamily);
      const caps = cs.fontVariantCaps === 'small-caps' || (cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) > 0) || el.classList.contains('tagp');
      if (caps) { el.dataset.sc = '1'; continue; }
      el.style.fontFamily = '"T Bitter", Georgia, serif';
      if (garamond) el.style.fontWeight = '700';
    }
    for (const el of root.querySelectorAll('[data-sc]')) { el.style.fontFamily = '"T Alegreya Sans SC", sans-serif'; el.style.fontVariant = 'normal'; el.style.textTransform = 'none'; el.style.fontWeight = '700'; }
  }
}
// the foot of an optional step: “Decide later” first (as built), then the state, Back and Next
const footL = (say, next = 'accent', wide = false) => `<div class="foot"><span class="btn small">Decide later</span><span class="say">${say}</span>${wide ? '' : '<span style="flex:1 0 100%;height:0"></span>'}<span class="btn">Back</span><span class="btn${next === 'accent' ? ' accent' : ''}">Next</span></div>`;
