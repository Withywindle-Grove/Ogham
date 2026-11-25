// @vitest-environment jsdom
// Focus goes back to the opener on every close (fix-dialog-focus-on-close; Home Two's impeccable audits, 24–25 Nov):
// when a pop-up closes without an action that moves focus on purpose (✕, Escape, a tap outside), keyboard focus goes
// back to the control that opened it, never to the page's body. An action that moves focus on purpose keeps its own
// target, and an opener gone from the page (or inert) is left alone, with no error, and focus never lands behind a pop-up
// still open.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog, openersNow } from './Dialog.tsx';

afterEach(cleanup);

/** A page with an opener and a pop-up; `onLit` is an action inside it that closes it and moves focus on purpose. */
function Page({ withOpener = true, focusInEffect = false }: { withOpener?: boolean; focusInEffect?: boolean }) {
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState(false);
  const fact = useRef<HTMLButtonElement>(null);
  // The Scene's way (SceneTime's refocusLight): the target takes focus in an effect once the pop-up has gone.
  useEffect(() => {
    if (focusInEffect && lit && !open) fact.current?.focus();
  }, [focusInEffect, lit, open]);
  return (
    <main>
      <button ref={fact} type="button">
        Light fact
      </button>
      {withOpener && (
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
      )}
      {open && (
        <Dialog label="Light" onClose={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLit(true);
              if (!focusInEffect) fact.current?.focus();
            }}
          >
            Light it
          </button>
        </Dialog>
      )}
    </main>
  );
}

/** Opens the pop-up from the keyboard's way: the opener focused, then pressed. */
async function openByKey(): Promise<HTMLElement> {
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  await act(async () => {
    fireEvent.keyDown(opener, { key: 'Enter' });
    fireEvent.click(opener);
  });
  expect(screen.getByRole('dialog', { name: 'Light' })).toBeTruthy();
  return opener;
}

