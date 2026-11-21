---
status: absorbed
milestone: m5b
absorbed-into: docs/03-roles-permissions.md (Add to homebrew from the GM's review), docs/04-data-model.md (PC extras: a draft's class, race and scores), docs/05-features.md (Guided creation: Who they are, Gear, Languages, Review), docs/06-screens-and-design.md (the GM's review), docs/07-content-packs.md (`hitPoints`, `startingGear`, `startingEquipment`, sheet layouts player-readable), docs/09-decisions-log.md (2026-11-02), docs/plans/m5b-0c-creation-rebuild.md (Follow-up to slices 3–7)
supersedes: parts of design/rulings/m5b-0c-creation-rebuild-2026-11-01.md (cr-12 Decide later on Who they are; cr-15 and cr-17 "kept in the campaign's homebrew")
---

# Character creation: the follow-ups from slices 3–7 (design ruling, 2026-11-02)

The seven scope checks the builder left in `docs/plans/m5b-0c-creation-rebuild.md` (slices 3, 5, 6 and 7), ruled by Francis one at a time on 2026-11-02 with the design agent's context. Ids `cf-1` … `cf-7`.

- **cf-1 The hit-points re-roll as data.** `rulesSets[].hitPoints.reroll: { "atMost": N, "option"?: "<option id>", "note"? }`. Who they are offers **Roll again / Keep it** in a callout when the option (if named) is on and the die roll before the CON modifier is at most `atMost`; never forced; Roll again clears the number. The StartOverCallout part is reused. Without the block the callout is absent.
- **cf-2 `hitPoints` fields named in 07:** `{ startMinimum?, minimumPerDie?, reroll? }`. `startMinimum` is the floor of a level-1 character's hit points (Next says "at least N"); `minimumPerDie` is level-up's (M7). The rest of the section stays free reference text.
- **cf-3 No Decide later on Who they are** (A). The name makes the draft; hit points and alignment are answered here. Amends cr-12 and the mockup `creation/04`.
- **cf-4 Rolled-gear mode and given gear.** `rulesSets[].startingGear: { "shop": false }` hides Browse the shop; a setting whose rule depends on an option writes it through `byOption` (`"<option>=off": { "startingGear": { "shop": false }, "startingMoney": "…" }`) and the app reads the resolved value — no option ids in code. `rulesSets[].startingEquipment` (the items everyone gets, whatever the class) shows on Gear as a **Given** group at the top, ticked and not untickable, counted in the load.
- **cf-5 Sheet layouts become player-readable** (A). `fieldTemplate` joins the player-facing kinds: a layout holds field names, kinds, lists and `fill` marks, nothing secret. Per-race lists (`from` as a pattern) and a field's own option gate then work on a player's device. One read-rule and importer change (Fable).
- **cf-6 Other… stays on the character; the GM adds it to homebrew** (A). A typed language or trait entry is the character's own ("Name — note"); the GM's review lists each one with **Add to homebrew** (one tap, logged), after which the next player sees it as a pick. Players never write homebrew. Amends cr-15 and cr-17.
- **cf-7 Change › on Scores, Race and Class after the draft exists** (A). A new command, `creation.redo`, for an unapproved draft (owner or GM): re-walks Scores → Adjust with every value kept; a changed race or class **clears the picks of the steps after it** (spell book, kit and shop gear with the money refunded, weapon skills, trait lists, languages from the race or class) with a toast and Undo, and walks those steps again. Scores changed with the same class keep everything and re-check the requirements. 04: before approval the owner changes class, race and scores through this command only.

## Pack tasks (pack session)
Both settings: `hitPoints.reroll` (the option id and its threshold), `hitPoints.startMinimum` / `minimumPerDie` as named. Setting B: `startingGear.shop` and `startingMoney` split by `byOption` on its buy-equipment option; `startingEquipment` kept as a list of item ids.

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (seven lines tagged [characters], [packs]).

## Amendment (2026-11-02, evening; #282 ⚑ 6)
- **cf-7, hit points after a class change:** Francis ruled **B** — a changed class also clears the hit points (the hit die is the class's) and Who they are is walked again for the roll; a changed race alone keeps them.

