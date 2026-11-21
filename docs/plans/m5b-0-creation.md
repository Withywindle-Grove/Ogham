# Plan: M5b step 0 — character creation revisited (M7-4, pulled forward)

Written by the design agent, 2026-11-01 (M5 gate ruling R1; order approved by Francis the same day). Read the specs it names; this file makes no rulings. Opus, high; escalate to Fable if the step-engine refactor fails twice.

## What this step delivers
Creation is the players' first meeting with the app, so it becomes the most guided place in it: a **why-line** on every step, a **blurb and the full rules** on every choice, **Help me choose**, **Shop as Add item**, **languages**, **weapon skills**, **trait lists**, **Decide later** into the To finish card, `creation.require`, and the M4b re-test creation rules. **First spells stay in M7** (M7-3).

## Already built (verify, don't rebuild)
Guided and freeform creation (M1–M4b), the review screen and Sent back (B18, 2026-10-25), starting kits and starting money, pre-mades, every class automatically (M4b step 7), the GM's review (M4b step 8), Help me choose (M4b, where present).

## Rests on
- 05 Characters: *Guided creation revisited (M5b)* and every bullet it names; *The review screen*; *Starting money*; *One-off items*.
- 06: *Character creation, guided (M5b)*; *Never open the keyboard automatically* (A4); *Main layouts: iPad first for players* (R2); Components: creation step, choice card, To finish card, Add item sheet.
- 07: `creation.require`, classes' `abilities` blurbs, `languages`, `weaponSkills`, traits, starting kits.
- 08 M7 row, *Revisit character creation* (the list; first spells excluded here).
- The M4b re-test rulings `design/rulings/m4b-retest-design-rulings.md` (N2, N4, N5, N6, N8, N9, N10, N11, N13, N14, N15, N16, N23, N24, N29).

## Build order
1. **Why-lines and blurbs (data first).** Every step gets its why-line from 06's words; every choice its blurb and a full-rules sheet from the pack (classes, races, abilities, kits). Missing pack text shows the name alone, never a placeholder.
2. **Help me choose** on every step that has a choice: the pack's guidance text where it has one, otherwise the blurbs side by side.
3. **Shop as Add item.** Starting gear uses the M4 Add item sheet with the starting money as the purse; Starting money shows on the review; negative becomes 0 when play starts (05).
4. **Languages, weapon skills, trait lists** as steps only when the pack names them (`creation.require` decides which steps exist and which are optional).
5. **Decide later** on any optional step writes an item into the **To finish** card on the Player screen; the GM's review marks what's unfinished.
6. **iPad first**: lay out every step for iPad landscape, then phone; no field takes focus by itself.
7. Apply the M4b re-test rulings not yet in the code (check each N-number against the code before touching it).

## Tests (purpose first)
- Every guided step shows a why-line and every choice a blurb; a pack without blurbs shows names only.
- Decide later puts exactly one line into To finish and the review marks it.
- Starting money after shopping equals what the ledger says; a negative balance becomes 0 at approval.
- A pack without `creation.require` for a step hides that step.
- No input is focused on opening any creation step (layout test).
- Layout test on iPad landscape and 375 px for every step.

## Scope checks (write one and stop)
- No first spells (M7-3).
- No new creation rule the pack doesn't carry; no invented guidance text.
- No change to the review screen's sections beyond marking unfinished items.

## ⚑ for Francis (ask at the start)
1. Help me choose with no pack guidance: blurbs side by side, or hide the button? **Ruled 2026-11-01:** blurbs side by side; the button stays.
2. The order of the new steps (languages, weapon skills, traits) relative to gear: pack order, or fixed after class and race? **Ruled 2026-11-01:** they follow the pack's order.

## Estimate
40–50 builder turns. Build order 1 of M5b.

## Departures
(The builder keeps this current in the same pull request.)

