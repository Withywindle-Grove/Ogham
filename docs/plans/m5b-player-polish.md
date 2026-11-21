# m5b-player-polish: three rulings from Francis's Player test (2026-11-08)

Briefed by the coordinating session from Francis's rulings of 2026-11-08 (09 lines on `design-gate-m5b-walk`: hit
points in place, the Status ring symbol, the avatar tap) and the approved mockup
`docs/design/mockups/players/04-hit-points-inline.html`, alternative C. No plan file existed for the step; this one
records the brief so the artifact chain has its plan.

## The three changes

1. **Hit points in place (alternative C).** The Damage or heal pop-up leaves the Player screen. The box: "8 of 8" at
   the left, − and + (56 px) together at the right. Each tap applies at once (− takes 1, + heals 1). Taps within two
   seconds fold into one logged change (one `character.setHp` with the burst's total, sent from the client) and one
   Undo toast that updates as you tap ("Took 3 damage, 5 of 8"). Clamp at 0 and at the most, and say so; "0 of 8:
   Down" only when the rules set says that's Down (read from the data). +1 at the most changes nothing and says so.
   Tapping the figure opens a small Sheet to type a value. Someone who can't change it: the squares draw and a tap
   opens the blocked Sheet saying who may. The GM's views keep their own controls.
2. **The Status ring symbol** is centred and about half the ring's diameter; the ring's size stays. Fixed once in the
   StatusRing part.
3. **The avatar.** Tapping the avatar on the Player screen opens the portrait sheet (choose an image, take a photo,
   remove), reusing the sheet's Edit picker with its busy guard; anyone who may not change it gets the blocked Sheet.

## Tests

- a burst of three − is one command, one log line and one Undo, and Undo restores it;
- +1 at the most does nothing but says so;
- clamping at 0, with the toast words;
- another player's character opens the blocked Sheet;
- the avatar tap opens the picker;
- the symbol's box is 50 % of the ring's diameter and centred (tests/layout).

No database changes. Pictures: delete the baselines the change alters (players-standard), commit none.

## ⚑

None raised in the brief.

## Estimate

One builder session, one pull request.

## Departures

- **"Another player's character" is tested through its words and a retired campaign.** The Player screen only ever
  shows the viewer's own characters (`loadMyCharacters` filters by owner), so no screen today puts another player's
  character in the HP box. The blocked path is checked in the app through a retired campaign (where nothing may
  change), and the "Only Bram's player and the GM can change Bram's hit points." line through `whoMayChange` directly.
- **The 999 specimen became 96 of 99.** The gallery's HP box at 999 of 999 runs the HP bar off a phone (200
  segments of at least 4 px each, an `HpBar` limit that predates this step; the mockup's "the pips cap at 20 and
  become a bar" isn't built). Changing the bar is a design change, so the specimen uses 96 of 99 and the limit is
  listed for Design.
- **The portrait sheet saves with a button.** A picture chosen (or Remove) waits for **Save portrait** / **Remove
  portrait**, as the sheet's Edit does, because removing deletes the picture file (irreversible, so not an Undo).
- **Undo after a burst is sent is a second setHp** (as the damage pad's Undo was), so the log then reads two lines.
- **Words for the limits** not in the mockup: "0 of 8, the lowest it goes" (no Down in the rules), "Wren is at the
  lowest already, 0 of 8" and "Wren is at the most already, 8 of 8" (a tap that changes nothing), "No change, 5 of 8"
  (taps that cancel out). Listed in 06 Words batch 1 for Design to confirm.
