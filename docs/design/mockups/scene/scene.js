// Shared pieces for the Scene redesign mockups (2026-11-11), loaded after ../creation/final/final.js (W, svg, I, warn, phone, sheet, mount).
// Invented names only. The step icons are the app's own drawings (src/ui/icons.tsx, StepIcon), the ones Francis said he likes; the status symbols are the approved set (players/03).
const SY = {
  // step and action icons, as built
  clock: `<circle cx="12" cy="12" r="8" ${W}/><path d="M12 7.5V12l3 2" ${W}/>`,
  weather: `<path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" ${W}/>`,
  travel: `<ellipse cx="8" cy="15" rx="2" ry="3" ${W}/><ellipse cx="16" cy="8" rx="2" ry="3" ${W}/><path d="M8 20v.5M16 13v.5" ${W}/>`,
  encounter: `<path d="M5 4l10 10M19 4L9 14" ${W}/><path d="M13 16l3-3M11 16l-3-3M15 15l3.5 3.5M9 15l-3.5 3.5" ${W}/>`,
  camp: `<path d="M3 20L12 5l9 15z" ${W}/><path d="M12 12l-3 8M12 12l3 8" ${W}/>`,
  rest: `<path d="M15.5 4a8 8 0 1 0 4.5 12A6.5 6.5 0 0 1 15.5 4z" ${W}/>`,
  search: `<circle cx="10.5" cy="10.5" r="5.5" ${W}/><path d="M15 15l5 5" ${W}/>`,
  forage: `<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z" ${W}/><path d="M5 19l8-8" ${W}/>`,
  hunt: `<path d="M4 20L19 5M19 5h-5M19 5v5M4 20l1-4M4 20l4-1" ${W}/>`,
  course: `<circle cx="12" cy="12" r="8" ${W}/><path d="M12 6.5l2 5.5-2 5.5-2-5.5z" ${W}/>`,
  note: `<path d="M5 4h14v11l-5 5H5z" ${W}/><path d="M14 20v-5h5" ${W}/>`,
  watch: `<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" ${W}/><circle cx="12" cy="12" r="2.5" ${W}/>`,
  describe: `<path d="M4 5h16v10H10l-5 4v-4H4z" ${W}/>`,
  monster: `<path d="M7 4c-1 5 0 11 3 16M12 4c-.5 5 .5 11 3 16M17 4c0 5 1 10 3 14" ${W}/>`,
  // lights and marks on a party circle
  flame: `<path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3C9.5 9 10.5 10 11 10.5 11 8 11 5.5 12 3z" ${W}/>`,
  flameout: `<path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3C9.5 9 10.5 10 11 10.5 11 8 11 5.5 12 3z" ${W}/><path d="M4 21L20 3" ${W}/>`,
  lantern: `<path d="M9 8h6l2 3v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7z" ${W}/><path d="M10 8V6a2 2 0 0 1 4 0v2M12 13v3" ${W}/>`,
  spark: `<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" ${W}/>`,
  eye: `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" ${W}/><circle cx="12" cy="12" r="3" ${W}/>`,
  eyeoff: `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" ${W}/><circle cx="12" cy="12" r="3" ${W}/><path d="M4 20L20 4" ${W}/>`,
  half: `<circle cx="12" cy="12" r="8" ${W}/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>`,
  warn: `<path d="M12 3l10 18H2z" ${W}/><path d="M12 10v5" ${W}/><circle cx="12" cy="18" r="1.2" fill="currentColor"/>`,
  // statuses
  stone: `<path d="M7 19l-3-5 2-6 6-3 6 3 2 6-3 5z" ${W}/><path d="M9 13l3-4 3 4" ${W}/>`,
  drop: `<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" ${W}/>`,
  star: `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" ${W}/>`,
  bed: `<path d="M3 18V8M3 14h18v4M21 18v-6a3 3 0 0 0-3-3H10v5" ${W}/><circle cx="6.5" cy="10.5" r="1.5" ${W}/>`,
  // chrome
  lock: `<rect x="5" y="11" width="14" height="10" rx="1.5" ${W}/><path d="M8 11V8a4 4 0 0 1 8 0v3" ${W}/>`,
  up: `<path d="M12 20V5M6 11l6-6 6 6" ${W}/>`,
  right: `<path d="M9 6l6 6-6 6" ${W}/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${W}/>`,
  fire: `<path d="M12 4c1.5 2 3 3.5 3 5.5a3 3 0 0 1-6 0C9 8 10.5 6.5 12 4z" ${W}/><path d="M4 20l16-5M4 15l16 5" ${W}/>`,
  people: `<circle cx="9" cy="8" r="3" ${W}/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" ${W}/><circle cx="17" cy="9" r="2.5" ${W}/><path d="M16 14.5c3 0 5 2 5 5" ${W}/>`,
  scales: `<path d="M12 4v16M6 20h12M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" ${W}/>`,
  book: `<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13" ${W}/>`,
  mail: `<rect x="3" y="6" width="18" height="13" rx="1.5" ${W}/><path d="M3.5 7l8.5 6.5L20.5 7" ${W}/>`,
  pin: `<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" ${W}/>`,
  table: `<rect x="4" y="5" width="16" height="14" rx="1" ${W}/><path d="M4 10h16M4 14.5h16M9 5v14" ${W}/>`,
  sack: `<path d="M8 8c-3 3-4 6-4 8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4c0-2-1-5-4-8zM9 8l-1-4h8l-1 4M9 8h6" ${W}/>`,
  crown: `<path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z" ${W}/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16" ${W}/>`,
  flag: `<path d="M6 21V4M6 5h11l-2 4 2 4H6" ${W}/>`,
};
const sym = (k, w = 16) => svg(SY[k], w);
const TONE = { harm: 'danger', boon: 'info', neutral: 'ink' };
const ico = (k, label) => `<span class="ico" role="button" aria-label="${label}">${sym(k, 24)}</span>`;
const info = (label) => `<span class="ico" role="button" aria-label="${label}" style="color:var(--info)">${I.info}</span>`;
const b = (words, o = {}) => `<span class="btn${o.accent ? ' accent' : ''}${o.small ? ' small' : ''}${o.big ? ' big' : ''}${o.on ? ' on' : ''}${o.wide ? ' wide' : ''}" role="button"${o.on !== undefined ? ` aria-pressed="${!!o.on}"` : ''}>${o.icon ? sym(o.icon, o.big ? 24 : 20) : ''}${words}</span>`;

