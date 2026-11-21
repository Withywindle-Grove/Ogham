# Manual checks: fix-pack-order-drag (the setting rules' order snapped back)

The automatic tests drag the pack list with pretend pointer events in a pretend browser. They don't prove what an
iPad's Safari does with a real finger: no test covers iPad Safari. These checks do. Run them on the pull request's
Vercel preview as the GM of a campaign with at least two setting packs and some homebrew.

1. Open the campaign, then **Rules**. Press and hold a setting pack's row about half a second until it lifts, and drag
   it up past the pack above it. Let go. **You should see** it stay where you dropped it at once, with no jump back.
2. On Francis's iPad: Drag a pack up one place; it stays; reload; it stayed. **Passed:** Francis, 2026-11-14, iPad:
   "Drag now works."
3. Drag a setting pack up above the campaign's homebrew and let go. **You should see** a pop-up "Can't move it there"
   saying "Your campaign's homebrew always sits above the setting rules." Close it: nothing has moved.
4. Drag a pack a place, and straight away hold another row. **You should see**, if the first move is still saving, a
   pop-up "Still saving" saying "The last change is still saving. Move it again in a moment." (On a fast connection
   the save may finish first, and the second row simply lifts.)
5. Unchanged: on the Scene, the Marching order still moves as before (hold, drag, let go).

## Gallery pictures this step changes

None expected: the gallery shows no setting rules order mid-drag, and the change is in how a drag lands and what a
move shows while it saves.
