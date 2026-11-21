---
status: pending
milestone: December first play (the town's data under a place opened and its people; the Scene's sheets; small rules of the build)
absorbed-into: pending, with each piece's pull request: 03, 04, 05, 06, 07; docs/09-decisions-log.md (2026-11-15, lines still to add once the earlier docs pull request has merged); `docs/plans/dec-3-the-whole-town.md` rows W4, W4b, W4c, W8; `docs/plans/dec-9-the-whole-scene.md` rows S4, S10, S15
supersedes: nothing as a file. Inside it: pp-1 is stated here as corrected (its first wording, one rewritten body per person, was never built).
---

# 15 November, the small hours: the lead's rulings while Francis was away (2026-11-15)

Francis was logged off ("keep working"). Nothing here is his ruling. Everything that needs him is listed under "For Francis". GitHub Actions was stopped all night, so nothing here reached main.

## The lead's rulings

| Id | Ruling | Why |
|---|---|---|
| bd-1 | **Page 19's cut-down bands are not the reference for the band.** Frames TW1b, TW1c, TW7, TW7b, TW8b, TW9b and TW12 draw "Advance time" and the menu only; page 16's frame T4 and ic-5 govern the band. | The Studio's fact; no redraw of approved frames |
| hx-1 | **"Hide all" is not offered when nothing is shown, for places in town and places inside**, as frame TW12 draws (ap-12). It does not reach Pieces: page 11's frames 5 and 4c keep "Hide all" there. | Two approved frames disagree: with Francis |
| sa-1 | **Accents are counted on the surface a person can act on.** The page dimmed under a sheet's backdrop is not counted; a chosen state (a pill's tint and edge) is not an accent. | Asked by the Builder on S5's sheet |
| tv-1 | **A facts tile's long value stays on its one line** (mc-39b: a fact's value never wraps): it drops one step in the type scale (never under 16); if it still does not fit it is cut on that line with an ellipsis; the whole value is in the tile's sheet and its accessible name. Built with S15. | A long weather name ran to three lines of the large type. The lead first allowed two lines, against mc-39b; corrected before it was built |
| pp-1 | **One piece per person from a pack; each revealed line is its own show, for one visit; the text a player gets is composed when it is read.** The piece's own row holds nothing of the person. No person id that players can read; nothing revealed to one group reaches another. Until Francis answers, the heading players get is the name without the role. | np-3, tr-1; the first wording failed its second read |
| pf-26 | **A location may carry `kindWord`**, an optional short string printed in brackets after the place's name in its heading; without one, no brackets. An invented example: `"kindWord": "chapel"`. The checker notes one that is not a non-empty string or is over about 30 characters. | TW2's heading; with the Pack Creator |
| pf-27 | **A person (`npc`) may carry `alignment`**, an optional string; the pack then leaves it out of the Demeanour text. The app prints "Demeanour (Lawful):" from the field and lifts nothing out of prose; without the field the text prints as written. | np-1; with the Pack Creator |
| wbs-1 | **The weather between sessions follows st-2 and gets no row of its own:** a paused Scene keeps its facts row, the Weather tile with it; before the first session there is none, and a roll that is due may show in "Waiting for you". | Asked by the Builder on S10 |
| hr-1 | **The hour stays Hour and Minute** wherever no setting names dawn, noon and dusk (mc-25's own words), which is everywhere today. | No pack field exists for a setting's named hours |
| tps-1 | **The store of a place in town's shows is a table of its own**, by the group's visit and the piece; existing shows and every existing reader are left as they are. A new visit starts with nothing shown. A group number that empties or is filled from empty is reset by a marker, so later members read nothing shown to earlier ones. The briefs: `docs/plans/briefs/dec-3-w4b-w4c-place-in-town-brief.md`, `docs/plans/briefs/dec-3-w8-person-lines-brief.md`. | tr-1, ge-1; the first design would have sent these shows through eleven existing reads |
| sh-1 | **A pack's shops are imported as a library kind `shop`, the GM's alone** (add-only, as `npc` was). A pack place is a shop when a shop entry names it by its exact id. The day's stock is keyed by the place's own entry key, which players already receive. The GM's table lists that shop's own stock lines, titled by the shop's name. A place that is no shop has no stock table. | W9: the app could not tell which of a pack's places sell things |
| sh-2 | **At a pack shop the shop line's own availability wins** where it has one; a line with none takes the item's; neither means always in stock (w12-2). The price in the table is the shop line's. The lead's reading of tn-5 and ap-13; told to Francis. | 139 of the port's 152 stock lines carry their own |
| sh-3 | **Proposed, waiting for Francis's yes (it replaces a players' read; the lead first treated a narrowing as needing none, and the Builder held it). For a pack shop a player's app knows only what the GM has switched on:** the players' reader returns stored "in" answers and computes no defaults for a place's key. A narrowing: before it, the reader answered from every item for sale in the campaign. | The reader would have said a bladesmith stocks rations |

