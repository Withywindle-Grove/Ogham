---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Rules library; Creating a campaign; Rules for this campaign; Retiring a campaign; One main advance per mode), docs/06-screens-and-design.md (Navigation: the landscape column; Components: Rules library list, Pack row, Divider handle, Setting rules step, Optional rules list, Rules for this campaign, Time strip), docs/07-content-packs.md (`ruleKey`: the checker's same-name warning), docs/08-roadmap.md (M5b: m5b-0d), docs/09-decisions-log.md (2026-11-02), docs/intents/2026-11-01-library-and-campaign-setup.md (done)
supersedes: parts of the M5 gate B15 ruling (2026-11-01: the chevron and "Fold the menu" at the column's foot); the 2026-10-25 "Use all defaults" wording; the Retire campaign placement (05, M4b)
---

# The Rules library, campaign set-up and Rules for this campaign, on the new standard (design ruling, 2026-11-02)

From the intent `docs/intents/2026-11-01-library-and-campaign-setup.md` (Francis's test of 2026-11-01), a design session on 2026-11-02 with three mockups: `design/mockups/library/01-rules-library.html`, `02-menu-fold.html`, `03-campaign-rules.html`. Ids `lr-1` … `lr-9`. Invented pack names in the mockups.

## A. The Rules library (lr-1 … lr-3)
- **lr-1 Grouped by kind**, from the pack's `meta.kind`: **Setting rules · Adventures · Homebrew** (an overlay is a homebrew pack that needs another; its row says "Needs: <pack>"). Chips filter to one kind (with counts); a find field appears from 8 packs; **sort by Name** (default) or Last updated. One accent: **Import a file**. Empty: "Nothing in your library yet." with the import and the AI converter.
- **lr-2 The pack row, four lines:** name · the pack's own one-line description and what it needs (right under the name) · **what it holds** (the counts, in the pack's own words: "kindreds" when the pack says so) · **who uses it** ("Used by Fenmoor and 1 more" / "Not used by a campaign") + version + date. "About this file" goes from the row; the converter's metadata stays behind Browse › About.
- **lr-3 Actions:** **Browse** and **Update** as buttons on the row; **⋯** holds Edit pack (homebrew only, ruled 2026-11-01), Export as a pack file, and **Delete from your library…** with "<campaign> uses it: the campaign keeps a copy". Delete is never one tap on the row; it keeps its confirm (it can't be undone by a toast).

## B. The landscape menu (lr-4)
- **lr-4 The divider is the handle** (option A of `02-menu-fold`): a quiet pill (6 × 44, Control token) on the divider at mid-height; the whole divider is a 44 px-wide tap zone; tap folds or unfolds, a drag past half does the same. Nothing in the column, no words; accessible names "Fold the menu" / "Show the menu". The fold stays remembered per device (B15). A one-time help line may say "Tap the line between the menu and the page to fold it." Supersedes B15's chevron row at the foot.

## C. Campaign set-up (lr-5, lr-6)
- **lr-5 Step 2, Setting rules, on the creation step shell** (cr-1): the library's rows grouped by kind with the same chips; the ✓ slot picks, the row opens the pack's Browse with **Pick** at its foot; "needs <pack> ✓" on an overlay or adventure whose base is picked, and Next explains when it isn't ("The Drowned Abbey needs Fen Rules, Advanced · pick it, or leave the Abbey out"); "Import a file…" quiet in the foot. The order (who wins) stays the Rules tab's press-and-hold list.
- **lr-6 Step 3, Optional rules, one folded group per source** ("Fen Rules, Advanced · 23 rules · 2 changed"): changed rules first, the rest behind **Show all**; every row: name · what it does in the pack's words · **source and page** · when it can change, in words (the three levels; no padlock); two-way rules as an On / Off segment, multi-choice rules open a sheet (›). The "All defaults" explainer goes; **Reset to the books' defaults** stays as a quiet action with Undo. **A `ruleKey` clash** (two packs with the same rule) is **one callout at the top** with each pack's choice side by side and "Now: <pack> · <choice> (on top)"; inside the sources' groups that rule's row reads "Decided above · <pack> · <choice>". The resolution itself is unchanged (07, 2026-10-24/25: one pick per group, default from the pack order, "New choice for <topic>" on attaching, fall-back on removing).

## D. The Rules tab (lr-7, lr-8)
- **lr-7 Rules for this campaign** uses the same rows as step 3, editable in place (Undo over confirm; an "asks first" rule opens its preview as today): the topic groups folded with a count line ("Characters · 6 settings · 1 changed"), then the optional rules as **one group per source** (not one Optional rules group), then Character fields. On a phone one group open at a time; on a tablet any number. The second chip, **Setting rules · N**, is today's pack list (order by press-and-hold, Browse, Add more, homebrew on top).
- **lr-8 Retire campaign…** moves to the foot of Rules for this campaign (from the foot of Setting rules); same plain confirm, same banner and Bring back.

## E. Scene (lr-9)
- **lr-9** Until the campaign's time is first set, the Scene's time control reads **Set time** (then the mode's advance as today).

## Pack checker
`pack:check` warns when two packs in a library carry same-named options with no `ruleKey` (the clash the overlay's missing key hid).

## Not changed
Pack import and the Update preview; Browse; the Setting rules pack list; the resolution of `ruleKey` groups; Edit pack on homebrew only.

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (six lines tagged [library], [navigation], [campaign], [scene]).

## Amendments (2026-11-02, evening; from the builder's scope checks in #279, #283, #285)
- **lr-3:** deleting a pack from the library removes it from every campaign using it, as 07 (Deleting) says and as built; the ⋯ line reads "<campaign> uses it" (or "and N more use it") and the confirm says what goes. "The campaign keeps a copy" was the agent's error; nothing keeps a copy.
- **lr-7:** the Rules tab stays one stacked page (Rules for this campaign, then the Setting rules list); there is no "Setting rules · N" chip. Retire campaign… sits at the foot of Rules for this campaign, above the Setting rules heading. The app's own settings keep today's rows inside the folded groups (Francis: A); the step-3 row style is the optional rules' only.
- **lr-6, the `ruleKey` resolution:** it was not built in M4b (07 said so in error): the callout and "Decided above" rows were display-only until #283 built the group pick (one choice per group, "New choice for <topic>" on attaching, fall-back on removing, logged; Francis ruled B on 2026-11-02). A losing pack's own `byOption` keys and gates keep reading that pack's own choice, as built (Francis: A).

