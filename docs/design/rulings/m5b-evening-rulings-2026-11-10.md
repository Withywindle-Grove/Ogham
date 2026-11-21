---
status: pending
milestone: m5b (ruled while the gate rewalk's sitting waited for a deploy; built after the sitting unless marked)
absorbed-into: pending, with the pull requests that build them (05 items, identification, weapon skills, pack updates, the spell step, the rules page; 06 the rule row's read-only variant, the notice; the M6 plan for id-1); docs/09-decisions-log.md (2026-11-10)
supersedes: mw-4 where a curse or a bonus against a foe is concerned (`m7-found-spells-and-rolled-results-2026-11-05.md`); the "built, not ruled" lists of `m5b-attack-sheet-skill-and-ammunition-2026-11-10.md` and `m5b-app-update-2026-11-10.md`, now ruled here
---

# Small rulings of the evening (2026-11-10)

The built-not-ruled choices from the pull requests made that evening (as-4, the Log's wording, Copy the set-up, the spell step, the version line and notice), put to Francis one at a time, and one finding from the Tester on the live app.

## Weapons, ammunition and what the player sees

- **as-5 A curse always counts.** A negative magic bonus on a weapon or on its ammunition is added to hit and to damage whatever the launcher and whatever the rules set says about adding two bonuses. (A cursed arrow from a magic bow in a setting that says nothing is added, not noted.)
- **as-6 A bonus against a kind of foe follows the same rule.** It always shows to whoever may see it, on a weapon or its ammunition, also where the ammunition's plain bonus is the GM's note under mw-4. It stays a line, never added: the app doesn't know the foe.
- **id-1 Hidden until identified; seen after one use. Deferred to M6, on purpose.** An unidentified weapon's or ammunition's modifier, bonus or curse, stays hidden from the player (their sheet reads as if the item were plain) while the GM sees the true figure. Once the weapon has been used in a fight the player sees its modifier, not its name or its other powers. **Built with the fight rules, automatic from the first attack, and not bridged before:** Francis, "wait to do it right the first time, no bridge before combat. Remember this when it fails tests." Until M6 a report of "I used it and still can't see the bonus" is this ruling, not a fault.
- **as-7 Specialised in a weapon outside the class** is possible with the GM's approval, by the same route as picking one. The Attack sheet shows both rows, "Specialised" and "Not your class's weapon", netted in the line.
- **as-8 The penalty shows in two more places:** the sheet's weapon-skills line and the GM's exception card.
- **fp-1 Some of a weapon's details always follow the pack.** On an item that comes from a pack, the weapon's modes, range, magic bonus and bonus against a foe are read from the current entry; the rest stays as ruled on F27 (the item's own copy wins, new keys come through). Found the same evening: a pack that corrected a mode never reached a weapon already owned, so a magic arrow still counted twice on it. The wider rule (everything inside an item's weapon and armour details follows the pack; what a person changed stays) is for after the gate.

## Creation and the sheet

- **sp-1** The sheet's count reads "Spell book: 1 spell, 3 cantrips": cantrips are in the book and are not mistaken for spells.
- **sp-2** The step for a class that knows powers by level is named after the powers ("Kinetic powers"), its foot counts down ("4 to go"), and when the setting offers fewer than the class may know it says "Only 3 at this level in your setting".

## The Log and the Rules tab

- **lg-1** Item names in the Log stay as the pack writes them; the app doesn't change their capitals.
- **cs-set-1's five built choices are kept:** section headings in the copied text; a rule names its pack only when several packs have optional rules; character fields left out; a copy-by-hand pop-up when the clipboard is blocked; the button first in the foot.
- **cs-set-2, where and how:** at the top of the player's Setting rules page, a section "How this campaign is set up" above the packs' contents; the GM's rule rows without controls (the rule, its choice, the changed-from-the-book mark, changed ones first), as a named read-only variant of the existing part; it shows the start level, every optional rule's choice and any app setting that affects how a player plays.

## The version line and notice (au-1, au-2)

Kept as built: the notice waits while a pop-up or creation is open; the version line's words; the refresh icon; the pop-up's title and line. Changed: the notice comes back each time the app returns to the screen while a version is still held (it does not stay on screen); while the check runs, "Checking for a new version…", replaced by the result; when the device is online and the server can't be reached, "Couldn't check just now. Try again in a moment."; the pop-up's button reads "Keep working".

09: 2026-11-10 — [items] A curse always counts, on a weapon or its ammunition, whatever the launcher or the setting's rule on adding bonuses, and a bonus against a kind of foe always shows the same way (as-5, as-6; narrows mw-4); an unidentified weapon's modifier stays hidden from the player until identified and shows after one use in a fight, built with the fight rules and deliberately not bridged before (id-1, M6) — A first swing tells you something; "wait to do it right the first time" (Francis) — `design/rulings/m5b-evening-rulings-2026-11-10.md`
09: 2026-11-10 — [items] Specialising in a weapon outside the class is possible with the GM's approval and shows both rows; the weapon penalty also shows on the weapon-skills line and the GM's exception card (as-7, as-8); on a pack item the weapon's modes, range, magic bonus and bonus against a foe always follow the current pack (fp-1), the wider rule waiting for after the gate — Both facts are true and the GM should see the cost when approving; a pack's correction wasn't reaching weapons already owned — `design/rulings/m5b-evening-rulings-2026-11-10.md`
09: 2026-11-10 — [ui] The sheet reads "Spell book: 1 spell, 3 cantrips"; a known-powers step is named after its powers and counts down; item names in the Log stay as the pack writes them; players see "How this campaign is set up" at the top of their rules page with read-only rule rows; the version notice returns while a version is held, the check says it is checking, and the blocked pop-up's button reads "Keep working" (sp-1, sp-2, lg-1, cs-set-2, au-1, au-2) — Small built choices put to Francis one at a time — `design/rulings/m5b-evening-rulings-2026-11-10.md`
