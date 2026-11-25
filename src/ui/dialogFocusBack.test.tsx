// @vitest-environment jsdom
// Focus goes back to the opener on every close (fix-dialog-focus-on-close; Home Two's impeccable audits, 24–25 Nov):
// when a pop-up closes without an action that moves focus on purpose (✕, Escape, a tap outside), keyboard focus goes
// back to the control that opened it, never to the page's body. An action that moves focus on purpose keeps its own
// target, and an opener gone from the page (or disabled) is left alone, with no error.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from './Dialog.tsx';

afterEach(cleanup);

/** A page with an opener and a pop-up; `onLit` is an action inside it that closes it and moves focus on purpose. */
function Page({ withOpener = true, disabledOpener = false, focusInEffect = false }: { withOpener?: boolean; disabledOpener?: boolean; focusInEffect?: boolean }) {
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
        <button type="button" disabled={disabledOpener} onClick={() => setOpen(true)}>
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
  it.fails('✕ gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: Escape closes the pop-up and focus lands on the button that opened it.
  it.fails('Escape gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: a mouse's press on the dimmed page closes the pop-up and focus lands on the opener.
  it.fails('a mouse tap outside gives focus back to the opener', async () => {
    render(<Page />);
    const opener = await openByKey();
    await act(async () => {
      fireEvent.pointerDown(document.querySelector('.dialog__backdrop')!, { pointerType: 'mouse' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Purpose: a finger's tap on the dimmed page (closing on its click) also gives focus back to the opener.
  it.fails('a finger tap outside gives focus back to the opener', async () => {
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
  it.fails('a tapped opener that never took focus still gets it back', async () => {
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

  // Purpose: a disabled opener is never given focus (it can't take it): focus is left alone, with no error.
  it('a disabled opener is not focused', async () => {
    const { rerender } = render(<Page />);
    await openByKey();
    rerender(<Page disabledOpener />);
    // Disabled while the pop-up is open, and still disabled as it closes.
    const opener = screen.getByRole('button', { name: 'Open' }) as HTMLButtonElement;
    expect(opener.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(document.activeElement).not.toBe(opener);
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
  it.fails('✕ on a later step goes back to the button that opened the first', async () => {
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
  it.fails('Escape on a pop-up opened from a pop-up goes back to its button there', async () => {
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
});
