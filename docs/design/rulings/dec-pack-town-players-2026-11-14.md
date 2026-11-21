---
status: pending
milestone: December first play (the whole Pack tab; the whole town; the players' Scene at a spot; the foot of a sheet; a hoard's coin)
absorbed-into: pending, with each piece's pull request: 03, 04, 05, 06, 07; docs/09-decisions-log.md (2026-11-14); .claude/README.md (ln-1, 2026-11-18)
supersedes: nothing as a file. Inside it: bu-1 adds a sixth exception to hard rule 4; fr-2 replaces the lead's proposal of a fourth tile in town; ft-1 replaces tf-4's stretch of a lone choice in a pop-up's foot.
---

# 14 November, the afternoon's second half: the Pack tab, the town and the players' Scene approved as whole pages (2026-11-14)

The Design Studio drew each screen as one page on the shared mockup stylesheet (ms-1), opened every frame in both themes, and Francis ruled them from pictures. Pictures of record: branch `design-december-mockups`; the Pack tab `pack/08-the-pack-tab-whole.html`, the town `december/19-the-town-whole.html`, the players' Scene `december/18-the-players-scene-whole.html` (at 545dd168), the Scene's top `december/16-the-scenes-top-in-every-state.html`.

## Francis's rulings

| Id | Ruling | Whose |
|---|---|---|
| ap-7 | **The Pack tab's second sitting is approved** (PK8 to PK13): each action on a sheet is a row with a leading icon and no line under it; "Eat one" or "Use one" on a stack's sheet as well as at hand; the − and + on a stack become a row "Correct the count…"; no Split; Give and Put in as one sheet; when giving, a warning only and never another's load; a find field once a pack passes about twenty things; the sheet from the foot on a phone and centred on a tablet. After adding something bought, a toast says its cost is not spent yet and offers "Spend N" (the approved Spend sheet, filled in) and Undo; nothing is charged by itself. | "Approved pack tab- it uses pack descriptions right?" |
| ap-9, pd-1 | **A thing's sheet shows the pack's description whole, in the book's format**, under its facts and above its actions, with its source line. A long one scrolls inside the sheet while the actions stay at the sheet's foot. A thing with no description shows nothing. A one-off added by hand shows the player's own words as plain text with "Written by <Name>.". | "it uses pack descriptions right?"; "Approve description" |
| ap-8 | **The town's first sitting is approved** (TW1 to TW7), with tn-1 to tn-3 below. | "Otherwise approve town with your changes" |
| tn-1 | **On first play Buy adds the thing to the pack and charges nothing by itself**; the toast offers "Spend N" and Undo. There is no Order button that night: "Ask for…" is the request, as built (frame TW4a). A shop's stock list with Buy on a row follows later. | The Studio's picks, approved with ap-8 |
| tn-2 | **A place's name and number show to players as soon as it is in "Places you know".** | The Studio's pick, approved with ap-8 |
| fr-1, fr-2 | **In town the top's facts are three tiles, centred: Weather, Part of the day, then the sun and moon tile, which is always the rightmost.** No Encounter check tile there. On a phone the first two sit side by side and the sun and moon tile takes a row of its own. | "Strip at top should be centered with a fourth tile if we have an appropriate one."; "By day/night always rightmost tile. Keep the three. Encounter check is duplicative" |
| tr-1 | **A player may read a place's shown description, parts, picture and keeper's lines while their group is in that town.** Only what the GM has shown with its eye. The lead's limits: a place one level under the town of the group's current visit; exactly what a shown piece sends today; the place's own row stays the GM's; no person unless written into a shown piece; nothing after the group leaves. | "Yes to both" |
| ge-1 | **The GM may open the eye on a part of a place in town while the party is in the town but not in that place.** Every other check of that action stays. | "…Yes" |
| bu-1 | **"Buy it" gets Undo: a sixth exception to hard rule 4.** The buyer's own bought item is removed if nobody has touched it since; the log keeps a full copy. Only the buyer's own Undo of their own purchase; refused once the item is touched; a spend made from the toast is separate; the GM's general Undo goes on refusing a purchase. | "Yes to both" |
| ap-10 | **The players' Scene at a spot is approved** (page 18), with the Walk icon replaced by a leather boot: a way's button is its icon, its word and its time on three lines; a tap on it opens a short pop-up saying the GM moves the party (pw-1); prompts sit between the strip and "Where to?"; a split party's line names who is elsewhere, never where; on a phone what a player acts on comes before what they read; a tap on a fact opens its rule in the book's format, and Light alone offers an act, the player's own torch. | "Approve with fixes" |
| ft-1 | **Buttons in a sheet's or a card's foot are right-justified.** A lone accent sits at the right at its own width. Two or more sit side by side at the right in code order, which is reading order; the order within the group is the screen's approved drawing, and the accent comes first where none settles it; they stack at the right only where they do not fit a row. Replaces tf-4's stretch. | "Our standard is buttons are right justified" |
| ln-1 | **Two checks may run at once while free memory is 12 GB or more; one below 10 GB.** Tightened by the Builder after a dip to 7.2 GB with no kill: the second runs only with three test workers, only with 13 GB free at its start, and is dropped below 9 GB; a layout run counts as a heavy thing. | "Two checks at once yes" |

