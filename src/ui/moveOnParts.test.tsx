// @vitest-environment jsdom
// Moving on, as parts (plan dec-7-linked-spots-screens.md piece 4a; mc-36, mc-36a, mc-41, mc-41a, mc-42, mc-42a, dp-4;
// mockup december/01 frames 11, 12, 13, F1, F2, F2b). Callbacks and props only; an invented harbour.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoveOnLayoutPage } from '../gallery/MoveOnSpecimens.tsx';
import { ICON_SET } from './iconSet.ts';
import { StepIcon } from './icons.tsx';
import { DestinationRow, MoveOnSheet, ObstacleBlock, ProposalSheet, WhereTo, type WayMove } from './MoveOnParts.tsx';

afterEach(cleanup);

const WAYS = [
  { key: 'row', word: 'Rowing', time: '1 turn' },
  { key: 'swim', word: 'Swimming', time: '3 turns' },
];
const PLAIN: WayMove = { title: 'Rowing to 2. The wreck', takes: '1 turn.', then: 'Encounter check, 1 in 6.' };
const GAP: WayMove = {
  title: 'Rowing to 5. The sea cave',
  takes: '2 turns, and 2 more for the obstacle: 4 turns.',
  then: 'Encounter check, with the breakwater’s chance: 2 in 6.',
  obstacle: { name: 'the breakwater’s gap', extra: '2 turns more.', note: 'The gap takes a boat only at slack water.', needsApproval: true },
};

