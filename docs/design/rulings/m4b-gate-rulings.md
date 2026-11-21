---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Character creation and review; Components), docs/05-features.md (Rules for this campaign; Character sheet), docs/07-content-packs.md
supersedes: —
---

# M4b gate: rulings and DOCS list (2026-10-25)

Source: Claude Code's M4b gate report (14 tests; 4 failed plus live updates). All items below are approved by Francis.

## A. Ruled during the gate (confirmed)

A1–A14 stand as Claude Code listed them, with these clarifications from the design Project:
- **A5 (guided creation guidance):** the "short instruction at the top of each step" is a **named exception to principle 6 for guided flows only** (creation, later level-up and campaign setup): one line, about 12 words at most, Ogham's voice; detail stays behind ⓘ; play screens keep principle 6.
- **A10 (equip against class rules is blocked):** this **replaces** the earlier "warn and tell the GM" rule. When the rules allow wearing something but it stops casting, equip is allowed and B25 applies.
- **A11 (pop-ups app-wide):** two kinds. **Messages** (confirmations, warnings, errors, notices) are pop-ups: a toast for information, a dialog for a choice. **Working panels** (reminder card, urgent strip, Waiting for you, map panel, a pinned GM note) stay in the page, with space reserved or sliding over content, so nothing jumps; they collapse when empty, only between actions.
- **A12 (live updates):** next build.
- **A13 (no "From your setting" heading on the sheet):** consistent with CS-2/CS-8: details live under each block, one tap away.

## B. Design rulings

| # | Ruling |
|---|---|
| B15 | One screen, **"Rules for this campaign"**, first in the GM's Rules tab: app settings and pack options together in fixed app topic groups (Characters · Adventuring · Combat · Items and treasure · Time and calendar · Table and players; unmapped → Other). Each row has a source tag (pack short name or "Nemeton"). Groups collapsed with "N changed from default"; choose-one rows as buttons; presets and preview per X-4. |
| B16 | Buttons: **soft shadow**, 1.5 px outline kept, Garamond label on secondary buttons so they never look like fields; pressed drops 1 px and loses the shadow; **quiet** buttons (underlined accent text, 44 px tap area) for rare actions; pop-ups carry the only deeper shadow. **Dark accent token → Copper #C9875A** with near-black text (replaces #D4836B everywhere in dark mode); gallery checks it against the dark warning colour, and the warning colour moves if needed. |
| B17 | Creation visuals as mocked up: "Which way?" as two choice cards; race and class picking on the list-and-detail template (tablet: list left, detail right with "Choose"; phone: option rows, detail sheet); not-allowed options visible, greyed, "!" with reason; heading "<Race> <Class>"; kit card with contents folded, cost and gold left, Take this kit / Buy your own, In-pack list below. |
| B18 | Sent-back character: **full screen on the review step**; GM note as a pinned working panel until resent; GM can tick sections when sending back (marked, jump to step); Resend stays enabled and explains what's still needed in a pop-up; one review screen for first submission, sent-back and the GM review card. |
| B19 | Add item "Put it": a **vertical destination list** grouped Equipped / Containers / Party stash, one selected (last used for that kind, else first container with room), room left per row, blocked rows visible with "!" and a reason pop-up, full containers say Full; the main button names the destination ("Add to Backpack"). **Clarifies M4 gate 7:** a choice becomes a button row only when every option fits one row at Standard text size; otherwise a vertical list. The destination list is shared by Add, Give and Move. |
| B20 | Full sheet as a compact grid, as mocked up (approved for now; may iterate): **Combat first, then Abilities** (updates 05's order); tablet two self-balancing columns, full-width blocks (class abilities, spells) below; phone one column of compact grids; values sit with their labels. ◈ Arranging the sheet later. |
| B21 | "New characters start at": **Level 1 · Party's lowest** (worked out at creation, shown live) **· Fixed level** (stepper; capped at each class's maximum) **· Player proposes, GM approves** (replaces "GM's choice"); each row carries its one-line meaning; the player sees "You start at level N" (or a stepper under Player proposes). |
| B22 | **Deferred to M7.** Spells at creation wait until magic is fully designed. M7 adds **"Revisit character creation"** to bring in spells and everything built since M4b. Until then casters are reviewed without spells. |
| B23 | **Toast with Undo for 8 seconds** (may shorten later) for any action that makes something leave your view: drop, give, empty a container, last of a stack, light burnt out. One toast at a time above the tab bar; same Undo as the log, same rules. Other actions stay silent. |
| B24 | Give on a stack asks **how many**: one shared prompt for Give, Drop and Move (stepper starting at the whole stack, plus "All N"; single items skip it), on one screen with the destination list; toast after. Light and dark approved. |
| B25 | Casting blocked by gear: pack field **`spellcasting.blockedBy`** `{ armour: [types] | "any", shields, tags?, castingTypes?, note }`; equipping allowed with an alert pop-up (reason and source); a **derived status** named by the pack (`statusName`, default "Can't cast", crossed-out wand symbol), no timer and no Remove, ends with the gear; Cast stays tappable and explains why; shown on card, Player screen, overview and the GM review card. |

## Component system (approved 2026-10-25)

See `component-inventory-ruled.md`: a "Components" section in 06 listing every part with states, variants, accessibility, source ruling and a code column; build once, change once; **component gallery first** (right after the gate fixes); **screenshot tests** on the gallery; one audit of duplicates during M5.

## DOCS list for Claude Code

- **06-screens-and-design.md:**
  - New section "Components" from component-inventory-ruled.md (with the code column).
  - Principle 6: add the guided-flow exception (A5).
  - New principle "Messages are pop-ups; working panels stay in place without moving content" (A11).
  - M4 gate 7 clarification (B19).
  - Toast rule (B23).
  - Buttons (B16).
  - Dark accent token Copper #C9875A (B16).
  - Full sheet layout (B20).
  - Creation visuals (B17).
  - Review screen (B18).
- **05-features.md:** Rules for this campaign (B15); start level options (B21); sent-back flow (B18); Add/Give/Move destination list and how-many (B19, B24); equip blocked and casting blocked (A10, B25); sheet order Combat first (B20); toasts (B23); A1–A14 behaviour changes.
- **07-content-packs.md:** `spellcasting.blockedBy`, `statusName` (B25).
- **08-roadmap.md:** component gallery and screenshot tests first in M5 (2–4 days); M7 adds "Revisit character creation" and spells at creation (B22). Note that the 6-hours-a-week assumption is out of date; forecast to be redone at the Sunday check-in.
- **10-open-questions.md:** B20 layout may iterate; toast length may shorten; dark warning colour vs Copper to check in the gallery.
- **CLAUDE.md:** build once / change once; update the inventory's code column in the same PR; never add a disabled button (explain in a pop-up instead).