Built in step 0 (PR #231); what differs from the build order above:

1. **"Pack names them" read as the specs say, not as the plan's test line.** The plan's test "a pack without `creation.require` for a step hides that step" disagrees with 05 and 07: a step shows when the setting defines it (languages: the setting's races or classes name languages and the campaign has a `languages` text field to keep them), and `creation.require` only makes a step required (no Decide later). The specs win; the test checks that instead.
2. **Pack order** (⚑ 2) is read as the order the rules set's `creationGuide` names the steps in; steps it doesn't name follow in the app's order (gear, languages, weapon skills, traits). Written into 05 and 07.
3. **Help me choose with neither help nor blurbs** isn't shown: the ruling's "blurbs side by side" has nothing to show then. Written into 05 and 07.
4. **Option rows lose the "first sentence of the notes" fallback**: without a `blurb` (or its alias `summary`) a row shows the name alone (05, 07: "the pack's `blurb`"; the plan: "never a placeholder"). The detail panel still shows the full notes.
5. **The To finish card is on the full sheet**, as 05 and 06 say (the plan said the Player screen). On a landscape tablet the sheet sits beside the Player screen, so it shows there too.
6. **The new steps have no Back.** They come after "Who are they?", which saves the draft; going back there would make a second draft (gear never had Back either). The review's sections open each step.
7. **Shop is not yet the Add item sheet.** The starting-gear screen now has the creation variant's words and behaviour ("Gold to spend", each buy with an Undo toast that refunds it, **Done shopping**, the why-line and Help me choose, kit blurbs), but its item search is still its own list, not `AddItem` in a creation mode. Moving it onto `AddItem` (categories, places) is a bigger refactor of a working screen; left for a follow-up step (06 inventory says so).
8. **"Starting money equals the ledger; negative becomes 0 at approval":** there's no ledger until purses (M7b). What's built: the spend is saved with each buy and refund (the review reads it), and the review already says "it becomes 0 when play starts". Nothing to zero yet.
9. **M4b re-test rulings checked against the code:** N9 (the Later buttons removed: "How do you want to make them?" has Back; "Who are they?" has none), A4 (the name field no longer takes focus by itself), N10 (the languages step's Next stays tappable and says what's missing; the scores step already did), N13 (languages offer the setting's list plus Other…), N8 (Back and Next on one row on the new step). Not re-checked in this step: N2, N4, N5, N6, N11, N14, N15, N16, N23, N24 (built in M4b's rulings fixes; no change made), N29 (M7-3).
10. **Migration timestamps:** `20261101150000_m5b_creation_to_finish.sql` and its fix-forward `20261101151000_m5b_to_finish_name_length.sql` (the first one's length check used jsonpath `size()`, which measures lists, not text; caught by the new database test after it was on test). Both are on test. They sort after the g1 session's `20261101140000_m5b_g1_status_gm_only.sql`, which is on test but not yet in any branch on GitHub: merge g1's PR first, or the main push will see an older migration after these.

**Scope checks:**

**Weapon skills: resolved.** Ruled Now (2026-11-01, `design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md`); built in this PR as part A of `plans/m5b-0b-weapon-skills-and-traits.md` (its Departures say what differs).

**Trait lists: resolved.** Francis ruled **Now, on Fable** (2026-11-01); built as part B of `plans/m5b-0b-weapon-skills-and-traits.md` (PR after #231). The scope check as written:

> **Scope check — trait list steps (backgrounds, signs…)**
> **What:** a creation step per trait list (07 `traitLists`), with Decide later.
> **Now:** goes in M5b · cost 2 days · pushes back m5b-g1 · chance of redoing work low
> **Later:** goes in M7 · cost then the same · what we lose by waiting: backgrounds at creation in the M5b re-test
> **Signals:** touches foundations: `traitLists` isn't a kind the importer keeps yet (not in `PACK_PARTS`), so it needs a new library kind that players can read — a change to the database's player-facing kinds and their read rule (row-level security, the hooks-readable migrations), which qualifies for Fable; and sheet fields need to keep their `from` (field definitions drop it today).
> **Recommendation:** Now, as its own small step on Fable (the read rule) right after this one, because the importer leaves trait lists out of every pack meanwhile (with a warning on import).
> **Options:** A Now · B Later · C R2 · D Drop
