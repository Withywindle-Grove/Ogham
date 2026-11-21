---
status: pending
milestone: December first play (character creation "ready for 5 December" first; the CI lanes)
absorbed-into: pending. 06's Toast row comes with the toast's own pull request; 05 and 06 for the twice-picked row and the closed patron's entry with their pull requests; 07's `meta.statBlockLayout` paragraph with the stat block's pull request (pf-13a); `docs/testing.md` (the CI lanes) with the capacity pull request; `.claude/README.md` (rv-1, here); docs/09-decisions-log.md (2026-11-13)
supersedes: nothing. cp-1 adds five fixes to the closed patron's entry of wk-1 (`dec-pack-and-rules-sweeps-2026-11-13.md`); the closed row itself stays as cw-8 approved it (`m5b-gate-creation-words-2026-11-06.md`)
---

# The night of 12 to 13 November and the morning after (2026-11-13)

Three built pieces approved by Francis from pictures of the real screen, two process rulings of his, and the lead's rulings on a fault he reported. Dated 2026-11-13 throughout, as the log's other lines of that night are.

## Approved by Francis from pictures of the built screen
| Id | Ruling | His word |
|---|---|---|
| tw-1 | **A toast's message keeps the toast's full width.** When the message and its action won't fit on one line, the action drops to a line of its own underneath, at the right; a long action label wraps to two lines, right-aligned. The label after a character is created stays "Play as <name>". | "Approve" |
| cp-1 | **A closed patron** (a patron the character's class or alignment can't follow): the row and the fold as built. In the opened entry and the GM's reason, five fixes, built as a follow-up and shown to him again from pictures: (a) the entry drops its small-capitals heading; (b) its ▲ line says the row's words, "Not open to <class>", with the why under it as a plain sentence; (c) the GM's reason ends with a full stop; (d) a blurb with no end punctuation gets a full stop before the followers line; (e) the entry closes by its X only, no Close button (ds-9). | "Approved" |
| tp-1 | **A row taken more than once** (a list with `rolls`, pf-16) shows one tick per take on its Pick button in the picked state: "Picked ✓✓", "Picked ✓✓✓". No cap, never a number, never "×2". Read aloud: "picked twice", "picked 3 times". | "Approve" |
| tp-2 | The entry's pop-up button says what its row says. | with tp-1 |
| tp-3 | The foot line beside Decide later names each entry once, with its ticks ("Heron at dawn ✓✓, Frog in frost picked"). | with tp-1 |
| tp-4 | The review and the sheet keep one line per pick. | with tp-1 |
| tp-5 | A name or note on such a list can't hold a semicolon: "A name or note can't hold a semicolon on this list. Use a comma instead." | with tp-1 |

## Ruled by Francis: process
| Id | Ruling | His word |
|---|---|---|
| rv-1 | The CI review's API cap stays as it is until access returns on 1 December. Until then the local reviewer on each code pull request is the only review. **The reviewer reports first; auto-merge is set only after.** | "A" |
| cq-1 | **Layout jobs run one at a time on CI**; every other job still runs side by side. A waiting layout job queues; nothing running is cancelled. Not chosen: fewer browser workers when both lanes are busy (slower, and reduces the failures without ending them); a third lane or more memory (the PC has no room; a hosted runner costs money). After a week the Builder reports two numbers: runs failed on load alone, and the longest wait a pull request had for its layout job. | "A" |

## Ruled by the lead (his to overturn)
Francis's testing note: changing a character's patron on the review did not change the equipment the patron gives.

| Id | Ruling |
|---|---|
| gs-1 | **A change of patron swaps the free garb at once**, wherever the change is made (the Patron step or the review's Change): the old patron's garb leaves and the new one's arrives. Bought gear and a kit's gear are untouched. (The fault: the garb was swapped only when the Gear step opened, and the review's Change skips Gear.) |
| gs-2 | Garb the player has altered keeps the Gear step's existing rule for altered garb. |
| gs-3 | Spells picked from the old patron's swaps are treated as a change of class treats old picks. Built on its own branch after gs-1. |
| gs-4 | The log's Undo of a patron change never parts a patron from its garb: both go back together. |
| mv-1 | A movement figure the app works out is whole, rounded down, and says "(rounded down)", unless the pack states its rounding: a pack's `ceil()` or `floor()` in a formula wins. A result below zero shows 0. This restates 07 ("Results are whole numbers") and 05; it is no new ruling. The words for a result held at 0 are not ruled: they wait for the sweep. |
| pf-13a | A pack's stat block layout is **`meta.statBlockLayout`**, inside the pack's `meta`. Its `groups` are three levels deep: groups, each a list of lines, each a list of labels. `hp` is reserved for hit points with their average ("2d8 (9)"). A pack that carries the layout at the top level gets the app's one compact group; each pack moves it into `meta` at its next build. |

## Honest notes
- **Mockups first was breached twice that night, by the lead.** The toast's action and the closed patron's entry were ruled in words and built before Francis had seen them. Both were then held unmerged (or their fix held) until he approved pictures of the real screen, which is how a piece already built is approved. tw-1 and cp-1 are those approvals.
- **Two code pull requests merged that night before their local review** (auto-merge had been set first). Look-back reviews were run on both; one found a fault that mattered (a spell rolled under a pick was lost on Decide later), fixed the same night. rv-1's second sentence is the cure.
- **07's paragraph on `meta.statBlockLayout` shows `groups` one level too shallow** (the lead's error in the docs pull request of that night). It is corrected with the stat block's own pull request, which edits 07 anyway; 07 can't be changed on the docs-only path.
- **Six CI runs failed that night on load alone**, about three hours of re-runs; every quiet re-run passed. cq-1 is the answer. The option it uses is new on GitHub and untried on a job that runs in shards: if it does not behave, the Builder keeps to one run at a time by hand and Francis is told.
- Not seen on a real device by anyone yet: the toast, the closed patron's entry and the twice-picked row were approved from pictures taken in the test browser.