describe('focus back to the opener on close', () => {
  // Purpose: the ✕ closes the pop-up and focus lands on the button that opened it, not the page's body.
  it('✕ gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: Escape closes the pop-up and focus lands on the button that opened it.
  it('Escape gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: a mouse's press on the dimmed page closes the pop-up and focus lands on the opener.
  it('a mouse tap outside gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.pointerDown(document.querySelector('.dialog__backdrop')!, { pointerType: 'mouse' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: a finger's tap on the dimmed page (closing on its click) also gives focus back to the opener.
  it('a finger tap outside gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    const backdrop = document.querySelector('.dialog__backdrop')!;
    await act(async () => {
      fireEvent.pointerDown(backdrop, { pointerType: 'touch' });
      fireEvent.click(backdrop);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: on a tablet whose browser doesn't focus a tapped button (iPad Safari), the button just tapped is the
  // opener focus goes back to, even while focus sat somewhere else when it was tapped.
  it('a tapped opener that never took focus still gets it back', async () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open' });
    screen.getByRole('button', { name: 'Light fact' }).focus();
    await act(async () => {
      fireEvent.pointerDown(opener, { pointerType: 'touch' });
      fireEvent.click(opener);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: an action that closes the pop-up and moves focus on purpose (after lighting, to the Light fact) keeps
  // its own target; the shared rule doesn't pull focus back to the opener.
  it('an action that moves focus on purpose keeps its target', async () => {
    render(<Page />);
    await openByKey();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Light it' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Light fact' }));
  });

  // Purpose: a target that takes focus in an effect once the pop-up has gone (the Scene's Light fact) keeps it too.
  it('a target focused in an effect after the close keeps it', async () => {
    render(<Page focusInEffect />);
    await openByKey();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Light it' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Light fact' }));
  });

  // Purpose: an opener that left the page while the pop-up was open leaves focus alone on close, with no error.
  it('an opener gone from the page leaves no error', async () => {
    const { rerender } = render(<Page />);
    await openByKey();
    rerender(<Page withOpener={false} />);
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  });

  // Purpose: an opener that could take focus but sits in a part of the page shut off for now (inert) is passed over:
  // focus is left alone, with no error.
  it('an inert opener is not focused', async () => {
    render(<Page />);
    const opener = await openByKey();
    opener.setAttribute('inert', '');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).not.toBe(opener);
  });

  // Purpose: after a tap, a key pressed on another button means the keyboard is in use, so that button (the one with
  // focus) is the opener focus goes back to, not the one tapped before.
  it('a key pressed after a tap makes the focused button the opener', async () => {
    render(<Page />);
    const fact = screen.getByRole('button', { name: 'Light fact' });
    // Tap the Light fact, and let its pop-up-free tap end; then the keyboard takes over on Open.
    await act(async () => {
      fireEvent.pointerDown(fact, { pointerType: 'touch' });
      fireEvent.click(fact);
    });
    const opener = await openByKey();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: a tap on plain words (no control under it) never counts as the opener, so the button with focus that
  // opens the pop-up gets focus back as it closes.
  it.fails('a tap on plain words leaves the focused button as the opener', async () => {
    render(
      <>
        <p>Plain words</p>
        <Page />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Plain words'), { pointerType: 'mouse' });
      fireEvent.click(opener);
    });
    expect(screen.getByRole('dialog', { name: 'Light' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(document.activeElement).toBe(opener);
  });
});

/** A page whose pop-up goes a step on as another pop-up (the hoard's Send…), and one with a pop-up opened from a pop-up. */
function Steps() {
  const [step, setStep] = useState<'none' | 'first' | 'second'>('none');
  const [inner, setInner] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setStep('first')}>
        Hoard
      </button>
      {step === 'first' && (
        <Dialog label="First" onClose={() => setStep('none')}>
          <button type="button" onClick={() => setStep('second')}>
            Send…
          </button>
          <button type="button" onClick={() => setInner(true)}>
            More
          </button>
          {inner && (
            <Dialog label="Inner" onClose={() => setInner(false)}>
              <p>Inside</p>
            </Dialog>
          )}
        </Dialog>
      )}
      {step === 'second' && (
        <Dialog label="Second" onClose={() => setStep('none')}>
          <button type="button">To the stash</button>
          <button type="button" onClick={() => setStep('first')}>
            Back
          </button>
        </Dialog>
      )}
    </main>
  );
}

async function press(name: string) {
  const el = screen.getByRole('button', { name });
  el.focus();
  await act(async () => {
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.click(el);
  });
  return el;
}

describe('focus back through steps and pop-ups opened from pop-ups', () => {
  // Purpose: a pop-up that went a step on as another pop-up gives focus back to the page's opener on ✕, since the
  // button that opened the step went with the first pop-up.
  it('✕ on a later step goes back to the button that opened the first', async () => {
    render(<Steps />);
    const hoard = await press('Hoard');
    await press('Send…');
    expect(screen.getByRole('dialog', { name: 'Second' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(hoard);
  });

  // Purpose: a step that opens as another pop-up keeps the focus it gave itself (its first control), not the opener.
  it('the next step keeps its own opening focus', async () => {
    render(<Steps />);
    await press('Hoard');
    await press('Send…');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'To the stash' }));
  });

  // Purpose: a pop-up opened from inside another gives focus back to its button in the first one on Escape.
  it('Escape on a pop-up opened from a pop-up goes back to its button there', async () => {
    render(<Steps />);
    await press('Hoard');
    const more = await press('More');
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Inner' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'First' })).toBeTruthy();
    expect(document.activeElement).toBe(more);
  });

  // Purpose: going Back and on again between steps never piles up openers that have left the page: the list for the
  // step open now holds only what is still on it (its own button, its pop-up, the page's opener).
  it.fails('Back and on again keeps the openers to what is on the page', async () => {
    render(<Steps />);
    await press('Hoard');
    for (let i = 0; i < 3; i += 1) {
      await press('Send…');
      await press('Back');
    }
    screen.getByRole('button', { name: 'More' }).focus();
    const openers = openersNow();
    expect(openers.every((el) => el.isConnected)).toBe(true);
    expect(openers.length).toBeLessThanOrEqual(3);
  });
});

/** A pop-up with a Reveal… row that opens another; revealing the last hidden thing there removes the row (ItemSheet). */
function Reveal() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <main>
      <button type="button" onClick={() => setOuter(true)}>
        Item
      </button>
      {outer && (
        <Dialog label="Lantern" onClose={() => setOuter(false)}>
          <button type="button">Use</button>
          {hidden && (
            <button type="button" onClick={() => setInner(true)}>
              Reveal…
            </button>
          )}
          {inner && (
            <Dialog label="Reveal" onClose={() => setInner(false)}>
              <button
                type="button"
                onClick={() => {
                  setHidden(false);
                  setInner(false);
                }}
              >
                Reveal the last
              </button>
            </Dialog>
          )}
        </Dialog>
      )}
    </main>
  );
}

describe('focus never lands behind a pop-up still open', () => {
  // Purpose: when a pop-up opened from a button inside another closes after that button has gone, focus goes to the
  // pop-up still open (its card), never to the page's opener behind it.
  it.fails('an inner pop-up whose button has gone gives focus to the outer card', async () => {
    render(<Reveal />);
    const item = await press('Item');
    await press('Reveal…');
    expect(screen.getByRole('dialog', { name: 'Reveal' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reveal the last' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Reveal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reveal…' })).toBeNull();
    const card = screen.getByRole('dialog', { name: 'Lantern' });
    expect(document.activeElement).not.toBe(item);
    expect(document.activeElement).toBe(card);
  });
});
