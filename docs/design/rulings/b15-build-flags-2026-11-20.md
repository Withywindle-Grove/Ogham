---
status: pending
milestone: December first play (row B15 of plans/scene-point-to-point.md; the five ⚑ of pull request #1101)
absorbed-into: docs/09-decisions-log.md (2026-11-20); docs/plans/scene-point-to-point.md (row B15's format word; "After 5 December, from B15"). Still to absorb, with #1101's fix push: docs/07-content-packs.md (the two B15 lines exist only on #1101's branch), docs/04 and docs/05 where they say `count` or the source
supersedes: nothing as a file. Inside it: b15f-2, b15f-4 and b15f-5 set aside, for 5 December only, three details of frames approved earlier (HM4's "What you notice" and source line, page 30, pg30-5; PK5b's warning and "At this place" list, ap-6, 2026-11-14)
---

# B15's build flags: format names, the item's words and source, the Send-to sheet (2026-11-20)

A short design sitting (Driver 34's brief). Pull request #1101 built B15 and raised five ⚑. Francis ruled on his phone, one question at a time, each with the designer's pick and what it means for 5 December. He took the pick each time. The frames are page 30's (HM1 to HM5, `page-30-b15-hoard-and-magic-item-2026-11-20.md`) and the Pack page's PK5b; he was shown HM4 again for b15f-3 and b15f-4.

## Rulings

| # | Question | Ruling | His words |
|---|---|---|---|
| b15f-1 | The pack-format names #1101 chose: `hoards: [{ name, text }]` on a location, `count` on a treasure entry, `magicItem: { name, text, source? }` | **`hoards` and `magicItem` stand. `count` becomes `qty`**, the word every other item line in a pack uses (kit lines, table rows' `items[]`); a whole number of 1 or more, anything else reads as 1. (`contents[].count`, how many creatures, is another thing and keeps its name.) | "Yes, `count` → `qty`" |
| b15f-2 | "What you notice" (HM4, frame 1) isn't built; the app draws that line nowhere yet | **The field now, the line later.** A pack may write **`magicItem.noticed`** (text; the same word and the same rule as an item's `noticed`: what the senses tell, never a conclusion, and `pack:check`'s leak check reads it). The app keeps it and draws nothing for 5 December; a held item not yet shown reads by its plain name alone. The line is drawn after 5 December, with unidentified items' own "What you notice". | "Yes, field now, shown later" |
| b15f-3 | The item shows the piece's words whole, so a sentence saying where it lies ("…in the strongbox.") sits on the item too; HM4 draws the item without it | **One set of words, no new field. `magicItem.text` says only what the item is and does**; where it lies is the hoard's words' business. The pack is written that way (Pack task 6); `pack:check` can't judge it, so it is a writing rule in 07. Nothing changes in the build. | "Yes, one text about the item" |
| b15f-4 | The item's source line (HM4's foot) isn't drawn; the review found the source kept in the piece's GM-only value, which a player could reach through a forged pointer | **No source line for 5 December. A player's device receives the item's real name and its words, and nothing else**: never the source, never anything read from a piece's GM-only value (`gm_value`). The source stays the GM's. The line may come back after 5 December, with a place of its own to keep it and a way to name the pack. | "Yes, no source line for the 5th" |
| b15f-5 | PK5b's warning "This puts Moss over the limit" and its "At this place" list aren't built; Send to lists every approved character | **Both after 5 December.** #1101 ships with Send to as built. The send has Undo, and a character's load shows on their own sheet. | "Follow-up after the 5th" |

## For #1101's fix builder

1. **b15f-1:** rename a treasure entry's `count` to `qty` everywhere B15 reads or writes it: the reader, `pack:check`'s note, the tests and fixtures, and #1101's own lines in 07 (and 04 / 05 where they name it). No alias for `count`: no pack has been written with it.
2. **b15f-2:** read `magicItem.noticed` (optional text) and keep it with the thing as found; `pack:check` notes one that isn't text and runs the leak check on it; add it to 07's `magicItem` line. Draw nothing. It is the players' to read, so it never goes in a GM-only slot, and it must never be mixed with the truth.
3. **b15f-3:** no code. 07's `magicItem` line gains the writing rule (the words say what the item is and does, not where it lies), and its invented example already fits.
4. **b15f-4:** `item_truths` returns the real name and the words only. It returns no source and never reads `gm_value` for a player; the pack's `magicItem.source` stays GM-side (or isn't stored on the piece at all). This goes with the review's blocking finding 1 (honour only a pointer the GM's show wrote; only pieces made from a `magicItem`) and finding 2 (a database test, as a player, that a pointer forged at a shown treasure or clue piece reads neither its value nor its source). 07's line drops "and where the book says it" from what the item shows.
5. **b15f-5:** nothing to build. The pull request's text keeps both as departures, now ruled.

## After 5 December, from B15

- Draw "What you notice" on a held item not yet shown (`magicItem.noticed`), with unidentified items' own line (HM4, frame 1).
- The item's source line (HM4's foot): a safe place for the source, and the pack's name on the item's sheet.
- PK5b's over-limit warning and its "At this place" list on Send to.

## Not checked

- The built screens were not run for this sitting; the questions were put from #1101's text, the two reviews on it and the approved frames.

## Docs to update
- `docs/09-decisions-log.md`, 2026-11-20 (done here).
- `docs/plans/scene-point-to-point.md`: row B15's `count` → `qty`, and "After 5 December, from B15" (done here).
- `docs/07-content-packs.md`: the B15 lines are on #1101's branch only; its fix push changes them as listed above. Not edited here, to keep the two from colliding.

## 09 line
- 2026-11-20 — [packs] [expedition] B15's five build flags (#1101): a treasure entry's how-many is `qty`, not `count`; `hoards` and `magicItem` stand; a pack may write `magicItem.noticed`, drawn after 5 December; `magicItem.text` says only what the item is and does; a player's device gets a shown item's real name and words only, never its source or a piece's GM-only value, and the source line waits; PK5b's over-limit warning and "At this place" list come after 5 December (b15f-1 to b15f-5) — Francis took the designer's pick each time: "Yes, `count` → `qty`"; "Yes, field now, shown later"; "Yes, one text about the item"; "Yes, no source line for the 5th"; "Follow-up after the 5th" — `design/rulings/b15-build-flags-2026-11-20.md`
