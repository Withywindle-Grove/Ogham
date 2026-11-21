// @vitest-environment jsdom
// The creation rework's shared parts (cw-11, mockup creation/12; plan m5b-creation-rework, slice A1). Purposes:
//   Inside character creation the step shell shows a worded Leave at its top and draws no "‹" or "›" anywhere (its
//     folds and Other… included); Leave goes where the host says.
//   Outside creation (New campaign) the shell keeps its ‹ Back, untouched until its own mockup.
//   In creation, Back sits in the foot on every step after the first, on a step opened on its own (no counter), and on
//     a first step that asks for it (a redo from the review); never on an ordinary first step, where Leave is the way out.
//   Help me choose is a small button with ⓘ, not a quiet link, and still unfolds the help in place.
//   The fold shows a plus while folded and a minus once open, and its label carries no "›".
//   The typed stepper takes typing and steps with − and +, each named for a screen reader.
//   Pick sits beside the name on every pick row; only a long name lets it wrap under (after-test A6).
//   Every describing row, the first ("Face") too, is its label with the value or a dash under it, the button at the right (A8).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreationLeave, CreationStep, DetailRow, FoldedGroup, OtherRow, PickRow, ScoreTile } from './creation.tsx';
import { HelpMeChoose, TypedStepper } from './parts.tsx';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation((() => {}) as unknown as typeof window.scrollTo);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const step = (at: number | null, backOnFirst = false, onBack = () => {}) => (
  <CreationStep
    title="Class"
    counter={at === null ? undefined : { at, of: null }}
    why="Pick the trade your character follows."
    help="Your class is your trade."
    onBack={onBack}
    hint="Nothing picked"
    onNext={() => {}}
    backOnFirst={backOnFirst}
  >
    <PickRow name="Lantern Warden" picked={false} onPick={() => {}} onOpen={() => {}} />
    <FoldedGroup label="Not open to stone kin: 1" note="marsh chaplain">
      <PickRow name="Marsh Chaplain" picked={false} onPick={() => {}} onOpen={() => {}} />
    </FoldedGroup>
    <OtherRow label="A class the list doesn't have" onAdd={() => {}} onEmpty={() => {}} />
  </CreationStep>
);

const footBack = () => within(document.querySelector('.creation-step__foot') as HTMLElement).queryByRole('button', { name: 'Back to the step before' });

