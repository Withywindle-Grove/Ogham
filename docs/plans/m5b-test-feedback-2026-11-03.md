# Plan: M5b test feedback of 2026-11-03 (Rules tab, selected state, Close, GM reference)

Ruling: `docs/design/rulings/m5b-test-feedback-2026-11-03.md` (tf-1 … tf-11). Mockups: `docs/design/mockups/library/04-rule-choice-button.html`, `05-feedback-options.html`.

## What this step delivers
The Rules tab and campaign creation's rules step behave as ruled (tf-1, tf-2, tf-3, tf-5, tf-7); the new selected state everywhere (tf-4); one Close part (tf-8); the GM reference layout and words (tf-10, tf-11); the compose alignment and a sweep (tf-9).

## Build order (each its own pull request)
1. **Tokens and parts** (tf-4, tf-8): the Selected wash tokens (light and dark) in the CSS tokens; every selected state (choice pop-up options, segments, chips, tabs, the menu's current tab) moves to them; choice strips full width; a `CloseButton` part (bare ✕, 44 px, "Close") replacing every text-link Close. Components inventory updated (06). 4–6 turns.
2. **Rules rows** (tf-2, tf-3, tf-5): order frozen while a section is open, "changed" at once; segmented row for ≤3 short choices (reads `choices[].short`; falls back to the ▾ button with "1 of N"); descriptions behind ⓘ on segmented rows; Show all removed. 4–6 turns.
3. **Shared rules and the App section** (tf-1, tf-7): the ruleKey card lists every pack's choices under pack names, one tap picks; the creation rules step opens with the App section. 3–5 turns.
4. **GM reference and compose** (tf-9, tf-10, tf-11): 220 px left list, the two headings, the tag removed, values in words, the switcher wraps; compose alignment; the alignment sweep with layout checks. 4–6 turns.

## Tests (purpose first)
- Toggling a rule leaves every row where it was until the section is reopened.
- A rule with 3 short choices shows a segmented control; with 4, or a long label, the ▾ button with "1 of 4".
- Picking a choice under one pack in a shared-rule card sets the campaign's answer and shows it ticked.
- Every Close has the accessible name "Close" and a 44 px target (layout test).
- The reference never prints a raw key (a test over the built panels).

## Scope checks
- Any new colour beyond the two Selected tokens.
- A pack field other than `choices[].short`.

## ⚑
None open.

## Estimate
About 15–23 builder turns across the four PRs. Pack session: `short` labels on multi-choice options in the packs (classic-advanced, fae-woodland, zine-compendium, deathcaster-class).

## Departures
(The builder keeps this current.)

### Part 1: tokens and parts (`m5b-tf-1-selected`)
1. > **Scope check — Close on the full-screen pop-up**
   > **What:** tf-8 puts the ✕ on every full-screen view, but the Full screen `Dialog` (g3, B2) has an approved Back ‹ at the left that does the same thing. Built: Back ‹ kept, no ✕ there.
   > **Now:** goes in this PR's follow-up · cost under an hour · pushes back nothing · chance of redoing work low
   > **Later:** at the M5b gate · same cost · the GM reference and the log's Reference sheet keep Back until then
   > **Signals:** screen or layout only → fine later; two ways out on one bar is clutter
   > **Recommendation:** A, because Back ‹ already reads as the way out of a whole screen and a second control adds noise.
   > **Options:** A keep Back ‹ (as built) · B replace Back with ✕ at the right · C both

   **Ruled B by Francis (2026-11-03).** Built in `m5b-close-and-forced-rest`: the Full screen `Dialog` has the `CloseButton` ✕ at the right of its bar and no Back that closes it. A full screen that is a step inside another (a table opened from Which table? or Tables ›) keeps Back ‹ at the left for that step (`onBack`); its ✕ and Escape close the whole thing (before, Escape went back one table). The GM reference and the log's Reference sheet already had the ✕ (the log sheet's top row); their "‹ <panel>" links go back a step and stay.
