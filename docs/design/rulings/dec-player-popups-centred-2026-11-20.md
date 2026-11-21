---
status: pending
milestone: December first play (Francis's tablet feedback of 2026-11-20, fb-7: the Player tab's pop-ups on a tablet)
absorbed-into: docs/09-decisions-log.md (2026-11-20); docs/06-screens-and-design.md (the pop-up widths under Design tokens; Components, the Sheet row, marked not built); docs/plans/dec-player-popups-centred.md (row fb-7); docs/plans/app-sweep.md (S-24, S-25). Still to absorb, with row fb-7's build: the tokens in `tokens.css`, 06's Code column
supersedes: nothing as a file. Inside it: fb7-1 replaces, for the Player tab on a tablet, "on a tablet opens beside the button that opened it" (final drafts A7, 2026-11-07, `docs/plans/m5b-creation-final-drafts.md`; taken to the Player and Pack tabs by plan `m5b-players-screens-standard`, A4); fb7-2 and fb7-3 replace the 440 px card there
---

# The Player tab's pop-ups on a tablet: centred, and wider (fb-7, 2026-11-20)

A short design sitting from the driver's brief. Francis's words came through the driver, from the live Player tab on his iPad and his PC, with three pictures. What he said first is fb7-1 and fb7-2. The six ⚑ the sitting collected were put to him by the driver with page 31, and he approved the page with the designer's pick on each: "Approve" (20 November, relayed by the driver). They are fb7-3 to fb7-8. The same day he changed one of them, the short pop-ups (fb7-4), from the pick he had approved to "fit to content".

## His words

> "it's not just patron, it's general feedback for all of the popups on this screen. i also notice that tapping the chevron pops them up on the right column, but tapping the row centers the popup on the page. i like the centered popup i think that should be standard and we can make it at least 50% wider."

> "popup positioning seems inconsistent - sometimes it pops up in the left too. keep it centered."

## Rulings