describe('the creation step shell in creation (cw-11)', () => {
  // Purpose (final drafts A1): every step's app bar has ← Back at the left, the title centred and ⋯ at the right
  // holding Leave; no ‹ or › anywhere.
  it('shows ← Back, the title and ⋯ with Leave in the bar, no ‹ or › anywhere, and Leave goes where the host says', async () => {
    const leave = vi.fn();
    const back = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<CreationLeave onLeave={leave}>{step(3, false, back)}</CreationLeave>);
    expect(container.textContent).not.toMatch(/[‹›]/);
    // The fold and Other… opened still draw neither.
    await user.click(screen.getByText('Not open to stone kin: 1'));
    await user.click(screen.getByRole('button', { name: /Other…/ }));
    expect(container.textContent).not.toMatch(/[‹›]/);
    const header = container.querySelector('header') as HTMLElement;
    const [first, title, last] = [...header.children];
    expect(first!.getAttribute('aria-label')).toBe('Back');
    expect(title!.tagName).toBe('H1');
    expect(title!.classList.contains('creation-step__title--centred')).toBe(true);
    expect(last!.getAttribute('aria-label')).toBe('More');
    // The counter sits under the bar, not in it.
    expect(header.textContent).not.toMatch(/Step/);
    await user.click(within(header).getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledTimes(1);
    // ⋯ opens a sheet (final draft 9); nothing kept yet, so its last row reads Leave.
    await user.click(within(header).getByRole('button', { name: 'More' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Leave' }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  // Purpose (final drafts A1, cw-13): on step 1 the foot's Back reads Leave and leaves; the bar's ← leaves too.
  it('on the first step the foot’s Back reads Leave, and ← leaves', async () => {
    const leave = vi.fn();
    const back = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<CreationLeave onLeave={leave}>{step(1, false, back)}</CreationLeave>);
    const foot = container.querySelector('.creation-step__foot') as HTMLElement;
    await user.click(within(foot).getByRole('button', { name: 'Leave' }));
    await user.click(within(container.querySelector('header') as HTMLElement).getByRole('button', { name: 'Back' }));
    expect(leave).toHaveBeenCalledTimes(2);
    expect(back).not.toHaveBeenCalled();
  });

  it('puts Back in the foot after the first step, on a step with no counter, and on a first step that asks; not otherwise (Leave there)', () => {
    const { rerender } = render(<CreationLeave onLeave={() => {}}>{step(1)}</CreationLeave>);
    expect(footBack()).toBeNull();
    rerender(<CreationLeave onLeave={() => {}}>{step(2)}</CreationLeave>);
    expect(footBack()?.textContent).toBe('Back');
    rerender(<CreationLeave onLeave={() => {}}>{step(null)}</CreationLeave>);
    expect(footBack()).not.toBeNull();
    rerender(<CreationLeave onLeave={() => {}}>{step(1, true)}</CreationLeave>);
    expect(footBack()).not.toBeNull();
  });

  it('the foot’s Back goes back a step', async () => {
    const back = vi.fn();
    const user = userEvent.setup();
    render(<CreationLeave onLeave={() => {}}>{step(2, false, back)}</CreationLeave>);
    await user.click(footBack()!);
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('the shell outside creation (New campaign)', () => {
  it('keeps its ‹ Back and has no Leave', async () => {
    const back = vi.fn();
    const user = userEvent.setup();
    const { container } = render(step(1, false, back));
    const header = container.querySelector('header') as HTMLElement;
    expect(header.textContent).toContain('‹');
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    await user.click(within(header).getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  // Purpose (december/29 X5; G-208 flag 2): a step opened in a pop-up of its own has no foot Back unless it asks for
  // one (Weapon skills' To finish pop-up stays as it was); asked, Back sits before Next and does what the bar's ‹ does.
  it('puts Back in the foot only when the step asks (backInFoot)', async () => {
    const plain = (backInFoot: boolean, onBack = () => {}) => (
      <CreationStep title="Expertise" why="Each point makes one skill better." help={null} onBack={onBack} hint="" nextLabel="Done" onNext={() => {}} backInFoot={backInFoot}>
        <p>Skills</p>
      </CreationStep>
    );
    const { unmount } = render(plain(false));
    const foot = () => document.querySelector('.creation-step__foot') as HTMLElement;
    expect(within(foot()).queryByRole('button', { name: 'Back' })).toBeNull();
    unmount();
    const back = vi.fn();
    const user = userEvent.setup();
    render(plain(true, back));
    const buttons = within(foot()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Back', 'Done']);
    expect(buttons[0]!.className).toContain('creation-step__foot-back');
    await user.click(buttons[0]!);
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('Help me choose (cw-11)', () => {
  it('is a small button with ⓘ that unfolds the help in place', async () => {
    const user = userEvent.setup();
    render(<CreationLeave onLeave={() => {}}>{step(2)}</CreationLeave>);
    const help = screen.getByRole('button', { name: 'Help me choose' });
    expect(help.className).toContain('button-secondary--small');
    expect(help.className).not.toContain('button-quiet');
    expect(help.querySelector('svg')).not.toBeNull();
    await user.click(help);
    expect(screen.getByText('Your class is your trade.')).toBeTruthy();
  });
});

describe('the fold (cw-11)', () => {
  it('shows a plus while folded and a minus once open; the label has no ›', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <FoldedGroup label="Family names" note="Stone kin, d20">
        <p>Adderbald</p>
      </FoldedGroup>,
    );
    const square = () => container.querySelector('.creation-fold__square svg path')?.getAttribute('d');
    expect(square()).toBe('M5 12h14M12 5v14');
    expect(screen.getByText('Family names').textContent).toBe('Family names');
    await user.click(screen.getByText('Family names'));
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    expect(square()).toBe('M5 12h14');
  });

  it('starts with a minus when it starts open', () => {
    const { container } = render(
      <FoldedGroup label="Family names" open>
        <p>Adderbald</p>
      </FoldedGroup>,
    );
    expect(container.querySelector('.creation-fold__square svg path')?.getAttribute('d')).toBe('M5 12h14');
  });
});

// Purpose (cw-11): a pick row whose name opens its entry marks the name with ⓘ; a row with no entry has none.
describe('PickRow’s ⓘ (cw-11)', () => {
  it('shows ⓘ before a name that opens its entry, none without one', () => {
    const { container, rerender } = render(<PickRow name="Warden" picked={false} onPick={() => {}} onOpen={() => {}} />);
    expect(container.querySelector('.pick-row__name svg')).not.toBeNull();
    rerender(<PickRow name="Warden" picked={false} onPick={() => {}} />);
    expect(container.querySelector('.pick-row__name svg')).toBeNull();
  });

  it('a closed row has no Pick and its text opens what explains it', async () => {
    const open = vi.fn();
    const user = userEvent.setup();
    render(<PickRow name="Chaplain" fit={[{ text: 'Not open to stone kin', warn: true }]} picked={false} closed onPick={() => {}} onOpen={open} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Chaplain/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('the typed stepper (cw-11)', () => {
  function Harness({ onStep }: { onStep: (by: 1 | -1) => void }) {
    const [value, setValue] = useState('13');
    return <TypedStepper label="Muscle" value={value} onChange={setValue} onStep={onStep} />;
  }

  it('takes typing and steps with − and +, named for a screen reader', async () => {
    const onStep = vi.fn();
    const user = userEvent.setup();
    render(<Harness onStep={onStep} />);
    const box = screen.getByRole('textbox', { name: 'Muscle' });
    await user.clear(box);
    await user.type(box, '999');
    expect((box as HTMLInputElement).value).toBe('999');
    await user.click(screen.getByRole('button', { name: 'Lower Muscle' }));
    await user.click(screen.getByRole('button', { name: 'Raise Muscle' }));
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
    // One element only carries the name, so "the field labelled Muscle" is never ambiguous.
    expect(screen.getAllByLabelText('Muscle')).toHaveLength(1);
  });
});

describe('the typed stepper and its hint (follow-up E)', () => {
  // Purpose: a screen reader hears the hint with the box: the box points at its caption (aria-describedby).
  it('ties the box to its hint, and a score tile to its caption', () => {
    render(
      <>
        <TypedStepper label="Starting coin" value="100" onChange={() => {}} onStep={() => {}} describedBy="coin-hint" />
        <p id="coin-hint">Starts at the usual 100.</p>
        <ScoreTile id="tile" label="Muscle" long="Muscle" value="13" onChange={() => {}} onStep={() => {}} words="+1 melee" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Starting coin' }).getAttribute('aria-describedby')).toBe('coin-hint');
    const box = screen.getByRole('textbox', { name: 'Muscle' });
    expect(document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent).toBe('+1 melee');
  });
});

describe('Help me choose drawn open (the gallery’s #526 specimen)', () => {
  it('defaultOpen shows the help at once, and its ✕ folds it', async () => {
    const user = userEvent.setup();
    render(<HelpMeChoose help="Pick the one that sounds like you, or ask your GM." defaultOpen />);
    expect(screen.getByText('Pick the one that sounds like you, or ask your GM.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(screen.queryByText('Pick the one that sounds like you, or ask your GM.')).toBeNull();
  });

  // Purpose (final drafts A6): open, the help is a box with a ✕ at its top right in place of the button; no worded
  // close button; the ✕ brings the button back, and focus goes with each swap.
  it('opens into a box closed by its ✕, with no worded close button', async () => {
    const user = userEvent.setup();
    render(<HelpMeChoose help="Your class is your trade." />);
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    expect(screen.queryByRole('button', { name: 'Help me choose' })).toBeNull();
    const close = screen.getByRole('button', { name: 'Close help' });
    expect(close.textContent).toBe('✕');
    expect(document.activeElement).toBe(close);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(close);
    expect(screen.queryByText('Your class is your trade.')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Help me choose' }));
  });
});

describe('creation marks itself on screen (after-test A12)', () => {
  it('a step inside creation carries data-creation (the app holds a new version); New campaign’s does not', () => {
    const { unmount } = render(
      <CreationLeave onLeave={() => {}}>
        <CreationStep title="Scores" why="Roll them." help={null} onBack={() => {}} hint="" onNext={() => {}}>
          <p>Tiles</p>
        </CreationStep>
      </CreationLeave>,
    );
    expect(document.querySelector('[data-creation]')).not.toBeNull();
    unmount();
    render(
      <CreationStep title="New campaign" why="Name it." help={null} onBack={() => {}} hint="" onNext={() => {}}>
        <p>Name</p>
      </CreationStep>,
    );
    expect(document.querySelector('[data-creation]')).toBeNull();
  });
});

describe('describing rows alike (after-test A8)', () => {
  it('each row, the first too, is its label with the value or a dash under it, and the button at the right', () => {
    render(
      <>
        <DetailRow label="Face" value="" roll="Roll d10" onOpen={() => {}} />
        <DetailRow label="Speech and manner of talking" value="Hums between words" roll="Roll d10" onOpen={() => {}} />
      </>,
    );
    for (const [label, value, action] of [
      ['Face', '—', 'Roll d10'],
      ['Speech and manner of talking', 'Hums between words', 'Change'],
    ]) {
      const row = screen.getByRole('button', { name: new RegExp(`^${label}:`) });
      const text = row.querySelector('.detail-row__text')!;
      expect([...text.children].map((c) => c.textContent)).toEqual([label, value]);
      expect(row.lastElementChild?.textContent).toBe(action);
    }
  });
});

describe('Pick beside the name (after-test A6)', () => {
  it('a short name keeps Pick on its line; only a long name lets it wrap under', () => {
    render(
      <>
        <PickRow name="Reed Witch" blurb="A long blurb under the name that goes on and on about the reeds and the fens." picked={false} onPick={() => {}} />
        <PickRow name="The Most Venerable Order of the Lantern by the Water" picked={false} onPick={() => {}} />
      </>,
    );
    const row = (name: string) => screen.getByRole('checkbox', { name: `Pick ${name}` }).closest('.pick-row')!;
    expect(row('Reed Witch').classList.contains('pick-row--long')).toBe(false);
    expect(row('The Most Venerable Order of the Lantern by the Water').classList.contains('pick-row--long')).toBe(true);
  });
});
