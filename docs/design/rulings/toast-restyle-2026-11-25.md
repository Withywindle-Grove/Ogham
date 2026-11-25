---
status: pending
milestone: December first play (the toast, app-wide; plan `docs/plans/dec-17-toast-restyle.md`, rows T1 and T2)
absorbed-into: docs/06-screens-and-design.md (Toasts with Undo; Words batch 1's Toasts line; Design tokens, Shapes; the Toast, Weather card and Messages rows; Pop-ups), docs/05-features.md (the weather roll's Undo; Messaging's Send), docs/10-open-questions.md (the toast's seconds), docs/09-decisions-log.md (2026-11-25). Frame 43H approved 2026-11-25 with its fixes drawn (tr-8 to tr-14). Pending until rows T1 and T2 are built; 03, 04 and `docs/testing.md` still say 6 seconds and change with the build
supersedes: nothing as a file. tr-2 replaces mm-6's 6 seconds (`m5c-magic-mockups-2026-11-10.md`). tr-3 reverses what the garb toast's approval left as it was on 13 November, "nothing but its words marks it as an error" (`dec-evening-2026-11-13.md`, Settled since, gs-5a). tr-5 amends tw-1 (`dec-night-and-morning-2026-11-13.md`) from tablet width only. Those files stand as written
---

# The toast restyled: D, 5 seconds, a pause (2026-11-25)

Francis asked on 25 November: "How easy is it to change the toast? I don't think it looks good and its duration is too long. I want impeccable's opinion. I'm thinking rounded edges and partially opaque frosted glass." Page 43 drew four dresses (A today, B rounded glass, C a pill in glass, D rounded and solid) and the duration panel. Home Two ran `impeccable critique` on it the same day (29/40) and chose D. Shown its recommendations in the driver's chat, he said: **"Approve with those recommendations."** The seven recommendations are as the driver relayed them; only the words in quotes are his own.

Mockup: `docs/design/mockups/december/43-the-toast-restyled.html`. Frames 43A to 43G are **ruled** by this file (`december/png/43-a-*` to `43-g-*`). Frame **43H** (`43-h1-*` to `43-h4-*`) was drawn after the ruling and is **approved 2026-11-25 with its fixes drawn** (tr-8 to tr-14, below).

## Ruled

