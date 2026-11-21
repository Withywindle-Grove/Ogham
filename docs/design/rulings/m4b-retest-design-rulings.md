---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Character creation and review; ⋯ menus; Player screen), docs/05-features.md (Player screen; Character sheet), docs/07-content-packs.md (defaultRace)
supersedes: —
---

# M4b re-test design rulings: RULED (2026-10-26)

From `history/m4b-retest-notes.md` ("Needs a ruling"). The ten small items, approved as recommended. The five bigger items follow one at a time (mockups).

1. **GM Players screen:** no separate player column; each character's line names its player.
2. **Race and class on a landscape iPad:** full width, list about 40%, detail about 60%.
3. **Arrange this screen:** hidden until the Player screen redesign decides whether it earns its place.
4. **"Saved" toast on settings screens only** (Rules for this campaign, Character fields), about 1.5 seconds after the last change. Amends B23 ("other actions stay silent") for settings.
5. **Field editor:** category picked from the categories in use plus "New category…"; tapping a field row opens it (as in Arrange).
6. **Default race:** pack field `rulesSets[].defaultRace` (an id); no app default. Without it, race is required in guided creation. Added to the private packs: setting-1 0.5.3 (race-human), setting-2 0.2.6 (human).
7. **Tap HP, AC, attack and Level** for how each is worked out (extends CS-8); ability explanations rewritten in plain words.
8. **Pack:** At hand and Worn start open; each device then remembers what's open.
9. **Words:** "Change rules for this campaign"; "Put it…" becomes **Wear** or **Hold** (whichever fits the item) and **Move to…** (containers).
10. **"Who they are" step:** abilities and auto-filled values hidden; they appear on the character screen.

Also: B25 is tested live with slot-test-homebrew's Lantern Warden (not deferred).

## Bigger items (one at a time)
1. Player screen redesign, and the landscape iPad layout with the full sheet.
2. ⋯ menus: tighter spacing, a symbol beside each item.
3. Starting kits: readable on phone; a choice of kits.
4. Creation shopping uses the Add item screen (yes in principle; M7 "Revisit character creation").
5. Guided weapon proficiency, languages and secondary skill (M7 revisit).

## 09 lines
- 2026-10-26 — GM Players lines name the player; no player column — removes the gap
- 2026-10-26 — Race and class picking use the full width on a landscape iPad (40 / 60) — room to read
- 2026-10-26 — Arrange this screen hidden until the Player screen redesign — not earning its place yet
- 2026-10-26 — Settings screens show a delayed "Saved" toast (about 1.5 s after the last change); amends B23 — otherwise nothing tells you a setting saved
- 2026-10-26 — Field categories picked from those in use or "New category…"; tapping a field row opens it — no typos, one way to open
- 2026-10-26 — Pack field defaultRace (no app default) — rules-agnostic; "Human" belongs to settings
- 2026-10-26 — HP, AC, attack and Level explain how they're worked out on tap; ability explanations in plain words — one tap-to-explain pattern
- 2026-10-26 — At hand and Worn start open on the Pack — useful at once
- 2026-10-26 — "Change rules for this campaign"; "Put it…" becomes Wear / Hold and Move to… — plain verbs
- 2026-10-26 — "Who they are" hides abilities and auto-filled values — one thing at a time in creation

## Big item 1: Player screen (RULED 2026-10-26)
- **Job:** what a player glances at between turns.
- **Header:** name (30), "Class level · Race" quiet below, status symbols on the right.
- **Vitals:** HP largest with the segmented bar and "of N" (tap: the M6-3 damage pad; replaces "Not set" and bare −/+); AC and Attack with one quiet line each (tap: how it's worked out).
- **Sections, in this order, each only when the character has something in it:** Light (lit light, ring timer, time left, Douse / Light another) · **Spells** (prepared spells by level, one line each: name · duration · range, Cast in M7; a cast spell is crossed out; no "N left" count; levels collapse except the highest; cast ones sink to the bottom of their level) · **Abilities** (any limited-use power from class, race, downtime, homebrew or items; uses as dots, tap when used) · At hand (pinned items with their one action) · **Skills** (two-column grid in each pack's own style) · Saves (one compact row, the pack's short names) · coin, then "Full character sheet ›".
- **Every spell, ability, skill and save opens its rules in one tap:** what it does, how it works at the table, modifiers and source.
- **Landscape iPad:** a fixed play column (the above, scrolling on its own) beside the full sheet, which leaves out anything already in the play column (no second HP or AC, no second Combat heading). Phone: the full sheet is its own screen.
- **Arrange this screen** is removed in R1.
- Timing: built as an M4b follow-up; the Spells section lists prepared spells now, Cast arrives in M7; ability dots now.
- 09: 2026-10-26 — Player screen redesigned: vitals (HP bar, AC, attack), then Light, Spells, Abilities, At hand, Skills, Saves, coin, each only when present, each opening its rules in one tap; iPad landscape pairs a play column with the full sheet without repeats; Arrange this screen removed — the glance screen for play, nothing duplicated

## Big item 2: ⋯ menus (RULED 2026-10-26)
- A symbol beside every item (accent colour; placeholders until the Style release's symbol family; always beside the word, never replacing it); 48 px rows with no gaps; "This device" below a thin divider.
- Player: Your characters · Full character sheet · Company · Setting rules · | This device. GM: only what isn't a tab: Company · Handouts (if not a tab; quiet "N new" count) · | This device.
- 09: 2026-10-26 — ⋯ menus get a symbol beside each item, 48 px rows without gaps, This device below a divider — faster to scan, still 44 px+
