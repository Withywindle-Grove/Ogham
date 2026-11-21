# Brief for a cloud builder: dec-7 pieces 5 and 8, the map's view and a tap told from a drag (logic only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-7-map-view-math`. Pull request title: "dec-7 (logic): the map's fit, zoom and pan, and a tap told from a drag (mc-37, mc-43, dp-1)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Read
- `docs/plans/dec-7-linked-spots-screens.md`: pieces 5 and 8. You build a small slice of both: **the arithmetic only**. The map card, the pop-up, the frame and their controls are built later by someone else, from their approved pictures.
- `docs/design/rulings/dec-mockup-rulings-2026-11-12.md`: the rows mc-37, mc-43, mc-44a. `docs/design/rulings/dec-linked-spots-picks-2026-11-13.md`: the rows dp-1 and dp-3.
- How a place's map picture and a spot's position on it are carried today, if they are (search the place and pack code). Do not change it.

## The task
Pure functions with tests, in a new file; no component, no CSS, no event listeners, no database. All sizes are plain numbers given in; nothing reads the screen.

1. **Fit**: a picture's width and height and a frame's width and height give the scale and offset that show the whole picture, centred, never cropped, never enlarged beyond its own size unless the frame is larger and the caller asks.
2. **Opened on the party** (mc-37): given also a point in the picture (where the party is) and a starting zoom, the view centred on that point, **clamped** so the frame never shows beyond the picture's edge where the picture is larger than the frame, and centred on an axis where it is smaller. With no point known: Fit.
3. **Zoom in and out** by a step, about a point in the frame (the middle for the magnifier buttons; the pinch's midpoint for a pinch), between a smallest zoom (Fit) and a largest; the point under the finger stays under the finger; the result clamped as in 2.
4. **Pan** by a drag's distance, clamped as in 2.
5. **Back to where they are** and **Fit**: the two views a button returns to.
6. **A tap told from a drag** (dp-1): from a touch's start and end (position and time), "tap" when it lifted within about 10 px and half a second, else "drag". The two limits are named constants, so a play test can tune them.

Say in the status file what you chose for the zoom step and the largest zoom, as named constants with one line of why.

## Tests (purpose first)
A wide picture in a tall frame and the reverse; a picture smaller than the frame; the party at a corner (clamped) and in the middle; no party point (Fit); zoom in then out returns to the same view; the point under a pinch stays put; pan cannot leave the picture; zoom never below Fit nor above the largest; 9 px in 0.3 s is a tap, 11 px is a drag, 5 px in 0.7 s is a drag; zero sizes do not divide by zero.

## Fences particular to this piece
- If the place data today has no position for a spot on the picture, do not invent a field: your functions take the point as an argument, and you write down what you found.
- Do not touch the place panel, the Scene or any pack code.
