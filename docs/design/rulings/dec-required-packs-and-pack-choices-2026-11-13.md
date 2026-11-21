---
status: absorbed
milestone: December first play (the campaign's set-up; the December packs)
absorbed-into: 05 ("A pack that needs another not attached") and 06 (the GM's Rules screen; the Setting rules step; the Warning sign row) with rq-1's pull request (#721); docs/09-decisions-log.md (2026-11-13, #715). Still owed: 08's after-December line for pr-1 (the Priority sheet), not part of rq-1
supersedes: nothing
---

# A campaign missing a pack another needs; Francis's pack choices of the afternoon (2026-11-13)

## What happened
After importing the December packs, Francis made a character of a fae-woodland kindred in his campaign and found no name table, and expected the detail and trinket tables to be missing too. The packs were right and the app's lookup was right (the Pack Creator ran the app's own lookup on the shipped packs; the Builder traced the code). The cause, found by Francis looking: **his campaign held the conversion pack without the fae-woodland pack it needs.** The conversion restates that pack's kindreds and classes and points back at its tables and kits; without it they point at nothing, and the app showed nothing and said nothing. A pack's `requires` was only a "Needs: …" line in the library and the attach step; the campaign's own Rules page had no such line at all.

## rq-1: a campaign that lacks a pack another needs says so, and offers the cure (the lead's, from "never a silent block")
| | |
|---|---|
| Where | On the campaign's Rules page (Setting rules), on the row of each attached pack whose `requires` names a pack that is not attached to this campaign. And in the attach step, whose line names **which** required packs are missing, not the whole list. |
| The words | A ▲ line on the row: "<Pack> needs <Other>, which isn't attached to this campaign." With two: "…needs <A> and <B>, which aren't attached…". The existing words of New campaign (`missingWords`) are the model; one voice for the same fact. |
| The cure | When the needed pack is in the GM's library: one plain button on that line, "Attach <Other>", which attaches it through the same command the attach step uses, logged, with Undo. When it is not in the library: the line ends "Import it into your library first.", and no button. |
| Who sees it | The GM only (players do not manage a campaign's packs). |
| What it does not do | It does not refuse the campaign, hide the pack, or block creation: the campaign works as before; the line stays until the pack is attached or the needing pack is removed. |

A picture of the built line goes to Francis before it merges (a visible change on a screen he knows).

## Francis's choices on the packs
| Id | Ruling | His words |
|---|---|---|
| pk-7 | **The fae-woodland classes stay as their book presents them.** Its cleric and friar follow no patron from another pack; its thief is not added to the classic rules' list of thief types that cannot lower Strength. | "no, use the class as presented in the book" (twice) |
| pk-8 | Every fae-woodland class a character can pick offers its own book's starting kit in creation. (They do: the kits exist and show while that pack's "buy starting equipment" option is off; the zine's quick kits are for the classic classes; a class gets only its own kits.) | He asked that they be converted; they were already |
| pk-9 | The December campaign counts its dates in the fae-woodland pack's calendar, the only one in its stack. | "yes let's use fae-woodland's [name swapped] calendar" |
| pk-10 | Built by the Pack Creator on the lead's word, from its sweep of the three packs' options for what leaves the fae-woodland classes out: the fae-woodland fighter's own combat talents as a pick (a level-2 fighter picks one); weapon proficiency categories for the fae-woodland classes; the conversion's sheet layout cut down to the fae-woodland additions, each marked for its own kindreds or classes, so switching it on adds nothing to a classic-side character. | The sweep was his request ("do a quick sweep of other optional rules … that we'd need") |

## pr-1: after 5 December, a "Priority" sheet (Francis)
His words: "let's do a simple pop-up sheet for 'priority' or something like that in rules and let the gm reorder there. the whole rows are clumsy to drag and the functionality is hidden. this is for after dec 5".

The order of a campaign's packs decides which setting is the primary one (the top setting's rules set runs the game; where two packs offer the same thing, the higher one is what the app reads). Nothing on screen says so today. After the 5th: a pop-up sheet on the Rules page where the GM sets the order; with it, a plain line naming the primary setting, and an option two packs share shown once. Mockup first.

## Honest notes
- The lead first told Francis the missing tables were "no fault". They were a fault of set-up the app allowed in silence; rq-1 is the cure.
- The lead answered a question about the wrong pack once (the conversion, when he meant his own homebrew tables pack). His idea, that his homebrew pack pull in the fae-woodland tables, turned out to gain nothing once the missing pack was attached: the fae-woodland kindreds get their own tables. The one kindred with no tables anywhere is another pack's; a small addition to his homebrew tables is proposed for his approval.
- Not confirmed: for an option two packs share, which pack's switch governs. A test is being written.
