# Manual checks: m5b-status-time (the GM's time-left stepper)

Open the pull request's Vercel preview (it uses the **test** database, which already has the new function). You need a campaign where you are the GM, one player with an approved character, and the clock started.

1. **The GM's stepper.** As the GM, put a status with a timer on the character (+ Status, Other…, 6 Turns). Tap the status to open its sheet. Under the Log row you see **Time left**, then **− 6 +** and the word "turns". End it now is still there, below it.
2. **A step up.** Tap **+**. At once the number reads 7, a toast says "<status> on <name>: 7 turns left" with **Undo**, the sheet's line reads "7 of 7 turns left" and the big ring is full.
3. **A step down.** Tap **−** three times. The number reads 4, the line "4 of 7 turns left", and the ring's arc is a little over half.
4. **Undo.** Tap **Undo** on the newest toast. The time goes back up one step (5 of 7). Open the Log: each step is a line "<you> changed the time left of <status> on <name>".
5. **At 1.** Step down to 1, then tap **−** again. Nothing changes; a line under the stepper says "It can't go under 1 turn. To end it now, tap End it now." The − button never greys out.
6. **A secret timer.** Add another status with a timer and **Hide time left** on. As the GM, open it: the stepper is there and works the same. Sign in as the player on another device or browser: the status shows "time hidden", and their log has no line for your steps.
7. **No timer, no stepper.** Add a status with **Until removed**. Its sheet has End it now and no Time left stepper.
8. **The player.** Sign in as the character's player and open a timed status on their character. They see "Only the GM changes the time left." and **Remove**, and no stepper.
9. **Phone width.** On a phone (or the browser at 375 px wide) open the GM's sheet of a timed status: the stepper and its word fit on one line, the buttons are a comfortable size, nothing runs off the edge.

**Gallery pictures:** none change. The status sheet has no gallery specimen (the gallery's status pictures are the rings and the big ring on their own), so no baseline is deleted. The layout job gets one new screen, `gm-scene-status-time` (the GM's sheet for a secret timer with the stepper), saved with the other layout screens.
