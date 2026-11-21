# Intent: character creation, reworked step by step

Author: Francis (written down by the design agent from his testing notes) · Date: 2026-11-01 · Status: done (ruled and planned 2026-11-01; build pending)

## Problem
Testing guided creation with classic-advanced after the M5b step 0 build (2026-11-01, evening): several steps still don't do their job, and the flow was never designed screen by screen.
- **Help me choose** repeats what the race and class rows already show; it should talk about the *choice* (what it decides, what to weigh), not list the options again.
- **Race and class** rows don't show their source and page, nor explain abilities, advantages and disadvantages.
- **Trade points** (the ability adjustment): the top explainer isn't needed; the step runs even when the setting has no such rule; the racial bonus isn't shown on the scores; the rule's limits aren't enforced (a score can go below the floor; a score can be raised without lowering another). "It has never worked": rebuild from scratch.
- **Who they are / details** still asks for things the app works out or other steps fill (armour class, movement, weapon proficiencies); literacy offers no choice. Rebuild from scratch.
- **Gear** has only kits and a search bar: it needs the Add item browsing the Pack screen has.
- **Languages** lets any number be picked; the setting limits the count and names the languages, and the list shown is partial.
- **Secondary skills** rows explain nothing (the source gives no text: confirmed a source limitation).
- **The review step** has no label and no Back; scores say they can't be changed, yet Details lets you change them without the top reflecting it. Rebuild from scratch.
- **Steps 7 and 8 look different** from the rest: two visual styles that depart from the standards, sparse, "like a low-res web page".
- Not tested yet: a spell-casting class; the second setting (fae-woodland), next time.

## Outcome
A player sits down with the setting's book closed and makes a character in one calm pass: every step says what the choice is and why it matters, shows only what the setting actually asks, enforces the setting's own limits, cites the page, and looks like the rest of the app. Casters leave creation with their first spells. The review is one page where "Change ›" goes back to the right step.

## Touches
05 Characters (Guided creation revisited), 06 (the creation steps, Option rows, To finish card, a mockup per step), 07 (structured shapes for rules that are text today: ability adjustment, languages and their INT count, derived sheet fields; `creationGuide`, `firstSpells` filled in the packs), 08 (first spells move from M7 into this rebuild; the spell book record comes with them), 11 (new rows). Private packs: classic-advanced and fae-woodland need `creationGuide`, `firstSpells`, a languages section, `fill`/derived marks on sheet fields, `ruleKey` on the overlay's encumbrance options.

## Constraints
Hard rules 2 (no book text in the app: the app's own guidance stays generic), 7 (tokens only, 44 px, one accent, never a disabled button, Undo over confirm). Fewer taps, calm screens. Everything through commands. The builder pauses creation-related work until this is ruled.

## Out of scope
Spell preparation and casting (M7). Level-up (M7). The Rules library, campaign creation, "Set time" and the landscape menu: a second intent, `2026-11-01-library-and-campaign-setup.md`.

## Open questions
- ⚑ 07 shape for the ability adjustment rule (today a sentence in both packs).
- ⚑ 07 shape for languages: the list, the common and alignment tongues, the INT-based extra count (today a table in one pack and an ad-hoc object in the other).
- ⚑ Which sheet fields creation asks for: only those not derived (`fill`) and not filled by another step.
- ⚑ First spells pulled forward from M7: the spell book as data only (a migration), the packs' `firstSpells` filled first.

## Links (filled in later)
Ruling: `../design/rulings/m5b-0c-creation-rebuild-2026-11-01.md` · Plan: `../plans/m5b-0c-creation-rebuild.md` · Pull request: — · Status report: —
