// Shared pieces for the final drafts of creation (2026-11-07). Each page builds its markup with these, then final.js clones it into the light and dark columns.
const W = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const T = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
const svg = (inner, w = 24, vb = '0 0 24 24') => `<svg viewBox="${vb}" width="${w}" height="${w / (vb === '0 0 48 24' ? 2 : 1)}" aria-hidden="true">${inner}</svg>`;

// Dice (ruled 2026-11-07): the solids' projections, outline 2 px, inner edges 1 px, each die its colour.
const DIE_O = { 4: 'M12 2.5L21.5 20.5H2.5z', 6: 'M12 2L21 7V17L12 22L3 17V7z', 8: 'M12 2L21 7V17L12 22L3 17V7z', 20: 'M12 2L21 7V17L12 22L3 17V7z', 12: 'M12 2L18 4.5L22 9.5L21 16L16.5 21H7.5L3 16L2 9.5L6 4.5z', 10: 'M12 2L21 9L17 20H7L3 9z' };
const DIE_I = { 4: 'M12 2.5L11 13.5M11 13.5L2.5 20.5M11 13.5L21.5 20.5', 6: 'M12 12L3 7M12 12L21 7M12 12V22', 8: 'M3 7H21L12 22z', 20: 'M12 5L19 16H5zM12 2V5M3 7L5 16M21 7L19 16M3 17L5 16M21 17L19 16M12 22L5 16M12 22L19 16M12 5L3 7M12 5L21 7', 12: 'M12 8L16.5 11L15 16H9L7.5 11zM12 8V2M16.5 11L22 9.5M15 16L16.5 21M9 16L7.5 21M7.5 11L2 9.5M18 4.5L16.5 11M6 4.5L7.5 11', 10: 'M12 2L8 10M12 2L16 10M8 10L3 9M16 10L21 9M8 10L12 13L16 10M12 13L7 20M12 13L17 20' };
const dieInner = (n) => `<path d="${DIE_O[n]}" fill="none" stroke="var(--d${n})" stroke-width="2" stroke-linejoin="round"/><path d="${DIE_I[n]}" fill="none" stroke="var(--d${n})" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>`;
const die = (n, w = 24) => n === 100
  ? `<svg viewBox="0 0 48 24" width="${w * 2}" height="${w}" aria-hidden="true">${dieInner(10)}<g transform="translate(24 0)">${dieInner(10)}</g></svg>`
  : `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true">${dieInner(n)}</svg>`;

// Icons
const I = {
  back: svg(`<path d="M19 12H6M11 6l-6 6 6 6" ${W}/>`),
  more: svg('<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>'),
  close: svg(`<path d="M5 5l14 14M19 5L5 19" ${W}/>`, 20),
  info: svg(`<circle cx="12" cy="12" r="9" ${W}/><path d="M12 11v6" ${W}/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/>`, 20),
  plus: svg(`<path d="M5 12h14M12 5v14" ${W}/>`, 20),
  minus: svg(`<path d="M5 12h14" ${W}/>`, 20),
  chev: `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" ${W}/></svg>`,
  warn: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3l10 18H2z" ${W}/><path d="M12 10v5" ${W}/><circle cx="12" cy="18" r="1.2" fill="currentColor"/></svg>`,
};

// Pieces
const bar = (title, right = 'more') => `<div class="bar"><span class="ico" role="button" aria-label="Back">${I.back}</span><span class="title">${title}</span><span class="ico" role="button" aria-label="${right === 'close' ? 'Close' : 'More'}">${right === 'close' ? I.close : right === 'none' ? '' : I.more}</span></div>`;
const roll = (n, text) => `<div class="roll">${die(n)}<span>${text}</span></div>`;
const helpBtn = (wide = true) => `<span class="btn small${wide ? ' wide' : ''}">${I.info}Help me choose</span>`;
const helpOpen = (text) => `<div class="help"><span class="btn sq x" role="button" aria-label="Close help" style="border:0;background:transparent">${I.close}</span>${text}</div>`;
const stepper = (v, avg = false) => `<span class="stepper"><span class="btn sq">−</span><span class="num${avg ? ' avg' : ''}">${v}</span><span class="btn sq">+</span></span>`;
const avgCard = (name, v, caption) => `<div class="card"><div class="kv"><span>${name}</span>${stepper(v, true)}</div><div class="avgline">Average value, replace with your roll</div></div>`;
const valCard = (name, v, caption) => `<div class="card"><div class="kv"><span>${name}</span>${stepper(v)}</div>${caption ? `<div class="meta">${caption}</div>` : ''}</div>`;
const warn = (text) => `<span class="warnline">${I.warn}${text}</span>`;
const pick = (name, sub, state = 'pick', extra = '') => {
  const btn = state === 'pick' ? '<span class="btn">Pick</span>' : state === 'accent' ? '<span class="btn accent">Pick</span>' : state === 'picked' ? '<span class="btn">Picked ✓</span>' : state === 'change' ? '<span class="btn small">Change</span>' : state === 'open' ? '<span class="btn">Open</span>' : '';
  const cls = state === 'picked' || state === 'change' ? ' picked' : state === 'openrow' ? ' open' : '';
  return `<div class="card${cls}"><div class="kv"><div class="text">${name}${sub ? `<small>${sub}</small>` : ''}${extra}</div>${btn}</div></div>`;
};
const closedPick = (name, why) => `<div class="card"><div class="kv"><div class="text">${name}<small>${warn(why)}</small></div></div></div>`;
const foot = (say, back = true, next = 'accent', nextLabel = 'Next') => `<div class="foot"><span class="say">${say}</span>${back ? `<span class="btn">${back === true ? 'Back' : back}</span>` : ''}<span class="btn${next === 'accent' ? ' accent' : ''}">${nextLabel}</span></div>`;
const kvRow = (k, v, opts = {}) => `<div class="row"><span class="k">${k}</span><span class="v${opts.empty ? ' empty' : ''}">${v}${opts.chev ? I.chev : ''}</span></div>`;
const phone = (inner, cap) => `<div>${cap ? `<p class="cap" style="width:343px">${cap}</p>` : ''}<div class="phone">${inner}</div></div>`;
const tablet = (inner, cap) => `<div>${cap ? `<p class="cap">${cap}</p>` : ''}<div class="tablet">${inner}</div></div>`;
const sheet = (title, inner) => `<div class="dim"></div><div class="sheetup"><div class="head"><span class="title">${title}</span><span class="btn sq" role="button" aria-label="Close" style="border:0;background:transparent">${I.close}</span></div>${inner}</div>`;

function mount(html) {
  document.body.insertAdjacentHTML('beforeend', `<div class="pair"><div class="theme light" id="light">${html}</div><div class="theme dark" id="dark">${html}</div></div>`);
}
