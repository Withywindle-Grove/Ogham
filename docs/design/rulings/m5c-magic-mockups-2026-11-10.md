---
status: pending
milestone: m5c (magic in play); mm-3 moves a piece to M6
absorbed-into: docs/05-features.md (Spells: the Magic tab, Prepare, Spell lost), docs/06-screens-and-design.md (Tab bar; the toast's time when mm-6 is built), docs/plans/after-m5b-gate.md, docs/09-decisions-log.md (2026-11-10), docs/plans/magic-in-play.md, docs/plans/m5c-2-magic-tab.md, docs/plans/m5c-3-cast.md, docs/plans/m5c-4-prepare-and-rest.md, docs/plans/m6-fights.md
supersedes: mp-9 where it says "in a fight or not" (`m5c-magic-in-play-2026-11-05.md`); 05 Spells where it gave a spell prepared twice two rows
---

# Magic in play: Francis's rulings on the redrawn mockups (2026-11-10)

Francis looked at the three redrawn mockups (`design/mockups/magic/04-magic-tab`, `05-cast`, `06-prepare-and-rest`) on his phone and **approved all three**, with the changes below. Ids `mm-1` … `mm-5`.

## The Magic tab (mockup 04)

- **mm-1 One row per spell, a dot per casting.** A spell prepared more than once is one row with a dot for each casting. Casting hollows a dot; the row keeps its Cast button while a dot is left. When no casting remains, the spell is crossed out. A spell prepared once has no dots. (Was: one row per prepared slot.)
- **mm-2 Five tabs on a phone.** A caster's bar is Player, Scene, Pack, Magic, Log. Five is acceptable and is the limit: before anything adds a sixth, the bar needs a new answer. The Magic tab's symbol, a crescent moon with a spark, is approved with the screen.

## Casting (mockup 05)

- **mm-3 "Spell lost" shows only when all three hold:** a fight is under way; the caster has not yet acted in this round's initiative order (usually, the foes acted first); and the setting's rules say a spell can be lost. Outside a fight it never shows. The words: "<Name> was hurt. Any spell she was casting is lost". It stays a reminder with nothing to tap (mp-9's other points stand). **It needs the fight's turn order, so it is built with fights (M6), not in M5c.**

## Prepare and the morning (mockup 06)

- **mm-4** The button on **Same as yesterday** reads **Pick**, not Use.
- **mm-5** The morning prompt's line reads: "Choose before the party moves on, or yesterday's spells will be selected by default", followed by yesterday's spells by name.

  Confirmed the same day: the first word is "Choose" (it was typed as "saves"), and the line says "selected", never "memorized", so it fits a prayer caster as well as one with a book.

## Toasts

- **mm-6 A toast lasts 6 seconds, to start with** (was 8, ruled 2026-10-25). App-wide: every toast, and so every Undo window that is the toast's own (an entered roll, a sent message). Undo from the log is unchanged. "To start with": Francis may adjust it after trying it. **Built after the M5b gate** (`plans/after-m5b-gate.md`); the specs that say 8 seconds (03, 04, 05, 06 and gate check 36 in `docs/testing.md`) change in the pull request that builds it, so they stay true to the app until then.

With these the three mockups are approved as drawn.

09: 2026-11-10 — [sheet] The Magic tab shows one row per spell with a dot for each casting, hollowed as they are cast and crossed out when none remain; no dots for a spell prepared once (mm-1; was one row per prepared slot) — Francis, on the redrawn mockup: fewer rows to read — `design/rulings/m5c-magic-mockups-2026-11-10.md`
09: 2026-11-10 — [ui] A caster's phone bar has five tabs (Player, Scene, Pack, Magic, Log), the Magic symbol a crescent moon with a spark; five is the limit, and a sixth tab needs a new answer first (mm-2) — Francis: five is acceptable — same file
09: 2026-11-10 — [fight] The "spell lost" reminder shows only in a fight, when the caster has not yet acted in the round's initiative order, and only where the rules allow spell loss; it is built with fights (M6), not M5c (mm-3; narrows mp-9's "in a fight or not") — Francis: a spell is lost only when a caster is hit before acting — same file
09: 2026-11-10 — [words] Prepare's Same as yesterday button reads Pick; the morning prompt says yesterday's spells "will be selected by default" if the caster doesn't choose before the party moves on (mm-4, mm-5) — Francis's wording — same file
09: 2026-11-10 — [ui] A toast lasts 6 seconds, to start with, app-wide (was 8); the toast's own Undo windows shorten with it and Undo from the log is unchanged; built after the M5b gate, the specs change with the build (mm-6) — Francis: 8 seconds was slightly too long — same file
