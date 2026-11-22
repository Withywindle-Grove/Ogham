// Shared pieces for the Pack rework mockups (2026-11-11), loaded after ../creation/final/final.js, ../scene/scene.js and ../scene/scene-seq.js.
// Invented names only. The parts here are the Scene redesign's (the band, the facts, the panel) with three named variants for the Pack: the item row, the item group, the load fact.
Object.assign(SY, {
  chest: `<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9H4z" ${W}/><path d="M4 12h16M12 11v3" ${W}/>`,
  hand: `<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V7a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6c-2.5 0-4-1-5.5-3.5L4 14.5a1.5 1.5 0 0 1 2.5-1.5L8 15" ${W}/>`,
  weight: `<path d="M6 9h12l2 11H4z" ${W}/><circle cx="12" cy="6" r="2.5" ${W}/>`,
  gift: `<rect x="4" y="10" width="16" height="10" rx="1" ${W}/><path d="M3 7h18v3H3zM12 7v13M12 7c-1-3-5-3-5-1s3 1 5 1zM12 7c1-3 5-3 5-1s-3 1-5 1z" ${W}/>`,
  plus: `<path d="M12 5v14M5 12h14" ${W}/>`,
  starf: `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  down: `<path d="M6 9l6 6 6-6" ${W}/>`,
  upc: `<path d="M6 15l6-6 6 6" ${W}/>`,
});
const small = (w, o = {}) => b(w, { small: true, ...o });
const band = ({ over, title, ident, acts = [] }) => `<div class="band"><div><div class="over">${over}</div><h3 class="display">${title}</h3><p class="ident">${ident}</p></div><div class="acts">${acts.join('')}</div></div>`;

// device frames with the Pack tab current
const packRail = (role = 'player') => `<div class="rail">${(role === 'gm' ? [['fire', 'Scene'], ['people', 'Players', 1], ['scales', 'Rules']] : [['crown', 'Player'], ['fire', 'Scene'], ['sack', 'Pack', 1]]).map(([k, l, on]) => `<span class="ri${on ? ' on' : ''}" role="button" aria-label="${l}">${sym(k, 24)}</span>`).join('')}</div>`;
const pdev = (kind, inner, cap, o = {}) => `<div><p class="cap" style="width:${kind === 'wide' ? 1440 : 1024}px">${cap}</p><div class="dev ${kind}${o.panel ? ' fixed' : ''}">${packRail(o.role)}<div class="main">${topRow(o.role || 'player')}<div class="page">${inner}</div></div>${o.panel ? `<div class="veil"></div>${o.panel}` : ''}</div></div>`;
const packTabs = `<div class="tabbar">${['Player', 'Scene', 'Pack', 'Log'].map((t) => `<span${t === 'Pack' ? ' class="on"' : ''}>${t}</span>`).join('')}</div>`;

// the item row. o: n (how many, stackables only), wt (a figure) and unit, act (its one action, as today's At hand rows), mark (an icon key), isNew, tag
const it = (name, line, o = {}) => `<div class="it${o.isNew ? ' new' : ''}" role="button" aria-label="${name}${o.wt === undefined ? '' : ', weight ' + o.wt}"><span class="im">${o.mark ? sym(o.mark, 20) : ''}</span><span class="in"><b>${name}</b>${o.n !== undefined ? ` <span class="qty">×${o.n}</span>` : ''}${o.isNew ? '<span class="newtag">New</span>' : ''}<small>${line}</small></span><span class="iw">${o.wt === undefined ? '' : `<b>${o.wt}</b>${o.unit || ''}`}</span><span class="ia">${o.act ? small(o.act) : svg(SY.right, 20)}</span></div>`;
const grp = (title, meta, rows, o = {}) => `<div class="grp${o.nest ? ' nest' : ''}"><div class="gh"><h2>${title}</h2><span class="meta">${meta}</span></div>${o.note ? `<p class="in-note">${o.note}</p>` : ''}${o.noWeight ? '' : '<div class="colh" aria-hidden="true"><span></span><span></span><span>Weight</span><span></span></div>'}${rows.join('')}</div>`;
const foldr = (title, sub, open) => `<div class="foldr" role="button" aria-expanded="${!!open}"><span class="ft"><b>${title}</b><small>${sub}</small></span>${svg(open ? SY.upc : SY.down, 20)}</div>`;

// the coin line (pk-6): only the character's owner and the GM are ever sent it
const coinLine = (v = '12 crowns, 30 herons, 4 bits', s = 'Coin. Only you and your GM see this.') => `<div class="coinline" role="button" aria-label="Coin: ${v}">${sym('sack', 24)}<span><span class="cv">${v}</span><small>${s}</small></span>${svg(SY.right, 20)}</div>`;

// the load fact: tier and speed as the value, the bar (filled parts of `of`, a tier mark after each index in `marks`), the figure in words
const loadFact = ({ v, s, filled, of = 20, marks = [], over = false, k = 'Load' }) => `<div class="fact load${over ? ' heavy' : ''}" role="button" aria-label="${k}: ${v}. ${s}"><span class="fi">${sym(over ? 'warn' : 'weight', 28)}</span><span class="k">${k}</span><span class="v"${v.length > 16 ? ' style="font-size:20px"' : ''}>${v}</span><span class="lb" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i${i < filled ? ' class="f"' : ''}></i>${marks.includes(i + 1) ? '<i class="t"></i>' : ''}`).join('')}</span><span class="s">${s}</span></div>`;
