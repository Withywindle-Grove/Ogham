---
status: pending
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, rows C12, C13, C13a and C14; mockup pages M1 and M2)
absorbed-into: 05 (Skills; the Player screen's line on what a skill's tap opens); 06 (the Breakdown sheet's skill; the Skills block; the List row's value mark); docs/09-decisions-log.md (2026-11-19); **pending: 07** (`rolls` gains a third roll type, `skill`, and `rollMode`'s "shown" words change: 07 is read by the app's code, so its paragraph goes with the reader's pull request, plan row C13a, as pf-18's did); `docs/plans/test-feedback-2026-11-19.md` (sections C, D and E). The look is not in 06: pages M1 and M2 draw it, and nothing here is built before he approves them
supersedes: nothing as a file. Inside it: tfs-1 replaces the skill pop-up's "odds both ways" and its lines on where the number comes from (CS-5a; 05, Skills; sr-2's breakdown); tfs-2 widens sv-3 and pf-20 (`dec-player-screen-2026-11-14.md`) to skills; tfs-3 replaces, for a skill rolled "the target or higher", CS-5a's "5+" and the die's glyph before the figure (ch-1, `dec-morning-2026-11-15.md`; row C13 of `dec-13-the-player-screen.md`)
---

# The test feedback of 19 November, sitting 4: skills (ruled 2026-11-19)

The fourth of seven sittings (`docs/intents/test-feedback-2026-11-19.md`, items 26, 27 and 28; the questions in `docs/design/notes/test-feedback-2026-11-19-sittings.md`; his answers in `docs/design/notes/test-feedback-2026-11-19-answers.md`). His words are in quotes; anything else is the designer's reading and says so. Examples are invented (the skill Hark).

**Nothing here is built yet.** The pop-up is on page M2, the heading's line and the figures on page M1.

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfs-1 | **A skill's pop-up starts with one line: "Succeeds on a 5+", the die's glyph, "roll 1d6", and "+N" only when the rules add a number to the roll.** The lines "Base chance for everyone", the class's line, "Higher is better" and the kindred's line are gone. The pack's own text and the source line stay | "remove "base chance for everyone" from all skills. it's duplicative and not needed for the character." and "Format for these checks (at top) is "Succeeds on a 5+,  [die icon] roll 1d6 [+ any modifier, only show if there's a modifier]"" (item 26); "Confirm" (4.1) | The bold "Succeeds on 5 or 6, 2 in 6" and the four lines under it |
| tfs-2 | **The Skills heading's row carries the die's glyph and the pack's rule:** for the fae-woodland pack, "Roll d6: target or higher succeeds." It is built from the rules set (a new roll type beside the save's), never typed in. A setting with no such rule shows the heading alone. The classic-advanced pack's line waits for the Pack Creator | "Skills should have a roll row like Saves and Scores that shows the pack rules." (item 27); "Confirm" (4.2) | Nothing: no line is ruled for Skills today |
| tfs-3 | **A skill's figure reads "5+ on", the die's glyph, "d6", wherever the pack's rule is "the target or higher" on one die.** A pack that rolls another way (a low roll, a percentage) keeps its own style until the Pack Creator answers | "target numbers (now 1-in-6) should read "[Target]+ on [die icon][die roll, ex: d6]"" (item 28); "A" (4.3) | For such a skill, the figure "5+" with the glyph before it |

## How tfs-1 was put to him

Told with the question, and confirmed with it: a better target from a class or a kindred is already inside the "5+", so it is not a modifier. The pop-up then no longer says where the target comes from. A kindred's part still shows under the skill's name on its row ("4 when wading").

## Not settled

1. ⚑ **The top line of a skill that is not rolled "the target or higher"** (a low roll on a d6, a percentage). tfs-1's words fit a target on one die. For the others the four lines go as ruled ("from all skills"), and the top line keeps today's words ("Succeeds on 35 or less on d100, 35 in 100") until the Pack Creator's answer (E6) comes back and he rules the words. One question, then: "For a skill rolled low or by percentage, what does the top line read?"
2. ⚑ **A class skill that stands in for another** (the better of two counts) prints its own two lines today ("A Mire Stalker's Keen ear at level 3: …", "The better counts: …"). The question named four lines and not these. **The designer reads them as going too**: his note keeps only what comes "after and including" the pack's own text. Drawn on M2 without them, for him to see.
3. ⚑ **Does the fae-woodland pack state its skills as targets?** Today it states them "in 6" (the default `rollMode`), so tfs-3 changes nothing on his screen until the pack states "the target or higher". That is the Pack Creator's (E6), and is not a design question unless the book gives both.

## For the builder and the Pack Creator

- tfs-1's "+N": a number the rules add to the die, not a better target. Where nothing adds, the line has no "+N" and no "+0".
- tfs-2, **07's paragraph, to go in with the reader (row C13a)**, at the end of `rolls` (pf-20): *A third roll type, `skill` (tfs-2, 2026-11-19): the same shape, `"skill": { "die": "d6", "pass": "atOrOver" }`, gives the Skills heading its line ("Roll d6: target or higher succeeds."), by the same rules as the others. It is apart from a skill's own `rollMode`, which gives that skill's figure.* And at `rollMode` (CS-5a), with row C14: *`"equal-or-over"` is shown "5+ on d6", the die's glyph between (tfs-3).*
- tfs-2: the roll type is `skill` in the rules set's `rolls`, in pf-20's shape (`{ "die": "d6", "pass": "atOrOver" }`), read by the same rule as the others (the highest rules set that carries it, rl-1). The line's words are the app's, from the die and the pass condition, as the Saves line is. **No pack carries it yet.**
- tfs-2 and tfs-3 are two different facts: `rolls.skill` gives the heading's line; a skill's own `rollMode` (`equal-or-over`) gives its figure. A pack may carry one without the other.
- tfs-3: the glyph sits after the number, inside the figure. Until now it sat before it (the List row's value mark). The figure never wraps.
- The full sheet's page shows the same skills block, so the heading's line and the figures change there too.

## Honest notes

- **The pop-up loses information on purpose.** After tfs-1 nothing in it says that a class or a kindred gave the better target. He was told so with the question.
- **Not checked:** the private packs (how each states a skill's roll: E6).
- **The gate lines** `docs/testing.md:612` and `:652` quote the four lines. They change with the build, not here.

Docs to update: 05 (Skills; the Player screen); 06 (the Breakdown sheet; the Skills block; the List row); 09; the plan's sections C, D and E. Done in the same pull request as this file. Owed, not here: 07 (`rolls.skill` with row C13a's pull request, `rollMode`'s words with C14's; the words are above); the gate lines `docs/testing.md:612` and `:652`, with the build. Not touched: 06's Skill grid row (the gallery's only).

09 lines:
- 2026-11-19 — [sheet] A skill's pop-up starts with one line, "Succeeds on a 5+", the die's glyph, "roll 1d6", and "+N" only when the rules add to the roll; "Base chance for everyone", the class's line, "Higher is better" and the kindred's line are gone; the pack's text and the source stay (tfs-1, replacing CS-5a's "odds both ways" in the pop-up). A skill's figure reads "5+ on d6" with the glyph between, wherever the pack's rule is the target or higher on one die; other kinds keep their style until the Pack Creator answers (tfs-3) — Francis: "Confirm"; "A"
- 2026-11-19 — [packs] The Skills heading's row carries a roll line like Saves, built from a new roll type `rolls.skill` in the rules set ("Roll d6: target or higher succeeds."), never typed in; no rule, no line (tfs-2, widening sv-3 and pf-20). The classic-advanced pack's line waits for the Pack Creator — Francis: "Confirm"
