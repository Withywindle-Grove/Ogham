# M5: the R3 audit removals and the autofocus sweep

Rulings: `docs/design/rulings/m5-r3-audit-2026-11-01.md` (Francis: yes to all four non-keep proposals), and `docs/design/rulings/m5-gate-rulings-2026-11-01.md` (A4, A5, B17, D5). The designer's board line (2026-11-01) says the builder can start these now. The builder session wrote this plan from those rulings; the specs (05, 06) already say the after-state.

## What to build
1. **Remove the darkness dim** (audit 8/40). The page no longer darkens when a group has no light; the "in darkness" symbol stays on the strip and the marching order.
   - Take out the `data-darkness="dim"` token swap and its tap-catching layer (`src/app/Darkness.tsx`, `Darkness.css`, `src/ui/tokens.css`).
   - Remove the tests that pinned the dim. Keep, or add, a test that the symbol still shows.
   - Keep the grey (out-of-light) behaviour only if 05/06 still describe it; read them first.
2. **Remove Something else… and Describe what you want to do** (A5; audit 21/36), with the cost-in-turns answer, from the players' and the GM's screens. Keep requests for escape rolls (and the database as it is: no migration, no data removed). The pack's common player actions move to the GM reference screen later (B4), so don't move them now.
3. **Remove "Revealed this downtime"** from the players' Scene after End expedition (B17; audit 38). The log keeps the lines.
4. **Drop the weather card's fold animation** (audit 15). The result shows at once.
5. **Autofocus sweep** (A4, D5): no screen or pop-up puts the cursor in a text field on open (`autoFocus`, `.focus()` on mount), unless 06 names an exception. Moving focus to a heading or the pop-up itself, for screen readers, is fine; only text fields open the keyboard.
   - Add a test that would catch a new one, such as a lint rule or a unit check over the pop-ups.

## Tests (purpose first)
- "With no light, the page doesn't darken; the in-darkness symbol shows."
- "The players' Scene has no Something else… and no Describe; an escape roll ask still shows and answers."
- "After End expedition, the players' Scene shows no 'Revealed this downtime'."
- "The weather result shows at once, with no animation."
- "Opening a pop-up with a text field doesn't put the cursor in it."

## Docs
- The 06 Code column for removed or changed components; the gallery pictures update (CI artifact).
- `docs/testing.md`: strike the M5 manual checks for what's removed, and add one line per removal.

## Estimate
About 20 turns on Opus. No migrations.

## Departures
- **The "in darkness" symbol isn't built, so it isn't kept.** The ruling says the symbol "stays" on the strip and the marching order, but no such symbol was ever built: the only darkness mark is the "No light" reminder (with its ● and words), which stays. Building the symbol needs a design (which mark, where on the strip) and belongs to the B18 table view, so it isn't added here. 05 now says it's not built yet; the test checks the reminder instead of a symbol. ⚑ for Francis.
- **The Darkness effect switch went with the dim.** ⋯ → This device → Darkness effect only turned the dim on and off; with the dim gone it did nothing, so it's removed (and 05's device preferences line with it). The dark-sight grey went too: it was part of the dim (05 no longer describes it). `hasDarkSight` and `DIM_MS` are gone; `inDarkness` and the reminder stay.
- **Old Describe… lines can still be answered.** No data is removed, so a line a player sent before this change still shows "Sent to the GM · Cancel", and the GM's Waiting card still answers it Yes / No with a note, but with no Cost in turns. The `request.send` and `request.answer` commands stay (M5b's buying, selling and lodging use them); the database still accepts a cost, the screen just never sends one. Old answers given with turns still read "Yes · 2 turns".
- **The pack's common player actions stay in code.** `src/modules/expedition/playerActions.ts` (and its test) stays for B4's GM reference screen; only the players' pop-up (`SomethingElse.tsx`, its CSS and tests) is deleted.
- **`loadRevealedResults` stays.** The Scene card is gone, but the database test `supabase/tests/m5-reminders.test.ts` uses the function to prove the reveal, so it's kept with a comment.
- **"Fold animation" was the 8-second automatic fold.** Folding was already instant (no motion); what goes is the timer. The result now stays open until tapped, as 06's Weather card row already said. Folding on a tap stays (06).
- **Pop-ups no longer open at their first field.** `Dialog` used to move focus to its first field (ruled 2026-10-24); with A4 it goes to the first control when that's a button or switch, and to the card itself when it's a field. Shift+Tab from the card goes round to the last control.
- **One autofocus kept: the damage pad's number.** Tapping the number turns it into a field, which takes focus: the person tapped it to type (06 Damage pad: "tap the number to type"). It's marked "A4 allows it" in the code. The OptionalRules autofocus is on a button, so it stays.
- **The autofocus guard is a source scan.** `src/ui/noAutoFocus.test.ts` fails on a new `autoFocus` on anything but a button (unless marked), and on any new `.focus()` call until it's checked and listed. The pop-up rule is tested in `src/ui/Dialog.test.tsx`.
- **More docs than the plan named.** 06's Darkness convention, wilderness view and button group, and 05's wilderness lines still described the dim, Something else… or the 8-second fold; they're brought in line with the rulings. The town's own "Something else…" (Ask for…, town activities, M5b) is left as written: A5 names the players' Scene button, and ruled 2026-11-01: town buying's "Something else…" stays as a Request, renamed "Something not listed…", and lands with M5b's town work.
