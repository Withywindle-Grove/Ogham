// Shared pieces for the December mockups (2026-11-12), loaded after ../creation/final/final.js, ../scene/scene.js and ../scene/scene-seq.js.
// Invented names only: a drowned harbour of five linked spots on an island. The parts are the Scene redesign's; the new variants are named in december.css.
const small = (w, o = {}) => b(/^Roll /.test(w) ? `<span class="die" role="img" aria-label="Die">${die(6, 20)}</span>${w}` : w, { small: true, ...o });
const band = ({ over, title, ident, acts = [] }) => `<div class="band"><div><div class="over">${over}</div><h3 class="display">${title}</h3><p class="ident">${ident}</p></div><div class="acts">${acts.join('')}</div></div>`;
// The eye (ruled 2026-11-12): open when shown, closed with lashes when hidden; no box, no word; a 44 px target; its state is read aloud.
SY.eyeshut = `<path d="M2.5 8c2.6 4.4 5.8 6.4 9.5 6.4s6.9-2 9.5-6.4" ${W}/><path d="M12 14.4v4.6M7.2 13.4l-1.7 3.8M16.8 13.4l1.7 3.8M3.9 10.4l-2.6 2.7M20.1 10.4l2.6 2.7" ${W}/>`;
const eyeBtn = (shown) => `<span class="eye${shown ? ' on' : ''}" role="switch" aria-checked="${!!shown}" aria-label="${shown ? 'Shown to the players' : 'Hidden from the players'}">${sym(shown ? 'eye' : 'eyeshut', 28)}</span>`;

// the Scene's title band and facts in a place explored by turns
const turnBand = (role = 'gm') => `${band({ over: 'Session 1. Saltwick Island.', title: 'The Drowned Harbour, turn 14', ident: '14 Reedmonth, spring. Two hours of light left.', acts: role === 'gm' ? [b('Next turn', { big: true, icon: 'clock' }), `<span class="btn sq" role="button" aria-label="More">${I.more}</span>`] : [] })}<hr class="dbl">`;
const FL = { 1: '<path d="M0 6h78" ' + W + '/><path d="M86 2l4 4-4 4-4-4z" ' + W + '/>', 2: '<path d="M2 6c12-9 22 9 34 0s22-9 34 0 12 4 22 0" ' + W + '/>', 3: '<circle cx="20" cy="6" r="1" fill="currentColor"/><circle cx="44" cy="6" r="1.5" fill="currentColor"/><circle cx="68" cy="6" r="2" fill="currentColor"/><path d="M84 2l4 4-4 4-4-4z" fill="currentColor"/>' };
const flair = (k, r) => `<svg class="fl${r ? ' r' : ''}" viewBox="0 0 92 12" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">${FL[k]}</svg>`;
/* the players' Encounter check: a badge. how = 'b1' (a rule and a diamond; the pick), 'b2' (a ring and a swash), 'b3' (dots), 'b' (plain, as first drawn), 'a' (a full card), 'c' (not in the row) */
const encFact = (how) => how === 'a' ? fact('encounter', 'Encounter check', 'Your GM’s', 'You are told if one comes.') : how === 'c' ? '' : how === 'b' ? `<div class="fact badge" aria-label="Encounter check"><span class="fi">${sym('encounter', 28)}</span><span class="s">Encounter check</span></div>` : `<div class="fact badge" aria-label="Encounter check"><span class="orn">${flair(how.slice(1))}${how === 'b2' ? `<span class="ring">${sym('encounter', 28)}</span>` : `<span class="mk">${sym('encounter', 40)}</span>`}${flair(how.slice(1), true)}</span><span class="nm">Encounter check</span></div>`;
/* the players' row carries four facts; the Encounter check is the badge (Francis, 2026-11-12) */
/* M: one Encounter check fact for the GM and the players: the label, the when on one line, the die and the chance */
const encNow = (phone) => fact('encounter', 'Encounter check', 'On every move', `<span class="die" role="img" aria-label="Die">${die(6, 16)}</span>1 in 6`).replace('class="v"', `class="v" style="font-size:${phone ? 14 : 20}px;white-space:nowrap"`);
const turnFacts = (role = 'gm', how = 'now', o = {}) => `<div class="facts${how === 'c' && !o.phone ? ' three' : ''}${o.fit ? ' pf' : ''}"${o.phone && !o.fit ? ' style="grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-2)"' : ''}>${fact('weather', 'Weather', 'Drizzle', 'Wet.')}${fact('flame', 'Light', 'Ash’s torch', '4 turns left.')}${o.phone && how === 'c' ? fact('rest', 'Rest', 'In 4 turns', 'One turn in six.').replace('class="fact', 'style="grid-column:span 2" class="fact') : fact('rest', 'Rest', 'In 4 turns', 'One turn in six.')}${how === 'now' ? encNow(o.phone) : encFact(how)}</div>`;
const harbourBack = () => `${turnBand()}${turnFacts()}<div class="cols2"><div class="pcard"><div class="crumb"><span>Saltwick Island</span>${svg(SY.right, 16)}<b>The Drowned Harbour</b></div><h3 class="display">The Drowned Harbour</h3><p class="ident">A silted harbour of five spots, crossed by boat or by swimming.</p></div><div></div></div>`;

