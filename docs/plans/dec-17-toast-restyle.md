# Plan dec-17: the toast restyled (page 43)

Written by the designer on 2026-11-25. Its ruling: [`../design/rulings/toast-restyle-2026-11-25.md`](../design/rulings/toast-restyle-2026-11-25.md) (tr-1 to tr-7; Francis: "Approve with those recommendations"). Its page: `docs/design/mockups/december/43-the-toast-restyled.html`. Frames **43A to 43G are ruled** (2026-11-25); frame **43H is not approved yet: from its picture** (`december/png/43-h1-*` to `43-h4-*`), with five ⚑ below.

Paths and lines are the branch `mock-toast-restyle`'s at `37e6038`. Examples are invented. Each row follows `REVIEW.md`, the self-review and hard rules 1 to 9. No migration, no new command, no new dependency, no change to any toast's words.

## The rows

| # | What it builds | Rulings | Mockup |
|---|---|---|---|
| T1 | **5 seconds and the pause.** `TOAST_SECONDS` and `--toast-time` go from 6 to 5. While a finger is down on the toast, a mouse pointer is over it, or keyboard focus is inside it (its Undo or action), the timer stops and the bar stops where it is; when the last of those ends, both go on from the same place (the time left, never a fresh 5 seconds). A held toast is still replaced by a new one (tr-7), and Undo or the action still takes it down at once. Nothing new is drawn: no "paused" word, no mark. The two halves ship together or not at all (tr-2) | tr-2, tr-7 | **43G**, ruled 2026-11-25 (the seconds). The held bar is **43H4**: not approved yet. Built to its rules and tests; the bar's stop is shown in the pull request beside 43H4 |
| T2 | **The dress: D, the bar, the words beside the button, the error's ✕, reduced motion.** The toast takes `--radius-sheet`; back, words and shadow as today. The bar: `--toast-bar-ink` (65%) in every theme, inset to the words' edge (`--space-4` each side), lifted `--space-1`, ends rounded (`--radius-pill`). From tablet width (600 px) the words take the room left beside Undo or the action and wrap there; the button drops under, at the right, only when it is wider than half the toast; under 600 px, tw-1 unchanged. An error toast draws the ✕ before its words, level with their first line, in the words' colour, not a button; the words hang clear of it on every line. Reduced motion (the system's setting or the app's `data-motion='reduced'`): the bar is whole and still, then fades over the last second | tr-1, tr-3, tr-4, tr-5, tr-6 | **43D**, ruled 2026-11-25 (the corner and the solid back). **43H1 to 43H4: not approved yet** |

**43H must be approved before the screen half.** T2 is not handed to a builder until Francis approves 43H from its pictures and answers ⚑ H1 to H5. T1 can be built first; it stays a draft, unmerged, until 43H4 is approved (its bar is visible, and tr-2 has only words for it). If he would rather not wait, T1 alone is the smallest thing that answers "its duration is too long".

Both rows change `src/ui/parts.css` and `src/ui/parts.tsx`: **one batch**, branch `dec-17-toast-restyle` from `main`, into `main`, a fresh worker a row. Title: "T1 + T2: the toast restyled (D, 5 s, pause; page 43)".

## Files

| File | What changes |
|---|---|
| `src/ui/parts.tsx`, `Toast` (`:888-937`) | T1: `TOAST_SECONDS = 5` (`:889`) and its comment. The one `setTimeout` (`:915-918`) becomes a timer that can stop and go on with the time left; held while a pointer is down or over the toast or focus is inside it (the builder's call how: pointer events with their `pointerType`, so a finger lifted does not leave a stuck hover; `focusin` and `focusout`). The held state reaches the bar (a class or data attribute that sets `animation-play-state: paused`). T2: the error mark inside `.toast__text` when `error` is set, hidden from the accessibility tree; what is spoken follows ⚑ H3 |
| `src/ui/parts.css`, `.toast*` (`:706-756`, `:1434-1450`) | T2: `border-radius: var(--radius-sheet)`; `.toast__bar` inset, rounded, `opacity` from the new token; `.toast__text`'s flex from 600 px so the button is not dropped needlessly (43H3 drew it as `flex: 1 1 50%`; the layout spec is the contract, not that line); the mark's place and hanging indent; reduced motion: the drain's animation off, a fade over the last second in its place (a second keyframe timed from `--toast-time`, held with the pause). T1: the paused rule |
| `src/ui/tokens.css` (`:156`) | `--toast-time: 5s`; new `--toast-bar-ink` (65%). No glass or blur token (tr-1) |
| `src/ui/ToastHost.tsx` (`:1-2`, `:106-166`) | The header comment (5 seconds, the pause). Nothing else, unless the pause needs the host: replacing a held toast must still work through `key={current.id}` |
| `src/gallery/Gallery.tsx` (`:460-470`) | The Toast specimen's name ("8 seconds" is two rulings stale); add an error toast, a long toast with Undo and a long action, so the layout spec has real ones to measure |
| Gallery pictures | Every gallery baseline that holds a toast redraws (Molecules at least; `tests/layout/gallery-baselines/`). The builder lists them in the pull request; nothing else on those pictures may move |
| Docs, in the same pull request | 03 (`docs/03-roles-permissions.md:98`), 04 (`docs/04-data-model.md:161`) and `docs/testing.md` (`:1565`, `:1634`): 6 seconds becomes the toast's 5. 06: the Toast row's "not built" note and "6 s until built" come out, its Code column is brought up to date; "Toasts with Undo" loses its "not built yet". The ruling's header goes `absorbed` |
| Not changed | Any toast's words; `useToast`, `useToastSwap`, `useSavedToast` and their callers (75 files show a toast: none is touched); the database (the weather roll's 30-second window stays) |

