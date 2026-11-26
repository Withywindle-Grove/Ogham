// The entries the ⓘ opens, drawn from the built sheets (the Builder's pictures of 2026-11-12, creation-as-built): the build's parts and order,
// dressed in the book format as the class's entry is (labelled lines for single values, sub-headings over lists, the source last, "Pick" at the right).
// Shared by pages 18, 20 and 21 of creation's style sweep. Load after final.js. Every name starts with "en". All words and numbers are invented.
const EN_CHK = 'Checked against the built screen’s picture (creation-as-built on the pictures branch).';
const enX = `<span class="btn sq" role="button" aria-label="Close" style="border:0;background:transparent">${I.close}</span>`;
const enLn = (l, v) => `<p class="ln"><span class="lb">${l}</span>${v}</p>`;
const enTier = (l, v) => `<p class="ln" style="margin-left:var(--space-4)"><span class="lb">${l}</span>${v}</p>`;
const enList = (items) => `<ul style="margin:0 0 var(--space-2);padding-left:var(--space-4)">${items.map(([b, t]) => `<li><b>${b}.</b> ${t}</li>`).join('')}</ul>`;
const enSrc = (p) => `<p class="source">From your setting’s rules: River Rules, p. ${p}.</p>`;
// the phone's sheet over its dimmed step
const enSheet = (barTitle, head, body, h, btn = '<span class="btn accent">Pick</span>') => `${bar(barTitle)}<div class="inner" style="min-height:${h}px"></div><div class="dim"></div><div class="sheetup" style="max-height:none"><div class="head"><span class="ehead">${head}</span>${enX}</div><div class="bk">${body}</div><div class="efoot">${btn}</div></div>`;
// the tablet's pane: an X, the same parts, a plain button (the screen's accent is Next)
const enPane = (head, body, btn = '<span class="btn">Pick</span>') => `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-2);margin-bottom:var(--space-2)"><span class="ehead">${head}</span>${enX}</div><div class="bk">${body}</div><div class="efoot">${btn}</div></div>`;
// ---- a kindred ----
const enKindredBody = `<p>Short, strong, and at home in the dark.</p>
  ${enLn('Requirement', 'Needs Grit 9, you have 13 ✓')}${enLn('Languages', 'Marsh-common, Stone-speech')}
  <h4>Advantages</h4>${enList([['Dark sight', 'Sees in the dark to 60 feet'], ['Stone sense', `Notices new stonework on ${die(6, 16)}2 in 6`]])}
  <h4>Disadvantages</h4>${enList([['Heavy', 'Swims at half speed']])}
  <h4>Open classes</h4><div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-2)">${['Lantern Warden (to 12)', 'Reed Witch (to 8)', 'Fen Ranger (to 10)', 'Keeper of the Nine Drowned Bells below the Old Lantern (to 6)'].map((c) => `<span class="btn small" style="white-space:normal;text-align:left">${c}</span>`).join('')}</div>
  ${enSrc(40)}`;
// ---- a patron: the god's whole description; nothing marked "to come" at creation ----
const enPatronBody = `<p class="dsc">Light in the dark water</p>
  <p style="margin-top:var(--space-1)">The Lantern Keeper walks the dark water with a light for anyone lost on it. Its chaplains keep the marsh lamps and turn no traveller away.</p>
  ${enLn('Depiction', 'A tall figure in a grey hood, a lamp held high')}${enLn('Who follows', 'Marsh Chaplains; Reed or Lantern in alignment')}${enLn('Holy symbol', 'A tin lantern on a cord')}
  ${enLn('Holy garb', '')}${enTier('At creation', 'A grey hood')}${enTier('From level-2 spells', 'A heron-feather stole')}
  ${enLn('Strictures', 'Never leave a flame to die untended')}${enLn('Prayer', 'Keep the lamp lit')}
  ${enLn('Marks', '')}${enTier('At creation', 'Your eyes catch the lamplight')}
  ${enLn('Realm', 'The Long Causeway, between the last house and the first star')}
  ${enSrc(52)}`;
// ---- a spell ----
const enSpellBody = `${enLn('Level', '1')}${enLn('Range', 'Touch')}${enLn('Duration', '6 turns')}${enLn('Saves', 'Grit')}
  <p style="margin-top:var(--space-2)">The one touched grows slick as an eel. Ropes, nets and grasping hands slide off, and they pass through any gap their head fits.</p>
  ${enSrc(58)}`;
// ---- a weapon ----
const enWeaponBody = `<p>An ash shaft with a leaf of iron.</p>
  ${enLn('Qualities', 'Melee, thrown')}${enLn('Damage and use', `${die(6, 16)}1d6, melee`)}${enLn('Cost', '3 silver')}${enLn('Weight', '30 coins’ weight, 1 slot')}
  ${enSrc(86)}`;
// ---- a kit not yet taken ----
const enKitBody = `${enLn('About', 'Everything a ferryman carries on the long crossings.')}${enLn('Worn and held', 'Ferry pole, oilskin')}${enLn('Carried', 'Reed basket')}${enLn('In the reed basket', 'Storm lantern, dry rations ×7')}${enLn('Cost', '20 silver')}
  ${enSrc(33)}`;
// ---- rows on the steps ----
// a spell's row: the ⓘ, the name and Pick; the blurb; then the build's line (level, duration, range); the source is in the entry
const enSpell = (name, blurb, line, state) => irow(name, blurb, state, `<div class="under">${line}</div>`);
const enGiven = (name, blurb, line) => `<div class="card picked"><div class="prow"><span class="i" role="button" aria-label="About ${name}">${I.info}</span><div class="text">${name}</div><span class="giv">Given</span></div><div class="under">${blurb}</div>${line ? `<div class="under">${line}</div>` : ''}</div>`;
// a heading with its count beside it, as built
const enHead = (words, count, aside) => `<h3 class="sec">${words}${count ? `<span class="meta" style="font-weight:400;margin-left:var(--space-2)">${count}</span>` : ''}${aside ? `<span class="meta" style="font-weight:400;margin-left:var(--space-2)">${aside}</span>` : ''}</h3>`;
// "Other…": a dashed row that adds something the list does not have ("+" is for adding)
const enOther = (words) => `<div class="card" style="border-style:dashed;display:flex;justify-content:space-between;align-items:center;gap:var(--space-2)"><span><b>Other…</b><div class="under">${words}</div></span><span class="btn sq" role="button" aria-label="Add another">${I.plus}</span></div>`;
