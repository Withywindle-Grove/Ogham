---
status: absorbed
milestone: December first play (the town page; `docs/plans/dec-2-3-places-and-port.md`, piece 2c's "About the town")
absorbed-into: docs/09-decisions-log.md (2026-11-18); docs/07-content-packs.md (Rule text set out like the book, its list of fields); docs/06-screens-and-design.md (the inventory's Place facts and Place rules rows, RuleText); built by the pf-18b pull request
supersedes: nothing. It widens pf-18 (`dec-rule-text-blocks-2026-11-13.md`) by one field
---

# A place's GM sections may be set out like the book (pf-18b, pf-18c; 2026-11-18)

A design sitting with Francis, 2026-11-18, on the Pack Creator's question. A pack's location carries GM sections, `gm.sections[]`, each a `heading` and a `text`. pf-18 lets three fields hold rule text in blocks (a place rule's `text`, an area's `gm.text`, a procedure step's `text`); a section's `text` was not one of them. The app reads a section's text only as a plain string (`readPlaceFacts`, `src/modules/expedition/placeFacts.ts`), so a section written in blocks would show its heading and nothing under it. A pack port waits on this: 12 sections, held as plain strings until the app reads blocks there. Nothing is lost on screen today.

| id | Ruling | Francis |
|---|---|---|
| pf-18b | **A location's `gm.sections[].text` is a fourth pf-18 field.** It may be a plain string or `{ "blocks": [ … ] }`, in pf-18's shape exactly. pf-18a applies unchanged: the one reader, the one plain-words function, the one checker rule. An opened section draws its blocks with the rule text's one look (RuleText). A plain-string section looks as it does today. Options weighed: (B) flatten blocks to plain text when the pack loads (loses the lists and boxes, and is a second way of doing one job); (C) the pack checker refuses blocks there (the port keeps plain strings). | "a" |
| pf-18c | **A small mockup first, then approved:** page 22, `december/22-town-sections-set-out.html` (frames PB1 to PB3), approved 2026-11-18 with its three picks: (1) a section the app can't read keeps its heading, with one muted line, "The pack gives no words for this section." (after the place rules' "The pack gives no words for this rule."); (2) a box inside a section keeps its border, even when it is the section's only block; (3) a sub-heading inside a section is the book's sub-heading as approved, though it stands larger than the section's own name: one look for the book's text everywhere, no variant. | "b"; then "approve with the three picks" |

## What does not change

- **Who sees it.** A location's GM sections are the GM's. Blocks change how they are drawn, not who receives them (hard rule 5). Where a section is ever shown to players (page 19's eye on a fold), pf-18a's link rule holds: a link is a tap only to what that player can see, else its label as plain text, and no id reaches a player's device.
- **The fold row** is the app's as built (a left ›, no eye; `src/app/PlaceFacts.tsx`). Page 22 draws page 19's row; only what an opened fold holds is this ruling's. The eye and the right chevron are dec-3 W2's; this piece's picture comparison covers the opened fold only. The fold mark's change to + and − (pl-1, after 5 December) is not part of this piece.
- **The pack's words.** The port converts its sections word for word; only the separators become blocks. The Pack Creator's two small choices (a rolled list as a numbered list or a titled table; a bold lead-in for a named game) are the driver's, as the Pack Creator asked.

## Where the mockup lives

The page links the December mockups' shared files, which are on the unmerged `design-december-mockups` branch, so it is committed on `design-pf-18-mockup`, stacked on that branch (commit `c018dde2`). Its pictures, as approved, are in this repository: `docs/design/mockups/places/png/pf-18c-town-sections-*.png`.

## The builder's piece (for the driver's brief)

Row: pf-18. Mockup: page 22, approved 2026-11-18 (pf-18c). Opus, medium.

1. `readPlaceFacts` reads each section's `text` with the shared reader (`readRuleText`, `src/modules/library/ruleText.ts`). A string keeps today's handling (`plainLinks`, then `paragraphs()` on the page). Blocks go through `blocksOfRead` (`src/modules/expedition/placeRules.ts`) to the expedition `RuleBlock` that RuleText takes. (Place rules use the looser `ruleBlocks`; this field uses the strict reader, as pf-18a asks.) Tables a section links to are found in blocks too (`ruleTextLinks`); a `tableRef` block, which `ruleTextLinks` skips and `blocksOfRead` draws as nothing, adds its id to the place's `tableIds`. A section is empty when it has no blocks to draw (judged on what `blocksOfRead` returns, not on what the pack wrote); it keeps its heading.
2. The town page's opened fold (`src/app/PlaceFacts.tsx`) draws blocks with `RuleText` (`src/ui/RuleText.tsx`), a plain string as today, and "The pack gives no words for this section." for an empty one (pick 1). No new component and no variant (picks 2 and 3).
3. The pack checker checks `locations[].gm.sections[].text` once, by the one rule-text rule. Adding the path to `RULE_TEXT_PATH` (`scripts/pack-town.mjs`) makes the town walk skip those strings, so `ruleTextFields` (`scripts/pack-rule-text.mjs`) gains the field in the same change. The test: a bad link in a section is reported exactly once.
4. Tests, with invented packs: the reader (string, blocks, unreadable); the checker (a good and a bad section); a layout check of an opened section in blocks at 375 px.
5. Docs in the same pull request: 07's pf-18 list of fields gains this one; 06's inventory row for RuleText names the town page; this file's header is marked absorbed.
6. Pictures of the real town page (an opened section in blocks, a plain one and an unreadable one; light and dark; 375 px), compared with page 22, before merge.

Then the Pack Creator may build the port's 12 sections in blocks.

Docs to update: 09 (this pull request); 07 and 06 (the builder's pull request).