## Accepted as built (the shared part governs, not the mock)
- On the Weather sheet: the roll line above the table's band, the band's title centred, and ranges in words ("1 to 6", cs-7) are the shared book-table part as approved in creation; frame T6's drawing of them was the mock's.
- A place opened (W4) is built as frame TW2 less its eyes and less the keeper's box, which wait for W4b, W4c and W8. The sheet starts at the folded rail's edge; an unfolded menu lies dimmed under it.
- Kind words on the Scene's place card are in bold ink (page 11); the town's frames on page 19 draw them in the label colour. With Francis.

## For Francis (collected, not decided)
1. How the first night opens, and with it **Start session**: mc-24 puts the expedition's start inside it; the town's top as built shows Start session with Depart beside it; frame T3a draws a state the app shows as the town's top. Start session is left exactly as it is until he rules.
2. A yes for the database: one index of the new store replaced so that each of a person's lines can have its own row (no data removed; the table held test rows only and had not reached main).
3. Whether what a group number has been shown is the group's shared knowledge or only its members' at the time (live on main since 31 October: `docs/status/2026-11-15-finding-group-number-history.md`).
4. Whether a person's role may show to players with the name.
5. Whether a return to a town should find a place's parts still shown.
6. "Hide all" at none shown, and a piece's kind word: page 11 and page 19 disagree.
7. Frame TW1d (leftover entries, "Still shown from before"), drawn and not approved.
8. Five people's Demeanour lines in the port pack still begin "DRAFT: ".
9. A yes for the database: replace the players' stock read so that, at a pack shop, a player sees only what the GM has marked in today; nothing new becomes readable (sh-3; built, applied nowhere). Then: whether a player's app may treat a pack shop's lines marked "always", or with no availability, as in stock without the GM's flip (a wider read; not built).
10. The players' read of a place's own procedure for the strip, and of the region for the session line (one read; S15 is built without it).
11. A line for `CLAUDE.md`, "Things Claude gets wrong": a pop-up opened from inside a sheet keeps its own form (flagged twice).
12. Told, no answer needed: frame T6 draws "Tomorrow's roll" and the app rolls today's weather (kept); dawn, noon and dusk are not on the 5th; no weather outside an expedition.

## Honest notes
- The lead's first brief for W4b and W4c would have leaked a place's shows through eleven existing reads; the builder's worker stopped before writing any SQL. The briefs for W4b/W4c and for W8 failed their second reads eight times between them before passing; every failure was found before any code.
- The request for a line key in the store reached the Builder ten minutes after its migration was on the test database; hence item 2.
- The builders read those briefs from a docs branch, not from main, because main was shut.
- The lead used three ruling ids that were already taken (ha-1, ac-1, pg-2) and renamed them (hx-1, sa-1, pp-1); two more were caught while writing this file.
- Pictures the lead opened before each merge word are named in each pull request's merge comment; the lead did not open the dark pictures, nor most of the other sizes.
