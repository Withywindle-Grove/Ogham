// @vitest-environment jsdom
// The Scene's band and facts row as parts (plan dec-9-the-whole-scene rows S1, S4 and S9; page 16, approved
// 2026-11-14): what they draw, what a tap does, and that they hold no button that does nothing.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fact } from '../modules/expedition/sceneTop.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { BandTool, BandTools, dueWords, FactsRow, FoldButton, isDue, lastLineShifts, NextTurnButton, SceneBand, SessionButton } from './SceneBand.tsx';
import { RestRule } from './RestPrompt.tsx';
import { useSceneTopOpen } from './sceneTopOpen.ts';

afterEach(cleanup);

/** The chevron's two strokes (a 24 px line icon): its point up, and its point down. */
const CHEVRON_UP = 'M6 15l6-6 6 6';
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

const fact = (f: Partial<Fact> & Pick<Fact, 'id' | 'label' | 'value'>): Fact => ({ sub: null, state: 'quiet', warn: false, die: null, ...f });

describe('the band (S1)', () => {
  // Purpose: the band draws the session line, the heading as the one heading that opens the procedure, and the date line with the light left.
  it('draws its lines, and the heading opens the procedure', () => {
    const onHeading = vi.fn();
    render(
      <SceneBand
        over="Session 1. Saltwick Island."
        heading="The Drowned Harbour, turn 14"
        onHeading={onHeading}
        date={{ icon: 'sprout', words: '14 Reedmonth, spring', light: '2 hours of light left.' }}
        actions={<NextTurnButton label="Next turn" accent={false} onTap={() => undefined} />}
      />,
    );
    expect(screen.getByText('Session 1. Saltwick Island.')).toBeTruthy();
    expect(screen.getByText('14 Reedmonth, spring')).toBeTruthy();
    expect(screen.getByText('2 hours of light left.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'The Drowned Harbour, turn 14' }));
    expect(onHeading).toHaveBeenCalledTimes(1);
  });

  // Purpose (T8a): the season's word sits apart from the date, so a phone can leave it to the icon; the stylesheet
  // hides it at phone width only.
  it('says the date whole on a tablet and without its season on a phone', async () => {
    render(<SceneBand over="Session 1." heading="The Drowned Harbour, turn 14" date={{ icon: 'sprout', words: '14 Reedmonth', season: 'spring', light: null }} actions={null} />);
    expect(document.querySelector('.scene-band__date-whole')!.textContent).toBe('14 Reedmonth, spring');
    expect(document.querySelector('.scene-band__date-short')!.textContent).toBe('14 Reedmonth');
    // The stylesheet shows one of the two: the whole date outside the phone's width, the short one inside it.
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    const css = fs.readFileSync('./src/app/SceneBand.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // Line endings either way (a Windows checkout writes CRLF).
    const at = /@media \(max-width: 599px\) \{\r?\n {2}\.scene-band \{/.exec(css)?.index ?? -1;
    const [wide, phone] = [css.slice(0, at), css.slice(at)];
    const hides = (text: string, part: string) => new RegExp(`\\.scene-band__date-${part}\\s*\\{\\s*display:\\s*none;`).test(text);
    expect([hides(wide, 'short'), hides(wide, 'whole')]).toEqual([true, false]);
    expect([hides(phone, 'whole'), /\.scene-band__date-short\s*\{\s*display:\s*inline;/.test(phone)]).toEqual([true, true]);
  });

  // Purpose: while the date is unset the date line is itself the tap that sets it ("Day 1. Set the date", st-2).
  it('makes the date line the tap while the date is unset', () => {
    const onSet = vi.fn();
    render(<SceneBand over="The Reed Marches" heading="No session yet" date={{ icon: null, words: 'Day 1', light: null, onSet }} actions={null} />);
    expect(screen.getByRole('heading', { name: 'No session yet' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Day 1. Set the date' }));
    expect(onSet).toHaveBeenCalledTimes(1);
  });

  // Purpose: the resumed line sits under the date ("Resumed: The Drowned Harbour, turn 14.").
  it('shows the resumed line under the date', () => {
    render(<SceneBand over="Session 2." heading="The Drowned Harbour, turn 14" date={{ icon: null, words: 'Day 3', light: null }} under="Resumed: The Drowned Harbour, turn 14." actions={null} />);
    expect(screen.getByText('Resumed: The Drowned Harbour, turn 14.')).toBeTruthy();
  });

  // Purpose: Next turn carries the hourglass and its words; it is the accent only when told so.
  it('draws Next turn with its icon, plain or as the accent', () => {
    const onTap = vi.fn();
    const { rerender } = render(<NextTurnButton label="Next turn" accent={false} onTap={onTap} />);
    const button = screen.getByRole('button', { name: 'Next turn' });
    expect(button.className).toContain('button-secondary');
    expect(button.querySelector('svg')).toBeTruthy();
    fireEvent.click(button);
    expect(onTap).toHaveBeenCalledTimes(1);
    rerender(<NextTurnButton label="Next turn" accent onTap={onTap} />);
    expect(screen.getByRole('button', { name: 'Next turn' }).className).toContain('button-primary');
  });

  // Purpose (ic-4, S17; page 16, T3a, T3b): the session button reads "Start" or "Resume" with the campfire beside it,
  // and is read aloud by its whole name, "Start session" or "Resume session".
  it('draws the session button as Start or Resume with the campfire', () => {
    const { rerender } = render(<SessionButton resume accent onTap={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Resume session' });
    expect(button.className).toContain('button-primary');
    expect(button.textContent).toBe('Resume');
    expect(button.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.campfire.d);
    rerender(<SessionButton resume={false} accent={false} onTap={() => undefined} />);
    const start = screen.getByRole('button', { name: 'Start session' });
    expect(start.textContent).toBe('Start');
    expect(start.className).toContain('button-secondary');
    expect(start.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.campfire.d);
  });
});

describe('the facts row (S4)', () => {
  // Purpose: each fact shows its label, its one-line value and its small line, and a tap opens that fact.
  it('draws each fact, and a tap opens it', () => {
    const onOpen = vi.fn();
    render(
      <FactsRow
        facts={[fact({ id: 'weather', label: 'Weather', value: 'Drizzle', sub: 'Wet.' }), fact({ id: 'check', label: 'Encounter check', value: 'On every move', sub: '1 in 6', die: 'd6' })]}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Weather/ }));
    expect(onOpen).toHaveBeenCalledWith('weather');
    expect(screen.getByText('On every move')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Encounter check/ }).querySelector('.die-glyph, svg')).toBeTruthy();
  });

  // Purpose: a due fact and a dark fact are told apart by their words and the warning sign, not by colour alone.
  it('marks a due fact and a dark one by class and by words', () => {
    render(
      <FactsRow
        facts={[fact({ id: 'rest', label: 'Rest', value: 'Rest due', state: 'due' }), fact({ id: 'light', label: 'Light', value: 'No light', state: 'dark', warn: true })]}
        onOpen={() => undefined}
      />,
    );
    const rest = screen.getByRole('button', { name: /Rest due/ });
    const light = screen.getByRole('button', { name: /No light/ });
    expect(rest.className).toContain('scene-fact--due');
    expect(light.className).toContain('scene-fact--dark');
    expect(light.textContent).toContain('No light');
    expect(light.querySelector('.scene-fact__warn svg')).toBeTruthy();
  });

  // Purpose: with no facts there is no row at all (before the first session).
  it('draws nothing with no facts', () => {
    const { container } = render(<FactsRow facts={[]} onOpen={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });

  // Purpose (Q4): during an expedition one, two or three facts take the centred variant; four facts, and the row
  // between expeditions (already centred), do not.
  it('names the few-facts variant for one to three facts during an expedition only', () => {
    const facts = (n: number) => (['weather', 'light', 'rest', 'check'] as const).slice(0, n).map((id) => fact({ id, label: id, value: 'Fair' }));
    for (const n of [1, 2, 3]) {
      const { container, unmount } = render(<FactsRow facts={facts(n)} onOpen={() => undefined} />);
      expect(container.querySelector('.scene-facts')!.className).toContain('scene-facts--few');
      unmount();
    }
    const four = render(<FactsRow facts={facts(4)} onOpen={() => undefined} />);
    expect(four.container.querySelector('.scene-facts')!.className).not.toContain('scene-facts--few');
    four.unmount();
    const between = render(<FactsRow facts={facts(2)} onOpen={() => undefined} centred />);
    expect(between.container.querySelector('.scene-facts')!.className).toBe('scene-facts scene-facts--centred');
  });

  // Purpose (Q4, the review of #110): when a fact comes or goes, the row still watches every tile it now holds (not a
  // tile that has gone), so a later text-size change re-counts the tracks and no tile is placed past the row's end.
  it('watches the tiles it holds after a fact comes or goes', () => {
    // Every live observer and what it watches (a tile's own value line has observers too; only the row's counts).
    const live = new Set<Set<Element>>();
    class FakeObserver {
      private mine = new Set<Element>();
      observe(el: Element) {
        this.mine.add(el);
        live.add(this.mine);
      }
      disconnect() {
        live.delete(this.mine);
      }
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    try {
      const two = [fact({ id: 'weather', label: 'Weather', value: 'Fair' }), fact({ id: 'light', label: 'Light', value: 'No light' })];
      const { container, rerender } = render(<FactsRow facts={two} onOpen={() => undefined} />);
      rerender(<FactsRow facts={[fact({ id: 'light', label: 'Light', value: 'No light' }), fact({ id: 'rest', label: 'Rest', value: 'Fair' })]} onOpen={() => undefined} />);
      const row = container.querySelector('.scene-facts')!;
      const rowWatch = [...live].find((watched) => watched.has(row));
      expect(rowWatch).toBeTruthy();
      expect(row.children).toHaveLength(2);
      for (const tile of row.children) expect(rowWatch!.has(tile)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the last line of a few facts (Q4)', () => {
  // Purpose: in a row of four tracks, one, two and three tiles move half the free tracks each, so their middle is the
  // row's middle; four move nothing.
  it('centres a short line in four tracks', () => {
    expect(lastLineShifts(1, 4)).toEqual([1.5]);
    expect(lastLineShifts(2, 4)).toEqual([1, 1]);
    expect(lastLineShifts(3, 4)).toEqual([0.5, 0.5, 0.5]);
    expect(lastLineShifts(4, 4)).toEqual([0, 0, 0, 0]);
  });

  // Purpose: where the column fits fewer across, only the last line that is not full moves; a full line stays.
  it('moves only the last line that is not full', () => {
    expect(lastLineShifts(2, 3)).toEqual([0.5, 0.5]);
    expect(lastLineShifts(3, 3)).toEqual([0, 0, 0]);
    expect(lastLineShifts(3, 2)).toEqual([0, 0, 0.5]);
    expect(lastLineShifts(1, 1)).toEqual([0]);
  });

  // Purpose: where the browser gives no tracks (no layout), nothing moves.
  it('moves nothing with no tracks', () => {
    expect(lastLineShifts(2, 0)).toEqual([0, 0]);
  });
});

describe("the band's icon buttons (S2)", () => {
  // Purpose: an icon button is named by its whole words, is never the accent, and runs on a tap; its one short word
  // ("Camp", sf-18) is in it for the width that shows it (from 1180 px, checked in tests/layout/sceneBand.spec.ts).
  it('is named by its words, plain, and tappable, with its short word', () => {
    const onTap = vi.fn();
    render(
      <BandTools>
        <BandTool label="Make camp" icon={<svg />} onTap={onTap} />
      </BandTools>,
    );
    const button = screen.getByRole('button', { name: 'Make camp' });
    expect(button.textContent).toBe('Camp');
    expect(button.className).toContain('button-secondary');
    fireEvent.click(button);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: 'Quick actions' })).toBeTruthy();
  });

  // Purpose: with no button to show (town, downtime), the row draws nothing at all.
  it('draws nothing with no buttons', () => {
    const { container } = render(<BandTools>{false}{null}</BandTools>);
    expect(container.innerHTML).toBe('');
  });

  // Purpose (sf-18; page 44, PS2 D): the three marks' words are "Camp", "Encounter" and "Leave", each inside the name
  // the button is read aloud by, so a voice user can say what they see.
  it('gives the three marks their short words, each part of the name', () => {
    render(
      <BandTools>
        <BandTool label="Make camp" icon={<svg />} onTap={() => undefined} />
        <BandTool label="Encounter check" icon={<svg />} onTap={() => undefined} />
        <BandTool label="Leave the dungeon" icon={<svg />} onTap={() => undefined} />
      </BandTools>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => [b.getAttribute('aria-label'), b.textContent])).toEqual([
      ['Make camp', 'Camp'],
      ['Encounter check', 'Encounter'],
      ['Leave the dungeon', 'Leave'],
    ]);
  });
});

describe("a fact's value and small line on one line each (tv-1 as corrected, mc-39b)", () => {
  const LONG = 'Freezing fog rolling in off the drowned marshes';
  const LONG_SUB = 'Wet. Lighting a campfire is hard, and every lantern gutters in the damp.';
  const css = async () => {
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    return fs.readFileSync('./src/app/SceneBand.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  };
  const rule = (text: string, selector: string) => {
    const at = text.indexOf(`${selector} {`);
    return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
  };

  // Purpose: the tile may cut its value and small line, so its accessible name always holds both whole, for the
  // shortest weather and the longest alike.
  it('names the tile with the whole value and small line', () => {
    render(<FactsRow facts={[fact({ id: 'weather', label: 'Weather', value: LONG, sub: LONG_SUB }), fact({ id: 'rest', label: 'Rest', value: 'Fair' })]} onOpen={() => undefined} />);
    expect(screen.getByRole('button', { name: `Weather: ${LONG}. ${LONG_SUB}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rest: Fair.' })).toBeTruthy();
  });

  // Purpose: a value that overruns its one line at the large size is marked to drop one step; one that fits is not.
  it('marks a value that overruns its line, and only that one', () => {
    const widths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return (this.textContent ?? '').length > 20 ? 400 : 40;
    });
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(160);
    try {
      render(<FactsRow facts={[fact({ id: 'weather', label: 'Weather', value: LONG }), fact({ id: 'rest', label: 'Rest', value: 'Fair' })]} onOpen={() => undefined} />);
      const values = [...document.querySelectorAll<HTMLElement>('.scene-fact__value-text')];
      expect(values.map((v) => v.dataset.fit ?? null)).toEqual(['smaller', null]);
    } finally {
      widths.mockRestore();
      client.mockRestore();
    }
  });

  // Purpose: the stylesheet keeps the value and the small line to one line each, cut with an ellipsis, never wrapped;
  // the smaller step is one step down the scale and never under 16 (the phone's check keeps T8a's own 14).
  it('keeps one line, cut with an ellipsis, one step smaller, never under 16', async () => {
    const text = await css();
    for (const part of ['.scene-fact__value-text', '.scene-fact__sub-text']) {
      const r = rule(text, part);
      expect(r).toMatch(/white-space:\s*nowrap/);
      expect(r).toMatch(/text-overflow:\s*ellipsis/);
      expect(r).toMatch(/overflow:\s*hidden/);
    }
    expect(text).not.toMatch(/overflow-wrap:\s*break-word/);
    expect(rule(text, ".scene-fact__value-text[data-fit='smaller']")).toMatch(/font-size:\s*var\(--fact-value-smaller\)/);
    const at = text.indexOf('@media (max-width: 599px) {\n  .scene-fact {') >= 0 ? text.indexOf('@media (max-width: 599px) {\n  .scene-fact {') : text.indexOf('@media (max-width: 599px) {\r\n  .scene-fact {');
    const [wide, phone] = [text.slice(0, at), text.slice(at)];
    expect(rule(wide, '.scene-fact__value')).toMatch(/--fact-value:\s*var\(--text-24\);\s*--fact-value-smaller:\s*var\(--text-20\)/);
    expect(rule(wide, '.scene-fact--check .scene-fact__value')).toMatch(/--fact-value:\s*var\(--text-20\);\s*--fact-value-smaller:\s*var\(--text-16\)/);
    expect(rule(phone, '.scene-fact__value')).toMatch(/--fact-value:\s*var\(--text-16\);\s*--fact-value-smaller:\s*var\(--text-16\)/);
  });
});

describe("the Rest fact's sheet (tv-1; the review of 883)", () => {
  // Purpose: the Rest tile may cut its value and small line, so its sheet starts with them whole, then the rule.
  it('heads the rule with the whole value', () => {
    render(<RestRule head="Group 1 due. Group 2: in 3 turns. Group 3: in 5 turns." words={['Rest one turn in six.']} onClose={() => undefined} />);
    const sheet = screen.getByRole('dialog', { name: 'Rest' });
    expect(sheet.textContent).toContain('Group 1 due. Group 2: in 3 turns. Group 3: in 5 turns.Rest one turn in six.');
  });
});

describe("the top's fold (p2p-20; page 24, TF1, TF1b)", () => {
  const band = (fold: Parameters<typeof SceneBand>[0]['fold']) => (
    <SceneBand
      over="Session 1. Saltwick Island."
      heading="The Anchorage, turn 1"
      date={{ icon: 'sprout', words: '14 Reedmonth', season: 'spring', light: 'Two hours of light left.' }}
      actions={<NextTurnButton label="Next turn" accent={false} onTap={() => undefined} />}
      fold={fold}
    />
  );
  const facts = [
    fact({ id: 'weather', label: 'Weather', value: 'To roll', state: 'due' }),
    fact({ id: 'light', label: 'Light', value: 'No light', state: 'dark', warn: true }),
    fact({ id: 'rest', label: 'Rest', value: 'In 5 turns' }),
  ];

  // Purpose (sf-18; page 44, PS2 A and C, EN1): the fold mark is a plain framed button with a chevron pointing up while
  // the top is open and down while folded, says which in its name and its expanded state, and a tap folds or opens the top.
  it('points up open and down folded, and a tap toggles it', () => {
    const onToggle = vi.fn();
    const { rerender } = render(band({ open: true, onToggle, due: facts }));
    const open = screen.getByRole('button', { name: 'Fold the top away' });
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.className).toContain('button-secondary');
    expect(open.className).not.toContain('button-primary');
    expect(open.querySelector('path')!.getAttribute('d')).toBe(CHEVRON_UP);
    fireEvent.click(open);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(band({ open: false, onToggle, due: facts }));
    const folded = screen.getByRole('button', { name: 'Show the top' });
    expect(folded.getAttribute('aria-expanded')).toBe('false');
    expect(folded.querySelector('path')!.getAttribute('d')).toBe(CHEVRON_DOWN);
  });

  // Purpose: folded, each fact that needs the GM still shows as one small line in the band, the dark Light with its
  // warning sign, and a quiet fact shows none; open, no such line (the tiles say it).
  it('keeps a due fact as one line in the band while folded', () => {
    const { rerender } = render(band({ open: false, onToggle: () => undefined, due: facts }));
    const lines = [...document.querySelectorAll('.scene-band__due-line')];
    expect(lines.map((l) => l.textContent)).toEqual(['Weather: To roll', 'No light']);
    expect(lines[1]!.querySelector('svg')).toBeTruthy();
    expect(lines[0]!.querySelector('svg')).toBeNull();
    expect(document.querySelector('.scene-band__due')!.textContent).not.toContain('In 5 turns');
    // Plain text, not a live region (it appears already filled; the review of #1048).
    expect(document.querySelector('.scene-band__due')!.getAttribute('role')).toBeNull();
    rerender(band({ open: true, onToggle: () => undefined, due: facts }));
    expect(document.querySelector('.scene-band__due')).toBeNull();
  });

  // Purpose: folded with nothing due, the band holds no due line at all (TF1 B).
  it('adds nothing with nothing due', () => {
    render(band({ open: false, onToggle: () => undefined, due: [facts[2]!] }));
    expect(document.querySelector('.scene-band__due')).toBeNull();
  });

  // Purpose: a due line says which fact it is: the value alone where it names its fact, else the label before it.
  it('words a due line by its fact', () => {
    expect(dueWords(fact({ id: 'rest', label: 'Rest', value: 'Rest due', state: 'due' }))).toBe('Rest due');
    expect(dueWords(fact({ id: 'light', label: 'Light', value: 'No light', state: 'dark' }))).toBe('No light');
    expect(dueWords(fact({ id: 'light', label: 'Light', value: 'Group 2 dark', state: 'dark' }))).toBe('Light: Group 2 dark');
    expect(dueWords(fact({ id: 'rest', label: 'Rest', value: 'Group 1 due', state: 'due' }))).toBe('Rest: Group 1 due');
    expect(isDue(fact({ id: 'rest', label: 'Rest', value: 'In 5 turns' }))).toBe(false);
  });

  // Purpose (the review of #1048): the line is decided by the fact and its known values, never by the value's words, so
  // a group whose name holds the label's word keeps the label first; the words are Francis's (2026-11-19).
  it("keeps the label before a group whose name holds the label's word", () => {
    expect(dueWords(fact({ id: 'light', label: 'Light', value: 'Lightfoot dark', state: 'dark', warn: true }))).toBe('Light: Lightfoot dark');
    expect(dueWords(fact({ id: 'rest', label: 'Rest', value: 'Restharrow due', state: 'due' }))).toBe('Rest: Restharrow due');
    expect(dueWords(fact({ id: 'rest', label: 'Rest', value: 'Rest day', state: 'due' }))).toBe('Rest day');
    expect(dueWords(fact({ id: 'weather', label: 'Weather', value: 'To roll', state: 'due' }))).toBe('Weather: To roll');
  });

  // Purpose: without a fold (between expeditions, the players' band) there is no fold mark.
  it('draws no fold mark without a fold', () => {
    render(band(null));
    expect(screen.queryByRole('button', { name: /the top/ })).toBeNull();
  });

  // Purpose (sf-18, for sf-11): the fold mark stands on its own as a part, so the players' top can use the same one:
  // the same chevron, name and expanded state, and its tap.
  it('is a part of its own, the same mark outside the band', () => {
    const onToggle = vi.fn();
    render(<FoldButton open={false} onToggle={onToggle} />);
    const mark = screen.getByRole('button', { name: 'Show the top' });
    expect(mark.getAttribute('aria-expanded')).toBe('false');
    expect(mark.querySelector('path')!.getAttribute('d')).toBe(CHEVRON_DOWN);
    fireEvent.click(mark);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // Purpose (Q3, F3 a): with the fold mark, the band's buttons come in the order the eye and the Tab key meet them:
  // Next turn, the fold mark, then the menu button last.
  it('puts the menu button last, after the fold mark', () => {
    render(
      <SceneBand
        over="Session 1. Saltwick Island."
        heading="The Anchorage, turn 1"
        date={{ icon: 'sprout', words: '14 Reedmonth', light: null }}
        actions={<NextTurnButton label="Next turn" accent={false} onTap={() => undefined} />}
        menu={<button type="button">Time options</button>}
        fold={{ open: true, onToggle: () => undefined, due: [] }}
      />,
    );
    const names = [...document.querySelectorAll('.scene-band button')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['Next turn', 'Fold the top away', 'Time options']);
  });

  // Purpose (Q3): with no fold mark (between expeditions, the players' band) the menu button stays where it was, the
  // last of the actions.
  it('keeps the menu in the actions without a fold', () => {
    render(
      <SceneBand
        over="Session 1. Saltwick Island."
        heading="The Reedmouth Quay"
        date={{ icon: 'sprout', words: '14 Reedmonth', light: null }}
        actions={<NextTurnButton label="Advance time" accent={false} onTap={() => undefined} />}
        menu={<button type="button">Time options</button>}
      />,
    );
    expect(document.querySelector('.scene-band__actions')!.lastElementChild!.textContent).toBe('Time options');
    expect(document.querySelector('.scene-band__menu')).toBeNull();
  });

  // The GM's band as SceneTime wires it (B12b): the fold read from and kept on the device.
  function GmTop() {
    const [open, setOpen] = useSceneTopOpen();
    return band({ open, onToggle: () => setOpen(!open), due: facts });
  }

  // Purpose (B12b): the GM folds the top, leaves the Scene and comes back, and the top is still folded; opened, it
  // stays open the next time. The first time on the device it is open.
  it('opens the top as the GM left it on this device', () => {
    localStorage.removeItem('grimoire.sceneTopOpen');
    const first = render(<GmTop />);
    fireEvent.click(screen.getByRole('button', { name: 'Fold the top away' }));
    first.unmount();
    const second = render(<GmTop />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the top' }));
    second.unmount();
    render(<GmTop />);
    expect(screen.getByRole('button', { name: 'Fold the top away' })).toBeTruthy();
    localStorage.removeItem('grimoire.sceneTopOpen');
  });

  // Purpose (B12b): the players' band has no fold, even on a device where the GM's top was left folded.
  it("gives the players' band no fold whatever the device kept", () => {
    localStorage.setItem('grimoire.sceneTopOpen', 'folded');
    render(<SceneBand over="Session 1." heading="The Anchorage" date={{ icon: 'sprout', words: '14 Reedmonth', light: null }} actions={null} />);
    expect(screen.queryByRole('button', { name: /the top/ })).toBeNull();
    localStorage.removeItem('grimoire.sceneTopOpen');
  });
});

describe("the players' band (S15; T9a, T9b)", () => {
  // Purpose: the players' band draws no button or menu; paused, today's words stand where the GM's button is.
  it('holds no button, and paused says so in words', () => {
    render(
      <SceneBand
        over="Session 1."
        heading="The Drowned Harbour"
        date={{ icon: null, words: '14 Reedmonth', light: null }}
        actions={<p className="scene-band__paused">Session paused, waiting for the GM</p>}
      />,
    );
    expect(screen.getByText('Session paused, waiting for the GM')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
