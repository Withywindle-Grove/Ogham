---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Characters: Guided creation, rebuilt), docs/06-screens-and-design.md (Components: Creation step shell, Score tiles, Adjust tiles, Derived fields, Review step; Option row, Weapon skills step, Trait list step amended; mockups creation/00–09), docs/07-content-packs.md (Creation rules as data), docs/08-roadmap.md (M5b: m5b-0c; M7: first spells moved; Later: Roll for me), docs/09-decisions-log.md (2026-11-01)
supersedes: parts of design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md (ⓘ on pick rows → the row opens the entry)
---

# Character creation, rebuilt step by step (design ruling, 2026-11-01)

From the intent `docs/intents/2026-11-01-creation-rework.md` and a paper test of both test settings (classic-advanced 0.5.8, fae-woodland 0.2.10) walked with Francis, one step per message, a mockup per step (`design/mockups/creation/00-flow-and-shell.html` … `09-review-and-finish.html`). The walk itself is `design/notes/creation-dry-run-notes.md`. Francis approved the whole list on 2026-11-01. Ids: `cr-1` … `cr-25`.

## A. The shell and the flow
- **cr-1 One shell for every step:** ‹ Back · the step's title in the pack's word ("Kindred") · "Step N of M" in words · the why-line (the pack's `creationGuide`, else the app's) with **Help me choose** as a quiet link · the content as **Option rows** (name · one-line blurb · source and page) · a foot with **Decide later** (quiet; absent on a required step) · what's picked · **Next**, the step's one accent. Replaces the two visual styles of today's steps 7 and 8.
- **cr-2 Back keeps every value**, editable. **Next checks** for missing data and an illegal game state and says what's wrong ("CHA is missing", "Stone kin needs DEX 9 · you have 8", "2 to spend"); it never blocks silently and is never disabled. The last step re-runs every check and lands on the first failing step.
- **cr-3 A step exists only when the setting defines it and this character can use it**; the counter counts this character's steps. (Method with one path, Adjust scores with no rule as data, Languages with nothing to pick, Weapon skills with the option off, an option-gated trait list with the option off: absent, not shown empty.)
- **cr-4 Order:** method · scores · race · class · adjust scores · who they are, then the pack's `creationGuide` order, else **first spells · gear · languages · weapon skills · trait lists**, then review. Who they are stays after Class (a name is "the cherry on top" of a rolled character).
- **cr-5 Pick rows everywhere:** tapping the row opens the entry's full rules with **Pick / Unpick** at its foot; the **✓ slot** on the left picks in one tap. No ⓘ on pick rows (amends the weapon skills and trait list rulings of the same day).
- **cr-6 Help me choose** is about the choice, not the options: *what this decides · what to weigh · if you're unsure*; the pack's `creationGuide.<step>.help` when present, else the app's generic, rules-free text.
- **cr-7 Unmet requirement, or a class not open to the race:** Next explains and offers **Ask the GM to allow it** — a Request (Yes / No) the GM answers from Waiting for you; "Not open to <race> · N ›" stays folded at the foot of the class list, never hidden.

