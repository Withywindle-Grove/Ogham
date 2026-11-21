Follow docs/plans/briefs/README.md (its fences and how to work) together with this brief; where this brief is more specific, it wins. THIS brief allows a SCREEN change, for ONE row of the Player screen, and only that row.

# Cloud brief: one row of the Player screen (dec-13), in its own section file

You are a cloud builder (a Virtual Builder). You cannot message anyone: your ONLY output is a pushed branch and a PR. If a guard, a hook or a permission check blocks you, stop and write what blocked you in the PR body. Do not reach the same end another way. Never git stash, never force-push, never --no-verify. No line in docs/09 (dl-1).

## Which row
The one-line message that sent you here names ONE row: C3, C4, C10, C12 or C13. Build that row only.

| Row | What (the plan's words, docs/plans/dec-13-the-player-screen.md on the stack) | Its file (since C1's split) |
|---|---|---|
| C3 | The level block and the aligned top: the class beside the level, the experience with its bar, the company on the left directly above Details; the first row of score boxes starts level with the top of the hit points box; every score box one size. (ps-8, ps-10) | src/app/player/PlayerLevel.tsx (+ the alignment in PlayerScreen.css only) |
| C4 | Details: motto, looks and manner, background and the rest, in the pack's and the player's own words, opening in place, last in the left column. (ps-3) | src/app/player/PlayerDetails.tsx |
| C10 | Movement and load: third on the right, the speed once, and the load's bar. (ps-2, mv-2) | src/app/player/PlayerSheetParts.tsx, the movement part only |
| C12 | The rest of the sheet's summary rows under "Full character sheet" on a tablet, as frame P1 draws them (the lead's ruling of 2026-11-15; the plan's C1 Departures). | a new src/app/player/PlayerSheetRest.tsx |
| C13 | Chevrons on every opening row: changed ONCE in the shared skills block (C13 ruling), so every screen that hosts it gets them. | the shared skills block where it lives (find it; never copy it) |

## The branch
`dec13-<row in lower case>-<two words>` (e.g. `dec13-c4-details`), cut from FRESH origin/dec-13-player-stack. PR against `dec-13-player-stack` (NOT main). Title: "<Row>: <the plan's bold words>". No label, no auto-merge.

## Read first
1. The plan, on the stack: docs/plans/dec-13-the-player-screen.md, your row, "How it is built", and C1's and C7's Departures.
2. docs/design/notes/player-screen-ruled-so-far-2026-11-14.md, read whole. Where it and the plan differ, the plan wins (C1's Departures say why). If they differ on YOUR row in a way the plan doesn't settle, stop that part and write the question in the status file.
3. The frames: branch `design-december-mockups`, docs/design/mockups/december/14-player-screen-for-the-player.html, P1 (tablet) and P2 (phone), approved ps-9 on 2026-11-14. Build what the frame draws for your row: no more, no less.
4. docs/06-screens-and-design.md, Components: reuse the listed parts; a variant is NAMED there, never copied.

## Rules for every row
- Touch ONLY your row's file, plus: its tests, 06's inventory line for any part you change, the plan's Departures under your row, your status file, and the layout harness IF your row needs a state to be seen. Edit no other row's section file. If your row cannot be built without changing another row's file, stop and write why.
- The book's type is already set at the screen (C1). Use tokens only (hard rule 7): no raw px, colours or weights.
- Text in ink; colour for decoration only. No new words outside the frame, or list them. Every button has an icon, or list it. Accents: this screen has none unless the frame draws one.
- A pop-up opened from inside a sheet uses `SheetScope.Provider value={false}`.
- Never a disabled button; targets 44 px with 8 px between.
- Invented names only (hard rule 2).

## Tests (write each purpose as a plain sentence first)
- Unit tests for what the row shows and hides: present, absent, a long value, 0 and 999 where a number shows.
- A layout spec case for the row at 1180 and 375, in its own spec file (tests/layout/player-<row>.spec.ts), on the SHARED P1-like character: `layout.html?as=player&p1=1` (src/testing/layoutP1Character.ts, Brannoch Fenward). Use it; don't make another. If your stack does not have it yet, write the spec against it anyway and say so. A local run will run it.
- If your environment can run the layout browsers, run your spec on ONE worker and on a port you have proven free (`curl -s localhost:<port>/layout.html` must fail), and give the port and the served commit. If it cannot, SAY SO plainly. The pictures are taken locally after you.

## Pre-flight checklist (tick each in the status file)
(a) Departures written in the plan, under your row; (b) named parts reused (grep 06's inventory), nothing copied; (c) a pop-up inside a sheet uses SheetScope.Provider value={false}, or n/a; (d) text in ink; (e) no new words outside the frame, or listed; (f) every button has an icon, or listed; (g) accent count: expect 0; (h) the layout port proven free and the served commit printed, or "not run here".

## Output
The code, the tests, the status file `docs/status/2026-11-15-dec13-<row>.md` (what's built, tests, not done, ⚑, departures), commit through the hook, ONE push, ONE PR to dec-13-player-stack.

## Added by the lead (binding; where it differs from the table above, this wins)
- **Read the plan on `origin/main`, not on the stack.** The stack was cut before the plan grew: `docs/plans/dec-13-the-player-screen.md` on main has rows C12 to C14 and the paragraphs "Folded into existing rows" and "More read off frame P1". Your row's work includes what those paragraphs add to it.
- **"As designed" is judged against the frames (fd-1).** Before you call the row done, list in your status file anything P1 or P2 draws in your row's area that neither the plan nor this brief says. Do not build an unlisted thing on a guess; list it.
- **C3 also** (from frame P1): a score with no modifier shows none (no "+0"); tile labels are whole words in plain case, muted ("Armour class" with its make-up under it; the attack bonus with "Melee +2, missile +0"). The score, save, armour class and attack tiles are SHARED sheet parts, not in `PlayerLevel.tsx`: change the shared part once and name the plain-case label as a variant in 06 if the book-type scope's small capitals is creation's own form; if that would change another screen, stop and write the question. If the tiles cannot be done inside this row's files, build the level block only and say so: the tiles then become their own row.
- **C4 also:** "Reads and writes." sits under Languages (the languages part), and Literacy leaves Details; a character who cannot read says so in the same place. Details is drawn as P1 draws it: the lines in the book's entry form (a coloured label, then the words), opening in place.
- **C10:** the speed carries its unit as P1 draws ("120 paces", "Speed, 40 paces in a fight"), once; the load beside it with its bar and its line.
- **C12 also:** the phone's "Full character sheet" row with its sub-line (P2). Each summary row opens what today's sheet shows for it; nothing of today's sheet is lost.
- **C13:** skills as rows with a chevron AND the die's glyph beside the odds (P1: "2 in 6" with the die), and a chevron on every row on this screen that opens something (the Traits rows that open, C12's rows): ch-1. One shared block, so the full sheet's own page shows it too: say so, and add its layout case.
- **Never two rows in one file at once.** If the file named for your row is being changed by another open pull request against the stack, stop and say so.
- **A cloud seat never reviews its own row** (rv-4): another seat gives your pull request its first review.
