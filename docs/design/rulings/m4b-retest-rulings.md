---
status: absorbed
milestone: m4b
absorbed-into: docs/05-features.md (Rules for this campaign; character creation; toasts), docs/04-data-model.md
supersedes: —
---

# M4b re-test rulings: RULED (2026-10-26)

From Claude Code's morning report (all gate rulings built except B22, deferred to M7). Approved as recommended.

1. **GM ⋯ menu:** anything that's already a GM tab comes out of the menu; the Players tab carries the "N waiting" badge; the GM's ⋯ keeps what's left in the ruled order (Company, Handouts if not a tab, Arrange this screen, This device).
2. **Companies ⓘ (until M8):** "A company is the party's shared charter: how treasure is split and how votes go. You can play without one; the GM turns companies on in Rules for this campaign." The titles sentence returns in M8.
3. **Rules for this campaign** has one part: the screen uses the gallery organism.
4. **Optional rules** are chosen only in Rules for this campaign (an "Optional rules" group, X-4 layout). Setting rules shows them read-only with "Change in Rules for this campaign"; the separate editor goes.
5. **Partial give, option a:** Undo merges the split back, a new named exception to hard rule 4. It works only while the given part is untouched; otherwise Undo is refused with the reason.
6. **Send to the GM after the gear, option a:** a "not sent yet" draft state the GM doesn't see (add-only database change). The first submission then follows the ruled order: … Gear → Review → Send.
7. **Gear on a sent-back character, option a:** tapping Gear or Starting money reopens the shopping with what was bought.

## Checklist corrections
- The A6 line "gear stands out" contradicts gallery review 2 (Gear tint removed). The build matches the gallery; fix the checklist line and 05 if it says the same.
- The B24 line "Party stash first and chosen": Give's default follows B19 (last place used for that kind, else the first with room). Confirm the build.

## Dependabot
Claude Code closes #2 and #4 if #33 supersedes them; it fixes #33 or closes it.

## 09 lines
- 2026-10-26 — GM ⋯ holds only what isn't a tab; the Players tab carries "N waiting" — the GM navigates by tabs
- 2026-10-26 — Companies ⓘ drops the titles sentence until M8 — help text must match what's built
- 2026-10-26 — Rules for this campaign is one part; optional rules are chosen only there, and Setting rules shows them read-only — build once, change once
- 2026-10-26 — Undo of a partial give merges the split back while the given part is untouched (named exception to hard rule 4) — Undo must work the same everywhere
- 2026-10-26 — Characters have a "not sent yet" draft state; Send to the GM comes after the gear — the review is the last step, and gear isn't lost if the app closes
- 2026-10-26 — Sent-back characters reopen the shopping from Gear or Starting money — every review section opens its step (B18)

## Follow-up rulings (2026-10-26, after #118–#120)
8. **Refunds before approval:** while a character is unapproved (draft or sent back), removing a bought item refunds its full price; after approval, gear changes go through the Pack with no refunds.
9. **Draft rolls stay visible to the GM**, labelled "draft · {Name}"; the draft hides the unfinished character, not the dice.
10. **The suspected Undo bug** (a whole item given to another player's character) gets an automated test before merge; fix it if it fails.
- 2026-10-26 — Unapproved characters get a full refund when removing bought gear; none after approval — undoing a purchase, not selling in play
- 2026-10-26 — Draft rolls stay visible to the GM, labelled "draft · {Name}" — the dice stay honest; only the unfinished character is hidden
