# Intent: the GM views a character as its player does

Author: Francis (written down by the designer from the driver's chat; his to correct) · Date: 2026-11-19 · Status: draft

## Problem
His words: "when i click "view sheet" what i want to see is the what the player sees when they load the player tab for that character. what i see today is the second image."

Today, in the GM's Players list, "View sheet" opens the page titled "Full sheet" (`src/app/GmCampaign.tsx:202`, `src/app/CharacterSheet.tsx:727`), not the character's Player tab. The GM feels it: he cannot see, from his own seat, what a player is looking at.

## Outcome
His words, to the driver's two questions:
- Asked whether the GM acts there as the player can, or only reads: "act".
- Asked whether it is the Player tab only, or all of the player's tabs: "Good question. when i Click View sheet, it should go to player tab. Pack should view pack as they do, and there should be an option for view magic as well. so basically if i want to view a player tab as a player, i do it from this menu."

So: from the GM's Players list, "View sheet" opens that character's Player tab as its player sees it; "Pack" opens the Pack as the player sees it; there is a way to open Magic the same way. The GM can act there as the player can.

Added on 2026-11-19, at the sitting. Asked to confirm this with "The players' Scene is not part of it.", his words: "Add scene as well". So the players' Scene opens the same way.

## Touches
- The GM's Players list (`src/app/GmCampaign.tsx`), the Player screen, the Pack tab, the Magic tab.
- docs/03 (who can do what to a character), docs/05 (the Player screen), docs/06 (the Players list's row).
- No pack.

## Constraints
- Hard rule 3: everything through commands, each checked by `can(user, command, target)` and logged.
- Hard rule 4: every act is logged; nothing is erased.
- Hard rule 5: nothing reaches a device that may not see it. docs/03 already says the GM "edits anything, sees everything" and "can view anything a player can view".
- Hard rule 7: never a disabled button.
- Mockups first: nothing here is built before a mockup he has approved.

## Out of scope
- ~~The players' Scene: he named the Player tab, the Pack and Magic.~~ In scope since his answer of 2026-11-19 (above).
- A player viewing another player's character.

## Open questions
- ⚑ Does Magic show for a character with no magic?
- ⚑ Which hidden-data and permission lines of docs/03 does it touch, if any? (Is any of the player's own actions closed to the GM today?)
- ⚑ In the log, is the GM's act there the GM's, or the player's?
- ⚑ Where do today's "Full sheet" page and its Edit go for the GM? (Item 22 of `test-feedback-2026-11-19.md` moves the player's Edit.)

## Links (filled in later)
Ruling: [`../design/rulings/dec-test-feedback-gm-view-2026-11-19.md`](../design/rulings/dec-test-feedback-gm-view-2026-11-19.md) (tfg-1 to tfg-5; its "Not settled" answers the open questions above or carries them on) · Plan: [`../plans/test-feedback-2026-11-19.md`](../plans/test-feedback-2026-11-19.md) (row C15) · Sitting: [`../design/notes/test-feedback-2026-11-19-sittings.md`](../design/notes/test-feedback-2026-11-19-sittings.md) (sitting 7) · Pull request: —

His three pictures are in his Drive, under `Pictures for approval\2026-11-19\gm-view-sheet\`. They are not in the repo.
