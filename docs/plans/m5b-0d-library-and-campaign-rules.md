# Plan: M5b step 0d — the Rules library, campaign set-up and Rules for this campaign on the new standard

Written by the design agent, 2026-11-02, from `design/rulings/m5b-0d-library-and-campaign-rules-2026-11-02.md` (lr-1 … lr-9) and the mockups `design/mockups/library/01` … `03`. Read the specs it names; this file makes no rulings. Opus for the screens; Fable for build order 1 (no migration anywhere in this step). **After** the creation follow-ups (`plans/m5b-0c-creation-rebuild.md`, Follow-up to slices 3–7).

## What this step delivers
The Rules library grouped by kind with chips, sort and a find field, the four-line pack row with Browse / Update and a ⋯ (lr-1 … lr-3); the landscape column folding from its divider (lr-4); campaign set-up steps 2 and 3 on the creation step shell — packs by kind with the ✓ slot and "needs <pack> ✓", optional rules one folded group per source with source, page and the lock in words, a `ruleKey` clash as one callout (lr-5, lr-6); Rules for this campaign with folded topic groups and count lines, one optional-rules group per source editable in place with Undo, Reset to the books' defaults, Retire campaign… at its foot (lr-7, lr-8); Set time on the Scene before the time is first set (lr-9); a `pack:check` warning for same-named options without `ruleKey`.

## Already built (verify, don't rebuild)
The library (import, update preview, Browse, Delete (removes the pack from the campaigns using it; the confirm says so), Edit pack on homebrew), `SectionNav` with `collapsed` / `useNavCollapsed` (B15), `NewCampaign` and its three steps, `OptionalRules` and `RulesForCampaign` (B15, the lock levels and the mid-campaign ask), `Retired.tsx`, the creation step shell (`src/ui/creation.tsx`: `CreationStep`, `PickRow`, `EntryPanel`), the `ruleKey` resolution — **not** built before #283 (Francis ruled B, 2026-11-02: built as its own step).