describe('a destination row (mc-36, mc-36a)', () => {
  // Purpose: each way is one stacked button, its word over its time, at the right of the row; a tap names that way.
  it('shows each way as a stacked button and a tap names the way', async () => {
    const onWay = vi.fn();
    render(<DestinationRow number="2" name="The wreck" ways={WAYS} onWay={onWay} />);
    const row = screen.getByRole('group', { name: '2. The wreck' });
    const swim = within(row).getByRole('button', { name: 'Swimming, 3 turns, to 2. The wreck' });
    expect(swim.querySelector('.way-button__word')?.textContent).toBe('Swimming');
    expect(swim.querySelector('.way-button__time')?.textContent).toBe('3 turns');
    await userEvent.click(swim);
    expect(onWay).toHaveBeenCalledWith('swim');
    // The GM's and a plain player's buttons aren't toggles.
    expect(swim.hasAttribute('aria-pressed')).toBe(false);
  });

  // Purpose (p2p-3, 2026-11-18): a row's number reads with its full stop, "3. The breakwater", and a name that already
  // starts with its number is not doubled; a row with no number is its name alone.
  it('numbers a row as "3. The breakwater", once', () => {
    const { unmount } = render(<DestinationRow number="3" name="3 The breakwater" ways={WAYS} onWay={vi.fn()} />);
    const row = screen.getByRole('group', { name: '3. The breakwater' });
    expect(row.querySelector('.destination-row__name')?.textContent).toBe('3.The breakwater');
    expect(row.querySelector('.destination-row__number')?.textContent).toBe('3.');
    unmount();
    render(<DestinationRow number={null} name="The Anchorage" ways={WAYS} onWay={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'The Anchorage' }).querySelector('.destination-row__number')).toBeNull();
  });

  // Purpose (#1000's review): a row follows the place page's own rule: a key with letters reads "A2. The Vault", and a
  // name that is only its number reads as that number alone, with no second number drawn ("3", never "3. 3").
  it('keys a row by the place page’s rule, for a lettered key and a bare number', () => {
    const { unmount } = render(<DestinationRow number="A2" name="The Vault" ways={WAYS} onWay={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'A2. The Vault' }).querySelector('.destination-row__number')?.textContent).toBe('A2.');
    unmount();
    render(<DestinationRow number="3" name="3" ways={WAYS} onWay={vi.fn()} />);
    const row = screen.getByRole('group', { name: '3' });
    expect(row.querySelector('.destination-row__number')).toBeNull();
    expect(row.querySelector('.destination-row__name')?.textContent).toBe('3');
  });

  // Purpose (B16; pf-25, p2p-30): a way named row shows the crossed oars, swim the two fish, walk the leather boot and
  // climb the climber (⚑ 11, ruled 2026-11-19), each on its own line above the word; the picture is decoration, so the
  // button's label stays its word and time.
  it('shows the oars on row, the two fish on swim, the boot on walk and the climber on climb, above the word', () => {
    const ways = [
      { key: 'r1|row', word: 'Row', time: '1 turn', by: 'row' },
      { key: 'r1|swim', word: 'Swim', time: '3 turns', by: 'swim' },
      { key: 'r2|walk', word: 'Walk', time: '2 turns', by: 'walk' },
      { key: 'r3|climb', word: 'Climb', time: '4 turns', by: 'climb' },
    ];
    render(<DestinationRow number="2" name="The wreck" ways={ways} onWay={() => undefined} />);
    const row = screen.getByRole('group', { name: '2. The wreck' });
    const pictures: [string, keyof typeof ICON_SET][] = [
      ['Row, 1 turn, to 2. The wreck', 'paddles'],
      ['Swim, 3 turns, to 2. The wreck', 'double-fish'],
      ['Walk, 2 turns, to 2. The wreck', 'leather-boot'],
      ['Climb, 4 turns, to 2. The wreck', 'mountain-climbing'],
    ];
    for (const [label, icon] of pictures) {
      const button = within(row).getByRole('button', { name: label });
      const picture = button.querySelector('.way-button__icon')!;
      expect(picture.querySelector('path')!.getAttribute('d'), label).toBe(ICON_SET[icon].d);
      expect(picture.getAttribute('aria-hidden'), label).toBe('true');
      // Three lines, in the approved order (ap-10; page 18, PL7): the picture, the word, the time.
      expect([...button.children].map((child) => child.className), label).toEqual(['way-button__icon', 'way-button__word', 'way-button__time']);
    }
  });

  // Purpose (pf-25): the icon a pack names for a way wins over the picture its short id would give.
  it('shows a way’s own icon in place of the one its id reads', () => {
    render(<DestinationRow name="The wreck" ways={[{ key: 'r1|row', word: 'Row', time: '1 turn', by: 'row', icon: 'water-splash' }]} onWay={() => undefined} />);
    const picture = screen.getByRole('button', { name: 'Row, 1 turn, to The wreck' }).querySelector('.way-button__icon path')!;
    expect(picture.getAttribute('d')).toBe(ICON_SET['water-splash'].d);
  });

  // Purpose (d5-11, ruled 2026-11-20; pf-25, page 18's PL7): a way the app has no picture for carries the generic way
  // mark, the two pins beside Move on (the app's `travel` mark), above its word and its time, so every button in a row
  // keeps one shape: an invented way, a link that names no way, a way given no id at all, and a way whose pack names an
  // icon the set lacks. The mark is decoration: the button's label stays its word and time.
  it.fails('shows the generic way mark above an unknown way’s word', () => {
    const ways = [
      { key: 'r1|wade', word: 'Wade', time: '2 turns', by: 'wade' },
      { key: 'r2|', word: 'Move', time: '1 turn', by: '' },
      { key: 'r3|piles', word: 'Along the piles', time: '6 turns' },
      { key: 'r4|row', word: 'Row', time: '1 turn', by: 'row', icon: 'lantern-moth' },
    ];
    const mark = render(<StepIcon name="travel" size={24} />).container.innerHTML;
    cleanup();
    render(<DestinationRow name="The wreck" ways={ways} onWay={() => undefined} />);
    const buttons = within(screen.getByRole('group', { name: 'The wreck' })).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Wade, 2 turns, to The wreck',
      'Move, 1 turn, to The wreck',
      'Along the piles, 6 turns, to The wreck',
      'Row, 1 turn, to The wreck',
    ]);
    for (const button of buttons) {
      const label = button.getAttribute('aria-label') ?? '';
      const picture = button.querySelector('.way-button__icon')!;
      expect(picture.innerHTML, label).toBe(mark);
      expect(picture.getAttribute('aria-hidden'), label).toBe('true');
      expect([...button.children].map((child) => child.className), label).toEqual(['way-button__icon', 'way-button__word', 'way-button__time']);
    }
  });

  // Purpose: a proposed way keeps its picture on top; the tick stays before its word, on the word's line (page 18, PL3).
  it('keeps the picture on a proposed way, the tick before its word', () => {
    render(<DestinationRow name="The wreck" ways={[{ key: 'row', word: 'Row', time: '1 turn', by: 'row' }]} onWay={() => undefined} proposal={{ wayKey: 'row', by: 'Ash' }} />);
    const button = screen.getByRole('button', { name: 'Row, 1 turn, to The wreck, proposed' });
    expect(button.querySelector('.way-button__icon path')!.getAttribute('d')).toBe(ICON_SET.paddles.d);
    expect(button.querySelector('.way-button__word .way-button__tick')).not.toBeNull();
    expect(button.querySelector('.way-button__icon .way-button__tick')).toBeNull();
  });

  // Purpose: the gallery's and the layout page's harbour shows the pictures as the app will: Rowing the oars,
  // Swimming the two fish, Climbing the climber, and "Along the piles" and Wading the generic way mark (d5-11).
  it.fails('draws the pictures on the gallery’s rows', () => {
    render(<MoveOnLayoutPage state="list" />);
    const rowing = screen.getAllByRole('button', { name: /^Rowing, / })[0]!;
    expect(rowing.querySelector('.way-button__icon path')!.getAttribute('d')).toBe(ICON_SET.paddles.d);
    const swimming = screen.getAllByRole('button', { name: /^Swimming, / })[0]!;
    expect(swimming.querySelector('.way-button__icon path')!.getAttribute('d')).toBe(ICON_SET['double-fish'].d);
    const climbing = screen.getAllByRole('button', { name: /^Climbing, / })[0]!;
    expect(climbing.querySelector('.way-button__icon path')!.getAttribute('d')).toBe(ICON_SET['mountain-climbing'].d);
    const mark = render(<StepIcon name="travel" size={24} />).container.innerHTML;
    expect(screen.getAllByRole('button', { name: /^Along the piles, / })[0]!.querySelector('.way-button__icon')!.innerHTML).toBe(mark);
    expect(screen.getAllByRole('button', { name: /^Wading, / })[0]!.querySelector('.way-button__icon')!.innerHTML).toBe(mark);
  });

  // Purpose: the caller's own proposal washes the row, ticks its way and says it waits for the GM, with Cancel.
  it('a proposal of yours: washed, ticked, waiting, with Cancel', async () => {
    const onCancel = vi.fn();
    render(<DestinationRow number="2" name="The wreck" ways={WAYS} onWay={() => undefined} proposal={{ wayKey: 'row', by: 'you', onCancel }} />);
    const row = screen.getByRole('group', { name: '2. The wreck' });
    expect(row.className).toContain('destination-row--proposed');
    // The proposed way says so in its label and shows the tick; the others don't. No way button is a toggle (no
    // aria-pressed on any, review of #755: one rule for all).
    const rowing = within(row).getByRole('button', { name: 'Rowing, 1 turn, to 2. The wreck, proposed' });
    expect(rowing.querySelector('.way-button__tick')).not.toBeNull();
    expect(within(row).getByRole('button', { name: 'Swimming, 3 turns, to 2. The wreck' }).querySelector('.way-button__tick')).toBeNull();
    expect(row.querySelectorAll('.way-button[aria-pressed]')).toHaveLength(0);
    expect(within(row).getByText('Proposed by you: waiting for your GM.')).toBeTruthy();
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // Purpose: another player's proposal names them, with no Cancel (it isn't theirs to take back here).
  it('a proposal by another: named, with no Cancel', () => {
    render(<DestinationRow number="3" name="The breakwater" ways={[WAYS[0]!]} onWay={() => undefined} proposal={{ wayKey: 'row', by: 'Wren' }} />);
    expect(screen.getByText('Proposed by Wren.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  // Purpose: the players' list is headed "Where to?" and is absent when there is nowhere to go.
  it('Where to? heads the players’ rows and is absent with none', () => {
    const { rerender } = render(
      <WhereTo empty={false}>
        <DestinationRow name="The wreck" ways={WAYS} onWay={() => undefined} />
      </WhereTo>,
    );
    expect(screen.getByRole('region', { name: 'Where to?' })).toBeTruthy();
    rerender(
      <WhereTo empty>
        <span />
      </WhereTo>,
    );
    expect(screen.queryByText('Where to?')).toBeNull();
  });
});

describe('the obstacle block (mc-41, mc-41a)', () => {
  // Purpose: it is headed "Obstacle: <name>" ("Obstacle" alone without a name), then the extra time and the book's note.
  it('is headed with its name, then the extra time and the note', () => {
    const { rerender } = render(<ObstacleBlock obstacle={GAP.obstacle!} />);
    const block = screen.getByRole('group', { name: 'Obstacle: the breakwater’s gap' });
    expect(block.textContent).toContain('2 turns more. The gap takes a boat only at slack water.');
    rerender(<ObstacleBlock obstacle={{ extra: '', note: 'Slippery stones.', needsApproval: false }} />);
    expect(screen.getByRole('group', { name: 'Obstacle' }).textContent).toBe('ObstacleSlippery stones.');
  });
});

describe('the GM’s own Move on (frames 11, 12, 13)', () => {
  const destinations = [
    { id: 'wreck', number: '2', name: 'The wreck', shown: 'shown' as const, ways: WAYS },
    { id: 'shed', number: '4', name: 'The customs shed', shown: 'unshown' as const, ways: [{ key: 'piles', word: 'Along the piles', time: '2 turns' }] },
    { id: 'cave', number: '5', name: 'The sea cave', shown: 'hidden' as const, obstacle: 'An obstacle, the breakwater’s gap: 2 turns more; you decide.', ways: [{ key: 'row', word: 'Rowing', time: '2 turns' }] },
  ];
  const sheet = (more: Partial<Parameters<typeof MoveOnSheet>[0]> = {}) => (
    <MoveOnSheet
      here="the jetty"
      destinations={destinations}
      moveOf={(id) => (id === 'cave' ? GAP : PLAIN)}
      onMove={() => undefined}
      onAnswer={() => undefined}
      onElsewhere={() => undefined}
      onClose={() => undefined}
      {...more}
    />
  );

  // Purpose: the list is one row a destination with what the players know of it, the hidden way marked and the
  // obstacle warned of, Somewhere else… last, and no foot line (p2p-17; page 24, WY1d); no End expedition row unless
  // the caller gives one (a Location the pack marks a way out).
  it('lists the destinations, what players know and the obstacle, with no foot line', () => {
    render(sheet());
    const dialog = screen.getByRole('dialog', { name: 'Move on: From the jetty, where to?' });
    expect(within(dialog).getByText('Shown to the players.')).toBeTruthy();
    expect(within(dialog).getByText('Not yet shown: players see “not yet explored”.')).toBeTruthy();
    expect(within(dialog).getByText('Hidden from players')).toBeTruthy();
    expect(within(dialog).getByText('An obstacle, the breakwater’s gap: 2 turns more; you decide.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Somewhere else…' })).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/Each move asks/);
    expect(dialog.querySelector('.move-sheet__foot')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'End expedition' })).toBeNull();
    // One row a destination, its ways on the row (frame 11's ways under it are superseded).
    expect(within(dialog).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['2. The wreck', '4. The customs shed', '5. The sea cave']);
  });

  // Purpose: a plain way opens its step, titled with the way and where to (page 24, WY1a), how long and then, with no
  // Where line and no line about the log (p2p-17), and Move, the accent; Move names the way; Back returns.
  it('a plain way: its step with Move, and Back to the list', async () => {
    const onMove = vi.fn();
    render(sheet({ onMove }));
    await userEvent.click(screen.getByRole('button', { name: 'Rowing, 1 turn, to 2. The wreck' }));
    const dialog = screen.getByRole('dialog', { name: 'Move on: Rowing to 2. The wreck' });
    expect(within(dialog).queryByText('Where')).toBeNull();
    expect(within(dialog).getByText('Takes')).toBeTruthy();
    expect(within(dialog).queryByText('Do they get through?')).toBeNull();
    expect(dialog.textContent).not.toMatch(/in the log|Undo/);
    const move = within(dialog).getByRole('button', { name: 'Move' });
    expect(move.className).toContain('button-primary');
    await userEvent.click(move);
    expect(onMove).toHaveBeenCalledWith('wreck', 'row');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Move on: From the jetty, where to?' })).toBeTruthy();
  });

  // Purpose (frame 13): a way with an obstacle the GM decides says the obstacle first, then asks "Do they get through?"
  // with Yes and No equal and plain (no accent); no line explains the log (p2p-17) or No's time.
  it('a way with an obstacle: the obstacle first, then Yes and No, plain', async () => {
    const onAnswer = vi.fn();
    render(sheet({ onAnswer }));
    await userEvent.click(screen.getByRole('button', { name: 'Rowing, 2 turns, to 5. The sea cave' }));
    const dialog = screen.getByRole('dialog', { name: 'Move on: Rowing to 5. The sea cave' });
    const block = within(dialog).getByRole('group', { name: 'Obstacle: the breakwater’s gap' });
    const lines = dialog.querySelector('.move-summary')!;
    expect(block.compareDocumentPosition(lines) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getByText('Do they get through?')).toBeTruthy();
    expect(dialog.querySelector('.button-primary')).toBeNull();
    expect(dialog.textContent).not.toMatch(/logged/);
    expect(dialog.textContent).not.toMatch(/spends no time/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'No' }));
    expect(onAnswer).toHaveBeenCalledWith('cave', 'row', false);
  });

  // Purpose (review of #755): a tap on a way and a tap on Back each keep the focus inside the pop-up (the list and the
  // step are pop-ups of their own), so Tab never leaves it for the page.
  it('keeps the focus inside the pop-up after a way and after Back', async () => {
    render(sheet());
    await userEvent.click(screen.getByRole('button', { name: 'Rowing, 1 turn, to 2. The wreck' }));
    const step = screen.getByRole('dialog', { name: 'Move on: Rowing to 2. The wreck' });
    expect(step.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(step.contains(document.activeElement)).toBe(true);
    await userEvent.click(within(step).getByRole('button', { name: 'Back' }));
    const list = screen.getByRole('dialog', { name: 'Move on: From the jetty, where to?' });
    expect(list.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  // Purpose (B10; p2p-22, page 24 WY1d): at a Location the pack marks a way out the list ends with End expedition,
  // after Somewhere else…, with the door; a tap on it is the caller's (it ends the expedition).
  it('at a way out, ends with End expedition', async () => {
    const onEnd = vi.fn();
    render(sheet({ onEnd }));
    const dialog = screen.getByRole('dialog', { name: 'Move on: From the jetty, where to?' });
    const buttons = within(dialog).getAllByRole('button');
    const end = within(dialog).getByRole('button', { name: 'End expedition' });
    expect(buttons.at(-1)).toBe(end);
    expect(buttons.indexOf(within(dialog).getByRole('button', { name: 'Somewhere else…' }))).toBe(buttons.length - 2);
    expect(end.querySelector('svg')).toBeTruthy();
    await userEvent.click(end);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  // Purpose: with no ways on from here, the list says so plainly and keeps Somewhere else….
  it('with nowhere to go, says so and keeps Somewhere else…', () => {
    render(sheet({ destinations: [] }));
    expect(screen.getByText('No ways on from here in your packs. Somewhere else… takes the party anywhere.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Somewhere else…' })).toBeTruthy();
  });
});

describe('a proposed way’s sheet (F2, F2b; mc-42, mc-42a)', () => {
  // Purpose: it says who proposes over the title and who asked in its lines, counts the queue beside the ✕, and Not now
  // is in its foot.
  it('names who proposed, counts the queue, and offers Not now', async () => {
    const onNotNow = vi.fn();
    render(<ProposalSheet id="p-wren" askedBy="Wren" move={GAP} count="1 of 3" onAnswer={() => undefined} onNotNow={onNotNow} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Wren proposes: Rowing to 5. The sea cave' });
    expect(within(dialog).getByText('1 of 3')).toBeTruthy();
    expect(within(dialog).getByText('Wren.')).toBeTruthy();
    expect(within(dialog).getByText('Do they get through?')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Not now' }));
    expect(onNotNow).toHaveBeenCalledOnce();
  });

  // Purpose (F2b): a proposed way with no obstacle asks "Do they go?", Yes the accent; no count when only one waits.
  it('no obstacle: Do they go?, Yes the accent', async () => {
    const onAnswer = vi.fn();
    render(<ProposalSheet id="p-ash" askedBy="Ash" move={PLAIN} onAnswer={onAnswer} onNotNow={() => undefined} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Ash proposes: Rowing to 2. The wreck' });
    expect(within(dialog).getByText('Do they go?')).toBeTruthy();
    expect(within(dialog).queryByRole('group', { name: /^Obstacle/ })).toBeNull();
    const yes = within(dialog).getByRole('button', { name: 'Yes' });
    expect(yes.className).toContain('button-primary');
    expect(dialog.querySelectorAll('.button-primary')).toHaveLength(1);
    expect(dialog.textContent).not.toMatch(/in the log/);
    expect(dialog.querySelector('.move-sheet__count')).toBeNull();
    await userEvent.click(yes);
    expect(onAnswer).toHaveBeenCalledWith(true);
  });
});

describe('the queue worked on the layout page (dp-4)', () => {
  // Purpose: a proposal arriving while another sheet is open doesn't cover it; it waits in the list and opens by itself
  // when that sheet closes; a second arrival is counted, and answering opens the next.
  it('waits under another sheet, then opens by itself, first in first out', async () => {
    render(<MoveOnLayoutPage state="queue" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open another sheet' }));
    const other = screen.getByRole('dialog', { name: 'Another sheet' });
    await userEvent.click(within(other).getByRole('button', { name: 'A proposal arrives' }));
    expect(screen.getByRole('dialog', { name: 'Another sheet' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /proposes/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Wren proposes: to the sea cave/ })).toBeTruthy();
    await userEvent.click(within(other).getByRole('button', { name: 'Close' }));
    const first = screen.getByRole('dialog', { name: 'Wren proposes: Rowing to 5. The sea cave' });
    expect(first.querySelector('.move-sheet__count')).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'A proposal arrives' })[0]!);
    expect(within(screen.getByRole('dialog', { name: /Wren proposes/ })).getByText('1 of 2')).toBeTruthy();
    await userEvent.click(within(screen.getByRole('dialog', { name: /Wren proposes/ })).getByRole('button', { name: 'Yes' }));
    expect(screen.getByRole('dialog', { name: 'Ash proposes: Rowing to 2. The wreck' })).toBeTruthy();
  });
});

describe('the focus through the queue (the re-review of #755)', () => {
  // Purpose: after Yes, and after Not now, the next proposal's sheet opens as a pop-up of its own: the focus is inside
  // it and starts again at its first control (not left on the old sheet's Not now), and Tab never leaves it.
  it('keeps the focus inside the next proposal’s sheet after Yes and after Not now', async () => {
    render(<MoveOnLayoutPage state="queue" />);
    for (let i = 0; i < 3; i += 1) await userEvent.click(screen.getAllByRole('button', { name: 'A proposal arrives' })[0]!);
    await userEvent.click(within(screen.getByRole('dialog', { name: /Wren proposes/ })).getByRole('button', { name: 'Yes' }));
    const ash = screen.getByRole('dialog', { name: /Ash proposes/ });
    expect(ash.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(ash.contains(document.activeElement)).toBe(true);
    await userEvent.click(within(ash).getByRole('button', { name: 'Not now' }));
    const tam = screen.getByRole('dialog', { name: /Tam proposes/ });
    expect(tam.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(tam).getByRole('button', { name: 'Yes' }));
  });
});

describe('the rulings of 2026-11-13 on the layout page', () => {
  // Purpose (pf-12f, needsApproval false): an obstacle with no name and no place it passes is headed "Obstacle" alone,
  // and one the GM doesn't decide keeps the plain way's Move, with no question.
  it('an unnamed obstacle the GM doesn’t decide: "Obstacle" alone, then Move', () => {
    render(<MoveOnLayoutPage state="obstacle-plain" />);
    const dialog = screen.getByRole('dialog', { name: 'Move on: Along the piles to 4. The customs shed' });
    expect(within(dialog).getByRole('group', { name: 'Obstacle' }).textContent).toBe('Obstacle1 turn more. The piles are slick with weed.');
    expect(within(dialog).queryByText('Do they get through?')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Move' })).toBeTruthy();
  });

  // Purpose: the ✕ answers nothing and hides nothing: the proposals still wait, and the waiting card's tap (a stand-in
  // here) opens the sheet again at the first.
  it('the ✕ leaves the proposals waiting; the waiting card reopens at the first', async () => {
    render(<MoveOnLayoutPage state="queue" />);
    const arrives = () => userEvent.click(screen.getAllByRole('button', { name: 'A proposal arrives' })[0]!);
    await arrives();
    await arrives();
    await userEvent.click(within(screen.getByRole('dialog', { name: /Wren proposes/ })).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('button', { name: /proposes: to/ })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Open the waiting proposals' }));
    expect(within(screen.getByRole('dialog', { name: /Wren proposes/ })).getByText('1 of 2')).toBeTruthy();
  });

  // Purpose: another player's proposal shows on a player's rows, named, with no Cancel.
  it('another’s proposal on the players’ rows', () => {
    render(<MoveOnLayoutPage state="players-other" />);
    expect(screen.getByText('Proposed by Wren.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('no part is ever disabled', () => {
  // Purpose: every button in every part can be pressed (a blocked action explains itself; it is never greyed).
  it('has no disabled button', () => {
    render(
      <>
        <DestinationRow name="The wreck" ways={WAYS} onWay={() => undefined} proposal={{ wayKey: 'row', by: 'you', onCancel: () => undefined }} />
        <ProposalSheet id="p-wren" askedBy="Wren" move={GAP} count="1 of 3" onAnswer={() => undefined} onNotNow={() => undefined} onClose={() => undefined} />
      </>,
    );
    expect(document.querySelectorAll('button[disabled], [aria-disabled="true"]')).toHaveLength(0);
  });
});