## The lead's rulings

| Id | Ruling | Whose |
|---|---|---|
| tn-3 | **A town with places of its own lists those**, each with its eye; the setting's generic services and lodgings are listed only for a town with none of its own. "Ask for…" does not depend on a listed shop. | The lead's |
| pf-24, pf-24a | **A treasure entry's `coins` map** (the setting's currency ids to whole numbers) **is coin to hand out; `value` is worth only.** One entry may carry both; an entry with no `coins` hands out no coin. A coin word the setting does not define: the amount sits under the coin it is read as, with `coinsReadAs: { printed, note }`. The checker notes a key that is not a currency id, an amount that is not a whole number of 0 or more, and `coinsReadAs` without `coins` or missing a part. | The lead's, with the Pack Creator |
| pf-25 | **A way of travelling may name its `icon`**, a name from the app's set (an invented example: `{ "by": "wade", "name": "Wade", "icon": "leather-boot", "value": 2, "unit": "turn" }`). Without one, the app reads the way's short id `by`: where it names a way the app has an icon for (row, swim, climb, walk), that icon is used; otherwise the generic way mark. An `icon` the set lacks falls back to the mark. The button's label for a screen reader is the way's `name` with its time. The checker errs on an `icon` that is not a non-empty string and notes a name not in the set. | The lead's, with the Pack Creator |
| pk-14 | **On the purse's sheets Spend carries the coin icon, Give the open hand, and Put in (coin into the party stash) the open chest**; the GM's coin line on a character's pack arrives with the GM's views. | The lead's, under ic-1 |

## Open when this was written
- **The card after an expedition ends** had no drawing in the new dress (Francis: "still Old and missing toggle and icon buttons"). It is drawn on page 16 (frames T11 to T11d) and is with him: the safe-place answer as the two-sided switch, the rest's line, a row a character with hit points and Heal; whether Undo stays on the card until it is answered.
- The town's second sitting (stock for the day, rumours and the board, the encounter tables, the town with its map) is drawn and not yet put to him.

## Honest notes
- The lead proposed the town's Encounter check as a fourth tile; Francis declined it as a repeat of what the sun and moon says.
- The first drafts of the briefs for tr-1 and bu-1 each failed a second read against Francis's words (depth and columns unsaid; the kind of entry the Undo may remove unsaid) and were corrected before any builder had them.
- The lead put built pictures showing an old card in Francis's folder without saying so; pictures of a surface not yet rebuilt are now named as such or kept out.
- The lead opened, of each page's frames: the Pack tab six of twenty-four, the town three of twenty-nine, the players' Scene two of fourteen; the Studio opened every frame of each in both themes.