// the line that says which encounter check is in force, and whose (rg-4)
const inForce = (detail, on = true) => `<div class="inforce tgl${detail ? ' detail' : ''}"><span role="button"><b>Encounter check: on every move, ${dieMark(6)}1 in 6.</b><small>The Drowned Harbour’s own rule, in place of River Rules’ check every second turn.</small></span>${tg(on, { label: 'The harbour’s encounter check: in force here' })}${detail ? `<span class="more">${small('See the setting’s rule')}</span>` : ''}</div>`;

const num = (name) => { const m = /^(\d+) (.*)$/.exec(name); return m ? `<span class="keyno">${m[1]}</span>${m[2]}` : name; };
const spot = (name, line, shown, here) => `<div class="spot${here ? ' cur' : ''}" role="button"><span><b>${here ? `<span class="pin" role="img" aria-label="The party is here">${sym('people', 16)}</span>` : ''}${num(name)}</b><small>${line}</small></span><span class="ctl">${eyeBtn(shown)}</span></div>`;
const spotP = (name, line) => `<div class="spot" role="button"><span><b>${name}</b><small>${line}</small></span><span class="ctl">${svg(SY.right, 20)}</span></div>`;
const who = (name, line) => `<div class="spot" role="button"><span><b>${name}</b><small>${line}</small></span><span class="ctl">${svg(SY.right, 20)}</span></div>`;

// The rule of this place that stands in for the setting's (rg-4), with its toggle (ds-1), on by default. The name is the book's own heading.
const standIn = (on) => `<div class="standin2"><div class="top"><span class="nm" role="button">Encounters on the water</span>${tg(on, { label: 'Encounters on the water: in force here' })}</div><p>${on ? 'The Drowned Harbour’s own rule. It stands in for River Rules’ <a class="x">Wandering encounters</a> while the party is here.' : '<b style="color:var(--ink)">Not in force.</b> River Rules’ <a class="x">Wandering encounters</a> applies here again, until you switch this back.'}</p></div>`;
// a knowledge section: shared true or false carries the eye; null is the GM's only (the pack did not mark it shareable)
const section = (title, text, shared, when = '') => `<div class="ksec"><div><h4>${title}</h4><div class="rule">${text.startsWith('<') ? text : `<p>${text}</p>`}</div>${when ? `<div class="when">${when}</div>` : ''}</div>${eyeBtn(!!shared)}</div>`;
// a rule's row: its own button where the pack gives it one; a pill where it is the rule in force
const ruleItem = (name, line, button = '', pill = '') => `<div class="opt" role="button"><span>${I.info}</span><span class="ot"><b>${name}</b><small>${line}</small></span>${pill ? `<span class="forcepill">${sym('check', 16)}${pill}</span>` : ''}${button ? actIcon(button, 'water') : svg(SY.right, 20)}</div>`;
// a destination with each way of getting there: [how, how long]
const dest = (name, line, ways, hidden = '') => `<div class="dest"><div class="dh"><b>${name}</b>${hidden ? `<span class="meta" style="display:inline-flex;align-items:center;gap:var(--space-1)">${sym('eyeshut', 16)}${hidden}</span>` : ''}</div><small>${line}</small>${ways.map(([how, long]) => `<div class="way" role="button"><span>${how}</span><span class="t">${long}</span>${svg(SY.right, 20)}</div>`).join('')}</div>`;