// ---- the party circle (01-marching-circles.html) ----
const PICS = [['#7C8C6E', '#D9DEC9'], ['#8A6F5A', '#E6D3BF'], ['#5F7486', '#CBD8E2'], ['#7E6A8F', '#DDD0E6']];
const pic = (i) => `<svg class="pic" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${PICS[i][0]}"/><circle cx="32" cy="25" r="11" fill="${PICS[i][1]}"/><path d="M10 64c0-14 9-22 22-22s22 8 22 22z" fill="${PICS[i][1]}"/></svg>`;
const ringSvg = (c, size = 72, stroke = 4) => {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r, m = size / 2;
  if (c.light) {
    const col = c.light.low ? 'warn' : 'glow';
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--rule)" stroke-width="${stroke}"/><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--${col})" stroke-width="${stroke}" stroke-dasharray="${(len * c.light.frac).toFixed(1)} ${len.toFixed(1)}"/></svg>`;
  }
  if (c.sight) return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--info)" stroke-width="2.5" stroke-dasharray="5 5"/></svg>`;
  return '';
};
const statusMark = (s) => `<span class="s"><span style="color:var(--${TONE[s.tone || 'harm']})">${sym(s.k, 20)}</span><span class="wd">${s.w}</span>${s.n ? `<span>×${s.n}</span>` : ''}</span>`;
// Hit points beside the name: the number with its maximum, and the segmented bar (one segment per point to 12, then one per 5).
const hpLine = ([now, most]) => { const n = most <= 12 ? most : Math.ceil(most / 5), f = Math.ceil(n * now / most); return `<span class="hp" aria-label="${now} of ${most} hit points"><span><b>${now}</b> of ${most}</span><span class="hpbar" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i < f ? ' class="f"' : ''}></i>`).join('')}</span></span>`; };
const pcClass = (c) => `${c.light ? (c.light.frac > 0 ? ' lit' : ' out') + (c.light.low ? ' low' : '') : c.sight ? ' sight' : ''}${c.nolight ? ' nolight' : ''}${c.you ? ' you' : ''}`;
const pc = (c, o = {}) => {
  const st = c.st || [], shown = st.slice(0, 2), more = st.length - shown.length;
  const mark = c.light ? (c.light.frac <= 0 ? 'flameout' : c.light.low ? 'warn' : c.light.k) : c.sight ? 'eye' : c.nolight ? 'half' : '';
  const lt = c.light ? c.light.words : c.sight ? 'Sees in the dark' : c.nolight ? 'No light' : '';
  return `<div class="pc${o.lg ? ' lg' : ''}${pcClass(c)}" role="button" aria-label="${c.name}"><span class="w"><span class="halo"></span>${ringSvg(c, o.lg ? 96 : 72, o.lg ? 5 : 4)}<span class="disc">${c.pic !== undefined ? pic(c.pic) : c.ini}</span>${mark ? `<span class="badge">${sym(mark, o.lg ? 18 : 16)}</span>` : ''}</span><span class="nm">${c.name.split(' ').map((w) => `<span>${w}</span>`).join(' ')}</span>${c.you ? '<span class="tag">You</span>' : ''}${c.hp ? hpLine(c.hp) : ''}${lt ? `<span class="lt">${lt}</span>` : ''}${st.length ? `<span class="sts">${shown.map(statusMark).join('')}${more > 0 ? `<span>+${more}</span>` : ''}</span>` : ''}</div>`;
};
const rank = (n, tiles) => `<div class="rank" aria-label="Rank ${n}"><span class="rn">${n}</span><div class="abreast">${tiles.join('')}</div></div>`;
const orderCard = (ranks, o = {}) => `<div class="pcard"><div class="mo-head"><h2>${o.title || 'Marching order'}</h2>${o.head || ''}</div><div class="mo-say">${o.say || ''}</div><div class="way">${svg(SY.up, 16)}Front</div>${ranks.join('')}<div class="way" style="margin-bottom:0">Rear</div></div>`;
const mini = (c) => `<span class="mini${c.light && c.light.frac > 0 ? ' lit' : c.sight ? ' sight' : ''}${c.you ? ' you' : ''}"><span class="halo"></span>${ringSvg(c, 40, 3)}<span class="disc">${c.pic !== undefined ? pic(c.pic) : c.ini}</span></span>`;
const strip = (ranks, names) => `<div class="strip" role="button" aria-label="Marching order: ${names}">${ranks.map((r) => `<span class="rk">${r.map(mini).join('')}</span>`).join('')}${svg(SY.right, 20)}<span class="names">${names}</span></div>`;

// The cast (invented).
const ash = { name: 'Ash', pic: 0, hp: [6, 8], light: { k: 'flame', frac: 4 / 6, words: 'Torch, 4 turns' } };
const wren = { name: 'Wren', pic: 1, hp: [9, 14] };
const tam = { name: 'Tam', ini: 'T', hp: [4, 4], st: [{ k: 'stone', w: 'Exhausted', n: 1 }] };
const bram = { name: 'Bram', pic: 2, hp: [11, 11], sight: true };

// ---- device frames ----
const railOf = (role) => `<div class="rail">${(role === 'gm' ? [['fire', 'Scene', 1], ['people', 'Players'], ['scales', 'Rules']] : [['crown', 'Player'], ['fire', 'Scene', 1], ['sack', 'Pack']]).map(([k, l, on]) => `<span class="ri${on ? ' on' : ''}" role="button" aria-label="${l}">${sym(k, 24)}</span>`).join('')}</div>`;
const topRow = (role, campaign = 'The Reed Marches') => `<div class="toprow"><span class="back">‹ ${campaign}</span>${ico('mail', 'Messages')}${role === 'gm' ? ico('book', 'Reference') : ''}${ico('note', 'Log')}<span class="ico" role="button" aria-label="More">${I.more}</span></div>`;
const device = (kind, role, inner, cap, extra = '') => `<div><p class="cap" style="width:${kind === 'wide' ? 1440 : 1024}px">${cap}</p><div class="dev ${kind}">${railOf(role)}<div class="main">${topRow(role)}<div class="page">${inner}</div></div>${extra}</div></div>`;
const ipad = (role, inner, cap, extra) => device('ipad', role, inner, cap, extra);
const pcWide = (role, inner, cap, extra) => device('wide', role, inner, cap, extra);
const phoneBar = (title) => `<div class="bar"><span class="ico" role="button" aria-label="Menu">${sym('menu', 24)}</span><span class="title">${title}</span><span class="ico" role="button" aria-label="More">${I.more}</span></div>`;
const tabBar = (role) => `<div class="tabbar">${(role === 'gm' ? ['Scene', 'Players', 'Rules', 'Log'] : ['Player', 'Scene', 'Pack', 'Log']).map((t) => `<span${t === 'Scene' ? ' class="on"' : ''}>${t}</span>`).join('')}</div>`;

// ---- Scene parts ----
const pips = (left, of) => `<span class="pips" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i${i < left ? ' class="f"' : ''}></i>`).join('')}</span>`;
const fact = (icon, k, v, s, o = {}) => `<div class="fact${o.due ? ' due' : ''}${o.plain ? ' plain' : ''}" role="button" aria-label="${k}: ${v}"><span class="fi">${sym(icon, 28)}</span><span class="k">${k}</span><span class="v"${v.length > 16 ? ' style="font-size:20px"' : ''}>${v}</span><span class="s">${s}</span></div>`;
const step = (icon, name, state = '', says = '') => `<div class="step ${state}" role="button" aria-label="${name}${says ? ', ' + says : ''}"><span class="sc">${sym(icon, 28)}${state === 'done' ? `<span class="tick">${sym('check', 14)}</span>` : ''}</span><span class="nm">${name}</span>${says ? `<span class="st">${says}</span>` : ''}</div>`;
const dayRow = (steps, extras = []) => `<div class="day">${steps.join('<span class="lnk"></span>')}<span class="gap"></span>${extras.length ? `<span class="ctl">${extras.join('')}</span>` : ''}</div>`;
const piece = (lead, text, shown) => `<div class="piece"><div class="lead"><b>${lead}.</b> ${text}</div><span class="eye${shown ? ' on' : ''}" role="button" aria-pressed="${!!shown}" aria-label="${shown ? 'Hide from players' : 'Show players'}">${sym(shown ? 'eye' : 'eyeoff', 24)}${shown ? 'Shown' : 'Hidden'}</span></div>`;
const waitCard = (icon, title, line, buttons) => `<div class="wait"><span class="wi">${sym(icon, 28)}</span><span class="wt">${title}</span><span>${line}</span><span class="wb">${buttons.join('')}</span></div>`;
const tableRow = (name, sub, pinned) => `<div class="trow" role="button"><span>${sym(pinned ? 'pin' : 'table', 20)}</span><span class="tn">${name}<small>${sub}</small></span>${svg(SY.right, 20)}</div>`;
const logLine = (text, when) => `<div class="logl">${text} <span>${when}</span></div>`;
