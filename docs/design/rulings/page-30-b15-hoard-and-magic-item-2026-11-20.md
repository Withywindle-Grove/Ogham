---
status: absorbed
milestone: December first play (row B15 of plans/scene-point-to-point.md: a hoard as one piece, a magic item's truth as a piece)
absorbed-into: docs/plans/scene-point-to-point.md (the B15 rows); docs/09-decisions-log.md (2026-11-20); with B15's build: docs/05-features.md (A hoard as one piece; A magic item's truth as a piece), docs/06-screens-and-design.md (the Hoard sheet row of the components inventory), docs/07-content-packs.md (`hoards`, a treasure entry's `count`, `magicItem`)
supersedes: nothing as a file. Inside it: pg30-1 to pg30-3 replace three details of the Pack page's frame PK5 (approved 2026-11-14) on the GM's Location card
---

# Page 30: a hoard as one piece, a magic item's truth as a piece (2026-11-20)

A short design sitting (Driver 32's brief), closing "Owed: B15's frames (page 30)" of `dec5-flags-sitting-2026-11-20.md`. Francis ruled on his phone, one question at a time. The page draws p2p-28 and p2p-29 (`scene-point-to-point-2026-11-18.md`); d5-9 put B15 in the 5 December cut.

## The page

Mockup page 30, frames HM1, HM2, HM3, HM3b, HM4 and HM5, light and dark: `docs/design/mockups/december/png/30-*.png` (rows in `docs/design/mockups/index.md`). The page's source, `december/30-b15-hoard-and-magic-item.html`, is on the branch `design-page-30-b15-studio` with the other December pages' sources (commit 2e8445c8). It links the one shared mockup stylesheet and restates none of its rules; measured with `shared/measure.cjs`: clean but for the lit-light badge's amber mark and the stand-in map's small words (both known from page 23) and the toast, which floats over the marching order in HM3.

| Frame | What it shows |
|---|---|
| HM1 | The GM's Location card: the hoard as one piece in the book's words, the magic item's piece, both hidden |
| HM2 | A tap on the hoard's piece: its things, one row each with its count; "Send all" |
| HM3, HM3b | The magic item's eye tapped: the toast with Undo; the piece on the players' card |
| HM4 | The item as its holder sees it, before and after the show; a long name |
| HM5 | The GM's card at 375 px with messy data; the hoard's sheet before and after everything was sent |

## Rulings

| # | Question | Ruling | His words |
|---|---|---|---|
| pg30-1 | A tap on a piece's words edits it (page 23, LA1) but opens the hoard (Pack page, PK5) | **A tap on a hoard's words opens the hoard**; a small arrow before its eye says so. Every other piece still edits on a tap. A hoard's words are edited from a row inside its sheet, "Edit the piece's words". | "Yes, opens it" |
| pg30-2 | PK5's quiet line "Value stays yours (…)" against p2p-17 (no explaining lines) | **Left out.** | "Yes to both" |
| pg30-3 | PK5's kind word "Treasure." against LA1 (no kind words) | **Left out.** The piece leads with the hoard's own name. | "Yes to both" |
| pg30-4 | What Undo of the show, and a later hide, do to an item already revealed (hidden data) | **Undo of the show takes both back:** the piece leaves the players' card and the item returns to its plain name. **Hiding the piece later** takes the piece off the players' card only; the item stays as the players now know it (05: a fact revealed once stays revealed). | "a" |
| pg30-5 | Page 30, HM1 to HM5, with the designer's picks | **Approved as drawn.** The picks: the magic item's piece leads with its real name; "What you notice" goes once the item is shown; on a tablet the hoard opens in the standing panel at the right, on a phone as a sheet from the foot; the toast reads "Shown to the players: <name>. <holder>'s <thing> now carries its name."; once everything is sent, "Send all" is gone and each row says where it went. | "approve" |

## For the plan

- B15 now has its approved mockup and may be handed to a builder once this file is on `main`.
- It needs a **database session** (the item's reveal and its undo, likely) and it **touches hidden data**: a database test run as a player (nothing of the magic item's piece, and not the item's real name, reaches a player before the eye; after Undo neither is readable).
- The show can use the reveal the app already has (`inventory.reveal`; checked 2026-11-20 in `dec5-flags-sitting-2026-11-20.md`).
- Not drawn, built from the frames named: PK5's "Send" and "Which character" (unchanged); a hoard half sent (it keeps "Send all" for what is left; the card's line reads "N of M sent"); the item in the party stash (it changes the same way).
- Not drawn and not ruled, for the builder to bring back if met: a hoard the pack gives no things for; a magic item's piece with no item tied to it.

## Docs to update
- `docs/plans/scene-point-to-point.md`: the B15 rows (done here).
- `docs/09-decisions-log.md`, 2026-11-20 (done here).
- With B15's build: `docs/05-features.md`, `docs/06-screens-and-design.md` (the components inventory's Code column too), `docs/07-content-packs.md`.

## 09 line
- 2026-11-20 — [expedition] B15's page approved (page 30, HM1 to HM5): a tap on a hoard's words opens the hoard, its words edited from inside it; no "Value stays yours" line and no kind word on a hoard's piece; Undo of showing a magic item's piece takes back both the piece and the item's real name, and a later hide leaves the item as the players know it (pg30-1 to pg30-5) — Francis: "Yes, opens it"; "Yes to both"; "a"; "approve" — `design/rulings/page-30-b15-hoard-and-magic-item-2026-11-20.md`
