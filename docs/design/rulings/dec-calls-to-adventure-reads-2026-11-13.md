---
status: absorbed
milestone: December first play (`docs/plans/dec-12-calls-to-adventure-and-notes.md`, piece B; `dec-1-creation.md`, piece 1d)
absorbed-into: docs/03-roles-permissions.md (call-to-adventure send row, ca-1 to ca-3), docs/05-features.md (Calls to adventure), docs/06-screens-and-design.md (the "From <pack>" line, sn-1); docs/09-decisions-log.md (2026-11-13)
supersedes: nothing
---

# Who reads a call to adventure once it is sent; an approval that was only in notes (2026-11-13)

## Calls to adventure: what players may read (Francis: "yes to both picks and the change")
Piece B adds a record of each call to adventure the GM sends. A change to who may read what needs Francis's yes with the change said in plain words; these are the words he was given, checked by the Builder against the SQL first.

| Id | Ruling |
|---|---|
| ca-1 | **The GM reads every send. A player reads a send only if it went to the party, or to a character they were playing when it was sent**, and only while it stands: if the GM undoes a send it is gone for players, and the GM still sees it. Nobody else reads any. **What a player reads is the words as sent** (the book's words or the GM's edit, with what it pays), a copy taken at sending. **The book's own entry is never readable by players.** Nothing is dropped, renamed or deleted. |
| ca-2 | A send to one character is read by that character's player and the GM alone, not the rest of the party. |
| ca-3 | "The party" means every player in the campaign, even when the party is split. |

The database enforces ca-1 to ca-3, not the screen. The screens are not yet approved: they go to Francis as pictures of the built screen. "Write your own" (a hook the GM writes from nothing) is left for later (the lead's).

## sn-1a: the same-named entries piece was approved on 2026-11-12
| Id | Ruling |
|---|---|
| sn-1a | **Same-named entries showing their pack (sn-1; plan `dec-1-creation.md`, piece 1d) was approved by Francis on 2026-11-12 from pictures of the built screen, with one change he asked for**: the "From <pack>" line moved to the row's last line. The change was made the same day; the lead opened the revised picture (phone, light, `same-name-source`) on 2026-11-13 and it is as asked. |

Why this line exists: the approval lived only in the lead's working notes. The local review of the piece asked, rightly, where it was written down, and held the merge until it was.

## Honest notes
- An approval "with a change" is recorded the same way every time from now: Francis approves with the change named; the lead checks the change was made on the redrawn or rebuilt picture and says which picture it opened; Francis does not look twice unless he asks to.
- On the PC that day: the lead loosened the rule on local checks for half an hour (a check beside the light database tests) and a builder ran a full test run outside the queue; free memory fell to about 3 GB and the lead's watch was stopped by the system for the second time. The loosening was withdrawn; every full run goes through the one queue; Francis closed two large programs to give room back.