| # | Ruling | Frame |
|---|---|---|
| tr-1 | **The dress is D: rounded and solid.** The sheet's corner (`--radius-sheet`), today's solid back and shadow. No glass: B and C are not followed, and no `--toast-glass` or `--toast-blur` token is added. | 43D, ruled |
| tr-2 | **A toast lasts 5 seconds** (replaces mm-6's 6), **and only with a pause**: while a finger, a mouse pointer or keyboard focus is on the toast, the timer and the draining bar stop; both go on from where they were after. The two are one ruling: 5 seconds is not built without the pause. | 43G, ruled; the held bar 43H4 |
| tr-3 | **The error toast carries the ✕**, 06's danger shape ("every semantic colour carries a shape"). This reverses 13 November, when the garb swap's failure toast was approved with nothing but its words marking it (`dec-evening-2026-11-13.md`, gs-5a). It needs a frame first. Its form: tr-9. | 43H1, 43H2: approved 2026-11-25 |
| tr-4 | **Reduced motion:** the bar stays still and fades at the end, so there is still a countdown. "At the end" is amended by tr-10: over the whole time. | 43H4: approved 2026-11-25, redrawn to tr-10 |
| tr-5 | **On a tablet, the long toast's words wrap beside Undo** when there is room; Undo is not dropped to its own line needlessly. On narrow widths it still wraps under, at the right, as tw-1 says. | 43H3: approved 2026-11-25 |
| tr-6 | **The bar is at 65% strength (`--toast-bar-ink`) in every theme**, inset and rounded to fit the corner. | 43H4 and every 43H toast: approved 2026-11-25 |
| tr-7 | **A new toast still replaces the one showing.** The log keeps the Undo. 06's toast spec says so. | none: as built |

## Ruled on 43H (2026-11-25, later the same day)

Home Two ran `impeccable critique` on the eight 43H pictures (32/40; its text is a comment on pull request #95). The driver put seven recommendations to Francis in its chat, and he said again: **"Approve with those recommendations."** The recommendations are as the driver relayed them; only the words in quotes are his own. 43H is redrawn to them and is **approved 2026-11-25 with these fixes drawn**. He approved the recommendations, not the redrawn pictures, which he had not yet seen.

| # | Ruling | Critique | Frame |
|---|---|---|---|
| tr-8 | **An error toast stays longer: 5 seconds, plus 1 second for each line over two.** It pauses under a finger, a pointer or keyboard focus like every toast (tr-2). It does **not** stay until it is tapped away, and it gets no close button. Every other toast stays 5 seconds whatever its length. | 1 (high): a long error was gone before it was read, and an error's words are not in the log | 43H1, with its table of seconds |
| tr-9 | **The error's mark is the ✕ on a disc** (43H2's way 2), not the bare ✕, which read as "close" on a short toast. Answers ⚑ H1. | 3 | 43H1, 43H2 |
| tr-10 | **Reduced motion: the bar stays whole and still and fades over the toast's whole time,** from its 65% to nothing, not over the last second. Amends tr-4's "at the end". Answers ⚑ H2. | 2 | 43H4 |
| tr-11 | **Every toast is at least 60 px tall,** the height of one with Undo. No toast is a pill. Answers ⚑ H5. | 4 | 43H1, 43H4 ("Saved") |
| tr-12 | **On a phone (under 600 px) the toast fills the width between the margins. On a tablet it is as wide as its words,** as the app draws it. Answers ⚑ H4. | 6 | 43H1, 43H3 |
| tr-13 | **A screen reader hears "Problem" first, then the words,** as it does for a Note. Answers ⚑ H3. | on the designer's ⚑ | none: not visible |
| tr-14 | **A held toast looks the same as a running one, with keyboard focus too: accepted as drawn.** Looked at again only if the build shows focus with no ring. | 5 | 43H4 |

Critique 7 (the long Undo toast on a tablet is right) asked for no change.

## 43H's five ⚑: answered by tr-9 to tr-13

As they were put, with what 43H first drew. Kept for the record.

| ⚑ | Question | First drawn as |
|---|---|---|
| H1 | Which mark: the bare ✕ (the Note part's shape; also the app's close mark, though never at the left) or the ✕ on a disc (a badge)? | H1 draws the bare ✕; H2 shows both |
| H2 | The reduced-motion fade's length. He ruled "fades at the end"; the length is not his. | Over the last second |
| H3 | What a screen reader hears for the mark: "Problem", as the Note part says it, or nothing (the toast is already an alert). | "Problem" |
| H4 | A toast as wide as its words on a tablet is what the app does and what 43H draws; 43A to 43G stretched every toast to the full width. Keep the app's, or stretch it? | The app's |
| H5 | A one-line toast with no button ("Saved", a short error) is 40 px tall, so the 20 px corner makes it a pill, and the bar sits close under its words. Fine, or give it the 60 px of a toast with Undo? | 40 px, a pill |

## Left open (not ruled here)

- **Whether an error toast that asks the player to act stays until it is closed** (◈ in `dec-evening-2026-11-13.md`, Not ruled) is answered for today's error toast by tr-8: it does not; it stays longer by its length and holds while touched. An error toast with a button of its own does not exist and is not ruled.
- **A top to tr-8's seconds** is not ruled. The longest error the app has is six lines at 375 px as drawn, so 9 seconds.
- **How a line is counted (tr-8)** is the builder's: read from the words as they are laid out when the toast appears. Larger text or a narrower screen makes more lines, and so more seconds, which is the point.
- **"When there is room" (tr-5)** is drawn as: from tablet width (600 px), unless the button is wider than half the toast. That reading is the designer's, shown in 43H3 for his eye.

## Honest notes

- **The 13 November "ruling" was an approval from a picture**, with the missing mark "told to him and left for the sweep". Page 43 called it a ruling; tr-3 reverses it either way.
- **Home Two's critique is not in the repository.** Its findings were not put beside the frames on page 43; the page records its score and its choice only, as relayed.
- **43H's critique was run on the frames as first drawn.** The redrawn ones have had none, and Francis has not seen them: they are drawn to findings he approved. Drawn in Chrome only; nothing on the page moves.
- **The disc makes the words 4 px narrower,** so the garb swap's two errors wrap to three and six lines at 375 px, where the critique counted two and five. tr-8 gives them 6 and 9 seconds.
- **The danger colour is not used on the toast.** It measures 2.19:1 (light) and 2.03:1 (dark) on the toast's back, under the 3:1 floor, so the mark is in the words' colour and the shape carries it.
- **Page 43's contrast table gave the bar at 65% as 5.20:1 and 4.65:1**; those were the glass's. On D's solid back it measures 7.77:1 (light) and 5.55:1 (dark).
- **The pause can outlast a server window.** The weather roll's Undo is allowed by the database for 30 seconds; a toast held longer still shows Undo, and the tap is then refused in the usual words.
- **03, 04 and `docs/testing.md` still say 6 seconds** (03's weather row, 04's ExplorationState, two manual checks). They change in the build's pull request, as mm-6's did.

Docs to update: 06 (Toasts with Undo, Words batch 1's Toasts line, Shapes, the Toast, Weather card and Messages rows, Pop-ups), 05 (the weather roll's Undo, Messaging's Send), 10 (the toast's seconds), 09; done in this pull request. With the build: 03, 04, `docs/testing.md`, 06's Toast row Code column. For tr-8 to tr-14: 06 (Toasts with Undo, Shapes, Reduced motion, the Toast row), 09, the plan, page 43 and the mockup index; done in this pull request.

09: 2026-11-25 — [ui] The toast is restyled: rounded and solid (the sheet's corner, no glass), 5 seconds (was 6, mm-6) and only with a pause while a finger, a pointer or keyboard focus is on it; the bar at 65%, inset and rounded, still and fading at the end under reduced motion; on a tablet the long toast's words wrap beside Undo (amends tw-1 from tablet width); a new toast still replaces the one showing (tr-1, tr-2, tr-4 to tr-7) — Francis: "Approve with those recommendations", on Home Two's critique of page 43 (29/40), which chose D — `design/rulings/toast-restyle-2026-11-25.md`

09: 2026-11-25 — [ui] The error toast carries the ✕, the danger shape, in the words' colour (tr-3); reverses 13 November, when the garb toast was approved with nothing but its words marking it (gs-5a). Frame 43H is not approved yet: from its picture, with five ⚑ (the mark's form, the fade's length, the spoken word, the toast's width on a tablet, the one-line pill) — the same approval; 06: every semantic colour carries a shape — same file

09: 2026-11-25 — [ui] Frame 43H is approved with its fixes drawn: an error toast stays 5 seconds plus 1 for each line over two (it pauses like any toast; it does not stay until tapped and has no close button); its mark is the ✕ on a disc; under reduced motion the bar fades over the toast's whole time (amends tr-4's "at the end"); every toast is at least 60 px tall; under 600 px the toast fills the width between the margins and from 600 px it is as wide as its words; a screen reader hears "Problem" first; a held toast looks like a running one, accepted as drawn (tr-8 to tr-14) — Francis: "Approve with those recommendations", on Home Two's critique of 43H (32/40): a long error was gone before it was read, and an error's words are not in the log — `design/rulings/toast-restyle-2026-11-25.md`
