---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Words batch 1), docs/05-features.md (Gear that stops casting)
supersedes: —
---

# Words batch 1: RULED (2026-10-26)

For the A/B gate builds (B21, B24, B25, A5, A14, B18, B23). Status: **RULED 2026-10-26**, the batch approved as written, including every ⚑ default. Follows `words-and-voice-ruled.md`. `{braces}` are filled by the app; setting terms (race, class, ability names) come from the pack. All examples are invented.

⚑ marks the five points that need a ruling. Each has a default, which Claude Code uses until the ruling.

---

## 1. Guided creation: one line per step (Ogham)

| Step | Instruction |
|---|---|
| Which way? | Choose how to make this character: step by step, or freeform. |
| Scores | Roll each score as your setting says, then enter what you rolled. |
| {Race} | Choose your {race}. Each one shows what it needs. |
| Class | Choose a class. Any your scores can't reach will say why. |
| Adjust | Trade points between scores, if your setting allows it. |
| Who are they? | Give them a name, and a few words the table will remember. |
| HP and money | Roll hit points and starting gold, then enter both. |
| Gear | Take a kit, or buy your own with the gold you rolled. |
| Review (first time) | Read it through once, then send it to the GM. |
| Review (sent back) | The GM asked for a change. Fix the marked parts, then resend. |
| Review (no approval needed) | Read it through once, then add them to the party. |

- {race} uses the pack's own term ("kindred" stays "kindred").
- When a setting skips a step (no Adjust, for example), the step and its line don't appear.

## 2. HP prompt

These follow the prompt pattern: the roll first, then what to add. The app builds them from the pack and the campaign's rules.

| Case | Line |
|---|---|
| Hit die, level 1 | Roll 1d8 · add 1 for CON |
| Hit die, higher level | Roll 2d8 for level 2 · add 1 for CON to each die |
| Negative modifier | Roll 1d6 · subtract 1 for CON (at least 1) |
| Zero modifier | Roll 1d6 (the CON part is left out) |
| Full HP at level 1 (campaign rule) | Level 1 starts full: 8, plus 1 for CON. |
| Setting's own rule (pack note) | Roll hit points as your setting says: {pack's short rule}. |
| Setting's own rule, no note | Roll hit points as your setting says, then enter the total. |
| No hit die, fixed HP | Your class starts with {N} hit points. |
| No hit die, nothing given | Enter the hit points your GM gives you. |

- "(at least 1)" and "to each die" appear only when the pack says so (per-die modifier, minimum per die). The ability label is the pack's.
- Above the dice (warning, ruled): "▲ 9 is above what 1d6 can roll. Roll again, or send it and the GM decides."

## 3. ⓘ texts (3 sentences or fewer)

| Topic | Text |
|---|---|
| Companies (A14) | A company is the party's shared charter: how treasure is split, who holds which title, and how votes go. The Treasurer and Archivist are chosen by vote. You can play without one; the GM turns companies on in Rules for this campaign. |
| Literacy (fallback when the pack has no `literacyNote`) | Literacy is whether your character can read and write. Some settings tie it to a score or a background. Ask your GM how yours works. |
| Alignment (fallback) | Alignment is your character's broad outlook, in your setting's own words. It can matter to some magic, items and places. Your GM decides what it means at your table. |
| Party's lowest | New characters start at the level of the lowest active character, worked out when they're made. Retired and dead characters don't count. The number shown updates as the party changes. |
| Player proposes, GM approves | The player picks a starting level while making the character. The GM sees it on the review and approves it or asks for another. |
| Fixed level | Every new character starts at the level set here. It's capped at each class's maximum, so a class that stops early starts at its own top level. |

- Claude Code should check the Companies text against A14's built behaviour (who can turn companies on, which titles exist) and flag any mismatch rather than reword it.

## 4. ⚑ The GM's ⋯ menu order

1. Players' characters (with "N waiting" when reviews are pending)
2. Rules for this campaign
3. Setting rules
4. Company
5. Handouts
6. Arrange this screen
7. This device (theme, Dim pictures in dark mode, Ability captions)

