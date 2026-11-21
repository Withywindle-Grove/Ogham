// Shared pieces for the redrawn magic mockups (2026-11-09). They sit on creation's standard (../creation/final/final.css and final.js).
const menu = svg(`<path d="M4 7h16M4 12h16M4 17h16" ${W}/>`);
const tabIcons = {
  player: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 18l1-10 4 4 3-6 3 6 4-4 1 10z" ${W}/><path d="M4 18h16v2H4z" ${T}/></svg>`,
  scene: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-5 1-8z" ${W}/><path d="M4 21l16-3M20 21L4 18" ${T}/></svg>`,
  pack: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 7h6l3 4c2 3 1 9-6 9s-8-6-6-9z" ${W}/><path d="M9 7l-1-3h8l-1 3" ${T}/></svg>`,
  // Proposed for Magic: a crescent moon with a spark (the star is taken by Pin).
  magic: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M14 3a8.5 8.5 0 1 0 7 13.5A7.5 7.5 0 0 1 14 3z" ${W}/><path d="M18.5 4v4M16.5 6h4" ${T}/></svg>`,
  log: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 5c3 0 6 1 9 3 3-2 6-3 9-3v13c-3 0-6 1-9 3-3-2-6-3-9-3z" ${W}/><path d="M12 8v13" ${T}/></svg>`,
};
const tabs = (on, keys = ['player', 'scene', 'pack', 'magic', 'log']) => `<div class="tabs" style="grid-template-columns:repeat(${keys.length},1fr)">${keys.map(k => `<span class="tab${k === on ? ' on' : ''}">${tabIcons[k]}${k[0].toUpperCase() + k.slice(1)}</span>`).join('')}</div>`;
const topbar = (title) => `<div class="bar"><span class="ico" role="button" aria-label="Menu">${menu}</span><span class="title">${title}</span><span class="ico" role="button" aria-label="More">${I.more}</span></div>`;
// A row: the name and its line open the rules; a button acts; a chevron opens something.
const item = (name, sub, action) => `<div class="row"><div class="text">${name}${sub ? `<small>${sub}</small>` : ''}</div>${action ? `<span class="btn small">${action}</span>` : I.chev}</div>`;
// A cast spell: crossed out, the word "Cast", last in its level.
const spent = (name, sub) => `<div class="row"><div class="text"><span class="gone">${name}</span><small>${sub}</small></div></div>`;
// A spell prepared more than once: one row, a dot per casting, hollow once cast (mm-1). None when prepared once.
const dots = (left, of) => `<span class="pips" role="img" aria-label="${left} of ${of} left">${'●'.repeat(left)}${'○'.repeat(of - left)}</span>`;
const level = (words) => `<p class="meta lvl">${words}</p>`;
const foldRow = (name, sub) => `<div class="card"><div class="kv"><div class="text">${name}${sub ? `<small>${sub}</small>` : ''}</div><span class="btn sq" role="button" aria-label="Show">${I.plus}</span></div></div>`;
const toast = (words, action = 'Undo') => `<div class="toast"><span>${words}</span>${action ? `<span class="btn small">${action}</span>` : `<span class="btn sq" role="button" aria-label="Close" style="border:0;background:transparent">${I.close}</span>`}</div>`;
const stepRow = (name, sub, n) => `<div class="row"><div class="text">${name}${sub ? `<small>${sub}</small>` : ''}</div>${stepper(n)}</div>`;
