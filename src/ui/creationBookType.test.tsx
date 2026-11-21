// @vitest-environment jsdom
// The book's type inside character creation (dec-10 S2; cs-1, ts-1 to ts-3). Creation takes the book's type ahead of the
// rest of the app: its screens and the pop-ups opened from them are drawn in the book's faces through a scope that
// repoints the body and heading tokens; everything else, campaign setup included (it shares the step frame), keeps
// today's faces until the sweep.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreationLeave, CreationStep } from './creation.tsx';
import { Dialog } from './Dialog.tsx';

afterEach(cleanup);

const step = (
  <CreationStep title="Class" counter={{ at: 4, of: 12 }} why="Your trade as an adventurer." help={null} hint="Pick a class first." onBack={() => {}} onNext={() => {}}>
    <p>Lantern Warden</p>
  </CreationStep>
);

/** The CSS rule for a selector, as written in a stylesheet (its body between the braces). */
function rule(css: string, selector: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
}

describe('the book type inside creation (S2)', () => {
  it('a creation step inside the creation host sits in the book-type scope', () => {
    // Purpose: character creation's screens are drawn in the book's type, so the host marks everything it holds.
    render(<CreationLeave onLeave={() => {}}>{step}</CreationLeave>);
    expect(screen.getByText('Lantern Warden').closest('.book-type')).not.toBeNull();
  });

  it('a pop-up opened inside creation carries the book type too', () => {
    // Purpose: an entry or any other sheet opened from a creation step is drawn in the same type as the step, though
    // the pop-up is placed outside the step on the page.
    render(
      <CreationLeave onLeave={() => {}}>
        <Dialog label="Lantern Warden" onClose={() => {}}>
          <p>Keeps the marsh lamps.</p>
        </Dialog>
      </CreationLeave>,
    );
    expect(screen.getByText('Keeps the marsh lamps.').closest('.book-type')).not.toBeNull();
  });

  it('the step frame outside creation (campaign setup) and a pop-up outside it keep today’s type', () => {
    // Purpose: only creation changes faces now; campaign setup shares the step frame and must not change with it.
    render(
      <>
        {step}
        <Dialog label="Rules" onClose={() => {}}>
          <p>Elsewhere in the app.</p>
        </Dialog>
      </>,
    );
    expect(screen.getByText('Lantern Warden').closest('.book-type')).toBeNull();
    expect(screen.getByText('Elsewhere in the app.').closest('.book-type')).toBeNull();
  });

  it('the scope repoints the body and heading tokens to the book’s faces, headings bold', async () => {
    // Purpose: the scope uses the book tokens (Bitter for text, names and titles, ts-1) rather than naming a font, so
    // the sweep can later move the pair to the whole app in one change; the heading weight is one the face has (700).
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8');
    const body = rule(css, '.book-type');
    expect(body).not.toBeNull();
    expect(body).toContain('--font-body: var(--font-book-text);');
    expect(body).toContain('--font-heading: var(--font-book-text);');
    expect(body).toContain('--weight-heading: var(--weight-book-name);');
    expect(body).toContain('font-family: var(--font-body);');
    expect(body).not.toMatch(/Bitter|Alegreya/);
  });

  it('creation’s small-capitals labels take the book’s small-capitals face, not made-up capitals', async () => {
    // Purpose: ts-1 gives the small-capitals lines their own face (Alegreya Sans SC); inside creation each label drawn
    // in small capitals takes it, with the browser's made-up small capitals turned off (the review of #728).
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8');
    const at = css.indexOf('.book-type :is(');
    expect(at).toBeGreaterThan(-1);
    const selector = css.slice(at, css.indexOf('{', at));
    for (const label of ['.rolled-picks__head', '.entry-panel__row dt', '.trade-chips__head', '.creation-review__tiles-label', '.stat-tile__label', '.label']) expect(selector).toContain(label);
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    expect(body).toContain('font-family: var(--font-book-descriptor);');
    expect(body).toContain('font-weight: var(--weight-book-descriptor);');
    expect(body).toContain('font-variant: normal;');
  });

  it('a lone number box inside creation draws the face’s normal figures; the tiles keep theirs (cs-40b)', async () => {
    // Purpose: a single number field (a score, hit points, coin, age) reads like the words beside it, its 1 with its
    // foot; column-aligned figures stay where figures sit in columns (Francis, 2026-11-13, cs-40b).
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8');
    const at = css.indexOf('.book-type :is(.typed-stepper__input');
    expect(at).toBeGreaterThan(-1);
    const selector = css.slice(at, css.indexOf('{', at));
    expect(selector).toContain('.stepper__value');
    expect(selector).not.toContain('stat-tile');
    expect(css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))).toContain('font-variant-numeric: normal;');
  });

  it('under 600 px the review’s figures go two across, the saves stay three (cs-40a)', async () => {
    // Purpose: Bitter is wider than the face the tiles were sized for; two across keeps every word of a tile whole at a
    // phone's width (Francis, 2026-11-13, cs-40a). The saves' short tiles fit three across and stay so.
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toContain('@media (max-width: 599px) { .creation-review__tiles:not(.creation-review__tiles--saves) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }');
  });
});
