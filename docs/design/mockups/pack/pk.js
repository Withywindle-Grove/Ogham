// Shared by the pages of the Pack tab’s style sweep: the shell, the load, a group’s head, a row, a fold. Load after creation/final/final.js and sweep.js.
const PK_CHK = 'Checked against the built screen’s picture (pack-as-built on the pictures branch).';
const G = {
  menu: svg(`<path d="M4 7h16M4 12h16M4 17h16" ${W}/>`),
  mail: svg(`<path d="M3 6h18v12H3zM3 6l9 7 9-7" ${W}/>`),
  crown: svg(`<path d="M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10" ${W}/>`),
  fire: svg(`<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9zM5 21h14" ${W}/>`),
  pouch: svg(`<path d="M9 4h6l-1 3c3 2 5 5 5 8a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5c0-3 2-6 5-8z" ${W}/>`),
  book: svg(`<path d="M12 6c-2-1.500-5-2-8-1.500v13c3-.5 6 0 8 1.500 2-1.500 5-2 8-1.500v-13c-3-.5-6 0-8 1.500zM12 6v13" ${W}/>`),
  star: `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l3 7 7 .6-5.300 4.600 1.700 7-6.400-3.900-6.400 3.900 1.700-7L2 9.600 9 9z" fill="currentColor"/></svg>`,
};
const shell = (title = 'Wren’s pack') => `<div class="bar pk-bar"><span class="ico" role="button" aria-label="Menu">${G.menu}</span><span class="title">${title}</span><span class="ico" role="button" aria-label="Messages">${G.mail}</span></div>`;
const tabs = `<div class="pk-tabs" role="tablist"><span>${G.crown}Player</span><span>${G.fire}Scene</span><span class="on">${G.pouch}Pack</span><span>${G.book}Log</span></div>`;
// the load: its state in words, the bar in three parts, the figures. o.over: over the limit
const load = (sw, state, parts, of, over) => `<div class="pk-state${over ? ' over' : ''}">${over ? I.warn : ''}${state}</div><div class="pk-track${over ? ' over' : ''}" role="img" aria-label="${of}">${parts.map((p) => `<span><i style="width:${p}%"></i></span>`).join('')}</div><div class="pk-of">${sw ? of.replace(' coins', ' coins’ weight') : of}</div>`;
const gh = (sw, label, n, info) => `<div class="pk-gh"><span class="l">${label}</span>${info ? `<span class="i" role="button" aria-label="About the ${info}">${I.info}</span>` : ''}<span class="n">${n}</span>${sw && label && label !== 'At hand' ? '<span class="l" style="margin-left:auto;padding-right:44px">Weight</span>' : ''}</div>`;
// a row: name, quantity, what is said under it, its weight, the chevron. As built the weight is under the name with its unit; swept it is a figure at the right (the unit is said once, on the load's line)
const row = (sw, name, o = {}) => `<div class="pk-row" role="button"><span class="t"><b>${name}</b>${o.q ? `<span class="q">×${o.q}</span>` : ''}${sw ? (o.sub ? `<small>${o.sub}</small>` : '') : `<small>${[o.sub, o.w !== undefined ? o.w + ' coins' : ''].filter(Boolean).join(', ')}</small>`}</span>${sw && o.w !== undefined ? `<span class="wt">${o.w}</span>` : ''}<span class="go" aria-hidden="true">${I.chev}</span></div>`;
const hand = (name, act) => `<div class="pk-row"><span class="t"><b>${name}</b><small>${G.star}In hand</small></span><span class="btn">${act}</span></div>`;
const fold = (sw, title, lines, open) => `<div class="pk-fold" role="button" aria-expanded="${!!open}"><span class="t"><b>${title}</b>${(sw && open ? [] : lines).map((l) => `<small>${l}</small>`).join('')}</span>${sw && open ? '<span class="l" style="font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Weight</span>' : ''}${sw ? foldMark(open) : `<span class="btn sq" aria-hidden="true">${open ? I.minus : I.plus}</span>`}</div>`;
const wait = `<div class="pk-wait" role="button"><span class="t">${warn('1 item waiting for the GM')}<small>Strange brass key</small></span><span class="go" style="display:inline-flex;transform:rotate(-90deg)" aria-hidden="true">${I.chev}</span></div>`;
const pfoot = (say, btn = 'Add item') => `<div class="pk-foot"><span class="say">${say}</span><span class="btn accent">${btn}</span></div>`;
const STASH = ['3 items: Bundle of reeds ×8, Silver ewer, Week of fen rations ×2'];
const hands = (sw) => `${gh(sw, 'At hand', '2 items')}${hand('Reed spear', 'Attack')}${hand('Storm lantern', 'Light')}`;
const worn = (sw) => `${gh(sw, 'Worn and in hand', '1 item')}${row(sw, 'Waxed coat', { sub: 'Worn', w: 150 })}`;
const basket = (sw) => `${gh(sw, 'In the reed basket', '2 items', 'reed basket')}${row(sw, 'Dry rations', { q: 3, w: 60 })}${row(sw, 'Eel hooks', { q: 12, w: 12 })}`;
const carried = (sw, more = '') => `${row(sw, 'Bog sling', { w: 5 })}${more}${row(sw, 'Coil of reed rope', { w: 50 })}${row(sw, 'Glow wand', { w: 10 })}${row(sw, 'Reed basket', { w: 20 })}${row(sw, 'River pearls', { q: 6, w: 6 })}`;
const tiny = (sw) => fold(sw, 'Tiny things', ['1 item: Reed whistle', 'They don’t count']);
const lists = (sw) => `${hands(sw)}${worn(sw)}${basket(sw)}${gh(sw, 'Carried', '5 items')}${carried(sw)}${tiny(sw)}${wait}${fold(sw, 'Party stash', STASH)}`;
