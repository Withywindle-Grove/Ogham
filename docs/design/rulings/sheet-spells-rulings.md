---
status: absorbed
milestone: m5
absorbed-into: docs/05-features.md (Exploration follow-ups; Character sheet), docs/07-content-packs.md (Exploration), docs/04-data-model.md
supersedes: —
---

# Sheet, spells and exploration follow-ups: rulings (2026-10-25)

All approved by Francis. Sources reviewed: setting-2's character sheet, plus setting-1's rules options checklist, dungeon time tracker, spell references, and standard and item-encumbrance character sheets. Information standard only; nothing of their look is copied.

## Exploration follow-ups

| # | Ruling | Built |
|---|---|---|
| X-1 | **Hour track** replaces the strip in turn-by-turn modes: one row of pips (turns per hour from the pack's `time`, default 6), current turn filled; symbols on future pips for party-level events (checks, rest, effects ending; lights as one combined symbol at the first light to run out). The due pip glows and prompts as before. Day-by-day modes keep the S17 strip. Players see only public events. The GM's **Next turn** is always visible on the Explore screen, never in a menu (for dithering parties). | M5 |
| X-2 | **Activities in any mode** (`onlyIn` picks modes; `cost` in the mode's step). `chance: { skill: "<id>" }` uses the actor's skill target; `modify` hooks apply. `who`: one / several (rolled separately, one prompt) / party. `secret: true`: prompt and result GM only, player sees "Searching…", GM can Send. `requires`: a class ability or skill (actors without it aren't listed). In turn modes the row collapses to one **"Act…"** button. "Other…" stays last. | M5 (turn modes), M5b (day modes) |
| X-3 | **Timed effects:** using something with a duration opens a confirm (targets; duration worked out: formulas use level, dice entered by the GM, concentration and "until broken" have no timer and show the caster, permanent is a plain symbol). Shown as status symbols and on the hour track. Hidden timers via the pack's `durationHidden` or GM "Hide time left". | Engine, "+ Effect" and item use M5; monster and area targets M6; spells M7 |
| X-4 | Optional rules carry `category` (order from the pack's `optionCategories`; "Other" last; grouped under pack names when several packs). Collapsible sections; choose-one groups open first; closed sections show "N on". `presets` on options with names from `optionPresets`; offered at the last step of starting a campaign and in the Optional rules ⋯, with a preview and confirm, logged and undoable. No origin markers. | With optional rules screens |
| — | Marching order correction: GM always edits, plus campaign switch "Players can reorder marching order" (default Yes). No permission bundles. | M5 |

## Character sheet (feeds the held M4b sheet screens)

| # | Ruling |
|---|---|
| CS-1 | New pack kind `traitLists` `{id, name, die?, entries:[{id, name, notes, source, effects?}]}` (backgrounds, affiliations, moon signs, secondary skills). Sheet field `type: "list", from: "<traitList id>"`, editable any time by the owner (logged); free text without a pack. Effects use existing hooks and fill rules. Moon sign: a pick or die result in R1; R3 `derivedFrom: "birthday"` suggests from the calendar. **Title** filled from the class's `levelTitles`, overridable, hidden if none. Identity order: name, title, race and class, level, alignment, then trait fields. Overview popup: name, title, class and level on one line, plus up to two `showOnCard` trait fields. |
| CS-2 | Ability captions from the pack (`abilities[].affects`, at most 4 words, one line, muted, "…" not wrapping) on the full sheet only. Personal switch ⋯ → This device "Ability captions", default On. Tap a score for the full popup. Block rule lines (ability check, saves) behind an ⓘ on the block heading. |
| CS-3 (tentative, try at the table) | `saveModifiers` `[{id, name, value, appliesWhen}]` (e.g. the WIS modifier vs magic), shown as the last box in the saves block, set apart with its tag; never added into save targets. In M6 save prompts it's offered as a one-tap modifier with its source, pre-ticked when the GM marks the source as magic. |
| CS-4 | Movement figures worked out from the modes (one per mode, in its own name and unit), plus new `movement.combat` (feet per round, used by M6). Always the character's own speed; a note shows the party's slowest when different. Tap for how it's worked out. |
| CS-5 | One Skills block: skills everyone has first, then class skills, same style. Rules set `skills` `[{id, name, die, default, fill}]`, shown as "2-in-6" or "35%". Filled by the setting, overridable. Used by X-2's `chance: { skill }`. Tap for details. Visible to owner and GM; others only via public fields. Merges with classes' existing `skills` (including `gmRolls`). |
| CS-6 | Equipped / stowed / tiny are derived, not a new state: Equipped = At hand (label from `encumbrance.labels`), Stowed = inside a container, Tiny = items or categories `unencumbering: true` (own collapsed section). `encumbrance.slots {equipped, stowed, adjust}` plus speed `bands`; summary "Equipped 6 / 10 · Stowed 12 / 13 · 90 ft". Warns, never blocks. Moving uses the existing "Put it" actions. M6 info note for stowed items ("takes a round to get out"). |
| CS-7 | Coins already covered by `currency`. Technical note: the purse lists every denomination in pack order, even at zero. |
| CS-8 | Combat block: HP (largest), AC, one attack figure following the AC-style option ("Attack +1" or "THAC0 19"), sub-line "Melee +1 · Missile +0". Tap Attack for how it's worked out and, with descending AC, the to-hit row (AC 9 → 0). Tap AC for the breakdown including unarmoured AC. M6 attack prompts show the needed roll when the target's AC is known. |
| CS-8 addition (M6) | Campaign setting "Monster AC and saves": Learned in play (default) / Always shown / Never shown. AC revealed on the first confirmed hit, per stat block, and stays known. Saves revealed by the GM with one tap ("Reveal saves"), never automatically. Before AC is known, players see their attack figure and "Roll and tell the GM"; the GM sees the needed roll. No range tracking from misses. |
| CS-9 | Initiative modifier in the combat sub-line only when the pack's initiative option uses it. Reactions, max retainers and loyalty in the CHA popup and where used (GM disposition prompt; hiring screens). Languages block with Literate / Illiterate filled from INT (overridable) and a quiet "N more to choose" link. No separate Encounters heading. |

## Spells (M7, additions to 05's existing spell design)

| # | Ruling |
|---|---|
| SP | One line per spell: name · worked-out duration · range · note; tap for details and source. Class list reference in ⋯ ("All <list> spells"), levels collapsed except the caster's highest, with an In book tick for book casters. Per-level slot header ("Level 1 · 2 per day · 1 left"). `spellcasting.reverseAt: "memorise" | "cast"` (default "cast"). Cast offers one confirm merging 05's light/condition offer with X-3 timed effects; instant spells just grey out. Notes stay in the pack author's own words. |

## Superseded text to fix in 05

- "Light sources tick … Warning at a GM-set threshold; at zero the item is consumed" and "Lanterns … A GM setting can make the refill automatic (default off)": replaced by M5-8 (warnAt from the pack, "Light another?", per-light "Keep lit") and M5-9.
- 04 `lantern.autoRefill`: replaced by the per-light `keepLit`.
- 05 "Reordering uses drag handles (⋮⋮ …)": replaced by hold-to-drag.
