// Fewer links (fl-1, 2026-11-03): actions are buttons; underlined text only goes somewhere (the back link, a link
// inside a sentence, a "… ›") or is a help line (Help me choose). These checks read every screen's source in src/, so
// a new underlined action anywhere in the app fails here, not only on the screens the gallery draws.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

function walk(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, ext);
    return path.endsWith(ext) ? [path] : [];
  });
}
const read = (paths) => paths.map((path) => [relative(SRC, path).replace(/\\/g, '/'), readFileSync(path, 'utf8')]);
const tsx = read(walk(SRC, '.tsx').filter((path) => !path.endsWith('.test.tsx')));
const css = read(walk(SRC, '.css'));

/** Each `button-quiet` in a file: its label (the text up to the closing tag), its opening tag and its line. */
function quietButtons(text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    if (!/className=.*\bbutton-quiet\b/.test(line) && !/^\s*className="button-quiet/.test(line)) return;
    let j = i;
    while (j < lines.length && !/>\s*$/.test(lines[j].replace(/=>/g, ''))) j++;
    const opening = lines.slice(i, j + 1).join(' ');
    const body = [];
    for (let k = j + 1; k < lines.length && !/<\/(button|label)>/.test(lines[k]); k++) body.push(lines[k].trim());
    found.push({ label: body.join(' ').trim(), opening, line: i + 1 });
  });
  return found;
}

