// @vitest-environment jsdom
// The strip (plan dec-9-the-whole-scene S7; mc-53, mc-55, mc-56, mc-60; page 16, T1, T2, T8; invented steps only).
//   Purpose: the strip shows the procedure's steps in order, each in its circle with its icon (or its number where the
//   pack names none it knows); it has no heading and no state (nothing marks a step current, done or due); each circle
//   is named for a screen reader, with the words under it on a tablet and hidden on a phone; a step whose pack carries
//   text is a button that opens it, and a step without text has no tap and is not a button; with no steps there is no
//   strip.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { blocksOfRead } from '../modules/expedition/placeRules.ts';
import { APP_STEPS, type StripStep } from '../modules/expedition/stripSteps.ts';
import { RuleSheet } from './PlaceRules.tsx';
import { ProcedureStrip } from './SceneProcedure.tsx';

afterEach(() => cleanup());

const steps: StripStep[] = [
  { id: 'moor', name: 'Moor the boat', icon: 'water-splash', text: { blocks: [{ kind: 'p', text: 'Tie off at the posts.' }] } },
  { id: 'listen', name: 'Listen at the reeds', icon: 'listen', text: null },
  { id: 'wade', name: 'Wade in', icon: 'no-such-icon', text: null },
  { id: 'tide', name: 'Mind the tide', icon: null, text: 'The water rises at dusk.' },
];

/** The Scene's own wiring: a tap opens the step's text in the rule sheet. */
function Harness({ list }: { list: readonly StripStep[] }) {
  const [open, setOpen] = useState<StripStep | null>(null);
  return (
    <>
      <ProcedureStrip steps={list} onOpen={setOpen} />
      {open && <RuleSheet placeName="" name={open.name} blocks={blocksOfRead(open.text)} onClose={() => setOpen(null)} />}
    </>
  );
}

const stepsOf = () => [...screen.getByRole('group', { name: 'Sequence of play' }).querySelectorAll('.procedure-strip__step')];

describe('the strip (S7)', () => {
  it('shows the steps in order, each in its circle with its icon, else its number', () => {
    render(<Harness list={steps} />);
    const shown = stepsOf();
    expect(shown.map((s) => s.textContent)).toEqual(['Moor the boat', 'Listen at the reeds', '3Wade in', '4Mind the tide']);
    // The set's icon and the step symbol's drawing are each an svg in the circle; the unknown name and no name show the number.
    expect(shown.map((s) => !!s.querySelector('.procedure-strip__circle svg'))).toEqual([true, true, false, false]);
    expect(shown.map((s) => s.querySelector('.procedure-strip__number')?.textContent ?? null)).toEqual([null, null, '3', '4']);
    // Dotted links between the circles, one fewer than the steps.
    expect(document.querySelectorAll('.procedure-strip__link')).toHaveLength(3);
  });

  it("shows the app's own five with their icons", () => {
    render(<Harness list={APP_STEPS} />);
    expect(stepsOf().map((s) => s.getAttribute('aria-label'))).toEqual(['Describe', 'Question', 'Act', 'Test', 'Resolve']);
    expect(document.querySelectorAll('.procedure-strip__circle svg')).toHaveLength(5);
  });

  it('has no heading and no state', () => {
    const { container } = render(<Harness list={steps} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText(/sequence of play/i)).toBeNull();
    expect(container.querySelector('[aria-current]')).toBeNull();
    expect(container.querySelector('[class*="--current"], [class*="--done"], [class*="--due"]')).toBeNull();
    expect(container.textContent).not.toMatch(/now|done|due|✓/i);
  });

  it('names each circle for a screen reader; the words under it hide on a phone only', async () => {
    render(<Harness list={steps} />);
    expect(screen.getAllByRole('img').map((s) => s.getAttribute('aria-label'))).toEqual(['Listen at the reeds', 'Wade in']);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Moor the boat: read it', 'Mind the tide: read it']);
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
    const css = fs.readFileSync('./src/app/SceneExplore.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const phone = css.slice(css.indexOf('@media (max-width: 599px)'));
    expect(phone).toMatch(/\.procedure-strip__name\s*\{\s*display:\s*none;/);
    expect(css.slice(0, css.indexOf('@media (max-width: 599px)'))).not.toMatch(/\.procedure-strip__name\s*\{[^}]*display:\s*none/);
  });

  it('opens a step whose pack carries text, and gives a step without text no tap', async () => {
    const user = userEvent.setup();
    render(<Harness list={steps} />);
    const listen = stepsOf()[1]!;
    expect(listen.tagName).not.toBe('BUTTON');
    expect(listen.closest('button')).toBeNull();
    await user.click(listen);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Moor the boat: read it' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Moor the boat' }));
    expect(sheet.getByText('Tie off at the posts.')).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Mind the tide: read it' }));
    expect(within(screen.getByRole('dialog', { name: 'Mind the tide' })).getByText('The water rises at dusk.')).toBeTruthy();
  });

  it('shows no strip with no steps', () => {
    const { container } = render(<Harness list={[]} />);
    expect(container.querySelector('.procedure-strip')).toBeNull();
  });
});
