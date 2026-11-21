// A busy button ignores taps (06, Buttons: default, pressed, busy; never disabled). While its action runs a button
// carries aria-busy="true" instead of `disabled`: it stays in the tab order and keeps its look's busy cue, and a second
// tap does nothing. One listener on the document, in the capture phase, so it runs before React's own handlers and
// stops a busy submit button from sending its form twice. Installed once, by the parts every screen imports.

let installed = false;

/** Whether a click on this target lands on a busy button (or inside one). */
export function onBusyButton(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button[aria-busy="true"]') !== null;
}

export function installBusyGuard(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (installed || !doc) return;
  installed = true;
  doc.addEventListener(
    'click',
    (event) => {
      if (!onBusyButton(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
