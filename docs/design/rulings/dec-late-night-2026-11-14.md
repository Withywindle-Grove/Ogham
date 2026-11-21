---
status: pending
milestone: December first play (the Scene's last icons and words; the folded rail; the town's stock record; finds; special seasons); how the build is paced
absorbed-into: pending, with each piece's pull request: 03, 05, 06, 07, `docs/testing.md`, `.claude/README.md`; docs/09-decisions-log.md (2026-11-14); `docs/plans/dec-3-the-whole-town.md` (released), `docs/plans/dec-9-the-whole-scene.md` rows S6, S13, S17
supersedes: nothing as a file. Inside it: ic-5 replaces ic-4's word "Journey"; w12-2 settles the case the W12 brief left open; sps-2 widens what sps-1's migration replaces.
---

# 14 November, late night: the Scene's last icons and words, the folded rail, the stock record, and the pace (2026-11-14)

## Francis's rulings

| Id | Ruling | Whose |
|---|---|---|
| ap-17 | **Folded, the campaign menu's rail keeps the campaign's sigil at its top** (a tap opens the menu), and a retired campaign shows a "Retired" tile (the lock and the word) whose tap opens a small pop-up with the banner's words and "Bring back" (page 16, frame T13). | "Approved" |
| ap-18 | **The sun-and-moon tile may carry its tints** (hard rule 7): shown with the hue removed (page 16, frame T14), the chosen half is told by its tick, its bold ink against the other's muted, and its ruled edge. | "Approve" |
| ic-4 | **The Scene's last icons and words** (page 21, frame SI1): the session's start reads "Start" with a campfire (resuming: "Resume", the lead's on his pattern); splitting the party reads "Split party" with parting arrows; saved orders take an unrolled scroll; "Answer" takes the scroll and quill everywhere; the players' "No light" card's button reads "Light". **A place's picture:** its row keeps the thumbnail, the word and its eye and loses its two buttons; a tap opens the picture large, with "Change" and "Take it off" in that pop-up's foot (page 19, frame TW13); for first play, to be reworked later. | "Start session icon is good but can it "Start" … Split the party - use split arrows- call it "Split Party" … Change picture and take it off - not sure I'd use these vs clicking on the picture itself"; "Yes to all. We may rework this image later but for the fifth it's fine" |
| ic-5 | **The band's button to start an expedition reads "Depart"**, with the winding-road icon; **in town only, its step reads "Advance time"**; "Next turn", "Next day" and the menu's "Advance by…" are unchanged. | "I'm thinking Journey becomes "Depart" same icon - next part of day should be "Advance Time""; "Next turn and next day are fine, just change it in town." |
| uf-2 | **Undo of a find the GM sent also takes back the party's knowledge of the item**, when that send taught it and nobody else holds one; under hard rule 4's exception of 2026-11-03. | "Yes" |
| sps-2 | **Where a rules set marks its special seasons GM-only:** his "hide them whole" covers an option's override too (two functions on the main database), and the weather is then the GM's to roll: a player's weather entry is refused. | "Yes to both" |
| w12-1 | **A shop's stock for the day is a new record.** The GM reads and writes all of it; a player reads only the lines in stock today, never those off or undecided. It adds a table and removes nothing. | "Yes" |
| w12-2 | **A thing with no availability information is in stock by default**; the GM switches off what is not there. | "Yes" |
| pv-1 | **No preview of the held Scene:** he waits for it to go live whole. | "No need" |

## The lead's rulings

| Id | Ruling | Whose |
|---|---|---|
| uf-3 | **uf-2's "nobody else holds one" means nobody in the party** (a party or player character, or the party's stash): a copy on an NPC or a GM's hireling does not make the party know an item. Told to Francis. | The lead's |
| rp-13 | **The line the party reads for a find names no place** and carries no row keys; where it was found is on a line the GM alone reads. For first play. | The lead's, under rp-4 |
| av-1 | **A rules set's chance by settlement size, and an item's printed availability, stay readable by players where they are today:** they are the players' book's own information. The day's answers and rolls are what players never get. | The lead's |
| mt-1 | **A map card's title is never a stub:** where it does not fit beside the tools it takes a line of its own above them, whole. Inside mc-44a. | The lead's |
| ap-16a | **Frame T12's picture C (the opened menu as a panel) is dropped:** from 600 to 1023 px the sections are tabs across the top, as built, and there is no menu column to open; the frame is redrawn so. The two columns come down to that width with the card's head. A single word wider than its line may break; no other word does. | The lead's; the slip in the frame's brief was the lead's |
| bi-1 | **The step's other uses keep their words:** the card's line after a town step ("Next part of day, nothing due"), the band's fallback heading and the log's line describe what passed and do not follow the button's "Advance time". | The lead's; told to Francis |
| pa-1 | **How the build is paced:** the town is built in the second lane beside the Scene, on its own held stack `dec-3-town-stack` branched from the Scene's (the Builder's decision), so it goes live whole and after the Scene; data and logic rows go to main; cloud seats take logic and tests-only rows; no third local lane. For a row built to approved frames the lead opens its two key pictures for the merge word and the rest in batches. Word and icon changes that touch a row in hand are held and batched. | The lead's, on the Builder's analysis |

## Open when this was written
- **For Francis in the morning:** the order of the whole (the Scene is sized at 18 to 27 builder turns: earliest 20, likely 22, late 24 November; the town 18 to 22 turns behind it; the cut line is 27 November); a person opened on their own sheet (page 19, frame TW2d, drawn, not approved), and whether a player's tap on a person's name opens anything; whether a map stops being readable by players at once when the GM hides all of a place's pieces, takes its map off or replaces it (today its copy stays readable; no screen shows players a map yet).
- **Recorded for a later yes, no pack affected:** a rules set that marks its option overrides, or its weather or exploration sections, GM-only still gives them to players through the override route.
- **After 5 December:** the place's picture reworked; a menu rail for upright tablets; a place's name on a find for players.

## Honest notes
- The lead first told Francis the Scene would go live about 20 to 21 November; the sizing moved the likely date to the 22nd.
- The W12 brief failed its second read as first written (it took a shop for a place with its own list; a shop is a `buy` service with none) and was corrected before any build.
- Frame T12 was put to Francis with a rail the app does not have at that width; he was told, and his pick (A) stands.
- One test guarding the End-expedition fix was adapted to the held stack in a way that stopped it guarding; the review caught it.
- The lead's "pm" times in notes that evening ran up to three hours fast; rulings here carry no times.