| # | Ruling | His words | Replaces |
|---|---|---|---|
| fb7-1 | **On the Player tab, on a tablet held sideways, every pop-up opens centred on the screen**, whichever column its button is in and wherever on the row the tap lands. The page is dimmed behind it; ✕, Escape or a tap outside closes it, as today. **The phone does not change**: the sheet comes up from the bottom | "i like the centered popup i think that should be standard"; "keep it centered" | "Opens beside the button that opened it (below it, else above, kept on screen; centred with no button)" (06, the Sheet; final drafts A7), on this tab |
| fb7-2 | **Those pop-ups are at least half as wide again as today's 440 px**: 660 px or more | "we can make it at least 50% wider" | The 440 px card, on this tab |
| fb7-3 | ⚑ 1. **The widest a pop-up gets is 720 px**, the width the "Wide" pop-up already has, never wider than the screen less its margins. The pop-up's widths become named tokens (06, Design tokens) | "Approve" (page 31, pick B) | The bare 440 and 720 in `Dialog.css` |
| fb7-4 | ⚑ 2. **Every pop-up on the tab fits its content: 440 px at least, 720 px at most.** A short one stays narrow; a long one grows to 720 and its lines wrap there. **The build follows this rule, not the frames that draw short pop-ups wide** (FB7d's cards 5, 6 and 9; the skill in FB7b, FB7f and FB7g): frame FB7h draws the rule | "Can we dynamically size shorter passages"; to "fit to content between 440 and 720, replacing pick 2": "Agreed" (relayed by the driver) | The pick he approved earlier the same day (every pop-up one 720 px card), and so fb7-2's "at least half as wide again" for a pop-up that holds little |
| fb7-5 | ⚑ 3. **Hit points and Max hit points keep their own fitted width** (tf-A2, 2026-11-19), under 440 px, and are centred like the rest | "Approve"; kept when fb7-4 changed | — |
| fb7-6 | ⚑ 4. **A tablet held upright follows**: from 700 px, the tab in one column or two, the same rule | "Approve" | — |
| fb7-7 | ⚑ 5. **The Player tab now; the other screens in the app sweep**, each with its pictures (the Pack tab, the Magic tab and the full sheet beside it, the Scene's sheets, creation, the GM's screens). Until then they keep "beside its button" | "Approve" (pick a) | — |
| fb7-8 | ⚑ 6. **A long pop-up's heading, ✕ and "Got it" staying in view while its words scroll goes on the sweep's list**; not built with fb-7 | "Approve" | — |

**Page 31 is approved as drawn, 2026-11-20**, so row fb-7 can go to a builder once this file is on `main`.

## What the app does today

Read in the code and measured in the built app (the layout check's browser, WebKit, at 1180 × 820, with a mouse and with a finger; the stand-in character of `layout.html?as=player&p1=1`).

**One container.** Every pop-up on the Player tab is the one `Dialog`, drawn as a Sheet because `PlayerScreen.tsx` wraps the tab in `SheetScope` (`src/app/PlayerScreen.tsx:339`). On a tablet a Sheet is placed by `sheetPlace` (`src/ui/Dialog.tsx:85`): **its left edge at the left edge of the button that opened it**, under the button if there is room, else over it, kept inside the screen's 16 px margins. It is 440 px wide (`.dialog`, `src/ui/Dialog.css:17`). It is centred only when the app has no button to place it by (`Dialog.tsx:286`: the button is gone from the page; or `sheetPlace` returns nothing).

| Opened from | Pop-up | Where its left edge sat (px, of 1180) |
|---|---|---|
| Left column | Portrait | 126 |
| Left column | A status ring (four in a row) | 234, 294, 354, 414: 60 px further right for each ring |
| Left column | Hit points (279 px wide: fitted to its content, tf-A2) | 140 |
| Left column | Armour class · Attack | 126 · 350 |
| Left column | The weapon in hand, by its name · by its Attack button | 140 · 465 |
| Left column | A thing At hand · its Quiver or Grip | 126 · 382 |
| Left column | The lit light, by its name · "About Keep lit" | 186 · 190 |
| Left column | The level block | 126 |
| Right column | Notices | 631 |
| Right column | A score (three across) | 631, then 724 and 724: held at the right margin |
| Right column | A save (five across) | 631, then 724 for the other four |
| Right column | Speed · Burden | 631 · 724 |
| Right column | A trait with uses; a skill; the rows Abilities, Traits, Notes | 631 |
| Inside a pop-up | "Give to…", "Put in…"; an ability or trait from the Abilities or Traits list | 12 px right of the pop-up it was opened from |
| The top bar | More (⋯) | 724, under the button |
| The top bar | Log, Messages | The whole screen (their own panel; not part of this) |

- **A row's words and its chevron gave the same place** in this browser: a list row is one button, the chevron inside it (`ListRow`, `src/ui/parts.tsx:596`).
- **Nothing opened centred in this browser.** His iPad picture of the Torch is truly centred (measured on the picture), and his picture of "Listen at doors" starts at the right column's left edge, as the table says. So on his iPad some taps lose their button. **Why was not reproduced and is not confirmed on a device.** The likeliest cause, from the code: the app notes the tapped button from the tap's target (`Dialog.tsx:62` to `72`), and takes it only when that target is an element; Safari on an iPad can name the words under the finger (a piece of text, not an element), which leaves no button and so a centred pop-up; a tap on the chevron, which is a drawing, names the button. That matches his "tapping the chevron … tapping the row".
- **Found on the way:** opened from the keyboard, a pop-up sits beside the last thing tapped, not the row in focus (measured: Enter on a skill row opened it at 186 px, beside the light's name tapped before). `anchorNow` (`Dialog.tsx:75`) prefers the last tap over the focus. fb7-1 ends it on this tab; elsewhere it stays until ⚑ 5.

**The approved pictures already drew them centred.** Page M2 (page 26, approved 2026-11-19) draws every Player tab pop-up in the middle of the tablet, 440 px wide; the app placed them beside their buttons by the older rule. fb7-1 brings the app to the picture and widens it.

## The page

Mockup page 31, frames FB7a to FB7g, light and dark: `docs/design/mockups/december/png/31-*.png` (rows in `docs/design/mockups/index.md`). Its source, `december/31-fb7-player-tab-pop-ups-centred-and-wider.html`, is on the branch `design-fb7-popups-studio`, built on page M1's tab and page M2's pop-ups with the one shared stylesheet. **Approved by Francis on 2026-11-20 as drawn, with the designer's picks.** The pictures' own captions still read "A proposal, not approved": they are marked at the page's next render, not re-rendered for that alone.

| Frame | What it shows |
|---|---|
| FB7a | Today, for comparison: a diagram of the three places, as measured |
| FB7b | The fix: a skill's pop-up centred, 720 px |
| FB7c | The width three ways: 440 (today), 660, 720 (⚑ 1) |
| FB7d | Each kind of pop-up at 720 px: an entry, a thing At hand, a figure, a list, a blocked action, a status, Notes, the Quiver, Portrait; Hit points at its own width (⚑ 2, ⚑ 3) |
| FB7e | A long entry, taller than the screen: the card stops at the margins and its words scroll inside, as today |
| FB7f | A pop-up opened from a pop-up: centred over the first |
| FB7g | A 1024 px tablet; a tablet held upright (⚑ 4); a phone, unchanged |
| FB7h | **Added after the approval, to fb7-4; not yet seen by Francis.** Fit to content: FB7d's cards and a skill, each at the width it comes to |

**What fit to content comes to, on FB7h** (page M2's pop-ups, the book's face at 16 px): a trait's entry and Notes 720 px; a thing At hand 708; a save 597; a blocked action and a skill 480; the Abilities list, a status, the Quiver and Portrait 440; Hit points 250, its own.

**Self-review.** Nielsen: one place and one size for every pop-up (consistency, the point); ✕, Escape and a tap outside unchanged; the page stays in view, dimmed. States drawn: short, long and scrolling, one from another, a fitted form; 1180, 1024, 820 and 375 px. Messy data: page M2's long names and a long entry. Measured with `shared/measure.cjs`: nothing under 14 px, no target under 44 px; contrast clean but for the lantern's amber ring on page M1's tab (2.81 to 1 in light; frame P1's own, known). The script's 102 "gaps" are all between a pop-up and the dimmed page under it, or between two devices drawn in one frame; none inside a pop-up. No disabled button, no new button, nothing by colour alone.

## The ⚑, as they were asked

All six were ruled on 2026-11-20 as the designer's pick (fb7-3 to fb7-8 above); ⚑ 2 was then changed to fit to content (fb7-4). Kept as asked, for the reasons.

1. ⚑ **The width.** (A) **660 px**: half as wide again, the least he asked for; its lines stay inside the app's reading measure (65 characters of the book's face, 667 px). (B) **720 px**, 64% wider: the width the "Wide" pop-up already has (+ Status), so the app gains no new size; its lines run about 30 px past the reading measure, 88 letters a line against 80. Wider is possible. **My pick: B**, for one wide size in the app; the lines are short reference text, not long reading. Frame FB7c. Either way the widths become named tokens in 06 (today 440 and 720 are bare numbers in `Dialog.css`).
2. ⚑ **Short pop-ups** (a blocked action, a status, Portrait): the same wide card, mostly empty, or stay 440 px? **My pick: the same card**, so every pop-up is one size. Frame FB7d, cards 5, 6 and 9.
3. ⚑ **Hit points and Max hit points** were ruled on 2026-11-19 to be no wider than their content ("why is the box so wide?"). Read as: they keep that width and are centred like the rest. Frame FB7d, card 10. Confirm.
4. ⚑ **A tablet held upright** (700 to 1023 px, the tab in one column) places pop-ups beside their buttons too. His words name the wide tab. Centred and wide there as well? **My pick: yes**, one rule for a tablet both ways up. Frame FB7g.
5. ⚑ **The other screens.** The Pack tab, the Magic tab and the full sheet beside it, the Scene's sheets, creation (where "beside its button" was first ruled) and the GM's screens open pop-ups by the same rule. "i think that should be standard": (a) the Player tab now, the rest in the app sweep, each with its pictures; or (b) everywhere now. (b) is less code (the placing goes) but changes creation's approved behaviour and many committed layout checks at once. **My pick: (a).**
6. ⚑ **Noticed, not asked.** In a pop-up taller than the screen the whole card scrolls, so the heading and ✕ scroll away (a tap outside or Escape still closes). Keeping the heading and "Got it" in view is a separate change: want it listed for the sweep? Frame FB7e.

## Honest notes

- **Not confirmed on a device:** why his iPad centres some taps. The fix does not depend on the cause: a centred pop-up needs no button to place it by.
- **Not drawn:** Larger text; loading, a failed read and offline inside a pop-up (unchanged by the card's place); the tab behind the upright tablet (no approved frame at that width).
- **Not measured on a device:** the on-screen keyboard over a centred pop-up with a field (Notes, Hit points). Today a pop-up beside a low button can sit under the keyboard too.
- **Build cost:** small in `Dialog`, but it changes committed layout checks and pictures of the Player tab's pop-ups (the plan lists them). ⚑ 5 (b) would multiply that.
- **Fit to content (fb7-4) gives many widths, not two:** a pop-up is as wide as its longest line, so FB7h shows 440, 480, 597, 708 and 720 px. That is the rule as he agreed it; if the spread reads as untidy on the built screen, the fix is steps (say 440, 580, 720), which is a new question for him, not a builder's call.
- **A pop-up whose content changes while it is open** (a roll that adds lines, a note typed) could change width under the finger. Not drawn. The plan asks the builder to check and to stop if one jumps.
- **FB7h has not been seen by Francis.** The pictures he approved are FB7a to FB7g.
- **FB7f** keeps today's behaviour of one pop-up over another; with both in the middle the first shows round the second when it is taller.

## Docs to update
- `docs/09-decisions-log.md`, 2026-11-20. Done here.
- `docs/06-screens-and-design.md`, Components, the Sheet row: fb7-1 and fb7-2 as ruled, marked not built. Done here. With the build: the ruled width as tokens, the Code column.
- `docs/06-screens-and-design.md`, Design tokens: the pop-up's least and greatest widths, named (fb7-3, fb7-4). Done here; `tokens.css` with the build.
- `docs/plans/dec-player-popups-centred.md`: row fb-7, its page approved. Done here.
- `docs/plans/app-sweep.md`: S-24 (the other screens, fb7-7) and S-25 (a long pop-up's heading, fb7-8). Done here.
- `docs/intents/francis-tablet-feedback-2026-11-20.md` and section Q of `docs/plans/test-feedback-2026-11-19.md` are on pull request #1110, not on `main` yet: fb-7's row there is the driver's to add once it merges (not edited here, to keep the two from colliding).
- `docs/10-open-questions.md`: nothing (the ⚑ were kept here and in the plan, and are ruled).

## 09 line
- 2026-11-20 — [ui] On the Player tab, on a tablet either way up, every pop-up opens centred on the screen, whichever button or column opens it, and fits its content: 440 px at least, 720 px at most (both named tokens), so a short one stays narrow and a long one grows; Hit points and Max hit points keep their own fitted width, centred; the phone keeps its sheet from the bottom. It replaces "beside the button that opened it" (final drafts A7) and the fixed 440 px card on that tab; the other screens follow in the app sweep, with a long pop-up's heading staying in view. Page 31 approved as drawn, then the short pop-ups' width changed to fit (fb7-1 to fb7-8) — Francis: "i like the centered popup i think that should be standard and we can make it at least 50% wider"; "keep it centered"; "Approve"; "Can we dynamically size shorter passages"; "Agreed" — `design/rulings/dec-player-popups-centred-2026-11-20.md`