/** Why an underlined button is allowed (fl-1), or null when its label is an action. */
function allowed(path, label, opening) {
  if (/[‹›]/.test(label)) return 'goes somewhere';
  if (/^Back( to |$)/.test(label) || /aria-label="Back"/.test(opening)) return 'the back link';
  // The campaign's back link on the standard bar (plan m5b-players-screens-standard A1): "‹ [sigil] <campaign>".
  if (label === '<CampaignBack {...campaign} />') return 'the back link';
  if (label === 'Help me choose') return 'a help line';
  // ("Run by hand ›" on a rule row is a "… ›" link since 2026-11-05: no exception of its own.)
  // − and + on a pack row: controls drawn without the underline (PackScreen.css), not links.
  if (/aria-label=\{?[`"]One (fewer|more)/.test(opening)) return 'a stepper';
  // "Create campaign now keeps the defaults for the steps left.": a link inside a sentence.
  if (path.endsWith('CampaignSetupSteps.tsx') && label === 'Create campaign now') return 'a link inside a sentence';
  // "3 more rows. Show all 8" on a rumour table: ruled a link (rm-2, docs/design/rulings/dec-evening-2026-11-14.md;
  // page 19's TW9), a link inside a sentence.
  if (path.endsWith('CallsToAdventure.tsx') && label === '{`Show all ${table.rows.length}`}') return 'a link inside a sentence (rm-2)';
  // Opens the table a secret roll used: going somewhere.
  if (path.endsWith('RequestCard.tsx') && label.startsWith('{`Open the table:')) return 'goes somewhere';
  // The GM's place page's trail (rg-1; page 11, approved pg-1, 2026-11-13): each place up it is drawn as a link and a
  // tap takes the party there, as the old "Part of …" did (dec-7 piece 5b).
  if (path.endsWith('GmPlacePage.tsx') && label === '{numberedName(p.key, p.name)}') return 'the trail: a place up it, where the party goes';
  // The waiting encounter's card (S8b; page 16 T2, 06-03; the lead's ruling of 2026-11-15, the View button gone): what
  // was rolled is a link that opens its creature's stat block, or the encounter's details, in the pop-up: going
  // somewhere, nothing started.
  if (path.endsWith('EncounterWaiting.tsx') && label === '{card.hit.rowText}') return 'goes somewhere (06-03)';
  // "+ Map from the pack / or choose a file…" after a failed fetch of the pack's picture (Francis, 2026-11-25, B14's
  // re-audit, "I take your recommendations"): the quiet second way, read as the end of the button's sentence.
  if (path.endsWith('MapParts.tsx') && label === 'or choose a file…') return "the retry's sentence, its second way (2026-11-25)";
  return null;
}

describe('fewer links (fl-1): no action is drawn as underlined text', () => {
  it('every quiet (underlined) button goes somewhere or is a help line, never an action', () => {
    const actions = tsx.flatMap(([path, text]) =>
      quietButtons(text)
        .filter((b) => !allowed(path, b.label, b.opening))
        .map((b) => `${path}:${b.line} ${b.label}`),
    );
    expect(actions).toEqual([]);
  });

  it('the check sees the quiet buttons that are allowed (so it is reading the screens at all)', () => {
    const kept = tsx.flatMap(([path, text]) => quietButtons(text).filter((b) => allowed(path, b.label, b.opening)));
    expect(kept.length).toBeGreaterThan(20);
  });

  // Gate walk 2026-11-05 (Francis): "Run by hand · the app doesn't apply this yet" was all underlined. Only
  // "Run by hand ›" is the link now; the words beside it are plain text, not part of any quiet button.
  it('a rule row’s run-by-hand mark is a "Run by hand ›" link, its "doesn’t apply" words outside the button', () => {
    const rows = tsx.find(([path]) => path.endsWith('ui/ruleRows.tsx'))[1];
    const labels = quietButtons(rows).map((b) => b.label);
    expect(labels).toContain('Run by hand ›');
    expect(labels.filter((l) => /MANUAL_WORDS|doesn.t apply/.test(l))).toEqual([]);
  });

  it('it catches an action drawn as a quiet button', () => {
    const sample = '<button type="button" className="button-quiet" onClick={onCancel}>\n  Cancel\n</button>';
    const found = quietButtons(sample);
    expect(found.map((b) => b.label)).toEqual(['Cancel']);
    expect(allowed('src/app/Sample.tsx', found[0].label, found[0].opening)).toBeNull();
  });

  it('the retired quiet danger style is gone: a destructive action is a button with its word', () => {
    const uses = [...tsx, ...css].filter(([, text]) => text.includes('button-quiet--danger')).map(([path]) => path);
    expect(uses).toEqual([]);
  });

  it('no other style underlines a button, except the ones listed here with their reason', () => {
    // Each underlined selector, and why it may stay; anything new is added here on purpose, with its ruling.
    const ALLOWED = new Map([
      ['.button-quiet', 'the back link and help lines (fl-1)'],
      // fl-5 (2026-11-04, design/rulings/m5b-fewer-links-2-2026-11-04.md): a dotted underline on a heading you tap
      // to edit or open is allowed: the campaign's name (rename) and the time strip's mode · turn (the procedure).
      ['.time-strip__title-button', "a heading tapped to open the procedure (B5, B14): dotted, allowed by fl-5"],
      ['.campaign-heading__name', "a heading tapped to rename the campaign: dotted, allowed by fl-5"],
      ['.derived-fields__label', 'a derived field’s label that opens its explanation: a help line'],
      // st-2 (2026-11-14, page 16 T3a, approved st-8): while the date is unset, the band's date line is itself the tap
      // that sets it, drawn underlined ("Day 1. Set the date").
      ['.scene-band__date-line--tap', "the band's unset date line, the tap that sets it (st-2, drawn on page 16 T3a)"],
      // fl-5: the toast's Undo is the toast's own control, not a link.
      ['.toast__undo', "the toast's own control (Undo), allowed by fl-5"],
      // dec-10 F-b: a stock row's name goes to the thing's entry (fl-1 allows underlined text that goes somewhere).
      ['.stock-row__name', "a thing's name that opens its entry (cs-21, 21-F5): the link style"],
      // ds-6a (plan dec-9 piece B): "About this app" names each licence "as a link", a real <a href> inside the
      // row's sentence.
      ['.about__link', "a licence's name, a real link inside a sentence (ds-6a, fl-1)"],
      // S8b (page 16 T2, 06-03; the lead's ruling of 2026-11-15): what a waiting encounter rolled, a link inside the
      // card's line that opens its creature or the encounter's details.
      ['.waiting-encounter__link', "what a waiting encounter rolled, opening its creature (06-03): a link inside a sentence"],
      // S19 (ap-11, ic-2; page 16 T11): the end card's Undo, kept in its head until Done, is the app's Undo as the
      // toast draws it: the turned-back arrow and the underlined word.
      ['.end-card__undo', "the end card's Undo, the app's Undo as the toast's (ap-11, ic-2)"],
      // p2p-10 (2026-11-18; page 23, LA1, approved 2026-11-18; plan scene-point-to-point B3): a word of a place's
      // description that names another of its pieces is bold and underlined, in the book's format. Not a control: it
      // sits inside the piece's own row.
      ['.place-page__named', "a description's word naming another piece, bold and underlined (p2p-10, LA1)"],
      // The players' card (P4; page 24, PL1b, approved 2026-11-18): the same mark, only once the piece it names is shown.
      // Not a control: a paragraph's words.
      ['.players-place__named', "a description's word naming a shown piece, bold and underlined (p2p-24, PL1b)"],
    ]);
    const underlined = css.flatMap(([path, text]) =>
      [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter(([, , body]) => /text-decoration:\s*underline/.test(body))
        .flatMap(([, selectors]) => selectors.split(',').map((s) => s.trim()))
        .filter((selector) => ![...ALLOWED.keys()].some((ok) => selector.endsWith(ok)))
        .map((selector) => `${path}: ${selector}`),
    );
    expect(underlined).toEqual([]);
    // And the check reads the styles at all.
    expect(css.some(([, text]) => /\.button-quiet\s*\{[^}]*underline/.test(text))).toBe(true);
  });
});