2. **Reading: no ✓ added to segments and chips.** tf-4 says "✓ kept": the ✓ stays wherever a part had one (choice pop-ups, option rows, destinations, Picked ✓). On / Off segments and chips never had a ✓; their selected cue besides the wash is the heavier 2 px edge. Adding a ✓ there would shift the labels on each tap.
3. **Technical: one more token, `--line-selected` (2 px),** the width of the selected edge (a line, not a colour). Parts with a 1.5 px control border draw the extra half pixel as an inset shadow so nothing moves when selected.
4. **Technical: a player's Messages bar loses "‹ Close"** (it closed the log sheet, which already has its ✕); the GM keeps "‹ Messages" (it goes back to the list, not a Close). A disappearing message's "Close" stays: it is an action on the message (it marks it read and it goes), now named "Close the message" for screen readers.
5. **Technical: "Close" foot buttons removed** from pop-ups that now carry the ✕ (overview, encounter, Keep lit, rest rule, marching order ⓘ and save, picture, Join up, Lost below, travel breakdown and forced march, status sheet, a creation entry without a "Back to …" label).
6. **Technical: every stacked action in a pop-up (`dialog__actions`) is full width** (tf-4's "every strip in a choice pop-up").
7. The gallery's approved pictures change (atoms, choosing, molecules, colour and others, both themes): deleted here so CI makes new ones for Francis to approve (docs/testing.md, Approved pictures).

### Part 4: GM reference and compose (`m5b-tf-4-reference`, from main after #314)
1. **Technical (tf-11): "values in words"** covers the option keys the packs write in the rules (`byOption` keys such as "initiative-ties=party", an `option` value): they read "<option's name> · <choice's name>" from the campaign's options, an unknown option tidied ("Last breath · On"); `byOption` itself reads "With optional rules". A rules setting's own enum value under it (for example "Ties party") still shows as the pack wrote it: the app has no words for every engine value, and the option's name above it already says what it is.
2. **Technical (tf-9): the cause was two rules meeting.** The phone's full-width accent button (App.css) and the secondary button's `align-self: flex-start` squeezed Attach and pushed Send's foot below Attach's. Attach and Send are now one group: beside the field with their feet level on a wide screen; under it on a phone, Attach first and Send filling the line.
3. **Sweep (tf-9):** a new layout check, "buttons out of line" (`tests/layout/checks.ts`): side-by-side buttons in one flex row must share their top, middle or bottom. It found nothing else on the existing layout scenes (all sizes); two new scenes (`gm-message-compose`, `gm-reference`) cover compose and the reference. The optional-rules panel in Setting rules gains room at its right so its text never runs under the ✕ (part 1's Close).
4. **Technical (tf-10):** the list's entries were centred by the rules browser's entry style loaded after the reference's; the reference's rule now wins (left-aligned).
5. **Ruling on part 2, item 1** (a short name counts as a short label; the item itself is in #320): **Ruled A by Francis (2026-11-03).** 09 and 07 updated here. The "1 of N" reading (part 2, item 2) stands as built.

### Part 2: rules rows (`m5b-tf-2-rows`, after #319)
1. **Reading: a short name counts as a short label.** A choice with no `short` but a name of up to 14 letters ("On", "Off", "Slots") is its own label, so the existing On / Off rows and short three-way rules stay segmented before the packs add `short`. A choice with a longer name and no `short` puts the row on the ▾ button. `pack:check` notes only the options that would fall back to the button (a 2–3 choice option with a long name and no `short`), not every On / Off.
2. **Reading: "1 of N" says how many choices there are** (one of N), as in mockup 04 B ("says there are others"), not the current choice's position.
3. **Technical:** the ⓘ on a segmented row opens a pop-up with the description and each choice in words (its notes, the book's default marked), since the segments carry only the short labels.
4. **Technical:** the order is held per group while it is open (`heldOrder`); a rule that appears while open (a pack updated) goes at the end until it is reopened.
5. The creation fixture pack (`scripts/fixtures/m5b-creation.fixture.json`) gains `short` on its two three-way options.

### Part 3: shared rules and the App section (`m5b-tf-3-shared`, after #320)
1. **Technical: a new part, `RuleKeyCard`,** for the `ruleKey` group in Rules for this campaign and campaign setup. `RuleClashCallout` stays only for Setting rules' "New choice for <topic>" offer after attaching a pack (07: it changes nothing until the GM confirms, which tf-1 doesn't cover).
2. **Technical: the ✓ shows on the counting pack's choice only;** the other packs' own choices (still read by their own `byOption` keys, ruled 2026-11-02) aren't marked in the card.
3. **Technical: a tap in the card goes through the row's rules:** a locked rule in play explains and changes nothing; a "warn" rule asks first (the pack pick is made at the tap, as the old sheet did).
4. **Technical: the App section holds the Characters, Items and treasure, and Table and players rules** (with Getting lost and Weather rolled by when the picked setting rules have them), in one folded group named App. Time and calendar stays in the Rules tab: its start time needs the campaign's clock. Encumbrance keeps its own row under the packs, as before. Reset to the books' defaults leaves the App section alone (they're the app's settings, not a book's).
5. The app's topic groups moved out of `RulesForCampaign` into `src/app/appRules.tsx` (`appRuleGroups`, `appRuleSetting`, `CompaniesAbout`) so both screens build the same rows.
