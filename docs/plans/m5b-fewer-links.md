# Plan: fewer links (fl-1 … fl-4)

Ruling: `docs/design/rulings/m5b-fewer-links-2026-11-03.md`. Mockup: `docs/design/mockups/m5-gate/b19-fewer-links.html`. M5b, before the gate.

## Build order
1. **The parts** (fl-1): a `small` size for the secondary button (44 px); `button-quiet` kept only for navigation and help lines (06's inventory says so), never an action. 1–2 turns.
2. **The sweep** (fl-1): every action drawn as underlined text becomes a button (secondary, small in a card's foot), starting with the wilderness and camp screens, then the rest of the app. A layout check: no `button-quiet` whose label is an action outside the allowed list (back link, Help me choose, links inside sentences). 3–5 turns.
3. **The Encounter waiting card** (fl-2): Start the accent when the console has no other accent showing, View and Dismiss small, Which watch? chips. 1 turn.
4. **The Watches step** (fl-3): boxes by watch, names as chips with ✕, + Add (hidden at 3), Not on watch, the casters line, Split evenly. 3–4 turns.

## Tests (purpose first)
- No action on the wilderness and camp screens is drawn as underlined text.
- The console never shows two accents with an Encounter waiting card.
- + Add offers only characters not on a watch and hides at 3; ✕ takes one off; Split evenly fills every watch in marching order and keeps casters off the last one where possible.

## Scope checks
- Any screen where turning a link into a button would add a second accent.

## Estimate
About 8–12 builder turns. #364 (the Open card) goes ahead unchanged (fl-4).

## Departures

**Designer, 2026-11-04 (`design/rulings/m5b-fewer-links-2-2026-11-04.md`, fl-5):** PR 2's item 6 ruled A: the toast's Undo, the campaign name's dotted tap-to-rename and the time strip's mode · turn stay; the source test lists them as its allowed exceptions.

**Designer, 2026-11-04:** bq3-4 (Split evenly asks "How many watches tonight?" when the pack gives no night's length) goes on #378's branch as a follow-up before it merges.

**Designer, 2026-11-04 (`design/rulings/m5b-builder-questions-3-2026-11-04.md`):** no gap storage (bq3-3, technical); Split evenly asks how many watches when the night's length is missing (bq3-4 C).
(The builder keeps this current.)

**PR 1 (`m5b-fewer-links-1`): build orders 1, 3 and 4.**
1. **Build order 2 (the sweep) is not in PR 1.** It comes as PR 2 once options-gates PR 1 merges (both touch many screens). Until then the other screens keep their underlined actions, and the gallery's Atoms specimen still shows a quiet "Recharge (fiat)"; PR 2 moves it and adds the small secondary there (so this PR changes only the Wilderness pictures).
2. **Start is secondary on the console today.** The waiting cards sit under the time strip, which always shows Next turn (the accent) while an expedition runs, so `accent` is false there in practice. The card takes `accent` and, when it's set, only the first card's Start is the accent (one per screen). The gallery shows the accent version.
3. **On a phone the accent Start is full width** (the app's rule for the accent on phones, `App.css`), so View and Dismiss sit on the row under it; on a tablet they share one row, as in the mockup.
4. **Scope check (technical): an empty watch between two.** The data model (#321, kept) stores each watch with 1–3 characters, so an empty 2nd watch with someone on the 3rd can't be stored, and no migration was asked for. So:
   - only the first empty watch has + Add; any later empty one reads "No one yet · fill the 3rd first";
   - a name's ✕ that empties a middle watch moves the later watches up (as the chips did before).
   Options: **A** keep this (no migration); **B** allow empty watches (a migration to `set_camp_watches` and the readers of the order, Which watch? included). Recommended: A (a gap in the watches means nobody is awake for that part of the night).
5. **Scope check: Split evenly needs the night's watches.** It's shown only when the pack gives the night's length and the watch's (so the app knows how many watches); without them (the fixture pack's Fen trek has no daylight table) there's no count to split into, so it's hidden. Options: **A** keep hidden; **B** split into as many watches as there are characters, up to 3 each; **C** ask the group how many watches. Recommended: A.
6. **The time of night** is worked out from the pack's sunset and the watch's length ("19:00–21:00"): the 1st watch starts at sunset, as the night's length already assumes (night = the day less its daylight). No pack names its watches ("dusk", "midnight" in the mockup), so there are no such words.
7. **+ Add opens a small pop-up** listing who's free in marching order (one tap adds and closes); with nobody free it says to take someone off another watch first. The mockup didn't draw it (it noted "a sheet" for a big party).
8. **Split evenly with more characters than the watches hold** (3 each) leaves the back of the marching order off watch; with fewer characters than watches it fills one each from the 1st. Not ruled; the simplest reading.
9. **A bug found and fixed:** View's details read "2nd watch · Moss watch" (the word doubled); they now read "Awake: 2nd watch · Moss", with a test.
10. **bq3-4 (C) built on this branch (2026-11-04), replacing scope check 5's "hidden":** with no night's length, Split evenly is shown under **How many watches tonight?**, the inventory's Stepper (− N +). The count runs from a third of the characters rounded up (no watch over 3) to the number of characters (no watch empty; bq3-3 kept); it starts at the watches already set, else 3, kept within that range. A step past either end stays tappable and opens a pop-up saying why. To do that the Stepper gained an optional `onLimit` (the screen is told a step was tapped at the limit; other callers unchanged, still stopping at the limit). Not ruled, the simplest reading: the starting number (3, or the watches set) and the pop-up's words. The count isn't saved: it's only the split's input, and the order the split sets is what's stored.

**PR 2 (`m5b-fewer-links-2`): build order 2, the sweep.**
1. **One size for every converted action: the small secondary.** 142 quiet buttons across 51 files became `button-secondary button-secondary--small`. That includes a pop-up's Cancel or Not now beside its accent, not only a card's foot. Reason: they are all the low-priority choice, and the mockup draws the accent with small buttons beside it. Not ruled; the simplest reading of "a secondary, small for low-priority actions". Ones that were already secondary keep their size (Recharge stays full size; Recharge (fiat) is small).
2. **Destructive actions are plain secondaries with their word** ("Delete", "Remove…", "Delete from homebrew…"), not red. The mockup's note says "buttons with the danger word, not red text". `.button-quiet--danger` is retired (only the gallery used it). `.button-secondary--warning` (danger edge) stays for the places that already used it.
3. **What stays underlined (`button-quiet`), by the rule:**
   - every ‹ back link: the top row, ‹ Gear / ‹ Pack, ‹ Back to the list, ‹ Messages, ‹ Reference, ‹ Setting rules, ‹ a character's name, the creation step's ‹;
   - the "Back" and "Back to …" links;
   - every "… ›": Scene ›, Players ›, Set date ›, Set start time ›, Tables ›, All N tables ›, Open the table ›, the review's Change ›, Roll a name ›;
   - Help me choose, and a rule row's "Run by hand · the app doesn't apply this yet" (it opens why: a help line; came in with main);
   - "Create campaign now" inside its sentence ("… keeps the defaults for the steps left.");
   - "Open the table: …" on a secret roll (it goes to the table);
   - the pack row's and Add item's − / +, which were never underlined (PackScreen.css): they are controls, left as they are.
4. **The homebrew entry row in Setting rules** (tap to edit; it had its own underline) now reads "Name · kind ›", not underlined: opening a thing is the row with › (fl-1).
5. **The check is a source test, not a layout test.** The plan asked for a layout check. `scripts/fewer-links.test.mjs` (run by `npm test`) reads every `.tsx` and `.css` in `src/`, so it covers screens the gallery and journeys never draw. It fails on:
   - a quiet button whose label is an action (outside the list in 3);
   - any use of `button-quiet--danger`;
   - any other style that underlines, except the listed ones.
6. **Scope check (design), ruled A, fl-5 (2026-11-04, `design/rulings/m5b-fewer-links-2-2026-11-04.md`): three underlined taps that aren't `button-quiet`, left as they are.**
   - **The toast's Undo:** underlined bold text in the toast. It's an action, but a secondary button inside the dark toast is a new look.
   - **The campaign's name in its heading** (dotted underline, tap to rename).
   - **The time strip's mode and turn** (dotted underline, opens the procedure; ruled B5/B14).

   The last two are headings that open something. Options:
   - **A:** keep all three (the toast's Undo is the one undo everywhere, and the headings are headings);
   - **B:** the toast's Undo becomes a small button drawn for the dark toast, and the headings keep their dotted line;
   - **C:** all three change.

   Recommended: A. The guard test lists the three by name, so a change is one line there.

   The derived field's dotted label (opens its explanation) is a help line and stays.
7. **A quiet "Use a charge" on a pack row** (accent text, never underlined) became a small button too: it is an action.
8. **Gallery:** the Atoms specimen is now "Buttons: primary, secondary, small secondary, busy; a link only goes somewhere (fl-1)". It shows Recharge (fiat) and Delete as small secondaries, plus one ‹ Back to the list link. The dialog specimens' Not now are small secondaries.
