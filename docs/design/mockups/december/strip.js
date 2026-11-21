// The Sequence of play strip: a reminder of the procedure in force, with no heading and no state. Load after icons/icons.js.
const remStep = (mark, name, tap) => `<div class="step${tap ? ' tap' : ''}" ${tap ? 'role="button"' : 'role="img"'} aria-label="${name}${tap ? ': read it' : ''}"><span class="sc">${mark}</span><span class="nm">${name}</span></div>`;
/* no heading: ruled */ const remRow = (title, steps, extras = []) => `<div class="rem" style="margin-top:var(--space-3)" role="group" aria-label="${title}">${steps.join('<span class="lnk"></span>')}<span class="gap"></span>${extras.length ? `<span class="ctl">${extras.join('')}</span>` : ''}</div>`;
const GK = { describe: 'trumpet', clarify: 'ball', act: 'sword-brandish', judge: 'wizard', resolve: 'chest' };
const defSteps = ['describe', 'clarify', 'act', 'judge', 'resolve'].map((k) => remStep(gi(GK[k], 32), k[0].toUpperCase() + k.slice(1), false));
