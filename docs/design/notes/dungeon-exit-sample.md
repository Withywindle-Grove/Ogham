# Dungeon exit: a sample rule for testing (draft, 2026-10-30)

An **invented** rule, written in our own words with invented numbers and results, inspired by a published blog idea (escaping the dungeon at the end of a session). Neither candidate setting pack (classic-advanced, fae-woodland) carries a structured dungeon-exit rule this shape, so this gives M5's End expedition something real to test. It lives in a private homebrew test pack; this copy documents the shape. Nothing here comes from a book.

## The rule in plain words
When the session or expedition ends with characters still in a dungeon, each character rolls to get out. The chance starts from how well they know the way (lost, knows where they are, has a clear way out), goes up or down with how dangerous this depth is for their level, and gets a bonus in a small site. It never goes below 2% or above 98%. A character who fails rolls on a mishap table.

## Pack shape (extends 07's `rulesSets[].dungeonExit`)
```json
"dungeonExit": {
  "onlyWithOption": "escape-at-end",
  "roll": { "die": "d100", "rollUnder": true,
            "base": { "choose": [
              { "id": "lost", "name": "Doesn't know where they are", "value": 20 },
              { "id": "known", "name": "Knows where they are", "value": 45 },
              { "id": "clear", "name": "Has a clear way out", "value": 70 } ] } },
  "modifiers": [ { "id": "small-site", "name": "Small site (a lair, a few rooms)", "value": 15 } ],
  "levelGap": { "compare": "depth", "per": 1, "value": 10,
                "note": "Each level the depth is above the character's level: −10. Each level below: +10." },
  "limits": { "min": 2, "max": 98 },
  "onFail": { "table": "escape-mishaps" },
  "note": "Rolled by each character still inside when the expedition or session ends."
}
```

## Mishap table (invented, d8)
| Roll | Result |
|---|---|
| 1 | Slips out unharmed. |
| 2 | Gets out, but changed for good (a scar, a curse, a stranger's face): the GM describes it. |
| 3 | Gets out hurt: lose 2d6 HP. If that would kill, read 7 instead. |
| 4 | Gets out, but drops 1d4 carried items (the player picks, or the GM rolls). |
| 5 | Caught or trapped inside. The party may learn where (GM). |
| 6 | Lost in the depths: stays inside, status Lost. |
| 7–8 | Dies inside. The body may be found by a later expedition (GM). |

## What it tests in the app
- A base chosen from a short list (not a fixed save), so the prompt needs a choice per character.
- A modifier from depth versus each character's level (worked out per character).
- Clamping (2–98).
- A d100 roll-under, unlike the saves the current 07 example uses.
- A failure table whose results touch HP, items, statuses (Lost, Dead) and plain text.
- 07's current example (`roll: { save }`, flat modifiers, `depth`) must still work: the format accepts either `save` or `die` with `base`.