## B. The steps
- **cr-8 Method** only when the player has a path to choose (setting A's creation-method option on "each player chooses"; setting B's kindred-as-class option); the hint says how many steps the pick gives; no Decide later.
- **cr-9 Scores:** six tiles in the pack's ability order, each **starting at the dice average** with − / + and tap-to-type; the modifier and what it affects from the pack's table appear as the number is set; a setting's start-over rule is offered in a callout (Start over / Keep them), never forced. **No digital roll anywhere in creation** ("Roll for me" to the parking lot). **The pack must say the score dice and range** (07 `scores`); the checker warns when it doesn't.
- **cr-10 Race and class:** a **scores strip** under the title from the race step on, racial changes applied live ("CON 11 → 10 · bog folk −1"); each row carries a **fit line** from the scores (requirement met or not; the class's prime requisite and the XP bonus it earns, hit die, the level cap for the chosen race, "casts"); the full entry has six headings: requirement · score changes · advantages · disadvantages · languages · open classes.
- **cr-11 Adjust scores:** the same tiles with the rule's buttons only — **−2** on the scores the setting lets you lower, **+1** on the class's primes, a labelled **Undo** per trade — before → after and the modifier's change on each tile; a **bank line** ("Lowered WIS by 2 → raised STR by 1 · 0 to spend"); a forbidden tap answers in a line. No top explainer, no Decide later. Back to Class resets all trades (toast, Undo). The step exists only when the rules set has the trade as data (07 `abilityAdjustment`).
- **cr-12 Who they are:** name · **hit points** (the class's die and the CON modifier shown, the pack's minimum, the roll typed; the re-roll option's callout only when on and triggered) · alignment as Option rows with the pack's notes · portrait (optional) · any free sheet field the layout leaves. **Derived fields** (the section's name): AC, movement, attack, saves, literacy, title, skills, languages so far — read-only, from the pack's `fill` marks only, updating with the picks; never asked. Fields other steps own never appear here. Alignment visibility is **per pack** (owner + GM, or everyone).
- **cr-13 First spells** (moved from M7): only for a class whose `firstSpells` says so; groups **Given** (ticked, not untickable) · **Pick N** · **Roll dN** (ranges first, tapped, never auto-rolled; a duplicate is rolled again unless the pack says otherwise) · **Cantrips** as a second group when the class has a `known` block; the full rules one tap from every spell. The picks go into the **spell book, a list of known spells on the character** (04; ◈ a book as an item stays open).
- **cr-14 Gear:** starting money (the pack's dice, typed) · the class's kits as rows (contents in one line, cost, weight, page) · **Browse the shop ›**: the Pack screen's Add item in creation mode (categories with counts, the item's one line, weight, page, price; **Gold to spend** falling with each Add, Undo; **Done shopping**) · kit and shop together · an item the class may not use is listed and says so, Add still works · a tally: carrying, **load tier live** from the campaign's encumbrance rule, spent, left · when the setting rolls gear, the kits are a rolled list and the shop link is absent. Next checks only overspending.
- **cr-15 Languages:** **Yours already** (the common tongue(s), the alignment tongue following the alignment picked — hidden when the setting's option turns alignment tongues off — the race's and the class's) · **Pick N more** from the setting's language list, N from the INT table · **Other…** (a typed language kept in the campaign's homebrew) · literacy as a derived line · skipped when there is nothing to pick (the given ones show on the full sheet). The alignment tongue follows a later alignment change (owner, logged).
- **cr-16 Weapon skills:** as ruled the same morning, drawn on the shell (cr-1, cr-5).
- **cr-17 Trait lists:** one step per list the sheet points at, in the pack's order; with a die, ranges first and "roll, then tap — or pick" unless the pack's notes insist on the roll; **Other…** with a name and an optional note (kept in the campaign's homebrew); an option-gated list is absent when its option is off; a per-race list (`from` as a pattern) is chosen automatically; an entry that grants gear fills the pack when picked (Undo).
- **cr-18 Review:** "Step N of N · Review", Back; one read-only section per step in the order walked, each with **Change ›** back to its step (the only way to change anything here); Derived fields marked "from the rules"; a First spells section; a **To finish** box listing every Decide later with "Do it now ›"; **Send to the GM** as the one accent (the character then waits for approval, as today); **Save and leave** here only (every step keeps its values anyway).

## C. Pack format (07, Creation rules as data)
- **cr-19** `rulesSets[].scores: { dice, min, max, startOver?: { everyAtMost?, countAtMost?: { count, value }, option?, note } }` — required for the Scores step; the checker warns when absent.
- **cr-20** `rulesSets[].abilityAdjustment: { lowerBy, raiseBy, lowerable: [ability ids] | "nonPrime", raise: "prime", floor, cap?, classExceptions?: [{ classId, cannotLower: [ability ids] }], note, source }` (a string stays legal as reference text and gives no step).
- **cr-21** `rulesSets[].languages: { common: [ids], alignment: true | false, list: [{ id, name, blurb?, note?, source? }], extraFrom: "INT" }`; the ability table's `extraLanguages` column is a number; races' and classes' `languages` name ids of the list (a bare name is matched by name, the checker warns).
- **cr-22** `rulesSets[].alignmentVisibility: "owner" | "all"` (default `all`): who sees a character's alignment.
- **cr-23** Sheet layout fields that the rules work out carry `fill` (already in 07); creation asks only for fields with no `fill` that no step owns. The app keeps no list of derived fields.
- **cr-24** Classes' and races' `abilities[]` may carry `kind: "advantage" | "disadvantage"` for the entry's headings (default advantage).

## D. Roadmap
- **cr-25** First spells, the spell book list and "the full rules one tap from a spell" move from M7 into **m5b-0c**; the builder pauses creation work until the plan is in.

## Not walked, already covered
Approval (M4b), the To finish card (m5b-0), the Request pattern (M5 step 12), the Add item sheet (M4).

## Withdrawn during the run
None.

## Pack tasks (both settings; the pack session)
`creationGuide` (why and help per step) · `firstSpells` on every caster (11 and 5 classes) · the `scores` block · `abilityAdjustment` as data · the `languages` section and a numeric `extraLanguages` (setting A's "Native + 1") · `fill` on AC, movement, attack, title, literacy, skills · abilities tagged advantage / disadvantage · `alignmentVisibility` where the book says players may keep it private (setting B) · `ruleKey` on the zine overlay's two encumbrance options · blurbs wherever the source has text (setting A's secondary skills have none: confirmed).

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-01 (ten lines tagged [characters], [packs], [roadmap]).
