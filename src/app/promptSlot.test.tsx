// @vitest-environment jsdom
// The players' prompt slot (B18), newest on top (SC-g6-4, ruled B by Francis 2026-11-03). Invented prompts.
//   What is there when the screen opens keeps the given order (rest, request, message, No light, weather).
//   A prompt that arrives later sits above the older ones.
//   A prompt replaced by a new one of its kind (a new message: its data-prompt-id changes) goes back on top.
//   A prompt that goes and comes back comes back on top.
//   While focus is inside the slot, nothing moves; it moves when focus leaves.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptSlot, slotOrder } from './PromptSlot.tsx';

afterEach(() => cleanup());

const shownOrder = () => screen.queryAllByRole('article').map((a) => a.getAttribute('aria-label'));

function Card({ name, id, on }: { name: string; id?: string; on: boolean }) {
  return on ? (
    <article aria-label={name} data-prompt-id={id}>
      <p>{name}</p>
      <button type="button">{`Answer ${name}`}</button>
    </article>
  ) : null;
}

function Slot({ rest, message, messageId = 'm1', weather = false, settleMs = 0 }: { rest: boolean; message: boolean; messageId?: string; weather?: boolean; settleMs?: number }) {
  return (
    <PromptSlot settleMs={settleMs}>
      <Card key="rest" name="Rest due" on={rest} />
      <Card key="message" name="Message from the GM" id={messageId} on={message} />
      <Card key="weather" name="Weather" on={weather} />
    </PromptSlot>
  );
}

/** Lets the slot's watcher see the change (it runs after the DOM changes). */
const settle = () => act(() => new Promise((r) => setTimeout(r, 5)));

describe('the prompt slot', () => {
  it('orders by arrival, newest first, and keeps the given order for a tie', () => {
    expect(slotOrder(['rest', 'message', 'weather'], new Map())).toEqual(['rest', 'message', 'weather']);
    expect(slotOrder(['rest', 'message', 'weather'], new Map([['weather', 20], ['message', 10]]))).toEqual(['weather', 'message', 'rest']);
  });

  it('keeps the given order for what is there when the screen opens', async () => {
    render(<Slot rest message weather settleMs={60_000} />);
    await settle();
    expect(shownOrder()).toEqual(['Rest due', 'Message from the GM', 'Weather']);
  });

  it('a newer prompt sits above an older one', async () => {
    const view = render(<Slot rest message={false} />);
    await settle();
    expect(shownOrder()).toEqual(['Rest due']);
    await new Promise((r) => setTimeout(r, 5));
    view.rerender(<Slot rest message />);
    await settle();
    expect(shownOrder()).toEqual(['Message from the GM', 'Rest due']);
  });

  it('a new message (its id changes) goes back on top; a prompt that comes back comes back on top', async () => {
    const view = render(<Slot rest={false} message />);
    await settle();
    await new Promise((r) => setTimeout(r, 5));
    view.rerender(<Slot rest message />);
    await settle();
    expect(shownOrder()).toEqual(['Rest due', 'Message from the GM']);
    await new Promise((r) => setTimeout(r, 5));
    view.rerender(<Slot rest message messageId="m2" />);
    await settle();
    expect(shownOrder()).toEqual(['Message from the GM', 'Rest due']);
    view.rerender(<Slot rest={false} message messageId="m2" />);
    await settle();
    await new Promise((r) => setTimeout(r, 5));
    view.rerender(<Slot rest message messageId="m2" />);
    await settle();
    expect(shownOrder()).toEqual(['Rest due', 'Message from the GM']);
  });

  it('nothing moves while focus is inside the slot; it moves when focus leaves', async () => {
    const view = render(
      <>
        <Slot rest message={false} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await settle();
    screen.getByRole('button', { name: 'Answer Rest due' }).focus();
    await new Promise((r) => setTimeout(r, 5));
    view.rerender(
      <>
        <Slot rest message />
        <button type="button">Elsewhere</button>
      </>,
    );
    await settle();
    expect(shownOrder()).toEqual(['Rest due', 'Message from the GM']);
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    await settle();
    expect(shownOrder()).toEqual(['Message from the GM', 'Rest due']);
  });
});
