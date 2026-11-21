---
status: absorbed
milestone: December first play (the test feedback of 19 November and `docs/intents/gm-view-as-player-2026-11-19.md`: `docs/plans/test-feedback-2026-11-19.md`, row C15; mockup page M3)
absorbed-into: 05 (the GM's "View sheet"; the full sheet's line on it; the GM's Pack); 06 (GM's view as the player, a new row); docs/09-decisions-log.md (2026-11-19); `docs/plans/test-feedback-2026-11-19.md` (sections C and D); the intent's own Links and its line on the Scene. docs/03 is not changed (tfg-5). The Players list's row and the view itself are not in 06 as pictures: page M3 draws them, and nothing here is built before he approves that page
supersedes: nothing as a file. Inside it: tfg-1 replaces what "View sheet" and "Pack" open for the GM (05: the full sheet's page, and the Pack "with these GM extras"); tfg-1's Scene replaces the intent's "Out of scope: the players' Scene"
---

# The test feedback of 19 November, sitting 7: the GM's view as the player (ruled 2026-11-19)

The last of seven sittings, from `docs/intents/gm-view-as-player-2026-11-19.md` (the questions in `docs/design/notes/test-feedback-2026-11-19-sittings.md`; his answers in `docs/design/notes/test-feedback-2026-11-19-answers.md`, with question 7.5, which the sittings file does not have). His words are in quotes; anything else is the designer's or the driver's reading and says so.

**Nothing here is built yet.** Page M3 draws it; he approves the page first.

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfg-1 | **In the GM's Players list, "View sheet" opens that character's Player tab as its player sees it. "Pack" opens the Pack as the player sees it. Magic opens the same way, and so does the players' Scene. The GM can act there as the player can,** but for tfg-5 | "when i click "view sheet" what i want to see is the what the player sees when they load the player tab for that character."; "act"; to 7.1, which ended "The players' Scene is not part of it.": "Add scene as well" | "View sheet" opening the page "Full sheet"; "Pack" opening the GM's own view of the pack |
| tfg-2 | **Magic shows only for a character who has a Magic tab** | "A" (7.2) | Nothing ruled |
| tfg-3 | **In the log an act made there is the GM's, on that character,** as every GM act is today | "A" (7.3) | Nothing |
| tfg-4 | **The GM's Edit sits on the Players list,** with View sheet, Pack, Magic and Scene, as the player's sits on "Your characters" | "Confirm" (7.4, asked with "(and now Scene)") | Edit on the page "View sheet" used to open |
| tfg-5 | **The four actions that are the player's alone stay closed to the GM:** asking for a sheet change, sending a request, taking back the player's own request, choosing the active character. In the player's view their buttons stay and explain in a pop-up that only the player can. docs/03 does not change | "C" (7.5) | Nothing: it narrows tfg-1's "as the player can" by these four |

**On "Add scene as well".** The driver read it as the proposal confirmed with its last line reversed, told him so ("Tell me if I read that wrong"), and he went on to 7.2 without correcting it. The reading is the driver's; the words are his.

## The read behind tfg-5, checked again

The scout's read (`docs/design/notes/test-feedback-2026-11-19-sitting7-gm-read.md`) was checked against the code on `origin/main` on 2026-11-19. Its four hold. **It missed five more of the same kind.**

| Command | What it is | Refuses the GM in the app | Put to him? |
|---|---|---|---|
| `sheet.requestChange` | Ask the GM for a score or Max HP | Yes (`src/modules/characters/sheetChanges.ts`) | Yes |
| `request.send` | A secret activity, buying, selling, "Somewhere else…" | Yes (`src/modules/requests/requests.ts`) | Yes |
| `request.withdraw` | Take back the player's own ask | Yes, for a player's ask | Yes |
| `member.setActiveCharacter` | Choose the active character | Yes (`src/core/campaignCommands.ts`) | Yes |
| `sheet.takeBackChange` | Take back a waiting sheet change | Yes: the one who asked only | **No** |
| `request.reply` | Accept or decline the GM's offer or price | Yes: the one who asked only (`src/modules/requests/townRequests.ts`) | **No** |
| `town.stay` | "Stay here": pick a lodging the GM shows | Yes: the character's player only | **No** |
| `request.undoBuy` | The buyer's own Undo of "Buy it" | Yes: the buyer only | **No** |
| `character.seenFinds` | Put away the "New" mark on finds | Yes: it names the GM and refuses | **No** |

Already open to the GM: hit points, the portrait, spells, the pin and hiding, and the item commands (the scout's read; the pin, using an item and a weapon's mode read again here); activities, Rest and entering a roll for a player (docs/03). docs/03's tables already give the requests to "own characters" and the answers to the GM, so tfg-5 changes no line of it.

## Not settled

1. ⚑ **The five more.** His "C" was to four. By the same answer the five stay closed, and nothing opens them, because nothing was ruled open. One question: "Five more actions are the player's alone today: taking back a sheet change, answering your offer, Stay here, undoing a purchase, and putting away the New mark. Closed to you in the player's view as well, each explaining in a pop-up?" Until he rules they stay as built.
2. ⚑ **The Scene as that player sees it.** The players' Scene is being rebuilt (row P1 of `dec-9-the-players-scene.md`, pull request #1013, not merged). Open: it shows that player's group only (its place, its lights, what was shown to it), where the GM's own Scene shows every group. And most of what a player does there is closed by tfg-5 (the requests), while activities, Rest and entering a roll are open. M3 draws it on P1's structure once that is merged.
3. ⚑ **The GM's own tools on the Pack.** Today "Pack" opens the pack with the GM's extras (Reveal, "Tell them everything", a hidden bonus marked "(hidden from the player)"; 05). "As the player sees it" has none of them. Do they stay reachable from this view, move to "Whose pack", or show beside the player's view? M3 draws choices.
4. ⚑ **What the player may not see.** The GM sees a character's hidden fields and a cursed blade's true figure. In "as its player sees it", does the GM see the player's numbers exactly, or the player's screen with the GM's own marks added? No hidden-data line moves either way (the GM may see all of it): it is what the view is for.
5. ⚑ **A character with no Player tab yet** (waiting for approval, sent back, a draft). "View sheet" opens the full sheet for those today, and the GM reviews from it. Not asked; until he rules they open as today.
6. ⚑ **The page "Full sheet"**: see sitting 6's ⚑ 1. With tfg-1 the GM's door to it goes too.
7. ⚑ **The row's buttons.** View sheet, Pack, Magic, Scene and Edit join "Give to a player…" and "Remove…": up to seven controls on one character's row. tfg-4 leaves "a fourth button or in the row's ⋯" to the page; with Scene added, M3 draws the row at 375 px with a long name, for him to pick.

## For the builder

- tfg-5: never a disabled button (hard rule 7). Each closed action stays tappable and opens the blocked-action pop-up, naming the player ("Only Wren's player can …"). The exact words are drawn on M3.
- tfg-3: nothing to build for the log. A GM's act already carries the GM's name and the character's.
- The "New" mark on finds must not clear because the GM looked. Today the command refuses the GM, so it does not.
- The GM's own characters ("Yours") have rows on the Players list. They open the same way; nothing else is ruled for them.
- Whose view it is, and the way back to the Players list, must show on every tab of the view. M3 draws both.

## Honest notes

- **The scout's read was partial, as it said.** The second read found five more commands. A third could find others: only the commands' own rules in `src/` were read, not `src/testing/permissionCases.ts` and not the database's row-level security.
- **The database is looser than the app in one place:** it does not refuse a GM's `request.send` (the scout's line; not re-read). The app refuses first, so nothing leaks, and tfg-5 keeps it so.
- **tfg-1 with tfg-5 is a narrower view than "act as the player".** On the Scene in town, most of a player's buttons will open the pop-up for the GM.
- **Cost:** the largest piece of this feedback after the pop-ups, and the only one near permissions. Not sized before M3.

Docs to update: 05 (the Player screen's line on View sheet; the full sheet's; the GM's Pack); 06 (GM's view as the player, a new row); 09; the plan's sections C and D; the intent's Links. docs/03: no change. Done in the same pull request as this file. Not touched here: 06's Give to a player row, which says where its button sits on the Players list's row; it follows M3.

09 lines:
- 2026-11-19 — [perm] From the GM's Players list, "View sheet" opens the character's Player tab as its player sees it, "Pack" the Pack, and Magic and the players' Scene the same way (Magic only for a character who has a Magic tab); the GM acts there as the player can, logged as the GM's act on that character; the GM's Edit moves to the Players list (tfg-1 to tfg-4). Page M3 draws it before anything is built — Francis: "when i click "view sheet" what i want to see is the what the player sees when they load the player tab for that character."; "act"; "Add scene as well"
- 2026-11-19 — [perm] Four actions stay the player's alone, closed to the GM in the player's view, their buttons explaining in a pop-up: asking for a sheet change, sending a request, taking back the player's own request, choosing the active character; docs/03 unchanged (tfg-5). Five more of the same kind found on the re-read are ⚑ — Francis: "C"
