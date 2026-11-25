// Never open the keyboard automatically (ruled 2026-11-01, M5 gate A4; docs/06 "Conventions"): no screen or pop-up
// puts the cursor in a text field when it opens. A read of every screen's source, so a new `autoFocus` or `.focus()`
// is caught the day it's added. Pop-ups (Dialog) are checked in Dialog.test.tsx.
import { describe, expect, it } from 'vitest';

// Node's file reader, loaded by name so the app's type settings needn't include Node (as designSystem.test.ts does).
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const sources = Object.fromEntries(
  Object.keys(import.meta.glob(['/src/**/*.tsx', '/src/**/*.ts', '!/src/**/*.test.tsx', '!/src/**/*.test.ts', '!/src/testing/**'])).map((p) => [p, fs.readFileSync(`.${p}`, 'utf8')]),
);

/** The JSX tag an attribute at `at` belongs to: the last `<Name` before it. */
function tagAt(source: string, at: number): string {
  const before = source.slice(Math.max(0, at - 2000), at);
  const tags = [...before.matchAll(/<([A-Za-z][\w.]*)/g)];
  return tags.at(-1)?.[1] ?? '';
}

/**
 * Calls to `.focus()` that move focus on purpose, none of them into a text field: a heading or panel for screen
 * readers, a menu's button, a pop-up's card or first button. A new one fails here: check it never focuses a text field
 * on open, then add it.
 */
const FOCUS_CALLS: Record<string, number> = {
  '/src/app/campaignLog.tsx': 5,
  // Back to ≡ when the phone's drawer closes (slice E): a button. And the GM's view's heading, the character's name
  // (a span, tabindex -1), as the view opens from a door (audit fix 3b on #85): never a field.
  '/src/app/TopRow.tsx': 2,
  // Back to the phone's Log tab when the log closes (slice E): a button.
  '/src/app/PlayerScreen.tsx': 1,
  // Back to the GM's Log tab when the log closes (Design on #549): a button.
  '/src/app/GmCampaign.tsx': 1,
  // Back to the Reference button on close; a phone's panel heading on open (never the search field).
  '/src/app/GmReference.tsx': 2,
  // A bundle's import over (B14 audits 1 and 3): the new pack's Browse, a button; else Import a file's file input. Never a
  // text field.
  '/src/app/LibraryScreen.tsx': 1,
  // Go to number (M5b step g3): the row found, a button, never a field.
  '/src/app/EncounterTables.tsx': 1,
  // A stat block in full (December 5c, #642 review): its heading on open, the View button that opened it on Back; and
  // (S8b) the heading again when the waiting card's link opens the pop-up on the creature. Never a field.
  '/src/app/EncounterWaiting.tsx': 3,
  // Back to Reveal… as the GM's own sheet for the item closes (Francis's A on #85, 24 Nov): a button, never a field.
  '/src/app/ItemSheet.tsx': 1,
  '/src/app/NewCampaign.tsx': 1,
  '/src/app/RulesBrowser.tsx': 1,
  '/src/app/RulesForCampaign.tsx': 1,
  // The GM's place page (#785): focus given back to where it already was, inside a waiting card whose node just moved
  // between the strip and the page; never a field the GM hadn't tapped. And (S8a, #857's review) a row of "Waiting for
  // you" opened by a tap: its card's first button or link, or its heading, never a text field.
  '/src/app/sceneWaiting.tsx': 2,
  '/src/ui/Dialog.tsx': 3,
  // ⋯ back to its button as its sheet closes (plan m5b-players-screens-standard A1): a button. And (audit fix 3c on
  // #85) the panel's first item when ⋯ is opened from the keyboard: a menu button or link, never a field.
  '/src/ui/MoreMenu.tsx': 3,
  // The GM's player-only pop-up (audit fix 3a on #85): back to the button that opened it as it closes, a button.
  '/src/app/playerOnly.tsx': 1,
  // Help me choose (final drafts A6): the ✕ on open, the button on close; both buttons.
  '/src/ui/parts.tsx': 1,
  // Back to the burden's tier as the Burden pop-up closes (tfb-4, row C7): a button.
  '/src/app/LoadSummary.tsx': 1,
  // The Light pop-up's pick step (P10 audit 2–3): the first light's button as the pick opens, and Light again on Back;
  // both buttons.
  '/src/app/LightSection.tsx': 2,
  // Back to the Scene's Light fact once a light is lit (P10 audit 1): the fact, a button, never a field.
  '/src/app/SceneTime.tsx': 1,
  // Back to the hoard's piece as its sheet closes (B15, impeccable audit 1): the piece's words, a button; and after a
  // send that leaves things (Francis picked A, 24 Nov), the hoard's first row not sent, a button. Never a field.
  '/src/app/HoardSheet.tsx': 2,
  // After "Got it" folds a call (P7, impeccable audit finding 1): the next card's "Got it", else the folded row; both
  // buttons, never a field.
  '/src/app/CallCard.tsx': 1,
};

describe('no keyboard on open (A4)', () => {
  // A text field never has autoFocus, unless a spec allows it and the line above says "A4 allows it".
  it('no input or text area has autoFocus', () => {
    const found: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      for (const m of source.matchAll(/\bautoFocus\b/g)) {
        const tag = tagAt(source, m.index);
        const allowed = source.slice(Math.max(0, m.index - 200), m.index).includes('A4 allows it');
        if (tag !== 'button' && !allowed) found.push(`${path}: autoFocus on <${tag}>`);
      }
    }
    expect(found).toEqual([]);
  });

  // Every .focus() call is one of those checked: none puts the cursor in a text field.
  it('every .focus() call is a known one that never focuses a text field', () => {
    const counts = Object.fromEntries(
      Object.entries(sources)
        .map(([path, source]) => [path, [...source.matchAll(/\.focus\(/g)].length] as const)
        .filter(([, n]) => n > 0),
    );
    expect(counts).toEqual(FOCUS_CALLS);
  });
});