## Tests

Each test's purpose is written first as a plain sentence.

| Kind | File | What it proves |
|---|---|---|
| Vitest | `src/ui/ToastHost.test.tsx` (`:80-99`), T1 | **A toast lasts 5 seconds:** still there at 4.9, gone at 5 (the 6-second test re-pointed, citing tr-2) |
| Vitest | same, T1 | **A held toast waits:** pointer over it at 2 s, still there at 20 s; pointer away, still there 2.9 s later and gone at 3 (the time left, not a fresh 5). The same with focus on Undo, and with a finger down and lifted |
| Vitest | same, T1 | **Two holds at once:** focus on Undo and a pointer over it; the pointer leaves and it still waits; focus leaves and it goes on |
| Vitest | same, T1 | **A held toast is still replaced** by a new one, and the new one runs its own 5 seconds, not held |
| Vitest | same, T1 | **Undo on a held toast** runs once and takes it down; no timer fires after |
| Vitest | same, T2 | **An error toast has the mark and an ordinary one has none;** the mark is not a button and is hidden from the accessibility tree; the alert's spoken words follow ⚑ H3 |
| Layout | `tests/layout/toastWrap.spec.ts`, T2 | **At 1180 px a long toast keeps Undo beside its words** (same line band, the words wrapped to two lines, Undo at least 44 px tall and 8 px from them); **a button wider than half the toast still drops under, at the right;** at 375 px every tw-1 measure holds unchanged. The bar: inset by the same amount each side, inside the toast, its ends clear of the corner (the "bar across its full width" measure is replaced, with the reason in the file's header) |
| Layout | same or a new `toastDress.spec.ts`, T2 | **The error's mark sits level with the first line** of a one-line and a three-line error at 375 and 1180, light and dark, and no word starts under it; the corner is `--radius-sheet`; no sideways scroll |
| Layout | `tests/layout/gallery.spec.ts` (`:231-236`), T2 | **Under reduced motion the bar does not move:** its width is the same at the start and near the end (the test today asks for no animation at all; it now allows the fade and nothing else), and it is fainter in the last second |
| Layout | T1 | **The bar stops while held:** hover the gallery's toast, read the bar's width twice a moment apart, the same; move away, it shrinks |
| Not automated | | How the hold feels under a finger on a real tablet; Safari on an iPad. In the pull request's manual checks |

## States

| State | T1 | T2 |
|---|---|---|
| With Undo, with an action, with neither | all three time, hold and go alike | all three in the dress; the one-line toast with neither follows ⚑ H5 |
| Error | holds like any other; still goes after its seconds (◈, `dec-evening-2026-11-13.md`) | the ✕ |
| Long words, long button | | 43H3: beside from 600 px, under when no room, tw-1 under 600 px |
| Held | the bar stops; nothing else | |
| Reduced motion | the timer and the pause are the same | still, then fading |
| Replaced while held | the new one shows and runs | |
| Offline, loading, empty | the toast does not change with them | |
| Larger text | | checked at 375 px in the layout spec; not drawn |
| The app in the background | as today: the timer runs. Not ruled, not changed | |

## Estimate

**2½ to 3½ builder turns**, one batch. T1: about 1 (the timer, the three ways to hold, five tests). T2: 1½ to 2½ (the CSS is small; the layout spec rewritten for two widths, the gallery specimens and the redrawn baselines are most of it). One review, one layout check.

## ⚑ for this plan

Collected, not decided. H1 to H5 are 43H's and are answered with its approval.

1. **H1. Which mark:** the bare ✕ (drawn) or the ✕ on a disc.
2. **H2. The reduced-motion fade:** over the last second, as drawn?
3. **H3. What a screen reader hears for the mark:** "Problem", as the Note part says, or nothing.
4. **H4. A toast as wide as its words on a tablet** (the app's, and 43H's) or stretched to the full width (as 43A to 43G drew it). Built as the app's until ruled.
5. **H5. A one-line toast with no button is a pill** (40 px tall, 20 px corners). Fine, or 60 px like one with Undo?
6. **"When there is room" (tr-5)** is read as: from 600 px, unless the button is wider than half the toast. The designer's reading, drawn in 43H3.
7. **A hold longer than the weather roll's 30 seconds:** Undo still shows and its tap is refused in the usual words. Built so; say if the toast should drop its Undo instead.
8. **The garb swap's toast (gs-5a)** leads with its failure. If the app shows it as an ordinary toast and not an error one, it gets no ✕ until someone says it should: the builder reports which it is.

## Honest notes

- **Not run:** the app. Read from the source and from page 43's pictures.
- **Not drawn:** anything moving (the drain, the hold, the fade are still pictures); Larger text; an error toast with a button (the app has none).
- **Fragile:** touch and hover together. A finger lifted can leave a hover that never ends on some tablets; the tests above ask for it by name, and it wants a real iPad before the merge.
- **A test that must change, not only be added to:** `toastWrap.spec.ts` asserts today that the long toast's button drops under at 1180 px and that the bar spans the full width. Both were approved as built on 13 November (tw-1) and are changed by tr-5 and tr-6.
- **Costs build time for little:** the reduced-motion fade is a second animation that must also obey the pause. If it proves awkward, the builder stops and asks; it does not drop tr-4 quietly.
- **Line numbers** will drift.