## Rests on
05 Rules library · Creating a campaign · Rules for this campaign · Retiring a campaign · One main advance per mode; 06 Navigation (the landscape column), Components: Rules library list, Pack row, Divider handle, Setting rules step, Optional rules list, Rules for this campaign, Time strip, Creation step shell; 07 `meta.kind`, `ruleKey`, `requires`; 03 (a library is the account's own).

## Build order (each a PR Francis can test)
1. **Divider handle and Set time (Fable or Opus, 4–6 turns).** `SectionNav`: the chevron row and its words go; a `DividerHandle` part on the column's edge (6 × 44 pill, 44 px tap zone, tap and drag past half); accessible names; the fold remembered as today. The Scene's time control reads **Set time** until the campaign's time is first set. 06 Code column. **Test:** keyboard and screen reader reach the handle with its name; a drag short of half changes nothing; "Set time" shows on a new campaign and the mode's advance after.
2. **The Rules library (Opus, 8–10 turns).** Groups by `meta.kind`, chips with counts, sort Name / Last updated, a find field from 8 packs; the four-line Pack row (description under the name; what it holds from the pack's counts in its own words — the kinds' names as the pack names them; who uses it from the campaigns attached); Browse and Update on the row; a ⋯ sheet with Edit pack (homebrew only), Export as a pack file, Delete from your library… (today's confirm and campaign-copy note); "About this file" moved behind Browse › About. **Test:** a homebrew overlay sits under Homebrew with "Needs: <base>"; sort by name is the default; Delete isn't on the row; 375 px wraps the buttons under the text.
3. **Set-up steps 2 and 3 on the shell (Opus, 10–12 turns).** Step 2: the Pack rows with a ✓ slot, grouped by kind with chips; a row opens the pack's Browse with Pick / Unpick at the foot; "needs <pack> ✓" and Next's words for a missing base; Import a file… quiet in the foot. Step 3: one folded group per source with "N rules · N changed", changed first, Show all; the row (name · what it does · source and page · when it can change, in words); On / Off segment and the › sheet; the `ruleKey` clash callout at the top with "Now: <pack> · <choice> (on top)" and "Decided above" rows in the groups; Reset to the books' defaults with Undo (the All defaults text gone). **Test:** an adventure whose base isn't picked stops Next with the words; two packs with the same `ruleKey` give one callout and no second row; Reset then Undo restores the changes.
4. **Rules for this campaign (Opus, 8–10 turns).** Topic groups folded with count lines (one open at a time on a phone, any number on a tablet); the optional rules as one group per source after the topic groups, the step-3 rows editable in place (Undo toast; the "asks first" preview as today); Reset to the books' defaults; Character fields unchanged; **Retire campaign…** moved to this screen's foot (gone from Setting rules); the Setting rules list stays stacked under it (no chips: amended 2026-11-02 evening). **Test:** a change in place logs and undoes; Retire is on Rules for this campaign only; the count line updates after a change.
5. **Checker (Fable, 2 turns).** `pack:check` warns when two packs in the library carry same-named options with no `ruleKey`; a fixture pair for it. 06 Code column; the testing checklist items (library, set-up, Rules tab, the fold).

## Tests (purpose first; the ones above plus)
- No screen has two accents (set-up: Next or Create campaign; Rules tab: none).
- A library of 0, 1 and 40 packs: the empty line, no chips with one kind, the find field from 8.
- A pack with 0 optional rules shows "none" in its group header and nothing to open.
- Long pack names and descriptions wrap at 375 px; the ⋯ stays 44 px.

## Scope checks (write one and stop)
- No change to import, the Update preview, Browse, or the `ruleKey` resolution.
- No new pack fields (the counts come from what the pack holds; the description is `meta.description` as today).
- Edit pack stays homebrew-only (ruled 2026-11-01).

## ⚑ for Francis (ask at the start)
None open: the session ruled them.

## Estimate
About **32–40 builder turns**; build order 1 first (small, visible), 2 next so Francis can test the library on its own.

## Follow-up: the ruleKey group resolution (ruled 2026-11-02)
Francis's ruling on build order 3's scope check 1: option B (build it as its own step) plus A's doc fix. Branch `m5b-0d-f-rulekey`, stacked on #281, merging after build order 4's PR. Exactly what 07 (`ruleKey`, 2026-10-24/25) says, nothing more:
1. **One choice per group.** `ruleGroupsOf` (`src/modules/library/ruleGroups.ts`): options from different attached packs with the same `ruleKey` form one group, top of the stack first; the winner is the GM's pick when it names one of the offers, else the pack on top (homebrew on top). The pick lives in the campaign's `settings.ruleGroups` (ruleKey → pack id; 04); no migration (the settings column is jsonb, and nothing stored changes shape).
2. **What the campaign reads.** `loadCampaignSetting` (`src/app/campaignSetting.ts`) exposes `ruleGroups`; the topic's effective choice is `groupChoice(setting, ruleKey)` (the shared rule the engine reads: `acStyleOf`, the creation method). Each pack's own `byOption` keys and gates keep reading that pack's own choice (`choiceInPlay`, `choicesInPlay`; ruled 2026-11-02): the group decides the topic, not what a losing pack's own conditions see.
3. **Set-up.** Step 3's callout now reads the pick ("Now: <pack> · <choice> (your pick)" or "(on top)"); choosing from a pack's sheet opened from the callout picks that pack for the group (tapping the ticked choice counts too); "Decided above" rows follow the winner; Reset clears the picks (Undo restores); Create campaign writes `settings.ruleGroups`.
4. **Attaching in play.** `rules.attach` returns `{ id, newChoices }`: for every group the new pack joins, the standing winner is pinned as the pick when there was none, so the new rule changes nothing; the Setting rules screen then shows one callout per topic titled "New choice for <topic>" with each pack's choice and "Now: … (kept)"; tapping a choice makes that pack's rule count (`campaign.update`, logged "chose which pack's <topic> rule the campaign uses"). Leaving the screen keeps the standing choice.
5. **Removing.** `rules.detach` clears any pick naming the removed pack in the same logged change; the log line ends "; the choice for <topic> falls back to the next pack".
6. **Rules for this campaign** (#285's rows, wired here): the callout reads the pick ("(your pick)" / "(on top)"), "Decided above" follows the winner, and choosing from a pack's sheet opened from the callout picks that pack (`set('ruleGroups', …)`, logged).

## Departures

**Designer, 2026-11-03 (`design/rulings/m5b-builder-questions-2026-11-03.md` bq-7):** the Set time scope check is closed: lr-9 is covered by B13's Set start time ›; nothing to build.
(The builder keeps this current in the same pull request.)

### Follow-up: the ruleKey group resolution (branch `m5b-0d-f-rulekey`, stacked on #281)
1. **Scope check: what a losing pack's own rules read.** 07 said one choice counts for the group and was silent on the pack whose rule lost. First built as "the winner's choice when the rule has a choice of that id, else none" (ruled A, then changed). **Ruled: the pack's own choice (Francis, 2026-11-02, superseding A; the ruling file's Amendments, lr-6):** a losing pack's own `byOption` keys and gates keep reading that pack's own stored choice; the group pick decides only the topic's effective choice for the campaign (`groupChoice`). Built so; a test covers the gate.
2. **SQL readers aren't resolved.** The weather gate (migration 20261101120000, `jsonb_each(cp.option_choices)`) still reads each pack's stored choices; a weather rule gated by an option that lost its group would still follow that pack's stored choice. The brief allowed a migration only if the resolution must live in SQL; it doesn't for the app, so none was written. Noted as fragile; a follow-up migration can read `settings.ruleGroups` the same way.
3. **The pick is a pack id, not a link id**, so a pack removed and attached again gets "New choice for <topic>" afresh (the detach cleared its pick), as 07 asks.
4. **Words:** the callout's note is "(on top)" for the order's winner, "(your pick)" at set-up for the GM's, "(kept)" on the "New choice for" callout; lr-6 only gives "(on top)". The log lines are new: "…; a new choice for <topic> waits for you", "chose which pack's <topic> rule the campaign uses", "…; the choice for <topic> falls back to the next pack".
5. **`rules.attach` returns an object** (`{ id, newChoices }`) where it returned the link id; its four database tests read `.id` now. No new command and no `logged_commands` row: the pick is a `campaign.update`, the pin and the fall-back ride inside `rules.attach` / `rules.detach`.
6. **Rules for this campaign** (#285, now on main) is wired to the resolution here: its sources use the pack id (not the link id) so the picks match; the sheet opened from the callout carries the ruleKey and picks on choose; no other change to #285's screen.
7. **A log fix the tests caught:** when `rules.attach` or `rules.detach` also writes the campaign's settings, the entry's main event is the `campaigns` row (`MAIN_TABLES`), and the line lost the pack's name ("added the setting rules setting rules"); `describeEntry` now names the pack from the entry's `campaign_packs` event. Two tests in `src/core/events.test.ts` would have caught it.


### Build order 2 (the Rules library; branch `m5b-0d-2-library`)
1. **Scope check: Delete's "the campaign keeps a copy".** lr-3 and the mockup write the ⋯ line as "<campaign> uses it: the campaign keeps a copy". Today (07 Deleting, `library.delete`) deleting removes the pack from every campaign using it for good, and the confirm says so; nothing keeps a copy. The plan's "Already built" lists "Delete with the campaign-copy rule" and the task says "Delete keeps its confirm", so behaviour is unchanged.
   - **Built:** the ⋯ line says only "<campaign> uses it" (or "and N more use it"); the confirm is today's.
   - **Options:** A. keep today's behaviour and drop "keeps a copy" from lr-3 and the mockup (docs only); B. make deleting leave each campaign a copy (a design ruling and a migration: a new kind of pack row per campaign; touches the closed deletion list's spirit, so a designer session).
   - **Recommend:** A. Francis or a designer rules.
2. **The pack's own words** come from `creationGuide.race.title` and `creationGuide.class.title` (the only places a pack names a kind today; no new field). The plural is made by a small English rule ("Kindred" → "kindreds", "Ancestry" → "ancestries"); a word the rule gets wrong would need a pack field (`pluralName`-style), which isn't built. Other kinds keep the app's words: the mockup's "foes" and "places" are not used ("stat blocks" stays, as everywhere else in the app).
3. **"1 rules set" is left out** of what a pack holds (every setting has one; the mockup doesn't show it). The import preview's line is unchanged.
4. **The phone drops the description** (the mockup's note), not the plan's "descriptions wrap at 375 px"; "Needs: …" stays on the phone. Browse › About this file shows the description (its "About" line).
5. **Export as a pack file** in the library writes the pack's stored details back (its id, description, requires, author…) with every entry, hidden fields included (it's the owner's own). The campaign homebrew's export now uses the same function (same file as before).
6. **Never a disabled button:** the row's buttons used to be greyed while a preview was open or a change was saving; now a tap says why ("Save or cancel the file above first.").
7. **Small parts added:** three icons (`edit`, `export`, `delete`) for the ⋯ items; the fake database reads `alias:data->key` columns like the real one; the kind words moved to `src/modules/library/kindWords.ts` (re-exported from `PackPreview.tsx`).

### Build order 3 (set-up steps 2 and 3 on the shell; branch `m5b-0d-3-setup`, stacked on #279)
1. **Scope check: the `ruleKey` resolution isn't built.** The plan's "Already built" lists it (one pick per group, "New choice for <topic>", fall-back on removing) and 07 says "Grouping is built in M4b", but the code has none: each attached pack keeps its own `option_choices`, and `stack.ts` says optional rules "never compete"; only `creation-method` and `ac-style` are read by key, from the first pack found. So lr-6's "One choice counts for the campaign" isn't true in play today.
   - **Built:** the callout and "Decided above" rows as the mockup shows them, from a pure `ruleClashes` (display only): the pack on top (the set-up order: homebrew first, then the last picked) is named as "Now"; each pack's button opens that pack's own rule, and its choice is saved on that pack as today. No group pick is stored; nothing resolves by key.
   - **Options:** A. keep it display-only and correct 07's "Grouping is built in M4b" and the plan's "Already built" (docs only); B. build the group resolution (which pack's choice the campaign uses, "New choice for <topic>" on attaching, fall-back on removing, logged): touches the rules resolution and attach / remove, so its own step, Fable.
   - **Recommend:** B as its own step before the M5b gate, A's doc fix now. Francis rules (technical: here; the words in the callout stay).
2. **"Create campaign now" stays on step 2**, as a quiet line under the list ("… keeps the defaults for the steps left"); the mockup doesn't draw it, and removing it would change approved behaviour.
3. **Next's words end "or leave it out."** rather than repeating the pack's name (a long name filled the foot twice at 375 px).
4. **The shell's Next says "Next"** (the mockup); the name step keeps "Next: setting rules". Step 3's accent is "Create campaign".
5. **The Encumbrance row** sits after the source groups as its own rule row ("The app · can change, asks first"); two modes are a segment, more open the sheet. The book's default there is the mode the setting rules preset.
6. **Groups:** in pick order; the first with rules starts open; any number open (one-at-a-time is lr-7's phone rule for the Rules tab, build order 4). Folding a group folds its Show all again.
7. **Browse on step 2** is the pack's entries (`RulesBrowser`, read only) in a full-screen pop-up with its description, and Pick / Unpick at its foot; the library's own Browse screen isn't reused (it would leave the set-up).
8. **No find field and no sort switch** on step 2 (lr-5 asks for the same chips); packs sort by name.
9. **Never a disabled button:** the name step's Cancel, Next and Create campaign now were greyed while saving; now they answer (Cancel says why).
10. **Small parts added:** `PickTick` (the ✓ slot, now also inside `PickRow`), `CreationStep.footExtra`, `PackRow.onOpen`, `KindGroup.note`; `OptionalRule` reads `source` and `ruleKey` (no resolution change). The `requires` gate of add-on options is still not applied here (unchanged from today).

### Build order 4 (Rules for this campaign; branch `m5b-0d-4-rules-tab`, stacked on #281)
1. **Scope check: the Rules tab has no chips.** lr-7 and the mockup speak of "the second chip, **Setting rules · N**" and the plan says "the Setting rules chip is today's list", but today the Rules tab has none: Rules for this campaign and the Setting rules list are stacked on one page.
   - **Built:** stacked as today; Retire campaign… sits at the foot of Rules for this campaign, above the Setting rules heading.
   - **Options:** A. keep them stacked (correct lr-7's and the mockup's words; docs only); B. two chips at the top of the Rules tab, "Rules for this campaign" and "Setting rules · N", each showing one part (a navigation change: "Change rules for this campaign" and "Edit character fields" would switch chips).
   - **Recommend:** A now; B only if Francis wants the shorter page (a designer rules it).
   - **Ruled A, 2026-11-02 (Francis):** the Rules tab stays stacked, no chips; lr-7's wording corrected in 05 and 06.
2. **Scope check: the app's own settings keep today's rows.** The mockup draws them as set-up step 3's rows ("Start time · When the first day begins · The app · can change at any time · Dawn ›") and adds Adventuring and Combat groups; the plan's build order 4 puts only the optional rules on the step-3 rows.
   - **Built:** the topic groups are folded with the count line ("Characters · 3 settings · 1 changed"); their rows are today's (source tag, "Changed · default …", a list when the choices don't fit); Time and calendar and Character fields keep their summary words.
   - **Options:** A. keep today's rows for the app's settings; B. move them onto `RuleRow` (each needs a "what it does" line and a "when it can change" level: new words, a designer's).
   - **Recommend:** A; B with the words from a designer session.
   - **Ruled A, 2026-11-02 (Francis):** the app's own settings keep today's rows inside the folded groups.
3. **Character fields moves after the optional-rules groups** (lr-7's order and the mockup; before: after Characters). Its content is unchanged.
4. **Every attached pack gets a group**, top of the stack first, as in set-up step 3: a pack without optional rules says "· none" and opens nothing (before: only packs with rules, inside one Optional rules group by category). The clash callout sits above the first pack's group.
5. **The ⓘ on an optional rule is gone:** the row says what it does and when it can change (as in step 3); a choice's own notes show in the › sheet only, so a two-way rule's choice notes aren't shown.
6. **Undo** saves the choices from before the change again (a new logged `rules.setOptions`, so the log has both lines), not the log's Undo. The app's own settings keep "Saved" with no Undo (unchanged).
7. **"Use all defaults" is "Reset to the books' defaults"** at the screen's foot (only when a pack has optional rules); it still asks first when it would change a rule that asks first ("Reset to the books' defaults?" · Reset · Not now), then happens with Undo.
8. **`OptionalRules` isn't retired:** the Rules tab never used it (it drew the organism), and adding setting rules mid-campaign (`SettingRulesAdd`) still does. Moving that onto the new rows would be its own small step.
9. **"Change rules for this campaign"** opens every pack's group that has rules (the first one on a phone) and scrolls to them.
10. **A phone** is the 06 phone breakpoint (under 600 px): an iPad in portrait counts as a tablet (any number open).
11. **Never a disabled button:** Retire's confirm buttons were greyed while saving; now a second tap does nothing and the button says "Retiring…". In a retired campaign an optional rule's tap says why (before: nothing happened).
12. **No "Changes save as you make them · Undo in the toast" line** at the foot (the mockup's): the app's settings have no Undo, so it would be half true.
13. **Gallery:** the organism's count lines changed, so the four Organisms pictures (phone and tablet, light and dark) need approving again from the CI run.

**Build order 5 (the checker part; branch `m5b-0d-5-checker`):**
- `pack:check` only ever read one file, so it couldn't see a library. It now takes several files (`npm run pack:check -- a.pack.json b.pack.json`): each is checked as before, then all of them together. That is the smallest way in; a library folder as the argument isn't added (on Windows, name the files).
- Built on Opus, not Fable as the plan's estimate line says (the brief named Opus; scripts only).
- The warning fires when two packs carry an option of the same name (capitals and spaces ignored) and **at least one** of them has no `ruleKey`; a pair with the same `ruleKey` stays quiet. Same-named options with two different `ruleKey`s aren't flagged (the ruling names only the missing key).
- Add-on options (with `requires`, no `ruleKey` by the 2026-11-02 ruling) are checked like any other: two packs with same-named add-ons get the note too.
- It's a warning: the exit code doesn't change.
- The 06 Code column and the screens' testing checklist items in this build order are left to the screen pull requests (0d.1–0d.4); this PR adds only the checker's own line to `docs/testing.md`.

### Build order 1 (branch `m5b-0d-1-divider`, 2026-11-02)
1. **Built:** the divider handle (lr-4). The chevron row and its words are gone from `SectionNav` (it keeps `collapsed`; `onCollapse` is gone); `DividerHandle` (`src/ui/DividerHandle.tsx`) is placed by the owner inside its column, the GM's `.gm__side` and the player's new `.player__side` wrapper (landscape only), straddling the column's right edge. It draws the column's line itself, so the GM column's `border-right` went; both columns pad their right edge by half a tap so the zone never covers a tab (the folded GM column is 14 px wider than before). Technical choices: a press that moves under 8 px is a tap; "half" is half the open column's width to fold, half the growth (open width less folded width) to unfold, the open width kept from the last measure on the page (opened folded, the column is taken to grow by twice its folded width); no live movement while dragging (the ruling keeps nothing in between).
2. **Not built: Set time (lr-9).** Stopped for the scope check below; nothing of it is in this PR.
3. The gallery doesn't show the divider handle (the gallery has no column); no gallery picture changes. Layout checks updated (the column's buttons, the fold, a short drag, the player's column).

> **Scope check — which control reads "Set time" (lr-9), and what tapping it does**
> **What:** lr-9 says "until the campaign's time is first set, the Scene's time control reads **Set time** (then the mode's advance as today)", and the plan's test is "Set time shows on a new campaign and the mode's advance after". In the app the mode's advance (Next turn) only shows during an expedition, and the clock already counts as "moved" once any expedition exists (`clockHasMoved`, B13), so on a new campaign there is no mode's advance to rename. The ruling doesn't say which control it means (the main advance, ⋯ Advance by…, or the quiet Set start time ›), what "first set" means (the start time saved, the clock moved, or a date set), or what a tap on Set time does.
> **Now:** goes in m5b-0d · cost under a day once ruled · pushes back nothing (build order 2 doesn't need it) · chance of redoing work med (guessing the control)
> **Later:** goes in m5b-0d build order 4 (it touches the Time and calendar group) · cost then the same · what we lose by waiting: nothing at the table
> **Signals:** screen only; the intent's "Scene — Advance time" names no control that exists with those words.
> **Recommendation:** Now, with option **A1**: while the clock hasn't moved (B13's test), the ⋯ item **Advance by…** reads **Set time…** and opens the Start time pop-up (the one Set start time › opens); once the clock has moved it reads Advance by… as today. Alternatives: **A2**, the first expedition's main advance reads Set time (opening Start time) until a start time is saved, then Next turn; **A3**, drop lr-9, since Set start time › already shows on a new campaign.
> **Options:** A Now (A1 / A2 / A3) · B Later · C R2 · D Drop

