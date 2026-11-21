// @vitest-environment jsdom
// The standard parts of the December mockups (plan dec-7 piece 1; rulings ds-1, ds-1a, ds-1b, ds-2, ds-3, mc-43a,
// 2026-11-12): the toggle with no state words, the bare eye, dice named in words, and no Close beside a sheet's X.
// Invented words only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceWords, DieGlyph, splitDice } from './dice.tsx';
import { EyeToggle, ListRow, Switch } from './parts.tsx';
import { RulePresetPreview } from './ruleRows.tsx';

afterEach(cleanup);

function OneSwitch({ start }: { start: boolean }) {
  const [on, setOn] = useState(start);
  return <Switch label="Reed spear" on={on} onChange={setOn} />;
}

describe('the toggle (ds-1, ds-1a, ds-1b)', () => {
  // Purpose: the toggle says no "On" or "Off" beside it; a screen reader hears its name, that it is a switch, and its state.
  it('carries its name and state for a screen reader, and no state words', () => {
    render(<OneSwitch start={false} />);
    const toggle = screen.getByRole('switch', { name: 'Reed spear' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toBe('Reed spear');
    expect(toggle.textContent).not.toMatch(/\b(On|Off)\b/);
  });

  // Purpose: the name comes first and the track after it, so the name sits at the left and the track at the right of one row.
  it('puts the name before the track', () => {
    render(<OneSwitch start={false} />);
    const children = [...screen.getByRole('switch').children].map((c) => c.className);
    expect(children).toEqual(['switch__name', 'switch__track']);
  });

  // Purpose: the state never rests on colour alone: the knob carries a cross when off and a tick when on, and a tap on the row flips it.
  it('shows a cross when off and a tick when on, and a tap toggles it', async () => {
    const user = userEvent.setup();
    const { container } = render(<OneSwitch start={false} />);
    const thumb = () => container.querySelector('.switch__thumb')!;
    expect(thumb().getAttribute('data-mark')).toBe('cross');
    expect(thumb().querySelector('svg')).not.toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Reed spear' }));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(thumb().getAttribute('data-mark')).toBe('tick');
    await user.click(screen.getByText('Reed spear'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});

describe('the eye (ds-2)', () => {
  // Purpose: the eye is a bare button with no words: open when shown, closed when hidden, read aloud by the caller's label and its state; a tap flips it.
  it('is open when shown and closed when hidden, with no words, and a tap flips it', async () => {
    const user = userEvent.setup();
    function OneEye() {
      const [shown, setShown] = useState(true);
      return <EyeToggle label="Map shown to the players" shown={shown} onChange={setShown} />;
    }
    render(<OneEye />);
    const eye = screen.getByRole('switch', { name: 'Map shown to the players' });
    expect(eye.getAttribute('aria-checked')).toBe('true');
    expect(eye.getAttribute('data-eye')).toBe('open');
    expect(eye.textContent).toBe('');
    await user.click(eye);
    expect(eye.getAttribute('aria-checked')).toBe('false');
    expect(eye.getAttribute('data-eye')).toBe('shut');
  });
});

describe('dice in words (ds-3)', () => {
  // Purpose: a line naming no die is one piece of words, and gets no glyph (⚑5's pick).
  it('leaves a line with no named die as words', () => {
    expect(splitDice('The tide turns at dusk.')).toEqual([{ kind: 'words', text: 'The tide turns at dusk.' }]);
    expect(splitDice('')).toEqual([]);
  });

  // Purpose: "dN", a count before it, and "N in M" are named dice; each keeps its own words.
  it('finds dN, NdN and N in M', () => {
    expect(splitDice('Roll a d6: the door opens on a 1 or a 2.')).toEqual([
      { kind: 'words', text: 'Roll a ' },
      { kind: 'die', text: 'd6', die: 6 },
      { kind: 'words', text: ': the door opens on a 1 or a 2.' },
    ]);
    expect(splitDice('The check: 2 in 6.')).toEqual([
      { kind: 'words', text: 'The check: ' },
      { kind: 'die', text: '2 in 6', die: 6 },
      { kind: 'words', text: '.' },
    ]);
    expect(splitDice('3d6 days, or d100')).toEqual([
      { kind: 'die', text: '3d6', die: 6 },
      { kind: 'words', text: ' days, or ' },
      { kind: 'die', text: 'd100', die: 100 },
    ]);
  });

  // Purpose: a die the app has no glyph for ("d7", "1 in 3"), or a word that only looks like one, stays words.
  it('keeps an unknown die as words', () => {
    expect(splitDice('A d7 or 1 in 3 or d1000.')).toEqual([{ kind: 'words', text: 'A d7 or 1 in 3 or d1000.' }]);
    expect(splitDice('Toad6 and d6s')).toEqual([{ kind: 'words', text: 'Toad6 and d6s' }]);
  });

  // Purpose: "N in M" is a die only in the chance form rule text uses, at the end of the line or before punctuation;
  // followed by a word it is a count ("1 in 4 doors") and stays words, as does a longer number ("1 in 60").
  it('reads N in M as a die only in the chance form', () => {
    expect(splitDice('The harbour check: 2 in 6, every second turn.').filter((p) => p.kind === 'die')).toEqual([{ kind: 'die', text: '2 in 6', die: 6 }]);
    expect(splitDice('Lost on 1 in 6').filter((p) => p.kind === 'die')).toEqual([{ kind: 'die', text: '1 in 6', die: 6 }]);
    expect(splitDice('Lost on 1 in 6 (the reeds).').filter((p) => p.kind === 'die')).toEqual([{ kind: 'die', text: '1 in 6', die: 6 }]);
    expect(splitDice('About 1 in 4 doors is barred.')).toEqual([{ kind: 'words', text: 'About 1 in 4 doors is barred.' }]);
    expect(splitDice('Only 1 in 60 return.')).toEqual([{ kind: 'words', text: 'Only 1 in 60 return.' }]);
  });

  // Purpose: the pieces join back into the line exactly as written (the book's words stay verbatim).
  it('keeps the words verbatim', () => {
    for (const line of ['Roll a d6, then 2 in 6; a D20 too.', 'd4 d8 d10 d12 d20', ' 1 in 6 ', 'Nothing here']) {
      expect(
        splitDice(line)
          .map((p) => p.text)
          .join(''),
      ).toBe(line);
    }
  });

  // Purpose: DiceWords draws the matching die glyph before each named die and none where no die is named, the words unchanged.
  it('draws a glyph before each named die', () => {
    const { container } = render(
      <p>
        <DiceWords>Roll a d6, or 1 in 20, or a d7.</DiceWords>
      </p>,
    );
    const dice = [...container.querySelectorAll('svg[data-die]')].map((s) => s.getAttribute('data-die'));
    expect(dice).toEqual(['6', '20']);
    expect(container.textContent).toBe('Roll a d6, or 1 in 20, or a d7.');
    const plain = render(<DiceWords>No roll needed.</DiceWords>);
    expect(plain.container.querySelector('svg')).toBeNull();
  });
});

describe('a sheet with an X has no Close button (mc-43a)', () => {
  // Purpose: a preset with nothing to change shows no Close button; its X closes it. One with changes keeps Use and Not now.
  it('drops the foot Close when there is nothing to use', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RulePresetPreview name="Marsh rules" moves={[]} onUse={() => {}} onClose={onClose} />);
    const sheet = screen.getByRole('dialog', { name: 'Marsh rules' });
    expect(within(sheet).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    render(<RulePresetPreview name="Marsh rules" moves={[{ name: 'Lantern oil', from: 'Off', to: 'On' }]} onUse={() => {}} onClose={() => {}} />);
    const ask = screen.getByRole('dialog', { name: 'Use Marsh rules?' });
    expect(within(ask).getByRole('button', { name: 'Use Marsh rules' })).toBeTruthy();
    expect(within(ask).getByRole('button', { name: 'Not now' })).toBeTruthy();
  });
});

describe('the List row: a mark before the value (ch-1)', () => {
  // Purpose: a Sheet row's die glyph sits just before its odds, the odds keep their word-figure size, the screen reader
  // hears the same words as without the glyph, and the row that opens still shows its chevron.
  it('puts the mark first in the value, keeps the word size and what is heard, and keeps the chevron', () => {
    render(<ListRow figure title="Hark" value="2-in-6" valueLead={<DieGlyph die={6} size={16} />} onOpen={() => {}} />);
    const row = screen.getByRole('button', { name: 'Hark, 2-in-6' });
    const value = row.querySelector('.list-row__value')!;
    expect(value.classList.contains('list-row__value--word')).toBe(true);
    expect(value.classList.contains('list-row__value--lead')).toBe(true);
    expect(value.firstElementChild?.getAttribute('data-die')).toBe('6');
    expect(value.textContent).toBe('2-in-6');
    expect(row.querySelector('.list-row__chevron')).not.toBeNull();
  });

  // Purpose: without a mark the value is drawn exactly as before (no extra class, nothing before the words).
  it('without a mark, the value is the words alone', () => {
    render(<ListRow figure title="Hark" value="2-in-6" onOpen={() => {}} />);
    const value = screen.getByRole('button', { name: 'Hark, 2-in-6' }).querySelector('.list-row__value')!;
    expect(value.classList.contains('list-row__value--lead')).toBe(false);
    expect(value.children).toHaveLength(0);
  });
});

describe('the List row: the mark inside the value (tfs-3)', () => {
  // Purpose: a skill rolled the target or higher reads "5+ on", the die's glyph, "d6": the glyph sits inside the figure,
  // the figure keeps its word size and its words whole, and the screen reader hears the words as written.
  it('puts the mark at the place given, keeps the words and what is heard', () => {
    render(<ListRow figure title="Hark" value="5+ on d6" valueLead={<DieGlyph die={6} size={16} />} valueMarkAt={6} onOpen={() => {}} />);
    const value = screen.getByRole('button', { name: 'Hark, 5+ on d6' }).querySelector('.list-row__value')!;
    expect(value.classList.contains('list-row__value--word')).toBe(true);
    expect(value.classList.contains('list-row__value--lead')).toBe(true);
    const parts = [...value.childNodes].map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent : (n as Element).getAttribute('data-die')));
    expect(parts).toEqual(['5+ on ', '6', 'd6']);
    expect(value.textContent).toBe('5+ on d6');
  });

  // Purpose: a place at the very start, past the words, or on a value that isn't words puts the mark before, as ch-1.
  it('falls back to the mark before the value', () => {
    render(<ListRow figure title="Hark" value="2-in-6" valueLead={<DieGlyph die={6} size={16} />} valueMarkAt={40} onOpen={() => {}} />);
    const value = screen.getByRole('button', { name: 'Hark, 2-in-6' }).querySelector('.list-row__value')!;
    expect(value.firstElementChild?.getAttribute('data-die')).toBe('6');
    expect(value.textContent).toBe('2-in-6');
  });
});
