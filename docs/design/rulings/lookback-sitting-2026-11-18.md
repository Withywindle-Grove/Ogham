---
status: absorbed
milestone: December first play (the look-back reviews of merged database pull requests; the Player screen's plan flag 3)
absorbed-into: 03 (the seen mark's row), 04 (Finds seen), 07 (an id never carries a spoiler), `docs/plans/dec-3-the-whole-town.md` (the LATER line), `docs/plans/dec-13-the-player-screen.md` (flag 3), docs/09-decisions-log.md (2026-11-17), docs/10-open-questions.md (one new ⚑), the root `CLAUDE.md` (hard rule 4: bu-1 and ls-5); confirmed in the rulings catch-up 8 (2026-11-18): ls-1 to ls-5 each found in their homes and in 09
supersedes: nothing as a file. Inside it: ls-5 adds a seventh exception to hard rule 4; ls-3 states who "that player" is in pk-13 (`dec-afternoon-2026-11-14.md`); ls-1 settles the "Not settled" line on the hit points box in `dec-player-screen-2026-11-14.md`
---

# The look-back sitting (ruled 2026-11-17; the look-back comments are dated 18 November)

A short design sitting with Francis, in chat, one question at a time. Four questions came from the look-back reviews of #791, #821, #823 and #881; the fifth is flag 3 of the Player screen's plan. The designer checked each question's sources on `origin/main` before asking. His words are in quotes.

Every ruling is the "no build" option: no code and no migration follow from this file.

| Id | Ruling | Francis |
|---|---|---|
| ls-1 | **The Player screen on a tablet (frame P1): the hit points box and the first row of score boxes start level; their bottoms fall where they fall.** The rule the builder holds is "tops level". The 38 px between their feet is what falls out at the drawn sizes, not a number to hold: it moves with a bonus hit points line, Larger text, or a setting whose scores carry no modifier line | "A with your refinement" |
| ls-2 | **At a pack's shop, a GM's "in" on a thing the campaign does not sell stays as it is** (players never see it and the GM is told nothing) **until the shop's own list is built.** The case joins that later row of the town's plan, with the question to rule then: does a shop's own list decide what it sells, whatever the campaign-wide "for sale" says? | "A" |
| ls-3 | **The seen mark ("Got it") belongs to the character and travels with it.** Its current player and the GM read it; a previous player stops reading it when the character changes hands. Nothing is wiped on a give. This is the read rule in force, written down | "A" |
| ls-4 | **What a hearer's device receives with a rumour is fine as it is:** the rumours table's pack id and the row's die range are labels for the machine, not secrets. The guard is in the pack format: an entry's id must never carry a spoiler | "A" |
| ls-5 | **A seventh exception to "nothing erased":** a picture slot whose upload failed in the same action is removed. It never held a file and was tied to no character, place or campaign; the log keeps a copy. One ruling for the four places that do it (a place's map, a place's picture, a portrait, the campaign's sigil) | "A and a picture slot whose upload failed, which never held a file and was tied to nothing, is removed (the log keeps a copy)." |

## Hard rule 4's sentence (ls-5)

Francis gave his own yes to this sentence, in chat with the designer:

> and a picture slot whose upload failed, which never held a file and was tied to nothing, is removed (the log keeps a copy).

The sixth exception (bu-1, 2026-11-14, Undo of "Buy it") was not in the root `CLAUDE.md` either; the rule there still said "Five documented exceptions". Asked at the end of the sitting whether both sentences should go in with this pull request, Francis said "Yes add it". Hard rule 4 now names seven.

## What each was checked against

| Id | Checked on `origin/main` | Not checked |
|---|---|---|
| ls-1 | The approved light picture of P1 (`docs/design/mockups/december/png/14-P1-tablet-at-rest-light.png` on `design-december-mockups`); the plan's flag 3 | The dark picture, Larger text, the built screen |
| ls-2 | `supabase/migrations/20261115150000_dec_3_stock_reader_narrow.sql:47-50` (the reader lists only things for sale) | Whether the GM's stock table at a pack shop can list a not-for-sale thing at all: that screen is on the held town stack |
| ls-3 | `supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql:37-46` (the read follows the character's current owner, and the GM) | The New tag itself: it is on no screen yet |
| ls-4 | `supabase/migrations/20261115001000_dec_12e_rumour_name.sql:59`; `src/modules/library/rumours.ts:75` (the key is the table's id, "#", the range) | Whether any rumour given before the rename still carries the table's name (the look-back's second note): one read-only count on the main database, for the driver |
| ls-5 | `src/modules/expedition/placeMap.ts:37`, `placePicture.ts:35`, `src/modules/characters/portraits.ts:45`, `src/core/campaignCommands.ts:90`; the log's trigger on `assets` (`20261020140000_m2_events.sql:155`) | Nothing run; read only |

## Not settled

- ⚑ **A real picture removed on replace or take-off.** The same code also removes a picture that was really there, its slot and its file, when a portrait or the campaign's sigil is replaced or taken off (`src/core/files.ts:15`, used by `portraits.ts` and `campaignCommands.ts`; since M1). It is not on hard rule 4's list and is not covered by ls-5: a real file goes and Undo cannot bring it back. A place's picture and map never delete. The designer's finding, not the look-back's; not judged, and not asked at this sitting (`10`).
- A pack-checker warning for an id that reads like a spoiler (ls-4): offered for after 5 December; Francis has not asked for it.

## Honest notes

- The file's name carries 18 November, as Francis named it and as the look-back comments are dated; the sitting itself was on 17 November, and the `09` lines carry that date.
- ls-3 stretches pk-13's "that player" to "whoever plays the character now". That is why it was put to Francis and not ruled by the designer.
- The look-back's one Important finding (#856, the read rule on a shop's stock) was not part of this sitting; it has its own fix brief with the driver.

Docs to update: 03 (the mark's row), 04 (Finds seen), 07 (ids), the town's plan (the LATER line), the Player screen's plan (flag 3), 09, 10. and the root `CLAUDE.md`, hard rule 4 (bu-1 and ls-5). Done in the same pull request as this file.