- **Why this order:** the GM's most frequent menu task between sessions is reviewing characters, so it comes first. Campaign rules come before setting rules because the GM changes them; setting rules are read-only reference. "This device" closes both menus.
- **Proposed for the player's menu too:** add "This device" as the last item, after "Arrange this screen".
- **Not in this menu:** End expedition stays in the time strip's ⋯ (M5-7).

## 5. Toasts (past tense, what moved, then one action; 8 seconds)

| Action | Toast |
|---|---|
| Drop (single) | Dropped Lantern · Undo |
| Drop (some of a stack) | Dropped 3 torches · Undo |
| Drop all | Dropped all 6 torches · Undo |
| Give | Gave 3 rations to Ilsa · Undo |
| Give to someone outside the party | Gave 3 rations away to Odo · Undo |
| Empty a container | Emptied Backpack · 4 things dropped · Undo |
| Last of a stack | Rations: used the last one · Undo |
| HP chip (damage) | Took 3 damage · HP 6 · Undo |
| HP chip (heal) | Healed 2 · HP 8 · Undo |
| Gear that stops casting (ruled) | Chainmail stops arcane casting · Undo |
| …when the pack blocks all casting | Chainmail stops your casting · Undo |

- **⚑ Plurals:** "3 torches" needs a plural form. The default is to use the pack's `pluralName` when it has one, and otherwise "Torch ×3". Packs should add `pluralName` to stackable items; I'll add it to the private packs after the ruling.
- **"away"** marks a give that leaves the party, so the log and the Treasurer can tell it apart from passing something between players.
- **⚑ Light burnt out:** "Torch burnt out · Light another". B23 lists burnout with Undo, but a burnout comes from the GM's clock. Undoing only the burnout while time stays advanced would leave the light and the clock out of step. The default is "Light another" as the action, with burnout undone only by undoing the turn (from the log).

## 6. ⚑ B25 status: where it shows

- **Confirmed for now:** the Player screen, the Your characters card and the GM's review card.
- **Proposed addition (default yes):** the blocking gear's row in the Pack shows a muted note, "Stops arcane casting", so the cause is visible where you'd take it off.
- **Later:** the Explore party row and the character overview get the status symbol when M5 builds them. M7's Cast explains it on tap.

## 7. Empty states (Ogham)

| Where | Line | Action |
|---|---|---|
| No characters yet | No one is in the ledger yet. Make your first character. | Make a character |
| Empty pack | Nothing carried yet. Add what you take on the road. | Add item |
| Empty Party stash | Nothing in the Party stash yet. Things given to it show here. | (none) |
| Empty log | The log is blank. What happens at the table is kept here. | (none) |
| No setting rules (GM) | No setting rules yet. Add your setting to fill them in. | Add setting rules |
| No setting rules (player) | Your GM hasn't added setting rules yet. | (none) |

## 8. ⚑ The Resend pop-up (when the GM's asks aren't done)

This is a dialog, because it asks for a choice (A11).

- **Title:** "{N} things still to do"
- **List** (one line per item, in reading order):
  - "Hit points: the GM asked you to roll again."
  - "Starting money: over by 3 gp."
- **Body:** "You can resend now; the GM will see these marked."
- **Buttons:**
  - "Fix hit points" (primary; jumps to the first item's step)
  - "Resend anyway" (quiet)
- **Default yes for "Resend anyway":** broken rules may go to the GM for a ruling (fiat), so blocking the resend would contradict "never disabled".
- **One item left:** the title is "1 thing still to do".

---

## 09 lines (after the ruling)
- 2026-10-26 — Words batch 1 (creation lines, HP prompts, ⓘ fallbacks, toasts, empty states, Resend pop-up) — text for the gate builds
- 2026-10-26 — GM ⋯ order: Players' characters · Rules for this campaign · Setting rules · Company · Handouts · Arrange this screen · This device — review is the GM's most frequent menu task
- 2026-10-26 — Stack toasts use the pack's pluralName, else "Name ×N" — plurals can't be guessed rules-agnostically
- 2026-10-26 — Light burnout toast offers "Light another"; burnout is undone only by undoing the turn — the clock caused it
- 2026-10-26 — Resend pop-up offers "Fix …" and "Resend anyway" — broken rules can go to the GM; never disabled
