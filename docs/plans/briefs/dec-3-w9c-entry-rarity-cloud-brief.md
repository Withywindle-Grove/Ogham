Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins. THIS brief allows a SCREEN change (the entry card's two lines) and says so.

# Cloud brief: W9c, "Rarity" and "Sold in" on a thing's entry (the town, dec-3; frame TW8b's second entry card, ap-13, approved 2026-11-14)

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR. If a guard, a hook or a permission check blocks you, stop and write what blocked you in the PR body. Never git stash, never force-push, never --no-verify. No line in docs/09 (dl-1).

## The branch
`dec3-w9c-entry-rarity`, which already exists on origin at the head of `dec-3-town-stack` (the town's held stack: it has the availability reader). Bring it up to origin/dec-3-town-stack first. PR against `dec-3-town-stack` (NOT main).

## What the frame draws (page 19, docs/design/mockups/december/19-the-town-whole.html, `entry2` ~line 367, on origin/design-december-mockups)
The pop-up "Spyglass", in the book's format: the small-caps line "Gear. A seafarer's instrument", then labelled lines in order: Cost "40 crowns", Weight "1 slot", **Rarity "Rare"**, **Sold in "Towns and cities. Waterside settlements only."** (the note rides on the Sold in line as its own sentence), then the description and the source line. The same card for the GM and a player.

## Build
- Add the two labelled lines, "Rarity" and "Sold in", AFTER Weight, in the shared entry part (src/app/ItemEntry.tsx `itemEntryParts`, ~:27/:48, which builds Cost and Weight at ~:37-42; used by AddItem and creation's weapon skills). If the Rules browser's entry (RulesBrowser.tsx, describe.ts) or ItemSheet.tsx draws the same card separately, say where; change ONLY the shared part, never copy it (build once). If the card the frame means is a different component than ItemEntry, STOP that part and write the question in the status file.
- Read the item's `data.availability` (`{ where?, chance?, rarity?, note? }`, docs/07-content-packs.md:315) with the EXISTING reader `readAvailability` (src/modules/requests/shopStock.ts:25-40 on the stack). The app layer may import it; a module must not import another module (hard rule 6): if the shared part lives in a module, write the question instead.
- PRINT EACH LINE ONLY WHERE THE ENTRY CARRIES IT: no rarity → no Rarity line; no sizes/where → no Sold in line; a thing with neither shows nothing new. The note goes on the Sold in line as its own sentence, as drawn.
- NOTHING about the CHANCE ("x-in-y") on the entry: that stays the GM's stock table's.
- Check, and SAY in the status file: can `availability` ever sit in a pack's `gmOnly` part (hidden from players)? If yes, a player's entry must not show it: stop and write the question.
- Words: only the frame's ("Rarity", "Sold in"); how a size list reads ("Towns and cities") from the data: if the data's sizes need wording not in the frame, list it for the lead.

## Pre-flight checklist (tick each in the status file)
(a) the plan's Departures (docs/plans/dec-3-the-whole-town.md, W9) written; (b) the shared part changed, nothing copied (06's inventory row updated); (c) n/a unless a pop-up opens from inside a sheet; (d) text in ink; (e) no new words outside the frame, or listed; (f) n/a (no buttons); (g) accent count on each picture (expect 0).

## Tests (purposes first)
Rarity and Sold in print when present, in order after Weight; neither prints when absent; the note rides on Sold in; nothing of the chance shows; the same for a player and the GM.

## Pictures
If your environment can run the layout browsers (`npm run test:layout`), take: the entry with both lines (tablet 1024, phone 375, light) and an entry with neither; put them in the PR (attach, or commit under docs/design/pictures-for-approval is NOT yours: just attach to the PR body or say). If it cannot run browsers, SAY SO plainly in the PR body: a local run will take them.

Status file `docs/status/2026-11-15-dec3-w9c-entry-rarity.md`. PR title: "W9c: Rarity and Sold in on a thing's entry". No label, no auto-merge.