// The map: a stand-in drawing of a harbour with its key in the picture (the pack supplies the real one). Its greys are its own, not tokens.
const mapPic = (big, vb = '0 0 760 400') => {
  const tagAt = (n, x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="#f4f1e8" stroke="#222" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="700" fill="#222">${n}</text>`;
  const key = ['1 The jetty', '2 The wreck', '3 The breakwater', '4 The customs shed', '5 The sea cave'].map((t, i) => `<text x="596" y="${268 + i * 20}" font-family="Georgia, serif" font-size="14" fill="#222">${t}</text>`).join('');
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid ${vb === '0 0 760 400' ? 'meet' : 'slice'}" role="img" aria-label="A stand-in map of the harbour, with its key">
    <rect width="760" height="400" fill="#8f9a98"/>
    <path d="M 0,0 L 760,0 L 760,120 C 640,110 600,170 520,150 C 430,128 380,60 250,90 C 150,112 90,70 0,110 Z" fill="#d9d2bf" stroke="#222" stroke-width="1.5"/>
    <path d="M 0,400 L 0,330 C 80,300 150,340 230,330 C 300,322 330,372 420,400 Z" fill="#d9d2bf" stroke="#222" stroke-width="1.5"/>
    <path d="M 330,250 L 520,222" stroke="#d9d2bf" stroke-width="16" stroke-linecap="round"/><path d="M 330,250 L 520,222" stroke="#222" stroke-width="1.2" stroke-dasharray="26 12" fill="none"/>
    <path d="M 250,90 L 262,170" stroke="#222" stroke-width="7"/><path d="M 392,300 l 44,-14 l 6,12 l -44,14 z" fill="#5c5a52" stroke="#222"/>
    <rect x="540" y="112" width="34" height="24" fill="#a9a493" stroke="#222"/><path d="M 700,230 q 26,-30 52,0" fill="#5c5a52" stroke="#222"/>
    <path d="M 262,170 C 300,230 360,270 414,292 M 262,170 C 330,190 400,214 428,232 M 262,170 C 380,150 480,140 540,130 M 428,232 C 560,236 660,236 712,228" stroke="#f4f1e8" stroke-width="1.6" stroke-dasharray="5 6" fill="none"/>
    ${tagAt(1, 262, 178)}${tagAt(2, 414, 296)}${tagAt(3, 428, 234)}${tagAt(4, 557, 124)}${tagAt(5, 716, 222)}
    <rect x="582" y="244" width="166" height="130" fill="#f4f1e8" stroke="#222" stroke-width="1.5"/>${key}
    <text x="14" y="388" font-family="Georgia, serif" font-size="13" font-style="italic" fill="#f4f1e8">A stand-in picture: not the app’s colours.</text></svg>`;
};

// The toggle (ds-1): a choice that is simply on or off and acts at once. Its meaning is always in words beside it; the tick and the cross are its shape.
const tg = (on, o = {}) => `<span class="tg${on ? ' on' : ''}${o.focus ? ' focus' : ''}${o.busy ? ' busy' : ''}${o.wash ? ' wash' : ''}${o.ink ? ' ink' : ''}" role="switch" aria-checked="${!!on}" aria-label="${o.label || ''}"${o.busy ? ' aria-busy="true"' : ''}><span class="tr"><span class="kn">${svg(on ? SY.check : '<path d="M7 7l10 10M17 7L7 17" ' + W + '/>', 14)}</span></span></span>`;
const tgRow = (title, sub, on, o = {}) => `<div class="tgrow" role="group"><span><b>${o.link ? `<a class="x nmtap" role="button" aria-label="${title}: read its entry">${title}</a>` : title}</b><small>${dz(sub)}</small>${o.under ? `<span style="display:block;margin-top:var(--space-1)">${o.under}</span>` : ''}</span><span class="side">${o.price ? `<span class="price">${o.price}</span>` : ''}${tg(on, { ...o, label: title })}</span></div>`;

// Two more stand-in maps for the "what if the map is large" frames: a whole city with thirty tags and a key strip (2900 by 2400), and a long, narrow coast (3600 by 1200).
// vb is the part of the picture shown ("x y w h"), so one drawing serves the fitted view and a zoomed one. Stand-ins: their greys are their own, not tokens.
const cityMap = (vb = '0 0 2900 2400', fit = 'meet') => {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const blocks = [];
  for (let gx = 0; gx < 44; gx += 1) for (let gy = 0; gy < 46; gy += 1) { const x = 420 + gx * 44 + rnd() * 10, y = 150 + gy * 46 + rnd() * 10; const d = Math.hypot(x - 1350, y - 1250); if (d > 980 + rnd() * 120 || rnd() < 0.12) continue; blocks.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(26 + rnd() * 12).toFixed(0)}" height="${(26 + rnd() * 14).toFixed(0)}" fill="#a9a493" stroke="#222" stroke-width="2" transform="rotate(${(rnd() * 16 - 8).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`); }
  const tags = [], key = [];
  for (let i = 1; i <= 30; i += 1) { const a = i * 2.4, r = 180 + (i * 137) % 700, x = 1350 + Math.cos(a) * r, y = 1250 + Math.sin(a) * r * 0.95; tags.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="30" fill="#f4f1e8" stroke="#222" stroke-width="4"/><text x="${x.toFixed(0)}" y="${(y + 11).toFixed(0)}" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#222">${i}</text>`); key.push(`<text x="2460" y="${200 + i * 66}" font-family="Georgia, serif" font-size="38" fill="#222"><tspan font-weight="700">${i}</tspan>  A place with a name</text>`); }
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid ${fit}" role="img" aria-label="A stand-in map of a whole city, with thirty numbered places and its key"><rect width="2900" height="2400" fill="#d9d2bf"/><path d="M 0,700 C 220,760 330,1000 300,1300 C 280,1600 420,1900 520,2400 L 0,2400 Z" fill="#8f9a98" stroke="#222" stroke-width="3"/><path d="M 2400,300 C 2000,500 1700,700 1500,1050 C 1300,1350 900,1500 320,1400" fill="none" stroke="#8f9a98" stroke-width="60"/><circle cx="1350" cy="1250" r="1040" fill="none" stroke="#222" stroke-width="12"/>${blocks.join('')}${tags.join('')}<rect x="2420" y="0" width="480" height="2400" fill="#f4f1e8" stroke="#222" stroke-width="4"/><text x="2460" y="150" font-family="Georgia, serif" font-size="70" font-weight="700" fill="#222">Key</text>${key.join('')}<text x="40" y="2360" font-family="Georgia, serif" font-size="40" font-style="italic" fill="#f4f1e8">A stand-in picture: not the app’s colours.</text></svg>`;
};
const coastMap = (vb = '0 0 3600 1200', fit = 'meet') => {
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const huts = []; for (let i = 0; i < 160; i += 1) { const x = 80 + rnd() * 2900, y = 150 + rnd() * 380 + Math.sin(x / 400) * 60; huts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="30" height="24" fill="#a9a493" stroke="#222" stroke-width="2"/>`); }
  const tags = [], key = []; for (let i = 1; i <= 12; i += 1) { const x = 140 + i * 235, y = 420 + Math.sin(i) * 120; tags.push(`<circle cx="${x}" cy="${y.toFixed(0)}" r="28" fill="#f4f1e8" stroke="#222" stroke-width="4"/><text x="${x}" y="${(y + 10).toFixed(0)}" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="700" fill="#222">${i}</text>`); key.push(`<text x="3180" y="${150 + i * 78}" font-family="Georgia, serif" font-size="36" fill="#222"><tspan font-weight="700">${i}</tspan>  A place</text>`); }
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid ${fit}" role="img" aria-label="A stand-in map of a long coast, with twelve numbered places and its key"><rect width="3600" height="1200" fill="#d9d2bf"/><path d="M 0,700 C 600,600 1200,820 1800,720 C 2400,620 3000,800 3600,700 L 3600,1200 L 0,1200 Z" fill="#8f9a98" stroke="#222" stroke-width="3"/><path d="M 0,560 C 600,460 1200,660 1800,580 C 2400,500 2900,640 3140,590" fill="none" stroke="#f4f1e8" stroke-width="8" stroke-dasharray="24 18"/>${huts.join('')}${tags.join('')}<rect x="3140" y="0" width="460" height="1200" fill="#f4f1e8" stroke="#222" stroke-width="4"/><text x="3180" y="110" font-family="Georgia, serif" font-size="60" font-weight="700" fill="#222">Key</text>${key.join('')}</svg>`;
};
const MAG = '<circle cx="10.5" cy="10.5" r="6.5" ' + W + '/><path d="M15.5 15.5l4.5 4.5" ' + W + '/>';
const zoomOut = () => `<span class="btn sq" role="button" aria-label="Zoom out">${svg(MAG + '<path d="M8 10.5h5" ' + W + '/>', 24)}</span>`;
const zoomIn = () => `<span class="btn sq" role="button" aria-label="Zoom in">${svg(MAG + '<path d="M8 10.5h5M10.5 8v5" ' + W + '/>', 24)}</span>`;
const zoomCtl = (pct, fitted) => `<div class="zoomctl" role="group" aria-label="Zoom"><span class="zpct">${pct}</span>${zoomOut()}${zoomIn()}${b('Fit', { small: true, on: fitted })}</div>`;

// one row a destination; each way of getting there is a mode on the row: [how, how long, proposed?]
// a mode's icon sits at the left of its word and time (ruled 2026-11-12, arrangement b); a mode with no icon keeps its word
const MODE_ICON = { Row: 'paddles', Swim: 'double-fish' };
const modeIcon = (how) => (typeof gi === 'function' && typeof GI === 'object' && GI[MODE_ICON[how]] ? gi(MODE_ICON[how], 26) : '');
const pdest = (to, sub, modes, o = {}) => `<div class="pdest${o.sel ? ' sel' : ''}${modes.length > 2 ? ' many' : ''}"><span>${sym('travel', 24)}</span><span class="ot"><b>${to}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="modes">${modes.map(([how, long, on]) => `<span class="btn mode${o.line ? ' line' : modes.some(([m]) => modeIcon(m)) ? (modeIcon(how) ? ' mb' : ' mb noi') : ''}${on ? ' on' : ''}" role="button"${on ? ' aria-pressed="true"' : ''}>${o.line ? '' : modeIcon(how)}<b>${on ? sym('check', 16) : ''}${how}</b><small>${long}</small></span>`).join('')}</span>${o.below ? `<span style="grid-column:1 / -1;display:flex;align-items:center;gap:var(--space-2);border-top:1px dotted var(--rule);padding-top:var(--space-2)"><span style="flex:1">${o.below}</span>${o.right || ''}</span>` : ''}</div>`;

/* a map that opens whole on a tap: no button; the strip under the picture says so and answers the pointer. o: cls, style, state ('' | 'hover' | 'press'), eye (html), thumb */
const mapOpen = (pic, words, o = {}) => `<div class="mapopen${o.bare ? ' bare' : ''}${o.state ? ' ' + o.state : ''}"><div class="${o.thumb ? 'mapthumb' : 'mapbody'}${o.cls ? ' ' + o.cls : ''}"${o.style ? ` style="${o.style}"` : ''} role="button" aria-label="Show the map whole">${pic}</div>${o.bare ? '' : `<div class="mrow">${o.zoom ? `<span class="mz">${zoomOut()}${zoomIn()}</span>` : ''}<div class="mcap${words ? '' : ' bare'}" role="button" aria-label="Show the map whole">${words ? `<span>${words}</span>` : ''}${svg('<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" ' + W + '/>', 20)}</div>${o.eye ? `<span class="meye">${o.eye}</span>` : ''}</div>`}</div>`;

/* a die beside a table's die size; a table's row with it */
const dieMark = (n = 6, w = 20) => `<span class="die" role="img" aria-label="Die">${die(n, w)}</span>`;
const dieRow = (name, size, rest = '') => `<div class="trow" role="button"><span>${sym('table', 20)}</span><span class="tn">${name}<small>${dieMark(Number(String(size).replace('d', '')))}${size}${rest ? '. ' + rest : ''}</small></span>${svg(SY.right, 20)}</div>`;
/* a rule's own action button: how = '' (the serif label and a mark), 'edge' (a stronger edge; the pick), 'tone' (a quiet fill) */
const actBtn = (words, how = '') => `<span class="btn act${how ? ' ' + how : ''}" role="button">${svg('<path d="M8 5l11 7-11 7z" ' + W + '/>', 16)}${words}</span>`;

/* I: the locate target ("where we are") and the row of map tools under a map card */
const locate = (on) => `<span class="btn sq${on ? ' on' : ''}" role="button" aria-label="Where we are" aria-pressed="${!!on}">${svg('<circle cx="12" cy="12" r="6" ' + W + '/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" ' + W + '/>', 24)}</span>`;
const mapTools = (after = '', more = '', title = '', narrow = false) => `<div class="maptools"><span class="mt${title.length > (narrow ? 14 : 22) ? ' s' : ''}">${title}</span>${zoomOut()}${zoomIn()}${more}${after}</div>`;

/* L: the marks a pack may name for a rule's own action button, and the icon button itself */
const ACT = {
  water: '<circle cx="12" cy="5" r="2" ' + W + '/><path d="M6 3l4 6v3M18 3l-4 6v3" ' + W + '/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0 2 1 2 1M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0 2 1 2 1" ' + W + '/>',
  fall: '<path d="M3 6h8v4" ' + W + '/><path d="M16 5v13M11.5 13.5L16 18l4.5-4.5" ' + W + '/>',
  fire: '<path d="M12 3c1 4 5 5.500 5 10.500a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500 0 2 1 3 2 3 0-3-1-5 1-9z" ' + W + '/>',
  poison: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" ' + W + '/><path d="M9.500 14h5M12 11.500v5" ' + W + '/>',
  trap: '<path d="M3 19h18M4 19l2-7 2.500 7 2.500-7 2.500 7 2.500-7 2 7" ' + W + '/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1" ' + W + '/><circle cx="15" cy="12" r="1.200" fill="currentColor"/>',
  climb: '<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8" ' + W + '/>',
  cold: '<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9" ' + W + '/>',
  dark: '<path d="M19 14.500A8 8 0 1 1 9.500 5a6.500 6.500 0 0 0 9.500 9.500z" ' + W + '/>',
  blow: '<path d="M12 3l2 5 5-2-2 5 4 3-5 1v5l-4-3-4 3v-5l-5-1 4-3-2-5 5 2z" ' + W + '/>',
  spell: '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" ' + W + '/>',
  start: '<path d="M8 5l11 7-11 7z" ' + W + '/>',
};
const actIcon = (words, mark = 'start', o = {}) => ACT[mark] && mark !== 'start'
  ? `<span class="btn sq acti${o.accent ? ' accent' : ''}" role="button" aria-label="${words}">${svg(ACT[mark], 24)}${o.tip ? `<span class="tipw" role="tooltip">${words}</span>` : ''}</span>`
  : `<span class="btn act edge" role="button">${svg(ACT.start, 16)}${words}</span>`;

/* N: puts a die's glyph before every die named in a line of words ("d6", "1 in 6") */
const dz = (s) => String(s).replace(/\bd(\d+)\b/g, (m, n) => dieMark(Number(n), 16) + m).replace(/\b(\d+ in (\d+))/g, (m, a, n) => dieMark(Number(n), 16) + a);

/* time's mark: a sand-glass in a wooden frame; the button that advances time in the unit of the mode the party is in */
const HG = '<path d="M5 3.500h14M5 20.500h14M6.500 3.500v17M17.500 3.500v17" ' + W + '/><path d="M9.500 5.500c0 3.500 2.500 4.500 2.500 6.500s-2.500 3-2.500 6.500M14.500 5.500c0 3.500-2.500 4.500-2.500 6.500s2.500 3 2.500 6.500" ' + W + '/><path d="M10.500 17.500h3" ' + W + '/>';
const timeBtn = (words, o = {}) => `<span class="btn sq acti" role="button" aria-label="${words}">${svg(HG, 24)}${o.tip ? `<span class="tipw" role="tooltip">${words}</span>` : ''}</span>`;

/* time has one mark: the hourglass from the icon set on every "Next …" time button (where the page loads icons/icons.js) */
{ const m0 = mount; mount = (html) => m0(typeof gi === "function" ? html.split(sym("clock", 24) + "Next ").join(gi("hourglass", 24) + "Next ") : html); }
// The marching order, at the bottom right of every Scene (Francis, 2026-11-12: "this is the logical place for it in the bottom right"). town: nobody carries a lit light by day in a town.
const partyOrder = (you, town) => orderCard([rank(1, [pc(town ? { ...ash, light: null } : ash, { lg: true }), pc(you ? { ...wren, you: true } : wren, { lg: true })]), rank(2, [pc(tam, { lg: true }), pc(bram, { lg: true })])], { say: town ? '' : 'One light lit: Ash’s torch, 4 turns.' }).replace(town ? '<div class="mo-say"></div>' : '~~', '');
